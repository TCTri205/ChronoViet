/**
 * ChronoViet Interactive Terminal RAG Chatbot CLI
 */

import readline from 'readline';
import path from 'path';
import fs from 'fs';
import { ChronoRagEngine } from '../rag-engine.js';
import { createLogger, inMemoryStore, generateLLMCompletion } from '@chronoviet/shared-spec';

const log = createLogger({ service: 'rag-engine', correlationId: `cli-${Date.now()}` });

// Initial Sample Historical Documents to Seed Knowledge Base
const INITIAL_HISTORICAL_DOCUMENTS = [
  {
    title: 'Trận Ngọc Hồi - Đống Đa năm 1789',
    source: 'Đại Việt Sử Ký Toàn Thư (Tập 3)',
    dynasty: 'Nhà Tây Sơn',
    sourceReliability: 'LEVEL_1' as const,
    content: `Trận Ngọc Hồi - Đống Đa năm 1789 là một trong những trận chiến hiển hách nhất trong lịch sử chống ngoại xâm của dân tộc Việt Nam. 
Đại đế Quang Trung (tên thật là Nguyễn Huệ, còn gọi là Hồ Thơm hay Bắc Bình Vương) đã trực tiếp cầm quân, chỉ huy quân Tây Sơn thần tốc ra Bắc đánh tan 29 vạn quân Thanh tại Hà Nội (Ngọc Hồi, Đống Đa, Thăng Long). 
Sự kiện diễn ra vào dịp Tết Kỷ Dậu 1789, khiến tướng nhà Thanh là Sầm Nghi Đống phải thắt cổ tự tử, Tôn Sĩ Nghị tháo chạy về nước.`,
  },
  {
    title: 'Hưng Đạo Đại Vương Trần Quốc Tuấn và 3 lần đại thắng Nguyên Mông',
    source: 'Đại Việt Sử Ký Toàn Thư (Tập 2)',
    dynasty: 'Nhà Trần',
    sourceReliability: 'LEVEL_1' as const,
    content: `Trần Hưng Đạo tên thật là Trần Quốc Tuấn, tước hiệu Hưng Đạo Đại Vương, còn được nhân dân tôn kính là Đức Thánh Trần. 
Ông là nhà quân sự thiên tài thời Nhà Trần, giữ chức Quốc công Tiết chế tổng chỉ huy quân đội Đại Việt trong các cuộc kháng chiến chống quân Nguyên Mông năm 1285 và 1288. 
Ông nổi tiếng với tác phẩm Hịch Tướng Sĩ và chiến thắng lẫy lừng trên sông Bạch Đằng năm 1288.`,
  },
  {
    title: 'Lê Lợi và Cuộc khởi nghĩa Lam Sơn',
    source: 'Lam Sơn Thực Lục',
    dynasty: 'Nhà Lê',
    sourceReliability: 'LEVEL_1' as const,
    content: `Lê Lợi (sau là Lê Thái Tổ, danh xưng Bình Định Vương) là người lãnh đạo cuộc khởi nghĩa Lam Sơn bùng nổ năm 1418 tại Thanh Hóa. 
Dưới sự cố vấn của Nguyễn Trãi, quân Lam Sơn đã tiến hành cuộc kháng chiến trường kỳ 10 năm, đánh bại quân Minh tại Tốt Động - Chúc Động và Chi Lăng - Xương Giang. 
Năm 1428, Lê Lợi chính thức lên ngôi Hoàng đế tại Thăng Long, thành lập triều đại Nhà Lê (Lê Sơ).`,
  },
  {
    title: 'Ngô Quyền và Chiến thắng Sông Bạch Đằng năm 938',
    source: 'Việt Sử Lược',
    dynasty: 'Nhà Ngô',
    sourceReliability: 'LEVEL_1' as const,
    content: `Ngô Quyền (Tiền Ngô Vương) là người lãnh đạo quân dân Đại Việt đánh tan quân xâm lược Nam Hán trên sông Bạch Đằng vào năm 938. 
Ông đã nảy ra sáng kiến dùng cọc gỗ bọc sắt cắm xuống lòng sông Bạch Đằng, lợi dụng thủy triều lên xuống để nhử chiến thuyền địch vào bãi cọc. 
Chiến thắng này đã chính thức chấm dứt hơn 1000 năm Bắc thuộc, mở ra thời kỳ độc lập tự chủ lâu dài cho dân tộc.`,
  },
  {
    title: 'Chiếu dời đô và sự kiện thành lập Thăng Long năm 1010',
    source: 'Đại Việt Sử Ký Toàn Thư',
    dynasty: 'Nhà Lý',
    sourceReliability: 'LEVEL_1' as const,
    content: `Năm 1010, vua Lý Thái Tổ (tên thật Lý Công Uẩn) ban Chiếu dời đô quyết định chuyển kinh đô từ Hoa Lư (Ninh Bình) về Đại La và đổi tên thành Thăng Long (Hà Nội ngày nay). Sự kiện đánh dấu bước phát triển rực rỡ của nền độc lập Đại Việt dưới triều Nhà Lý.`,
  },
  {
    title: 'Vụ án Lệ Chi Viên và Nguyễn Trãi',
    source: 'Đại Việt Sử Ký Toàn Thư',
    dynasty: 'Nhà Lê',
    sourceReliability: 'LEVEL_1' as const,
    content: `Nguyễn Trãi (hiệu Ức Trai) là danh nhân văn hóa thế giới, đại công thần triều Nhà Lê. 
Năm 1442, ông và gia quyến vướng vào thảm án Lệ Chi Viên (vườn vải) sau cái chết đột ngột của vua Lê Thái Tông. 
Đến thời vua Lê Thánh Tông năm 1464, Nguyễn Trãi đã được chính thức minh oan và ban tước hiệu cao quý.`,
  },
];

async function startTerminalChatbot() {
  console.log('\x1b[36m%s\x1b[0m', '==================================================');
  console.log('\x1b[33m%s\x1b[0m', ' 🏛️  CHRONOVIET INTERACTIVE RAG CHATBOT (TERMINAL) ');
  console.log('\x1b[36m%s\x1b[0m', '==================================================');
  console.log('Chế độ: Hybrid GraphRAG Engine + Citation Traceability');
  console.log('Gõ \x1b[32m/help\x1b[0m để xem danh sách câu lệnh, hoặc gõ \x1b[31m/exit\x1b[0m để thoát.\n');

  const ragEngine = new ChronoRagEngine();

  // Seed sample knowledge base
  log.info('chat.seeding_started', 'Seeding default historical knowledge base');
  console.log('\x1b[90m[*] Đang khởi tạo bộ tri thức lịch sử mặc định...\x1b[0m');
  for (const doc of INITIAL_HISTORICAL_DOCUMENTS) {
    await ragEngine.ingestDocument(doc.content, {
      title: doc.title,
      source: doc.source,
      dynasty: doc.dynasty,
      sourceReliability: doc.sourceReliability,
    });
  }
  log.info('chat.seeding_completed', 'Knowledge base ready', {
    documents: INITIAL_HISTORICAL_DOCUMENTS.length,
  });
  console.log(`\x1b[32m[+] Khởi tạo thành công ${INITIAL_HISTORICAL_DOCUMENTS.length} văn bản sử liệu sẵn sàng!\x1b[0m\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\x1b[35mChronoViet Chatbot>\x1b[0m ',
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    if (input === '/exit' || input === 'exit' || input === 'quit') {
      console.log('\x1b[33m[!] Cảm ơn bạn đã trải nghiệm ChronoViet RAG Chatbot. Tạm biệt!\x1b[0m');
      process.exit(0);
    }

    if (input === '/help') {
      console.log('\n📌 \x1b[1mDANH SÁCH CÂU LỆNH KHẢ DỤNG:\x1b[0m');
      console.log('  \x1b[32m/help\x1b[0m                  Hiển thị trợ giúp');
      console.log('  \x1b[32m/stats\x1b[0m                 Kiểm tra số lượng văn bản & tri thức trong bộ nhớ');
      console.log('  \x1b[32m/ingest <nội dung>\x1b[0m      Thêm một đoạn tri thức lịch sử mới vào RAG Engine');
      console.log('  \x1b[32m/exit\x1b[0m                  Thoát ứng dụng CLI\n');
      rl.prompt();
      return;
    }

    if (input === '/stats') {
      console.log(`\n📊 \x1b[1mRAG ENGINE STATS:\x1b[0m`);
      console.log(`  - Chunks in memory: ${inMemoryStore.documentChunks.size}`);
      console.log(`  - Entities in memory: ${inMemoryStore.entities.size}`);
      console.log(`  - Relationships in memory: ${inMemoryStore.relationships.length}\n`);
      rl.prompt();
      return;
    }

    if (input.startsWith('/ingest ')) {
      const customContent = input.replace('/ingest ', '').trim();
      if (customContent) {
        await ragEngine.ingestDocument(customContent, {
          title: 'Văn bản nạp thủ công qua Terminal CLI',
          source: 'Người dùng nhập trực tiếp',
          sourceReliability: 'LEVEL_1',
        });
        console.log('\x1b[32m[+] Đã nạp thành công tri thức mới vào RAG Engine!\x1b[0m\n');
      } else {
        console.log('\x1b[31m[!] Vui lòng nhập nội dung sau lệnh /ingest\x1b[0m\n');
      }
      rl.prompt();
      return;
    }

    // Process RAG Query
    log.info('chat.query_received', 'Processing RAG query', { query: input });
    console.log('\n\x1b[90m🔍 [1/2] Đang thực thi Hybrid RAG Search (Graph CTE + Dense Vector + Reranker)...\x1b[0m');
    const startTime = Date.now();
    try {
      const searchResult = await ragEngine.search({
        query: input,
        maxTokens: 500,
        rerankTopK: 5,
      });

      console.log(`\x1b[32m[✓] Truy xuất hoàn tất trong ${searchResult.retrievalLatencyMs}ms!\x1b[0m\n`);

      // Display RAG Retrieval Evidence
      console.log('\x1b[34m--------------------------------------------------\x1b[0m');
      console.log('\x1b[1m📚 NGUỒN TRI THỨC VÀ BẰNG CHỨNG TRUY XUẤT (RETRIEVED CITATIONS):\x1b[0m');
      if (searchResult.citations.length === 0) {
        console.log('  (Không tìm thấy đoạn trích dẫn phù hợp)');
      } else {
        searchResult.citations.forEach((cit, idx) => {
          console.log(`  [${idx + 1}] \x1b[33m${cit}\x1b[0m`);
        });
      }

      console.log('\n\x1b[1m🏛️ THỰC THỂ LỊCH SỬ LIÊN QUAN (VERIFIED ENTITIES):\x1b[0m');
      if (searchResult.verifiedContext.length === 0) {
        console.log('  (Chưa nhận dạng được thực thể chính xác)');
      } else {
        searchResult.verifiedContext.forEach((ctx) => {
          console.log(`  • \x1b[32m${ctx.canonicalName}\x1b[0m (Tên khác/Bí danh: ${ctx.aliases.join(', ') || 'N/A'}) - Độ tin cậy: ${(ctx.confidenceScore * 100).toFixed(1)}%`);
        });
      }
      console.log('\x1b[34m--------------------------------------------------\x1b[0m\n');

      // Process LLM Synthesis
      console.log('\x1b[90m🧠 [2/2] Đang tổng hợp câu trả lời từ LLM (Dựa trên tri thức truy xuất)... \x1b[0m');

      const contextText = searchResult.verifiedContext
        .map((c, i) => `[Tài liệu ${i + 1} - ${c.canonicalName}]:\n${c.summary}`)
        .join('\n\n');

      const promptMessages = [
        {
          role: 'system' as const,
          content: `Bạn là ChronoViet AI - Trợ lý Lịch sử Việt Nam chuẩn xác và khách quan.
Nhiệm vụ của bạn: Dựa VÀO ĐÚNG ngữ cảnh lịch sử được cung cấp dưới đây để trả lời câu hỏi của người dùng.
Quy tắc:
1. Trả lời chính xác, rõ ràng, giàu thông tin lịch sử.
2. Dẫn nguồn cụ thể dựa vào các tài liệu trích dẫn.
3. Không tự suy đoán hoặc đưa ra thông tin không có trong ngữ cảnh.

[NGỮ CẢNH TRUY XUẤT RAG]:
${contextText || 'Chưa có ngữ cảnh phù hợp'}`,
        },
        {
          role: 'user' as const,
          content: input,
        },
      ];

      let finalAnswer = '';
      let llmProviderName = '';

      try {
        const llmRes = await generateLLMCompletion(promptMessages, {
          temperature: 0.2,
          max_tokens: 1024,
        });
        finalAnswer = llmRes.content;
        llmProviderName = `${llmRes.provider} (${llmRes.model})`;
      } catch (_llmErr) {
        // Fallback rule-based summary if local LLM server / cloud fallback is not running
        finalAnswer = searchResult.verifiedContext.length > 0
          ? `[Chế độ RAG Direct Summary]: Dựa vào các tài liệu lịch sử truy xuất được:\n\n` +
            searchResult.verifiedContext.map((c) => `📌 **${c.canonicalName}**: ${c.summary}`).join('\n\n')
          : `Rất tiếc, hệ thống chưa tìm thấy thông tin lịch sử phù hợp cho câu hỏi của bạn.`;
        llmProviderName = 'RAG Knowledge Synthesis (Direct Context Fallback)';
      }

      console.log('\n\x1b[1m🤖 CHRONOVIET AI RESPONSE:\x1b[0m');
      console.log('\x1b[36m' + finalAnswer + '\x1b[0m');
      log.info('chat.query_completed', 'RAG query processed', {
        query: input,
        retrievalLatencyMs: searchResult.retrievalLatencyMs,
        citations: searchResult.citations.length,
        entities: searchResult.verifiedContext.length,
        totalTimeMs: Date.now() - startTime,
      });
      console.log(`\n\x1b[90m[Model/Provider: ${llmProviderName} | Latency RAG: ${searchResult.retrievalLatencyMs}ms | Total Time: ${Date.now() - startTime}ms]\x1b[0m\n`);
    } catch (err) {
      log.error('chat.query_failed', 'Error while processing question', { query: input, error: err });
      console.error('\x1b[31m[!] Lỗi khi xử lý câu hỏi:\x1b[0m', err);
    }

    rl.prompt();
  });
}

startTerminalChatbot().catch((err) => {
  log.error('chat.fatal_error', 'Failed to start Terminal Chatbot', { error: err });
  console.error('[!] Lỗi khởi chạy Terminal Chatbot:', err);
  process.exit(1);
});
