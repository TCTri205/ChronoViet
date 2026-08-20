import { describe, it, expect, beforeEach } from 'vitest';
import { inMemoryStore, envConfig } from '@chronoviet/shared-spec';
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
});
