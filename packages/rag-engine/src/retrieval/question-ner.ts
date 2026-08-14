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
  'Hồ Thơm',
  'Bắc Bình Vương',
  'Nguyễn Nhạc',
  'Nguyễn Lữ',
  'Tây Sơn Vương',
  'Trần Hưng Đạo',
  'Trần Quốc Tuấn',
  'Hưng Đạo Đại Vương',
  'Lê Lợi',
  'Lê Thái Tổ',
  'Bình Định Vương',
  'Nguyễn Trãi',
  'Ức Trai',
  'Ngô Quyền',
  'Tiền Ngô Vương',
  'Lý Thường Kiệt',
  'Ngô Tuấn',
  'Lý Thái Tổ',
  'Lý Công Uẩn',
  'Đinh Tiên Hoàng',
  'Đinh Bộ Lĩnh',
  'Lê Hoàn',
  'Lê Đại Hành',
  'Hai Bà Trưng',
  'Trưng Trắc',
  'Trưng Nhị',
  'Trưng Nữ Vương',
  'An Dương Vương',
  'Thục Phán',
  'Cao Lỗ',
  'Võ Nguyên Giáp',
  'Phạm Văn Đồng',
  'Liễu Thăng',
  'Vương Thông',
  'Sầm Nghi Đống',
  'Tôn Sĩ Nghị',
  'Hà Nội',
  'Thăng Long',
  'Đại La',
  'Đông Đô',
  'Đông Quan',
  'Đông Kinh',
  'Hoa Lư',
  'Sài Gòn',
  'Gia Định',
  'Bến Nghé',
  'Huế',
  'Phú Xuân',
  'Thuận Hóa',
  'Lam Sơn',
  'Cổ Loa',
  'Bạch Đằng',
  'Sông Bạch Đằng',
  'Như Nguyệt',
  'Sông Như Nguyệt',
  'Rạch Gầm',
  'Xoài Mút',
  'Chi Lăng',
  'Xương Giang',
  'Trận Ngọc Hồi',
  'Đống Đa',
  'Tốt Động',
  'Chúc Động',
  'Điện Biên Phủ',
  'Mê Linh',
  'Quy Nhơn',
  'Nhà Tây Sơn',
  'Tây Sơn',
  'Nhà Lê',
  'Lê Sơ',
  'Tiền Lê',
  'Nhà Trần',
  'Nhà Lý',
  'Nhà Đinh',
  'Nhà Ngô',
  'Nhà Nguyễn',
  'Nhà Hồ',
  'Văn Lang',
  'Âu Lạc',
  'Trưng Vương',
  'Trống đồng Đông Sơn',
  'Trống đồng Ngọc Lũ',
  'Văn hóa Đông Sơn',
  'Nỏ Liên Châu',
  'Nỏ thần',
  'Bình Ngô Đại Cáo',
  'Hịch Tướng Sĩ',
  'Nam Quốc Sơn Hà',
  'Chiếu dời đô',
  'Lệ Chi Viên',
  'Đại Việt Sử Ký Toàn Thư',
  'Nguyên Sử',
];

export function extractQueryEntities(queryText: string): ExtractedQueryInfo {
  if (!queryText) return { entityIds: [], entityNames: [], keywords: [] };

  const entityIds: string[] = [];
  const entityNames: string[] = [];
  const keywords: string[] = queryText.split(/\s+/).filter((w) => w.length > 2);

  // Sort seed terms by length descending to match longest phrases first (e.g. "Trần Hưng Đạo" before "Trần")
  const sortedSeeds = [...HISTORICAL_SEED_TERMS].sort((a, b) => b.length - a.length);

  for (const seed of sortedSeeds) {
    if (queryText.toLowerCase().includes(seed.toLowerCase())) {
      const entity = resolveCanonicalEntity(seed);
      if (!entityIds.includes(entity.entityId)) {
        entityIds.push(entity.entityId);
        entityNames.push(entity.canonicalName);
      }
    }
  }

  // Fallback: If no seed term matched, extract capitalized phrases
  if (entityIds.length === 0) {
    const caps = queryText.match(/[A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+)*/g);
    if (caps && caps.length > 0) {
      for (const candidate of caps) {
        const entity = resolveCanonicalEntity(candidate);
        if (!entityIds.includes(entity.entityId)) {
          entityIds.push(entity.entityId);
          entityNames.push(entity.canonicalName);
        }
      }
    }
  }

  return {
    entityIds,
    entityNames,
    keywords,
  };
}
