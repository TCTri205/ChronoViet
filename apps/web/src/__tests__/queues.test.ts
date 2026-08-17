import { describe, it, expect } from 'vitest';
import { enqueueRenderJob, REMOTION_RENDER_QUEUE_NAME, getRenderQueue } from '../lib/queues';

describe('BullMQ Producer (apps/web)', () => {
  it('defines correct queue name constant', () => {
    expect(REMOTION_RENDER_QUEUE_NAME).toBe('remotion-render-queue');
  });

  it('initializes render queue properly', () => {
    const queue = getRenderQueue();
    expect(queue).toBeDefined();
    expect(queue.name).toBe('remotion-render-queue');
  });
});
