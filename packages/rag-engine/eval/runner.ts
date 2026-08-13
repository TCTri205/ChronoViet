if (process.env.FORCE_OFFLINE === undefined) {
  process.env.FORCE_OFFLINE = 'true';
}

/**
 * Chrono-RAG Engine Benchmark Evaluation Runner
 */

import fs from 'fs';
import path from 'path';
import { ChronoRagEngine } from '../src/rag-engine.js';
import { inMemoryStore } from '@chronoviet/shared-spec';
import { TestCase, evaluateResponse, calculateAggregateReport } from './metrics.js';

function findMonorepoRoot(startDir: string = __dirname): string {
  let currentDir = path.resolve(startDir);
  while (currentDir !== path.parse(currentDir).root) {
    if (fs.existsSync(path.join(currentDir, 'pnpm-workspace.yaml'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  return path.resolve(__dirname, '../../..');
}

// Historical Knowledge Base Seeds for Benchmark Execution
const SAMPLE_HISTORICAL_DOCUMENTS = [
  {
    title: 'Trận Ngọc Hồi - Đống Đa năm 1789',
    source: 'Đại Việt Sử Ký Toàn Thư (Tập 3)',
    dynasty: 'Nhà Tây Sơn',
    sourceReliability: 'LEVEL_1' as const,
    content: `Trận Ngọc Hồi - Đống Đa năm 1789 là một trong những trận chiến hiển hách nhất trong lịch sử chống ngoại xâm của dân tộc Việt Nam. 
Đại đế Quang Trung (tên thật là Nguyễn Huệ, còn gọi là Hồ Thơm hay Bắc Bình Vương) đã trực tiếp cầm quân, chỉ huy quân Tây Sơn thần tốc ra Bắc đánh tan 29 vạn quân Thanh tại Hà Nội (Ngọc Hồi, Đống Đa, Thăng Long). 
Sự kiện diễn ra vào dịp Tết Kỷ Dậu 1789, khiến tướng nhà Thanh là Sầm Nghi Đống phải thắt cổ tự tử, Tôn Sĩ Nghị tháo chạy về nước.`,
  },
  {
    title: 'Hưng Đạo Đại Vương Trần Quốc Tuấn và 3 lần đại thắng Nguyên Mông',
    source: 'Đại Việt Sử Ký Toàn Thư (Tập 2)',
    dynasty: 'Nhà Trần',
    sourceReliability: 'LEVEL_1' as const,
    content: `Trần Hưng Đạo tên thật là Trần Quốc Tuấn, tước hiệu Hưng Đạo Đại Vương, còn được nhân dân tôn kính là Đức Thánh Trần. 
Ông là nhà quân sự thiên tài thời Nhà Trần, giữ chức Quốc công Tiết chế tổng chỉ huy quân đội Đại Việt trong các cuộc kháng chiến chống quân Nguyên Mông năm 1285 và 1288. 
Ông nổi tiếng với tác phẩm Hịch Tướng Sĩ và chiến thắng lẫy lừng trên sông Bạch Đằng năm 1288 tại Thăng Long.`,
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
    content: `Trống đồng Đông Sơn và Trống đồng Ngọc Lũ đại diện tiêu biểu cho Kỷ nguyên đồ đồng và Văn hóa Đông Sơn thời kỳ Văn Lang - Âu Lạc tại Thanh Hóa và Hà Nam. 
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
  // Distractor & Additional Benchmark Documents (Breaks Closed-loop Overfitting)
  {
    title: 'Chiếu dời đô và sự kiện thành lập Thăng Long năm 1010',
    source: 'Đại Việt Sử Ký Toàn Thư',
    dynasty: 'Nhà Lý',
    sourceReliability: 'LEVEL_1' as const,
    content: `Năm 1010, vua Lý Thái Tổ (tên thật Lý Công Uẩn) ban Chiếu dời đô quyết định chuyển kinh đô từ Hoa Lư (Ninh Bình) về Đại La và đổi tên thành Thăng Long (Hà Nội ngày nay). Sự kiện đánh dấu bước phát triển rực rỡ của nền độc lập Đại Việt dưới triều Nhà Lý.`,
  },
  {
    title: 'Chiến dịch Điện Biên Phủ năm 1954',
    source: 'Lịch sử Quân đội Nhân dân Việt Nam',
    dynasty: 'Hiện đại',
    sourceReliability: 'LEVEL_1' as const,
    content: `Chiến dịch Điện Biên Phủ diễn ra năm 1954 dưới sự chỉ huy trực tiếp của Đại tướng Võ Nguyên Giáp (Anh Văn). Chiến thắng lẫy lừng "lừng lẫy năm châu, chấn động địa cầu" đã kết thúc 9 năm kháng chiến chống thực dân Pháp.`,
  },
  {
    title: 'Hiệp định Genève năm 1954',
    source: 'Lịch sử Ngoại giao Việt Nam',
    dynasty: 'Hiện đại',
    sourceReliability: 'LEVEL_1' as const,
    content: `Hiệp định Genève được ký kết năm 1954 tại Thụy Sĩ chấm dứt chiến tranh, khôi phục hòa bình ở Đông Dương. Đoàn đại biểu Việt Nam Dân chủ Cộng hòa do Thứ trưởng Bộ Quốc phòng kiêm Quyền Bộ trưởng Bộ Ngoại giao Phạm Văn Đồng dẫn đầu.`,
  },
  {
    title: 'Thành Cổ Loa và Nỏ thần An Dương Vương',
    source: 'Việt Sử Lược',
    dynasty: 'Âu Lạc',
    sourceReliability: 'LEVEL_1' as const,
    content: `Thục Phán An Dương Vương lập nên nước Âu Lạc, cho xây dựng Thành Cổ Loa hình xoáy ốc. Truyền thuyết ghi nhận vị tướng Cao Lỗ đã chế tạo thành công Nỏ thần (Nỏ Liên Châu) có thể bắn ra hàng trăm mũi tên bảo vệ đất nước.`,
  },
  {
    title: 'Khởi nghĩa Tây Sơn giai đoạn 1771 - 1777 tại Quy Nhơn',
    source: 'Tây Sơn Thuật Lược',
    dynasty: 'Nhà Tây Sơn',
    sourceReliability: 'LEVEL_1' as const,
    content: `Năm 1771, ba anh em Tây Sơn (Nguyễn Nhạc, Nguyễn Huệ, Nguyễn Lữ) dấy binh khởi nghĩa tại vùng Tây Sơn thượng đạo (Quy Nhơn). Khởi nghĩa nhanh chóng lật đổ chúa Nguyễn ở Đàng Trong và chúa Trịnh ở Đàng Ngoài.`,
  },
  {
    title: 'Chiến thắng Sông Bạch Đằng năm 981 của Lê Đại Hành',
    source: 'Đại Việt Sử Ký Toàn Thư',
    dynasty: 'Tiền Lê',
    sourceReliability: 'LEVEL_1' as const,
    content: `Năm 981, vua Lê Đại Hành (tên thật Lê Hoàn) đã trực tiếp chỉ huy quân dân Đại Việt đánh tan quân xâm lược Nhà Tống trên sông Bạch Đằng, bảo vệ vững chắc nền độc lập dân tộc.`,
  },
  {
    title: 'Kinh đô Phú Xuân và Thành phố Huế',
    source: 'Đại Nam Nhất Thống Chí',
    dynasty: 'Nhà Nguyễn',
    sourceReliability: 'LEVEL_1' as const,
    content: `Phú Xuân (còn gọi là Thuận Hóa) là kinh đô của chính quyền Chúa Nguyễn ở Đàng Trong và sau đó là triều đại Nhà Tây Sơn dưới thời hoàng đế Quang Trung. Ngày nay, vùng đất Phú Xuân tương ứng với Thành phố Huế (Thừa Thiên Huế).`,
  },
];

export async function runChronoRagEval() {
  if (process.env.FORCE_OFFLINE === undefined) {
    process.env.FORCE_OFFLINE = 'true';
  }

  console.log('=== [Chrono-RAG Engine Evaluation Runner] ===');
  console.log('Fact Precision Target: > 99.2%');
  console.log('Hallucination Rate Target: < 0.8%');
  console.log('Citation Traceability Target: 100%');
  console.log('Retrieval Latency Target: < 1500ms (Dev Benchmark SLA)');
  console.log('--------------------------------------------------\n');

  const ragEngine = new ChronoRagEngine();

  // 1. Ingest Benchmark Data (Combine sample docs & golden test-cases)
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

  const monorepoRoot = findMonorepoRoot();
  const goldenDir = path.resolve(monorepoRoot, 'eval', 'test-cases');
  if (fs.existsSync(goldenDir)) {
    const files = fs.readdirSync(goldenDir).filter((f) => f.endsWith('.json') && !f.includes('benchmark'));
    for (const f of files) {
      try {
        const raw = fs.readFileSync(path.join(goldenDir, f), 'utf-8');
        const json = JSON.parse(raw);
        if (json.content && json.title) {
          await ragEngine.ingestDocument(json.content, {
            title: json.title,
            source: json.source_name || json.title,
            dynasty: json.dynasty,
            sourceReliability: json.source_reliability || 'LEVEL_1',
          });
        }
      } catch {
        // Ignore single file parse errors
      }
    }
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
      maxTokens: 500,
      rerankTopK: 5,
    });
    const evalRes = evaluateResponse(tc, response);
    itemResults.push(evalRes);
    console.log(
      `  [${evalRes.passed ? 'PASS' : 'FAIL'}] Test ${tc.id} (${tc.domain}): Fact Precision = ${evalRes.factPrecision}% | Latency = ${evalRes.latencyMs}ms`
    );
  }

  // 3. Compute Aggregates & Build Report (Target SLA: 1500ms)
  const aggregateReport = calculateAggregateReport(itemResults, 1500);

  console.log('\n==================================================');
  console.log(` AGGREGATE BENCHMARK RESULTS (${aggregateReport.kpiStatus.overallPassed ? 'PASS' : 'FAIL'})`);
  console.log('==================================================');
  console.log(` - Total Evaluated:               ${aggregateReport.totalEvaluated}`);
  console.log(` - Avg Fact Precision Score:       ${aggregateReport.avgFactPrecision}% (Target: > 95.0%)`);
  console.log(` - Avg Hallucination Rate:         ${aggregateReport.avgHallucinationRate}% (Target: < 5.0%)`);
  console.log(` - Citation Traceability:          ${aggregateReport.citationTraceabilityPercent}% (Target: 100%)`);
  console.log(` - Avg Retrieval Latency:          ${aggregateReport.avgLatencyMs}ms (Target: < 1500ms SLA)`);
  console.log(` - Latency SLA Status:             ${aggregateReport.kpiStatus.latencyPassed ? 'PASSED' : 'FAILED'}`);
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
