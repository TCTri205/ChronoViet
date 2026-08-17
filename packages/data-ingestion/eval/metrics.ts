/**
 * Chrono-RAG Module 0 (Data Preprocessing & Ingestion Engine) Evaluation Metrics
 * Evaluates ETL quality across:
 * 1. Entity Normalization & Disambiguation Accuracy (> 98.0%)
 * 2. Copyright License Compliance Audit Rate (100%)
 * 3. Golden Dataset Integrity & Schema Compliance (100%)
 * 4. Hierarchical Parent/Child Chunk Structural Quality (100%)
 */

import {
  CHUNK_PARENT_MIN_WORDS,
  CHUNK_PARENT_MAX_WORDS,
  CHUNK_CHILD_MIN_WORDS,
  CHUNK_CHILD_MAX_WORDS,
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
    // Parent chunk bound
    validTokenBounds = tokenCount >= CHUNK_PARENT_MIN_WORDS && tokenCount <= CHUNK_PARENT_MAX_WORDS;
    if (!validTokenBounds) {
      errors.push(`Parent chunk token count ${tokenCount} outside bounds [${CHUNK_PARENT_MIN_WORDS}, ${CHUNK_PARENT_MAX_WORDS}]`);
    }
  } else {
    // Child chunk bound
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

