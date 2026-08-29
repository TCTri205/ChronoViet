import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateLLMCompletion } from '@chronoviet/infra';
import { extractionCache } from '../cache/extraction-cache.js';
import {
  isValidEntityName,
  extractTriplesFromText,
  extractTriplesWithLLM,
  extractTriplesFromTextAsync,
  resolveHistoricalConflict,
  MAX_CANDIDATE_SPANS_IN_PROMPT,
} from '../triple-extractor.js';

vi.mock('@chronoviet/infra', async (importOriginal) => {
  const original = await importOriginal<typeof import('@chronoviet/infra')>();
  return {
    ...original,
    generateLLMCompletion: vi.fn(),
  };
});

describe('Triple Extractor Unit Tests', () => {
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
      vi.mocked(generateLLMCompletion).mockResolvedValueOnce({
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
      vi.mocked(generateLLMCompletion).mockResolvedValueOnce({
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
      vi.mocked(generateLLMCompletion).mockResolvedValueOnce({
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
        extractTriplesWithLLM('Văn bản lịch sử test', { strict: true, allowFallback: false })
      ).rejects.toThrow('LLM Triple Extraction failed');
    });

    it('should return empty array when LLM fails but allowFallback is true', async () => {
      vi.mocked(generateLLMCompletion).mockRejectedValueOnce(new Error('LLM Gateway timeout'));

      const triples = await extractTriplesWithLLM('Văn bản lịch sử test', { allowFallback: true, strict: false });
      expect(triples).toEqual([]);
    });

    it('should cap candidate entities in LLM prompt to MAX_CANDIDATE_SPANS_IN_PROMPT (30)', async () => {
      vi.mocked(generateLLMCompletion).mockResolvedValueOnce({
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

      const candidateSection = userMessage.split('THỰC THỂ ỨNG VIÊN (CANDIDATE ENTITIES):')[1]?.split('VĂN BẢN (TEXT):')[0] || '';
      const candidateLines = candidateSection.trim().split('\n').filter((l) => l.startsWith('- ['));

      expect(candidateLines.length).toBeLessThanOrEqual(MAX_CANDIDATE_SPANS_IN_PROMPT);
      expect(candidateLines.length).toBeGreaterThanOrEqual(25);
    });
  });

  describe('extractTriplesFromTextAsync', () => {
    it('should extract pure LLM-verified triples on success without unverified rule pollution', async () => {
      vi.mocked(generateLLMCompletion).mockResolvedValueOnce({
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
