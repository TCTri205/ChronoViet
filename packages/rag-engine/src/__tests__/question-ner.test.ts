import { describe, it, expect } from 'vitest';
import { extractQueryEntities } from '../retrieval/question-ner.js';

describe('Question NER in Chrono-RAG Runtime', () => {
  it('should extract canonical entities from natural language questions', () => {
    const query = 'Chiến thắng Bạch Đằng năm 938 do Ngô Quyền chỉ huy đánh tan quân Nam Hán như thế nào?';
    const result = extractQueryEntities(query);

    expect(result.entityIds).toContain('person_ngo_quyen');
    expect(result.entityNames).toContain('Ngô Quyền');
    expect(result.entityIds).toContain('dynasty_nam_han');
  });

  it('should resolve historical aliases to canonical entity IDs', () => {
    const query = 'Bắc Bình Vương Nguyễn Huệ lên ngôi Hoàng đế tại núi Bân năm nào?';
    const result = extractQueryEntities(query);

    expect(result.entityIds).toContain('person_quang_trung');
    expect(result.entityNames).toContain('Quang Trung');
  });

  it('should extract document and era entities from user query', () => {
    const query = 'Năm 1010, vua Lý Thái Tổ ban Chiếu dời đô dời kinh đô về Thăng Long.';
    const result = extractQueryEntities(query);

    expect(result.entityIds).toContain('person_ly_thai_to');
    expect(result.entityIds).toContain('doc_chieu_doi_do');
    expect(result.entityIds).toContain('loc_ha_noi');
    expect(result.entityNames).toContain('Hà Nội');
  });

  it('should resolve ancient locations (Đông Quan, Phú Xuân, Gia Định) to canonical entity IDs', () => {
    const query1 = 'Quân Minh chiếm đóng thành Đông Quan năm bao nhiêu?';
    const res1 = extractQueryEntities(query1);
    expect(res1.entityIds).toContain('loc_ha_noi');
    expect(res1.entityNames).toContain('Hà Nội');

    const query2 = 'Chúa Nguyễn thiên đô về Phú Xuân vào thời kỳ nào?';
    const res2 = extractQueryEntities(query2);
    expect(res2.entityIds).toContain('loc_hue');
    expect(res2.entityNames).toContain('Huế');

    const query3 = 'Nguyễn Hữu Cảnh kinh lược xứ Gia Định lập nên phủ Gia Định năm 1698.';
    const res3 = extractQueryEntities(query3);
    expect(res3.entityIds).toContain('loc_ho_chi_minh');
    expect(res3.entityNames).toContain('Thành phố Hồ Chí Minh');
  });

  it('should execute in sub-15ms without any LLM dependency', () => {
    const query = 'Trần Hưng Đạo soạn Hịch tướng sĩ để hiệu triệu quân đội nhà Trần quyết chiến với quân Nguyên Mông ra sao?';
    const t0 = performance.now();
    for (let i = 0; i < 50; i++) {
      extractQueryEntities(query);
    }
    const avgMs = (performance.now() - t0) / 50;
    expect(avgMs).toBeLessThan(15.0);
  });

  it('should filter question stopwords and extract clean query keywords', () => {
    const query = 'Tại sao vua Quang Trung lại tiến quân thần tốc ra Thăng Long vào dịp Tết Kỷ Dậu?';
    const result = extractQueryEntities(query);

    expect(result.entityIds).toContain('person_quang_trung');
    expect(result.keywords).not.toContain('tại');
    expect(result.keywords).not.toContain('sao');
    expect(result.keywords).not.toContain('vào');
    expect(result.keywords).toContain('thần');
    expect(result.keywords).toContain('tốc');
  });

  it('should accurately extract historical years, 2-digit years, BCE/TCN, and centuries', () => {
    const res1 = extractQueryEntities('Chiến thắng Bạch Đằng năm 938 do Ngô Quyền chỉ huy');
    expect(res1.extractedYears).toContain(938);

    const res2 = extractQueryEntities('Năm 40, Hai Bà Trưng phất cờ khởi nghĩa chống nhà Đông Hán');
    expect(res2.extractedYears).toContain(40);

    const res3 = extractQueryEntities('An Dương Vương xây thành Cổ Loa năm 257 TCN sau khi thống nhất Âu Việt và Lạc Việt');
    expect(res3.extractedYears).toContain(-257);

    const res4 = extractQueryEntities('Nghệ thuật quân sự thế kỷ XIII của quân dân nhà Trần ba lần đánh tan quân Nguyên Mông');
    expect(res4.extractedYears).toContain(1250);
    expect(res4.temporalRange).toEqual({ start: 1201, end: 1300 });

    const res5 = extractQueryEntities('So sánh 2 vị tướng và top 5 trận đánh tiêu biểu với 10 vạn quân tinh nhuệ');
    expect(res5.extractedYears).toEqual([]);

    const res6 = extractQueryEntities('Chiến dịch Điện Biên Phủ trong kháng chiến chống Pháp giai đoạn 1945-1954');
    expect(res6.extractedYears).toContain(1945);
    expect(res6.extractedYears).toContain(1954);
    expect(res6.temporalRange).toEqual({ start: 1945, end: 1954 });
  });
});

describe('Historical Premise Incompatibility & Adversarial Trap Validation', () => {
  it('should detect anachronistic technology in ancient/medieval events', async () => {
    const { validateQueryHistoricalPremises } = await import('../retrieval/question-ner.js');

    const res1 = validateQueryHistoricalPremises('Ngô Quyền dùng tàu bọc thép đánh tan quân Nam Hán trên sông Bạch Đằng năm 938 như thế nào?');
    expect(res1.hasPremiseConflict).toBe(true);
    expect(res1.conflictType).toBe('ANACHRONISTIC_WEAPONRY_TECH');
    expect(res1.conflictReason).toContain('tàu bọc thép');

    const res2 = validateQueryHistoricalPremises('Trần Hưng Đạo sử dụng súng máy và máy bay trong trận Bạch Đằng 1288');
    expect(res2.hasPremiseConflict).toBe(true);
    expect(res2.conflictType).toBe('ANACHRONISTIC_WEAPONRY_TECH');
  });

  it('should detect mythological entities in modern historical/legal events', async () => {
    const { validateQueryHistoricalPremises } = await import('../retrieval/question-ner.js');

    const res = validateQueryHistoricalPremises('Thần Kim Quy đại diện cho Việt Nam ký kết Hiệp định Geneva năm 1954 đúng không?');
    expect(res.hasPremiseConflict).toBe(true);
    expect(res.conflictType).toBe('MYTHOLOGY_HISTORICAL_INCOMPATIBILITY');
    expect(res.conflictReason).toContain('Thần Kim Quy');
  });

  it('should detect severe chronological mismatches for single figures', async () => {
    const { validateQueryHistoricalPremises } = await import('../retrieval/question-ner.js');

    const res = validateQueryHistoricalPremises('Ngô Quyền lãnh đạo nhân dân đánh tan quân Thanh vào năm 1975');
    expect(res.hasPremiseConflict).toBe(true);
    expect(res.conflictType).toBe('CHRONOLOGY_MISMATCH');
  });

  it('should NOT trigger false positives on legitimate multi-dynasty comparative queries', async () => {
    const { validateQueryHistoricalPremises } = await import('../retrieval/question-ner.js');

    const query1 = 'So sánh nghệ thuật quân sự của Ngô Quyền năm 938 và Trần Hưng Đạo năm 1288 trên sông Bạch Đằng';
    const res1 = validateQueryHistoricalPremises(query1);
    expect(res1.hasPremiseConflict).toBe(false);

    const query2 = 'Trận Bạch Đằng năm 938 và trận Bạch Đằng năm 981 có điểm gì giống và khác nhau?';
    const res2 = validateQueryHistoricalPremises(query2);
    expect(res2.hasPremiseConflict).toBe(false);

    const query3 = 'Quang Trung đại phá 29 vạn quân Thanh vào Tết Kỷ Dậu 1789 như thế nào?';
    const res3 = validateQueryHistoricalPremises(query3);
    expect(res3.hasPremiseConflict).toBe(false);

    const query4 = 'Phan Bội Châu đóng vai trò là hạt nhân của phong trào Đông Du như thế nào?';
    const res4 = validateQueryHistoricalPremises(query4);
    expect(res4.hasPremiseConflict).toBe(false);
  });
});
