import { describe, it, expect, beforeEach } from 'vitest';
import { inMemoryStore, envConfig } from '@chronoviet/shared-spec';
import { searchLocalGraphCTE } from '../retrieval/graph-cte-search.js';

describe('Graph CTE Subgraph Search & Traversal', () => {
  beforeEach(() => {
    envConfig.FORCE_OFFLINE = true;
    envConfig.SKIP_PG = true;
    inMemoryStore.clear();
  });

  it('should return empty result when entityIds is empty', async () => {
    const res = await searchLocalGraphCTE([]);
    expect(res.triples).toEqual([]);
    expect(res.aliasTable).toEqual({});
    expect(res.entityIds).toEqual([]);
  });

  it('should traverse 1-hop relationships in in-memory graph fallback', async () => {
    inMemoryStore.relationships.push({
      id: 1,
      source_entity_id: 'person_le_loi',
      target_entity_id: 'person_nguyen_trai',
      relation_type: 'ALLY_OF',
      confidence: 1.0,
    });

    const res = await searchLocalGraphCTE(['person_le_loi'], 1);
    expect(res.triples).toHaveLength(1);
    expect(res.triples[0]).toEqual({
      sourceEntityId: 'person_le_loi',
      relationType: 'ALLY_OF',
      targetEntityId: 'person_nguyen_trai',
      confidence: 1.0,
      hopCount: 1,
    });
    expect(res.entityIds).toContain('person_le_loi');
    expect(res.entityIds).toContain('person_nguyen_trai');
  });

  it('should traverse 2-hop relationships and prune cycles without duplicate triples', async () => {
    inMemoryStore.relationships.push(
      {
        id: 1,
        source_entity_id: 'person_quang_trung',
        target_entity_id: 'person_nguyen_nhac',
        relation_type: 'BROTHER_OF',
        confidence: 1.0,
      },
      {
        id: 2,
        source_entity_id: 'person_nguyen_nhac',
        target_entity_id: 'person_nguyen_lu',
        relation_type: 'BROTHER_OF',
        confidence: 1.0,
      },
      {
        id: 3,
        source_entity_id: 'person_nguyen_lu',
        target_entity_id: 'person_quang_trung',
        relation_type: 'BROTHER_OF',
        confidence: 1.0,
      }
    );

    const res = await searchLocalGraphCTE(['person_quang_trung'], 2);

    const uniqueTriples = new Set(
      res.triples.map((t) => `${t.sourceEntityId}:${t.relationType}:${t.targetEntityId}`)
    );
    expect(uniqueTriples.size).toBe(res.triples.length);
    expect(res.entityIds).toContain('person_quang_trung');
    expect(res.entityIds).toContain('person_nguyen_nhac');
    expect(res.entityIds).toContain('person_nguyen_lu');
  });

  it('should construct and sort aliasTable by canonical name length descending', async () => {
    inMemoryStore.relationships.push({
      id: 1,
      source_entity_id: 'person_ly_thai_to',
      target_entity_id: 'loc_ha_noi',
      relation_type: 'RELOCATED_CAPITAL_TO',
      confidence: 1.0,
    });

    const res = await searchLocalGraphCTE(['person_ly_thai_to'], 1);

    const keys = Object.keys(res.aliasTable);
    expect(keys.length).toBeGreaterThanOrEqual(1);

    for (let i = 0; i < keys.length - 1; i++) {
      expect(keys[i].length).toBeGreaterThanOrEqual(keys[i + 1].length);
    }
  });
});
