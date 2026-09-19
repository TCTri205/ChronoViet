import {
  resolveCanonicalEntity,
  HISTORICAL_PERSON_DICTIONARY,
} from '@chronoviet/shared-spec';

export interface ChronologyAnchorRule {
  id: string;
  match: (params: { resolvedIds: Set<string>; activeYears: number[]; queryLower: string }) => boolean;
  content: string;
}

export const CHRONOLOGY_ANCHOR_RULES: ChronologyAnchorRule[] = [
  {
    id: 'LE_HOAN_TIEN_LE',
    match: ({ resolvedIds, activeYears, queryLower }) =>
      resolvedIds.has('person_le_dai_hanh') ||
      resolvedIds.has('person_le_hoan') ||
      /\b(lê\s+hoàn|lê\s+đại\s+hành)\b/i.test(queryLower) ||
      ((activeYears.includes(981) || /\b981\b/.test(queryLower)) && (queryLower.includes('bạch đằng') || queryLower.includes('chống tống') || queryLower.includes('nhà lý'))),
    content:
      `• Lê Hoàn (Lê Đại Hành): Thuộc triều Tiền Lê (trị vì 980 - 1005). Lãnh đạo cuộc kháng chiến chống Tống lần thứ nhất thắng lợi rực rỡ năm 981 (chiến thắng Bạch Đằng năm 981). TUYỆT ĐỐI KHÔNG gán Lê Hoàn hoặc chiến thắng năm 981 vào nhà Lý (nhà Lý do Lý Thái Tổ sáng lập năm 1009, sau thời Tiền Lê).`,
  },
  {
    id: 'HO_QUY_LY_TRAN_THIEU_DE',
    match: ({ resolvedIds, queryLower }) =>
      resolvedIds.has('person_ho_quy_ly') ||
      resolvedIds.has('person_tran_thieu_de') ||
      resolvedIds.has('person_tran_thiem_binh') ||
      /\b(hồ\s+quý\s+ly|trần\s+thiếu\s+đế|trần\s+thiêm\s+bình|nhà\s+hồ|đại\s+ngu)\b/i.test(queryLower) ||
      (queryLower.includes('cướp ngôi') && queryLower.includes('nhà trần')),
    content:
      `• Hồ Quý Ly & Sự chuyển giao vương triều Trần - Hồ (1400): Tháng 2 năm Canh Thìn (1400), Hồ Quý Ly phế truất vua Trần Thiếu Đế (vị vua cuối cùng của triều Trần, cháu ngoại Hồ Quý Ly) để lên ngôi, lập ra nhà Hồ (đổi quốc hiệu thành Đại Ngu). Trần Thiêm Bình (tên thật là Nguyễn Khang) là gia nô mạo xưng tôn thất nhà Trần chạy sang nhà Minh cầu viện, KHÔNG PHẢI là vua và KHÔNG PHẢI là người bị Hồ Quý Ly cướp ngôi.`,
  },
  {
    id: 'BACH_DANG_THREE_BATTLES',
    match: ({ activeYears, queryLower }) =>
      queryLower.includes('bạch đằng') ||
      [938, 981, 1288].filter((y) => activeYears.includes(y) || new RegExp(`\\b${y}\\b`).test(queryLower)).length >= 2,
    content:
      `• Ba trận thủy chiến sông Bạch Đằng tiêu biểu trong lịch sử:\n` +
      `  - Năm 938: Tiền Ngô Vương Ngô Quyền chỉ huy đánh tan quân Nam Hán (Lưu Hoằng Tháo tử trận), mở ra kỷ nguyên độc lập tự chủ.\n` +
      `  - Năm 981: Vua Lê Hoàn (triều Tiền Lê) chỉ huy đánh bại quân xâm lược nhà Tống, chém tướng Hầu Nhân Bảo.\n` +
      `  - Năm 1288: Hưng Đạo Đại Vương Trần Quốc Tuấn (nhà Trần) chỉ huy tiêu diệt hoàn toàn thủy quân Nguyên Mông do Ô Mã Nhi cầm đầu.\n` +
      `  -> Đây là ba trận đánh ở ba thời kỳ, ba triều đại hoàn toàn khác nhau do ba vị anh hùng độc lập lãnh đạo.`,
  },
  {
    id: 'LUY_THAY_SONG_GIANH',
    match: ({ resolvedIds, queryLower }) =>
      resolvedIds.has('loc_luy_thay') ||
      resolvedIds.has('loc_song_gianh') ||
      resolvedIds.has('person_dao_duy_tu') ||
      /\b(lũy\s+thầy|lũy\s+đào\s+duy\s+từ|lũy\s+nhật\s+lệ|lũy\s+trường\s+dục|sông\s+gianh|linh\s+giang|đào\s+duy\s+từ)\b/i.test(queryLower) ||
      (queryLower.includes('trịnh - nguyễn') && queryLower.includes('phân tranh')),
    content:
      `• Chiến tuyến Trịnh - Nguyễn phân tranh (thế kỷ 17 - 18):\n` +
      `  - Lũy Thầy (Lũy Đào Duy Từ, bao gồm Lũy Nhật Lệ, Lũy Trường Dục, Lũy Đầu Mâu...) tại Quảng Bình là công trình phòng thủ quân sự do Đào Duy Từ chỉ huy đắp để giúp chúa Nguyễn (Đàng Trong) ngăn chặn các cuộc tiến công của quân Trịnh.\n` +
      `  - Sông Gianh (Linh Giang, Quảng Bình) là giới tuyến tự nhiên lịch sử phân định ranh giới giữa Đàng Ngoài và Đàng Trong.`,
  },
];

/**
 * Structured Chronology & Anti-Conflation Anchor Builder
 * Maps matched persons, campaigns, and events to canonical dynasty, reign years, and sovereignty transitions.
 * Disambiguates known historical conflation pairs and provides verified chronological ground truths.
 */
export function buildChronologyAnchorBox(
  entityNamesOrIds: string[],
  activeYears: number[] = [],
  queryText: string = ''
): string {
  const anchors: string[] = [];
  const queryLower = (queryText || '').toLowerCase();
  const seenRules = new Set<string>();

  // 1. Resolve canonical entity IDs
  const resolvedIds = new Set<string>();
  for (const item of entityNamesOrIds) {
    if (!item) continue;
    const resolved = resolveCanonicalEntity(item.trim());
    if (resolved.entityId) {
      resolvedIds.add(resolved.entityId);
    }
  }

  // 2. Evaluate declarative chronology rules
  for (const rule of CHRONOLOGY_ANCHOR_RULES) {
    if (!seenRules.has(rule.id) && rule.match({ resolvedIds, activeYears, queryLower })) {
      seenRules.add(rule.id);
      anchors.push(rule.content);
    }
  }

  // 3. Generic sovereign & dynasty chronology for matched persons
  const entityBullets: string[] = [];
  const seenEntities = new Set<string>();

  for (const item of entityNamesOrIds) {
    if (!item || item.trim().length <= 2) continue;
    const resolved = resolveCanonicalEntity(item.trim());
    const entId = resolved.entityId;
    if (!entId || entId.startsWith('ent_') || seenEntities.has(entId)) continue;
    seenEntities.add(entId);

    const person = HISTORICAL_PERSON_DICTIONARY[entId];
    const target = person || resolved;
    if (!target) continue;

    const parts: string[] = [];
    if (target.dynasty) {
      parts.push(`Triều đại: ${target.dynasty}`);
    }
    const meta = target.namingMetadata;
    if (meta?.reignEra) {
      let rPeriod = '';
      if (typeof meta.reignPeriod === 'string') {
        rPeriod = meta.reignPeriod;
      } else if (meta.reignPeriod && typeof meta.reignPeriod === 'object' && meta.reignPeriod.start != null) {
        const s = meta.reignPeriod.start < 0 ? `${Math.abs(meta.reignPeriod.start)} TCN` : `${meta.reignPeriod.start}`;
        const e = meta.reignPeriod.end != null ? (meta.reignPeriod.end < 0 ? `${Math.abs(meta.reignPeriod.end)} TCN` : `${meta.reignPeriod.end}`) : '';
        rPeriod = e ? `${s} - ${e}` : s;
      }
      parts.push(`Niên hiệu: ${meta.reignEra}${rPeriod ? ` (${rPeriod})` : ''}`);
    } else if (meta?.reignPeriod) {
      const s = typeof meta.reignPeriod === 'object' && meta.reignPeriod.start != null ? `${meta.reignPeriod.start}` : '';
      const e = typeof meta.reignPeriod === 'object' && meta.reignPeriod.end != null ? `${meta.reignPeriod.end}` : '';
      if (s || e) parts.push(`Thời gian trị vì: ${s}${e ? ` - ${e}` : ''}`);
    }
    if (target.timeRange && target.timeRange.start != null) {
      const start = target.timeRange.start;
      const end = target.timeRange.end;
      const startStr = start < 0 ? `${Math.abs(start)} TCN` : `${start}`;
      const endStr = end != null ? (end < 0 ? `${Math.abs(end)} TCN` : `${end}`) : '';
      parts.push(`Niên đại: ${startStr}${endStr ? ` - ${endStr}` : ''}`);
    }

    if (parts.length > 0) {
      entityBullets.push(`- ${target.canonicalName}: ${parts.join(' | ')}`);
    }
  }

  if (anchors.length === 0 && entityBullets.length === 0) {
    return '';
  }

  const sections: string[] = [];
  if (anchors.length > 0) {
    sections.push(anchors.join('\n\n'));
  }
  if (entityBullets.length > 0) {
    sections.push(`QUY THUỘC TRIỀU ĐẠI & NIÊN HIỆU CHÍNH SỬ:\n${entityBullets.join('\n')}`);
  }

  return sections.join('\n\n');
}
