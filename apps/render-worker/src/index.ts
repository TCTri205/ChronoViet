import { createLogger } from '@chronoviet/shared-spec';

const log = createLogger({ service: 'render-worker' });

log.info('render_worker.started', 'ChronoViet Render & AI Worker initialized (Listening on BullMQ queues)');
