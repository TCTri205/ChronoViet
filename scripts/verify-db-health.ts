import { query, isPgAvailable, createLogger, closePool } from '@chronoviet/infra';

const log = createLogger({ service: 'ops', correlationId: 'db-health-audit' });

async function verifyDbHealth() {
  log.info('ops.db_health_started', 'Executing Deep DB Health Audit');

  const available = await isPgAvailable();
  if (!available) {
    log.error('ops.db_unavailable', 'PostgreSQL is not accessible');
    process.exit(1);
  }

  // 1. Relationships Audit
  const totalRels = await query<{ count: string }>('SELECT COUNT(*) as count FROM relationships');
  const selfLoops = await query<{ count: string }>('SELECT COUNT(*) as count FROM relationships WHERE source_entity_id = target_entity_id');
  const distinctRels = await query<{ count: string }>('SELECT COUNT(*) as count FROM (SELECT DISTINCT source_entity_id, target_entity_id, relation_type FROM relationships) t');
  const danglingRels = await query<{ count: string }>(`
    SELECT COUNT(*) as count FROM relationships r
    WHERE NOT EXISTS (SELECT 1 FROM entities e WHERE e.id = r.source_entity_id)
       OR NOT EXISTS (SELECT 1 FROM entities e WHERE e.id = r.target_entity_id);
  `);

  console.log('--- [1. RELATIONSHIPS AUDIT] ---');
  console.log(`• Total Relationships: ${totalRels[0].count}`);
  console.log(`• Self-Loops:          ${selfLoops[0].count} ${selfLoops[0].count === '0' ? '✅ (PASS)' : '❌ (FAIL)'}`);
  console.log(`• Distinct Tuples:     ${distinctRels[0].count} ${totalRels[0].count === distinctRels[0].count ? '✅ (100% Unique)' : '❌ (Duplicates Exist)'}`);
  console.log(`• Dangling References: ${danglingRels[0].count} ${danglingRels[0].count === '0' ? '✅ (Zero Dangling)' : '❌ (Dangling Edges Exist)'}`);

  // 2. Indexes Audit
  const requiredIndexes = ['idx_rel_unique', 'idx_chunks_embedding_hnsw', 'idx_chunks_fts'];
  const foundIndexes = await query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1::text[])`,
    [requiredIndexes]
  );
  const foundIndexNames = new Set(foundIndexes.map((i: any) => i.indexname));
  const missingIndexes = requiredIndexes.filter((idx) => !foundIndexNames.has(idx));

  console.log('\n--- [2. INDEXES AUDIT] ---');
  console.log(`• Unique Rel Index:    ${foundIndexNames.has('idx_rel_unique') ? '✅ idx_rel_unique exists' : '❌ missing'}`);
  console.log(`• HNSW Vector Index:   ${foundIndexNames.has('idx_chunks_embedding_hnsw') ? '✅ idx_chunks_embedding_hnsw exists' : '⚠️ missing / pending generation'}`);
  console.log(`• FTS BM25 Index:      ${foundIndexNames.has('idx_chunks_fts') ? '✅ idx_chunks_fts exists' : '❌ missing'}`);

  // 3. Document Chunks Audit
  const totalChunks = await query<{ count: string }>('SELECT COUNT(*) as count FROM document_chunks');
  const nullTitles = await query<{ count: string }>('SELECT COUNT(*) as count FROM document_chunks WHERE title IS NULL OR title = \'\'');
  const missingEmbeddings = await query<{ count: string }>('SELECT COUNT(*) as count FROM document_chunks WHERE embedding IS NULL');
  console.log('\n--- [3. DOCUMENT CHUNKS AUDIT] ---');
  console.log(`• Total Chunks:        ${totalChunks[0].count}`);
  console.log(`• Empty Titles:        ${nullTitles[0].count} ${nullTitles[0].count === '0' ? '✅ (PASS)' : '❌ (FAIL)'}`);
  console.log(`• Missing Embeddings:  ${missingEmbeddings[0].count} ${missingEmbeddings[0].count === '0' ? '✅ (100% Vectorized)' : '⚠️ (Unvectorized Chunks Exist)'}`);

  // 4. Entities Audit
  const totalEntities = await query<{ count: string }>('SELECT COUNT(*) as count FROM entities');
  const nullTypes = await query<{ count: string }>('SELECT COUNT(*) as count FROM entities WHERE type IS NULL OR name IS NULL');
  console.log('\n--- [4. ENTITIES AUDIT] ---');
  console.log(`• Total Entities:      ${totalEntities[0].count}`);
  console.log(`• Malformed Entities:  ${nullTypes[0].count} ${nullTypes[0].count === '0' ? '✅ (PASS)' : '❌ (FAIL)'}`);

  // 5. Quarantine & Triage Audit
  const totalQuarantine = await query<{ count: string }>('SELECT COUNT(*) as count FROM quarantine_triples');
  const totalUnmapped = await query<{ count: string }>('SELECT COUNT(*) as count FROM unmapped_entities');
  console.log('\n--- [5. QUARANTINE & TRIAGE BUFFER] ---');
  console.log(`• Quarantined Triples: ${totalQuarantine[0].count} ${parseInt(totalQuarantine[0].count, 10) === 0 ? '✅ (Clean)' : 'ℹ️ (Buffered for Review)'}`);
  console.log(`• Unmapped Entities:   ${totalUnmapped[0].count} ${parseInt(totalUnmapped[0].count, 10) === 0 ? '✅ (Clean)' : 'ℹ️ (Buffered for Triage)'}`);

  // 6. Audit Logs Audit
  const totalLogs = await query<{ count: string }>('SELECT COUNT(*) as count FROM entity_audit_logs');
  console.log('\n--- [6. AUDIT LOGS AUDIT] ---');
  console.log(`• Audit Log Records:   ${totalLogs[0].count} ${parseInt(totalLogs[0].count, 10) > 0 ? '✅ (Active)' : 'ℹ️ (Initial State)'}`);

  const isHealthy =
    selfLoops[0].count === '0' &&
    totalRels[0].count === distinctRels[0].count &&
    danglingRels[0].count === '0' &&
    missingIndexes.length === 0 &&
    nullTitles[0].count === '0' &&
    nullTypes[0].count === '0';

  console.log('\n==================================================');
  console.log(` OVERALL DATABASE INTEGRITY STATUS: ${isHealthy ? '✅ PERFECTLY STABLE & HEALTHY' : '❌ UNHEALTHY'}`);
  console.log('==================================================\n');

  log.info('ops.db_health_completed', 'DB health audit finished', {
    isHealthy,
    totalRelationships: parseInt(totalRels[0].count, 10),
    selfLoops: parseInt(selfLoops[0].count, 10),
    distinctTuples: parseInt(distinctRels[0].count, 10),
    danglingRelationships: parseInt(danglingRels[0].count, 10),
    missingIndexes,
    totalChunks: parseInt(totalChunks[0].count, 10),
    emptyTitles: parseInt(nullTitles[0].count, 10),
    missingEmbeddings: parseInt(missingEmbeddings[0].count, 10),
    totalEntities: parseInt(totalEntities[0].count, 10),
    malformedEntities: parseInt(nullTypes[0].count, 10),
    quarantinedTriples: parseInt(totalQuarantine[0].count, 10),
    unmappedEntities: parseInt(totalUnmapped[0].count, 10),
    auditLogRecords: parseInt(totalLogs[0].count, 10),
  });

  await closePool();

  if (!isHealthy) process.exit(1);
}

verifyDbHealth().catch(async (err) => {
  log.error('ops.db_health_failed', 'DB health audit error', { error: err });
  await closePool();
  process.exit(1);
});
