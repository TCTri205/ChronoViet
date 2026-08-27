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
  generateMarkdownReport,
  printCliSummaryTable,
  ensureDirectory,
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
}

export async function runChatbotEvaluation(options: RunChatbotEvalOptions = {}): Promise<BaseSuiteReport<ChatbotCaseResult>> {
  const startTime = new Date();
  const startTimeMs = Date.now();

  console.log('\n🚀 Starting ChronoViet Chatbot & GraphRAG Evaluation Suite...');

  // 1. Preflight Health Checks
  const preflight = await assertEvalPreflight(['postgres', 'embedding', 'llm']);

  // 2. Load Test Cases
  const datasetPath = path.resolve(__dirname, 'datasets/chatbot-test-cases.json');
  const rawData = fs.readFileSync(datasetPath, 'utf-8');
  const allDatasetCases: ChatbotTestCase[] = JSON.parse(rawData);
  const datasetTotalCases = allDatasetCases.length;
  let testCases: ChatbotTestCase[] = [...allDatasetCases];

  if (options.category) {
    const cat = options.category.toUpperCase();
    testCases = testCases.filter((tc) => tc.category.toUpperCase() === cat);
    console.log(`Filtered by category "${cat}": ${testCases.length} test cases remaining.`);
  }

  if (options.limit && options.limit > 0) {
    testCases = testCases.slice(0, options.limit);
    console.log(`Applied limit: running ${testCases.length} test cases.`);
  }

  const isSubset = testCases.length < datasetTotalCases;

  const outputsDir = path.resolve(__dirname, 'outputs');
  const reportsDir = path.resolve(__dirname, 'reports');
  ensureDirectory(outputsDir);
  ensureDirectory(reportsDir);

  const caseResults: ChatbotCaseResult[] = [];

  // 3. Execute Each Test Case
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
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
          error: err.message || String(err),
        });
      }
    }

    // Evaluate single test case
    const caseResult = evaluateChatbotCase(tc, executedTurns);
    caseResults.push(caseResult);

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
    },
    outputArtifactsDir: outputsDir,
  };

  // 5. Save Report Artifacts in reports/
  const reportJsonPath = path.join(reportsDir, 'chatbot-eval-report.json');
  const reportMdPath = path.join(reportsDir, 'chatbot-eval-report.md');
  suiteReport.reportFilePath = reportJsonPath;

  saveJsonArtifact(reportJsonPath, suiteReport);
  const mdContent = generateMarkdownReport(suiteReport);
  fs.writeFileSync(reportMdPath, mdContent, 'utf-8');

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

  const strict = args.includes('--strict');
  const verbose = args.includes('--verbose');

  runChatbotEvaluation({ limit, category, strict, verbose })
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
