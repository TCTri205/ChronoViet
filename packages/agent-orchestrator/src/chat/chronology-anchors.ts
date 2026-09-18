import {
  resolveCanonicalEntity,
  HISTORICAL_PERSON_DICTIONARY,
} from '@chronoviet/shared-spec';

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

  const hasEntity = (id: string) => resolvedIds.has(id);
  const hasPhrase = (regex: RegExp) => regex.test(queryLower);
  const hasYear = (y: number) => activeYears.includes(y) || new RegExp(`\\b${y}\\b`).test(queryLower);

  // Rule A: Lê Hoàn & Triều Tiền Lê (980 - 1005) vs. Nhà Lý
  if (
    hasEntity('person_le_hoan') ||
    hasPhrase(/\b(lê\s+hoàn|lê\s+đại\s+hành)\b/i) ||
    (hasYear(981) && (hasPhrase(/bạch\s+đằng/i) || hasPhrase(/chống\s+tống/i) || hasPhrase(/nhà\s+lý/i))) ||
    hasPhrase(/(?:lê\s+hoàn|lê\s+đại\s+hành).*(?:nhà|triều)\s+lý/i)
  ) {
    if (!seenRules.has('LE_HOAN_TIEN_LE')) {
      seenRules.add('LE_HOAN_TIEN_LE');
      anchors.push(
        `• Lê Hoàn (Lê Đại Hành): Thuộc triều Tiền Lê (trị vì 980 - 1005). Lãnh đạo cuộc kháng chiến chống Tống lần thứ nhất thắng lợi rực rỡ năm 981 (chiến thắng Bạch Đằng năm 981). TUYỆT ĐỐI KHÔNG gán Lê Hoàn hoặc chiến thắng năm 981 vào nhà Lý (nhà Lý do Lý Thái Tổ sáng lập năm 1009, sau thời Tiền Lê).`
      );
    }
  }

  // Rule B: Hồ Quý Ly & Trần Thiếu Đế vs. Trần Thiêm Bình
  if (
    hasEntity('person_ho_quy_ly') ||
    hasEntity('person_tran_thieu_de') ||
    hasEntity('person_tran_thiem_binh') ||
    hasPhrase(/\b(hồ\s+quý\s+ly|trần\s+thiếu\s+đế|trần\s+thiêm\s+bình|nhà\s+hồ|đại\s+ngu)\b/i) ||
    (hasPhrase(/cướp\s+ngôi/i) && hasPhrase(/nhà\s+trần/i))
  ) {
    if (!seenRules.has('HO_QUY_LY_TRAN_THIEU_DE')) {
      seenRules.add('HO_QUY_LY_TRAN_THIEU_DE');
      anchors.push(
        `• Hồ Quý Ly & Sự chuyển giao vương triều Trần - Hồ (1400): Tháng 2 năm Canh Thìn (1400), Hồ Quý Ly phế truất vua Trần Thiếu Đế (vị vua cuối cùng của triều Trần, cháu ngoại Hồ Quý Ly) để lên ngôi, lập ra nhà Hồ (đổi quốc hiệu thành Đại Ngu). Trần Thiêm Bình (tên thật là Nguyễn Khang) là gia nô mạo xưng tôn thất nhà Trần chạy sang nhà Minh cầu viện, KHÔNG PHẢI là vua và KHÔNG PHẢI là người bị Hồ Quý Ly cướp ngôi.`
      );
    }
  }

  // Rule C: Ba trận thủy chiến sông Bạch Đằng (938, 981, 1288)
  const isBachDangQuery =
    hasPhrase(/bạch\s+đằng/i) ||
    [938, 981, 1288].filter((y) => hasYear(y)).length >= 2;
  if (isBachDangQuery) {
    if (!seenRules.has('BACH_DANG_THREE_BATTLES')) {
      seenRules.add('BACH_DANG_THREE_BATTLES');
      anchors.push(
        `• Ba trận thủy chiến sông Bạch Đằng tiêu biểu trong lịch sử:\n` +
        `  - Năm 938: Tiền Ngô Vương Ngô Quyền chỉ huy đánh tan quân Nam Hán (Lưu Hoằng Tháo tử trận), mở ra kỷ nguyên độc lập tự chủ.\n` +
        `  - Năm 981: Vua Lê Hoàn (triều Tiền Lê) chỉ huy đánh bại quân xâm lược nhà Tống, chém tướng Hầu Nhân Bảo.\n` +
        `  - Năm 1288: Hưng Đạo Đại Vương Trần Quốc Tuấn (nhà Trần) chỉ huy tiêu diệt hoàn toàn thủy quân Nguyên Mông do Ô Mã Nhi cầm đầu.\n` +
        `  -> Đây là ba trận đánh ở ba thời kỳ, ba triều đại hoàn toàn khác nhau do ba vị anh hùng độc lập lãnh đạo.`
      );
    }
  }

  // Rule D: Chiến tuyến Trịnh - Nguyễn phân tranh (Lũy Thầy & Sông Gianh)
  if (
    hasEntity('loc_luy_thay') ||
    hasEntity('loc_song_gianh') ||
    hasEntity('person_dao_duy_tu') ||
    hasPhrase(/\b(lũy\s+thầy|lũy\s+đào\s+duy\s+từ|lũy\s+nhật\s+lệ|lũy\s+trường\s+dục|sông\s+gianh|linh\s+giang|đào\s+duy\s+từ)\b/i) ||
    (hasPhrase(/trịnh\s*-\s*nguyễn/i) && hasPhrase(/phân\s+tranh/i))
  ) {
    if (!seenRules.has('LUY_THAY_SONG_GIANH')) {
      seenRules.add('LUY_THAY_SONG_GIANH');
      anchors.push(
        `• Chiến tuyến Trịnh - Nguyễn phân tranh (thế kỷ 17 - 18):\n` +
        `  - Lũy Thầy (Lũy Đào Duy Từ, bao gồm Lũy Nhật Lệ, Lũy Trường Dục, Lũy Đầu Mâu...) tại Quảng Bình là công trình phòng thủ quân sự do Đào Duy Từ chỉ huy đắp để giúp chúa Nguyễn (Đàng Trong) ngăn chặn các cuộc tiến công của quân Trịnh.\n` +
        `  - Sông Gianh (Linh Giang, Quảng Bình) là giới tuyến tự nhiên lịch sử phân định ranh giới giữa Đàng Ngoài và Đàng Trong.`
      );
    }
  }

  // Rule E: Chiến dịch 12 ngày đêm "Điện Biên Phủ trên không" (1972)
  if (
    hasPhrase(/\b(12\s+ngày\s+đêm|điện\s+biên\s+phủ\s+trên\s+không|linebacker|sam-2|xưởng\s+a31|nhà\s+máy\s+a31|b-52)\b/i) ||
    (hasYear(1972) && hasPhrase(/ném\s+bom|phòng\s+không|không\s+quân/i))
  ) {
    if (!seenRules.has('LINEBACKER_II_1972')) {
      seenRules.add('LINEBACKER_II_1972');
      anchors.push(
        `• Chiến dịch 12 ngày đêm "Điện Biên Phủ trên không" (18/12/1972 - 30/12/1972):\n` +
        `  - Thời gian: Diễn ra chính xác trong 12 ngày đêm từ đêm 18/12/1972 đến ngày 30/12/1972 (Mỹ tuyên bố ngừng ném bom phía bắc vĩ tuyến 20), dẫn đến việc ký Hiệp định Paris (27/01/1973).\n` +
        `  - Khí tài & Vũ khí: Tên lửa SAM-2 là vũ khí tiêu hao một lần, khi đã bắn ra thì không thể thu hồi để tái sử dụng; Xưởng/Nhà máy A31 là nơi bảo dưỡng đài radar, sửa chữa bệ phóng và hiệu chỉnh quả đạn trước khi phóng, không có việc thu hồi tên lửa đã bắn.`
      );
    }
  }

  // 2. Generic sovereign & dynasty chronology for matched persons
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
