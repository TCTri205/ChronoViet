import { SseEvent } from '@chronoviet/shared-spec';

export interface StreamSubscriber {
  id: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
}

export interface ActivePipelineJob {
  projectId: string;
  subscribers: Map<string, StreamSubscriber>;
  lastEvent?: SseEvent;
  isFinished: boolean;
}

const activePipelineRegistry = new Map<string, ActivePipelineJob>();

export function getActivePipelineJob(projectId: string): ActivePipelineJob | undefined {
  return activePipelineRegistry.get(projectId);
}

export function setActivePipelineJob(projectId: string, job: ActivePipelineJob): void {
  activePipelineRegistry.set(projectId, job);
}

export function deleteActivePipelineJob(projectId: string): void {
  activePipelineRegistry.delete(projectId);
}

export function abortActivePipelineJob(projectId: string): void {
  const job = activePipelineRegistry.get(projectId);
  if (!job) return;
  const abortEvent: SseEvent = {
    nodeName: 'abort',
    update: { status: 'ABORTED' },
    state: 'ABORTED',
    status: 'FAILED',
    projectId,
    timestamp: new Date().toISOString(),
  };
  job.lastEvent = abortEvent;
  job.isFinished = true;
  const encoder = new TextEncoder();
  const chunk = encoder.encode(`data: ${JSON.stringify(abortEvent)}\n\n`);
  for (const sub of Array.from(job.subscribers.values())) {
    try {
      sub.controller.enqueue(chunk);
      sub.controller.close();
    } catch {}
  }
  job.subscribers.clear();
  activePipelineRegistry.delete(projectId);
}

export function resetActivePipelineRegistryForTest(): void {
  activePipelineRegistry.clear();
}
