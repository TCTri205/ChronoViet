/**
 * BullMQ Worker: VLM Inspection Queue (`vlm-inspect-queue`)
 */

import { Worker, Job } from 'bullmq';
import { createLogger, SceneGeneration, VisualCandidate } from '@chronoviet/shared-spec';
import { inspectSceneVisuals, InspectSceneResult } from '@chronoviet/vlm-inspector';
import { getBullMqRedis, QUEUE_NAMES } from '../queues/queue-manager.js';

const log = createLogger({ service: 'render-worker' });

export interface VLMJobData {
  projectId: string;
  scene: SceneGeneration;
  candidatePool: VisualCandidate[];
}

export async function processVLMJob(job: Job<VLMJobData>): Promise<InspectSceneResult> {
  const { projectId, scene, candidatePool } = job.data;
  log.info('worker.vlm_processing', `Processing VLM job ${job.id} for scene ${scene.sceneId}`, {
    projectId,
    sceneId: scene.sceneId,
  });

  const result = await inspectSceneVisuals(projectId, scene, candidatePool);
  await job.updateProgress(100);
  return result;
}

export function startVLMWorker(): Worker<VLMJobData, InspectSceneResult> {
  const connection = getBullMqRedis();
  const worker = new Worker<VLMJobData, InspectSceneResult>(
    QUEUE_NAMES.VLM_INSPECT,
    async (job) => processVLMJob(job),
    {
      connection,
      concurrency: 2,
    }
  );

  worker.on('completed', (job) => {
    log.info('worker.vlm_completed', `VLM inspection job ${job.id} completed for scene ${job.data.scene.sceneId}`);
  });

  worker.on('failed', (job, err) => {
    log.error('worker.vlm_failed', `VLM job ${job?.id} failed: ${err.message}`, { error: err });
  });

  return worker;
}
