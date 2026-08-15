import { createLogger } from '@chronoviet/shared-spec';
import { startTTSWorker } from './workers/tts-worker.js';
import { startVLMWorker } from './workers/vlm-worker.js';
import { startRenderWorker } from './workers/render-worker.js';

export * from './queues/queue-manager.js';
export * from './workers/tts-worker.js';
export * from './workers/vlm-worker.js';
export * from './workers/render-worker.js';

const log = createLogger({ service: 'render-worker' });

export function initializeAllWorkers() {
  log.info('render_worker.starting', 'Initializing BullMQ workers for ChronoViet (TTS, VLM, Remotion Render)');
  const ttsWorker = startTTSWorker();
  const vlmWorker = startVLMWorker();
  const renderWorker = startRenderWorker();

  return { ttsWorker, vlmWorker, renderWorker };
}

// Auto-start if run directly
if (process.argv[1]?.endsWith('dist/index.js') || process.argv[1]?.endsWith('src/index.ts')) {
  initializeAllWorkers();
}
