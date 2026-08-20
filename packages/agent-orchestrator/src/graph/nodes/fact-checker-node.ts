/**
 * Micro-Step 1A-Audit: Hybrid Fact-Checker Agent Node
 * Alias Table Lookup, Folklore Tone Gate, NLI Entailment & 4-Tier Escalation Path
 */

import { callLlm, envConfig } from '@chronoviet/shared-spec';
import { ChronoGraphState, FactCheckAuditEntry, getNodeLogger } from '../state.js';
import { validateFolkloreHypothesisTone } from '../../guardrails/folklore-validator.js';
import { evaluateNliEntailmentScore } from '../../guardrails/nli-hallucination-judge.js';

export async function factCheckerNode(state: ChronoGraphState): Promise<Partial<ChronoGraphState>> {
  const nodeLog = getNodeLogger(state, 'fact_checker');
  nodeLog.info('orchestrator.fact_checker_started', `Auditing ${Object.keys(state.chapterScripts).length} chapter scripts`, {
    projectId: state.projectId,
  });

  const updatedScripts: Record<number, string> = { ...state.chapterScripts };
  const auditLogs: FactCheckAuditEntry[] = [];
  const aliasTable = state.ragContext?.aliasTable || {};
  const groundTruthChunks = state.ragContext?.verifiedContext?.map((e) => `${e.canonicalName}: ${e.summary}`) || [];

  let hasSevereFailure = false;

  const entries = Object.entries(updatedScripts);

  const maxLlmConcurrency = envConfig.USE_LOCAL_LLM
    ? Math.max(1, envConfig.LOCAL_LLM_MAX_CONCURRENCY || 1)
    : 4;

  const results: {
    chapterIndex: number;
    script: string;
    escalationTier: number;
    auditLog: FactCheckAuditEntry;
  }[] = [];

  for (let i = 0; i < entries.length; i += maxLlmConcurrency) {
    const batch = entries.slice(i, i + maxLlmConcurrency);
    const batchResults = await Promise.all(
      batch.map(async ([key, rawScript]) => {
        const chapterIndex = Number(key);
        let script = rawScript;
        const detectedAliases: string[] = [];
        let escalationTier = 0;
        let auditDetails = 'Passed standard fact-checking.';

        // 1. Alias Table Inspection & Context-Safe Sanitization (Tier 1)
        for (const [canonical, aliases] of Object.entries(aliasTable)) {
          for (const alias of aliases) {
            if (!alias || alias.trim().length === 0) continue;
            if (alias.toLowerCase() === canonical.toLowerCase()) continue;

            if (script.toLowerCase().includes(alias.toLowerCase())) {
              detectedAliases.push(`${alias} -> ${canonical}`);

              // Escape regex special chars in alias and canonical
              const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const escapedCanonical = canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

              // Only replace standalone alias occurrences that are NOT already paired with the canonical name
              // (e.g. preserves "Tiền Ngô Vương Ngô Quyền", only replaces isolated "Tiền Ngô Vương" when not used as honorific title)
              const isolatedRegex = new RegExp(`(?<!${escapedCanonical}\\s{1,3})\\b${escapedAlias}\\b(?!\\s{1,3}${escapedCanonical})`, 'gi');

              if (isolatedRegex.test(script)) {
                // Avoid replacing if canonical name is already immediately adjacent
                script = script.replace(isolatedRegex, canonical);
                escalationTier = Math.max(escalationTier, 1);
                auditDetails = `Auto-corrected isolated alias '${alias}' to canonical '${canonical}'.`;
              }
            }
          }
        }

        // 2. Folklore Hypothesis Tone Check (Data-driven from RAG citations, confidence and topic)
        const isFolkloreTopic = /truyền thuyết|thần thoại|dã sử|sự tích|giai thoại/i.test(state.userPrompt);
        const hasFolkloreCitations = (state.ragContext?.citations || []).some((c) =>
          /lĩnh nam chích quái|việt điện u linh|dân gian|dã sử|truyền thuyết|thần thoại|giai thoại/i.test(c)
        );
        const hasFolkloreEntity = (state.ragContext?.verifiedContext || []).some(
          (e) => (e.confidenceScore !== undefined && e.confidenceScore < 0.75) || /dã sử|truyền thuyết|thần thoại/i.test(e.summary)
        );
        const isLevel3OrFolkloreSource = isFolkloreTopic || hasFolkloreCitations || hasFolkloreEntity;

        const folkloreCheck = validateFolkloreHypothesisTone(script, isLevel3OrFolkloreSource);
        if (!folkloreCheck.isValid) {
          nodeLog.warn('orchestrator.folklore_tone_violation', `Folklore tone violation in chapter ${chapterIndex}`, {
            failingSentences: folkloreCheck.failingSentences,
          });

          // Tier 0: LLM Self-Correction attempt
          try {
            const fixSystem = `Bạn là Chuyên gia Biên tập Sử học ChronoViet.
Nhiệm vụ: Biên tập lại đoạn kịch bản dã sử/truyền thuyết để tuân thủ quy chuẩn học thuật.
QUY TẮC:
1. Bổ sung các cụm từ mở đầu như 'Theo truyền thuyết', 'Tương truyền', 'Theo dã sử' vào trước các câu miêu tả sự kiện dã sử.
2. Giữ nguyên toàn bộ nội dung, độ dài, câu từ chính xác khác của kịch bản, không thêm bớt sự kiện mới.
3. Chỉ xuất văn bản kịch bản hoàn chỉnh sau khi sửa, không kèm lời giải thích.`;

            const fixUser = `Hãy biên tập lại đoạn văn sau để chuẩn hóa văn phong truyền thuyết:\n"${script}"`;

            const fixRes = await callLlm({
              messages: [
                { role: 'system', content: fixSystem },
                { role: 'user', content: fixUser },
              ],
              temperature: 0.1,
            });
            script = fixRes.content.trim();
            escalationTier = Math.max(escalationTier, 0);
            auditDetails = 'Corrected folklore tone hypothesis framing via LLM Self-Correction.';
          } catch (err: any) {
            // Eval Integrity: strict mode must not substitute a deterministic hypothesis prefix
            if (envConfig.EVAL_STRICT) {
              throw err;
            }
            // Fallback: prepend deterministic hypothesis signal
            script = `Theo tương truyền trong dân gian, ` + script;
            escalationTier = Math.max(escalationTier, 1);
            auditDetails = 'Prepended deterministic hypothesis signal to folklore narrative.';
          }
        }

        // 3. NLI Entailment Hallucination Judge
        if (groundTruthChunks.length > 0) {
          const nliResult = evaluateNliEntailmentScore({
            scriptClaim: script,
            groundTruthChunks,
          });

          if (nliResult.isHallucinated) {
            nodeLog.warn('orchestrator.nli_hallucination_flag', `NLI Hallucination flagged in chapter ${chapterIndex}`, {
              score: nliResult.entailmentScore,
            });
            escalationTier = Math.max(escalationTier, 2);
            auditDetails += ` NLI Entailment score: ${nliResult.entailmentScore}.`;
          }
        }

        return {
          chapterIndex,
          script,
          escalationTier,
          auditLog: {
            chapterIndex,
            passed: escalationTier < 3,
            escalationTier,
            detectedAliases,
            correctedText: script,
            details: auditDetails,
          } as FactCheckAuditEntry,
        };
      })
    );
    results.push(...batchResults);
  }

  for (const res of results) {
    updatedScripts[res.chapterIndex] = res.script;
    auditLogs.push(res.auditLog);
    if (res.escalationTier >= 3) {
      hasSevereFailure = true;
    }
  }

  const nextStatus = hasSevereFailure ? 'NEEDS_HUMAN_REVIEW' : 'CHAPTER_FACT_CHECKED';

  return {
    status: nextStatus,
    needsHumanReview: hasSevereFailure,
    currentStep: 5,
    chapterScripts: updatedScripts,
    factCheckLogs: auditLogs,
  };
}
