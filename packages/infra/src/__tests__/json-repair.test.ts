import { describe, it, expect } from 'vitest';
import {
  extractJsonFromText,
  repairJsonUnescapedQuotes,
  parseLlmJson,
} from '../utils/json-repair.js';

describe('Infra - JSON Self-Healing Recovery', () => {
  it('extracts clean JSON from markdown code blocks', () => {
    const raw = 'Here is the response:\n```json\n{"status": "ok", "items": [1, 2, 3]}\n```\nHope that helps!';
    expect(parseLlmJson(raw)).toEqual({ status: 'ok', items: [1, 2, 3] });
  });

  it('handles Python-style single quotes', () => {
    const raw = "{'name': 'Ngô Quyền', 'year': 938}";
    expect(parseLlmJson(raw)).toEqual({ name: 'Ngô Quyền', year: 938 });
  });

  it('repairs unescaped interior quotes in strings', () => {
    const raw = '{"quote": "Trần Hưng Đạo nói: "Ta thà làm ma nước Nam chứ không thèm làm vương đất Bắc"", "author": "Trần Bình Trọng"}';
    const parsed = parseLlmJson(raw);
    expect(parsed.author).toBe('Trần Bình Trọng');
    expect(parsed.quote).toContain('Trần Hưng Đạo nói:');
  });

  it('handles trailing commas in objects and arrays', () => {
    const raw = '{"epoch": "EPOCH_03", "battles": ["Bạch Đằng", "Chi Lăng",],}';
    expect(parseLlmJson(raw)).toEqual({
      epoch: 'EPOCH_03',
      battles: ['Bạch Đằng', 'Chi Lăng'],
    });
  });

  it('removes javascript style comments from JSON', () => {
    const raw = `
    {
      // Canonical battle name
      "battle": "Bạch Đằng 938",
      /* Commander name */
      "commander": "Ngô Quyền"
    }
    `;
    expect(parseLlmJson(raw)).toEqual({
      battle: 'Bạch Đằng 938',
      commander: 'Ngô Quyền',
    });
  });

  it('auto-closes truncated JSON objects and arrays', () => {
    const raw = '{"chapter": "Kháng chiến chống Tống", "events": [{"year": 981, "name": "Bạch Đằng"';
    expect(parseLlmJson(raw)).toEqual({
      chapter: 'Kháng chiến chống Tống',
      events: [{ year: 981, name: 'Bạch Đằng' }],
    });
  });

  it('extractJsonFromText returns fallback for empty input', () => {
    expect(extractJsonFromText('')).toBe('{}');
  });
});
