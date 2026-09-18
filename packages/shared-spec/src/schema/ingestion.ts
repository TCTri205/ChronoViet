/**
 * Data Ingestion, Corpus Chunks & Benchmark Evaluation Schemas
 */
import { z } from 'zod';
import {
  EntityTypeEnum,
  StructuredAliasSchema,
  HistoricalRelationTypeEnum,
} from './entities.js';

// ==========================================
export const SourceReliabilityEnum = z.enum(['LEVEL_1', 'LEVEL_2', 'LEVEL_3']);

export const HistoricalEpochEnum = z.enum([
  'EPOCH_01', // Hùng Vương - Văn Lang & Âu Lạc (-179 TCN)
  'EPOCH_02', // Bắc Thuộc & Các Cuộc Khởi Nghĩa (179 TCN - 938)
  'EPOCH_03', // Ngô - Đinh - Tiền Lê (938 - 1009)
  'EPOCH_04', // Nhà Lý (1009 - 1225)
  'EPOCH_05', // Nhà Trần (1225 - 1400)
  'EPOCH_06', // Nhà Hồ & Canh Tân (1400 - 1407)
  'EPOCH_07', // Bắc Thuộc Lần 4 & Lam Sơn (1407 - 1427)
  'EPOCH_08', // Nhà Lê Sơ (1428 - 1527)
  'EPOCH_09', // Nam - Bắc Triều & Trịnh - Nguyễn (1527 - 1777)
  'EPOCH_10', // Tây Sơn & Phong Trào Khởi Nghĩa (1771 - 1802)
  'EPOCH_11', // Nhà Nguyễn Độc Lập (1802 - 1858)
  'EPOCH_12', // Pháp Thuộc & Phong Trào Yêu Nước (1858 - 1945)
  'EPOCH_13', // Kháng Chiến Chống Pháp (1945 - 1954)
  'EPOCH_14', // Kháng Chiến Chống Mỹ & Thống Nhất (1954 - 1975)
  'EPOCH_15', // Bảo Vệ Tổ Quốc, Đổi Mới & Hiện Đại (1975 - Nay)
]);


export const TranslationVariantSchema = z.object({
  translator: z.string(),
  text: z.string(),
  notes: z.string().optional(),
});

export const ChunkMetadataSchema = z.object({
  chunk_id: z.string(),
  parent_chunk_id: z.string().optional(),
  title: z.string().optional(),
  dynasty: z.string().optional(),
  epoch_ids: z.array(z.union([HistoricalEpochEnum, z.string()])).optional(),
  time_start: z.number().int().optional(),
  time_end: z.number().int().optional(),
  key_figures: z.array(z.string()).default([]),
  location: z.string().optional(),
  source_name: z.string().optional(),
  source_reliability: SourceReliabilityEnum.optional(),
  license_status: z.enum(['PUBLIC_DOMAIN', 'CREATIVE_COMMONS', 'FAIR_USE_SUMMARY', 'UNKNOWN']).optional(),
  page_number: z.number().int().optional(),
  translation_variants: z.array(TranslationVariantSchema).optional(),
  original_text: z.string().optional(),
  original_language: z.string().optional(),
  translated_text: z.string().optional(),
  perspective_tag: z.string().optional(),
  has_modern_scholarly_override: z.boolean().optional(),
});

export const ExtractedEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.union([EntityTypeEnum, z.string()]),
  aliases: z.array(z.string()).default([]),
  structuredAliases: z.array(StructuredAliasSchema).optional(),
});

export const ExtractedRelationshipSchema = z.object({
  source: z.string(),
  target: z.string(),
  relation_type: z.string(),
  confidence: z.number().min(0).max(1).default(1.0),
  source_name: z.string().optional(),
});

export const TripleExtractionSchema = z.object({
  entities: z.array(ExtractedEntitySchema),
  relationships: z.array(ExtractedRelationshipSchema),
});


export const GoldenBenchmarkEntitySchema = z.object({
  id: z.string(),
  canonicalId: z.string().optional(),
  name: z.string(),
  type: z.union([EntityTypeEnum, z.string()]),
  aliases: z.array(z.string()).default([]),
  startOffset: z.number().int().nonnegative().optional(),
  endOffset: z.number().int().nonnegative().optional(),
});

export const GoldenBenchmarkTripleSchema = z.object({
  sourceEntityId: z.string(),
  relationType: z.union([HistoricalRelationTypeEnum, z.string()]),
  targetEntityId: z.string(),
  isDirectional: z.boolean().default(true),
  confidence: z.number().min(0).max(1).default(1.0),
});

export const GoldenTripleBenchmarkItemSchema = z.object({
  id: z.string(),
  epochId: z.union([HistoricalEpochEnum, z.string()]),
  epochIds: z.array(z.union([HistoricalEpochEnum, z.string()])).optional(),
  sourceText: z.string().min(1),
  groundTruthEntities: z.array(GoldenBenchmarkEntitySchema),
  groundTruthTriples: z.array(GoldenBenchmarkTripleSchema),
  groundTruthEpochs: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const GoldenTripleBenchmarkSchema = z.array(GoldenTripleBenchmarkItemSchema);

// ============================================================================
// 10. CHRONOEVAL v2.0 COMPONENT BENCHMARK SCHEMAS
// ============================================================================

export const GoldReasoningTripleSchema = z.object({
  subject: z.string(),
  relation: z.string(),
  object: z.string(),
  confidence: z.number().optional().default(1.0),
});

export const GroundTruthChunkSchema = z.object({
  chunk_id: z.string(),
  relevance_grade: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  source_reliability: SourceReliabilityEnum.optional().default('LEVEL_1'),
  key_evidence_claims: z.array(z.string()).optional().default([]),
  title: z.string().optional(),
  text_content: z.string().optional(),
});

export const ChronoevalDatasetItemSchema = z.object({
  query_id: z.string(),
  query: z.string(),
  epoch: z.string().optional(),
  domain: z.string().optional().default('GENERAL_HISTORY'),
  intent: z.string().optional().default('FACT_RETRIEVAL'),
  requires_multihop: z.boolean().default(false),
  temporal_bounds: z
    .object({
      time_start: z.number().optional(),
      time_end: z.number().optional(),
      dynasty: z.string().optional(),
    })
    .optional(),
  gold_reasoning_paths: z.array(z.array(GoldReasoningTripleSchema)).optional().default([]),
  ground_truth_chunks: z.array(GroundTruthChunkSchema).default([]),
  unanswerable_or_false_premise: z.boolean().default(false),
  expected_aliases: z.array(z.string()).optional().default([]),
  canonical_entity_id: z.string().optional(),
  adversarial_trap_type: z.string().optional(),
  parent_query_id: z.string().optional(),
});

export const ClaimVerificationSchema = z.object({
  claim_id: z.string(),
  claim_text: z.string(),
  supporting_chunk_ids: z.array(z.string()).default([]),
  entailment_status: z.enum(['ENTAILED', 'CONTRADICTED', 'NEUTRAL', 'NOT_SUPPORTED']),
  citation_valid: z.boolean().default(false),
  confidence_score: z.number().min(0).max(1).default(1.0),
});

export const AblationConfigSchema = z.object({
  config_id: z.enum(['CONFIG_A', 'CONFIG_B', 'CONFIG_C', 'CONFIG_D', 'CONFIG_E', 'CONFIG_F']),
  name: z.string(),
  dense_enabled: z.boolean(),
  lexical_enabled: z.boolean(),
  graph_enabled: z.boolean(),
  reranker_enabled: z.boolean(),
  context_assembly_enabled: z.boolean(),
});

export const ComponentBenchmarkReportSchema = z.object({
  benchmark_id: z.string(),
  name: z.string(),
  timestamp: z.string(),
  total_evaluated: z.number().int().min(0),
  metrics: z.record(z.string(), z.union([z.number(), z.boolean(), z.string()])),
  kpis_passed: z.boolean(),
  latency_summary: z
    .object({
      p50_ms: z.number(),
      p90_ms: z.number(),
      p95_ms: z.number(),
      p99_ms: z.number(),
      avg_ms: z.number(),
      ttft_p50_ms: z.number().optional(),
      ttft_p95_ms: z.number().optional(),
      avg_tokens_per_sec: z.number().optional(),
    })
    .optional(),
  details: z.array(z.any()).default([]),
});

export const RegressionQualityGateSchema = z.object({
  gate_id: z.string(),
  metric_name: z.string(),
  baseline_value: z.number(),
  current_value: z.number(),
  delta: z.number(),
  threshold: z.number(),
  passed: z.boolean(),
  is_blocking: z.boolean().default(true),
  message: z.string(),
});

export type SourceReliability = z.infer<typeof SourceReliabilityEnum>;
export type HistoricalEpoch = z.infer<typeof HistoricalEpochEnum>;
export type ChunkMetadata = z.infer<typeof ChunkMetadataSchema>;
export type ExtractedEntity = z.infer<typeof ExtractedEntitySchema>;
export type ExtractedRelationship = z.infer<typeof ExtractedRelationshipSchema>;
export type TripleExtraction = z.infer<typeof TripleExtractionSchema>;
export type GoldenBenchmarkEntity = z.infer<typeof GoldenBenchmarkEntitySchema>;
export type GoldenBenchmarkTriple = z.infer<typeof GoldenBenchmarkTripleSchema>;
export type GoldenTripleBenchmarkItem = z.infer<typeof GoldenTripleBenchmarkItemSchema>;
export type GoldenTripleBenchmark = z.infer<typeof GoldenTripleBenchmarkSchema>;
export type GoldReasoningTriple = z.infer<typeof GoldReasoningTripleSchema>;
export type GroundTruthChunk = z.infer<typeof GroundTruthChunkSchema>;
export type ChronoevalDatasetItem = z.infer<typeof ChronoevalDatasetItemSchema>;
export type ClaimVerification = z.infer<typeof ClaimVerificationSchema>;
export type AblationConfig = z.infer<typeof AblationConfigSchema>;
export type ComponentBenchmarkReport = z.infer<typeof ComponentBenchmarkReportSchema>;
export type RegressionQualityGate = z.infer<typeof RegressionQualityGateSchema>;
