/**
 * Shared Module Interfaces & Data Contracts for ChronoViet Monorepo
 * Single Source of Truth for Inter-Module Communication
 */

import { ChronoVideoProps, LicenseType } from './schema.js';

// ============================================================================
// 1. Chrono-RAG Engine Interface (`packages/rag-engine`)
// ============================================================================

export interface RagSearchRequest {
  query: string;
  entityFilter?: string[];
  maxTokens?: number;
  rerankTopK?: number;
}

export interface HistoricalContextEntity {
  entityId: string;
  canonicalName: string;
  aliases: string[];
  summary: string;
  citations: string[];
  confidenceScore: number;
}

export interface RagSearchResponse {
  verifiedContext: HistoricalContextEntity[];
  aliasTable: Record<string, string[]>;
  citations: string[];
  retrievalLatencyMs: number;
}

export interface IRagEngine {
  search(request: RagSearchRequest): Promise<RagSearchResponse>;
  ingestDocument(content: string, metadata: { title: string; source: string }): Promise<void>;
}

// ============================================================================
// 2. VieNeu TTS Service Interface (`services/vieneu-tts`)
// ============================================================================

export interface TtsSynthesizeRequest {
  text: string;
  speakerId?: string;
  speed?: number;
  fps?: number;
}

export interface WordTimestampInfo {
  word: string;
  startMs: number;
  endMs: number;
  startFrame: number;
  endFrame: number;
}

export interface TtsSynthesizeResponse {
  audioUrl: string;
  durationMs: number;
  durationInFrames: number;
  wordTimestamps: WordTimestampInfo[];
}

export interface IVieNeuTtsService {
  synthesize(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResponse>;
}

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
  overallScore: number;
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
  status: 'INIT' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'ESCALATED';
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
  schema: ChronoVideoProps;
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
  videoUrl: string;
  renderDurationMs: number;
  fileSizeMb: number;
}

export interface IRenderWorker {
  submitRenderJob(payload: RenderJobPayload): Promise<{ jobId: string }>;
  getJobStatus(jobId: string): Promise<RenderJobProgress>;
}
