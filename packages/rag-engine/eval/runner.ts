/**
 * Chrono-RAG Engine Benchmark Evaluation Runner
 */

import fs from 'fs';
import path from 'path';
import { ChronoRagEngine } from '../src/rag-engine.js';
import { inMemoryStore } from '../src/db/client.js';
import { TestCase, evaluateResponse, calculateAggregateReport } from './metrics.js';

// Historical Knowledge Base Seeds for Benchmark Execution
const SAMPLE_HISTORICAL_DOCUMENTS = [
  {
    title: 'Trận Ngọc Hồi - Đống Đa năm 1789',
    source: 'Đại Việt Sử Ký Toàn Thư (Tập 3)',
    dynasty: 'Nhà Tây Sơn',
    sourceReliability: 'LEVEL_1' as const,
    content: `Trận Ngọc Hồi - Đống Đa năm 1789 là một trong những trận chiến hiển hách nhất trong lịch sử chống ngoại xâm của dân tộc Việt Nam. 
Đại đế Quang Trung (tên thật là Nguyễn Huệ, còn gọi là Hồ Thơm hay Bắc Bình Vương) đã trực tiếp cầm quân, chỉ huy quân Tây Sơn thần tốc ra Bắc đánh tan 29 vạn quân Thanh. 
Trận đánh diễn ra tại Hà Nội (Ngọc Hồi, Đống Đa, Thăng Long) khiến tướng nhà Thanh là Sầm Nghi Đống phải thắt cổ tự tử, Tôn Sĩ Nghị tháo chạy về nước.`,
  },
  {
    title: 'Hưng Đạo Đại Vương Trần Quốc Tuấn và 3 lần đại thắng Nguyên Mông',
    source: 'Đại Việt Sử Ký Toàn Thư (Tập 2)',
    dynasty: 'Nhà Trần',
    sourceReliability: 'LEVEL_1' as const,
    content: `Trần Hưng Đạo tên thật là Trần Quốc Tuấn, tước hiệu Hưng Đạo Đại Vương, còn được nhân dân tôn kính là Đức Thánh Trần. 
Ông là nhà quân sự thiên tài thời Nhà Trần, giữ chức Quốc công Tiết chế tổng chỉ huy quân đội Đại Việt trong hai cuộc kháng chiến chống quân Nguyên Mông năm 1285 và 1288. 
Ông nổi tiếng với tác phẩm Hịch Tướng Sĩ và chiến thắng lẫy lừng trên sông Bạch Đằng năm 1288 tại Quảng Yên, Thăng Long.`,
  },
  {
    title: 'Lê Lợi và Cuộc khởi nghĩa Lam Sơn',
    source: 'Lam Sơn Thực Lục',
    dynasty: 'Nhà Lê',
    sourceReliability: 'LEVEL_1' as const,
    content: `Lê Lợi (sau là Lê Thái Tổ, danh xưng Bình Định Vương) là người lãnh đạo cuộc khởi nghĩa Lam Sơn bùng nổ năm 1418 tại Thanh Hóa. 
Dưới sự cố vấn của Nguyễn Trãi, quân Lam Sơn đã tiến hành cuộc kháng chiến trường kỳ 10 năm, đánh bại quân Minh tại Tốt Động - Chúc Động và Chi Lăng - Xương Giang. 
Năm 1428, Lê Lợi chính thức lên ngôi Hoàng đế tại Thăng Long, thành lập triều đại Nhà Lê (Lê Sơ).`,
  },
  {
    title: 'Ngô Quyền và Chiến thắng Sông Bạch Đằng năm 938',
    source: 'Việt Sử Lược',
    dynasty: 'Nhà Ngô',
    sourceReliability: 'LEVEL_1' as const,
    content: `Ngô Quyền (Tiền Ngô Vương) là người lãnh đạo quân dân Đại Việt đánh tan quân xâm lược Nam Hán trên sông Bạch Đằng vào năm 938. 
Ông đã nảy ra sáng kiến dùng cọc gỗ bọc sắt cắm xuống lòng sông Bạch Đằng, lợi dụng thủy triều lên xuống để nhử chiến thuyền địch vào bãi cọc. 
Chiến thắng này đã chính thức chấm dứt hơn 1000 năm Bắc thuộc, mở ra thời kỳ độc lập tự chủ lâu dài cho dân tộc.`,
  },
  {
    title: 'Trống đồng Đông Sơn và Văn hóa Đông Sơn',
    source: 'Bảo tàng Lịch sử Quốc gia',
    dynasty: 'Văn Lang',
    sourceReliability: 'LEVEL_1' as const,
    content: `Trống đồng Đông Sơn đại diện tiêu biểu cho Kỷ nguyên đồ đồng và Văn hóa Đông Sơn thời kỳ Văn Lang - Âu Lạc tại Thanh Hóa. 
Bảo vật quốc gia này nổi bật với các họa tiết đúc nổi tinh xảo như chim Lạc, hình thuyền, người giã gạo và ngôi sao 14 cánh ở tâm trống.`,
  },
  {
    title: 'Vụ án Lệ Chi Viên và Nguyễn Trãi',
    source: 'Đại Việt Sử Ký Toàn Thư',
    dynasty: 'Nhà Lê',
    sourceReliability: 'LEVEL_1' as const,
    content: `Nguyễn Trãi (hiệu Ức Trai) là danh nhân văn hóa thế giới, đại công thần triều Nhà Lê. 
Năm 1442, ông và gia quyến vướng vào thảm án Lệ Chi Viên (vườn vải) sau cái chết đột ngột của vua Lê Thái Tông. 
Đến thời vua Lê Thánh Tông năm 1464, Nguyễn Trãi đã được chính thức minh oan và ban tước hiệu cao quý.`,
  },
];

export async function runChronoRagEval() {
  console.log('=== [Chrono-RAG Engine Evaluation Runner] ===');
  console.log('Fact Precision Target: > 99.2%');
  console.log('Hallucination Rate Target: < 0.8%');
  console.log('Citation Traceability Target: 100%');
  console.log('--------------------------------------------------\n');

  const ragEngine = new ChronoRagEngine();

  // 1. Ingest Benchmark Data
  inMemoryStore.clear();
  console.log('[*] Pre-populating benchmark knowledge base...');
  for (const doc of SAMPLE_HISTORICAL_DOCUMENTS) {
    await ragEngine.ingestDocument(doc.content, {
      title: doc.title,
      source: doc.source,
      dynasty: doc.dynasty,
      sourceReliability: doc.sourceReliability,
    });
  }
  console.log('[+] Knowledge base populated successfully.\n');

  // 2. Load Test Dataset
  const datasetPath = path.resolve(__dirname, 'datasets/chronoeval-1000.json');
  const testCases: TestCase[] = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));

  console.log(`[*] Executing search benchmark over ${testCases.length} test cases...`);
  const itemResults = [];

  for (const tc of testCases) {
    const response = await ragEngine.search({
      query: tc.question,
      rerankTopK: 5,
    });
    const evalRes = evaluateResponse(tc, response);
    itemResults.push(evalRes);
    console.log(
      `  [${evalRes.passed ? 'PASS' : 'FAIL'}] Test ${tc.id} (${tc.domain}): Fact Precision = ${evalRes.factPrecision}% | Latency = ${evalRes.latencyMs}ms`
    );
  }

  // 3. Compute Aggregates & Build Report
  const aggregateReport = calculateAggregateReport(itemResults);

  console.log('\n==================================================');
  console.log(` AGGREGATE BENCHMARK RESULTS (${aggregateReport.kpiStatus.overallPassed ? 'PASS' : 'FAIL'})`);
  console.log('==================================================');
  console.log(` - Total Evaluated:               ${aggregateReport.totalEvaluated}`);
  console.log(` - Avg Fact Precision Score:       ${aggregateReport.avgFactPrecision}% (Target: > 99.2%)`);
  console.log(` - Avg Hallucination Rate:         ${aggregateReport.avgHallucinationRate}% (Target: < 0.8%)`);
  console.log(` - Citation Traceability:          ${aggregateReport.citationTraceabilityPercent}% (Target: 100%)`);
  console.log(` - Avg Retrieval Latency:          ${aggregateReport.avgLatencyMs}ms (Target: < 300ms)`);
  console.log('==================================================\n');

  // 4. Save JSON Report
  const reportsDir = path.resolve(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  const reportPath = path.join(reportsDir, 'chronoeval-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(aggregateReport, null, 2));

  console.log(`[+] Benchmark evaluation report written to: file:///${reportPath.replace(/\\/g, '/')}`);

  if (!aggregateReport.kpiStatus.overallPassed) {
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('runner.ts')) {
  runChronoRagEval().catch((err) => {
    console.error('[!] Benchmark Runner Fatal Error:', err);
    process.exit(1);
  });
}
