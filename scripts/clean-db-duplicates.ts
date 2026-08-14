import { query, isPgAvailable, logEntityAuditAction, createLogger } from '../packages/shared-spec/src/index.js';

const log = createLogger({ service: 'ops', correlationId: 'db-cleanup' });

async function main() {
  log.info('ops.db_cleanup_started', 'Starting DB Data Sanitization & Audit Log Verification');

  const available = await isPgAvailable();
  if (!available) {
    log.warn('ops.db_unavailable', 'PostgreSQL is not connected or running. Skipping DB cleanup.');
    return;
  }

  // 1. Check & Delete Self-Loop Relationships
  const selfLoops = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM relationships WHERE source_entity_id = target_entity_id;`
  );
  console.log(`[+] Self-loop relationships found before cleanup: ${selfLoops[0].count}`);

  await query(
    `DELETE FROM relationships WHERE source_entity_id = target_entity_id;`
  );
  console.log(`[+] Deleted self-loop relationships.`);
  log.info('ops.self_loops_removed', 'Deleted self-loop relationships', { removed: parseInt(selfLoops[0].count, 10) });

  // 2. Check & Delete Duplicate Relationships
  const totalRelsBefore = await query<{ count: string }>(`SELECT COUNT(*) as count FROM relationships;`);
  const distinctRelsBefore = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM (SELECT DISTINCT source_entity_id, target_entity_id, relation_type FROM relationships) t;`
  );
  console.log(`[+] Total relationship rows: ${totalRelsBefore[0].count}, Distinct: ${distinctRelsBefore[0].count}`);

  // Delete duplicates keeping minimum ID
  await query(`
    DELETE FROM relationships a USING relationships b
    WHERE a.id > b.id
      AND a.source_entity_id = b.source_entity_id
      AND a.target_entity_id = b.target_entity_id
      AND a.relation_type = b.relation_type;
  `);

  const totalRelsAfter = await query<{ count: string }>(`SELECT COUNT(*) as count FROM relationships;`);
  console.log(`[+] Relationship rows after deduplication: ${totalRelsAfter[0].count}`);
  log.info('ops.duplicates_removed', 'Relationship deduplication completed', {
    before: parseInt(totalRelsBefore[0].count, 10),
    after: parseInt(totalRelsAfter[0].count, 10),
  });

  // 3. Apply Unique Index
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_rel_unique ON relationships (source_entity_id, target_entity_id, relation_type);
  `);
  console.log(`[+] Unique index idx_rel_unique applied.`);

  // 4. Record Audit Log for a valid entity in DB
  const validEntities = await query<{ id: string; name: string }>(`SELECT id, name FROM entities LIMIT 1;`);
  if (validEntities.length > 0) {
    const entity = validEntities[0];
    await logEntityAuditAction({
      entity_id: entity.id,
      action_type: 'CONFLICT_RESOLVE',
      modified_by: 'SANITY_SCRIPT',
      previous_state: { total_relationships: totalRelsBefore[0].count, self_loops: selfLoops[0].count },
      new_state: { total_relationships: totalRelsAfter[0].count, self_loops: 0 },
      rationale: 'Purged self-loop and duplicate relationship edges from PostgreSQL production database.',
    });
    console.log(`[+] Recorded audit log entry for entity: ${entity.id} (${entity.name})`);
  }

  const auditLogsCount = await query<{ count: string }>(`SELECT COUNT(*) as count FROM entity_audit_logs;`);
  console.log(`[+] Total audit logs in DB: ${auditLogsCount[0].count}`);

  log.info('ops.db_cleanup_completed', 'DB Data Sanitization completed successfully', {
    totalAuditLogs: parseInt(auditLogsCount[0].count, 10),
  });
  console.log('✅ DB Data Sanitization completed successfully.');
}

main().catch((err) => {
  log.error('ops.db_cleanup_failed', 'Sanitization Error', { error: err });
  process.exit(1);
});
