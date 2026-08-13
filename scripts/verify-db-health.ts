import { query, isPgAvailable } from '../packages/shared-spec/src/index.js';

async function verifyDbHealth() {
  console.log('🔍 Executing Deep DB Health Audit...');

  const available = await isPgAvailable();
  if (!available) {
    console.error('❌ PostgreSQL is not accessible.');
    process.exit(1);
  }

  // 1. Relationships Audit
  const totalRels = await query<{ count: string }>('SELECT COUNT(*) as count FROM relationships');
  const selfLoops = await query<{ count: string }>('SELECT COUNT(*) as count FROM relationships WHERE source_entity_id = target_entity_id');
  const distinctRels = await query<{ count: string }>('SELECT COUNT(*) as count FROM (SELECT DISTINCT source_entity_id, target_entity_id, relation_type FROM relationships) t');

  console.log('--- [1. RELATIONSHIPS AUDIT] ---');
  console.log(`• Total Relationships: ${totalRels[0].count}`);
  console.log(`• Self-Loops:          ${selfLoops[0].count} ${selfLoops[0].count === '0' ? '✅ (PASS)' : '❌ (FAIL)'}`);
  console.log(`• Distinct Tuples:     ${distinctRels[0].count} ${totalRels[0].count === distinctRels[0].count ? '✅ (100% Unique)' : '❌ (Duplicates Exist)'}`);

  // 2. Indexes Audit
  const indexes = await query<{ indexname: string }>(`SELECT indexname FROM pg_indexes WHERE tablename = 'relationships' AND indexname = 'idx_rel_unique'`);
  console.log(`• Unique Index Active: ${indexes.length > 0 ? '✅ idx_rel_unique exists' : '❌ missing'}`);

  // 3. Document Chunks Audit
  const totalChunks = await query<{ count: string }>('SELECT COUNT(*) as count FROM document_chunks');
  const nullTitles = await query<{ count: string }>('SELECT COUNT(*) as count FROM document_chunks WHERE title IS NULL OR title = \'\'');
  console.log('\n--- [2. DOCUMENT CHUNKS AUDIT] ---');
  console.log(`• Total Chunks:        ${totalChunks[0].count}`);
  console.log(`• Empty Titles:        ${nullTitles[0].count} ${nullTitles[0].count === '0' ? '✅ (PASS)' : '❌ (FAIL)'}`);

  // 4. Entities Audit
  const totalEntities = await query<{ count: string }>('SELECT COUNT(*) as count FROM entities');
  const nullTypes = await query<{ count: string }>('SELECT COUNT(*) as count FROM entities WHERE type IS NULL OR name IS NULL');
  console.log('\n--- [3. ENTITIES AUDIT] ---');
  console.log(`• Total Entities:      ${totalEntities[0].count}`);
  console.log(`• Malformed Entities:  ${nullTypes[0].count} ${nullTypes[0].count === '0' ? '✅ (PASS)' : '❌ (FAIL)'}`);

  // 5. Audit Logs Audit
  const totalLogs = await query<{ count: string }>('SELECT COUNT(*) as count FROM entity_audit_logs');
  console.log('\n--- [4. AUDIT LOGS AUDIT] ---');
  console.log(`• Audit Log Records:   ${totalLogs[0].count} ${parseInt(totalLogs[0].count, 10) > 0 ? '✅ (Active)' : '⚠️ (Empty)'}`);

  const isHealthy = 
    selfLoops[0].count === '0' && 
    totalRels[0].count === distinctRels[0].count && 
    indexes.length > 0 &&
    nullTitles[0].count === '0' &&
    nullTypes[0].count === '0';

  console.log('\n==================================================');
  console.log(` OVERALL DATABASE INTEGRITY STATUS: ${isHealthy ? '✅ PERFECTLY STABLE & HEALTHY' : '❌ UNHEALTHY'}`);
  console.log('==================================================\n');

  if (!isHealthy) process.exit(1);
}

verifyDbHealth().catch(err => {
  console.error('❌ Audit Error:', err);
  process.exit(1);
});
