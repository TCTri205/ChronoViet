import { query, isPgAvailable, logEntityAuditAction, createLogger, withTransaction, closePool } from '@chronoviet/infra';

const log = createLogger({ service: 'ops', correlationId: 'db-cleanup' });

async function main() {
  log.info('ops.db_cleanup_started', 'Starting DB Data Sanitization & Audit Log Verification');

  const available = await isPgAvailable();
  if (!available) {
    log.warn('ops.db_unavailable', 'PostgreSQL is not connected or running. Skipping DB cleanup.');
    return;
  }

  await withTransaction(async (execQuery: <T = any>(sql: string, params?: unknown[]) => Promise<T[]>) => {
    // 1. Check & Delete Self-Loop Relationships in graph
    const selfLoops = await execQuery<{ count: string }>(
      `SELECT COUNT(*) as count FROM relationships WHERE source_entity_id = target_entity_id;`
    );
    console.log(`[+] Self-loop relationships found before cleanup: ${selfLoops[0].count}`);

    await execQuery(`DELETE FROM relationships WHERE source_entity_id = target_entity_id;`);
    console.log(`[+] Deleted self-loop relationships from relationships table.`);

    // 2. Check & Delete Self-Loops in Quarantine Triples
    const qSelfLoops = await execQuery<{ count: string }>(
      `SELECT COUNT(*) as count FROM quarantine_triples WHERE source_entity_id = target_entity_id;`
    );
    if (parseInt(qSelfLoops[0]?.count || '0', 10) > 0) {
      await execQuery(`DELETE FROM quarantine_triples WHERE source_entity_id = target_entity_id;`);
      console.log(`[+] Deleted ${qSelfLoops[0].count} self-loops from quarantine_triples table.`);
    }

    // 3. Check & Delete Dangling Relationships (referencing deleted/missing entities)
    const dangling = await execQuery<{ count: string }>(`
      SELECT COUNT(*) as count FROM relationships r
      WHERE NOT EXISTS (SELECT 1 FROM entities e WHERE e.id = r.source_entity_id)
         OR NOT EXISTS (SELECT 1 FROM entities e WHERE e.id = r.target_entity_id);
    `);
    if (parseInt(dangling[0]?.count || '0', 10) > 0) {
      await execQuery(`
        DELETE FROM relationships r
        WHERE NOT EXISTS (SELECT 1 FROM entities e WHERE e.id = r.source_entity_id)
           OR NOT EXISTS (SELECT 1 FROM entities e WHERE e.id = r.target_entity_id);
      `);
      console.log(`[+] Deleted ${dangling[0].count} dangling relationships without entity references.`);
    }

    // 4. Check & Delete Duplicate Relationships
    const totalRelsBefore = await execQuery<{ count: string }>(`SELECT COUNT(*) as count FROM relationships;`);
    const distinctRelsBefore = await execQuery<{ count: string }>(
      `SELECT COUNT(*) as count FROM (SELECT DISTINCT source_entity_id, target_entity_id, relation_type FROM relationships) t;`
    );
    console.log(`[+] Total relationship rows: ${totalRelsBefore[0].count}, Distinct: ${distinctRelsBefore[0].count}`);

    // Delete duplicates keeping minimum ID
    await execQuery(`
      DELETE FROM relationships a USING relationships b
      WHERE a.id > b.id
        AND a.source_entity_id = b.source_entity_id
        AND a.target_entity_id = b.target_entity_id
        AND a.relation_type = b.relation_type;
    `);

    const totalRelsAfter = await execQuery<{ count: string }>(`SELECT COUNT(*) as count FROM relationships;`);
    console.log(`[+] Relationship rows after deduplication: ${totalRelsAfter[0].count}`);

    // 5. Apply Unique Index
    await execQuery(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rel_unique ON relationships (source_entity_id, target_entity_id, relation_type);
    `);
    console.log(`[+] Unique index idx_rel_unique verified/applied.`);

    // 6. Record Audit Log for a valid entity in DB
    const validEntities = await execQuery<{ id: string; name: string }>(`SELECT id, name FROM entities LIMIT 1;`);
    if (validEntities.length > 0) {
      const entity = validEntities[0];
      await logEntityAuditAction({
        entity_id: entity.id,
        action_type: 'CONFLICT_RESOLVE',
        modified_by: 'SANITY_SCRIPT',
        previous_state: {
          total_relationships: totalRelsBefore[0].count,
          self_loops: selfLoops[0].count,
          dangling: dangling[0]?.count || '0',
        },
        new_state: {
          total_relationships: totalRelsAfter[0].count,
          self_loops: 0,
          dangling: 0,
        },
        rationale: 'Purged self-loop, dangling, and duplicate relationship edges from PostgreSQL production database.',
      });
      console.log(`[+] Recorded audit log entry for entity: ${entity.id} (${entity.name})`);
    }

    log.info('ops.duplicates_removed', 'Relationship deduplication and sanitization completed', {
      before: parseInt(totalRelsBefore[0].count, 10),
      after: parseInt(totalRelsAfter[0].count, 10),
      selfLoopsRemoved: parseInt(selfLoops[0].count, 10),
      danglingRemoved: parseInt(dangling[0]?.count || '0', 10),
    });
  });

  const auditLogsCount = await query<{ count: string }>(`SELECT COUNT(*) as count FROM entity_audit_logs;`);
  console.log(`[+] Total audit logs in DB: ${auditLogsCount[0].count}`);

  log.info('ops.db_cleanup_completed', 'DB Data Sanitization completed successfully', {
    totalAuditLogs: parseInt(auditLogsCount[0].count, 10),
  });
  console.log('✅ DB Data Sanitization completed successfully.');

  await closePool();
}

main().catch(async (err) => {
  log.error('ops.db_cleanup_failed', 'Sanitization Error', { error: err });
  await closePool();
  process.exit(1);
});
