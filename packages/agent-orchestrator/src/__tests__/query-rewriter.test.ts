import { describe, it, expect } from 'vitest';
import {
  rewriteMultiTurnQuery,
  extractRecentEntities,
  ChatTurnContext,
} from '../chat/query-rewriter.js';

describe('Multi-Turn Historical Query Rewriter', () => {
  it('prioritizes user turns over assistant turns to establish topic anchor', () => {
    const history: ChatTurnContext[] = [
      {
        role: 'user',
        content: 'Trần Thủ Độ có vai trò gì trong sự thành lập triều đại nhà Trần?',
      },
      {
        role: 'assistant',
        content:
          'Trần Thủ Độ là nhân vật chủ chốt dàn xếp cuộc hôn nhân giữa Lý Chiêu Hoàng và Trần Cảnh, buộc vua Lý Huệ Tông phải nhường ngôi cho con gái rồi chuyển ngôi sang nhà Trần. Ông cũng tiêu diệt các thế lực nổi loạn như Quách Bốc.',
      },
    ];

    const entities = extractRecentEntities(history);
    // User anchor Trần Thủ Độ must come before assistant mentions (Lý Chiêu Hoàng, Trần Cảnh, Lý Huệ Tông, Quách Bốc)
    expect(entities[0]).toBe('Trần Thủ Độ');
  });

  it('rewrites "Người vợ của ông là ai..." with user anchor Trần Thủ Độ without being hijacked by assistant mentions', () => {
    const history: ChatTurnContext[] = [
      {
        role: 'user',
        content: 'Trần Thủ Độ có vai trò gì trong sự thành lập triều đại nhà Trần?',
      },
      {
        role: 'assistant',
        content:
          'Trần Thủ Độ sắp xếp để Lý Chiêu Hoàng nhường ngôi cho Trần Cảnh, lập nên nhà Trần.',
      },
      {
        role: 'user',
        content: 'Ông có câu nói nổi tiếng nào trước vua khi quân Mông Cổ xâm lược lần thứ nhất?',
      },
      {
        role: 'assistant',
        content:
          'Trong cuộc kháng chiến chống quân Mông Cổ lần 1 (1258), Trần Thủ Độ đã khẳng khái tâu với vua Trần Thái Tông: "Đầu thần chưa rơi xuống đất, xin bệ hạ đừng lo".',
      },
    ];

    const turn3Query = 'Người vợ của ông là ai và bà có công lao gì đối với vương triều?';
    const rewritten = rewriteMultiTurnQuery(turn3Query, history);

    expect(rewritten).toContain('Trần Thủ Độ');
    expect(rewritten).not.toContain('Lý Chiêu Hoàng');
    expect(rewritten).toMatch(/Người vợ của Trần Thủ Độ là ai/i);
  });

  it('rewrites leading pronoun "Ông có câu nói nổi tiếng nào..." correctly', () => {
    const history: ChatTurnContext[] = [
      {
        role: 'user',
        content: 'Trần Thủ Độ có vai trò gì trong sự thành lập triều đại nhà Trần?',
      },
      {
        role: 'assistant',
        content: 'Trần Thủ Độ là thái sư đầu triều nhà Trần.',
      },
    ];

    const rewritten = rewriteMultiTurnQuery(
      'Ông có câu nói nổi tiếng nào trước vua khi quân Mông Cổ xâm lược lần thứ nhất?',
      history
    );
    expect(rewritten).toMatch(/^Trần Thủ Độ có câu nói nổi tiếng nào/i);
  });

  it('rewrites family and kinship references for Nguyễn Trãi and Lệ Chi Viên', () => {
    const history: ChatTurnContext[] = [
      {
        role: 'user',
        content: 'Nguyễn Trãi có những đóng góp to lớn gì trong cuộc khởi nghĩa Lam Sơn?',
      },
      {
        role: 'assistant',
        content:
          'Nguyễn Trãi dâng Bình Ngô Sách và viết Bình Ngô Đại Cáo cho chủ tướng Lê Lợi.',
      },
    ];

    const turn2Rewritten = rewriteMultiTurnQuery(
      'Sau khi triều Lê thành lập, vụ án oan thảm khốc nào đã xảy ra với gia tộc ông?',
      history
    );
    expect(turn2Rewritten).toContain('Nguyễn Trãi');
    expect(turn2Rewritten).toMatch(/với gia tộc Nguyễn Trãi/i);

    const historyWithTurn2: ChatTurnContext[] = [
      ...history,
      {
        role: 'user',
        content: 'Sau khi triều Lê thành lập, vụ án oan thảm khốc nào đã xảy ra với gia tộc ông?',
      },
      {
        role: 'assistant',
        content:
          'Năm 1442, vụ án Lệ Chi Viên xảy ra liên quan đến cái chết của vua Lê Thái Tông và bà Nguyễn Thị Lộ, khiến gia tộc ông bị tru di tam tộc.',
      },
    ];

    const turn3Rewritten = rewriteMultiTurnQuery(
      'Ai là vị vua đã rửa oan cho ông sau này?',
      historyWithTurn2
    );
    expect(turn3Rewritten).toContain('Nguyễn Trãi');
    expect(turn3Rewritten).toMatch(/cho Nguyễn Trãi/i);
  });

  it('rewrites elliptical continuation questions with anchor contextualization', () => {
    const history: ChatTurnContext[] = [
      {
        role: 'user',
        content: 'Hai Bà Trưng khởi nghĩa chống lại ách đô hộ của thế lực phương Bắc nào vào năm bao nhiêu?',
      },
      {
        role: 'assistant',
        content: 'Hai Bà Trưng khởi nghĩa năm 40 chống nhà Đông Hán.',
      },
      {
        role: 'user',
        content: 'Nguyên nhân trực tiếp và lời thề xuất quân của Trưng Trắc là gì?',
      },
      {
        role: 'assistant',
        content: 'Do thái thú Tô Định giết Thi Sách. Lời thề: Một xin rửa sạch nước thù...',
      },
    ];

    const rewritten = rewriteMultiTurnQuery(
      'Tướng giặc nào sau đó được cử sang đàn áp cuộc khởi nghĩa?',
      history
    );
    expect(rewritten).toContain('Hai Bà Trưng');
  });

  it('leaves standalone self-contained queries untouched', () => {
    const standalone = 'Trận Ngọc Hồi Đống Đa diễn ra vào mùa xuân năm nào?';
    expect(rewriteMultiTurnQuery(standalone, [])).toBe(standalone);
  });
});
