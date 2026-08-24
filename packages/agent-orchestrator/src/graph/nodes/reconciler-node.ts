/**
 * Micro-Step 1B-Reconcile: Duration Reconciliation Engine Node
 * Reconciles audio duration with target pacing, calculates exact frame counts and time-stretch (+-10%)
 */

import { SceneGeneration } from '@chronoviet/shared-spec';
import { orchestratorPacingErrorPercent } from '@chronoviet/infra';
import { ChronoGraphState, getNodeLogger } from '../state.js';

export async function durationReconciliationNode(state: ChronoGraphState): Promise<Partial<ChronoGraphState>> {
  const nodeLog = getNodeLogger(state, 'duration_reconciliation');
  nodeLog.info('orchestrator.reconciler_started', `Reconciling durations for ${state.scenes.length} scenes`, {
    projectId: state.projectId,
  });

  const targetTotalSec = state.targetDurationMinutes > 0 ? state.targetDurationMinutes * 60 : 60;
  let totalAudioSec = 0;
  let totalBaseSec = 0;

  for (const scene of state.scenes) {
    const audioSec = scene.audioDurationSeconds || 0;
    const baseSec = audioSec > 0 ? audioSec : (scene.targetDurationSeconds || 5);
    totalAudioSec += audioSec;
    totalBaseSec += baseSec;
  }

  // Calculate stretch ratio bounded within [0.90, 1.10] (spec: +-10% time-stretch)
  const effectiveBaseTotal = totalBaseSec > 0 ? totalBaseSec : targetTotalSec;
  const rawRatio = targetTotalSec / effectiveBaseTotal;
  const boundedRatio = Math.max(0.90, Math.min(1.10, rawRatio));

  const updatedScenes: SceneGeneration[] = [];
  let reconciledTotalSec = 0;

  for (let i = 0; i < state.scenes.length; i++) {
    const scene = state.scenes[i];
    const audioSec = scene.audioDurationSeconds || 0;
    const baseSec = audioSec > 0 ? audioSec : (scene.targetDurationSeconds || 5);
    const minRequiredSec = Math.max(3, Math.ceil(audioSec));

    // Calculate initial reconciled seconds
    let sceneSec = Math.max(minRequiredSec, Math.round(baseSec * boundedRatio * 10) / 10);
    reconciledTotalSec += sceneSec;

    updatedScenes.push({
      ...scene,
      targetDurationSeconds: sceneSec,
    });
  }

  // Fine-tune residual deviation across scenes to guarantee < 3% pacing error
  const remainingSec = targetTotalSec - reconciledTotalSec;
  if (Math.abs(remainingSec) >= 0.5 && updatedScenes.length > 0) {
    const totalWeights = updatedScenes.reduce((sum, s) => sum + s.targetDurationSeconds, 0);
    reconciledTotalSec = 0;

    for (let i = 0; i < updatedScenes.length; i++) {
      const scene = updatedScenes[i];
      const audioSec = scene.audioDurationSeconds || 0;
      const minRequiredSec = Math.max(3, Math.ceil(audioSec));
      const weight = totalWeights > 0 ? scene.targetDurationSeconds / totalWeights : 1 / updatedScenes.length;
      const adjusted = scene.targetDurationSeconds + remainingSec * weight;
      const finalSec = Math.max(minRequiredSec, Math.round(adjusted * 10) / 10);

      scene.targetDurationSeconds = finalSec;
      reconciledTotalSec += finalSec;
    }
  }

  // Last-mile integer/tenth-second rounding correction on last scene if needed
  const finalDelta = targetTotalSec - reconciledTotalSec;
  if (Math.abs(finalDelta) > 0.1 && updatedScenes.length > 0) {
    const lastScene = updatedScenes[updatedScenes.length - 1];
    const minRequiredSec = Math.max(3, Math.ceil(lastScene.audioDurationSeconds || 0));
    const correctedLastSec = Math.max(minRequiredSec, Math.round((lastScene.targetDurationSeconds + finalDelta) * 10) / 10);
    reconciledTotalSec += (correctedLastSec - lastScene.targetDurationSeconds);
    lastScene.targetDurationSeconds = correctedLastSec;
  }

  const finalPacingError = Math.abs(reconciledTotalSec - targetTotalSec) / Math.max(1, targetTotalSec);
  const pacingErrorPercentage = Math.round(finalPacingError * 1000) / 10; // e.g. 0.8%

  // Record Prometheus metric
  try {
    orchestratorPacingErrorPercent.observe(
      { template_id: state.templateId || 'HISTORICAL_DOCUMENTARY' },
      pacingErrorPercentage
    );
  } catch {}

  nodeLog.info('orchestrator.reconciliation_completed', `Reconciliation completed: error ${pacingErrorPercentage}%`, {
    targetTotalSec,
    totalAudioSec,
    reconciledTotalSec,
    pacingErrorPercentage,
  });

  return {
    status: 'DURATION_RECONCILED',
    currentStep: 8,
    scenes: updatedScenes,
    pacingErrorPercentage,
  };
}
