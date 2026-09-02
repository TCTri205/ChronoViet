import {
  ExtractedTriple,
  ExtractionOptions,
  DetailedExtractionResult,
} from './types.js';
import { extractTriplesFromText } from './rules/rule-extractor.js';
import { extractTriplesWithLLMDetailed } from './llm/llm-extractor.js';

/**
 * Asynchronous two-tier ensemble extraction with detailed execution telemetry
 */
export async function extractTriplesFromTextDetailedAsync(
  text: string,
  options?: ExtractionOptions
): Promise<DetailedExtractionResult> {
  const startTime = Date.now();
  const fastPathTriples = extractTriplesFromText(text, options);

  if (options?.regexOnly) {
    return {
      triples: fastPathTriples,
      strategy: 'regex_only',
      durationMs: Date.now() - startTime,
    };
  }

  const { triples: llmTriples, candidateSpans, res, error } = await extractTriplesWithLLMDetailed(text, options);

  // 3-Stage Ensemble Fusion & Deduplication Gate:
  // Combines high-confidence deterministic Stage 1 Fast-Path Triples with Stage 2 Semantic LLM Triples
  const finalTriples: ExtractedTriple[] = [];
  const seenKeys = new Set<string>();

  const addTriple = (t: ExtractedTriple) => {
    const key = `${t.sourceEntityId.toLowerCase()}::${t.relationType.toUpperCase()}::${t.targetEntityId.toLowerCase()}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      finalTriples.push(t);
    }
  };

  // 1. Add LLM Triples (which already include deterministic syntactic and lineage triples)
  if (llmTriples && Array.isArray(llmTriples) && llmTriples.length > 0) {
    for (const t of llmTriples) {
      addTriple(t);
    }
    // Safely merge validated deterministic Stage 1 Fast-Path Triples for entity pairs untouched by LLM
    const hasPair = (idA: string, idB: string) => {
      const a = idA.toLowerCase();
      const b = idB.toLowerCase();
      return finalTriples.some((vt) => {
        const va = vt.sourceEntityId.toLowerCase();
        const vb = vt.targetEntityId.toLowerCase();
        return (va === a && vb === b) || (va === b && vb === a);
      });
    };
    for (const ft of fastPathTriples) {
      if (!hasPair(ft.sourceEntityId, ft.targetEntityId)) {
        if (
          ft.relationType === 'ALIAS_OF' ||
          ft.relationType === 'SAME_AS_LOCATION' ||
          ft.relationType === 'ROYAL_LINEAGE' ||
          ft.relationType === 'LED_BY' ||
          ft.relationType === 'MENTIONED_IN' ||
          ft.relationType === 'HAPPENED_IN' ||
          ft.relationType === 'HAPPENED_AT' ||
          ft.relationType === 'PART_OF'
        ) {
          addTriple(ft);
        }
      }
    }
  } else {
    // 2. Fallback to Fast-Path Triples ONLY when LLM is unavailable or produces no output
    for (const t of fastPathTriples) {
      addTriple(t);
    }
  }

  const durationMs = Date.now() - startTime;
  const strategy: DetailedExtractionResult['strategy'] = error ? 'rule_based_fallback' : 'ensemble_ai';
  const isCached = (llmTriples as any)?._meta?.cached === true || res?.cached === true;

  return {
    triples: finalTriples,
    candidateSpans,
    provider: res?.provider,
    targetProvider: res?.targetProvider,
    targetId: res?.targetId,
    model: res?.model,
    strategy,
    durationMs: isCached ? 0 : durationMs,
    llmError: error,
    cached: isCached,
  };
}

/**
 * Asynchronous two-tier ensemble extraction combining Stage 1 NER & Stage 2 LLM Engine
 */
export async function extractTriplesFromTextAsync(
  text: string,
  options?: ExtractionOptions
): Promise<ExtractedTriple[]> {
  const detailed = await extractTriplesFromTextDetailedAsync(text, options);
  const triples = detailed.triples;
  (triples as any)._meta = {
    provider: detailed.provider,
    targetProvider: detailed.targetProvider,
    targetId: detailed.targetId,
    model: detailed.model,
    durationMs: detailed.durationMs,
    strategy: detailed.strategy,
    llmError: detailed.llmError,
    cached: detailed.cached ?? false,
  };
  return triples;
}

/**
 * Extract triples using LLM (Direct array wrapper)
 */
export async function extractTriplesWithLLM(
  text: string,
  options?: ExtractionOptions
): Promise<ExtractedTriple[]> {
  const result = await extractTriplesWithLLMDetailed(text, options);
  return result.triples;
}
