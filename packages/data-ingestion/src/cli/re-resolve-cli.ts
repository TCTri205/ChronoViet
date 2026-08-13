/**
 * CLI Command: Re-resolve Entities & Graph Edges with Audit Trail
 * Usage: pnpm --filter @chronoviet/data-ingestion rag:re-resolve
 */

import { initSchema, query, inMemoryStore, isPgAvailable, logEntityAuditAction } from '@chronoviet/shared-spec';
import { resolveCanonicalEntity } from '../text/historical-entity-mapper.js';

export async function runReResolve(): Promise<{ resolvedEntitiesCount: number; auditLogsCount: number }> {
  console.log('🔄 Starting Chrono-RAG Knowledge Graph Re-Resolution Pipeline...');
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

  console.log('======================================================');
  console.log('🎉 Graph Re-Resolution Completed!');
  console.log(`🏷️ Entities Evaluated: ${resolvedEntitiesCount}`);
  console.log(`📝 Audit Logs Created:  ${auditLogsCount}`);
  console.log('======================================================\n');

  return { resolvedEntitiesCount, auditLogsCount };
}

if (process.argv[1] && (process.argv[1].endsWith('re-resolve-cli.ts') || process.argv[1].endsWith('re-resolve-cli.js'))) {
  runReResolve()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Re-resolve Pipeline Error:', err);
      process.exit(1);
    });
}
