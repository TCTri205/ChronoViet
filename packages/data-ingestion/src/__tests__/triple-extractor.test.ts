import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { generateLLMCompletion } from '@chronoviet/infra';
import { extractionCache } from '../cache/extraction-cache.js';
import { findMonorepoRoot } from '../utils/path-utils.js';
import {
  isValidEntityName,
  extractTriplesFromText,
  extractTriplesWithLLM,
  extractTriplesFromTextAsync,
  resolveHistoricalConflict,
  MAX_CANDIDATE_SPANS_IN_PROMPT,
  extractRoyalLineageTriples,
  extractSyntacticParentheticalTriples,
} from '../triple-extractor.js';
import { extractHistoricalCandidateSpans } from '../text/vietnamese-ner.js';

vi.mock('@chronoviet/infra', async (importOriginal) => {
  const original = await importOriginal<typeof import('@chronoviet/infra')>();
  return {
    ...original,
    generateLLMCompletion: vi.fn(),
  };
});

describe('Triple Extractor Unit Tests', () => {
  let tempTestCacheDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tempTestCacheDir = path.join(
      os.tmpdir(),
      `test-extract-cache-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    );
    await fs.mkdir(tempTestCacheDir, { recursive: true });
    extractionCache.setCacheDir(tempTestCacheDir);
  });

  afterEach(async () => {
    if (tempTestCacheDir) {
      await fs.rm(tempTestCacheDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  afterAll(() => {
    const root = findMonorepoRoot();
    extractionCache.setCacheDir(path.join(root, '.cache', 'extraction_triples'));
  });

  describe('isValidEntityName', () => {
    it('should validate entity names correctly', () => {
      expect(isValidEntityName('Quang Trung')).toBe(true);
      expect(isValidEntityName('Nhà Hậu Lê')).toBe(true);
      expect(isValidEntityName('Triều Nguyễn')).toBe(true);
      expect(isValidEntityName('Trận Ngọc Hồi')).toBe(true);

      expect(isValidEntityName('')).toBe(false);
      expect(isValidEntityName('a')).toBe(false);
      expect(isValidEntityName('12345')).toBe(false);
      expect(isValidEntityName('và')).toBe(false);
      expect(isValidEntityName('trong')).toBe(false);
      expect(isValidEntityName('Trong')).toBe(false);
      expect(isValidEntityName('Đến')).toBe(false);
      expect(isValidEntityName('Từ')).toBe(false);
      expect(isValidEntityName('Cuối')).toBe(false);
      expect(isValidEntityName('Tên Châu')).toBe(false);
      expect(isValidEntityName('Tên Huyện')).toBe(false);
    });
  });

  describe('extractTriplesFromText (Rule-Based Regex)', () => {
    it('should extract LED_BY relation from historical text pattern', () => {
      const text = 'Trận Ngọc Hồi do Quang Trung chỉ huy đánh tan quân Thanh.';
      const triples = extractTriplesFromText(text);
      expect(triples.length).toBeGreaterThan(0);
      const ledBy = triples.find((t) => t.relationType === 'LED_BY');
      expect(ledBy).toBeDefined();
    });

    it('should extract ALIAS_OF relation from alias text pattern', () => {
      const text = 'Quang Trung tức là Nguyễn Huệ.';
      const triples = extractTriplesFromText(text);
      const alias = triples.find((t) => t.relationType === 'ALIAS_OF');
      expect(alias).toBeDefined();
      expect(alias?.confidence).toBe(1.0);
    });

    it('should extract PART_OF when explicit subordination is present', () => {
      const text = 'Nguyễn Huệ thuộc triều đại Tây Sơn.';
      const triples = extractTriplesFromText(text);
      const partOf = triples.find((t) => t.relationType === 'PART_OF');
      expect(partOf).toBeDefined();
    });

    it('should NOT extract spurious PART_OF relation from temporal clauses like Trong thời Lương', () => {
      const text = 'Trong thời Lương, nước ta bị đô hộ nặng nề.';
      const triples = extractTriplesFromText(text);
      const spurious = triples.find((t) => t.sourceEntityName === 'Trong' || t.targetEntityName === 'Trong');
      expect(spurious).toBeUndefined();
      expect(triples.length).toBe(0);
    });
  });

  describe('extractTriplesWithLLM', () => {
    beforeEach(async () => {
      vi.resetAllMocks();
      await extractionCache.clear();
    });

    it('should parse standard JSON triples from LLM response', async () => {
      vi.mocked(generateLLMCompletion).mockResolvedValue({
        content: JSON.stringify({
          triples: [
            {
              sourceEntity: 'Nguyễn Huệ',
              relationType: 'ALIAS_OF',
              targetEntity: 'Quang Trung',
              confidence: 0.99,
            },
          ],
        }),
        model: 'agnes-2.5-flash',
        provider: 'AGNES_FLASH_FALLBACK',
        targetId: 'cloud:agnes:k1',
        targetProvider: 'agnes',
        finishReason: 'stop',
      });

      const triples = await extractTriplesWithLLM('Quang Trung đại phá quân Thanh.');
      expect(triples.length).toBe(1);
      expect(triples[0].relationType).toBe('ALIAS_OF');
      expect(triples[0].confidence).toBe(0.99);
    });

    it('should handle markdown fenced JSON responses', async () => {
      vi.mocked(generateLLMCompletion).mockResolvedValue({
        content: '```json\n{\n  "triples": [\n    {\n      "sourceEntity": "Trận Đống Đa",\n      "relationType": "LED_BY",\n      "targetEntity": "Quang Trung",\n      "confidence": 0.95\n    }\n  ]\n}\n```',
        model: 'agnes-2.5-flash',
        provider: 'AGNES_FLASH_FALLBACK',
        finishReason: 'stop',
      });

      const triples = await extractTriplesWithLLM('Trận Đống Đa do Quang Trung chỉ huy.');
      expect(triples.length).toBe(1);
      expect(triples[0].relationType).toBe('LED_BY');
    });

    it('should fallback to regex parsing when JSON is truncated', async () => {
      vi.mocked(generateLLMCompletion).mockResolvedValue({
        content: '{"triples": [{"sourceEntity": "Nguyễn Huệ", "relationType": "ALIAS_OF", "targetEntity": "Quang Trung", "confidence": 0.98}', // truncated without closing bracket
        model: 'agnes-2.5-flash',
        provider: 'AGNES_FLASH_FALLBACK',
        finishReason: 'length',
      });

      const triples = await extractTriplesWithLLM('Nguyễn Huệ tức Quang Trung.');
      expect(triples.length).toBe(1);
      expect(triples[0].relationType).toBe('ALIAS_OF');
    });

    it('should throw in strict mode when LLM fails and allowFallback is false', async () => {
      vi.mocked(generateLLMCompletion).mockRejectedValueOnce(new Error('LLM Gateway timeout'));

      await expect(
        extractTriplesWithLLM('Quang Trung chỉ huy tiến về Thăng Long.', { strict: true, allowFallback: false })
      ).rejects.toThrow('LLM Triple Extraction failed');
    });

    it('should return rule-based fallback when LLM fails but allowFallback is true', async () => {
      vi.mocked(generateLLMCompletion).mockRejectedValueOnce(new Error('LLM Gateway timeout'));

      const triples = await extractTriplesWithLLM('Quang Trung chỉ huy tiến về Thăng Long.', { allowFallback: true, strict: false });
      expect(Array.isArray(triples)).toBe(true);
      expect(triples.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array when LLM fails, allowFallback is true, but no rule matches', async () => {
      vi.mocked(generateLLMCompletion).mockRejectedValueOnce(new Error('LLM Gateway timeout'));

      const triples = await extractTriplesWithLLM('Thời tiết hôm nay nhiều mây và nắng nhẹ.', { allowFallback: true, strict: false });
      expect(triples).toEqual([]);
    });

    it('should cap candidate entities in LLM prompt to MAX_CANDIDATE_SPANS_IN_PROMPT (30)', async () => {
      vi.mocked(generateLLMCompletion).mockResolvedValue({
        content: JSON.stringify({ triples: [] }),
        model: 'agnes-2.5-flash',
        provider: 'AGNES_FLASH_FALLBACK',
        finishReason: 'stop',
      });

      const longEntityText = [
        'Quang Trung', 'Nguyễn Huệ', 'Lê Lợi', 'Trần Hưng Đạo', 'Lý Thường Kiệt',
        'Đinh Bộ Lĩnh', 'Ngô Quyền', 'An Dương Vương', 'Hùng Vương', 'Hai Bà Trưng',
        'Bà Triệu', 'Lý Thái Tổ', 'Lê Thánh Tông', 'Gia Long', 'Minh Mạng',
        'Thiệu Trị', 'Tự Đức', 'Hàm Nghi', 'Đồng Khánh', 'Thành Thái',
        'Duy Tân', 'Khải Định', 'Bảo Đại', 'Phan Bội Châu', 'Phan Châu Trinh',
        'Hoàng Hoa Thám', 'Nguyễn Thái Học', 'Võ Nguyên Giáp', 'Hồ Chí Minh', 'Phạm Văn Đồng',
        'Trường Chinh', 'Lê Duẩn', 'Nguyễn Trãi', 'Chu Văn An', 'Nguyễn Du',
      ].join(' cùng với ');

      await extractTriplesWithLLM(longEntityText);

      expect(generateLLMCompletion).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(generateLLMCompletion).mock.calls[0];
      const messages = callArgs[0] as Array<{ role: string; content: string }>;
      const userMessage = messages.find((m) => m.role === 'user')?.content || '';

      const candidateSection = userMessage.split('DANH SÁCH THỰC THỂ CÓ TRONG VĂN BẢN:')[1]?.split('VĂN BẢN (TEXT):')[0] || '';
      const candidateLines = candidateSection.trim().split('\n').filter((l) => l.startsWith('- '));

      expect(candidateLines.length).toBeGreaterThan(0);
      const totalCandidates = (candidateSection.match(/\[ID: /g) || []).length;
      expect(totalCandidates).toBeLessThanOrEqual(MAX_CANDIDATE_SPANS_IN_PROMPT);
      expect(totalCandidates).toBeGreaterThanOrEqual(25);
    });
  });

  describe('extractTriplesFromTextAsync', () => {
    it('should extract pure LLM-verified triples on success without unverified rule pollution', async () => {
      vi.mocked(generateLLMCompletion).mockResolvedValue({
        content: JSON.stringify({
          triples: [
            {
              sourceEntity: 'Quang Trung',
              relationType: 'ALIAS_OF',
              targetEntity: 'Nguyễn Huệ',
              confidence: 0.99,
            },
          ],
        }),
        model: 'qwen3.5-4b-instruct-q4_k_m',
        provider: 'LOCAL_LLM',
        finishReason: 'stop',
      });

      const result = await extractTriplesFromTextAsync('Quang Trung tức là Nguyễn Huệ.');
      expect(result.length).toBe(1);
      const alias = result.find(t => t.relationType === 'ALIAS_OF');
      expect(alias).toBeDefined();
      expect(alias?.confidence).toBe(0.99);
      expect((result as any)._meta?.cached).toBe(false);
    });

    it('should cache empty triples array and reuse from cache on subsequent calls without calling LLM again', async () => {
      vi.mocked(generateLLMCompletion).mockResolvedValue({
        content: JSON.stringify({ triples: [] }),
        model: 'qwen3.5-4b-instruct-q4_k_m',
        provider: 'LOCAL_LLM',
        finishReason: 'stop',
      });

      const text = 'Năm 1975 diễn ra cuộc họp đánh giá chiến dịch giải phóng.';
      const firstResult = await extractTriplesFromTextAsync(text);
      expect(firstResult.length).toBe(0);
      expect((firstResult as any)._meta?.cached).toBe(false);
      expect(generateLLMCompletion).toHaveBeenCalledTimes(1);

      // Second call should hit disk cache and NOT call LLM
      const secondResult = await extractTriplesFromTextAsync(text);
      expect(secondResult.length).toBe(0);
      expect(generateLLMCompletion).toHaveBeenCalledTimes(1); // Still 1
      expect((secondResult as any)._meta?.cached).toBe(true);
      expect((secondResult as any)._meta?.durationMs).toBe(0);
    });

    it('should preserve _meta.cached flag and 0ms duration on cache hit for non-empty triples', async () => {
      vi.mocked(generateLLMCompletion).mockResolvedValue({
        content: JSON.stringify({
          triples: [
            {
              sourceEntity: 'Trận Chi Lăng',
              relationType: 'LED_BY',
              targetEntity: 'Lê Lợi',
              confidence: 0.98,
            },
          ],
        }),
        model: 'qwen3.5-4b-instruct-q4_k_m',
        provider: 'LOCAL_LLM',
        finishReason: 'stop',
      });

      const text = 'Trận Chi Lăng do Lê Lợi trực tiếp chỉ huy toàn quân.';
      const firstResult = await extractTriplesFromTextAsync(text);
      expect(firstResult.length).toBe(1);
      expect((firstResult as any)._meta?.cached).toBe(false);
      expect(generateLLMCompletion).toHaveBeenCalledTimes(1);

      // Second call should return cached triples with _meta.cached = true
      const secondResult = await extractTriplesFromTextAsync(text);
      expect(secondResult.length).toBe(1);
      expect(secondResult[0].sourceEntityName).toBe('Trận Chi Lăng');
      expect((secondResult as any)._meta?.cached).toBe(true);
      expect((secondResult as any)._meta?.durationMs).toBe(0);
      expect(generateLLMCompletion).toHaveBeenCalledTimes(1);
    });
  });

  describe('Commentary Isolation & Action Verb Gating', () => {
    it('isolates historian commentary blocks and does not link historians as military commanders', () => {
      const commentary = 'Sử thần Ngô Sĩ Liên nói: Trận Bạch Đằng năm 938 là võ công hiển hách.';
      const triples = extractTriplesFromText(commentary);
      const invalidLedBy = triples.find(
        (t) => t.relationType === 'LED_BY' && t.targetEntityName.includes('Ngô Sĩ Liên')
      );
      expect(invalidLedBy).toBeUndefined();
    });

    it('requires explicit action verbs before linking LED_BY in normal text', () => {
      // Normal narrative with explicit leader verb
      const textWithVerb = 'Trận Chi Lăng do Lê Lợi lãnh đạo đánh tan quân Minh.';
      const triplesWithVerb = extractTriplesFromText(textWithVerb);
      const ledByWithVerb = triplesWithVerb.find((t) => t.relationType === 'LED_BY');
      expect(ledByWithVerb).toBeDefined();

      // Incidental coexistence without action verb
      const textWithoutVerb = 'Trong Trận Chi Lăng, nhân dân nhớ tới công lao của Lê Lợi.';
      const triplesWithoutVerb = extractTriplesFromText(textWithoutVerb);
      const ledByWithoutVerb = triplesWithoutVerb.find((t) => t.relationType === 'LED_BY');
      expect(ledByWithoutVerb).toBeUndefined();
    });

    it('isolates foreign invading forces and rejects inverted PART_OF and LED_BY relations', () => {
      const text = 'Quang Trung đại phá 29 vạn quân Mãn Thanh tại Ngọc Hồi - Đống Đa.';
      const triples = extractTriplesFromText(text);
      const invalidPartOf = triples.find(
        (t) => t.sourceEntityId === 'person_quang_trung' && (t.targetEntityId.includes('thanh') || t.targetEntityId.includes('quan_man_thanh'))
      );
      expect(invalidPartOf).toBeUndefined();

      const invalidLedBy = triples.find(
        (t) => t.sourceEntityId.includes('quan_man_thanh') && t.targetEntityId === 'person_quang_trung'
      );
      expect(invalidLedBy).toBeUndefined();
    });

    it('extracts deterministic royal lineage triples accurately', () => {
      const text = 'Kinh Dương Vương sinh ra Lạc Long Quân rồi truyền ngôi báu cho dòng dõi Hùng Vương nối nghiệp.';
      const candidates = extractHistoricalCandidateSpans(text);
      const lineageTriples = extractRoyalLineageTriples(text, candidates);

      expect(lineageTriples.length).toBeGreaterThanOrEqual(1);
      const t1 = lineageTriples.find(
        (t) => t.sourceEntityId === 'person_lac_long_quan' && t.targetEntityId === 'person_kinh_duong_vuong'
      );
      expect(t1).toBeDefined();
      expect(t1?.relationType).toBe('ROYAL_LINEAGE');
    });

    it('extracts syntactic parenthetical and inline alias triples accurately', () => {
      const text = 'Thục Phán tức vua An Dương Vương xây thành Cổ Loa tại đất Phong Khê (nay thuộc Đông Anh).';
      const candidates = extractHistoricalCandidateSpans(text);
      const parentheticalTriples = extractSyntacticParentheticalTriples(text, candidates);

      const aliasTriple = parentheticalTriples.find(
        (t) => t.relationType === 'ALIAS_OF' && t.sourceEntityId === 'person_thuc_phan' && t.targetEntityId === 'person_an_duong_vuong'
      );
      expect(aliasTriple).toBeDefined();

      const locTriple = parentheticalTriples.find(
        (t) => (t.relationType === 'SAME_AS_LOCATION' || t.relationType === 'HAPPENED_AT') && t.sourceEntityId === 'loc_phong_khe' && t.targetEntityId === 'loc_dong_anh'
      );
      expect(locTriple).toBeDefined();
    });
  });

  describe('resolveHistoricalConflict', () => {
    it('should choose KEEP_A when Edge A score is strictly higher', () => {
      const result = resolveHistoricalConflict(
        { confidence: 0.95, sourceReliability: 'LEVEL_1' },
        { confidence: 0.5, sourceReliability: 'LEVEL_3' }
      );
      expect(result.action).toBe('KEEP_A');
    });

    it('should choose MULTI_PERSPECTIVE when both sources are LEVEL_1 or confidence delta <= 0.15', () => {
      const result = resolveHistoricalConflict(
        { confidence: 0.9, sourceReliability: 'LEVEL_1' },
        { confidence: 0.88, sourceReliability: 'LEVEL_1' }
      );
      expect(result.action).toBe('MULTI_PERSPECTIVE');
    });
  });
});

