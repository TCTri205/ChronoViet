import { ChronoVideoProps } from '@chronoviet/shared-spec';

export type OrchestratorStatus =
  | 'DRAFT'
  | 'RAG_RETRIEVED'
  | 'OUTLINE_CHAPTERED'
  | 'CHAPTER_SCRIPT_GENERATED'
  | 'CHAPTER_FACT_CHECKED'
  | 'RECONCILED'
  | 'DURATION_MISMATCH'
  | 'ASSETS_AUDITED'
  | 'RENDERING'
  | 'NEEDS_HUMAN_REVIEW'
  | 'COMPLETED'
  | 'FAILED';

export interface RunningNarrativeState {
  previousChapterSummary: string;
  establishedTone: string;
  introducedEntities: string[];
  transitionHook: string;
}

export interface ChronoGraphState {
  projectId: string;
  userPrompt: string;
  status: OrchestratorStatus;
  narrativeState: RunningNarrativeState;
  videoProps?: Partial<ChronoVideoProps>;
  errorLog?: string;
}
