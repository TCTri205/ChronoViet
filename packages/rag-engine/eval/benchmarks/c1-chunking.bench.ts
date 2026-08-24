/**
 * C1 Benchmark: Hierarchical Temporal Chunking & Document Ingestion
 * Evaluates Metrics C1-M1 to C1-M9 against authentic historical texts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chunkDocumentHierarchical } from '@chronoviet/data-ingestion';
import { ComponentBenchmarkReport } from '@chronoviet/shared-spec';
import { HighResolutionLatencyProfiler } from '../metrics/latency-profiler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runC1Benchmark(): Promise<ComponentBenchmarkReport> {
  const profiler = new HighResolutionLatencyProfiler();

  const documents = [
    {
      title: 'Đại thắng Ngọc Hồi - Đống Đa 1789',
      source: 'Đại Việt Sử Ký Toàn Thư & Hoàng Lê Nhất Thống Chí',
      dynasty: 'Nhà Tây Sơn',
      sourceReliability: 'LEVEL_1' as const,
      content: `Trận Ngọc Hồi - Đống Đa năm 1789 là một trong những chiến công hiển hách bậc nhất trong lịch sử dựng nước và giữ nước của dân tộc Việt Nam. Mùa xuân năm Kỷ Dậu 1789, vua Quang Trung (tức Nguyễn Huệ, vị anh hùng áo vải cờ đào Tây Sơn) đã thống lĩnh đại quân thần tốc tiến ra Bắc Hà đánh tan 29 vạn quân Mãn Thanh xâm lược do Tổng đốc Tôn Sĩ Nghị chỉ huy.

Cuộc hành quân thần tốc của nghĩa quân Tây Sơn khởi hành từ Phú Xuân (Huế) ngày 20 tháng Chạp năm Mậu Thân. Ra đến Nghệ An và Thanh Hóa, Quang Trung đã tuyển thêm hàng vạn binh sĩ, tổ chức duyệt binh và động viên tinh thần quân đội với lời thề diệt giặc cứu nước: "Đánh cho để dài tóc, đánh cho để đen răng, đánh cho nó chích luân bất phản, đánh cho nó phiến giáp bất hoàn, đánh cho sử tri Nam quốc anh hùng chi hữu chủ". Quang Trung chia quân làm năm đạo tiến đánh đồng loạt vào các vị trí then chốt của quân Thanh quanh kinh thành Thăng Long.

Đêm mùng 4 rạng sáng ngày mùng 5 Tết Kỷ Dậu (tức ngày 30 tháng 1 năm 1789), cánh quân chủ lực của vua Quang Trung đồng loạt công phá đồn Ngọc Hồi (phía Nam Thăng Long). Quân Tây Sơn sử dụng các tấm lá chắn bện rơm ướt quấn ngoài khiên gỗ để chống tên lửa và súng hỏa mai của giặc, áp sát chân thành và nhanh chóng tiêu diệt cứ điểm phòng thủ kiên cố nhất của địch.

Cùng lúc đó, cánh quân của Đô đốc Đặng Tiến Đông bất ngờ đánh úp đồn Khương Thượng (Đống Đa), khiến tướng giặc là Sầm Nghi Đống khiếp sợ phải thắt cổ tự tử trên núi Loa. Chủ tướng Tôn Sĩ Nghị nghe tin cấp báo bàng hoàng không kịp mặc giáp, vội vã cùng tàn quân vượt cầu phao sông Nhị tháo chạy về phương Bắc. Cầu phao đứt, quân Thanh rơi xuống sông chết vô số.

Chiến thắng Ngọc Hồi - Đống Đa mùng 5 Tết Kỷ Dậu đã quét sạch hoàn toàn quân xâm lược phương Bắc, giải phóng hoàn toàn kinh thành Thăng Long, bảo vệ vững chắc nền độc lập chủ quyền của Đại Việt và đưa triều đại Tây Sơn bước vào giai đoạn phát triển rực rỡ nhất.`,
    },
    {
      title: 'Khởi nghĩa Lam Sơn và Hội thề Đông Quan 1427',
      source: 'Lam Sơn Thực Lục & Đại Việt Sử Ký Toàn Thư',
      dynasty: 'Nhà Lê (Lê Sơ)',
      sourceReliability: 'LEVEL_1' as const,
      content: `Cuộc khởi nghĩa Lam Sơn do Bình Định Vương Lê Lợi khởi xướng năm 1418 tại vùng núi Lam Sơn (Thanh Hóa) là cuộc chiến tranh giải phóng dân tộc trường kỳ và vĩ đại nhất thế kỷ 15. Dưới sự lãnh đạo sáng suốt của Lê Lợi và quân sư Nguyễn Trãi, nghĩa quân Lam Sơn đã vượt qua muôn vàn gian khổ trong giai đoạn đầu nếm mật nằm gai tại vùng núi Chí Linh.

Nguyễn Trãi đã vạch ra đường lối kháng chiến mưu phạt tâm công: "Đem đại nghĩa để thắng hung tàn, lấy chí nhân để thay cường bạo". Nghĩa quân từng bước chuyển từ thế phòng thủ sang tiến công giải phóng Nghệ An, Thuận Hóa, Tân Bình rồi tiến quân ra Bắc Hà vây hãm thành Đông Quan.

Trận quyết chiến chiến lược Chi Lăng - Xương Giang mùa thu năm 1427 đã giáng đòn quyết định vào đạo viện binh 10 vạn quân Minh do An Viễn hầu Liễu Thăng chỉ huy. Tướng giặc Liễu Thăng bị chém đầu tại ải Chi Lăng, tướng Lương Minh và Lý Khánh tự vẫn. Đạo quân viện binh thứ hai của Mộc Thạnh nghe tin thất đảm vội vã tháo chạy về Vân Nam.

Sau đại thắng Chi Lăng - Xương Giang, tổng binh Vương Thông trong thành Đông Quan cùng đường phải chấp nhận giảng hòa tại Hội thề Đông Quan vào tháng 12 năm 1427. Lê Lợi đã cấp ngựa, thuyền và lương thảo cho 10 vạn tàn quân Minh rút về nước an toàn, thể hiện tư tưởng nhân đạo và hòa hiếu sâu sắc của dân tộc Đại Việt.`,
    },
    {
      title: 'Chiến dịch Điện Biên Phủ 1954',
      source: 'Lịch sử Kháng chiến Chống Thực dân Pháp (1945 - 1954)',
      dynasty: 'Hiện đại',
      sourceReliability: 'LEVEL_1' as const,
      content: `Chiến dịch Điện Biên Phủ diễn ra từ ngày 13 tháng 3 đến ngày 7 tháng 5 năm 1954 tại thung lũng Mường Thanh (tỉnh Điện Biên) là trận quyết chiến chiến lược đỉnh cao trong cuộc kháng chiến chống thực dân Pháp của quân và dân Việt Nam.

Đại tướng Tổng tư lệnh Võ Nguyên Giáp trên cương vị Chỉ huy trưởng kiêm Bí thư Đảng ủy chiến dịch đã đưa ra quyết định lịch sử: chuyển phương châm tác chiến từ "Đánh nhanh thắng nhanh" sang "Đánh chắc tiến chắc". Quyết định này bảo đảm tiêu diệt từng cứ điểm phòng ngự kiên cố của tập đoàn cứ điểm Điện Biên Phủ do tướng De Castries chỉ huy.

Trải qua 56 ngày đêm khoét núi, ngủ hầm, mưa dầm, cơm vắt, máu trộn bùn non, quân đội Việt Nam đã lần lượt tiêu diệt các phân khu Bắc (Him Lam, Độc Lập, Bản Kéo), phân khu Trung tâm (đồi A1, C1, D1) và tiến thẳng vào sở chỉ huy bắt sống tướng De Castries cùng toàn bộ ban tham mưu vào chiều ngày 7 tháng 5 năm 1954.

Chiến thắng Điện Biên Phủ lừng lẫy năm châu, chấn động địa cầu đã đập tan hoàn toàn kế hoạch Navarre của thực dân Pháp, buộc chính phủ Pháp phải ký kết Hiệp định Genève chấm dứt chiến tranh, công nhận độc lập, chủ quyền, thống nhất và toàn vẹn lãnh thổ của ba nước Đông Dương.`,
    },
    {
      title: 'Phòng tuyến Sông Như Nguyệt và Thơ Thần 1077',
      source: 'Đại Việt Sử Ký Toàn Thư & Lịch Triều Hiến Chương Loại Chí',
      dynasty: 'Nhà Lý',
      sourceReliability: 'LEVEL_1' as const,
      content: `Năm 1077, nhà Tống cử đại tướng Quách Quỳ và Triệu Tiết chỉ huy hơn 10 vạn quân bộ cùng hàng chục vạn phu dịch tràn sang xâm lược nước Đại Việt. Thái úy Lý Thường Kiệt được vua Lý Nhân Tông trao quyền tiết chế, đã chủ động chọn sông Như Nguyệt (sông Cầu) làm phòng tuyến chiến lược ngăn chặn bước tiến của quân giặc.

Phòng tuyến Như Nguyệt được xây dựng bằng lũy đất kiên cố, phía trên đóng cọc tre dày đặc cao hàng trượng, tạo thành bức tường thành vững chắc dài hàng chục cây số men theo bờ Nam dòng sông. Quân Tống nhiều lần vượt sông công phá nhưng đều bị thủy binh và bộ binh Đại Việt đánh bật trở lại, rơi vào cảnh thiếu thốn lương thảo và dịch bệnh bùng phát.

Trong đêm tối tĩnh mịch tại đền thờ Trương Hống, Trương Hát, bài thơ thần Nam Quốc Sơn Hà vang lên hào hùng, khích lệ sĩ khí quân ta và làm rúng động tinh thần quân giặc: "Nam quốc sơn hà Nam đế cư / Tiệt nhiên định phận tại thiên thư / Như hà nghịch lỗ lai xâm phạm / Nhữ đẳng hành khan thủ bại hư". Lý Thường Kiệt sau đó mở cuộc phản công thần tốc, tiêu diệt quá nửa quân giặc, buộc Quách Quỳ phải chấp nhận giảng hòa rút lui.`,
    },
    {
      title: 'Ba Lần Đại Thắng Quân Nguyên Mông Thời Trần',
      source: 'Đại Việt Sử Ký Toàn Thư (Tập 2)',
      dynasty: 'Nhà Trần',
      sourceReliability: 'LEVEL_1' as const,
      content: `Vào thế kỷ 13, đế chế Mông Cổ bành trướng khắp lục địa Á - Âu nhưng đã ba lần chuốc lấy thất bại thảm hại khi xâm lược Đại Việt vào các năm 1258, 1285 và 1288 dưới sự lãnh đạo tài tình của các vua Trần và Quốc công Tiết chế Trần Hưng Đạo (Trần Quốc Tuấn).

Để động viên tinh thần tướng sĩ trước hiểm họa xâm lăng lần thứ hai, Trần Hưng Đạo đã soạn bài Hịch tướng sĩ với lời văn thống thiết: "Ta thường tới bữa quên ăn, nửa đêm vỗ gối, ruột đau như cắt, nước mắt đầm đìa, chỉ căm tức chưa nuốt thịt ăn gan quân thù". Tại Hội nghị Diên Hồng năm 1284, các bô lão cả nước đã đồng thanh hô vang một chữ "Đánh", tạo nên sức mạnh đoàn kết toàn dân tộc với tinh thần Sát Thát.

Năm 1288, trong cuộc kháng chiến lần thứ ba, Trần Hưng Đạo tái hiện kế sách cắm cọc gỗ bọc sắt trên sông Bạch Đằng. Khi thủy triều rút, toàn bộ đoàn thuyền chiến của quân Nguyên bị bãi cọc nhọn đâm vỡ, tướng giặc Ô Mã Nhi bị bắt sống. Ba lần đại thắng quân Nguyên Mông không chỉ bảo vệ nền độc lập dân tộc mà còn ngăn chặn làn sóng bành trướng của đế chế Mông Cổ xuống toàn vùng Đông Nam Á.`,
    },
  ];

  let totalChildChunks = 0;
  let childWordCountCompliant = 0;
  let syntaxIntact = 0;
  let validParentLinks = 0;
  let totalWordsProcessed = 0;
  let overlapConsistentCount = 0;
  let overlapPairCount = 0;
  let metadataCorrectCount = 0;
  let totalDocEvaluated = 0;
  let coherenceSum = 0;
  let coherenceCount = 0;
  let intactParagraphs = 0;
  let totalParagraphs = 0;
  let totalParentChars = 0;
  let totalChildChars = 0;

  for (const doc of documents) {
    totalDocEvaluated++;
    const timer = profiler.startTimer();
    const chunkResult = chunkDocumentHierarchical(doc.content, {
      title: doc.title,
      sourceName: doc.source,
      dynasty: doc.dynasty,
      sourceReliability: doc.sourceReliability,
    });
    timer();

    const docWords = doc.content.split(/\s+/).filter(Boolean).length;
    totalWordsProcessed += docWords;
    totalChildChunks += chunkResult.childChunks.length;

    // 1. Child word count compliance
    for (const child of chunkResult.childChunks) {
      const wCount = child.wordCount;
      if (wCount >= 50 && wCount <= 600) {
        childWordCountCompliant++;
      }
    }

    // 2. Metadata extraction
    for (const child of chunkResult.childChunks) {
      if (child.metadata && (child.metadata.sourceReliability || child.metadata.dynasty)) {
        metadataCorrectCount++;
      }
    }

    // 3. Syntax integrity
    for (const child of chunkResult.childChunks) {
      const trimmed = child.textContent.trim();
      if (/[.!?)"'»]$/.test(trimmed)) {
        syntaxIntact++;
      }
    }

    // 4. Parent-child link integrity
    const parentIdSet = new Set(chunkResult.parentChunks.map((p) => p.id));
    for (const child of chunkResult.childChunks) {
      const pId = child.metadata?.parentChunkId;
      if (pId && parentIdSet.has(pId)) {
        validParentLinks++;
      }
    }

    // 5. Overlap consistency
    for (let i = 1; i < chunkResult.childChunks.length; i++) {
      overlapPairCount++;
      const prevText = chunkResult.childChunks[i - 1].textContent;
      const currText = chunkResult.childChunks[i].textContent;
      const prevTokens = prevText.split(/\s+/).slice(-20);
      const hasOverlap = prevTokens.some((t) => currText.includes(t));
      if (hasOverlap) {
        overlapConsistentCount++;
      }
    }

    // 6. Semantic Coherence (Jaccard similarity across adjacent sentences)
    for (const child of chunkResult.childChunks) {
      const sentences = child.textContent.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 10);
      for (let s = 0; s < sentences.length - 1; s++) {
        const setA = new Set(sentences[s].toLowerCase().split(/\s+/));
        const setB = new Set(sentences[s + 1].toLowerCase().split(/\s+/));
        let inter = 0;
        for (const word of setA) if (setB.has(word)) inter++;
        const union = new Set([...setA, ...setB]).size;
        coherenceSum += union > 0 ? inter / union : 0.5;
        coherenceCount++;
      }
    }

    // 7. Event Boundary Preservation
    const paragraphs = doc.content.split(/\n\s*\n/).filter((p) => p.trim().length > 20);
    totalParagraphs += paragraphs.length;
    for (const p of paragraphs) {
      const pFirstWords = p.trim().split(/\s+/).slice(0, 5).join(' ');
      const found = chunkResult.childChunks.some((c) => c.textContent.includes(pFirstWords));
      if (found) intactParagraphs++;
    }

    // 8. Retrieval Utility Gain (parent context expansion)
    for (const p of chunkResult.parentChunks) totalParentChars += p.textContent.length;
    for (const c of chunkResult.childChunks) totalChildChars += c.textContent.length;
  }

  const childWordComplianceRate = totalChildChunks > 0 ? (childWordCountCompliant / totalChildChunks) * 100 : 100;
  const syntaxIntegrityScore = totalChildChunks > 0 ? (syntaxIntact / totalChildChunks) * 100 : 100;
  const parentChildLinkIntegrity = totalChildChunks > 0 ? (validParentLinks / totalChildChunks) * 100 : 100;
  const overlapConsistencyScore = overlapPairCount > 0 ? (overlapConsistentCount / overlapPairCount) * 100 : 100;
  const metadataExtractionAcc = totalChildChunks > 0 ? (metadataCorrectCount / totalChildChunks) * 100 : 100;

  const semanticCoherence = coherenceCount > 0 ? coherenceSum / coherenceCount : 0;
  const eventBoundaryPreservation = totalParagraphs > 0 ? (intactParagraphs / totalParagraphs) * 100 : 0;
  const retrievalUtilityGain = totalChildChars > 0 ? ((totalParentChars - totalChildChars) / totalChildChars) * 100 : 0;

  const latencySummary = profiler.getSummary();
  const totalElapsedMs = latencySummary.count * latencySummary.avg_ms;
  const throughputWordsPerSec = (totalWordsProcessed / Math.max(0.001, totalElapsedMs)) * 1000;

  const kpisPassed =
    childWordComplianceRate >= 90.0 &&
    syntaxIntegrityScore >= 80.0 &&
    parentChildLinkIntegrity >= 100.0 &&
    eventBoundaryPreservation >= 85.0 &&
    throughputWordsPerSec >= 15000;

  const report: ComponentBenchmarkReport = {
    benchmark_id: 'C1',
    name: 'Hierarchical Chunking & Ingestion Benchmark',
    timestamp: new Date().toISOString(),
    total_evaluated: totalChildChunks,
    metrics: {
      'C1-M1_ChildWordCountCompliance': Number(childWordComplianceRate.toFixed(2)),
      'C1-M2_SyntaxIntegrityScore': Number(syntaxIntegrityScore.toFixed(2)),
      'C1-M3_SemanticCoherence': Number(semanticCoherence.toFixed(2)),
      'C1-M4_EventBoundaryPreservation': Number(eventBoundaryPreservation.toFixed(2)),
      'C1-M5_ParentChildLinkIntegrity': Number(parentChildLinkIntegrity.toFixed(2)),
      'C1-M6_OverlapConsistency': Number(overlapConsistencyScore.toFixed(2)),
      'C1-M7_MetadataAccuracy': Number(metadataExtractionAcc.toFixed(2)),
      'C1-M8_RetrievalUtilityGain': Number(retrievalUtilityGain.toFixed(2)),
      'C1-M9_ThroughputWordsPerSec': Number(throughputWordsPerSec.toFixed(0)),
    },
    kpis_passed: kpisPassed,
    latency_summary: latencySummary,
    details: [],
  };

  const reportsDir = path.resolve(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.join(reportsDir, 'c1-chunking-report.json'), JSON.stringify(report, null, 2));

  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runC1Benchmark().then((rep) => console.log('C1 Benchmark Result:', JSON.stringify(rep, null, 2)));
}
