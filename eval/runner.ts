import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { runVieNeuRemotionChain, IntegratedChainReport } from './chains/vieneu-remotion';
import { runIngestRagChain, ProductionRagQualityReport } from './chains/ingest-rag';
import { cleanEvalArtifacts } from './utils/cleaner';
import { envConfig, createLogger } from '../packages/shared-spec/src/index.js';

const log = createLogger({ service: 'eval-runner' });

interface MasterEvalReport {
  timestamp: string;
  mode: string;
  isolatedModulesEvaluated: string[];
  chainsEvaluated: string[];
  chainReports: Record<string, IntegratedChainReport | ProductionRagQualityReport>;
  overallStatus: 'PASS' | 'FAIL';
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  let mode: 'all' | 'chain' | 'module' = 'chain'; // Default to chain integration
  let chainName: string | undefined = 'vieneu-remotion';
  let moduleName: string | undefined;
  let testCaseName: string | undefined;
  let noStudio = false;
  let verbose = false;
  let port: string | undefined;
  let cleanOnly = false;
  let fresh = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--chain' && i + 1 < args.length) {
      mode = 'chain';
      chainName = args[++i];
    } else if (arg === '--module' && i + 1 < args.length) {
      mode = 'module';
      moduleName = args[++i];
    } else if (arg === '--all') {
      mode = 'all';
    } else if ((arg === '-t' || arg === '--testCase') && i + 1 < args.length) {
      testCaseName = args[++i];
    } else if (arg === '--no-studio' || arg === '--ci') {
      noStudio = true;
    } else if ((arg === '-p' || arg === '--port') && i + 1 < args.length) {
      port = args[++i];
    } else if (arg === '-v' || arg === '--verbose') {
      verbose = true;
    } else if (arg === '--clean') {
      cleanOnly = true;
    } else if (arg === '--fresh') {
      fresh = true;
    }
  }

  return { mode, chainName, moduleName, testCaseName, noStudio, verbose, port, cleanOnly, fresh };
}

async function main() {
  const { mode, chainName, moduleName, testCaseName, noStudio, verbose, port, cleanOnly, fresh } = parseCliArgs();

  // If user passed --clean, run cleaner and exit
  if (cleanOnly) {
    cleanEvalArtifacts({ verbose: true, port: port ? parseInt(port, 10) : envConfig.REMOTION_PORT });
    process.exit(0);
  }

  // Pre-eval cleanup lifecycle (Always run pre-clean when --fresh, or when running --all)
  if (fresh || mode === 'all') {
    cleanEvalArtifacts({ verbose, port: port ? parseInt(port, 10) : envConfig.REMOTION_PORT });
  }

  const reportsDir = path.resolve(process.cwd(), 'eval/reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  console.log('\n================================================================');
  console.log(' CHRONOVIET GLOBAL EVALUATION RUNNER');
  console.log(' Quy chuan: 1 Kich ban - Zero Screenshot - Mo Remotion Studio o buoc cuoi');
  console.log('================================================================');
  console.log(` [*] Mode: ${mode.toUpperCase()}`);

  const isolatedModules: string[] = [];
  const chainsEvaluated: string[] = [];
  const chainReports: Record<string, IntegratedChainReport | ProductionRagQualityReport> = {};
  let overallPass = true;

  // 1. Module-level isolated evals (only if --all or --module)
  if (mode === 'all' || mode === 'module') {
    const targetModules = moduleName
      ? [moduleName]
      : ['@chronoviet/data-ingestion', '@chronoviet/rag-engine', '@chronoviet/vieneu-tts', '@chronoviet/remotion-engine'];

    console.log('\n--- [PHASE 1] RUNNING ISOLATED MODULE EVALUATIONS ---');

    for (const mod of targetModules) {
      console.log(`\n[*] Executing isolated eval for module: ${mod}...`);
      try {
        execSync(`pnpm --filter ${mod} eval${noStudio ? ' -- --ci' : ''}${fresh ? ' -- --fresh' : ''}`, {
          stdio: 'inherit',
        });
        isolatedModules.push(mod);
        console.log(`[+] Module ${mod} eval PASSED.`);
      } catch (err) {
        console.error(`[!] Module ${mod} eval FAILED.`);
        log.error('eval.module_failed', 'Isolated module eval failed', { module: mod, error: err });
        overallPass = false;
      }
    }
  }

  // 2. Integration Chain Evals
  if (mode === 'all' || mode === 'chain') {
    const targetChains = chainName
      ? [chainName]
      : ['ingest-rag', 'vieneu-remotion'];

    console.log('\n--- [PHASE 2] RUNNING MULTI-MODULE INTEGRATION CHAINS ---');

    for (const chain of targetChains) {
      if (chain === 'ingest-rag') {
        try {
          const report = await runIngestRagChain({ verbose });
          chainsEvaluated.push(chain);
          chainReports[chain] = report;
          if (report.qualityStatus !== 'PASS') {
            overallPass = false;
          }
        } catch (err) {
          console.error(`[!] Chain ${chain} FAILED:`, err);
          log.error('eval.chain_failed', 'Integration chain eval failed', { chain, error: err });
          overallPass = false;
        }
      } else if (chain === 'vieneu-remotion') {
        try {
          const report = await runVieNeuRemotionChain({
            testCaseName,
            openStudio: !noStudio,
            verbose,
            port,
            cleanBeforeRun: fresh,
          });
          chainsEvaluated.push(chain);
          chainReports[chain] = report;
          if (!report.schemaValid) {
            overallPass = false;
          }
        } catch (err) {
          console.error(`[!] Chain ${chain} FAILED:`, err);
          log.error('eval.chain_failed', 'Integration chain eval failed', { chain, error: err });
          overallPass = false;
        }
      } else {
        console.warn(`[!] Unknown chain specified: ${chain}`);
        log.warn('eval.unknown_chain', 'Unknown chain specified', { chain });
      }
    }
  }

  // 3. Output Global Summary
  const globalReport: MasterEvalReport = {
    timestamp: new Date().toISOString(),
    mode,
    isolatedModulesEvaluated: isolatedModules,
    chainsEvaluated,
    chainReports,
    overallStatus: overallPass ? 'PASS' : 'FAIL',
  };

  const masterReportPath = path.join(reportsDir, 'global-eval-report.json');
  fs.writeFileSync(masterReportPath, JSON.stringify(globalReport, null, 2));

  console.log('\n================================================================');
  console.log(` MASTER EVALUATION COMPLETED: ${overallPass ? '[+] PASS' : '[!] FAIL'}`);
  console.log(` File Report global: file:///${masterReportPath.replace(/\\/g, '/')}`);
  console.log('================================================================\n');

  if (!overallPass) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[!] Master Runner Fatal Error:', err);
  log.error('eval.fatal_error', 'Master Runner Fatal Error', { error: err });
  process.exit(1);
});
