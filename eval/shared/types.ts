/**
 * ChronoViet Evaluation Suite — Shared Types & Interfaces
 */

import { PreflightResult } from '@chronoviet/infra';

export type EvalSuiteType = 'CHATBOT' | 'VIDEO_GEN' | 'ALL';

export interface EvalRunMetadata {
  suite: EvalSuiteType;
  startTime: string;
  endTime: string;
  durationMs: number;
  strict: boolean;
  preflight: PreflightResult;
  version?: string;
}

export interface MetricScore {
  name: string;
  value: number;
  target: number;
  pass: boolean;
  unit?: string;
  description?: string;
  details?: Record<string, any>;
}

export interface LatencyProfile {
  count: number;
  p50: number;
  p90: number;
  p99: number;
  mean: number;
  min: number;
  max: number;
}

export interface BaseTestCaseResult {
  id: string;
  title: string;
  passed: boolean;
  durationMs: number;
  errors?: string[];
  warnings?: string[];
}

export interface BaseSuiteReport<TCaseResult extends BaseTestCaseResult = BaseTestCaseResult> {
  title: string;
  suite: EvalSuiteType;
  timestamp: string;
  totalCases: number;
  datasetTotalCases?: number;
  isSubset?: boolean;
  appliedFilters?: Record<string, any>;
  passedCases: number;
  failedCases: number;
  passRate: number;
  allPassed: boolean;
  metrics: Record<string, MetricScore>;
  caseResults: TCaseResult[];
  metadata: EvalRunMetadata;
  outputArtifactsDir: string;
  reportFilePath?: string;
}
