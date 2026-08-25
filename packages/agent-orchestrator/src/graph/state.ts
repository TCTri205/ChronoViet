import { Annotation } from '@langchain/langgraph';
import {
  ChapterPlan,
  ChronoVideoProps,
  HistoricalContextEntity,
  OrchestratorStatus,
  SceneGeneration,
  VisualCandidate,
  WordTimestamp,
} from '@chronoviet/shared-spec';
import {
  ChronoLogger,
  createLogger,
} from '@chronoviet/infra';

export type { OrchestratorStatus };

const baseLog = createLogger({ service: 'agent-orchestrator' });

/**
 * Creates a context-bound child logger with guaranteed correlationId and node fields
 */
export function getNodeLogger(state: ChronoGraphState, nodeName: string): ChronoLogger {
  const cid = state.correlationId || state.projectId;
  return baseLog.child({
    correlationId: cid,
    fields: { projectId: state.projectId, node: nodeName },
  });
}

export interface TelemetryAuditEntry {
  timestamp: string;
  node: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  category: 'FALLBACK' | 'RETRY' | 'RECONCILIATION' | 'GUARDRAIL';
  message: string;
  metadata?: Record<string, any>;
}

export interface RunningNarrativeState {
  previousChapterSummary: string;
  establishedTone: string;
  introducedEntities: string[];
  transitionHook: string;
}

export interface FactCheckAuditEntry {
  chapterIndex: number;
  passed: boolean;
  escalationTier: number; // 0: None/Self-Correction, 1: Auto-Fix, 2: Cloud Escalation, 3: Human Review
  detectedAliases: string[];
  correctedText?: string;
  details: string;
}

export interface AudioAssetEntry {
  sceneId: string;
  audioPath: string;
  durationSeconds: number;
  wordTimestamps: WordTimestamp[];
}

export interface ResearchProvenanceEntry {
  provider: string;
  count: number;
  latencyMs: number;
}

export interface ResearchSceneResult {
  sceneId: string;
  keywords: string;
  candidates: VisualCandidate[];
  provenance: ResearchProvenanceEntry[];
  resolvedAt: string;
}

const updateValue = <T>(prev: T, next: T | undefined): T => (next !== undefined ? next : prev);

function mergeResearchResults(
  prev: Record<string, ResearchSceneResult> = {},
  next?: Record<string, ResearchSceneResult>
): Record<string, ResearchSceneResult> {
  if (!next) return prev;
  return { ...prev, ...next };
}

function mergeScenes(prev: SceneGeneration[] = [], next?: SceneGeneration[]): SceneGeneration[] {
  if (!next || next.length === 0) return prev;
  if (prev.length === 0) return next;
  const sceneMap = new Map<string, SceneGeneration>();
  for (const sc of prev) {
    sceneMap.set(sc.sceneId, { ...sc });
  }
  for (const sc of next) {
    const existing = sceneMap.get(sc.sceneId);
    if (existing) {
      sceneMap.set(sc.sceneId, { ...existing, ...sc });
    } else {
      sceneMap.set(sc.sceneId, sc);
    }
  }
  return Array.from(sceneMap.values()).sort((a, b) => a.sceneIndex - b.sceneIndex);
}

function mergeAudioAssets(prev: AudioAssetEntry[] = [], next?: AudioAssetEntry[]): AudioAssetEntry[] {
  if (!next || next.length === 0) return prev;
  if (prev.length === 0) return next;
  const map = new Map<string, AudioAssetEntry>();
  for (const a of prev) map.set(a.sceneId, a);
  for (const a of next) map.set(a.sceneId, a);
  return Array.from(map.values());
}

function mergeChapterScripts(
  prev: Record<number, string> = {},
  next?: Record<number, string>
): Record<number, string> {
  if (!next) return prev;
  return { ...prev, ...next };
}

function mergeTelemetryAudits(
  prev: TelemetryAuditEntry[] = [],
  next?: TelemetryAuditEntry[]
): TelemetryAuditEntry[] {
  if (!next || next.length === 0) return prev;
  return [...prev, ...next];
}

export const ChronoGraphAnnotation = Annotation.Root({
  projectId: Annotation<string>({
    reducer: updateValue,
    default: () => '',
  }),
  customBaseDir: Annotation<string | undefined>({
    reducer: updateValue,
    default: () => undefined,
  }),
  correlationId: Annotation<string | undefined>({
    reducer: updateValue,
    default: () => undefined,
  }),
  userPrompt: Annotation<string>({
    reducer: updateValue,
    default: () => '',
  }),
  videoBriefId: Annotation<string | undefined>({
    reducer: updateValue,
    default: () => undefined,
  }),
  targetDurationMinutes: Annotation<number>({
    reducer: updateValue,
    default: () => 1,
  }),
  videoType: Annotation<'BIOGRAPHY' | 'BATTLE' | 'DYNASTY' | 'MYSTERY' | 'ARTIFACT'>({
    reducer: updateValue,
    default: () => 'BIOGRAPHY',
  }),
  templateId: Annotation<'HISTORICAL_DOCUMENTARY' | 'QUICK_SHORTS' | 'MODERN_NEWS'>({
    reducer: updateValue,
    default: () => 'HISTORICAL_DOCUMENTARY',
  }),
  status: Annotation<OrchestratorStatus>({
    reducer: updateValue,
    default: () => 'INIT',
  }),
  currentStep: Annotation<number>({
    reducer: updateValue,
    default: () => 1,
  }),
  ragContext: Annotation<{
    verifiedContext: HistoricalContextEntity[];
    aliasTable: Record<string, string[]>;
    citations: string[];
  } | undefined>({
    reducer: updateValue,
    default: () => undefined,
  }),
  chapters: Annotation<ChapterPlan[]>({
    reducer: updateValue,
    default: () => [],
  }),
  currentChapterIndex: Annotation<number>({
    reducer: updateValue,
    default: () => 0,
  }),
  runningNarrativeState: Annotation<RunningNarrativeState>({
    reducer: updateValue,
    default: () => ({
      previousChapterSummary: '',
      establishedTone: 'Hùng tráng',
      introducedEntities: [],
      transitionHook: '',
    }),
  }),
  chapterScripts: Annotation<Record<number, string>>({
    reducer: mergeChapterScripts,
    default: () => ({}),
  }),
  factCheckLogs: Annotation<FactCheckAuditEntry[]>({
    reducer: updateValue,
    default: () => [],
  }),
  scenes: Annotation<SceneGeneration[]>({
    reducer: mergeScenes,
    default: () => [],
  }),
  researchResults: Annotation<Record<string, ResearchSceneResult>>({
    reducer: mergeResearchResults,
    default: () => ({}),
  }),
  audioAssets: Annotation<AudioAssetEntry[]>({
    reducer: mergeAudioAssets,
    default: () => [],
  }),
  pacingErrorPercentage: Annotation<number | undefined>({
    reducer: updateValue,
    default: () => 0,
  }),
  videoProps: Annotation<ChronoVideoProps | undefined>({
    reducer: updateValue,
    default: () => undefined,
  }),
  errorLog: Annotation<string | undefined>({
    reducer: updateValue,
    default: () => undefined,
  }),
  needsHumanReview: Annotation<boolean>({
    reducer: updateValue,
    default: () => false,
  }),
  telemetryAudit: Annotation<TelemetryAuditEntry[]>({
    reducer: mergeTelemetryAudits,
    default: () => [],
  }),
});

export type ChronoGraphState = typeof ChronoGraphAnnotation.State;
export type ChronoGraphUpdate = typeof ChronoGraphAnnotation.Update;
