import { describe, it, expect, beforeEach } from 'vitest';
import { inMemoryStore, envConfig } from '@chronoviet/infra';
import { getChunksForEntities } from '../retrieval/chunk-retriever.js';

describe('Graph-Guided Chunk Retriever', () => {
  beforeEach(() => {
    envConfig.FORCE_OFFLINE = true;
    envConfig.SKIP_PG = true;
    inMemoryStore.clear();
  });

  it('should return empty array when entityIds is empty or limit is <= 0', async () => {
    const res1 = await getChunksForEntities([]);
    expect(res1).toEqual([]);

    const res2 = await getChunksForEntities(['person_tran_hung_dao'], 0);
    expect(res2).toEqual([]);
  });

  it('should retrieve linked document chunks for specified entities', async () => {
    inMemoryStore.documentChunks.set('chunk_thd_1', {
      id: 'chunk_thd_1',
      title: 'Hịch Tướng Sĩ',
      text_content: 'Ta thường nghe: Kỷ Tín đem mình chết thay, cứu thoát Cao Đế...',
      dynasty: 'Nhà Trần',
      source_reliability: 'LEVEL_1',
    });
    inMemoryStore.entityChunks.push({
      entity_id: 'person_tran_hung_dao',
      chunk_id: 'chunk_thd_1',
    });

    inMemoryStore.documentChunks.set('chunk_other', {
      id: 'chunk_other',
      title: 'Khởi nghĩa Hai Bà Trưng',
      text_content: 'Hai Bà Trưng phất cờ khởi nghĩa ở Hát Môn.',
      source_reliability: 'LEVEL_1',
    });
    inMemoryStore.entityChunks.push({
      entity_id: 'person_hai_ba_trung',
      chunk_id: 'chunk_other',
    });

    const res = await getChunksForEntities(['person_tran_hung_dao'], 10);
    expect(res).toHaveLength(1);
    expect(res[0].chunkId).toBe('chunk_thd_1');
    expect(res[0].title).toBe('Hịch Tướng Sĩ');
    expect(res[0].dynasty).toBe('Nhà Trần');
    expect(res[0].score).toBeCloseTo(1 / 61, 5);
  });

  it('should enforce chunk retrieval limit and rank-calibrated scores', async () => {
    for (let i = 1; i <= 5; i++) {
      const chunkId = `chunk_limit_${i}`;
      inMemoryStore.documentChunks.set(chunkId, {
        id: chunkId,
        title: `Chunk Title ${i}`,
        text_content: `Content for chunk ${i}`,
        source_reliability: 'LEVEL_1',
      });
      inMemoryStore.entityChunks.push({
        entity_id: 'person_le_loi',
        chunk_id: chunkId,
      });
    }

    const res = await getChunksForEntities(['person_le_loi'], 2);
    expect(res).toHaveLength(2);
    expect(res[0].score).toBeCloseTo(1 / 61, 5);
    expect(res[1].score).toBeCloseTo(1 / 62, 5);
  });

  it('should deterministically order retrieved chunks by source reliability (LEVEL_1 > LEVEL_2 > LEVEL_3)', async () => {
    inMemoryStore.documentChunks.set('chunk_lev3', {
      id: 'chunk_lev3',
      title: 'Tài liệu cấp 3',
      text_content: 'Nội dung cấp 3',
      source_reliability: 'LEVEL_3',
    });
    inMemoryStore.documentChunks.set('chunk_lev1', {
      id: 'chunk_lev1',
      title: 'Tài liệu cấp 1',
      text_content: 'Nội dung cấp 1',
      source_reliability: 'LEVEL_1',
    });
    inMemoryStore.documentChunks.set('chunk_lev2', {
      id: 'chunk_lev2',
      title: 'Tài liệu cấp 2',
      text_content: 'Nội dung cấp 2',
      source_reliability: 'LEVEL_2',
    });

    inMemoryStore.entityChunks.push(
      { entity_id: 'person_quang_trung', chunk_id: 'chunk_lev3' },
      { entity_id: 'person_quang_trung', chunk_id: 'chunk_lev1' },
      { entity_id: 'person_quang_trung', chunk_id: 'chunk_lev2' }
    );

    const res = await getChunksForEntities(['person_quang_trung'], 3);
    expect(res).toHaveLength(3);
    expect(res[0].chunkId).toBe('chunk_lev1');
    expect(res[1].chunkId).toBe('chunk_lev2');
    expect(res[2].chunkId).toBe('chunk_lev3');
  });

  it('should prioritize chunks matching targetYear (e.g. 1972 over 1954)', async () => {
    inMemoryStore.documentChunks.set('chunk_dbp_1954', {
      id: 'chunk_dbp_1954',
      title: 'Chiến dịch Điện Biên Phủ 1954',
      text_content: 'Chiến thắng Điện Biên Phủ lừng lẫy năm châu chấn động địa cầu năm 1954.',
      time_start: 1954,
      time_end: 1954,
      source_reliability: 'LEVEL_1',
    });
    inMemoryStore.documentChunks.set('chunk_dbp_1972', {
      id: 'chunk_dbp_1972',
      title: 'Chiến dịch Điện Biên Phủ trên không 1972',
      text_content: 'Chiến dịch 12 ngày đêm Điện Biên Phủ trên không bảo vệ Hà Nội năm 1972.',
      time_start: 1972,
      time_end: 1972,
      source_reliability: 'LEVEL_2',
    });

    inMemoryStore.entityChunks.push(
      { entity_id: 'event_dien_bien_phu', chunk_id: 'chunk_dbp_1954' },
      { entity_id: 'event_dien_bien_phu', chunk_id: 'chunk_dbp_1972' }
    );

    // Query asking for 1972 targetYear
    const res1972 = await getChunksForEntities(
      ['event_dien_bien_phu'],
      10,
      ['event_dien_bien_phu'],
      undefined,
      1972
    );
    expect(res1972[0].chunkId).toBe('chunk_dbp_1972');

    // Query asking for 1954 targetYear
    const res1954 = await getChunksForEntities(
      ['event_dien_bien_phu'],
      10,
      ['event_dien_bien_phu'],
      undefined,
      1954
    );
    expect(res1954[0].chunkId).toBe('chunk_dbp_1954');
  });
});
