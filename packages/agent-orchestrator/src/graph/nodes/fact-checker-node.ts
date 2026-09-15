/**
 * Micro-Step 1A-Audit: Hybrid Fact-Checker Agent Node
 * Alias Table Lookup, Folklore Tone Gate, NLI Entailment & 4-Tier Escalation Path
 */

import { callLlm, envConfig } from '@chronoviet/infra';
import { CANONICAL_DYNASTY_BOUNDS, HISTORICAL_CHRONOLOGY, removeVietnameseTones } from '@chronoviet/shared-spec';
import { ChronoGraphState, FactCheckAuditEntry, getNodeLogger } from '../state.js';
import { validateFolkloreHypothesisTone } from '../../guardrails/folklore-validator.js';
import { evaluateNliEntailmentScore, evaluateNliWithLlmJudge, extractHistoricalTimeBounds } from '../../guardrails/nli-hallucination-judge.js';

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
        const flattenedAliasPairs: { canonical: string; alias: string }[] = [];
        for (const [canonical, aliases] of Object.entries(aliasTable)) {
          for (const alias of aliases) {
            if (!alias || alias.trim().length < 2) continue;
            if (alias.toLowerCase() === canonical.toLowerCase()) continue;
            flattenedAliasPairs.push({ canonical, alias });
          }
        }
        // Sort by longest alias first to prevent partial substring collision
        flattenedAliasPairs.sort((a, b) => b.alias.length - a.alias.length);

        for (const { canonical, alias } of flattenedAliasPairs) {
          const scriptLower = script.toLowerCase();
          const aliasLower = alias.toLowerCase();
          const canonicalLower = canonical.toLowerCase();

          if (scriptLower.includes(aliasLower) && !scriptLower.includes(canonicalLower)) {
            detectedAliases.push(`${alias} -> ${canonical}`);

            // Escape regex special chars in alias and canonical
            const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const escapedCanonical = canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            // Only replace standalone alias occurrences that are NOT already paired with the canonical name
            const isolatedRegex = new RegExp(`(?<!${escapedCanonical}\\s{1,3})(?:(?<=^|[\\s,.:;!?"'“”‘’—(]))${escapedAlias}(?=[\\s,.:;!?"'“”‘’—)]|$)(?!\\s{1,3}${escapedCanonical})`, 'gi');

            if (isolatedRegex.test(script)) {
              script = script.replace(isolatedRegex, canonical);
              escalationTier = Math.max(escalationTier, 1);
              auditDetails = `Auto-corrected isolated alias '${alias}' to canonical '${canonical}'.`;
            }
          }
        }

        // 2. Chapter-Scoped Folklore Hypothesis Tone Check
        const isGlobalFolkloreTopic = /truyền thuyết|thần thoại|dã sử|sự tích|giai thoại/i.test(state.userPrompt);
        const chapterObj = state.chapters?.[chapterIndex];
        const chapterText = (script + ' ' + (chapterObj?.title || '') + ' ' + (chapterObj?.summary || '')).toLowerCase();

        const chapterReferencedChunks = (state.ragContext?.verifiedContext || []).filter((e) => {
          const nameLower = e.canonicalName?.toLowerCase();
          return nameLower && chapterText.includes(nameLower);
        });

        const chapterHasLevel3Entity = chapterReferencedChunks.some(
          (e) => e.sourceReliability === 'LEVEL_3'
        );
        const hasLevel1CanonicalSource = chapterReferencedChunks.some(
          (e) => e.sourceReliability === 'LEVEL_1'
        );
        // Only trigger folklore hypothesis tone when topic is explicitly folklore OR chunk is LEVEL_3 without LEVEL_1 backing
        const isLevel3OrFolkloreSource =
          isGlobalFolkloreTopic || (chapterHasLevel3Entity && !hasLevel1CanonicalSource);

        const folkloreCheck = validateFolkloreHypothesisTone(script, isLevel3OrFolkloreSource);
        if (!folkloreCheck.isValid) {
          nodeLog.warn('orchestrator.folklore_tone_violation', `Folklore tone violation in chapter ${chapterIndex}`, {
            failingSentences: folkloreCheck.failingSentences,
          });

          // Tier 0: LLM Self-Correction attempt
          try {
            const fixSystem = `Bạn là Chuyên gia Biên tập Sử học ChronoViet.
Nhiệm vụ: Biên tập lại đoạn kịch bản dã sử/truyền thuyết để tuân thủ quy chuẩn học thuật.
QUY TẮC BẮT BUỘC:
1. Bổ sung các cụm từ mở đầu như 'Theo truyền thuyết', 'Tương truyền', 'Theo dã sử' vào trước các câu miêu tả sự kiện dã sử/thần kỳ.
2. TUYỆT ĐỐI KHÔNG thay đổi hoặc thay thế các nhân vật lịch sử, tướng lĩnh, địa danh, niên đại có trong văn bản gốc.
3. Giữ nguyên toàn bộ nội dung, độ dài, câu từ chính xác khác của kịch bản, không bịa đặt thêm sự kiện mới.
4. Chỉ xuất văn bản kịch bản hoàn chỉnh sau khi sửa, không kèm lời giải thích.`;

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

        // 3. Hybrid 3-Tier Fact-Checking & NLI Hallucination Verification
        if (groundTruthChunks.length > 0) {
          const verifiedContext = state.ragContext?.verifiedContext || [];
          const timeStarts = verifiedContext
            .map((e) => e.timeStart)
            .filter((t): t is number => typeof t === 'number' && t <= 2000);
          const timeEnds = verifiedContext
            .map((e) => e.timeEnd)
            .filter((t): t is number => typeof t === 'number' && t <= 2000);
          const allYears = [...timeStarts, ...timeEnds];

          // Incorporate canonical epoch and dynasty bounds if userPrompt or epoch is defined
          const textToMatch = [state.epoch || '', state.userPrompt || ''].join(' ').trim();
          if (textToMatch) {
            const normText = removeVietnameseTones(textToMatch).toLowerCase();
            const cleanText = normText.replace(/[^a-z0-9]/g, '');
            for (const bound of CANONICAL_DYNASTY_BOUNDS) {
              const matched = bound.aliases.some((alias) => {
                const normAlias = removeVietnameseTones(alias).toLowerCase();
                const cleanAlias = normAlias.replace(/[^a-z0-9]/g, '');
                return cleanText.includes(cleanAlias);
              });
              if (matched) {
                allYears.push(bound.startYear, bound.endYear);
              }
            }

            const epochClean = state.epoch
              ? removeVietnameseTones(state.epoch).toLowerCase().replace(/[^a-z0-9]/g, '')
              : '';

            for (const chron of HISTORICAL_CHRONOLOGY) {
              const idClean = chron.epochId.toLowerCase().replace(/[^a-z0-9]/g, '');
              const dynIdClean = (chron.dynastyId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              const eClean = removeVietnameseTones(chron.name).toLowerCase().replace(/[^a-z0-9]/g, '');
              const dClean = removeVietnameseTones(chron.dynastyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');

              const matchesEpoch =
                epochClean &&
                (idClean === epochClean ||
                  dynIdClean === epochClean ||
                  dynIdClean.includes(epochClean) ||
                  eClean.includes(epochClean) ||
                  dClean.includes(epochClean));

              const matchesPrompt = cleanText && (eClean.includes(cleanText) || cleanText.includes(eClean) || (dClean && cleanText.includes(dClean)));

              if (matchesEpoch || matchesPrompt) {
                allYears.push(chron.startYear, chron.endYear);
              }
            }
          }

          const epochBounds = allYears.length > 0
            ? { startYear: Math.min(...allYears), endYear: Math.max(...allYears) }
            : undefined;

          // Tier 1: Safe Epoch Date Guard ([minYear - 50, maxYear + 50], <= 1ms)
          const scriptYears = extractHistoricalTimeBounds(script);
          let dateAnomalyDetected = false;
          let dateAnomalyDetail = '';

          if (epochBounds && scriptYears.length > 0) {
            const minSafeYear = epochBounds.startYear - 50;
            const maxSafeYear = epochBounds.endYear + 50;
            for (const y of scriptYears) {
              if (y < minSafeYear || y > maxSafeYear) {
                dateAnomalyDetected = true;
                dateAnomalyDetail = `Năm ${y} nằm ngoài khung niên đại an toàn [${minSafeYear}, ${maxSafeYear}].`;
                break;
              }
            }
          }

          // Tier 2: Entity & Historical Anchor Verification (<= 5ms)
          const scriptLower = script.toLowerCase();
          const targetEntities = Array.from(
            new Set([
              ...(chapterObj?.introducedEntities || []),
              ...chapterReferencedChunks.map((e) => e.canonicalName).filter(Boolean),
            ])
          );
          let matchedEntityCount = 0;
          for (const ent of targetEntities) {
            if (!ent) continue;
            const entLower = ent.toLowerCase();
            const aliases = aliasTable[ent] || [];
            const isMatched = scriptLower.includes(entLower) || aliases.some((a) => a && scriptLower.includes(a.toLowerCase()));
            if (isMatched) {
              matchedEntityCount++;
            }
          }
          const entityRecall = targetEntities.length > 0 ? matchedEntityCount / targetEntities.length : 1.0;

          // Foreign era intrusion check: verify no conflicting out-of-epoch dynasties via SSOT
          let foreignDynastyIntrusion = false;
          let foreignDynastyDetail = '';
          if (epochBounds) {
            for (const dyn of CANONICAL_DYNASTY_BOUNDS) {
              const matchedAlias = dyn.aliases.find((a) => scriptLower.includes(a.toLowerCase()));
              if (matchedAlias) {
                if (dyn.endYear < epochBounds.startYear - 50 || dyn.startYear > epochBounds.endYear + 50) {
                  const comparativeRegex = new RegExp(`(?:như|kế thừa|tiếp nối|từ thời|khác với)\\s+(?:thời kỳ\\s+)?${matchedAlias}`, 'i');
                  if (!comparativeRegex.test(scriptLower)) {
                    foreignDynastyIntrusion = true;
                    foreignDynastyDetail = `Phát hiện nhân vật/triều đại lệch thời kỳ: ${dyn.name} (${matchedAlias}).`;
                    break;
                  }
                }
              }
            }
          }

          let nliResult;
          const isGroundedAndClean = !dateAnomalyDetected && !foreignDynastyIntrusion && (entityRecall >= 0.5 || targetEntities.length === 0);

          if (isGroundedAndClean) {
            // Fast-path: Tier 1 & 2 passed with 0 LLM calls!
            nliResult = {
              entailmentScore: 0.95,
              isHallucinated: false,
              verdict: 'ENTAILMENT' as const,
              explanation: 'Passed fast-path Tier 1 Safe Date Guard & Tier 2 Entity Verification without anomalies.',
            };
          } else {
            // Tier 3: Selective Neural NLI Judge (triggered only on genuine date anomalies or out-of-epoch intrusions)
            nodeLog.info('orchestrator.tier3_nli_judge_triggered', `Tier 3 Neural NLI Judge triggered for chapter ${chapterIndex}`, {
              chapterIndex,
              dateAnomalyDetected,
              dateAnomalyDetail,
              foreignDynastyIntrusion,
              entityRecall,
            });

            if (envConfig.USE_LOCAL_LLM && !process.env.VITEST) {
              try {
                nliResult = await evaluateNliWithLlmJudge({
                  scriptClaim: script,
                  groundTruthChunks,
                  epochBounds,
                });
              } catch {
                nliResult = evaluateNliEntailmentScore({
                  scriptClaim: script,
                  groundTruthChunks,
                  epochBounds,
                });
              }
            } else {
              nliResult = evaluateNliEntailmentScore({
                scriptClaim: script,
                groundTruthChunks,
                epochBounds,
              });
            }
          }

          if (nliResult.isHallucinated) {
            nodeLog.warn('orchestrator.nli_hallucination_flag', `NLI Hallucination flagged in chapter ${chapterIndex}`, {
              score: nliResult.entailmentScore,
              explanation: nliResult.explanation,
            });

            // Targeted Granular Scene/Chapter Patching
            let patchedSuccessfully = false;
            try {
              const patchSystem = `Bạn là Chuyên gia Thẩm định và Hiệu đính Lịch sử ChronoViet.
Nhiệm vụ: Sửa đúng câu/chi tiết lịch sử bị sai lệch/mâu thuẫn trong đoạn kịch bản mà KHÔNG làm thay đổi cấu trúc hay các phần đúng còn lại.
QUY TẮC:
1. Dựa trên BẰNG CHỨNG LỊCH SỬ XÁC THỰC được cung cấp để điều chỉnh dữ kiện mâu thuẫn.
2. Giữ nguyên độ dài, phong cách kể chuyện hào hùng, không thêm bớt tình tiết ngoài sử liệu.
3. Chỉ xuất đoạn kịch bản hoàn chỉnh sau khi vá lỗi, không giải thích.`;

              const patchUser = `BẰNG CHỨNG LỊCH SỬ XÁC THỰC:
${groundTruthChunks.slice(0, 5).join('\n')}

LỖI PHÁT HIỆN:
${[foreignDynastyDetail, nliResult.explanation].filter(Boolean).join('. ') || 'Dữ kiện mâu thuẫn với sử liệu.'}

KỊCH BẢN CẦN VÁ LỖI (CHƯƠNG ${chapterIndex + 1}):
"${script}"`;

              const patchRes = await callLlm({
                messages: [
                  { role: 'system', content: patchSystem },
                  { role: 'user', content: patchUser },
                ],
                temperature: 0.1,
              });

              const patchedScript = patchRes.content.trim();
              if (patchedScript && patchedScript.length >= 20) {
                const recheck = evaluateNliEntailmentScore({
                  scriptClaim: patchedScript,
                  groundTruthChunks,
                  epochBounds:
                    allYears.length > 0
                      ? { startYear: Math.min(...allYears), endYear: Math.max(...allYears) }
                      : undefined,
                });

                const patchedLower = patchedScript.toLowerCase();
                let patchHasForeignIntrusion = false;
                if (epochBounds) {
                  for (const dyn of CANONICAL_DYNASTY_BOUNDS) {
                    const matchedAlias = dyn.aliases.find((a) => patchedLower.includes(a.toLowerCase()));
                    if (matchedAlias && (dyn.endYear < epochBounds.startYear - 50 || dyn.startYear > epochBounds.endYear + 50)) {
                      const comparativeRegex = new RegExp(`(?:như|kế thừa|tiếp nối|từ thời|khác với)\\s+(?:thời kỳ\\s+)?${matchedAlias}`, 'i');
                      if (!comparativeRegex.test(patchedLower)) {
                        patchHasForeignIntrusion = true;
                        break;
                      }
                    }
                  }
                }

                if (!patchHasForeignIntrusion && !recheck.isHallucinated && recheck.entailmentScore >= 0.75) {
                  script = patchedScript;
                  patchedSuccessfully = true;
                  escalationTier = Math.max(escalationTier, 1);
                  auditDetails += ` Targeted granular scene patch applied: resolved contradiction via historical grounding.`;
                  nodeLog.info('orchestrator.granular_scene_patched', `Successfully repaired contradiction in chapter ${chapterIndex}`);
                }
              }
            } catch (patchErr: any) {
              nodeLog.warn('orchestrator.scene_patch_failed', `Targeted scene patch failed: ${patchErr.message}`);
            }

            if (!patchedSuccessfully) {
              if (foreignDynastyIntrusion || nliResult.entailmentScore < 0.6 || nliResult.verdict === 'CONTRADICTION') {
                escalationTier = Math.max(escalationTier, 3);
                auditDetails += ` Critical NLI Entailment failure (score: ${nliResult.entailmentScore}); routed to human review. ${foreignDynastyDetail || nliResult.explanation}`;
              } else {
                escalationTier = Math.max(escalationTier, 2);
                auditDetails += ` NLI Entailment score: ${nliResult.entailmentScore}.`;
              }
            }
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

  // Sort results by chapterIndex to maintain strict chronological order
  results.sort((a, b) => a.chapterIndex - b.chapterIndex);

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
