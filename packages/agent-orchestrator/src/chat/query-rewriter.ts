import { resolveCanonicalEntity } from '@chronoviet/shared-spec';

export interface ChatTurnContext {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const PRONOUN_COREFERENCE_REGEX =
  /(?:ông\s*ấy|bà\s*ấy|vị\s*tướng\s*(?:này|đó|ấy)|nhân\s*vật\s*(?:này|đó|ấy)|trận\s*đánh\s*(?:này|đó|ấy)|chiến\s*dịch\s*(?:này|đó|ấy)|triều\s*đại\s*(?:này|đó|ấy)|cuộc\s*khởi\s*nghĩa\s*(?:này|đó|ấy)|ngài|ông\s*ta|bà\s*ta|(?:^|[\s,;:.!?])ông(?:$|[\s,;:.!?])|(?:^|[\s,;:.!?])bà(?:$|[\s,;:.!?])|sau\s*đó|khi\s*nào|ở\s*đâu|vợ|chồng|gia\s*tộc|rửa\s*oan|dời\s*đô)/i;

/**
 * Extracts potential historical entity mentions from previous turns to resolve pronoun bindings,
 * prioritizing user turns (especially Turn 1 topic anchor) over assistant turns.
 */
export function extractRecentEntities(history: ChatTurnContext[]): string[] {
  const userEntities: string[] = [];
  const assistantEntities: string[] = [];

  const extractFromText = (text: string, targetList: string[]) => {
    // Look for multi-word capitalized phrases (Vietnamese proper nouns)
    const matches = text.match(/(?:[A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+)+)/g);
    if (matches) {
      for (const m of matches) {
        const cleaned = m.trim();
        if (cleaned.length > 3) {
          const canonical = resolveCanonicalEntity(cleaned);
          const canonicalName = canonical.canonicalName || cleaned;
          if (!targetList.includes(canonicalName)) {
            targetList.push(canonicalName);
          }
          if (cleaned !== canonicalName && !targetList.includes(cleaned)) {
            targetList.push(cleaned);
          }
        }
      }
    }
  };

  // 1. Scan user turns in chronological order (Turn 1 anchor has top priority)
  const userTurns = history.filter((t) => t.role === 'user');
  for (const turn of userTurns) {
    extractFromText(turn.content, userEntities);
  }

  // 2. Scan assistant turns as secondary fallback
  const assistantTurns = history.filter((t) => t.role === 'assistant').slice(-2);
  for (const turn of assistantTurns) {
    extractFromText(turn.content, assistantEntities);
  }

  // Combine: User entities first, then unique assistant entities
  const combined = [...userEntities];
  for (const ent of assistantEntities) {
    if (!combined.includes(ent)) {
      combined.push(ent);
    }
  }

  return combined;
}

/**
 * Rewrites a user query to be self-contained for RAG retrieval
 */
export function rewriteMultiTurnQuery(query: string, history: ChatTurnContext[] = []): string {
  const trimmed = query.trim();
  if (!history || history.length === 0 || !PRONOUN_COREFERENCE_REGEX.test(trimmed)) {
    return trimmed;
  }

  const candidateEntities = extractRecentEntities(history);
  if (candidateEntities.length === 0) {
    return trimmed;
  }

  const primaryEntity = candidateEntities[0];
  let rewritten = trimmed;

  // 1. Relational phrases: "người vợ của ông", "vợ của ông", "con của ông", "gia tộc ông", "gia tộc của ông"
  rewritten = rewritten.replace(
    /(?:người\s*vợ|vợ|người\s*chồng|chồng|thân\s*phụ|thân\s*mẫu|cha|mẹ|anh|em|con|tướng|quân\s*sư|thầy|tác\s*phẩm|câu\s*nói|chiến\s*công|vai\s*trò|công\s*lao|gia\s*tộc)\s+(?:của\s+)?(?:ông\s*ấy|bà\s*ấy|ông|bà|ngài|vị\s*(?:tướng\s*)?(?:này|đó|ấy))/gi,
    (match) => match.replace(/(?:ông\s*ấy|bà\s*ấy|ông|bà|ngài|vị\s*(?:tướng\s*)?(?:này|đó|ấy))$/i, primaryEntity)
  );

  // 2. Prepositional phrases: "với gia tộc ông", "cho ông", "cho bà", "với ông", "với bà", "của ông", "của bà"
  rewritten = rewritten.replace(
    /(?:với\s+gia\s+tộc|cho|với|của)\s+(?:ông\s*ấy|bà\s*ấy|ông|bà|ngài|vị\s*(?:tướng\s*)?(?:này|đó|ấy))(?=[\s,?.!]|$)/gi,
    (match) => match.replace(/(?:ông\s*ấy|bà\s*ấy|ông|bà|ngài|vị\s*(?:tướng\s*)?(?:này|đó|ấy))$/i, primaryEntity)
  );

  // 3. Leading pronoun subject: "Ông có...", "Bà có...", "Ông ấy sinh...", "Vị tướng này..."
  if (/^(?:ông\s*ấy|bà\s*ấy|vị\s*(?:tướng\s*)?(?:này|đó|ấy)|ông|bà|ngài)\s+/i.test(rewritten)) {
    rewritten = rewritten.replace(
      /^(?:ông\s*ấy|bà\s*ấy|vị\s*(?:tướng\s*)?(?:này|đó|ấy)|ông|bà|ngài)\s+/i,
      `${primaryEntity} `
    );
  }

  // 4. Standalone continuation clauses: "Sau đó...", "Khi nào...", "Ở đâu...", "Vì sao...", "Tại sao...", "Kết quả thế nào..."
  if (/^(?:sau\s*đó|khi\s*nào|ở\s*đâu|vì\s*sao|tại\s*sao|kết\s*quả\s*thế\s*nào)/i.test(rewritten)) {
    rewritten = `${primaryEntity}: ${rewritten}`;
  }

  // 5. If query had a pronoun but none of specific replacements matched
  if (rewritten === trimmed) {
    const replaced = rewritten.replace(
      /(?:ông\s*ấy|bà\s*ấy|vị\s*tướng\s*(?:này|đó|ấy)|nhân\s*vật\s*(?:này|đó|ấy))/i,
      primaryEntity
    );
    if (replaced !== rewritten) {
      rewritten = replaced;
    } else if (!rewritten.toLowerCase().includes(primaryEntity.toLowerCase())) {
      rewritten = `${rewritten} (${primaryEntity})`;
    }
  }

  return rewritten;
}
