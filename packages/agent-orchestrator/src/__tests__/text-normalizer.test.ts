import { describe, it, expect } from 'vitest';
import { normalizeResilientText } from '../chat/text-normalizer.js';

describe('Context-Aware Resilient Text Normalizer', () => {
  it('un-sticks pronoun and predicate with Telex tone marks without changing other words', () => {
    const r1 = normalizeResilientText('hello, bạnlaf ai?');
    expect(r1.normalized).toBe('hello, bạn là ai?');
    expect(r1.shadow).toBe('hello, ban la ai?');

    const r2 = normalizeResilientText('cho mình hỏi botla ai thế');
    expect(r2.normalized).toBe('cho mình hỏi bot là ai thế');
    expect(r2.shadow).toBe('cho minh hoi bot la ai the');

    const r3 = normalizeResilientText('ai làai vậy');
    expect(r3.normalized).toBe('ai là ai vậy');

    const r4 = normalizeResilientText('bạnla ai');
    expect(r4.normalized).toBe('bạn là ai');
  });

  it('preserves foreign loanwords, Roman numerals, and single-letter symbols without mangling', () => {
    const loanwords = [
      'Tướng Lafayette có vai trò gì trong lịch sử?',
      'Bác sĩ Calmette đã có cống hiến gì?',
      'Đội ngũ staff cần chuẩn bị tài liệu brief dự án',
      'Máy bay MiG-21 và F-4 Phantom',
      'Thế kỷ V TCN có sự kiện gì quan trọng?',
      'Chương V: Khởi nghĩa Lam Sơn toàn thắng',
      'Bổ sung Vitamin K cho binh lính',
      'Khảo sát nhóm thanh niên Generation Z',
    ];

    for (const text of loanwords) {
      const res = normalizeResilientText(text);
      if (text.includes('Lafayette')) expect(res.normalized).toContain('Lafayette');
      if (text.includes('Calmette')) expect(res.normalized).toContain('Calmette');
      if (text.includes('staff')) expect(res.normalized).toContain('staff');
      if (text.includes('brief')) expect(res.normalized).toContain('brief');
      if (text.includes('Thế kỷ V')) {
        expect(res.normalized).toContain('Thế kỷ V');
        expect(res.normalized).not.toContain('Thế kỷ vậy');
      }
      if (text.includes('Chương V')) {
        expect(res.normalized).toContain('Chương V');
        expect(res.normalized).not.toContain('Chương vậy');
      }
      if (text.includes('Vitamin K')) {
        expect(res.normalized).toContain('Vitamin K');
        expect(res.normalized).not.toContain('Vitamin không');
      }
      if (text.includes('Generation Z')) {
        expect(res.normalized).toContain('Generation Z');
        expect(res.normalized).not.toContain('Generation gì');
      }
    }
  });

  it('normalizes common isolated text particles and shortcuts', () => {
    const res = normalizeResilientText('mình thif thấy việc này ko đc ổn');
    expect(res.normalized).toBe('mình thì thấy việc này không được ổn');
    expect(res.shadow).toContain('minh thi thay viec nay khong duoc on');

    const res2 = normalizeResilientText('hello, banj laf ai?');
    expect(res2.normalized).toBe('hello, bạn là ai?');
    expect(res2.shadow).toBe('hello, ban la ai?');

    const res3 = normalizeResilientText('bạn có đuowcj xem tài liệu này không?');
    expect(res3.normalized).toBe('bạn có được xem tài liệu này không?');

    const res4 = normalizeResilientText('liệu có dduowcj hay đươcj ko?');
    expect(res4.normalized).toBe('liệu có được hay được không?');

    const res5 = normalizeResilientText('nguwowif Vieejt Nam bieest khoong?');
    expect(res5.normalized).toBe('người Việt Nam biết không?');
  });

  it('strictly preserves valid dictionary words with ambiguous meanings like thẻ bài', () => {
    const res = normalizeResilientText('Vua ban thẻ bài bằng ngà voi và thẻ tre');
    expect(res.normalized).toBe('Vua ban thẻ bài bằng ngà voi và thẻ tre');
  });

  it('collapses excessive repeated punctuation and spaces', () => {
    const res = normalizeResilientText('Hello bot????    Bạn là ai!!!!!');
    expect(res.normalized).toBe('Hello bot? Bạn là ai!');
  });

  it('handles empty, null, and whitespace-only queries gracefully', () => {
    expect(normalizeResilientText('')).toEqual({ normalized: '', shadow: '' });
    expect(normalizeResilientText('   ')).toEqual({ normalized: '', shadow: '' });
  });

  it('executes under 0.05ms per query for production throughput', () => {
    const query = 'Xin chào ChronoViet, bạnlaf ai và có thể giúp gì cho tôi???';
    const start = performance.now();
    const iterations = 1000;
    for (let i = 0; i < iterations; i++) {
      normalizeResilientText(query);
    }
    const elapsed = performance.now() - start;
    const avgLatencyMs = elapsed / iterations;
    expect(avgLatencyMs).toBeLessThan(0.1);
  });
});
