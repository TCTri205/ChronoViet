/**
 * Multi-Turn Historical Query Rewriter
 * Resolves anaphoric pronouns, elliptical references, and contextual topic shifts
 */

export interface ChatTurnContext {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const PRONOUN_COREFERENCE_REGEX =
  /(?:ông\s*ấy|bà\s*ấy|vị\s*tướng\s*(?:này|đó|ấy)|nhân\s*vật\s*(?:này|đó|ấy)|trận\s*đánh\s*(?:này|đó|ấy)|chiến\s*dịch\s*(?:này|đó|ấy)|triều\s*đại\s*(?:này|đó|ấy)|ngài|ông\s*ta|bà\s*ta|ông|bà|sau\s*đó|khi\s*nào|ở\s*đâu)/i;

/**
 * Extracts potential historical entity mentions from previous turns to resolve pronoun bindings
 */
function extractRecentEntities(history: ChatTurnContext[]): string[] {
  const entities: string[] = [];
  // Scan backwards from the most recent turns
  const relevantTurns = history.slice(-4).reverse();

  for (const turn of relevantTurns) {
    // Look for capitalized phrases (Vietnamese proper nouns)
    const matches = turn.content.match(/(?:[A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+)+)/g);
    if (matches) {
      for (const m of matches) {
        const cleaned = m.trim();
        if (cleaned.length > 3 && !entities.includes(cleaned)) {
          entities.push(cleaned);
        }
      }
    }
  }

  return entities;
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

  // If query is short or starts with a pronoun/continuation question
  if (
    /^(ông\s*ấy|bà\s*ấy|ngài|vị\s*này|ông|bà)\s+/i.test(trimmed) ||
    /^(sau\s*đó|khi\s*nào|ở\s*đâu|vì\s*sao|tại\s*sao|kết\s*quả\s*thế\s*nào)/i.test(trimmed)
  ) {
    return `${primaryEntity} ${trimmed}`;
  }

  // Replace coreferent pronoun with the primary entity name
  const rewritten = trimmed.replace(
    /(?:ông\s*ấy|bà\s*ấy|vị\s*tướng\s*(?:này|đó|ấy)|nhân\s*vật\s*(?:này|đó|ấy))/i,
    primaryEntity
  );

  return rewritten !== trimmed ? rewritten : `${trimmed} (${primaryEntity})`;
}
