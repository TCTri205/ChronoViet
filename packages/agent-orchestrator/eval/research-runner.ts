/**
 * Research Agent (Micro-Step 1C) Eval Runner
 * Measures candidate resolution across the provider chain for a small set of
 * historical topics. Does NOT require an online search key: when no key is
 * configured the chain falls back to Wikimedia + curated catalog, and the run
 * still reports provenance (which provider served what, count, latency).
 */

import * as fs from 'fs';
import * as path from 'path';
import { envConfig, hasAvailableApiKeys } from '@chronoviet/infra';
import { buildProviderChain, resolveImageCandidates } from '../src/research/index.js';
import { assertEvalPreflight } from '../../../eval/utils/preflight.js';

export interface ResearchEvalReport {
  timestamp: string;
  chainName: 'research-agent';
  onlineKeysPresent: string[];
  providerChain: string[];
  preflight: unknown;
  totalTopics: number;
  totalCandidates: number;
  avgLatencyMs: number;
  licenseComplianceRate: number;
  topicsResolvedWithCandidates: number;
  providerHitDistribution: Record<string, number>;
  qualityStatus: 'PASS' | 'FAIL';
  topics: Array<{
    topic: string;
    candidates: number;
    latencyMs: number;
    provenance: Array<{ provider: string; count: number; latencyMs: number }>;
    licenseOk: boolean;
  }>;
}

const GOLDEN_TOPICS = [
  'Trận Bạch Đằng năm 938 của Ngô Quyền',
  'Tiểu sử Quốc Công Tiết Chế Trần Hưng Đạo',
  'Chiếu Dời Đô và Triều Đại Nhà Lý',
  'Hoàng đế Quang Trung Đại Phá Quân Thanh 1789',
  'Bảo Vật Quốc Gia Trống Đồng Ngọc Lũ',
];

export async function runResearchEval(options: { verbose?: boolean } = {}): Promise<ResearchEvalReport> {
  console.log('\n================================================================');
  console.log(' CHAIN: RESEARCH AGENT (MICRO-STEP 1C) — IMAGE CANDIDATE RESOLUTION');
  console.log('================================================================\n');

  const chain = buildProviderChain();
  const onlineKeysPresent = [
    hasAvailableApiKeys('serpapi') || envConfig.SERPAPI_API_KEY ? 'serpapi' : null,
    hasAvailableApiKeys('tavily') || envConfig.TAVILY_API_KEY ? 'tavily' : null,
    hasAvailableApiKeys('brave') || envConfig.BRAVE_API_KEY ? 'brave' : null,
  ].filter(Boolean) as string[];

  // Report search provider availability (non-blocking: no key -> offline fallback)
  const preflight = await assertEvalPreflight(['search']);

  console.log(`[+] Provider chain: ${chain.map((p) => p.name).join(' -> ')}`);
  console.log(`[+] Online keys present: ${onlineKeysPresent.length > 0 ? onlineKeysPresent.join(', ') : 'NONE (using Wikimedia + curated catalog fallback)'}`);

  if (onlineKeysPresent.length === 0) {
    console.log('[!] Warning: no online search key configured — candidates come from Wikimedia/catalog only.');
  }

  const topics: ResearchEvalReport['topics'] = [];
  let totalCandidates = 0;
  let totalLatency = 0;
  let licenseOkCount = 0;
  let resolvedWithCandidates = 0;
  const providerHits: Record<string, number> = {};

  for (let i = 0; i < GOLDEN_TOPICS.length; i++) {
    const topic = GOLDEN_TOPICS[i];
    console.log(`[*] [${i + 1}/${GOLDEN_TOPICS.length}] Resolving: "${topic}"`);
    const { candidates, provenance } = await resolveImageCandidates(topic, `eval_scene_${i + 1}`, 3);

    for (const p of provenance) {
      if (p.count > 0) providerHits[p.provider] = (providerHits[p.provider] || 0) + 1;
    }

    const licenseOk = candidates.every(
      (c) => c.license === 'PUBLIC_DOMAIN' || c.license === 'CC0' || c.license === 'CC_BY_4_0' || c.license === 'CC_BY_SA_4_0'
    );
    if (licenseOk) licenseOkCount++;
    if (candidates.length > 0) resolvedWithCandidates++;

    totalCandidates += candidates.length;
    totalLatency += provenance.reduce((s, p) => s + p.latencyMs, 0);

    topics.push({
      topic,
      candidates: candidates.length,
      latencyMs: provenance.reduce((s, p) => s + p.latencyMs, 0),
      provenance,
      licenseOk,
    });
    console.log(`      -> ${candidates.length} candidates | license ok: ${licenseOk ? 'YES' : 'NO'} | ${provenance.map((p) => `${p.provider}:${p.count}`).join(', ')}`);
  }

  const licenseComplianceRate = topics.length > 0 ? (licenseOkCount / topics.length) * 100 : 0;
  const avgLatencyMs = topics.length > 0 ? Math.round(totalLatency / topics.length) : 0;
  const qualityStatus = licenseComplianceRate === 100 && resolvedWithCandidates >= GOLDEN_TOPICS.length ? 'PASS' : 'FAIL';

  const report: ResearchEvalReport = {
    timestamp: new Date().toISOString(),
    chainName: 'research-agent',
    onlineKeysPresent,
    providerChain: chain.map((p) => p.name),
    preflight,
    totalTopics: GOLDEN_TOPICS.length,
    totalCandidates,
    avgLatencyMs,
    licenseComplianceRate,
    topicsResolvedWithCandidates: resolvedWithCandidates,
    providerHitDistribution: providerHits,
    qualityStatus,
    topics,
  };

  const reportsDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const reportPath = path.join(reportsDir, 'research-agent-eval-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n----------------------------------------------------------------');
  console.log(' RESEARCH AGENT EVAL SUMMARY:');
  console.log(`- Provider chain            : ${report.providerChain.join(' -> ')}`);
  console.log(`- Online keys present       : ${onlineKeysPresent.length > 0 ? onlineKeysPresent.join(', ') : 'NONE'}`);
  console.log(`- Topics resolved           : ${resolvedWithCandidates}/${GOLDEN_TOPICS.length}`);
  console.log(`- Total candidates          : ${totalCandidates}`);
  console.log(`- Avg latency               : ${avgLatencyMs} ms`);
  console.log(`- License compliance        : ${licenseComplianceRate.toFixed(1)}% (target 100%)`);
  console.log(`- Provider hit distribution : ${JSON.stringify(providerHits)}`);
  console.log(`- Quality status            : ${qualityStatus === 'PASS' ? '[+] PASS' : '[!] FAIL'}`);
  console.log(`- Report                    : file:///${reportPath.replace(/\\/g, '/')}`);
  console.log('----------------------------------------------------------------\n');

  return report;
}

if (process.argv[1] && (process.argv[1].endsWith('research-runner.ts') || process.argv[1].endsWith('research-runner.js'))) {
  runResearchEval({ verbose: true })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[!] Research Agent Eval Error:', err);
      process.exit(1);
    });
}
