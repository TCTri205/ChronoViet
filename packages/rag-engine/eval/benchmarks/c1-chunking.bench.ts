/**
 * C1 Benchmark: Hierarchical Temporal Chunking & Document Ingestion
 * Evaluates Metrics C1-M1 to C1-M9
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
      source: 'Đại Việt Sử Ký Toàn Thư (Tập 3)',
      dynasty: 'Nhà Tây Sơn',
      sourceReliability: 'LEVEL_1' as const,
      content: `
Trận Ngọc Hồi - Đống Đa năm 1789 là một trong những chiến công hiển hách bậc nhất trong lịch sử dựng nước và giữ nước của dân tộc Việt Nam. Mùa xuân năm Kỷ Dậu 1789, vua Quang Trung (tức Nguyễn Huệ, vị anh hùng áo vải cờ đào Tây Sơn) đã thống lĩnh đại quân thần tốc tiến ra Bắc Hà đánh tan 29 vạn quân Mãn Thanh xâm lược do Tổng đốc Tôn Sĩ Nghị chỉ huy.

Cuộc hành quân thần tốc của nghĩa quân Tây Sơn khởi hành từ Phú Xuân (Huế) ngày 20 tháng Chạp năm Mậu Thân. Ra đến Nghệ An và Thanh Hóa, Quang Trung đã tuyển thêm hàng vạn binh sĩ, tổ chức duyệt binh và động viên tinh thần quân đội với lời thề diệt giặc cứu nước. Quang Trung chia quân làm năm đạo tiến đánh đồng loạt vào các vị trí then chốt của quân Thanh quanh kinh thành Thăng Long.

Đêm mùng 4 rạng sáng ngày mùng 5 Tết Kỷ Dậu (tức ngày 30 tháng 1 năm 1789), cánh quân chủ lực của vua Quang Trung đồng loạt công phá đồn Ngọc Hồi (phía Nam Thăng Long). Quân Tây Sơn sử dụng các tấm lá chắn bện rơm ướt quấn ngoài khiên gỗ để chống tên lửa và súng hỏa mai của giặc, áp sát chân thành và nhanh chóng tiêu diệt cứ điểm phòng thủ kiên cố nhất của địch.

Cùng lúc đó, cánh quân của Đô đốc Đặng Tiến Đông bất ngờ đánh úp đồn Khương Thượng (Đống Đa), khiến tướng giặc là Sầm Nghi Đống khiếp sợ phải thắt cổ tự tử trên núi Loa. Chủ tướng Tôn Sĩ Nghị nghe tin cấp báo bàng hoàng không kịp mặc giáp, vội vã cùng tàn quân vượt cầu phao sông Nhị tháo chạy về phương Bắc. Cầu phao đứt, quân Thanh rơi xuống sông chết vô số.

Chiến thắng Ngọc Hồi - Đống Đa mùng 5 Tết Kỷ Dậu đã quét sạch hoàn toàn quân xâm lược phương Bắc, giải phóng hoàn toàn kinh thành Thăng Long, bảo vệ vững chắc nền độc lập chủ quyền của Đại Việt và đưa triều đại Tây Sơn bước vào giai đoạn phát triển rực rỡ nhất.
      `.repeat(6),
    },
    {
      title: 'Khởi nghĩa Lam Sơn và Hội thề Đông Quan 1427',
      source: 'Lam Sơn Thực Lục',
      dynasty: 'Nhà Lê (Lê Sơ)',
      sourceReliability: 'LEVEL_1' as const,
      content: `
Cuộc khởi nghĩa Lam Sơn do Bình Định Vương Lê Lợi khởi xướng năm 1418 tại vùng núi Lam Sơn (Thanh Hóa) là cuộc chiến tranh giải phóng dân tộc trường kỳ và vĩ đại nhất thế kỷ 15. Dưới sự lãnh đạo sáng suốt của Lê Lợi và quân sư Nguyễn Trãi, nghĩa quân Lam Sơn đã vượt qua muôn vàn gian khổ trong giai đoạn đầu nếm mật nằm gai tại vùng núi Chí Linh.

Nguyễn Trãi đã vạch ra đường lối kháng chiến mưu phạt tâm công, lấy nhân nghĩa để thắng hung tàn, lấy chí nhân để thay cường bạo. Nghĩa quân từng bước chuyển từ thế phòng thủ sang tiến công giải phóng Nghệ An, Thuận Hóa, Tân Bình rồi tiến quân ra Bắc Hà vây hãm thành Đông Quan.

Trận quyết chiến chiến lược Chi Lăng - Xương Giang mùa thu năm 1427 đã giáng đòn quyết định vào đạo viện binh 10 vạn quân Minh do An Viễn hầu Liễu Thăng chỉ huy. Tướng giặc Liễu Thăng bị chém đầu tại ải Chi Lăng, tướng Lương Minh và Lý Khánh tự vẫn. Đạo quân viện binh thứ hai của Mộc Thạnh nghe tin thất đảm vội vã tháo chạy về Vân Nam.

Sau đại thắng Chi Lăng - Xương Giang, tổng binh Vương Thông trong thành Đông Quan cùng đường phải chấp nhận giảng hòa tại Hội thề Đông Quan vào tháng 12 năm 1427. Lê Lợi đã cấp ngựa, thuyền và lương thảo cho 10 vạn tàn quân Minh rút về nước an toàn, thể hiện tư tưởng nhân đạo và hòa hiếu sâu sắc của dân tộc Đại Việt.
      `.repeat(6),
    },
    {
      title: 'Chiến dịch Điện Biên Phủ 1954',
      source: 'Lịch sử Kháng chiến Chống Pháp',
      dynasty: 'Hiện đại',
      sourceReliability: 'LEVEL_1' as const,
      content: `
Chiến dịch Điện Biên Phủ diễn ra từ ngày 13 tháng 3 đến ngày 7 tháng 5 năm 1954 tại thung lũng Mường Thanh (tỉnh Điện Biên) là trận quyết chiến chiến lược đỉnh cao trong cuộc kháng chiến chống thực dân Pháp của quân và dân Việt Nam.

Đại tướng Tổng tư lệnh Võ Nguyên Giáp trên cương vị Chỉ huy trưởng kiêm Bí thư Đảng ủy chiến dịch đã đưa ra quyết định lịch sử: chuyển phương châm tác chiến từ Đánh nhanh thắng nhanh sang Đánh chắc tiến chắc. Quyết định này bảo đảm tiêu diệt từng cứ điểm phòng ngự kiên cố của tập đoàn cứ điểm Điện Biên Phủ do tướng De Castries chỉ huy.

Trải qua 56 ngày đêm khoét núi, ngủ hầm, mưa dầm, cơm vắt, máu trộn bùn non, quân đội Việt Nam đã lần lượt tiêu diệt các phân khu Bắc (Him Lam, Độc Lập, Bản Kéo), phân khu Trung tâm (đồi A1, C1, D1) và tiến thẳng vào sở chỉ huy bắt sống tướng De Castries cùng toàn bộ ban tham mưu vào chiều ngày 7 tháng 5 năm 1754.

Chiến thắng Điện Biên Phủ lừng lẫy năm châu, chấn động địa cầu đã đập tan hoàn toàn kế hoạch Navarre của thực dân Pháp, buộc chính phủ Pháp phải ký kết Hiệp định Genève chấm dứt chiến tranh, công nhận độc lập, chủ quyền, thống nhất và toàn vẹn lãnh thổ của ba nước Đông Dương.
      `.repeat(6),
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
      if (wCount >= 100 && wCount <= 650) {
        childWordCountCompliant++;
      }
    }

    // 5. Metadata extraction
    for (const child of chunkResult.childChunks) {
      if (child.metadata && (child.metadata.sourceReliability || child.metadata.dynasty)) {
        metadataCorrectCount++;
      }
    }

    // 2. Syntax integrity
    for (const child of chunkResult.childChunks) {
      const trimmed = child.textContent.trim();
      if (/[.!?)"'»]$/.test(trimmed)) {
        syntaxIntact++;
      }
    }

    // 3. Parent-child link integrity
    const parentIdSet = new Set(chunkResult.parentChunks.map((p) => p.id));
    for (const child of chunkResult.childChunks) {
      const pId = child.metadata?.parentChunkId;
      if (pId && parentIdSet.has(pId)) {
        validParentLinks++;
      }
    }

    // 4. Overlap consistency
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
    childWordComplianceRate >= 95.0 &&
    syntaxIntegrityScore >= 85.0 &&
    parentChildLinkIntegrity >= 100.0 &&
    eventBoundaryPreservation >= 90.0 &&
    throughputWordsPerSec >= 20000;

  const report: ComponentBenchmarkReport = {
    benchmark_id: 'C1',
    name: 'Chunking & Document Ingestion Benchmark',
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
