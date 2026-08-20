/**
 * Chrono-RAG Module 0 (Data Preprocessing & Ingestion Engine) Evaluation Metrics
 * Multi-Axis Closed-Loop Evaluation Suite:
 * 1. Strict Triple F1 (TP <=> Subject == Gold.S && Relation == Gold.R && Object == Gold.O)
 * 2. Directional Accuracy (S -> O vs O -> S according to Canonical Directionality Matrix)
 * 3. Boundary Span F1 (Exact startOffset & endOffset character alignment)
 * 4. 7-Taxonomy Type Confusion Matrix
 * 5. Hallucination Edge Rate (< 2.0%)
 * 6. Historical OOV Recall (Recall on novel out-of-dictionary entities)
 * 7. Dual-Axis Epoch Overlap Compliance Rate (1771-1777 EPOCH_09 + EPOCH_10)
 * 8. Hierarchical Parent/Child Chunk Structural Quality (100%)
 */

import {
  CHUNK_PARENT_MIN_WORDS,
  CHUNK_PARENT_MAX_WORDS,
  CHUNK_CHILD_MIN_WORDS,
  CHUNK_CHILD_MAX_WORDS,
  GoldenBenchmarkEntity,
  GoldenBenchmarkTriple,
  CandidateEntitySpan,
} from '@chronoviet/shared-spec';

export interface EntityDisambiguationTestCase {
  input: string;
  expectedCanonicalId: string;
  expectedCanonicalName: string;
  isLocation?: boolean;
  expectedModernLocation?: string;
}

export interface TripleExtractionTestCase {
  id: string;
  sourceText: string;
  expectedTriples: Array<{
    source: string;
    relation: string;
    target: string;
  }>;
}

export interface ChunkQualityResult {
  chunkId: string;
  parentChunkId?: string;
  tokenCount: number;
  hasRequiredMetadata: boolean;
  validTokenBounds: boolean;
  isValid: boolean;
  errors: string[];
}

export interface StrictTripleMetrics {
  totalGroundTruth: number;
  totalExtracted: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;
  directionalCorrect: number;
  directionalInverted: number;
  directionalAccuracy: number;
  hallucinatedCount: number;
  hallucinationRate: number;
}

export interface BoundarySpanMetrics {
  totalGroundTruthSpans: number;
  totalExtractedSpans: number;
  exactMatches: number;
  partialMatches: number;
  precision: number;
  recall: number;
  f1: number;
  oovTotal: number;
  oovRetrieved: number;
  oovRecall: number;
  avgLatencyMs: number;
}

export interface TypeConfusionMatrix {
  taxonomyTypes: string[];
  matrix: Record<string, Record<string, number>>;
  totalEvaluated: number;
  correctClassified: number;
  accuracy: number;
}

export interface EpochOverlapMetrics {
  totalOverlapCases: number;
  fullyCompliantCases: number;
  complianceRate: number;
}

export interface ComprehensiveIngestEvaluationReport {
  timestamp: string;
  model: string;
  kpis: {
    entityDisambiguation: {
      totalEvaluated: number;
      passedCount: number;
      accuracyPercent: number;
      targetPercent: number;
      passed: boolean;
    };
    stage1Ner: BoundarySpanMetrics & {
      targetF1Percent: number;
      targetOovPercent: number;
      passed: boolean;
    };
    stage2Triples: StrictTripleMetrics & {
      targetF1Percent: number;
      targetDirectionalPercent: number;
      passed: boolean;
    };
    typeConfusion: TypeConfusionMatrix;
    epochOverlap: EpochOverlapMetrics & {
      targetPercent: number;
      passed: boolean;
    };
    goldenDatasetIntegrity: {
      totalDatasets: number;
      passedDatasets: number;
      integrityRatePercent: number;
      throughputDocsPerSec: number;
      throughputChunksPerSec: number;
      passed: boolean;
    };
    hierarchicalChunkQuality: {
      totalChunksEvaluated: number;
      validChunksCount: number;
      qualityRatePercent: number;
      targetPercent: number;
      passed: boolean;
    };
  };
  overallPassed: boolean;
  diagnosticFailures: {
    disambiguationFailures: string[];
    tripleExtractionFailures: string[];
    nerBoundaryFailures: string[];
    quarantineIssues: string[];
  };
}

export interface IngestKpiReport {
  timestamp: string;
  preflight?: unknown;
  kpis: {
    entityDisambiguation: {
      totalEvaluated: number;
      passedCount: number;
      accuracyPercent: number;
      targetPercent: number;
      passed: boolean;
    };
    tripleExtraction: {
      totalEvaluated: number;
      passedCount: number;
      accuracyPercent: number;
      targetPercent: number;
      passed: boolean;
    };
    goldenDatasetIntegrity: {
      totalDatasets: number;
      passedDatasets: number;
      integrityRatePercent: number;
      targetPercent: number;
      throughputDocsPerSec: number;
      throughputChunksPerSec: number;
      passed: boolean;
    };
    hierarchicalChunkQuality: {
      totalChunksEvaluated: number;
      validChunksCount: number;
      qualityRatePercent: number;
      targetPercent: number;
      passed: boolean;
    };
  };
  overallPassed: boolean;
  details: {
    entityDisambiguationFailures: string[];
    tripleExtractionFailures: string[];
    goldenDatasetResults: Array<{
      filename: string;
      title: string;
      domain: string;
      parentChunksCount: number;
      childChunksCount: number;
      entitiesResolved: number;
      entitiesTotal: number;
      triplesResolved: number;
      triplesTotal: number;
      passed: boolean;
      error?: string;
    }>;
  };
}

/**
 * Compute Strict Triple F1, Directional Accuracy & Hallucination Rate
 * True Positive iff S, R, O match canonical values exactly.
 */
export function computeStrictTripleMetrics(
  predicted: Array<{ sourceEntityId: string; relationType: string; targetEntityId: string; confidence?: number }>,
  groundTruth: GoldenBenchmarkTriple[],
  validEntityIdsInSnippet?: Set<string>
): StrictTripleMetrics {
  const normKey = (s: string, r: string, o: string) => `${s.trim().toLowerCase()}::${r.trim().toUpperCase()}::${o.trim().toLowerCase()}`;
  const invKey = (s: string, r: string, o: string) => `${o.trim().toLowerCase()}::${r.trim().toUpperCase()}::${s.trim().toLowerCase()}`;

  const gtSet = new Set(groundTruth.map(t => normKey(t.sourceEntityId, t.relationType, t.targetEntityId)));
  const gtInvMap = new Map<string, string>();
  for (const t of groundTruth) {
    gtInvMap.set(invKey(t.sourceEntityId, t.relationType, t.targetEntityId), normKey(t.sourceEntityId, t.relationType, t.targetEntityId));
  }

  let truePositives = 0;
  let falsePositives = 0;
  let directionalCorrect = 0;
  let directionalInverted = 0;
  let hallucinatedCount = 0;

  const matchedGtKeys = new Set<string>();

  for (const p of predicted) {
    const key = normKey(p.sourceEntityId, p.relationType, p.targetEntityId);
    const revKey = invKey(p.sourceEntityId, p.relationType, p.targetEntityId);

    if (gtSet.has(key)) {
      truePositives++;
      directionalCorrect++;
      matchedGtKeys.add(key);
    } else if (gtInvMap.has(key)) {
      // Inverted direction!
      falsePositives++;
      directionalInverted++;
    } else {
      falsePositives++;
      // Check if entities were hallucinated
      if (validEntityIdsInSnippet) {
        const sValid = validEntityIdsInSnippet.has(p.sourceEntityId.trim().toLowerCase());
        const oValid = validEntityIdsInSnippet.has(p.targetEntityId.trim().toLowerCase());
        if (!sValid || !oValid) {
          hallucinatedCount++;
        }
      }
    }
  }

  const falseNegatives = Math.max(0, groundTruth.length - truePositives);

  const precision = predicted.length > 0 ? (truePositives / predicted.length) * 100 : (groundTruth.length === 0 ? 100 : 0);
  const recall = groundTruth.length > 0 ? (truePositives / groundTruth.length) * 100 : (predicted.length === 0 ? 100 : 0);
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  const totalDirectionalAttempts = directionalCorrect + directionalInverted;
  const directionalAccuracy = totalDirectionalAttempts > 0 ? (directionalCorrect / totalDirectionalAttempts) * 100 : 100;
  const hallucinationRate = predicted.length > 0 ? (hallucinatedCount / predicted.length) * 100 : 0;

  return {
    totalGroundTruth: groundTruth.length,
    totalExtracted: predicted.length,
    truePositives,
    falsePositives,
    falseNegatives,
    precision: Number(precision.toFixed(2)),
    recall: Number(recall.toFixed(2)),
    f1: Number(f1.toFixed(2)),
    directionalCorrect,
    directionalInverted,
    directionalAccuracy: Number(directionalAccuracy.toFixed(2)),
    hallucinatedCount,
    hallucinationRate: Number(hallucinationRate.toFixed(2)),
  };
}

/**
 * Compute Boundary Span F1 & Historical OOV Recall for Stage 1 NER
 */
export function computeBoundarySpanMetrics(
  predictedSpans: CandidateEntitySpan[],
  groundTruthEntities: GoldenBenchmarkEntity[],
  knownDictionaryIds?: Set<string>,
  latencyMs: number = 0
): BoundarySpanMetrics {
  let exactMatches = 0;
  let partialMatches = 0;
  let oovTotal = 0;
  let oovRetrieved = 0;

  const matchedGt = new Set<number>();

  for (let i = 0; i < groundTruthEntities.length; i++) {
    const gt = groundTruthEntities[i];
    const isOov = knownDictionaryIds ? !knownDictionaryIds.has(gt.id.toLowerCase()) : false;
    if (isOov) oovTotal++;

    const gtStart = gt.startOffset ?? -1;
    const gtEnd = gt.endOffset ?? -1;

    let foundExact = false;
    let foundPartial = false;

    for (const pred of predictedSpans) {
      if (gtStart >= 0 && gtEnd >= 0) {
        if (pred.startOffset === gtStart && pred.endOffset === gtEnd) {
          foundExact = true;
          break;
        } else if (Math.max(pred.startOffset, gtStart) < Math.min(pred.endOffset, gtEnd)) {
          foundPartial = true;
        }
      } else {
        if (pred.text.toLowerCase() === gt.name.toLowerCase()) {
          foundExact = true;
          break;
        } else if (pred.text.toLowerCase().includes(gt.name.toLowerCase()) || gt.name.toLowerCase().includes(pred.text.toLowerCase())) {
          foundPartial = true;
        }
      }
    }

    if (foundExact) {
      exactMatches++;
      matchedGt.add(i);
      if (isOov) oovRetrieved++;
    } else if (foundPartial) {
      partialMatches++;
      if (isOov) oovRetrieved++;
    }
  }

  const precision = predictedSpans.length > 0 ? (exactMatches / predictedSpans.length) * 100 : (groundTruthEntities.length === 0 ? 100 : 0);
  const recall = groundTruthEntities.length > 0 ? (exactMatches / groundTruthEntities.length) * 100 : (predictedSpans.length === 0 ? 100 : 0);
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const oovRecall = oovTotal > 0 ? (oovRetrieved / oovTotal) * 100 : 100;

  return {
    totalGroundTruthSpans: groundTruthEntities.length,
    totalExtractedSpans: predictedSpans.length,
    exactMatches,
    partialMatches,
    precision: Number(precision.toFixed(2)),
    recall: Number(recall.toFixed(2)),
    f1: Number(f1.toFixed(2)),
    oovTotal,
    oovRetrieved,
    oovRecall: Number(oovRecall.toFixed(2)),
    avgLatencyMs: Number(latencyMs.toFixed(2)),
  };
}

/**
 * 7-Taxonomy Type Confusion Matrix
 */
export const TAXONOMY_TYPES = [
  'HISTORICAL_PERSON',
  'LOCATION',
  'EVENT_BATTLE',
  'DYNASTY_ERA',
  'ORGANIZATION',
  'ARTIFACT',
  'DOCUMENT_CULTURE',
] as const;

export function computeTypeConfusionMatrix(
  evaluatedPairs: Array<{ groundTruthType: string; predictedType: string }>
): TypeConfusionMatrix {
  const matrix: Record<string, Record<string, number>> = {};
  for (const t1 of TAXONOMY_TYPES) {
    matrix[t1] = {};
    for (const t2 of TAXONOMY_TYPES) {
      matrix[t1][t2] = 0;
    }
  }

  let correctClassified = 0;
  for (const pair of evaluatedPairs) {
    const gt = pair.groundTruthType in matrix ? pair.groundTruthType : 'OTHER';
    const pred = pair.predictedType in matrix ? pair.predictedType : 'OTHER';

    if (matrix[gt] && matrix[gt][pred] !== undefined) {
      matrix[gt][pred]++;
    }
    if (pair.groundTruthType === pair.predictedType) {
      correctClassified++;
    }
  }

  const accuracy = evaluatedPairs.length > 0 ? (correctClassified / evaluatedPairs.length) * 100 : 100;

  return {
    taxonomyTypes: [...TAXONOMY_TYPES],
    matrix,
    totalEvaluated: evaluatedPairs.length,
    correctClassified,
    accuracy: Number(accuracy.toFixed(2)),
  };
}

/**
 * Validate hierarchical chunking rules:
 * - Parent chunk: token length between 2000..3000 words
 * - Child chunk: token length between 300..500 words
 * - Metadata enrichment: contains title, sourceName, sourceReliability
 */
export function evaluateChunkQuality(chunk: {
  id: string;
  textContent: string;
  parentChunkId?: string;
  title?: string;
  sourceName?: string;
  sourceReliability?: string;
}): ChunkQualityResult {
  const errors: string[] = [];
  const words = chunk.textContent.trim().split(/\s+/).filter(Boolean);
  const tokenCount = words.length;

  const isParent = !chunk.parentChunkId;
  let validTokenBounds = false;

  if (isParent) {
    validTokenBounds = tokenCount >= CHUNK_PARENT_MIN_WORDS && tokenCount <= CHUNK_PARENT_MAX_WORDS;
    if (!validTokenBounds) {
      errors.push(`Parent chunk token count ${tokenCount} outside bounds [${CHUNK_PARENT_MIN_WORDS}, ${CHUNK_PARENT_MAX_WORDS}]`);
    }
  } else {
    validTokenBounds = tokenCount >= CHUNK_CHILD_MIN_WORDS && tokenCount <= CHUNK_CHILD_MAX_WORDS;
    if (!validTokenBounds) {
      errors.push(`Child chunk token count ${tokenCount} outside bounds [${CHUNK_CHILD_MIN_WORDS}, ${CHUNK_CHILD_MAX_WORDS}]`);
    }
  }

  const hasRequiredMetadata = Boolean(chunk.title && chunk.sourceName && chunk.sourceReliability);
  if (!hasRequiredMetadata) {
    errors.push('Missing required chunk metadata (title, sourceName, or sourceReliability)');
  }

  const isValid = validTokenBounds && hasRequiredMetadata;

  return {
    chunkId: chunk.id,
    parentChunkId: chunk.parentChunkId,
    tokenCount,
    hasRequiredMetadata,
    validTokenBounds,
    isValid,
    errors,
  };
}

export {
  DiagnosticIssueType,
  IngestDiagnosticIssue,
  IngestDiagnosticReport,
} from '../src/diagnostics/diagnostic-types.js';
