import assert from 'node:assert/strict';
import { evaluateChatbotCase, ChatbotTestCase, ChatbotTurnExecution } from './chatbot-metrics.js';

function runTests() {
  const baseCase: ChatbotTestCase = {
    id: 'cb_test_01',
    category: 'CANONICAL_QA',
    title: 'Test Bạch Đằng 3 lần',
    turns: ['So sánh trận Bạch Đằng qua các triều đại'],
    expectedIntent: 'HISTORICAL_QUERY',
    expectedEntities: ['Ngô Quyền', 'Lê Hoàn', 'Trần Hưng Đạo'],
    expectedCitations: ['Đại Việt Sử Ký Toàn Thư'],
    antiSycophancyTrap: false,
    isFolklore: false,
    goldenSummary: 'Ngô Quyền (938), Lê Hoàn (981) Tiền Lê, Trần Hưng Đạo (1288).',
    requiredAspects: ['Ngô Quyền 938', 'Lê Hoàn 981', 'Trần Hưng Đạo 1288', 'Tiền Lê'],
    forbiddenClaims: ['Lê Hoàn thuộc nhà Lý', 'Lê Hoàn của nhà Lý'],
    turnExpectations: [
      {
        turnIndex: 1,
        requiredPhrases: ['938', '981', '1288', 'Tiền Lê'],
        forbiddenPhrases: ['Lê Hoàn thuộc nhà Lý'],
      },
    ],
  };

  // Test 1: Fails when forbidden phrase is affirmed
  {
    const executedTurns: ChatbotTurnExecution[] = [
      {
        turnIndex: 1,
        query: baseCase.turns[0],
        responseTokens: [],
        fullResponseText:
          'Trận Bạch Đằng năm 938 do Ngô Quyền lãnh đạo, năm 981 do vua Lê Hoàn thuộc nhà Lý lãnh đạo, và năm 1288 do Trần Hưng Đạo lãnh đạo. Triều đại Tiền Lê được phát triển rực rỡ.',
        citations: [{ sourceTitle: 'Đại Việt Sử Ký Toàn Thư', chunkId: 'chk_1' }],
        detectedIntent: 'HISTORICAL_QUERY',
        totalDurationMs: 1000,
        tokensPerSec: 20,
        ttftMs: 200,
      },
    ];

    const result = evaluateChatbotCase(baseCase, executedTurns);
    assert.equal(result.passed, false);
    assert.ok(result.errors && result.errors.some((e) => e.includes('Lê Hoàn thuộc nhà Lý')));
  }

  // Test 2: Passes when forbidden phrase is explicitly refuted
  {
    const executedTurns: ChatbotTurnExecution[] = [
      {
        turnIndex: 1,
        query: baseCase.turns[0],
        responseTokens: [],
        fullResponseText:
          'Trận Bạch Đằng năm 938 do Ngô Quyền chỉ huy đánh tan quân Nam Hán. Năm 981, vua Lê Hoàn lãnh đạo, hoàn toàn không phải Lê Hoàn thuộc nhà Lý mà thuộc nhà Tiền Lê. Năm 1288, Hưng Đạo Vương Trần Quốc Tuấn (Trần Hưng Đạo) đại thắng Nguyên Mông.',
        citations: [{ sourceTitle: 'Đại Việt Sử Ký Toàn Thư', chunkId: 'chk_1' }],
        detectedIntent: 'HISTORICAL_QUERY',
        totalDurationMs: 1000,
        tokensPerSec: 20,
        ttftMs: 200,
      },
    ];

    const result = evaluateChatbotCase(baseCase, executedTurns);
    assert.equal(result.errors?.some((e) => e.includes('Triggered forbidden')) ?? false, false);
    assert.equal(result.turnExpectationsPassed, true);
  }

  // Test 3: Fails when missing required anchor phrases
  {
    const executedTurns: ChatbotTurnExecution[] = [
      {
        turnIndex: 1,
        query: baseCase.turns[0],
        responseTokens: [],
        fullResponseText:
          'Trận Bạch Đằng năm 938 và năm 1288 rất vẻ vang, đánh bại quân xâm lược phương Bắc.',
        citations: [{ sourceTitle: 'Đại Việt Sử Ký Toàn Thư', chunkId: 'chk_1' }],
        detectedIntent: 'HISTORICAL_QUERY',
        totalDurationMs: 1000,
        tokensPerSec: 20,
        ttftMs: 200,
      },
    ];

    const result = evaluateChatbotCase(baseCase, executedTurns);
    assert.equal(result.passed, false);
    assert.equal(result.turnExpectationsPassed, false);
    assert.ok(result.errors?.some((e) => e.includes('missing required phrase')));
  }

  // Test 4: Penalizes missile reuse or false usurpation claims
  {
    const lineBackerCase: ChatbotTestCase = {
      id: 'cb_test_compound',
      category: 'VIDEO_INTENT',
      title: 'Điện Biên Phủ trên không',
      turns: ['Kể về trận Điện Biên Phủ trên không'],
      expectedIntent: 'VIDEO_INTENT',
      expectedIntents: ['VIDEO_INTENT', 'HISTORICAL_QUERY'],
      expectedEntities: ['Điện Biên Phủ trên không'],
      expectedCitations: [],
      antiSycophancyTrap: false,
      isFolklore: false,
      goldenSummary: 'Điện Biên Phủ trên không 18/12 đến 30/12/1972.',
      forbiddenClaims: ['thu hồi tên lửa đã bắn', 'tái sử dụng tên lửa'],
      turnExpectations: [
        {
          turnIndex: 1,
          requiredPhrases: ['18/12', '30/12'],
        },
      ],
    };

    const turnsWithHallucination: ChatbotTurnExecution[] = [
      {
        turnIndex: 1,
        query: lineBackerCase.turns[0],
        responseTokens: [],
        fullResponseText:
          'Chiến dịch diễn ra từ 18/12 đến 30/12/1972. Quân đội ta đã thu hồi tên lửa đã bắn để sửa chữa và bắn tiếp.',
        citations: [],
        detectedIntent: 'VIDEO_INTENT',
        totalDurationMs: 1000,
        tokensPerSec: 20,
        ttftMs: 200,
      },
    ];

    const result = evaluateChatbotCase(lineBackerCase, turnsWithHallucination);
    assert.equal(result.passed, false);
    assert.ok(result.errors?.some((e) => e.includes('thu hồi tên lửa đã bắn')));
  }

  console.log('✅ All Chatbot Metrics negative invariant & forbidden phrase tests passed.');
}

runTests();
