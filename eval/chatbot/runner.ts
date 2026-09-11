/**
 * ChronoViet Chatbot Evaluation Suite Runner
 * Executes live multi-turn historical queries against handleChatQueryStream + Real RAG,
 * dumps raw execution artifacts to outputs/, and generates evaluation reports to reports/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertEvalPreflight } from '@chronoviet/infra';
import { handleChatQueryStream, ChatTurnContext } from '@chronoviet/agent-orchestrator';
import {
  saveJsonArtifact,
  saveSuiteEvaluationReport,
  generateMarkdownReport,
  printCliSummaryTable,
  ensureDirectory,
  cleanDirectory,
  BaseSuiteReport,
} from '../shared/index.js';
import {
  ChatbotTestCase,
  ChatbotTurnExecution,
  ChatbotCaseResult,
  evaluateChatbotCase,
  computeChatbotAggregatedMetrics,
} from './metrics/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface RunChatbotEvalOptions {
  limit?: number;
  category?: string;
  strict?: boolean;
  verbose?: boolean;
  concurrency?: number;
  suite?: 'core' | 'adversarial' | 'deep' | 'all' | string;
  clean?: boolean;
  id?: string;
  match?: string;
}

export async function runChatbotEvaluation(options: RunChatbotEvalOptions = {}): Promise<BaseSuiteReport<ChatbotCaseResult>> {
  const startTime = new Date();
  const startTimeMs = Date.now();

  const suiteName = (options.suite || 'core').toLowerCase();
  console.log(`\n🚀 Starting ChronoViet Chatbot Evaluation Suite: [${suiteName.toUpperCase()}]...`);

  // 1. Preflight Health Checks
  const preflight = await assertEvalPreflight(['postgres', 'embedding', 'llm']);

  // 2. Load Test Cases based on selected suite
  const corePath = path.resolve(__dirname, 'datasets/chatbot-core.json');
  const legacyPath = path.resolve(__dirname, 'datasets/chatbot-test-cases.json');
  const advPath = path.resolve(__dirname, 'datasets/chatbot-adversarial.json');
  const deepPath = path.resolve(__dirname, 'datasets/chatbot-deep-analysis.json');

  const loadFile = (p: string): ChatbotTestCase[] => {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
    return [];
  };

  let allDatasetCases: ChatbotTestCase[] = [];
  if (suiteName === 'core') {
    allDatasetCases = fs.existsSync(corePath) ? loadFile(corePath) : loadFile(legacyPath);
  } else if (suiteName === 'adversarial' || suiteName === 'adv') {
    allDatasetCases = loadFile(advPath);
  } else if (suiteName === 'deep' || suiteName === 'analysis') {
    allDatasetCases = loadFile(deepPath);
  } else if (suiteName === 'all') {
    const core = fs.existsSync(corePath) ? loadFile(corePath) : loadFile(legacyPath);
    const adv = loadFile(advPath);
    const deep = loadFile(deepPath);
    allDatasetCases = [...core, ...adv, ...deep];
  } else {
    const customPath = path.resolve(__dirname, 'datasets', `chatbot-${suiteName}.json`);
    if (fs.existsSync(customPath)) {
      allDatasetCases = loadFile(customPath);
    } else {
      console.warn(`⚠️ Unknown suite "${suiteName}", falling back to core.`);
      allDatasetCases = fs.existsSync(corePath) ? loadFile(corePath) : loadFile(legacyPath);
    }
  }

  const datasetTotalCases = allDatasetCases.length;
  let testCases: ChatbotTestCase[] = [...allDatasetCases];

  if (options.id) {
    const targetId = options.id.trim();
    testCases = testCases.filter((tc) => tc.id === targetId);
    console.log(`Filtered by ID "${targetId}": ${testCases.length} test cases remaining.`);
  }

  if (options.match) {
    const query = options.match.toLowerCase();
    testCases = testCases.filter(
      (tc) =>
        tc.id.toLowerCase().includes(query) ||
        tc.title.toLowerCase().includes(query) ||
        tc.turns.some((t) => t.toLowerCase().includes(query))
    );
    console.log(`Filtered by pattern "${options.match}": ${testCases.length} test cases remaining.`);
  }

  if (options.category) {
    const cat = options.category.toUpperCase();
    testCases = testCases.filter((tc) => tc.category.toUpperCase() === cat);
    console.log(`Filtered by category "${cat}": ${testCases.length} test cases remaining.`);
  }

  if (options.limit && options.limit > 0) {
    testCases = testCases.slice(0, options.limit);
    console.log(`Applied limit: running ${testCases.length} test cases.`);
  }

  const isSubset =
    testCases.length < datasetTotalCases ||
    Boolean(options.id) ||
    Boolean(options.match) ||
    Boolean(options.category) ||
    Boolean(options.limit);

  const outputsDir = path.resolve(__dirname, 'outputs', suiteName);
  const reportsDir = path.resolve(__dirname, 'reports');

  if (options.clean) {
    cleanDirectory(outputsDir);
    console.log(`Cleaned outputs directory: ${outputsDir}`);
  } else {
    ensureDirectory(outputsDir);
  }
  ensureDirectory(reportsDir);

  const concurrency = Math.max(1, options.concurrency ?? 1);
  console.log(`Execution Mode: Concurrency = ${concurrency}`);

  const caseResults: ChatbotCaseResult[] = [];

  const executeTestCase = async (tc: ChatbotTestCase, i: number): Promise<ChatbotCaseResult> => {
    console.log(`\n[${i + 1}/${testCases.length}] Running: ${tc.id} — "${tc.title}" (${tc.category})`);

    const turnHistory: ChatTurnContext[] = [];
    const executedTurns: ChatbotTurnExecution[] = [];

    for (let tIdx = 0; tIdx < tc.turns.length; tIdx++) {
      const userQuery = tc.turns[tIdx];
      const turnStart = Date.now();
      let firstTokenTime: number | null = null;
      let detectedIntent: string | undefined;
      const tokens: string[] = [];
      const citations: any[] = [];

      try {
        const stream = handleChatQueryStream({
          query: userQuery,
          conversationId: `eval_${tc.id}_conv`,
          history: turnHistory,
        });

        for await (const chunk of stream) {
          if (chunk.type === 'intent') {
            detectedIntent = chunk.intent;
          } else if (chunk.type === 'token') {
            if (firstTokenTime === null) {
              firstTokenTime = Date.now();
            }
            const tokenStr = chunk.content || '';
            tokens.push(tokenStr);
            if (options.verbose && tokenStr) {
              process.stdout.write(tokenStr);
            }
          } else if (chunk.type === 'citation') {
            citations.push(...(chunk.citations || []));
          } else if (chunk.type === 'error') {
            throw new Error(chunk.error);
          }
        }

        const turnDuration = Date.now() - turnStart;
        const ttftMs = firstTokenTime ? firstTokenTime - turnStart : turnDuration;
        const fullResponseText = tokens.join('');
        const tokensPerSec = turnDuration > 0 ? Math.round((tokens.length / (turnDuration / 1000)) * 10) / 10 : 0;

        executedTurns.push({
          turnIndex: tIdx + 1,
          query: userQuery,
          detectedIntent,
          responseTokens: tokens,
          fullResponseText,
          citations,
          ttftMs,
          totalDurationMs: turnDuration,
          tokensPerSec,
        });

        turnHistory.push({
          role: 'user',
          content: userQuery,
        });
        turnHistory.push({
          role: 'assistant',
          content: fullResponseText,
        });
      } catch (err: any) {
        const turnDuration = Date.now() - turnStart;
        const errObj = err as Error;
        executedTurns.push({
          turnIndex: tIdx + 1,
          query: userQuery,
          detectedIntent,
          responseTokens: tokens,
          fullResponseText: tokens.join(''),
          citations,
          ttftMs: 0,
          totalDurationMs: turnDuration,
          tokensPerSec: 0,
          error: errObj?.message || String(err),
          stack: errObj?.stack,
        });
      }
    }

    // Evaluate single test case
    const caseResult = evaluateChatbotCase(tc, executedTurns);

    // Save per-case raw execution artifact in outputs/
    const artifactPath = path.join(outputsDir, `${tc.id}.json`);
    saveJsonArtifact(artifactPath, {
      testCase: tc,
      result: caseResult,
      executedAt: new Date().toISOString(),
    });

    const statusMark = caseResult.passed ? '✅ PASSED' : '❌ FAILED';
    console.log(`  └─ Status: ${statusMark} | TTFT: ${caseResult.meanTtftMs}ms | Total Time: ${caseResult.durationMs}ms`);
    if (caseResult.errors && caseResult.errors.length > 0) {
      console.log(`     Errors: ${caseResult.errors.join('; ')}`);
    }

    return caseResult;
  };

  // 3. Execute Cases with Controlled Concurrency
  if (concurrency <= 1) {
    for (let i = 0; i < testCases.length; i++) {
      const res = await executeTestCase(testCases[i], i);
      caseResults.push(res);
    }
  } else {
    let nextIndex = 0;
    const workers = Array.from({ length: Math.min(concurrency, testCases.length) }, async () => {
      while (nextIndex < testCases.length) {
        const i = nextIndex++;
        const res = await executeTestCase(testCases[i], i);
        caseResults.push(res);
      }
    });
    await Promise.all(workers);
  }

  // 4. Compute Summary Metrics
  const aggregated = computeChatbotAggregatedMetrics(caseResults);
  const endTime = new Date();
  const durationMs = Date.now() - startTimeMs;
  const allPassed = Object.values(aggregated.metricScores).every((m) => m.pass);

  const suiteReport: BaseSuiteReport<ChatbotCaseResult> = {
    title: 'Chatbot & GraphRAG Historical Dialogue Benchmark',
    suite: 'CHATBOT',
    timestamp: startTime.toISOString(),
    totalCases: testCases.length,
    datasetTotalCases,
    isSubset,
    appliedFilters: {
      limit: options.limit,
      category: options.category,
      strict: options.strict,
      id: options.id,
      match: options.match,
    },
    passedCases: aggregated.passedCases,
    failedCases: testCases.length - aggregated.passedCases,
    passRate: testCases.length > 0 ? aggregated.passedCases / testCases.length : 0,
    allPassed,
    metrics: aggregated.metricScores,
    caseResults,
    metadata: {
      suite: 'CHATBOT',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMs,
      strict: options.strict ?? false,
      preflight,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh',
      localTime: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      platform: `${process.platform}-${process.arch}`,
      nodeVersion: process.version,
    },
    outputArtifactsDir: outputsDir,
  };

  // 5. Save Report Artifacts in reports/ (Canonical vs Subset + History Archiving)
  const reportSuffix = suiteName === 'core' ? '' : `-${suiteName}`;
  const baseFileName = `chatbot-eval-report${reportSuffix}`;

  saveSuiteEvaluationReport({
    report: suiteReport,
    reportsDir,
    baseFileName,
    archiveHistory: true,
  });

  printCliSummaryTable(suiteReport);

  return suiteReport;
}

// Standalone CLI execution
if (process.argv[1] && (process.argv[1] === __filename || process.argv[1].endsWith('eval/chatbot/runner.ts'))) {
  const args = process.argv.slice(2);
  const limitArgIdx = args.indexOf('--limit');
  const limit = limitArgIdx !== -1 ? parseInt(args[limitArgIdx + 1], 10) : undefined;

  const catArgIdx = args.indexOf('--category');
  const category = catArgIdx !== -1 ? args[catArgIdx + 1] : undefined;

  const concArgIdx = args.indexOf('--concurrency');
  const concurrency = concArgIdx !== -1 ? parseInt(args[concArgIdx + 1], 10) : undefined;

  const strict = args.includes('--strict');
  const verbose = args.includes('--verbose');
  const clean = args.includes('--clean');

  const idArgIdx = args.findIndex((a) => a === '--id' || a.startsWith('--id='));
  let id: string | undefined;
  if (idArgIdx !== -1) {
    id = args[idArgIdx].includes('=') ? args[idArgIdx].split('=')[1] : args[idArgIdx + 1];
  }

  const matchArgIdx = args.findIndex((a) => a === '--match' || a.startsWith('--match='));
  let match: string | undefined;
  if (matchArgIdx !== -1) {
    match = args[matchArgIdx].includes('=') ? args[matchArgIdx].split('=')[1] : args[matchArgIdx + 1];
  }

  const suiteArgIdx = args.findIndex((a) => a === '--suite' || a.startsWith('--suite='));
  let suite: string | undefined;
  if (suiteArgIdx !== -1) {
    if (args[suiteArgIdx].includes('=')) {
      suite = args[suiteArgIdx].split('=')[1];
    } else {
      suite = args[suiteArgIdx + 1];
    }
  } else if (args.includes('--all')) {
    suite = 'all';
  } else if (args.includes('--adversarial') || args.includes('--adv')) {
    suite = 'adversarial';
  } else if (args.includes('--deep') || args.includes('--analysis')) {
    suite = 'deep';
  } else if (args.includes('--core')) {
    suite = 'core';
  }

  runChatbotEvaluation({ limit, category, strict, verbose, concurrency, suite, clean, id, match })
    .then((report) => {
      if (!report.allPassed && strict) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('Chatbot evaluation runner failed:', err);
      process.exit(1);
    });
}
