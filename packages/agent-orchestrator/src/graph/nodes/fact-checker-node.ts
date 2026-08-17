/**
 * Micro-Step 1A-Audit: Hybrid Fact-Checker Agent Node
 * Alias Table Lookup, Folklore Tone Gate, NLI Entailment & 4-Tier Escalation Path
 */

import { callLlm, createLogger, envConfig } from '@chronoviet/shared-spec';
import { ChronoGraphState, FactCheckAuditEntry } from '../state.js';
import { validateFolkloreHypothesisTone } from '../../guardrails/folklore-validator.js';
import { evaluateNliEntailmentScore } from '../../guardrails/nli-hallucination-judge.js';

const log = createLogger({ service: 'agent-orchestrator' });

export async function factCheckerNode(state: ChronoGraphState): Promise<Partial<ChronoGraphState>> {
  log.info('orchestrator.fact_checker_started', `Auditing ${Object.keys(state.chapterScripts).length} chapter scripts`, {
    projectId: state.projectId,
  });

  const updatedScripts: Record<number, string> = { ...state.chapterScripts };
  const auditLogs: FactCheckAuditEntry[] = [];
  const aliasTable = state.ragContext?.aliasTable || {};
  const groundTruthChunks = state.ragContext?.verifiedContext?.map((e) => `${e.canonicalName}: ${e.summary}`) || [];

  let hasSevereFailure = false;

  const entries = Object.entries(updatedScripts);

  const results = await Promise.all(
    entries.map(async ([key, rawScript]) => {
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

      // 2. Folklore Hypothesis Tone Check
      const folkloreCheck = validateFolkloreHypothesisTone(script, true);
      if (!folkloreCheck.isValid) {
        log.warn('orchestrator.folklore_tone_violation', `Folklore tone violation in chapter ${chapterIndex}`, {
          failingSentences: folkloreCheck.failingSentences,
        });

        // Tier 0: LLM Self-Correction attempt
        try {
          const fixPrompt = `Hãy biên tập lại câu sau để tuân thủ quy chuẩn truyền thuyết lịch sử (bổ sung cụm từ 'Theo truyền thuyết' hoặc 'Tương truyền'):\n"${script}"`;
          const fixRes = await callLlm({
            messages: [{ role: 'user', content: fixPrompt }],
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
          log.warn('orchestrator.nli_hallucination_flag', `NLI Hallucination flagged in chapter ${chapterIndex}`, {
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
