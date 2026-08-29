import { describe, it, expect } from 'vitest';
import { extractHistoricalCandidateSpans, slugify, buildCanonicalId } from '../text/vietnamese-ner.js';

describe('Stage 1 Pure TS Vietnamese Historical NER Engine', () => {
  it('should slugify Vietnamese names with proper accent stripping', () => {
    expect(slugify('Quang Trung')).toBe('quang_trung');
    expect(slugify('Nguyễn Huệ')).toBe('nguyen_hue');
    expect(slugify('Đinh Tiên Hoàng')).toBe('dinh_tien_hoang');
    expect(slugify('Trần Hưng Đạo')).toBe('tran_hung_dao');
    expect(slugify('Thành nhà Hồ')).toBe('thanh_nha_ho');
  });

  it('should build canonical IDs with standard prefixes', () => {
    expect(buildCanonicalId('Quang Trung', 'HISTORICAL_PERSON')).toBe('person_quang_trung');
    expect(buildCanonicalId('Thăng Long', 'LOCATION')).toBe('loc_thang_long');
    expect(buildCanonicalId('Trận Bạch Đằng', 'EVENT_BATTLE')).toBe('event_tran_bach_dang');
    expect(buildCanonicalId('nhà Trần', 'DYNASTY_ERA')).toBe('dynasty_nha_tran');
    expect(buildCanonicalId('Đảng Cộng sản Việt Nam', 'ORGANIZATION')).toBe('org_dang_cong_san_viet_nam');
    expect(buildCanonicalId('Trống đồng Đông Sơn', 'ARTIFACT')).toBe('artifact_trong_dong_dong_son');
    expect(buildCanonicalId('Hịch tướng sĩ', 'DOCUMENT_CULTURE')).toBe('doc_hich_tuong_si');
  });

  it('should extract Layer 1 Gazetteer entities with exact character offsets', () => {
    const text = 'Năm 1010, vua Lý Thái Tổ ban Chiếu dời đô dời kinh đô từ Hoa Lư về Thăng Long.';
    const spans = extractHistoricalCandidateSpans(text);

    expect(spans.length).toBeGreaterThan(0);
    for (const span of spans) {
      expect(text.substring(span.startOffset, span.endOffset)).toBe(span.text);
    }

    const spanTexts = spans.map((s) => s.text);
    expect(spanTexts).toContain('Lý Thái Tổ');
    expect(spanTexts).toContain('Hoa Lư');
    expect(spanTexts).toContain('Thăng Long');
  });

  it('should extract Layer 2 Rule-Based prefixes (battles, documents, artifacts)', () => {
    const text = 'Trận Ngọc Hồi - Đống Đa do Quang Trung chỉ huy tiến vào Thăng Long đại phá quân Mãn Thanh.';
    const spans = extractHistoricalCandidateSpans(text);

    for (const span of spans) {
      expect(text.substring(span.startOffset, span.endOffset)).toBe(span.text);
    }

    const spanTexts = spans.map((s) => s.text);
    expect(spanTexts).toContain('Trận Ngọc Hồi - Đống Đa');
    expect(spanTexts).toContain('Quang Trung');
    expect(spanTexts).toContain('Thăng Long');
    expect(spanTexts).toContain('quân Mãn Thanh');
  });

  it('should extract Layer 3 OOV proper nouns without dictionary entry', () => {
    const text = 'Tướng Đặng Tiến Đông chỉ huy đạo quân tiên phong tiến công đồn Khương Thượng.';
    const spans = extractHistoricalCandidateSpans(text);

    for (const span of spans) {
      expect(text.substring(span.startOffset, span.endOffset)).toBe(span.text);
    }

    const spanTexts = spans.map((s) => s.text);
    expect(spanTexts).toContain('Đặng Tiến Đông');
    expect(spanTexts).toContain('Khương Thượng');
  });

  it('should maintain exact boundary slice alignment and distinct entities', () => {
    const text = 'Hoàng đế Quang Trung Nguyễn Huệ cùng nghĩa quân Tây Sơn đại phá 29 vạn quân Mãn Thanh.';
    const spans = extractHistoricalCandidateSpans(text);

    expect(spans.length).toBeGreaterThan(0);
    for (const span of spans) {
      expect(text.substring(span.startOffset, span.endOffset)).toBe(span.text);
    }
    const spanTexts = spans.map((s) => s.text);
    expect(spanTexts).toContain('Quang Trung');
    expect(spanTexts).toContain('nghĩa quân Tây Sơn');
    expect(spanTexts).toContain('quân Mãn Thanh');
  });

  it('should strip leading honorifics regardless of casing (Title Case, lowercase, UPPERCASE)', () => {
    const text1 = 'Thái Thượng Hoàng Trần Cảnh là vị vua đầu tiên của nhà Trần.';
    const spans1 = extractHistoricalCandidateSpans(text1);
    const personSpan1 = spans1.find((s) => s.text === 'Trần Cảnh');
    expect(personSpan1).toBeDefined();

    const text2 = 'THÁI THƯỢNG HOÀNG Trần Cảnh là vị vua đầu tiên.';
    const spans2 = extractHistoricalCandidateSpans(text2);
    const personSpan2 = spans2.find((s) => s.text === 'Trần Cảnh');
    expect(personSpan2).toBeDefined();

    const text3 = 'vua Lê Lợi dựng cờ khởi nghĩa Lam Sơn.';
    const spans3 = extractHistoricalCandidateSpans(text3);
    const personSpan3 = spans3.find((s) => s.text === 'Lê Lợi');
    expect(personSpan3).toBeDefined();
  });

  it('should execute with sub-10ms latency per sentence', () => {
    const text = 'Năm 1789, Hoàng đế Quang Trung chỉ huy đại quân Tây Sơn tiến vào Thăng Long đại phá 29 vạn quân Mãn Thanh trong Trận Ngọc Hồi - Đống Đa.';
    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      extractHistoricalCandidateSpans(text);
    }
    const end = performance.now();
    const avgMs = (end - start) / 50;
    expect(avgMs).toBeLessThan(10.0);
  });
});
