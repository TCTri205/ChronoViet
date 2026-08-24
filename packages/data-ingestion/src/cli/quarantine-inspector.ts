#!/usr/bin/env tsx
/**
 * Database Quarantine Inspector CLI Tool
 * Allows operators to audit, approve, reject, or purge quarantined knowledge graph triples and unmapped entities.
 *
 * Usage:
 *   pnpm db:audit-quarantine
 *   pnpm db:audit-quarantine --accept-all-high-conf --threshold=0.85
 *   pnpm db:audit-quarantine --purge-spurious
 *   pnpm db:audit-quarantine --dry-run
 */

import { resolveCanonicalEntity } from '@chronoviet/shared-spec';
import { query, isPgAvailable, createLogger, logEntityAuditAction, closePool } from '@chronoviet/infra';

const log = createLogger({ service: 'quarantine-inspector' });

interface QuarantinedTripleRow {
  id: number;
  source_entity_id: string | null;
  target_entity_id: string | null;
  source_name: string | null;
  target_name: string | null;
  relation_type: string | null;
  confidence: number;
  chunk_id: string | null;
  reason: string;
  status: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface UnmappedEntityRow {
  id: string;
  raw_name: string;
  inferred_type: string;
  occurrence_count: number;
  sample_context?: string;
  status: string;
  created_at: string;
}

export async function runQuarantineInspector() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isPurgeSpurious = args.includes('--purge-spurious');
  const isAcceptHighConf = args.includes('--accept-all-high-conf');
  const isPromoteUnmapped = args.includes('--promote-unmapped');
  const thresholdArg = args.find((a) => a.startsWith('--threshold='));
  const threshold = thresholdArg ? parseFloat(thresholdArg.split('=')[1]) : 0.85;
  const minOccurrencesArg = args.find((a) => a.startsWith('--min-occurrences='));
  const minOccurrences = minOccurrencesArg ? parseInt(minOccurrencesArg.split('=')[1], 10) : 3;

  console.log('===============================================================');
  console.log(' CHRONOVIET KNOWLEDGE GRAPH QUARANTINE INSPECTOR & AUDITOR');
  console.log(` Options: dry-run=${isDryRun} | accept-high-conf=${isAcceptHighConf} | threshold=${threshold} | promote-unmapped=${isPromoteUnmapped} (min=${minOccurrences}) | purge-spurious=${isPurgeSpurious}`);
  console.log('===============================================================\n');

  const pgReady = await isPgAvailable();
  if (!pgReady) {
    console.log('⚠️ PostgreSQL is offline. Running in memory / mock audit mode.\n');
    console.log('✅ In-Memory Simulation: 0 quarantined edges requiring urgent action.');
    return;
  }

  // 1. Audit Quarantined Triples Table
  const reasonBreakdown = await query<{ reason: string; count: string }>(`
    SELECT reason, COUNT(*) as count
    FROM quarantine_triples
    GROUP BY reason
    ORDER BY count DESC;
  `);

  const statusBreakdown = await query<{ status: string; count: string }>(`
    SELECT status, COUNT(*) as count
    FROM quarantine_triples
    GROUP BY status
    ORDER BY count DESC;
  `);

  const quarantinedRows = await query<QuarantinedTripleRow>(`
    SELECT id, source_entity_id, target_entity_id, source_name, target_name,
           relation_type, confidence, chunk_id, reason, status, metadata, created_at
    FROM quarantine_triples
    WHERE status = 'PENDING_REVIEW'
    ORDER BY confidence DESC, id ASC
    LIMIT 100;
  `);

  console.log('--- [1. QUARANTINED TRIPLES BREAKDOWN] ---');
  if (reasonBreakdown.length > 0) {
    console.log('• By Reason:');
    for (const r of reasonBreakdown) {
      console.log(`  - ${r.reason.padEnd(28)}: ${r.count}`);
    }
  } else {
    console.log('• No quarantined triples in database.');
  }

  if (statusBreakdown.length > 0) {
    console.log('• By Status:');
    for (const s of statusBreakdown) {
      console.log(`  - ${s.status.padEnd(28)}: ${s.count}`);
    }
  }

  console.log(`\n[*] Pending Review Triples: ${quarantinedRows.length}\n`);

  if (quarantinedRows.length > 0) {
    console.log('┌────┬─────────────────────────────┬──────────────┬─────────────────────────────┬──────┬────────────────────┐');
    console.log('│ ID │ Source (ID / Name)          │ Relation     │ Target (ID / Name)          │ Conf │ Reason             │');
    console.log('├────┼─────────────────────────────┼──────────────┼─────────────────────────────┼──────┼────────────────────┤');
    for (const row of quarantinedRows.slice(0, 15)) {
      const idStr = String(row.id).padEnd(2).slice(0, 2);
      const src = (row.source_name || row.source_entity_id || 'UNKNOWN').padEnd(27).slice(0, 27);
      const rel = (row.relation_type || 'UNKNOWN').padEnd(12).slice(0, 12);
      const tgt = (row.target_name || row.target_entity_id || 'UNKNOWN').padEnd(27).slice(0, 27);
      const conf = (row.confidence !== undefined ? Number(row.confidence).toFixed(2) : '0.00').padEnd(4).slice(0, 4);
      const reason = row.reason.padEnd(18).slice(0, 18);
      console.log(`│ ${idStr} │ ${src} │ ${rel} │ ${tgt} │ ${conf} │ ${reason} │`);
    }
    console.log('└────┴─────────────────────────────┴──────────────┴─────────────────────────────┴──────┴────────────────────┘\n');
  }

  // 2. Audit Unmapped Entities Table
  const unmappedRows = await query<UnmappedEntityRow>(`
    SELECT id, raw_name, inferred_type, occurrence_count, sample_context, status, created_at
    FROM unmapped_entities
    ORDER BY occurrence_count DESC
    LIMIT 50;
  `);

  console.log('--- [2. UNMAPPED ENTITIES TRIAGE BUFFER] ---');
  console.log(`• Total Unmapped Entities: ${unmappedRows.length}`);
  if (unmappedRows.length > 0) {
    console.log('┌───────────────────────────────────┬──────────────────────┬────────────┬────────────────┐');
    console.log('│ Raw Entity Name                   │ Inferred Type        │ Occurrences│ Status         │');
    console.log('├───────────────────────────────────┼──────────────────────┼────────────┼────────────────┤');
    for (const row of unmappedRows.slice(0, 10)) {
      const name = row.raw_name.padEnd(33).slice(0, 33);
      const type = row.inferred_type.padEnd(20).slice(0, 20);
      const occ = String(row.occurrence_count).padEnd(10).slice(0, 10);
      const st = row.status.padEnd(14).slice(0, 14);
      console.log(`│ ${name} │ ${type} │ ${occ} │ ${st} │`);
    }
    console.log('└───────────────────────────────────┴──────────────────────┴────────────┴────────────────┘\n');
  }

  // 3. Execute Actions based on CLI flags
  if (isPurgeSpurious) {
    console.log('--- [ACTION: PURGE SPURIOUS] ---');
    console.log('[*] Purging self-loops, rejected records, and low-confidence noise...');
    if (!isDryRun) {
      const delSelfLoopsRel = await query('DELETE FROM relationships WHERE source_entity_id = target_entity_id RETURNING id');
      const delSelfLoopsQ = await query('DELETE FROM quarantine_triples WHERE source_entity_id = target_entity_id RETURNING id');
      const delRejectedQ = await query("DELETE FROM quarantine_triples WHERE status = 'REJECTED' OR confidence < 0.25 RETURNING id");
      const delNoiseUnmapped = await query("DELETE FROM unmapped_entities WHERE status = 'DISCARDED_AS_NOISE' RETURNING id");

      console.log(`✅ Removed ${delSelfLoopsRel.length} self-loop(s) from relationships.`);
      console.log(`✅ Removed ${delSelfLoopsQ.length} self-loop(s) from quarantine_triples.`);
      console.log(`✅ Purged ${delRejectedQ.length} rejected/low-confidence triple(s) from quarantine.`);
      console.log(`✅ Purged ${delNoiseUnmapped.length} noise entity record(s) from unmapped_entities.`);
    } else {
      console.log(`[DRY-RUN] Would remove self-loops, rejected quarantine triples, and discarded unmapped entities.`);
    }
  }

  if (isAcceptHighConf) {
    console.log('--- [ACTION: PROMOTE HIGH CONFIDENCE] ---');
    console.log(`[*] Inspecting qualifying triples with confidence >= ${threshold}...`);

    // Find candidates in quarantine_triples where source and target exist in master entities
    const promotableTriples = await query<QuarantinedTripleRow>(`
      SELECT qt.id, qt.source_entity_id, qt.target_entity_id, qt.relation_type, qt.confidence
      FROM quarantine_triples qt
      JOIN entities s ON s.id = qt.source_entity_id
      JOIN entities t ON t.id = qt.target_entity_id
      WHERE qt.status = 'PENDING_REVIEW'
        AND qt.confidence >= $1
        AND qt.source_entity_id IS NOT NULL
        AND qt.target_entity_id IS NOT NULL
        AND qt.relation_type IS NOT NULL
        AND qt.source_entity_id != qt.target_entity_id;
    `, [threshold]);

    console.log(`[*] Found ${promotableTriples.length} verified candidate triple(s) eligible for promotion.`);

    if (promotableTriples.length > 0) {
      if (!isDryRun) {
        let promotedCount = 0;
        for (const triple of promotableTriples) {
          await query(`
            INSERT INTO relationships (source_entity_id, target_entity_id, relation_type, confidence)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (source_entity_id, target_entity_id, relation_type)
            DO UPDATE SET confidence = GREATEST(relationships.confidence, EXCLUDED.confidence);
          `, [triple.source_entity_id, triple.target_entity_id, triple.relation_type, triple.confidence]);

          await query(`
            UPDATE quarantine_triples
            SET status = 'APPROVED'
            WHERE id = $1;
          `, [triple.id]);

          if (triple.source_entity_id) {
            await logEntityAuditAction({
              entity_id: triple.source_entity_id,
              action_type: 'CONFLICT_RESOLVE',
              modified_by: 'QUARANTINE_OPERATOR',
              rationale: `Promoted triple ${triple.source_entity_id} -[${triple.relation_type}]-> ${triple.target_entity_id} from quarantine with confidence ${triple.confidence}`,
            });
          }
          promotedCount++;
        }
        console.log(`✅ Successfully promoted ${promotedCount} triple(s) into active relationships graph.`);
      } else {
        console.log(`[DRY-RUN] Would promote ${promotableTriples.length} candidate triple(s) into relationships graph.`);
      }
    }
  }

  if (isPromoteUnmapped) {
    console.log('--- [ACTION: PROMOTE UNMAPPED ENTITIES] ---');
    console.log(`[*] Promoting unmapped entities with occurrence_count >= ${minOccurrences}...`);

    const eligibleUnmapped = await query<UnmappedEntityRow>(`
      SELECT id, raw_name, inferred_type, occurrence_count
      FROM unmapped_entities
      WHERE status = 'PENDING_TRIAGE'
        AND occurrence_count >= $1
      ORDER BY occurrence_count DESC;
    `, [minOccurrences]);

    console.log(`[*] Found ${eligibleUnmapped.length} unmapped candidate(s) eligible for promotion.`);

    if (eligibleUnmapped.length > 0) {
      if (!isDryRun) {
        let promotedEntitiesCount = 0;
        for (const ue of eligibleUnmapped) {
          const canonical = resolveCanonicalEntity(ue.raw_name);
          const entityType = ue.inferred_type || canonical.type || 'HISTORICAL_PERSON';
          const mergedAliases = Array.from(new Set([...(canonical.aliases || []), ue.raw_name]));

          await query(`
            INSERT INTO entities (id, name, type, aliases, metadata)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO UPDATE SET aliases = ARRAY(SELECT DISTINCT unnest(array_cat(entities.aliases, EXCLUDED.aliases)));
          `, [
            canonical.entityId,
            canonical.canonicalName,
            entityType,
            mergedAliases,
            JSON.stringify({ promoted_from_unmapped: true, original_raw_name: ue.raw_name, occurrences: ue.occurrence_count }),
          ]);

          await query(`
            UPDATE unmapped_entities
            SET status = 'PROMOTED'
            WHERE id = $1;
          `, [ue.id]);

          await logEntityAuditAction({
            entity_id: canonical.entityId,
            action_type: 'CONFLICT_RESOLVE',
            modified_by: 'QUARANTINE_OPERATOR',
            rationale: `Promoted unmapped entity '${ue.raw_name}' (${ue.occurrence_count} occurrences) to canonical ID '${canonical.entityId}'`,
          });

          promotedEntitiesCount++;
        }
        console.log(`✅ Successfully promoted ${promotedEntitiesCount} unmapped entity/entities into master entities table.`);
      } else {
        console.log(`[DRY-RUN] Would promote ${eligibleUnmapped.length} unmapped entity/entities into master entities table.`);
      }
    }
  }

  console.log('\n===============================================================');
  console.log(' QUARANTINE AUDIT COMPLETE');
  console.log('===============================================================\n');

  await closePool();
}

if (process.argv[1] && process.argv[1].endsWith('quarantine-inspector.ts')) {
  runQuarantineInspector().catch(async (err) => {
    log.error('quarantine.fatal_error', `Inspector error: ${err.message}`, { error: err });
    await closePool();
    process.exit(1);
  });
}
