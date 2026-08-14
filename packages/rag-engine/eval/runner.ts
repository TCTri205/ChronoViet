/**
 * Chrono-RAG Engine Benchmark Evaluation Runner
 * Evaluates RAG retrieval precision, hallucination rate, citation traceability, and retrieval latency.
 */

import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { ChronoRagEngine } from '../src/rag-engine.js';
import { inMemoryStore } from '@chronoviet/shared-spec';
import { TestCase, evaluateResponse, calculateAggregateReport, RAG_KPI_TARGETS } from './metrics.js';

const TestCaseSchema = z.object({
  id: z.string(),
  domain: z.string(),
  question: z.string(),
  groundTruthCanonical: z.string(),
  expectedAliases: z.array(z.string()),
  expectedLocation: z.string().optional(),
  expectedDynasty: z.string().optional(),
  requiredFacts: z.array(z.string()),
  isAnswerable: z.boolean().optional(),
});

function getMonorepoRoot(): string {
  return path.resolve(__dirname, '../../..');
}

// Master Historical Knowledge Base Seeds for Production-grade Benchmark Execution
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
    content: `Năm 1771, ba anh em Tây Sơn (Nguyễn Nhạc, Nguyễn Huệ, Nguyễn Lữ) dấy binh khởi nghĩa tại vùng Tây Sơn thượng đạo (Quy Nhơn). Khởi nghĩa nhanh chóng lật đổ chúa Nguyễn ở Đàng Trong và chúa Trịnh ở Đàng Ngoài. Năm 1776, Nguyễn Nhạc xưng Tây Sơn Vương. Sau này Nguyễn Huệ được phong Bắc Bình Vương trước khi lên ngôi hoàng đế Quang Trung.`,
  },
  {
    title: 'Chiến thắng Sông Bạch Đằng năm 981 của Lê Đại Hành',
    source: 'Đại Việt Sử Ký Toàn Thư',
    dynasty: 'Tiền Lê',
    sourceReliability: 'LEVEL_1' as const,
    content: `Năm 981, vua Lê Đại Hành (tên thật Lê Hoàn) đã trực tiếp chỉ huy quân dân Đại Việt đánh tan quân xâm lược Nhà Tống trên sông Bạch Đằng, bảo vệ vững chắc nền độc lập dân tộc. Trước đó năm 980, Lê Hoàn đã sáng lập triều đại Nhà Tiền Lê, khác với triều đại Nhà Lê Sơ do Lê Lợi lập nên năm 1428.`,
  },
  {
    title: 'Kinh đô Phú Xuân và Thành phố Huế',
    source: 'Đại Nam Nhất Thống Chí',
    dynasty: 'Nhà Nguyễn',
    sourceReliability: 'LEVEL_1' as const,
    content: `Phú Xuân (còn gọi là Thuận Hóa) là kinh đô của chính quyền Chúa Nguyễn ở Đàng Trong và sau đó là triều đại Nhà Tây Sơn dưới thời hoàng đế Quang Trung. Ngày nay, vùng đất Phú Xuân tương ứng với Thành phố Huế (Thừa Thiên Huế).`,
  },
  {
    title: 'Trận Rạch Gầm - Xoài Mút năm 1785',
    source: 'Đại Nam Thực Lục',
    dynasty: 'Nhà Tây Sơn',
    sourceReliability: 'LEVEL_1' as const,
    content: `Đầu năm 1785, Nguyễn Huệ (sau là Quang Trung) chỉ huy quân Tây Sơn mai phục và đánh tan 5 vạn quân Xiêm trong trận Rạch Gầm - Xoài Mút trên sông Tiền (Tiền Giang). Chiến thắng này đập tan âm mưu xâm lược của phong kiến Xiêm La.`,
  },
  {
    title: 'Lý Thường Kiệt và Phòng tuyến Sông Như Nguyệt năm 1077',
    source: 'Đại Việt Sử Ký Toàn Thư',
    dynasty: 'Nhà Lý',
    sourceReliability: 'LEVEL_1' as const,
    content: `Thái úy Lý Thường Kiệt (tên thật là Ngô Tuấn) là danh tướng kiệt xuất triều Nhà Lý. Năm 1077, ông chỉ huy quân dân Đại Việt xây dựng phòng tuyến Sông Như Nguyệt đánh tan quân xâm lược Nhà Tống. Trong cuộc kháng chiến này, bài thơ thần Nam Quốc Sơn Hà vang lên khẳng định chủ quyền lãnh thổ dân tộc.`,
  },
  {
    title: 'Đinh Tiên Hoàng và Sự kiện dẹp loạn 12 sứ quân năm 968',
    source: 'Đại Việt Sử Ký Toàn Thư',
    dynasty: 'Nhà Đinh',
    sourceReliability: 'LEVEL_1' as const,
    content: `Năm 968, Đinh Bộ Lĩnh (tức Đinh Tiên Hoàng, xưng Vạn Thắng Vương) đã hoàn thành công cuộc đánh dẹp và thu phục 12 sứ quân, thống nhất đất nước, xưng Hoàng đế, đặt quốc hiệu Đại Cồ Việt và đóng kinh đô tại Hoa Lư (Ninh Bình).`,
  },
  {
    title: 'Khởi nghĩa Hai Bà Trưng năm 40',
    source: 'Đại Việt Sử Ký Toàn Thư',
    dynasty: 'Trưng Vương',
    sourceReliability: 'LEVEL_1' as const,
    content: `Năm 40 sau Công nguyên, Trưng Trắc cùng em gái là Trưng Nhị (Hai Bà Trưng) phất cờ khởi nghĩa tại Mê Linh đánh đuổi Thái thú Tô Định của nhà Đông Hán, giành lại quyền tự chủ cho đất nước và xưng Trưng Nữ Vương.`,
  },
  {
    title: 'Trận Chi Lăng - Xương Giang năm 1427',
    source: 'Lam Sơn Thực Lục',
    dynasty: 'Nhà Lê',
    sourceReliability: 'LEVEL_1' as const,
    content: `Tháng 10 năm 1427, tại ải Chi Lăng (Lạng Sơn), nghĩa quân Lam Sơn do Lê Lợi lãnh đạo đã phục kích chém đầu tổng binh Liễu Thăng của quân Minh, đập tan viện binh 10 vạn quân giặc, buộc Vương Thông phải xin hàng tại Hội thề Đông Quan.`,
  },
  {
    title: 'Bình Ngô Đại Cáo và Nguyễn Trãi năm 1428',
    source: 'Đại Việt Sử Ký Toàn Thư',
    dynasty: 'Nhà Lê',
    sourceReliability: 'LEVEL_1' as const,
    content: `Đầu năm 1428, sau khi khởi nghĩa Lam Sơn đại thắng quân Minh, Nguyễn Trãi (hiệu Ức Trai) thừa lệnh vua Lê Thái Tổ (Lê Lợi) soạn thảo tác phẩm Bình Ngô Đại Cáo tại Đông Kinh. Đây được coi là bản tuyên ngôn độc lập thứ hai của dân tộc Việt Nam.`,
  },
  {
    title: 'Lịch sử vùng đất Gia Định - Sài Gòn',
    source: 'Gia Định Thành Thông Chí',
    dynasty: 'Nhà Nguyễn',
    sourceReliability: 'LEVEL_1' as const,
    content: `Vùng đất Gia Định xưa (còn gọi là Bến Nghé, Sài Gòn) được Lễ Thành Hầu Nguyễn Hữu Cảnh kinh lược và lập phủ Gia Định năm 1698 dưới thời Chúa Nguyễn. Vùng đất này ngày nay phát triển thành Thành phố Hồ Chí Minh.`,
  },
  {
    title: 'Tranh luận quân số Nguyên Mông giữa Toàn Thư và Nguyên Sử',
    source: 'Sử học đối chiếu',
    dynasty: 'Nhà Trần',
    sourceReliability: 'LEVEL_1' as const,
    content: `Trong cuộc kháng chiến chống Nguyên Mông thời Nhà Trần dưới sự chỉ huy của Trần Hưng Đạo, Đại Việt Sử Ký Toàn Thư ghi nhận quân Nguyên Mông huy động khoảng 50 vạn quân, trong khi Nguyên Sử của phương Bắc chép lại con số ước tính từ 10 đến 20 vạn quân. Đây là ví dụ tiêu biểu cho việc thể hiện đa góc nhìn sử liệu trong nghiên cứu.`,
  },
];

export async function runChronoRagEval() {
  const isOnlineMode = process.argv.includes('--online') || process.env.FORCE_OFFLINE === 'false';
  if (!isOnlineMode && process.env.FORCE_OFFLINE === undefined) {
    process.env.FORCE_OFFLINE = 'true';
  }

  const targetLatencyMs = isOnlineMode
    ? RAG_KPI_TARGETS.MAX_LATENCY_ONLINE_MS
    : RAG_KPI_TARGETS.MAX_LATENCY_OFFLINE_MS;

  console.log('=== [Chrono-RAG Engine Evaluation Runner] ===');
  console.log(`Execution Mode: ${isOnlineMode ? 'ONLINE (Production DB Vector/Graph)' : 'OFFLINE (Dev Benchmark Mock)'}`);
  console.log(`Fact Precision Target: > ${RAG_KPI_TARGETS.FACT_PRECISION}%`);
  console.log(`Hallucination Rate Target: < ${RAG_KPI_TARGETS.HALLUCINATION_RATE}%`);
  console.log(`Citation Traceability Target: ${RAG_KPI_TARGETS.CITATION_TRACEABILITY}%`);
  console.log(`Retrieval Latency Target: < ${targetLatencyMs}ms SLA`);
  console.log('--------------------------------------------------\n');

  const ragEngine = new ChronoRagEngine();

  // 1. Ingest Benchmark Data (Combine sample docs & golden test-cases)
  inMemoryStore.clear();
  console.log('[*] Pre-populating benchmark knowledge base with distractor documents...');
  for (const doc of SAMPLE_HISTORICAL_DOCUMENTS) {
    await ragEngine.ingestDocument(doc.content, {
      title: doc.title,
      source: doc.source,
      dynasty: doc.dynasty,
      sourceReliability: doc.sourceReliability,
    });
  }

  const monorepoRoot = getMonorepoRoot();
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
      } catch (err) {
        console.warn(`[!] Skipping invalid test case file ${f}:`, (err as Error).message);
      }
    }
  }

  console.log('[+] Knowledge base populated successfully.\n');

  // 2. Load Consolidated Test Dataset with Zod Schema Validation
  let datasetPath = path.resolve(__dirname, 'datasets/chronoeval-benchmark.json');
  if (!fs.existsSync(datasetPath)) {
    datasetPath = path.resolve(__dirname, 'datasets/chronoeval-1000.json');
  }

  const rawDataset = fs.readFileSync(datasetPath, 'utf-8');
  const parsedJson = JSON.parse(rawDataset);

  if (!Array.isArray(parsedJson)) {
    throw new Error(`Invalid dataset format at ${datasetPath}: expected JSON array`);
  }

  const testCases: TestCase[] = parsedJson.map((item, idx) => {
    const parseResult = TestCaseSchema.safeParse(item);
    if (!parseResult.success) {
      throw new Error(`Dataset item at index ${idx} failed Zod schema validation: ${parseResult.error.message}`);
    }
    return parseResult.data;
  });

  console.log(`[*] Executing search benchmark over ${testCases.length} test cases from ${path.basename(datasetPath)}...`);
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


  // 3. Compute Aggregates & Build Report
  const aggregateReport = calculateAggregateReport(itemResults, targetLatencyMs);

  console.log('\n==================================================');
  console.log(` AGGREGATE BENCHMARK RESULTS (${aggregateReport.kpiStatus.overallPassed ? 'PASS' : 'FAIL'})`);
  console.log('==================================================');
  console.log(` - Total Evaluated:               ${aggregateReport.totalEvaluated}`);
  console.log(` - Avg Fact Precision Score:       ${aggregateReport.avgFactPrecision}% (Target: > ${RAG_KPI_TARGETS.FACT_PRECISION}%)`);
  console.log(` - Avg Hallucination Rate:         ${aggregateReport.avgHallucinationRate}% (Target: < ${RAG_KPI_TARGETS.HALLUCINATION_RATE}%)`);
  console.log(` - Citation Traceability:          ${aggregateReport.citationTraceabilityPercent}% (Target: ${RAG_KPI_TARGETS.CITATION_TRACEABILITY}%)`);
  console.log(` - Avg Retrieval Latency:          ${aggregateReport.avgLatencyMs}ms (Target: < ${targetLatencyMs}ms SLA)`);
  console.log(` - Fact Precision Status:          ${aggregateReport.kpiStatus.factPrecisionPassed ? 'PASSED' : 'FAILED'}`);
  console.log(` - Hallucination Rate Status:      ${aggregateReport.kpiStatus.hallucinationRatePassed ? 'PASSED' : 'FAILED'}`);
  console.log(` - Citation Status:                ${aggregateReport.kpiStatus.citationTraceabilityPassed ? 'PASSED' : 'FAILED'}`);
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
