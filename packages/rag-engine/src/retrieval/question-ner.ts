/**
 * Question Entity Extraction & Keyword Parsing (Question NER)
 */

import { resolveCanonicalEntity } from '@chronoviet/shared-spec';


export interface ExtractedQueryInfo {
  entityIds: string[];
  entityNames: string[];
  keywords: string[];
}

const HISTORICAL_SEED_TERMS = [
  'Quang Trung',
  'Nguyễn Huệ',
  'Trần Hưng Đạo',
  'Trần Quốc Tuấn',
  'Lê Lợi',
  'Ngô Quyền',
  'Hà Nội',
  'Thăng Long',
  'Hoa Lư',
  'Sài Gòn',
  'Huế',
  'Phú Xuân',
  'Trận Ngọc Hồi',
  'Tốt Động',
  'Bạch Đằng',
  'Nhà Tây Sơn',
  'Nhà Lê',
  'Nhà Trần',
];

export function extractQueryEntities(queryText: string): ExtractedQueryInfo {
  if (!queryText) return { entityIds: [], entityNames: [], keywords: [] };

  const entityIds: string[] = [];
  const entityNames: string[] = [];
  const keywords: string[] = queryText.split(/\s+/).filter((w) => w.length > 2);

  for (const seed of HISTORICAL_SEED_TERMS) {
    if (queryText.toLowerCase().includes(seed.toLowerCase())) {
      const entity = resolveCanonicalEntity(seed);
      if (!entityIds.includes(entity.entityId)) {
        entityIds.push(entity.entityId);
        entityNames.push(entity.canonicalName);
      }
    }
  }

  // Fallback: If no seed term matched, resolve the longest capitalised words
  if (entityIds.length === 0) {
    const caps = queryText.match(/[A-ZÀ-Ỹ][a-zà-ỹ]+/g);
    if (caps && caps.length > 0) {
      const candidateName = caps.join(' ');
      const entity = resolveCanonicalEntity(candidateName);
      entityIds.push(entity.entityId);
      entityNames.push(entity.canonicalName);
    }
  }

  return {
    entityIds,
    entityNames,
    keywords,
  };
}
