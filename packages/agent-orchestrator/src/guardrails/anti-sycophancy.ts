/**
 * Anti-Sycophancy & False Premise Detection Guardrail
 * Detects leading questions with potential false premises (kinship, dynasty mismatch, fake relations)
 * and generates strict refusal & verification guidance for LLM prompts.
 */

import { resolveCanonicalEntity, isKnownMasterEntity } from '@chronoviet/shared-spec';

export interface PremiseAnalysisResult {
  isLeadingQuestion: boolean;
  isSameEntityCoReference?: boolean;
  questionType?: 'KINSHIP' | 'IDENTITY' | 'DYNASTY' | 'CHRONOLOGY' | 'GENERAL';
  detectedEntities: string[];
  suggestedDirective: string;
}

const KINSHIP_PATTERNS = [
  /(.+?)\s+và\s+(.+?)\s+(?:có\s+phải\s+(?:là\s+)?|là\s+có\s+phải\s+|là\s+|có\s+phải\s+)(?:2|hai)?\s*(?:anh\s+em|chị\s+em|cha\s+con|mẹ\s+con|vợ\s+chồng|ông\s+cháu)(?:\s+hả|\s+không|\s+hay\s+không|\s+phải\s+không|\s*\?)?/i,
  /(.+?)\s+và\s+(.+?)\s+(?:có\s+quan\s+hệ|quan\s+hệ|mối\s+quan\s+hệ|có\s+liên\s+quan|liên\s+quan)\s+(?:gì|như\s+thế\s+nào|ra\s+sao|gì\s+với\s+nhau)(?:\s+với\s+nhau)?(?:\s+hả|\s+không|\s+hay\s+không|\s+phải\s+không|\s*\?)?/i,
  /(?:mối\s+)?quan\s+hệ\s+(?:giữa\s+)?(.+?)\s+và\s+(.+?)(?:\s+là\s+gì|\s+như\s+thế\s+nào|\s*\?)?/i,
  /(.+?)\s+có\s+phải\s+(?:là\s+)?(?:con|cha|anh|em|vợ|chồng|cháu)\s+của\s+(.+?)(?:\s+không|\s+hay\s+không|\s+phải\s+không|\s+hả|\s*\?)?/i,
  /(.+?)\s+là\s+(?:con|cha|anh|em|vợ|chồng|cháu|ông|bà|vợ|chồng)\s+của\s+(.+?)(?:\s+hả|\s+không|\s+hay\s+không|\s+phải\s+không|\s*\?)?/i,
  /(.+?)\s+là\s+anh\s+em\s+ruột\s+với\s+(.+?)(?:\s+hả|\s+không|\s+hay\s+không|\s+phải\s+không|\s*\?)?/i,
  /(.+?)\s+và\s+(.+?)\s+có\s+phải\s+(?:là\s+)?(?:cùng\s+một\s+người|là\s+một|2\s+người\s+khác\s+nhau|hai\s+người\s+khác\s+nhau)(?:\s+không|\s+hay\s+không|\s+phải\s+không|\s+hả|\s*\?)?/i,
];

const DYNASTY_PATTERNS = [
  /(.+)\s+(?:có\s+phải\s+là\s+vua|lập\s+ra|thuộc)\s+(?:nhà|triều)\s+(.+)(?:\s+không|\s+hả|\s*\?)?/i,
];

const SYCOPHANCY_PATTERNS = [
  /(?:gia\s*phả|hậu\s*duệ|huyết\s*thống|dòng\s*họ|dòng\s*dõi|tự\s*hào|khẳng\s*định|công\s*nhận|khen|nịnh|tổ\s*tiên|ông\s*cố|sắc\s*phong|thừa\s*kế|ngôi\s*báu|khám\s*phá\s*của\s*tôi|bài\s*luận|đồng\s*ý\s*với\s*tôi|đồng\s*ý\s*rằng|chứng\s*tỏ|tuyên\s*bố|xác\s*nhận|nói\s*rằng)/i,
];

const ANACHRONISM_PATTERNS = [
  /(?:đại\s*bác|súng|hỏa\s*mai|xe\s*tăng|máy\s*bay|súng\s*hỏa\s*cơ|thần\s*công|bộ\s*đàm|điện\s*thoại|tàu\s*hỏa|facebook|youtube|kính\s*thiên\s*văn|đèn\s*led|camera|microsoft\s*word|máy\s*vi\s*tính|mã\s*qr|ví\s*điện\s*tử|boeing|email|sms|cano|4k|truyền\s*hình|máy\s*kéo|máy\s*gặt|bom\s*nguyên\s*tử|thương\s*mại\s*điện\s*tử|áo\s*giáp|kevlar|pin\s*lithium|drone|bắn\s*tỉa|hồng\s*ngoại|tên\s*lửa|sam-2)/i,
];

const FOLKLORE_AS_FACT_PATTERNS = [
  /(?:thánh\s*gióng|bay\s*về\s*trời|nhổ\s*bụi\s*tre|nỏ\s*thần|rùa\s*vàng|thần\s*kim\s*quy|có\s*thật\s*100%|chính\s*sử.*thần\s*thoại|sơn\s*tinh|thủy\s*tinh|dưa\s*hấu|mai\s*an\s*tiêm|rùa\s*vàng.*hồ\s*gươm|chử\s*đồng\s*tử|tiên\s*dung|bánh\s*chưng|lang\s*liêu|thạch\s*sanh|thần\s*độc\s*cước|tre\s*trăm\s*đốt|trầu\s*cau|từ\s*thức|ông\s*táo|trạng\s*quỳnh|tấm\s*cám|mỵ\s*châu|ba\s*bể|thần\s*đồng\s*cổ|móng\s*rồng|cóc\s*kiện\s*trời|con\s*cóc\s*là\s*cậu)/i,
];

const MIXED_PREMISE_PATTERNS = [
  /(?:đúng\s*không|phải\s*không|có\s*đúng|đúng\s*chứ)/i,
  /(?:và\s+sau\s+đó|và\s+cùng|rồi\s+sau\s+đó|rồi\s+ký|rồi\s+lãnh\s+đạo|đã\s+viết.*dời\s+đô|và\s+dùng|và\s+phát\s+hành|và\s+chỉ\s+huy\s+mở|sáng\s+lập\s+ra|trực\s+tiếp\s+sáng\s+tác)/i,
  /(?:năm\s+\d+.*đã\s+viết|năm\s+\d+.*đã\s+chỉ\s+huy|năm\s+\d+.*đã\s+lãnh\s+đạo|năm\s+\d+.*đại\s+phá.*năm\s+\d+|đại\s*phá.*năm\s*\d+|trong\s+Hội\s*nghị.*năm\s*\d+|ký\s+Hiệp\s*định.*năm\s*\d+|phát\s*động\s*phong\s*trào)/i,
];

function cleanEntitySpan(span: string): string {
  return span
    .replace(/^(?:cho\s+(?:mình|tôi|em)\s+hỏi|bạn\s+ơi|bot\s+ơi|làm\s+ơn\s+cho\s+biết)\s+/i, '')
    .replace(/\s+(?:có\s+phải\s+(?:là\s+)?|có\s+phải|là\s+có\s+phải|là)$/i, '')
    .replace(/\s+(?:hay\s+không|phải\s+không|không|hả|nhỉ|thế|ạ)$/i, '')
    .replace(/[?!.,;:]+$/g, '')
    .trim();
}

/**
 * Analyzes whether a query contains a leading question that might trick the LLM into sycophancy.
 */
export function analyzePremiseAndLeadingIntent(query: string): PremiseAnalysisResult {
  const trimmed = query.trim();

  // 1. Kinship & Co-reference leading question check
  for (const pattern of KINSHIP_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const e1 = cleanEntitySpan(match[1] || '');
      const e2 = cleanEntitySpan(match[2] || '');

      const canon1 = resolveCanonicalEntity(e1);
      const canon2 = resolveCanonicalEntity(e2);

      if (canon1.entityId && canon2.entityId && canon1.entityId === canon2.entityId) {
        let suggestedDirective = `BẮT BUỘC ĐÍNH CHÍNH CÙNG MỘT NGƯỜI (ANTI-CO-REFERENCE ERROR): "${e1}" và "${e2}" thực chất là CÙNG MỘT NHÂN VẬT LỊCH SỬ (${canon1.canonicalName}), không phải là hai người khác nhau. BẮT BUỘC phải khẳng định ngay ở câu đầu tiên rằng đây là cùng một người (${e1} và ${e2} là các tên gọi, tên húy, niên hiệu, tôn hiệu hoặc tước hiệu khác nhau của cùng một nhân vật qua các thời kỳ), TUYỆT ĐỐI KHÔNG tách thành hai nhân vật hay nhận định là quan hệ anh em/họ hàng.`;
        if (canon1.entityId === 'person_quang_trung') {
          suggestedDirective += ` ĐẶC BIỆT LƯU Ý MIỄN NHIỄM NHẦM LẪN SỬ LIỆU: Quang Trung và Nguyễn Huệ là cùng một người. Giai thoại 'anh em cột chèo' trong lịch sử là giữa Nguyễn Huệ và Nguyễn Ánh (cùng kết duyên với công chúa con vua Lê Hiển Tông), TUYỆT ĐỐI KHÔNG gán ghép cụm từ này cho Quang Trung và Nguyễn Huệ. Hai người anh em ruột cùng khởi nghĩa Tây Sơn với Nguyễn Huệ là Nguyễn Nhạc và Nguyễn Lữ (Tây Sơn tam kiệt).`;
        }
        return {
          isLeadingQuestion: true,
          isSameEntityCoReference: true,
          questionType: 'KINSHIP',
          detectedEntities: [e1, e2].filter(Boolean),
          suggestedDirective,
        };
      }

      const isKnown1 = isKnownMasterEntity(e1);
      const isKnown2 = isKnownMasterEntity(e2);

      let suggestedDirective = `BẮT BUỘC KIỂM TRA TIỀN ĐỀ QUAN HỆ THÂN TỘC: Người dùng đang hỏi về quan hệ họ hàng giữa "${e1}" và "${e2}". Nếu không có bằng chứng lịch sử xác thực, hãy bác bỏ rõ ràng mối quan hệ này (ví dụ: "${e1} và ${e2} không phải là anh em/họ hàng...").`;

      if (isKnown1 && !isKnown2) {
        suggestedDirective += ` ĐẶC BIỆT: "${e2}" KHÔNG CÓ trong chính sử Việt Nam với tư cách thân tộc của "${e1}". Hãy bác bỏ dứt khoát và chủ động trình bày thân tộc/anh em ruột thực sự của "${e1}" đã được chính sử ghi chép để làm rõ bối cảnh. TUYỆT ĐỐI KHÔNG phỏng đoán "${e2}" là ai hay cho rằng "${e2}" là tên gọi khác/bí danh của bất kỳ ai khác.`;
      } else if (!isKnown1 && isKnown2) {
        suggestedDirective += ` ĐẶC BIỆT: "${e1}" KHÔNG CÓ trong chính sử Việt Nam với tư cách thân tộc của "${e2}". Hãy bác bỏ dứt khoát và chủ động trình bày thân tộc/anh em ruột thực sự của "${e2}" đã được chính sử ghi chép để làm rõ bối cảnh. TUYỆT ĐỐI KHÔNG phỏng đoán "${e1}" là ai hay cho rằng "${e1}" là tên gọi khác/bí danh của bất kỳ ai khác.`;
      } else if (isKnown1 && isKnown2) {
        suggestedDirective += ` Cả hai nhân vật đều có thật trong lịch sử. Hãy phân biệt rõ bối cảnh, niên đại, triều đại và quan hệ thực tế giữa từng nhân vật để tránh nhầm lẫn.`;
      } else {
        suggestedDirective += ` Cả hai tên gọi đều chưa rõ trong chính sử, hãy nêu rõ giới hạn tư liệu và không tự suy đoán phả hệ hư cấu.`;
      }

      return {
        isLeadingQuestion: true,
        questionType: 'KINSHIP',
        detectedEntities: [e1, e2].filter(Boolean),
        suggestedDirective,
      };
    }
  }

  // 1b. Generic dual-entity co-reference check if query mentions two names separated by "và" / "với"
  const andMatch = trimmed.match(/(.+?)\s+(?:và|với)\s+(.+?)(?:\s+|$|\?)/i);
  if (andMatch) {
    const e1 = cleanEntitySpan(andMatch[1] || '');
    const e2 = cleanEntitySpan(andMatch[2] || '');
    const canon1 = resolveCanonicalEntity(e1);
    const canon2 = resolveCanonicalEntity(e2);
    if (canon1.entityId && canon2.entityId && canon1.entityId === canon2.entityId) {
      return {
        isLeadingQuestion: true,
        isSameEntityCoReference: true,
        questionType: 'IDENTITY',
        detectedEntities: [e1, e2].filter(Boolean),
        suggestedDirective: `BẮT BUỘC ĐÍNH CHÍNH CÙNG MỘT NGƯỜI (ANTI-CO-REFERENCE ERROR): "${e1}" và "${e2}" thực chất là CÙNG MỘT NHÂN VẬT LỊCH SỬ (${canon1.canonicalName}), không phải là hai người khác nhau. BẮT BUỘC phải khẳng định ngay ở câu đầu tiên rằng đây là cùng một người (${e1} và ${e2} là các tên gọi, tên húy, niên hiệu, tôn hiệu hoặc tước hiệu khác nhau của cùng một nhân vật qua các thời kỳ). TUYỆT ĐỐI KHÔNG tách thành hai nhân vật hay nhận định là quan hệ anh em/họ hàng/thân tộc.`,
      };
    }
  }

  // 2. Dynasty / Monarch leading question check
  for (const pattern of DYNASTY_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const e1 = cleanEntitySpan(match[1] || '');
      const e2 = cleanEntitySpan(match[2] || '');
      return {
        isLeadingQuestion: true,
        questionType: 'DYNASTY',
        detectedEntities: [e1, e2].filter(Boolean),
        suggestedDirective: `BẮT BUỘC KIỂM TRA TIỀN ĐỀ TRIỀU ĐẠI: Người dùng đang hỏi gán ghép nhân vật "${e1}" với triều đại "${e2}". Hãy kiểm tra chính xác triều đại lịch sử thực tế và đính chính ngay nếu tiền đề sai lệch. Tuyệt đối không suy đoán nếu không có trong chính sử.`,
      };
    }
  }

  // 3. Sycophancy / False lineage flattery check
  for (const pattern of SYCOPHANCY_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        isLeadingQuestion: true,
        questionType: 'IDENTITY',
        detectedEntities: ['Gia phả tư nhân'],
        suggestedDirective: 'BẮT BUỘC BÁC BỎ HOẶC GIỮ NGUYÊN TẮC HỌC THUẬT: Không phụ họa vào các tuyên bố gia phả tư nhân hoặc nguồn gốc chưa qua kiểm chứng học thuật.',
      };
    }
  }

  // 4. Anachronism weapon/era check
  for (const pattern of ANACHRONISM_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        isLeadingQuestion: true,
        questionType: 'CHRONOLOGY',
        detectedEntities: ['Công nghệ vũ khí'],
        suggestedDirective: 'BẮT BUỘC BÁC BỎ SAI LỆCH NIÊN ĐẠI CÔNG NGHỆ: BẮT BUỘC phải bác bỏ rõ ràng ngay ở câu đầu tiên (ví dụ: "Không, vào thời kỳ [X] hoàn toàn chưa có [vũ khí/công nghệ Y]..."). Nêu rõ vũ khí và bối cảnh lịch sử thực tế thời đó. TUYỆT ĐỐI KHÔNG giải thích dông dài hay mô tả thông số các loại máy bay, súng đạn hiện đại không liên quan.',
      };
    }
  }

  // 5. Folklore / Myth claim check
  for (const pattern of FOLKLORE_AS_FACT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        isLeadingQuestion: true,
        questionType: 'GENERAL',
        detectedEntities: ['Truyền thuyết thần thoại'],
        suggestedDirective: 'BẮT BUỘC PHÂN ĐỊNH DÃ SỬ & CHÍNH SỬ: Phân định rõ ranh giới giữa biểu tượng truyền thuyết thần thoại dân gian và sự kiện thực chứng trong chính sử. Bác bỏ các chi tiết gán ghép sai lệch về địa danh, nhân vật hoặc niên đại; nêu rõ địa danh và tình tiết lịch sử/dân gian chính xác.',
      };
    }
  }

  // 6. Mixed Premise check
  for (const pattern of MIXED_PREMISE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        isLeadingQuestion: true,
        questionType: 'GENERAL',
        detectedEntities: ['Tiền đề hỗn hợp'],
        suggestedDirective: 'BẮT BUỘC KIỂM TRA TỪNG MỆNH ĐỀ: Phân tách rõ phần đúng và phần sai trong câu hỏi.',
      };
    }
  }

  return {
    isLeadingQuestion: false,
    questionType: 'GENERAL',
    detectedEntities: [],
    suggestedDirective: '',
  };
}

export interface CoReferenceInvariantResult {
  isValid: boolean;
  sanitized: string;
  violation?: string;
}

/**
 * Invariant Semantic Verification for Co-Referent Historical Entities.
 * When entity1 and entity2 are aliases of the same canonical persona (e.g. Quang Trung and Nguyễn Huệ),
 * this guardrail ensures that the generated text does NOT contradict itself by asserting that entity1 and
 * entity2 are bilateral distinct subjects, two different people, or brothers with each other.
 * 
 * NOTE: Anti-overfitting principle: This does NOT ban phrases like "hai anh em" or "anh em cột chèo" globally,
 * preserving authentic historical facts (e.g. Nguyễn Nhạc and Nguyễn Huệ are brothers; Nguyễn Huệ and Nguyễn Ánh
 * are brothers-in-law).
 */
export function verifyCoReferenceInvariant(
  response: string,
  entity1: string,
  entity2: string,
  canonicalName: string
): CoReferenceInvariantResult {
  if (!response || !entity1 || !entity2) {
    return { isValid: true, sanitized: response };
  }

  const e1Escaped = entity1.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const e2Escaped = entity2.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Bilateral contradiction patterns between the two aliases:
  // e.g. "Quang Trung và Nguyễn Huệ là 2 anh em", "Quang Trung và Nguyễn Huệ là hai người khác nhau",
  // "Quang Trung và Nguyễn Huệ là hai người anh em cột chèo"
  const contradictionRegex = new RegExp(
    `(?:${e1Escaped}\\s+và\\s+${e2Escaped}|${e2Escaped}\\s+và\\s+${e1Escaped})\\s+(?:là|thực\\s+chất\\s+là|vốn\\s+là)?\\s*(?:hai|2)?\\s*(?:người|vị\\s+vua|nhân\\s+vật)?\\s*(?:anh\\s+em(?:\\s+cột\\s+chèo|\\s+ruột)?|hai\\s+người\\s+khác\\s+nhau|2\\s+người\\s+khác\\s+nhau)`,
    'gi'
  );

  if (contradictionRegex.test(response)) {
    const violation = `Contradictory bilateral relation detected asserting that co-referent aliases "${entity1}" and "${entity2}" are distinct subjects.`;
    const sanitized = response.replace(
      contradictionRegex,
      `${entity1} và ${entity2} thực chất là cùng một nhân vật lịch sử (${canonicalName}) qua các thời kỳ khác nhau`
    );
    return {
      isValid: false,
      sanitized,
      violation,
    };
  }

  return {
    isValid: true,
    sanitized: response,
  };
}

