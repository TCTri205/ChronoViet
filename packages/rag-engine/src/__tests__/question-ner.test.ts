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
});
