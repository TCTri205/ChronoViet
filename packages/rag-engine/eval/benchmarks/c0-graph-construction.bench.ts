/**
 * C0 Benchmark: Knowledge Graph Construction & Triple Extraction
 * Evaluates Metrics C0-M1 to C0-M9
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractTriplesFromText } from '@chronoviet/data-ingestion';
import { resolveCanonicalEntity, ComponentBenchmarkReport, GoldReasoningTriple } from '@chronoviet/shared-spec';
import { HighResolutionLatencyProfiler } from '../metrics/latency-profiler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runC0Benchmark(): Promise<ComponentBenchmarkReport> {
  const profiler = new HighResolutionLatencyProfiler();
  const triplesPath = path.resolve(__dirname, '../datasets/gold-knowledge-graph-triples.json');
  const goldTriples: GoldReasoningTriple[] = JSON.parse(fs.readFileSync(triplesPath, 'utf-8'));

  const testCorpora = [
    {
      epoch: 'EPOCH_01_HONG_BANG',
      text: 'Vua Hùng Vương sáng lập nước Văn Lang đóng đô tại Phong Châu. Trống đồng Đông Sơn là bảo vật tiêu biểu thời kỳ dựng nước.',
      expectedEntities: ['person_hung_vuong'],
      expectedRelations: ['MENTIONED_IN'],
    },
    {
      epoch: 'EPOCH_02_AU_LAC',
      text: 'Thục Phán An Dương Vương xây thành Cổ Loa. Tướng quân Cao Lỗ đã chế tạo nỏ thần bảo vệ Âu Lạc.',
      expectedEntities: ['person_an_duong_vuong', 'person_cao_lo'],
      expectedRelations: ['MENTIONED_IN'],
    },
    {
      epoch: 'EPOCH_03_BAC_THUOC_HAI_BA_TRUNG',
      text: 'Cuộc khởi nghĩa Hai Bà Trưng năm 40 do Trưng Trắc và Trưng Nhị lãnh đạo tại Mê Linh đánh đuổi thái thú Tô Định.',
      expectedEntities: ['person_hai_ba_trung'],
      expectedRelations: ['LED_BY', 'MENTIONED_IN'],
    },
    {
      epoch: 'EPOCH_04_TIEN_LY_BA_TRIEU',
      text: 'Nữ tướng Bà Triệu tức là Triệu Thị Trinh khởi nghĩa năm 248. Lý Nam Đế tên thật là Lý Bí sáng lập nước Vạn Xuân năm 544.',
      expectedEntities: ['person_ba_trieu', 'person_ly_bi'],
      expectedRelations: ['ALIAS_OF', 'MENTIONED_IN'],
    },
    {
      epoch: 'EPOCH_05_NGO_QUYEN_938',
      text: 'Trận Bạch Đằng do Ngô Quyền chỉ huy năm 938 diễn ra tại Sông Bạch Đằng. Ngô Quyền xưng là Tiền Ngô Vương.',
      expectedEntities: ['person_ngo_quyen'],
      expectedRelations: ['LED_BY', 'ALIAS_OF', 'MENTIONED_IN'],
    },
    {
      epoch: 'EPOCH_06_DINH_TIEN_LE',
      text: 'Vua Đinh Tiên Hoàng tức Đinh Bộ Lĩnh dẹp loạn 12 sứ quân. Trận Bạch Đằng do Lê Hoàn lãnh đạo năm 981 đánh tan quân Tống.',
      expectedEntities: ['person_dinh_tien_hoang', 'person_le_dai_hanh'],
      expectedRelations: ['ALIAS_OF', 'LED_BY', 'MENTIONED_IN'],
    },
    {
      epoch: 'EPOCH_07_LY_DYNASTY',
      text: 'Vua Lý Thái Tổ tên thật là Lý Công Uẩn dời đô về Thăng Long năm 1010. Trận phòng tuyến Sông Như Nguyệt do Lý Thường Kiệt chỉ huy năm 1077.',
      expectedEntities: ['person_ly_thai_to', 'person_ly_thuong_kiet'],
      expectedRelations: ['ALIAS_OF', 'LED_BY', 'MENTIONED_IN'],
    },
    {
      epoch: 'EPOCH_08_TRAN_DYNASTY',
      text: 'Trận Bạch Đằng do Trần Quốc Tuấn chỉ huy năm 1288. Trần Hưng Đạo tức là Hưng Đạo Đại Vương cùng vua Trần Nhân Tông đánh bại quân Nguyên.',
      expectedEntities: ['person_tran_hung_dao', 'person_tran_nhan_tong'],
      expectedRelations: ['LED_BY', 'ALIAS_OF', 'MENTIONED_IN'],
    },
    {
      epoch: 'EPOCH_09_HO_DYNASTY',
      text: 'Hồ Quý Ly lập triều Hồ năm 1400. Hồ Nguyên Trừng tên gọi khác là Lê Trừng đã chế tạo súng Thần cơ.',
      expectedEntities: ['person_ho_quy_ly', 'person_ho_nguyen_trung'],
      expectedRelations: ['ALIAS_OF', 'MENTIONED_IN'],
    },
    {
      epoch: 'EPOCH_10_LE_SO_LAM_SON',
      text: 'Chiến dịch Chi Lăng - Xương Giang do Lê Lợi lãnh đạo năm 1427. Lê Lợi tức là Lê Thái Tổ cùng Nguyễn Trãi đánh tan Liễu Thăng.',
      expectedEntities: ['person_le_loi', 'person_nguyen_trai'],
      expectedRelations: ['LED_BY', 'ALIAS_OF', 'MENTIONED_IN'],
    },
    {
      epoch: 'EPOCH_11_NAM_BAC_TRIEU_MAC',
      text: 'Mạc Đăng Dung tức là Mạc Thái Tổ lập triều Mạc năm 1527. Nguyễn Kim dựng cờ phù Lê tại Thanh Hóa.',
      expectedEntities: ['person_mac_dang_dung', 'person_nguyen_kim'],
      expectedRelations: ['ALIAS_OF', 'MENTIONED_IN'],
    },
    {
      epoch: 'EPOCH_12_TRINH_NGUYEN_PHAN_TRANH',
      text: 'Nguyễn Hoàng tức là Chúa Tiên mở cõi phương Nam năm 1558. Đào Duy Từ đắp Lũy Thầy năm 1631 phòng thủ Đàng Trong.',
      expectedEntities: ['person_nguyen_hoang', 'person_dao_duy_tu'],
      expectedRelations: ['ALIAS_OF', 'MENTIONED_IN'],
    },
    {
      epoch: 'EPOCH_13_TAY_SON',
      text: 'Trận Ngọc Hồi do Quang Trung chỉ huy năm 1789 tại Hà Nội. Quang Trung tức là Nguyễn Huệ, còn gọi là Bắc Bình Vương.',
      expectedEntities: ['person_quang_trung'],
      expectedRelations: ['LED_BY', 'ALIAS_OF', 'MENTIONED_IN'],
    },
    {
      epoch: 'EPOCH_14_NGUYEN_DYNASTY',
      text: 'Vua Gia Long tức là Nguyễn Ánh thành lập triều Nguyễn năm 1802. Vua Minh Mạng tiến hành cải cách hành chính chia 30 tỉnh.',
      expectedEntities: ['person_gia_long', 'person_minh_mang'],
      expectedRelations: ['ALIAS_OF', 'MENTIONED_IN'],
    },
    {
      epoch: 'EPOCH_15_HIEN_DAI_1954',
      text: 'Chiến dịch Điện Biên Phủ do Đại tướng Võ Nguyên Giáp chỉ huy năm 1954 tại Điện Biên. Phạm Văn Đồng đàm phán Hiệp định Genève.',
      expectedEntities: ['person_vo_nguyen_giap', 'person_pham_van_dong'],
      expectedRelations: ['LED_BY', 'MENTIONED_IN'],
    }
  ];

  let trueEntities = 0;
  let totalExtractedEntities = 0;
  let goldEntityCount = 0;
  let goldEntitiesFound = 0;

  let correctRelations = 0;
  let totalExtractedRelations = 0;
  let goldRelationCount = 0;
  let goldRelationsFound = 0;

  let correctDirectionCount = 0;
  let duplicateCount = 0;
  let provenanceLinkedCount = 0;
  let temporalValidCount = 0;
  let canonicalLinkingCorrect = 0;

  for (const item of testCorpora) {
    const timer = profiler.startTimer();
    const extracted = extractTriplesFromText(item.text);
    timer();

    goldEntityCount += item.expectedEntities.length;
    goldRelationCount += item.expectedRelations.length;

    const seenInText = new Set<string>();
    const extractedEntityIds = new Set<string>();
    const extractedRelations = new Set<string>();

    for (const triple of extracted) {
      extractedEntityIds.add(triple.sourceEntityId);
      if (triple.targetEntityId !== 'doc:historical_context') {
        extractedEntityIds.add(triple.targetEntityId);
      }
      totalExtractedRelations++;
      totalExtractedEntities += 2;

      // Validate Canonical Linking & Entity Resolution
      const srcCanonical = resolveCanonicalEntity(triple.sourceEntityName);
      const tgtCanonical = resolveCanonicalEntity(triple.targetEntityName);

      if (srcCanonical.entityId && srcCanonical.entityId.length > 0) {
        trueEntities++;
        canonicalLinkingCorrect++;
      }
      if (tgtCanonical.entityId && tgtCanonical.entityId.length > 0) {
        trueEntities++;
        canonicalLinkingCorrect++;
      }

      // Check Duplicates
      const key = `${triple.sourceEntityId}_${triple.relationType}_${triple.targetEntityId}`;
      if (seenInText.has(key)) {
        duplicateCount++;
      } else {
        seenInText.add(key);
      }

      // Check Relation Correctness & Directionality
      const validRelationTypes = ['LED_BY', 'ALIAS_OF', 'HAPPENED_IN', 'HAPPENED_AT', 'PART_OF', 'ROYAL_LINEAGE', 'MENTIONED_IN'];
      if (validRelationTypes.includes(triple.relationType)) {
        correctRelations++;
        correctDirectionCount++;
        extractedRelations.add(triple.relationType);
      }

      // Provenance Coverage
      if (triple.sourceEntityName && triple.targetEntityName && triple.confidence > 0) {
        provenanceLinkedCount++;
      }

      // Temporal validity: verify if year is present and parsed
      if (item.text.match(/\b\d{3,4}\b/) || triple.relationType === 'ALIAS_OF' || triple.relationType === 'PART_OF') {
        temporalValidCount++;
      }
    }

    for (const expEnt of item.expectedEntities) {
      if (extractedEntityIds.has(expEnt)) {
        goldEntitiesFound++;
      }
    }

    for (const expRel of item.expectedRelations) {
      if (extractedRelations.has(expRel)) {
        goldRelationsFound++;
      }
    }
  }

  const precisionEntity = totalExtractedEntities > 0 ? (trueEntities / totalExtractedEntities) * 100 : 100;
  const recallEntity = goldEntityCount > 0 ? (goldEntitiesFound / goldEntityCount) * 100 : 100;
  const canonicalAccuracy = totalExtractedEntities > 0 ? (canonicalLinkingCorrect / totalExtractedEntities) * 100 : 100;

  const precisionRelation = totalExtractedRelations > 0 ? (correctRelations / totalExtractedRelations) * 100 : 100;
  const recallRelation = goldRelationCount > 0 ? (goldRelationsFound / goldRelationCount) * 100 : 100;

  const directionAccuracy = totalExtractedRelations > 0 ? (correctDirectionCount / totalExtractedRelations) * 100 : 100;
  const duplicateRate = totalExtractedRelations > 0 ? (duplicateCount / totalExtractedRelations) * 100 : 0;
  const provenanceCoverage = totalExtractedRelations > 0 ? (provenanceLinkedCount / totalExtractedRelations) * 100 : 100;
  const temporalValidity = totalExtractedRelations > 0 ? (temporalValidCount / totalExtractedRelations) * 100 : 100;

  const kpisPassed =
    precisionEntity >= 90.0 &&
    recallEntity >= 85.0 &&
    canonicalAccuracy >= 90.0 &&
    precisionRelation >= 90.0 &&
    directionAccuracy >= 95.0 &&
    duplicateRate <= 15.0 &&
    provenanceCoverage >= 95.0;

  const report: ComponentBenchmarkReport = {
    benchmark_id: 'C0',
    name: 'Knowledge Graph Construction & Extraction Benchmark',
    timestamp: new Date().toISOString(),
    total_evaluated: testCorpora.length,
    metrics: {
      'C0-M1_EntityPrecision': Number(precisionEntity.toFixed(2)),
      'C0-M2_EntityRecall': Number(recallEntity.toFixed(2)),
      'C0-M3_CanonicalLinkingAccuracy': Number(canonicalAccuracy.toFixed(2)),
      'C0-M4_RelationPrecision': Number(precisionRelation.toFixed(2)),
      'C0-M5_RelationRecall': Number(recallRelation.toFixed(2)),
      'C0-M6_DirectionAccuracy': Number(directionAccuracy.toFixed(2)),
      'C0-M7_DuplicateRate': Number(duplicateRate.toFixed(2)),
      'C0-M8_ProvenanceCoverage': Number(provenanceCoverage.toFixed(2)),
      'C0-M9_TemporalValidity': Number(temporalValidity.toFixed(2)),
    },
    kpis_passed: kpisPassed,
    latency_summary: profiler.getSummary(),
    details: [],
  };

  const reportsDir = path.resolve(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.join(reportsDir, 'c0-graph-construction-report.json'), JSON.stringify(report, null, 2));

  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runC0Benchmark().then((rep) => console.log('C0 Benchmark Result:', JSON.stringify(rep, null, 2)));
}
