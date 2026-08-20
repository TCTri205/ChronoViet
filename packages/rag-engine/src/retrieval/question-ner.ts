/**
 * Question Entity Extraction & Keyword Parsing (Question NER)
 * Component of Chrono-RAG Runtime
 *
 * Characteristics:
 * - Powered by Stage 1 Pure TS Historical NER Engine (< 1ms execution, 0 LLM latency)
 * - Resolves canonical master entities and aliases deterministically
 * - Extracts temporal keywords and historical entities for hybrid graph retrieval
 */

import { resolveCanonicalEntity, isKnownMasterEntity } from '@chronoviet/shared-spec';
import { extractHistoricalCandidateSpans } from '@chronoviet/data-ingestion';

export interface ExtractedQueryInfo {
  entityIds: string[];
  entityNames: string[];
  keywords: string[];
}

export const QUESTION_STOPWORDS = new Set([
  'ai', 'gì', 'nào', 'đâu', 'khi', 'bao', 'năm', 'thế', 'nào', 'sao', 'tại',
  'là', 'của', 'và', 'trong', 'với', 'ở', 'được', 'vào', 'có', 'đã', 'sẽ',
  'như', 'thì', 'ra', 'lại', 'về', 'cho', 'này', 'đó', 'kia', 'hãy', 'kể',
  'cho', 'biết', 'tóm', 'tắt', 'diễn', 'biến', 'nguyên', 'nhân', 'kết', 'quả',
  'ý', 'nghĩa', 'lịch', 'sử', 'trận', 'đánh', 'chiến', 'thắng'
]);

export function extractQueryEntities(queryText: string): ExtractedQueryInfo {
  if (!queryText || typeof queryText !== 'string' || queryText.trim().length === 0) {
    return { entityIds: [], entityNames: [], keywords: [] };
  }

  const entityIds: string[] = [];
  const entityNames: string[] = [];

  // 1. Stage 1 Pure TS Historical NER Extraction (< 1ms)
  const candidateSpans = extractHistoricalCandidateSpans(queryText);

  for (const span of candidateSpans) {
    let entityId: string = span.suggestedCanonicalId || `ent_${span.text}`;
    let entityName: string = span.text;

    if (isKnownMasterEntity(span.text)) {
      const canonicalInfo = resolveCanonicalEntity(span.text);
      if (canonicalInfo && canonicalInfo.entityId) {
        entityId = canonicalInfo.entityId;
        entityName = canonicalInfo.canonicalName;
      }
    }

    if (!entityIds.includes(entityId)) {
      entityIds.push(entityId);
      entityNames.push(entityName);
    }
  }

  // 2. Keyword Extraction from tokens (filtering question stopwords)
  const tokens = queryText
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !QUESTION_STOPWORDS.has(w));

  const keywords = Array.from(new Set(tokens));

  return {
    entityIds,
    entityNames,
    keywords,
  };
}
