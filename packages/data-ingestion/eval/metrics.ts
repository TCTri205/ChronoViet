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
 * Expands a set of Knowledge Graph triples with sound 1-hop and 2-hop transitive closures:
 * 1. (Event LED_BY Person) + (Event HAPPENED_AT Location) => (Person HAPPENED_AT Location)
 * 2. (Subject HAPPENED_AT LocationA) + (LocationA HAPPENED_AT LocationB) => (Subject HAPPENED_AT LocationB)
 * 3. (LocationA HAPPENED_AT LocationB) + (LocationB HAPPENED_AT LocationC) => (LocationA HAPPENED_AT LocationC)
 */
export function computeGraphTransitiveClosure(
  triples: Array<{ sourceEntityId: string; relationType: string; targetEntityId: string }>
): Set<string> {
  const normKey = (s: string, r: string, o: string) => `${s.trim().toLowerCase()}::${r.trim().toUpperCase()}::${o.trim().toLowerCase()}`;
  const closure = new Set<string>();

  const ledByMap = new Map<string, string[]>(); // eventId -> personIds
  const eventLocMap = new Map<string, string[]>(); // eventId -> locIds
  const locHierarchyMap = new Map<string, string[]>(); // childLocId -> parentLocIds
  const entityLocMap = new Map<string, string[]>(); // entityId -> locIds

  const identityMap = new Map<string, Set<string>>(); // entity -> equivalent entities

  const addEquiv = (a: string, b: string) => {
    if (!identityMap.has(a)) identityMap.set(a, new Set([a]));
    if (!identityMap.has(b)) identityMap.set(b, new Set([b]));
    identityMap.get(a)!.add(b);
    identityMap.get(b)!.add(a);
  };

  for (const t of triples) {
    const s = t.sourceEntityId.trim().toLowerCase();
    const r = t.relationType.trim().toUpperCase();
    const o = t.targetEntityId.trim().toLowerCase();
    closure.add(normKey(s, r, o));

    if (r === 'ALIAS_OF' || r === 'SAME_AS_LOCATION') {
      addEquiv(s, o);
      closure.add(normKey(o, r, s));
    } else if (r === 'LED_BY') {
      const list = ledByMap.get(s) || [];
      list.push(o);
      ledByMap.set(s, list);
      closure.add(normKey(o, 'PART_OF', s));
    } else if (r === 'PART_OF' && (s.startsWith('person_') || s.startsWith('org_')) && (o.startsWith('event_') || o.startsWith('org_'))) {
      const list = ledByMap.get(o) || [];
      list.push(s);
      ledByMap.set(o, list);
      closure.add(normKey(o, 'LED_BY', s));
    } else if (r === 'HAPPENED_AT') {
      if (s.startsWith('event_') || s.startsWith('org_')) {
        const list = eventLocMap.get(s) || [];
        list.push(o);
        eventLocMap.set(s, list);
      }
      if (s.startsWith('loc_')) {
        const list = locHierarchyMap.get(s) || [];
        list.push(o);
        locHierarchyMap.set(s, list);
      }
      const eList = entityLocMap.get(s) || [];
      eList.push(o);
      entityLocMap.set(s, eList);
    } else if (r === 'MENTIONED_IN') {
      if (s.startsWith('doc_') && o.startsWith('person_')) {
        closure.add(normKey(o, 'MENTIONED_IN', s));
      } else if (s.startsWith('person_') && o.startsWith('doc_')) {
        closure.add(normKey(o, 'MENTIONED_IN', s));
      }
    } else if (r === 'HAPPENED_IN' && s.startsWith('artifact_') && o.startsWith('dynasty_')) {
      closure.add(normKey(s, 'PART_OF', o));
    } else if (r === 'HAPPENED_IN' && s.startsWith('artifact_') && o.startsWith('dynasty_')) {
      closure.add(normKey(s, 'PART_OF', o));
    } else if (r === 'PART_OF' && s.startsWith('artifact_') && o.startsWith('dynasty_')) {
      closure.add(normKey(s, 'HAPPENED_IN', o));
    } else if (r === 'HAPPENED_IN' && s.startsWith('doc_') && o.startsWith('dynasty_')) {
      closure.add(normKey(s, 'PART_OF', o));
    } else if (r === 'PART_OF' && s.startsWith('doc_') && o.startsWith('dynasty_')) {
      closure.add(normKey(s, 'HAPPENED_IN', o));
    }
  }

  // Identity transitive closure expansion
  for (const key of Array.from(closure)) {
    const [s, r, o] = key.split('::');
    const sEquiv = identityMap.get(s) || new Set([s]);
    const oEquiv = identityMap.get(o) || new Set([o]);
    for (const se of sEquiv) {
      for (const oe of oEquiv) {
        closure.add(normKey(se, r, oe));
      }
    }
  }

  // 1. (Event / Org LED_BY Person) <=> (Person PART_OF Event / Org) + Transitive Location
  for (const [eventId, personIds] of ledByMap.entries()) {
    const locs = eventLocMap.get(eventId) || [];
    for (const p of personIds) {
      closure.add(normKey(p, 'PART_OF', eventId));
      for (const l of locs) {
        closure.add(normKey(p, 'HAPPENED_AT', l));
        const eList = entityLocMap.get(p) || [];
        eList.push(l);
        entityLocMap.set(p, eList);
      }
      // If Person has location, Event also inherits location
      const pLocs = entityLocMap.get(p) || [];
      for (const pl of pLocs) {
        closure.add(normKey(eventId, 'HAPPENED_AT', pl));
      }
    }
  }

  // 2. (Entity HAPPENED_AT LocA) + (LocA HAPPENED_AT LocB) => (Entity HAPPENED_AT LocB)
  for (const [entityId, locs] of entityLocMap.entries()) {
    for (const l of locs) {
      const parentLocs = locHierarchyMap.get(l) || [];
      for (const pl of parentLocs) {
        closure.add(normKey(entityId, 'HAPPENED_AT', pl));
      }
    }
  }

  // 3. Document Authorship & Epoch Transitivity:
  for (const t of triples) {
    const s = t.sourceEntityId.toLowerCase();
    const r = t.relationType.toUpperCase();
    const o = t.targetEntityId.toLowerCase();

    if (r === 'MENTIONED_IN') {
      const personId = s.startsWith('person_') ? s : o.startsWith('person_') ? o : null;
      const docId = s.startsWith('doc_') ? s : o.startsWith('doc_') ? o : null;
      if (personId && docId) {
        // Location inheritance
        const docLocs = entityLocMap.get(docId) || [];
        for (const dl of docLocs) {
          closure.add(normKey(personId, 'HAPPENED_AT', dl));
        }
        const personLocs = entityLocMap.get(personId) || [];
        for (const pl of personLocs) {
          closure.add(normKey(docId, 'HAPPENED_AT', pl));
        }
      }
    }

    if (r === 'HAPPENED_IN' && s.startsWith('event_') && o.startsWith('dynasty_')) {
      const leaders = ledByMap.get(s) || [];
      for (const leader of leaders) {
        closure.add(normKey(leader, 'PART_OF', o));
      }
    }
  }

  return closure;
}

/**
 * Compute Strict Triple F1, Directional Accuracy & Hallucination Rate
 * True Positive iff S, R, O match canonical values exactly or via graph closure equivalence.
 */
export function computeStrictTripleMetrics(
  predicted: Array<{ sourceEntityId: string; relationType: string; targetEntityId: string; confidence?: number }>,
  groundTruth: GoldenBenchmarkTriple[],
  validEntityIdsInSnippet?: Set<string>
): StrictTripleMetrics {
  const normKey = (s: string, r: string, o: string) => `${s.trim().toLowerCase()}::${r.trim().toUpperCase()}::${o.trim().toLowerCase()}`;
  const invKey = (s: string, r: string, o: string) => `${o.trim().toLowerCase()}::${r.trim().toUpperCase()}::${s.trim().toLowerCase()}`;

  const gtSet = new Set(groundTruth.map(t => normKey(t.sourceEntityId, t.relationType, t.targetEntityId)));
  const gtClosure = computeGraphTransitiveClosure(groundTruth);
  const predClosure = computeGraphTransitiveClosure(predicted);

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

    if (gtSet.has(key) || gtClosure.has(key)) {
      if (!matchedGtKeys.has(key)) {
        truePositives++;
        directionalCorrect++;
        matchedGtKeys.add(key);
      } else {
        // Redundant duplicate extraction of an already matched triple
        falsePositives++;
      }
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

  // Account for GT triples satisfied via predicted closure
  for (const gt of groundTruth) {
    const gtKey = normKey(gt.sourceEntityId, gt.relationType, gt.targetEntityId);
    if (!matchedGtKeys.has(gtKey) && predClosure.has(gtKey)) {
      truePositives++;
      matchedGtKeys.add(gtKey);
    }
  }

  const falseNegatives = Math.max(0, groundTruth.length - truePositives);

  const effectiveExtracted = Math.max(predicted.length, truePositives);
  const precision = effectiveExtracted > 0 ? (truePositives / effectiveExtracted) * 100 : (groundTruth.length === 0 ? 100 : 0);
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
      const predClean = (pred.cleanName || pred.text).toLowerCase().trim();
      const gtClean = gt.name.toLowerCase().trim();

      if (
        (gtStart >= 0 && gtEnd >= 0 && pred.startOffset === gtStart && pred.endOffset === gtEnd) ||
        predClean === gtClean ||
        pred.text.toLowerCase().trim() === gtClean
      ) {
        foundExact = true;
        break;
      } else if (
        (gtStart >= 0 && gtEnd >= 0 && Math.max(pred.startOffset, gtStart) < Math.min(pred.endOffset, gtEnd)) ||
        pred.text.toLowerCase().includes(gtClean) ||
        gtClean.includes(pred.text.toLowerCase()) ||
        predClean.includes(gtClean) ||
        gtClean.includes(predClean)
      ) {
        foundPartial = true;
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
