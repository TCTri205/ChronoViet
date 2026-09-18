import {
  HISTORICAL_PERSON_DICTIONARY,
  HISTORICAL_LOCATION_DICTIONARY,
  CORE_EVENTS,
  CORE_DOCS,
  CORE_ORGS,
  CORE_ARTIFACTS,
  resolveCanonicalEntity,
} from '@chronoviet/shared-spec';
import { ChronoGraphState } from '../state.js';

/**
 * Sanitizes raw crawler markdown, metadata tags, and URL encoding artifacts
 * from chunk summaries before passing to LLM context or chapter plans.
 */
export function cleanCrawlerText(rawText?: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/^(?:source_reliability|source_url|crawled_at|word_count|title|canonical_name):.*$/gim, '')
    .replace(/(?:^|\s)(?:BB%[A-Z0-9%]+|%[0-9A-F]{2})+/g, '')
    .replace(/Page\s+\d+/gi, '')
    .replace(/={2,5}[^=\n]+={2,5}/g, ' ')
    .replace(/\[\d+\]/g, ' ')
    .replace(/\[(?:cần dẫn nguồn|nguồn|sđd|tr\.)[^\]]*\]/gi, ' ')
    .replace(/#+\s*/g, '')
    .replace(/\*{1,3}/g, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Centralized historical entity validator.
 * Filters out raw database token IDs, entity ID prefixes, ASCII slugs, pure numbers,
 * and strings without valid proper noun structure.
 */
export function isValidHistoricalEntity(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 3) return false;

  // Reject newlines
  if (/[\r\n]/.test(trimmed)) return false;

  // Reject database entity ID prefixes
  if (/^(person|loc|event|doc|org|epoch|item|unknown)_/i.test(trimmed)) return false;

  // Reject metadata tags from chunk headers or crawlers
  if (/^(?:source_reliability|source_url|crawled_at|word_count|page_\d+):?/i.test(trimmed)) return false;
  if (/^page\s+\d+$/i.test(trimmed)) return false;

  // Reject crawler section headers and page/chunk numbers
  if (/(?:^|\s*[-–—]\s*|\P{L})(?:Đoạn|Tập|Trang|Phần|Quyển|Chương)\s*[\d.]+/iu.test(trimmed)) return false;
  if (/^(?:Tập sử liệu|Tập|Phần|Đoạn|Quyển|Trang|Chương)\b/iu.test(trimmed)) return false;

  // Reject book reference prefixes or sentence starters masquerading as entities
  if (/^(?:Sách|Cánh|Cánh quân|Trang|Tập|Phần|Mục|Quyển|Chương)\s+/iu.test(trimmed)) return false;

  // Reject tokens ending with a hanging single uppercase initial or short unfinished token (e.g. "Giang Nam Ch")
  if (/\s+\p{Lu}$/u.test(trimmed)) return false;

  // Reject pure numbers or year-only tokens (e.g. "981", "1428")
  if (/^\d+$/.test(trimmed)) return false;

  // Reject raw ASCII lowercase slugs with underscores (e.g. "le_hoan_pha_tong", "pha_tong_binh_chiem")
  if (/^[a-z0-9_]+$/.test(trimmed) && trimmed.includes('_')) return false;

  // Must contain at least one uppercase letter (proper nouns)
  if (!/\p{Lu}/u.test(trimmed)) return false;

  // Reject generic / structural stop phrases
  const genericStopPhrases = new Set([
    'việt nam', 'lịch sử', 'thế kỷ', 'trước công nguyên', 'công nguyên',
    'đông nam á', 'sau công nguyên', 'nhiệm vụ', 'mục tiêu', 'tư liệu',
    'chính thống', 'chrono viet', 'chrono-rag', 'chương trình', 'giai đoạn',
    'thời kỳ', 'đoạn văn', 'tổng quan', 'chi tiết', 'tóm tắt', 'nội dung',
  ]);
  if (genericStopPhrases.has(trimmed.toLowerCase())) return false;

  return true;
}

/**
 * Deduplicates and canonicalizes historical entities, grouping aliases
 * under their primary canonical persona to prevent coreference confusion and hallucinations.
 */
export function canonicalizeEntityList(entities: string[]): {
  canonicalEntities: string[];
  aliasGroups: Record<string, string[]>;
} {
  const canonicalMap = new Map<string, { primaryName: string; aliases: Set<string> }>();
  const independentEntities: string[] = [];

  for (const ent of entities) {
    if (!isValidHistoricalEntity(ent)) continue;
    const resolved = resolveCanonicalEntity(ent);
    if (resolved && resolved.canonicalName) {
      const cName = resolved.canonicalName;
      if (!canonicalMap.has(cName)) {
        canonicalMap.set(cName, { primaryName: cName, aliases: new Set() });
      }
      if (ent.toLowerCase() !== cName.toLowerCase()) {
        canonicalMap.get(cName)!.aliases.add(ent);
      }
    } else {
      if (!independentEntities.includes(ent)) {
        independentEntities.push(ent);
      }
    }
  }

  const canonicalEntities: string[] = [];
  const aliasGroups: Record<string, string[]> = {};

  for (const [cName, data] of canonicalMap.entries()) {
    canonicalEntities.push(cName);
    if (data.aliases.size > 0) {
      aliasGroups[cName] = Array.from(data.aliases);
    }
  }

  for (const ind of independentEntities) {
    if (!canonicalEntities.some((c) => c.toLowerCase() === ind.toLowerCase())) {
      canonicalEntities.push(ind);
    }
  }

  return { canonicalEntities, aliasGroups };
}

const STARTING_FUNCTION_WORDS = new Set([
  'trong', 'ngoài', 'sau', 'khi', 'trước', 'nhưng', 'tuy', 'đến', 'vào', 'với',
  'theo', 'ngày', 'tháng', 'năm', 'người', 'các', 'những', 'một', 'hai', 'ba',
  'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười', 'bởi', 'vì', 'do', 'để',
  'tại', 'từ', 'rồi', 'nếu', 'dù', 'mặc', 'bấy', 'lúc', 'đây', 'đó', 'kia',
  'ông', 'bà', 'cha', 'mẹ', 'con', 'anh', 'chị', 'em', 'nước', 'đất',
  'cuộc', 'lời', 'toàn', 'tất', 'cùng', 'chính', 'ngay', 'sớm', 'hồi',
  'trưa', 'chiều', 'tối', 'đêm', 'hôm', 'vừa', 'mới', 'đang', 'đã', 'sẽ',
  'ngài', 'tướng', 'vua', 'viên', 'quân', 'thời', 'bản', 'trên', 'dưới',
  'thoạt', 'bèn', 'lại', 'vốn', 'thấy', 'nghe', 'nói', 'sinh', 'lớn', 'mùa',
  'không', 'chưa', 'chẳng', 'được', 'bị', 'phải', 'tự', 'luôn', 'sách', 'cánh',
]);

export function extractHistoricalEntitiesFromRag(ragContext?: ChronoGraphState['ragContext'], userPrompt?: string): string[] {
  const entitySet = new Set<string>();

  const userPromptNorm = (userPrompt || '').toLowerCase();
  const textCorpus = [
    userPrompt || '',
    ...(ragContext?.verifiedContext?.map((c) => `${c.canonicalName} ${c.title || ''} ${c.summary || ''}`) || []),
  ].join(' ').toLowerCase();

  let anchorMinYear: number | undefined;
  let anchorMaxYear: number | undefined;

  for (const p of Object.values(HISTORICAL_PERSON_DICTIONARY)) {
    if (!p.canonicalName) continue;
    const pName = p.canonicalName.toLowerCase();
    if (userPromptNorm.includes(pName) || p.aliases?.some((a) => userPromptNorm.includes(a.toLowerCase()))) {
      if (p.timeRange?.start !== undefined) {
        anchorMinYear = anchorMinYear !== undefined ? Math.min(anchorMinYear, p.timeRange.start) : p.timeRange.start;
      }
      if (p.timeRange?.end !== undefined) {
        anchorMaxYear = anchorMaxYear !== undefined ? Math.max(anchorMaxYear, p.timeRange.end) : p.timeRange.end;
      }
    }
  }

  for (const ev of CORE_EVENTS) {
    if (!ev.name) continue;
    const eName = ev.name.toLowerCase();
    if (userPromptNorm.includes(eName) || ev.aliases?.some((a) => userPromptNorm.includes(a.toLowerCase()))) {
      if (ev.timeRange?.start !== undefined) {
        anchorMinYear = anchorMinYear !== undefined ? Math.min(anchorMinYear, ev.timeRange.start) : ev.timeRange.start;
      }
      if (ev.timeRange?.end !== undefined) {
        anchorMaxYear = anchorMaxYear !== undefined ? Math.max(anchorMaxYear, ev.timeRange.end) : ev.timeRange.end;
      }
    }
  }

  const promptYearMatches = userPromptNorm.match(/(?:năm\s+)?(-?\b\d{1,4}\b)/g);
  if (promptYearMatches) {
    for (const ym of promptYearMatches) {
      const parsedY = parseInt(ym.replace(/[^\d-]/g, ''), 10);
      if (!isNaN(parsedY) && parsedY >= -3000 && parsedY <= 2100) {
        anchorMinYear = anchorMinYear !== undefined ? Math.min(anchorMinYear, parsedY) : parsedY;
        anchorMaxYear = anchorMaxYear !== undefined ? Math.max(anchorMaxYear, parsedY) : parsedY;
      }
    }
  }

  if (anchorMinYear === undefined && ragContext?.verifiedContext) {
    for (const chunk of ragContext.verifiedContext) {
      if (chunk.timeStart !== undefined) {
        anchorMinYear = anchorMinYear !== undefined ? Math.min(anchorMinYear, chunk.timeStart) : chunk.timeStart;
      }
      if (chunk.timeEnd !== undefined) {
        anchorMaxYear = anchorMaxYear !== undefined ? Math.max(anchorMaxYear, chunk.timeEnd) : chunk.timeEnd;
      }
    }
  }

  const hasTemporalAnchor = anchorMinYear !== undefined && anchorMaxYear !== undefined;
  const temporalMargin = 80;

  for (const person of Object.values(HISTORICAL_PERSON_DICTIONARY)) {
    if (!person.canonicalName || !isValidHistoricalEntity(person.canonicalName)) continue;
    const pName = person.canonicalName.toLowerCase();
    const isDirectlyInPrompt = userPromptNorm.includes(pName) || person.aliases?.some((a) => userPromptNorm.includes(a.toLowerCase()));
    const isInCorpus = textCorpus.includes(pName) || person.aliases?.some((a) => textCorpus.includes(a.toLowerCase()));

    if (isDirectlyInPrompt || isInCorpus) {
      const isMythologicalDynasty = person.isMythological || (person.dynasty && /Hồng Bàng|Văn Lang|Âu Lạc/i.test(person.dynasty));
      if (!isDirectlyInPrompt && hasTemporalAnchor && person.timeRange && !isMythologicalDynasty) {
        const pStart = person.timeRange.start ?? person.timeRange.end;
        const pEnd = person.timeRange.end ?? person.timeRange.start;
        if (pStart !== undefined && pEnd !== undefined) {
          if (pEnd < anchorMinYear! - temporalMargin || pStart > anchorMaxYear! + temporalMargin) {
            continue;
          }
        }
      }

      entitySet.add(person.canonicalName);
      for (const a of person.aliases || []) {
        if (a && isValidHistoricalEntity(a)) {
          entitySet.add(a.trim());
        }
      }
      if (person.namingMetadata?.familyLineage?.spouses) {
        for (const sp of person.namingMetadata.familyLineage.spouses) {
          const cleanSp = sp.replace(/\s*\(.*?\)/g, '').trim();
          if (cleanSp && isValidHistoricalEntity(cleanSp)) {
            entitySet.add(cleanSp);
          }
        }
      }
      if (person.namingMetadata?.familyLineage?.siblings) {
        for (const sib of person.namingMetadata.familyLineage.siblings) {
          const cleanSib = sib.replace(/\s*\(.*?\)/g, '').trim();
          if (cleanSib && isValidHistoricalEntity(cleanSib)) {
            entitySet.add(cleanSib);
          }
        }
      }
      if (person.namingMetadata?.adversaries) {
        for (const adv of person.namingMetadata.adversaries) {
          const cleanAdv = adv.replace(/\s*\(.*?\)/g, '').trim();
          if (cleanAdv && isValidHistoricalEntity(cleanAdv)) {
            entitySet.add(cleanAdv);
          }
        }
      }
    }
  }

  for (const loc of Object.values(HISTORICAL_LOCATION_DICTIONARY)) {
    if (!loc.canonicalName || !isValidHistoricalEntity(loc.canonicalName)) continue;
    const lName = loc.canonicalName.toLowerCase();
    const cleanCanonical = loc.canonicalName.replace(/^(?:phủ|tỉnh|thành|làng|xã|quận|huyện|đồn|núi|sông|cửa|đèo|bến)\s+/iu, '').trim();
    const isMatched = textCorpus.includes(lName) ||
      (cleanCanonical.length >= 3 && textCorpus.includes(cleanCanonical.toLowerCase())) ||
      loc.aliases?.some((a) => textCorpus.includes(a.toLowerCase()));

    if (isMatched) {
      const formatted = loc.canonicalName.charAt(0).toUpperCase() + loc.canonicalName.slice(1);
      entitySet.add(formatted);
      if (cleanCanonical && isValidHistoricalEntity(cleanCanonical)) {
        entitySet.add(cleanCanonical.charAt(0).toUpperCase() + cleanCanonical.slice(1));
      }
      for (const a of loc.aliases || []) {
        if (a && isValidHistoricalEntity(a)) {
          entitySet.add(a.trim());
        }
      }
    }
  }

  for (const event of CORE_EVENTS) {
    if (!event.name || !isValidHistoricalEntity(event.name)) continue;
    const eName = event.name.toLowerCase();
    const isDirectlyInPrompt = userPromptNorm.includes(eName) || event.aliases?.some((a) => userPromptNorm.includes(a.toLowerCase()));
    const matchedAlias = event.aliases?.find((a) => textCorpus.includes(a.toLowerCase()));
    const isCloseYearMatched = hasTemporalAnchor && event.timeRange && (
      (event.timeRange.start !== undefined && event.timeRange.start >= anchorMinYear! - 1 && event.timeRange.start <= anchorMaxYear! + 1) ||
      (event.timeRange.end !== undefined && event.timeRange.end >= anchorMinYear! - 1 && event.timeRange.end <= anchorMaxYear! + 1)
    );

    if (isDirectlyInPrompt || textCorpus.includes(eName) || matchedAlias || isCloseYearMatched) {
      if (!isDirectlyInPrompt && hasTemporalAnchor && event.timeRange) {
        const eStart = event.timeRange.start ?? event.timeRange.end;
        const eEnd = event.timeRange.end ?? event.timeRange.start;
        if (eStart !== undefined && eEnd !== undefined) {
          if (eEnd < anchorMinYear! - temporalMargin || eStart > anchorMaxYear! + temporalMargin) {
            continue;
          }
        }
      }
      entitySet.add(event.name);
      if (matchedAlias && isValidHistoricalEntity(matchedAlias)) {
        entitySet.add(matchedAlias);
      }
      for (const a of event.aliases || []) {
        const cleanA = a.replace(/\s*\(.*?\)/g, '').trim();
        if (cleanA && isValidHistoricalEntity(cleanA)) {
          entitySet.add(cleanA);
        }
        if (a && isValidHistoricalEntity(a)) {
          entitySet.add(a);
        }
      }
    }
  }

  for (const doc of CORE_DOCS) {
    if (!doc.name || !isValidHistoricalEntity(doc.name)) continue;
    const dName = doc.name.toLowerCase();
    const isDirectlyInPrompt = userPromptNorm.includes(dName) || doc.aliases?.some((a) => userPromptNorm.includes(a.toLowerCase()));
    const matchedAlias = doc.aliases?.find((a) => textCorpus.includes(a.toLowerCase()));
    const authorMatched = doc.author && (userPromptNorm.includes(doc.author.toLowerCase()) || textCorpus.includes(doc.author.toLowerCase()));
    const isCloseYearMatched = hasTemporalAnchor && doc.year !== undefined && doc.year >= anchorMinYear! - 1 && doc.year <= anchorMaxYear! + 1;

    if (isDirectlyInPrompt || textCorpus.includes(dName) || matchedAlias || authorMatched || isCloseYearMatched) {
      if (!isDirectlyInPrompt && hasTemporalAnchor && doc.year !== undefined) {
        if (doc.year < anchorMinYear! - temporalMargin || doc.year > anchorMaxYear! + temporalMargin) {
          continue;
        }
      }
      entitySet.add(doc.name);
      if (matchedAlias && isValidHistoricalEntity(matchedAlias)) {
        entitySet.add(matchedAlias);
      }
      for (const a of doc.aliases || []) {
        const cleanA = a.replace(/\s*\(.*?\)/g, '').trim();
        if (cleanA && isValidHistoricalEntity(cleanA)) {
          entitySet.add(cleanA);
        }
      }
    }
  }

  for (const org of CORE_ORGS) {
    if (!org.name || !isValidHistoricalEntity(org.name)) continue;
    const oName = org.name.toLowerCase();
    const isDirectlyInPrompt = userPromptNorm.includes(oName) || org.aliases?.some((a) => userPromptNorm.includes(a.toLowerCase()));
    const matchedAlias = org.aliases?.find((a) => textCorpus.includes(a.toLowerCase()));

    if (isDirectlyInPrompt || textCorpus.includes(oName) || matchedAlias) {
      entitySet.add(org.name);
      if (matchedAlias && isValidHistoricalEntity(matchedAlias)) {
        entitySet.add(matchedAlias);
      }
      for (const a of org.aliases || []) {
        const cleanA = a.replace(/\s*\(.*?\)/g, '').trim();
        if (cleanA && isValidHistoricalEntity(cleanA)) {
          entitySet.add(cleanA);
        }
      }
    }
  }

  for (const art of CORE_ARTIFACTS) {
    if (!art.name || !isValidHistoricalEntity(art.name)) continue;
    const aName = art.name.toLowerCase();
    const isDirectlyInPrompt = userPromptNorm.includes(aName) || art.aliases?.some((a) => userPromptNorm.includes(a.toLowerCase()));
    const matchedAlias = art.aliases?.find((a) => textCorpus.includes(a.toLowerCase()));

    if (isDirectlyInPrompt || textCorpus.includes(aName) || matchedAlias) {
      entitySet.add(art.name);
      if (matchedAlias && isValidHistoricalEntity(matchedAlias)) {
        entitySet.add(matchedAlias);
      }
      for (const a of art.aliases || []) {
        const cleanA = a.replace(/\s*\(.*?\)/g, '').trim();
        if (cleanA && isValidHistoricalEntity(cleanA)) {
          entitySet.add(cleanA);
        }
      }
    }
  }

  if (ragContext?.verifiedContext) {
    for (const chunk of ragContext.verifiedContext) {
      if (chunk.canonicalName && isValidHistoricalEntity(chunk.canonicalName)) {
        entitySet.add(chunk.canonicalName.trim());
      }
      if (chunk.title && isValidHistoricalEntity(chunk.title)) {
        const cleanTitle = chunk.title
          .replace(/\s*\(.*?\)/g, '')
          .replace(/^(?:Tập sử liệu|Tập|Phần|Đoạn)\s*:\s*/i, '')
          .replace(/\s*[-–—]\s*(?:Đoạn|Tập|Trang|Phần|Quyển|Chương)\s*[\d.]+.*$/iu, '')
          .trim();
        if (isValidHistoricalEntity(cleanTitle)) {
          entitySet.add(cleanTitle);
        }
      }
      if (Array.isArray(chunk.aliases)) {
        for (const alias of chunk.aliases) {
          if (alias && isValidHistoricalEntity(alias)) {
            entitySet.add(alias.trim());
          }
        }
      }

      if (chunk.summary) {
        const cleanSummary = chunk.summary
          .replace(/^(?:source_reliability|source_url|crawled_at|word_count|title):.*$/gim, '')
          .replace(/Page\s+\d+/gi, '')
          .replace(/#+\s+/g, '')
          .replace(/\*{1,3}/g, '')
          .replace(/[\r\n]+/g, ' ');

        const unicodeNameRegex = /(?<!\p{L})((?:\p{Lu}\p{Ll}+(?:[-–—]\p{Lu}\p{Ll}+)?)(?:\s+\p{Lu}\p{Ll}+(?:[-–—]\p{Lu}\p{Ll}+)?){1,3})(?!\p{L})/gu;
        const matches = cleanSummary.match(unicodeNameRegex);
        if (matches) {
          for (const m of matches) {
            const trimmed = m.trim();
            if (/^\p{Lu}\p{Ll}+\s+\d+$/u.test(trimmed)) continue;
            const words = trimmed.split(/\s+/);
            if (words.length < 2) continue;
            const firstWord = words[0].toLowerCase();
            if (STARTING_FUNCTION_WORDS.has(firstWord)) continue;
            if (words.length === 2 && STARTING_FUNCTION_WORDS.has(words[1].toLowerCase())) continue;
            if (isValidHistoricalEntity(trimmed)) {
              entitySet.add(trimmed);
            }
          }
        }

        const militaryBaseRegex = /\b((?:Đồi|Cứ điểm|Cao điểm|Đồn|Căn cứ|Phòng tuyến)\s+[A-Z0-9a-zÀ-ỹ]+(?:\s+[A-Z0-9a-zÀ-ỹ]+)?)\b/gu;
        let mMatch: RegExpExecArray | null;
        while ((mMatch = militaryBaseRegex.exec(cleanSummary)) !== null) {
          const mText = mMatch[1].trim();
          if (isValidHistoricalEntity(mText)) {
            entitySet.add(mText);
          }
        }

        const quoteRegex = /["“'‘]([^"”'’]{3,40})["”'’]/g;
        let qMatch: RegExpExecArray | null;
        while ((qMatch = quoteRegex.exec(chunk.summary)) !== null) {
          const qText = qMatch[1].trim();
          if (isValidHistoricalEntity(qText)) {
            entitySet.add(qText);
          }
        }
      }
    }
  }

  if (ragContext?.aliasTable) {
    for (const [key, aliases] of Object.entries(ragContext.aliasTable)) {
      if (key && isValidHistoricalEntity(key)) {
        entitySet.add(key.trim());
      }
      if (Array.isArray(aliases)) {
        for (const a of aliases) {
          if (a && isValidHistoricalEntity(a)) {
            entitySet.add(a.trim());
          }
        }
      }
    }
  }

  return Array.from(entitySet);
}

/**
 * Returns all recognized alias and naming variants for a given historical entity name.
 */
export function getEntityVariants(entity: string, ragContext?: any): string[] {
  if (!entity || typeof entity !== 'string') return [];
  const variants = new Set<string>([entity.toLowerCase().trim()]);

  if (ragContext?.aliasTable) {
    for (const [key, aliases] of Object.entries(ragContext.aliasTable)) {
      if (key.toLowerCase() === entity.toLowerCase()) {
        (aliases as string[]).forEach((a) => variants.add(a.toLowerCase().trim()));
      }
      if (Array.isArray(aliases) && aliases.some((a: string) => a.toLowerCase() === entity.toLowerCase())) {
        variants.add(key.toLowerCase().trim());
        aliases.forEach((a: string) => variants.add(a.toLowerCase().trim()));
      }
    }
  }

  for (const person of Object.values(HISTORICAL_PERSON_DICTIONARY)) {
    if (person.canonicalName.toLowerCase() === entity.toLowerCase()) {
      person.aliases?.forEach((a) => variants.add(a.toLowerCase().trim()));
      person.namingMetadata?.adversaries?.forEach((adv) => variants.add(adv.toLowerCase().trim()));
    }
    if (person.aliases?.some((a) => a.toLowerCase() === entity.toLowerCase())) {
      variants.add(person.canonicalName.toLowerCase().trim());
      person.aliases?.forEach((a) => variants.add(a.toLowerCase().trim()));
    }
  }

  for (const ev of CORE_EVENTS) {
    if (ev.name.toLowerCase() === entity.toLowerCase()) {
      ev.aliases?.forEach((a) => variants.add(a.toLowerCase().trim()));
    }
    if (ev.aliases?.some((a) => a.toLowerCase() === entity.toLowerCase())) {
      variants.add(ev.name.toLowerCase().trim());
      ev.aliases?.forEach((a) => variants.add(a.toLowerCase().trim()));
    }
  }

  for (const doc of CORE_DOCS) {
    if (doc.name.toLowerCase() === entity.toLowerCase()) {
      doc.aliases?.forEach((a) => variants.add(a.toLowerCase().trim()));
    }
    if (doc.aliases?.some((a) => a.toLowerCase() === entity.toLowerCase())) {
      variants.add(doc.name.toLowerCase().trim());
      doc.aliases?.forEach((a) => variants.add(a.toLowerCase().trim()));
    }
  }

  return Array.from(variants).filter((v) => v.length >= 2);
}
