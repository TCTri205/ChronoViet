/**
 * Stage 2 (Knowledge Graph Enrichment) Real Database Evaluation Runner
 * Evaluates relationships, verified triples rate, quarantine buffer, directionality compliance,
 * graph connectivity, and entity_audit_logs in PostgreSQL
 */

import fs from 'fs';
import path from 'path';
import {
  HistoricalRelationType,
} from '@chronoviet/shared-spec';
import {
  isPgAvailable,
  query,
  inMemoryStore,
} from '@chronoviet/infra';
import { findMonorepoRoot } from '../src/utils/path-utils.js';

process.env.EVAL_STRICT = 'true';

export interface GraphEvalReport {
  timestamp: string;
  isPgMode: boolean;
  totalEntities: number;
  totalRelationships: number;
  verifiedTriplesCount: number; // confidence >= 0.85
  verifiedTriplesRatePercent: number;
  quarantineStats: {
    totalQuarantined: number;
    lowConfidenceCount: number;
    danglingCount: number;
  };
  unmappedEntitiesCount: number;
  directionalityCompliance: {
    evaluatedEdges: number;
    compliantEdges: number;
    invertedEdges: number;
    compliancePercent: number;
  };
  graphConnectivity: {
    connectedNodesCount: number;
    isolatedNodesCount: number;
    connectedRatePercent: number;
    avgDegreePerNode: number;
  };
  auditLogsCount: number;
  overallPassed: boolean;
}

const CANONICAL_RELATION_RULES: Record<string, { srcPrefixes: string[]; tgtPrefixes: string[] }> = {
  LED_BY: { srcPrefixes: ['event_', 'org_'], tgtPrefixes: ['person_'] },
  HAPPENED_AT: { srcPrefixes: ['event_'], tgtPrefixes: ['loc_'] },
  HAPPENED_IN: { srcPrefixes: ['event_'], tgtPrefixes: ['dynasty_', 'epoch_'] },
  PART_OF: { srcPrefixes: ['artifact_', 'person_', 'org_', 'event_'], tgtPrefixes: ['dynasty_', 'org_', 'event_', 'epoch_'] },
  SAME_AS_LOCATION: { srcPrefixes: ['loc_'], tgtPrefixes: ['loc_'] },
  ALIAS_OF: { srcPrefixes: ['person_', 'loc_', 'dynasty_', 'event_', 'artifact_', 'org_', 'doc_'], tgtPrefixes: ['person_', 'loc_', 'dynasty_', 'event_', 'artifact_', 'org_', 'doc_'] },
  ROYAL_LINEAGE: { srcPrefixes: ['person_'], tgtPrefixes: ['person_'] },
  MENTIONED_IN: { srcPrefixes: ['person_', 'event_', 'artifact_', 'loc_', 'dynasty_', 'org_'], tgtPrefixes: ['doc_'] },
};

export async function runGraphEval(): Promise<GraphEvalReport> {
  console.log('===============================================================');
  console.log(' CHRONOVIET STAGE 2 (KNOWLEDGE GRAPH) REAL DB EVALUATION');
  console.log('===============================================================\n');

  // Pre-flight check: Strict real DB requirement
  const pgConnected = await isPgAvailable();
  if (!pgConnected) {
    console.error('================================================================');
    console.error(' [!] FATAL PRE-FLIGHT ERROR: PostgreSQL is OFFLINE');
    console.error('================================================================');
    console.error(' Real database knowledge graph evaluation requires active PostgreSQL instance.');
    console.error(' In-memory fallback is disabled in STRICT evaluation mode.\n');
    console.error(' 👉 Action required: Start database infrastructure with:');
    console.error('    pnpm stack:infra\n');
    console.error('================================================================\n');
    throw new Error('[STRICT_EVAL] PostgreSQL is offline. Run `pnpm stack:infra` first.');
  }

  console.log(`[*] Target Storage: PostgreSQL (Knowledge Graph Live DB)`);

  let totalEntities = 0;
  let totalRelationships = 0;
  let verifiedTriplesCount = 0;

  let totalQuarantined = 0;
  let lowConfidenceCount = 0;
  let danglingCount = 0;
  let unmappedEntitiesCount = 0;

  let evaluatedEdges = 0;
  let compliantEdges = 0;
  let invertedEdges = 0;

  const connectedEntityIds = new Set<string>();
  let totalConnectedNodes = 0;
  let auditLogsCount = 0;

  if (pgConnected) {
    // 1. Fetch total relationships and verified count from PostgreSQL
    const totalRelsRes = await query<{ count: string }>('SELECT COUNT(*) as count FROM relationships;');
    totalRelationships = parseInt(totalRelsRes[0]?.count || '0', 10);

    const verifiedRes = await query<{ count: string }>('SELECT COUNT(*) as count FROM relationships WHERE confidence >= 0.85;');
    verifiedTriplesCount = parseInt(verifiedRes[0]?.count || '0', 10);

    // 2. Fetch actually connected entity IDs count across all relationships
    const connectedNodesRes = await query<{ count: string }>(`
      SELECT COUNT(DISTINCT entity_id) as count FROM (
        SELECT source_entity_id AS entity_id FROM relationships
        UNION
        SELECT target_entity_id AS entity_id FROM relationships
      ) t;
    `);
    totalConnectedNodes = parseInt(connectedNodesRes[0]?.count || '0', 10);

    // 3. Sample 5,000 relationships for Directionality Matrix Compliance
    const relRows = await query<any>(
      `SELECT source_entity_id, target_entity_id, relation_type
       FROM relationships LIMIT 5000;`
    );

    for (const r of relRows) {
      const sId: string = r.source_entity_id || '';
      const tId: string = r.target_entity_id || '';
      const rel: string = r.relation_type || '';

      // Check Directionality Matrix Compliance
      const rule = CANONICAL_RELATION_RULES[rel];
      if (rule) {
        evaluatedEdges++;
        const sMatch = rule.srcPrefixes.some((p) => sId.startsWith(p));
        const tMatch = rule.tgtPrefixes.some((p) => tId.startsWith(p));

        if (sMatch && tMatch) {
          compliantEdges++;
        } else {
          // Check if inverted
          const sInverted = rule.tgtPrefixes.some((p) => sId.startsWith(p));
          const tInverted = rule.srcPrefixes.some((p) => tId.startsWith(p));
          if (sInverted && tInverted) {
            invertedEdges++;
          }
        }
      }
    }

    // 4. Fetch Quarantine Stats
    const qRows = await query<any>(
      `SELECT reason, COUNT(*) as count FROM quarantine_triples GROUP BY reason;`
    );
    for (const qr of qRows) {
      const cnt = parseInt(qr.count, 10);
      totalQuarantined += cnt;
      if (qr.reason === 'LOW_CONFIDENCE') lowConfidenceCount += cnt;
      if (qr.reason === 'DANGLING_RELATION') danglingCount += cnt;
    }

    // 5. Fetch Unmapped Entities Count
    const unmappedRes = await query<{ count: string }>('SELECT COUNT(*) as count FROM unmapped_entities;');
    unmappedEntitiesCount = parseInt(unmappedRes[0]?.count || '0', 10);

    // 6. Fetch Total Entities
    const entRes = await query<{ count: string }>('SELECT COUNT(*) as count FROM entities;');
    totalEntities = parseInt(entRes[0]?.count || '0', 10);

    // 7. Fetch Audit Logs Count
    const auditRes = await query<{ count: string }>('SELECT COUNT(*) as count FROM entity_audit_logs;');
    auditLogsCount = parseInt(auditRes[0]?.count || '0', 10);
  } else {
    // In-memory store fallback
    totalEntities = inMemoryStore.entities.size;
    totalRelationships = inMemoryStore.relationships.length;

    for (const r of inMemoryStore.relationships) {
      if (r.confidence >= 0.85) verifiedTriplesCount++;
      connectedEntityIds.add(r.source_entity_id);
      connectedEntityIds.add(r.target_entity_id);

      const rule = CANONICAL_RELATION_RULES[r.relation_type];
      if (rule) {
        evaluatedEdges++;
        compliantEdges++;
      }
    }

    totalQuarantined = inMemoryStore.quarantineTriples.length;
    unmappedEntitiesCount = inMemoryStore.unmappedEntities.size;
    auditLogsCount = inMemoryStore.auditLogs.length;
  }

  const verifiedRate =
    totalRelationships > 0
      ? Number(((verifiedTriplesCount / totalRelationships) * 100).toFixed(1))
      : 100;

  const compliancePercent =
    evaluatedEdges > 0 ? Number(((compliantEdges / evaluatedEdges) * 100).toFixed(1)) : 100;

  const connectedNodesCount = pgConnected ? totalConnectedNodes : connectedEntityIds.size;
  const isolatedNodesCount = Math.max(0, totalEntities - connectedNodesCount);
  const connectedRate =
    totalEntities > 0 ? Number(((connectedNodesCount / totalEntities) * 100).toFixed(1)) : 100;
  const avgDegree =
    totalEntities > 0 ? Number(((totalRelationships * 2) / totalEntities).toFixed(2)) : 0;

  const verifiedRatePassed = verifiedRate >= 80.0;
  const compliancePassed = compliancePercent >= 90.0;
  const overallPassed = totalRelationships > 0 && verifiedRatePassed && compliancePassed;

  console.log('───────────────────────────────────────────────────────────────');
  console.log(` STAGE 2 (KNOWLEDGE GRAPH) RESULTS: [${overallPassed ? 'PASS ✅' : 'FAIL ❌'}]`);
  console.log('───────────────────────────────────────────────────────────────');
  console.log(` • Total Graph Entities:     ${totalEntities}`);
  console.log(` • Total Relationships:      ${totalRelationships}`);
  console.log(` • Verified Triples Rate:    ${verifiedRate}% (${verifiedTriplesCount}/${totalRelationships} >= 0.85) | Target: >= 80% | ${verifiedRatePassed ? '✅' : '❌'}`);
  console.log(` • Quarantine Buffer Count:   ${totalQuarantined} (Low Conf: ${lowConfidenceCount}, Dangling: ${danglingCount})`);
  console.log(` • Unmapped Entities Count:   ${unmappedEntitiesCount} entities pending triage`);
  console.log(` • Directionality Matrix:    ${compliancePercent}% compliant (${compliantEdges}/${evaluatedEdges}) | Target: >= 90% | ${compliancePassed ? '✅' : '❌'}`);
  console.log(` • Graph Connectivity:       ${connectedRate}% nodes linked (${connectedNodesCount}/${totalEntities}), Avg Degree: ${avgDegree}`);
  console.log(` • Entity Audit Trail Logs:  ${auditLogsCount} re-resolution events logged`);
  console.log('───────────────────────────────────────────────────────────────\n');

  const monorepoRoot = findMonorepoRoot();
  const reportsDir = path.resolve(monorepoRoot, 'packages', 'data-ingestion', 'eval', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const report: GraphEvalReport = {
    timestamp: new Date().toISOString(),
    isPgMode: pgConnected,
    totalEntities,
    totalRelationships,
    verifiedTriplesCount,
    verifiedTriplesRatePercent: verifiedRate,
    quarantineStats: {
      totalQuarantined,
      lowConfidenceCount,
      danglingCount,
    },
    unmappedEntitiesCount,
    directionalityCompliance: {
      evaluatedEdges,
      compliantEdges,
      invertedEdges,
      compliancePercent,
    },
    graphConnectivity: {
      connectedNodesCount,
      isolatedNodesCount,
      connectedRatePercent: connectedRate,
      avgDegreePerNode: avgDegree,
    },
    auditLogsCount,
    overallPassed,
  };

  const reportPath = path.join(reportsDir, 'stage2-graph-eval-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`[+] Stage 2 Graph Evaluation Report saved to: file:///${reportPath.replace(/\\/g, '/')}\n`);

  return report;
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith('graph-eval-runner.ts') || process.argv[1].endsWith('graph-eval-runner.js'))
) {
  runGraphEval()
    .then((report) => {
      process.exit(report.overallPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error('[!] Stage 2 Graph Eval Runner Error:', err);
      process.exit(1);
    });
}
