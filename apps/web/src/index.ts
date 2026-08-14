import { createLogger } from '@chronoviet/shared-spec';

const log = createLogger({ service: 'web' });

log.info('web.started', 'ChronoViet Monolith Web App & API Server initialized');
