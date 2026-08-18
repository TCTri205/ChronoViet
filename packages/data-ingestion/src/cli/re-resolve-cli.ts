/**
 * CLI Command: Re-resolve Entities & Graph Edges with Audit Trail
 * Usage: pnpm --filter @chronoviet/data-ingestion rag:re-resolve
 */

import {
  createLogger,
  initSchema,
  query,
  inMemoryStore,
  isPgAvailable,
  logEntityAuditAction,
  resolveCanonicalEntity,
} from '@chronoviet/shared-spec';

const log = createLogger({ service: 'data-ingestion' });

export async function runReResolve(): Promise<{ resolvedEntitiesCount: number; auditLogsCount: number }> {
  log.info('reresolve.started', 'Starting Chrono-RAG Knowledge Graph Re-Resolution Pipeline');
  await initSchema();

  const pgConnected = await isPgAvailable();
  let resolvedEntitiesCount = 0;
  let auditLogsCount = 0;

  if (pgConnected) {
    const dbEntities = await query<{ id: string; name: string; type: string; aliases: string[] }>(
      'SELECT id, name, type, aliases FROM entities'
    );

    for (const entity of dbEntities) {
      const canonical = resolveCanonicalEntity(entity.name);
      if (canonical.entityId !== entity.id || canonical.canonicalName !== entity.name) {
        // Log Audit Event
        await logEntityAuditAction({
          entity_id: entity.id,
          action_type: 'MERGE_ENTITY',
          modified_by: 'CLI_RE_RESOLVE',
          previous_state: { id: entity.id, name: entity.name, aliases: entity.aliases },
          new_state: { canonicalId: canonical.entityId, canonicalName: canonical.canonicalName, aliases: canonical.aliases },
          rationale: `Re-resolved entity '${entity.name}' to canonical ID '${canonical.entityId}'`,
        });
        auditLogsCount++;
      }
      resolvedEntitiesCount++;
    }
  } else {
    for (const [id, entity] of inMemoryStore.entities.entries()) {
      const canonical = resolveCanonicalEntity(entity.name);
      if (canonical.entityId !== id || canonical.canonicalName !== entity.name) {
        await logEntityAuditAction({
          entity_id: id,
          action_type: 'MERGE_ENTITY',
          modified_by: 'CLI_RE_RESOLVE',
          previous_state: { id: entity.id, name: entity.name, aliases: entity.aliases },
          new_state: { canonicalId: canonical.entityId, canonicalName: canonical.canonicalName, aliases: canonical.aliases },
          rationale: `In-memory re-resolved entity '${entity.name}' to canonical ID '${canonical.entityId}'`,
        });
        auditLogsCount++;
      }
      resolvedEntitiesCount++;
    }
  }

  log.info('reresolve.completed', 'Graph Re-Resolution completed', {
    entitiesEvaluated: resolvedEntitiesCount,
    auditLogsCreated: auditLogsCount,
  });

  return { resolvedEntitiesCount, auditLogsCount };
}

if (process.argv[1] && (process.argv[1].endsWith('re-resolve-cli.ts') || process.argv[1].endsWith('re-resolve-cli.js'))) {
  runReResolve()
    .then(() => process.exit(0))
    .catch((err) => {
      log.error('reresolve.failed', 'Re-resolve Pipeline Error', { error: err });
      process.exit(1);
    });
}
