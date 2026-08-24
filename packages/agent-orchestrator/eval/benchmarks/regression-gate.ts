/**
 * Automated Regression Quality Gates for Multi-Agent Orchestrator
 * Evaluates A0-A5 & SYS KPIs against strict non-regression thresholds
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RegressionQualityGate } from '@chronoviet/shared-spec';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface OrchestratorQualityFloors {
  minIntentAccuracy: number; // 90%
  minBriefCompliance: number; // 95%
  minChronologicalScore: number; // 90%
  maxBudgetError: number; // 5%
  minToneAdherence: number; // 90%
  minAntiSycophancyRejection: number; // 95%
  minFolkloreAccuracy: number; // 95%
  minSceneGranularityCompliance: number; // 90%
  minLicenseCompliance: number; // 100%
  minReconciliationRate: number; // 95%
  minCheckpointFidelity: number; // 95%
}

export const DEFAULT_ORCHESTRATOR_FLOORS: OrchestratorQualityFloors = {
  minIntentAccuracy: 88.0,
  minBriefCompliance: 92.0,
  minChronologicalScore: 85.0,
  maxBudgetError: 5.0,
  minToneAdherence: 85.0,
  minAntiSycophancyRejection: 90.0,
  minFolkloreAccuracy: 90.0,
  minSceneGranularityCompliance: 90.0,
  minLicenseCompliance: 100.0,
  minReconciliationRate: 92.0,
  minCheckpointFidelity: 95.0,
};

export function evaluateOrchestratorQualityGates(
  reports: Record<string, any>,
  floors: OrchestratorQualityFloors = DEFAULT_ORCHESTRATOR_FLOORS
): {
  allPassed: boolean;
  gates: RegressionQualityGate[];
} {
  const gates: RegressionQualityGate[] = [];

  // Gate A0: Intent Accuracy
  const a0 = reports['TIER_A0_CHAT_BRIEF_COMPILATION']?.metrics;
  if (a0?.intent_accuracy !== undefined) {
    const passed = a0.intent_accuracy >= floors.minIntentAccuracy;
    gates.push({
      gate_id: 'GATE_A0_INTENT_ACCURACY',
      metric_name: 'Intent Classification Accuracy',
      baseline_value: floors.minIntentAccuracy,
      current_value: a0.intent_accuracy,
      delta: Number((a0.intent_accuracy - floors.minIntentAccuracy).toFixed(2)),
      threshold: floors.minIntentAccuracy,
      passed,
      is_blocking: true,
      message: passed
        ? `PASS: Intent Accuracy ${a0.intent_accuracy}% >= ${floors.minIntentAccuracy}%`
        : `FAIL: Intent Accuracy ${a0.intent_accuracy}% < ${floors.minIntentAccuracy}%`,
    });
  }

  // Gate A1: Chronological Flow Score
  const a1 = reports['TIER_A1_CHAPTERING_BUDGETING']?.metrics;
  if (a1?.chronological_flow_score !== undefined) {
    const passed = a1.chronological_flow_score >= floors.minChronologicalScore;
    gates.push({
      gate_id: 'GATE_A1_CHRONOLOGICAL_FLOW',
      metric_name: 'Chronological Flow Score',
      baseline_value: floors.minChronologicalScore,
      current_value: a1.chronological_flow_score,
      delta: Number((a1.chronological_flow_score - floors.minChronologicalScore).toFixed(2)),
      threshold: floors.minChronologicalScore,
      passed,
      is_blocking: true,
      message: passed
        ? `PASS: Chronological Flow Score ${a1.chronological_flow_score}% >= ${floors.minChronologicalScore}%`
        : `FAIL: Chronological Flow Score ${a1.chronological_flow_score}% < ${floors.minChronologicalScore}%`,
    });
  }

  // Gate A2: Scriptwriting Tone Adherence
  const a2 = reports['TIER_A2_SCRIPTWRITING_TONE']?.metrics;
  if (a2?.tone_adherence_rate !== undefined) {
    const passed = a2.tone_adherence_rate >= floors.minToneAdherence;
    gates.push({
      gate_id: 'GATE_A2_TONE_ADHERENCE',
      metric_name: 'Historical Tone Adherence Rate',
      baseline_value: floors.minToneAdherence,
      current_value: a2.tone_adherence_rate,
      delta: Number((a2.tone_adherence_rate - floors.minToneAdherence).toFixed(2)),
      threshold: floors.minToneAdherence,
      passed,
      is_blocking: true,
      message: passed
        ? `PASS: Tone Adherence Rate ${a2.tone_adherence_rate}% >= ${floors.minToneAdherence}%`
        : `FAIL: Tone Adherence Rate ${a2.tone_adherence_rate}% < ${floors.minToneAdherence}%`,
    });
  }

  // Gate A3: Anti-Sycophancy Rejection Rate
  const a3 = reports['TIER_A3_GUARDRAILS_AUDITOR']?.metrics;
  if (a3?.anti_sycophancy_rejection_rate !== undefined) {
    const passed = a3.anti_sycophancy_rejection_rate >= floors.minAntiSycophancyRejection;
    gates.push({
      gate_id: 'GATE_A3_ANTI_SYCOPHANCY',
      metric_name: 'Anti-Sycophancy Rejection Rate',
      baseline_value: floors.minAntiSycophancyRejection,
      current_value: a3.anti_sycophancy_rejection_rate,
      delta: Number((a3.anti_sycophancy_rejection_rate - floors.minAntiSycophancyRejection).toFixed(2)),
      threshold: floors.minAntiSycophancyRejection,
      passed,
      is_blocking: true,
      message: passed
        ? `PASS: Anti-Sycophancy Rejection Rate ${a3.anti_sycophancy_rejection_rate}% >= ${floors.minAntiSycophancyRejection}%`
        : `FAIL: Anti-Sycophancy Rejection Rate ${a3.anti_sycophancy_rejection_rate}% < ${floors.minAntiSycophancyRejection}%`,
    });
  }

  // Gate A4: Scene Granularity Compliance
  const a4 = reports['TIER_A4_SCENE_DIRECTION']?.metrics;
  if (a4?.avg_granularity_compliance_rate !== undefined) {
    const passed = a4.avg_granularity_compliance_rate >= floors.minSceneGranularityCompliance;
    gates.push({
      gate_id: 'GATE_A4_SCENE_GRANULARITY',
      metric_name: 'Scene Duration Granularity Compliance',
      baseline_value: floors.minSceneGranularityCompliance,
      current_value: a4.avg_granularity_compliance_rate,
      delta: Number((a4.avg_granularity_compliance_rate - floors.minSceneGranularityCompliance).toFixed(2)),
      threshold: floors.minSceneGranularityCompliance,
      passed,
      is_blocking: true,
      message: passed
        ? `PASS: Scene Granularity Compliance ${a4.avg_granularity_compliance_rate}% >= ${floors.minSceneGranularityCompliance}%`
        : `FAIL: Scene Granularity Compliance ${a4.avg_granularity_compliance_rate}% < ${floors.minSceneGranularityCompliance}%`,
    });
  }

  // Gate A5: License Whitelist Compliance
  const a5 = reports['TIER_A5_RESEARCH_AGENT']?.metrics;
  if (a5?.license_compliance_rate !== undefined) {
    const passed = a5.license_compliance_rate >= floors.minLicenseCompliance;
    gates.push({
      gate_id: 'GATE_A5_LICENSE_WHITELIST',
      metric_name: 'License Whitelist Compliance',
      baseline_value: floors.minLicenseCompliance,
      current_value: a5.license_compliance_rate,
      delta: Number((a5.license_compliance_rate - floors.minLicenseCompliance).toFixed(2)),
      threshold: floors.minLicenseCompliance,
      passed,
      is_blocking: true,
      message: passed
        ? `PASS: License Compliance ${a5.license_compliance_rate}% >= ${floors.minLicenseCompliance}%`
        : `FAIL: License Compliance ${a5.license_compliance_rate}% < ${floors.minLicenseCompliance}%`,
    });
  }

  // Gate SYS: Duration Reconciliation & Checkpoint Fidelity
  const sys = reports['TIER_SYS_ORCHESTRATION_ABLATION']?.metrics;
  if (sys?.reconciliation_pass_rate !== undefined) {
    const passed = sys.reconciliation_pass_rate >= floors.minReconciliationRate;
    gates.push({
      gate_id: 'GATE_SYS_RECONCILIATION',
      metric_name: 'Synthetic Duration Reconciliation Rate',
      baseline_value: floors.minReconciliationRate,
      current_value: sys.reconciliation_pass_rate,
      delta: Number((sys.reconciliation_pass_rate - floors.minReconciliationRate).toFixed(2)),
      threshold: floors.minReconciliationRate,
      passed,
      is_blocking: true,
      message: passed
        ? `PASS: Duration Reconciliation ${sys.reconciliation_pass_rate}% >= ${floors.minReconciliationRate}%`
        : `FAIL: Duration Reconciliation ${sys.reconciliation_pass_rate}% < ${floors.minReconciliationRate}%`,
    });
  }

  const blockingGates = gates.filter((g) => g.is_blocking);
  const allPassed = blockingGates.length > 0 ? blockingGates.every((g) => g.passed) : true;

  const reportsDir = path.resolve(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(
    path.join(reportsDir, 'regression-diff-report.json'),
    JSON.stringify({ allPassed, gates }, null, 2),
    'utf-8'
  );

  return { allPassed, gates };
}
