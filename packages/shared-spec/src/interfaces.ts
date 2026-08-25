/**
 * Shared Module Interfaces & Data Contracts for ChronoViet Monorepo
 * Single Source of Truth for Inter-Module Communication
 */

import {
  ChronoVideoProps,
  LicenseType,
  RagSearchRequest,
  RagSearchRequestInput,
  HistoricalContextEntity,
  RagSearchResponse,
  SourceReliability,
  HistoricalEpoch,
  StructuredAlias,
  EntityAuditLog,
  AuditActionType,
  AliasType,
  MediaAssetRegistryEntry,
  getCanonicalEntityIdPrefix,
  OrchestratorStatus,
  CandidateEntitySpan,
  HistoricalRelationType,
  GoldenBenchmarkEntity,
  GoldenBenchmarkTriple,
  GoldenTripleBenchmarkItem,
  GoldenTripleBenchmark,
  Conversation,
  ConversationMessage,
  VideoBrief,
  GraphTripleItem,
  HistoricalCitationItem,
  GroundedClaimItem,
  HistoricalAnswerGenerationRequest,
  HistoricalAnswerResponse,
} from './schema.js';

export type {
  MediaAssetRegistryEntry,
  HistoricalEpoch,
  StructuredAlias,
  EntityAuditLog,
  AuditActionType,
  AliasType,
  CandidateEntitySpan,
  HistoricalRelationType,
  GoldenBenchmarkEntity,
  GoldenBenchmarkTriple,
  GoldenTripleBenchmarkItem,
  GoldenTripleBenchmark,
  Conversation,
  ConversationMessage,
  VideoBrief,
  GraphTripleItem,
  HistoricalCitationItem,
  GroundedClaimItem,
  HistoricalAnswerGenerationRequest,
  HistoricalAnswerResponse,
};
export { getCanonicalEntityIdPrefix };

// ============================================================================
// Hierarchical Chunking Bounds (SSOT)
// ============================================================================
export const CHUNK_PARENT_MIN_WORDS = 2000;
export const CHUNK_PARENT_MAX_WORDS = 3000;
export const CHUNK_CHILD_MIN_WORDS = 300;
export const CHUNK_CHILD_MAX_WORDS = 500;
export const CHUNK_CHILD_TARGET_WORDS = 400;
export const CHUNK_CHILD_OVERLAP_WORDS = 40;


// ============================================================================
// 1. Chrono-RAG Engine Interface (`packages/rag-engine`)
// ============================================================================

export interface IRagEngine {
  search(request: RagSearchRequestInput): Promise<RagSearchResponse>;
  generateAnswer?(request: HistoricalAnswerGenerationRequest): Promise<HistoricalAnswerResponse>;
  ingestDocument(content: string, metadata: { title: string; source: string }): Promise<void>;
}


// ============================================================================
// 2. VieNeu TTS Service Interface (`services/vieneu-tts`)
// ============================================================================
// NOTE: All VieNeu TTS types are now defined as Zod Schemas in schema.ts:
//   VieNeuTTSRequestSchema, VieNeuTTSResponseSchema, WordTimestampSchema, CaptionWordSchema
// The legacy interfaces (TtsSynthesizeRequest, IVieNeuTtsService, etc.) have been removed
// in favor of the Zod-validated types used across all modules.


// ============================================================================
// 3. VLM Inspector Sub-Agent Interface (`packages/vlm-inspector`)
// ============================================================================

export interface VlmInspectRequest {
  imageUrl: string;
  historicalContext: string;
  keywords: string[];
  candidateIndex?: number;
}

export interface VlmScoringResult {
  historicalContextScore: number;
  visualNoiseScore: number;
  artisticFitScore: number;
  overallScore?: number;
  totalScore?: number;
  passed?: boolean;
  reasons?: string[];
  focalPoint?: [number, number];
  scorerType?: 'GEMINI_CLOUD' | 'LOCAL_VLM' | 'OPENAI_VLM' | 'CLIP_LOCAL_FALLBACK' | 'REDIS_CACHE';
}

export interface LicenseCheckResult {
  isWhitelisted: boolean;
  licenseType: LicenseType;
  author?: string;
  sourceUrl?: string;
}

export interface VlmInspectResponse {
  verdict: 'PASS' | 'REJECT';
  score: VlmScoringResult;
  license: LicenseCheckResult;
  isPureCodeFallback: boolean;
  inspectionLatencyMs: number;
}

export interface IVlmInspector {
  inspect(request: VlmInspectRequest): Promise<VlmInspectResponse>;
}

// ============================================================================
// 4. Multi-Agent Orchestrator Interface (`packages/agent-orchestrator`)
// ============================================================================

export interface OrchestratorInput {
  topic: string;
  targetDurationMinutes: number;
  videoType: 'BIOGRAPHY' | 'BATTLE' | 'DYNASTY' | 'MYSTERY' | 'ARTIFACT';
  templateId: 'HISTORICAL_DOCUMENTARY' | 'QUICK_SHORTS' | 'MODERN_NEWS';
}

export interface AgentChapter {
  chapterIndex: number;
  title: string;
  targetDurationSeconds: number;
  narrativeContext: string;
}

export interface OrchestratorState {
  projectId: string;
  currentStep: number;
  status: OrchestratorStatus;
  chapters: AgentChapter[];
  runningNarrativeState: string;
  generatedSchema?: ChronoVideoProps;
  errorMessage?: string;
}

export interface IMultiAgentOrchestrator {
  createProject(input: OrchestratorInput): Promise<string>;
  getProjectState(projectId: string): Promise<OrchestratorState>;
  executeNextStep(projectId: string): Promise<OrchestratorState>;
}

// ============================================================================
// 5. Render Worker & Task Queue Interface (`apps/render-worker`)
// ============================================================================

export interface RenderJobPayload {
  projectId: string;
  correlationId?: string;
  schema?: ChronoVideoProps;
  outputFormat?: 'mp4';
  priority?: number;
}

export interface RenderJobProgress {
  projectId: string;
  currentFrame: number;
  totalFrames: number;
  percentage: number;
  status: 'DOWNLOADING_ASSETS' | 'RENDERING' | 'ENCODING' | 'COMPLETED' | 'FAILED';
}

export interface RenderJobResult {
  projectId: string;
  videoUrl?: string;
  outputPath?: string;
  renderDurationMs?: number;
  durationMs?: number;
  fileSizeMb?: number;
  fileSizeBytes?: number;
  peakMemoryMb?: number;
  totalFrames?: number;
}

export interface IRenderWorker {
  submitRenderJob(payload: RenderJobPayload): Promise<{ jobId: string }>;
  getJobStatus(jobId: string): Promise<RenderJobProgress>;
}

export interface StageDurationBreakdown {
  chunkingMs: number;
  extractionMs: number;
  embeddingMs: number;
  dbInsertMs: number;
  totalDurationMs: number;
}

export interface IngestionExecutionTelemetry {
  correlationId: string;
  durations: StageDurationBreakdown;
  throughput: {
    chunksPerSec: number;
    wordsPerSec: number;
    vectorsPerSec: number;
  };
  cacheStats: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  quarantineStats: {
    totalQuarantined: number;
    reasons: Record<string, number>;
  };
}

export interface IngestionOptions {
  force?: boolean;
  useLocalLlm?: boolean;
  batchSize?: number;
  correlationId?: string;
}

export interface IngestionResult {
  documentsProcessed: number;
  chunksCreated: number;
  entitiesExtracted: number;
  relationshipsExtracted: number;
  durationMs: number;
  correlationId?: string;
  telemetry?: IngestionExecutionTelemetry;
}

export interface IIngestionPipeline {
  run(inputPath: string, options?: IngestionOptions): Promise<IngestionResult>;
}

export interface HistoricalLocationMapping {
  historicalName: string;
  canonicalModernName: string;
  dynasty?: string;
  timeRange?: { start?: number; end?: number };
}

export interface EntityAliasMapping {
  alias: string;
  canonicalId: string;
  canonicalName: string;
}

export interface ChunkMetadataEnrichment {
  dynasty?: string;
  time_start?: number;
  time_end?: number;
  key_figures?: string[];
  location?: string;
  source_name?: string;
  source_reliability?: SourceReliability;
  page_number?: number;
}

export interface CorpusCrawlOptions {
  topics?: string[];
  urls?: string[];
  outputPath?: string;
  minWordCount?: number;
  dynasty?: string;
}

export interface CorpusCrawlItemResult {
  title: string;
  sourceUrl: string;
  savedPath: string;
  wordCount: number;
  status: 'SUCCESS' | 'SKIPPED' | 'FAILED';
  error?: string;
}

export interface CorpusCrawlResult {
  totalAttempted: number;
  totalSaved: number;
  items: CorpusCrawlItemResult[];
  durationMs: number;
}

export interface ICorpusCrawler {
  crawl(options: CorpusCrawlOptions): Promise<CorpusCrawlResult>;
}



