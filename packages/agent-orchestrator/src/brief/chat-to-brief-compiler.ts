/**
 * Context-Aware Chat-to-Video Brief Compiler
 * Synthesizes multi-turn chat research, extracted entities, and primary historical citations
 * into a structured, persisted VideoBrief for 1-Click Autonomous Studio Handover.
 */

import {
  VideoBrief,
  VideoBriefSchema,
} from '@chronoviet/shared-spec';
import {
  createLogger,
  query,
  isPgAvailable,
  inMemoryStore,
} from '@chronoviet/infra';
import { ChatTurnContext } from '../chat/query-rewriter.js';

const log = createLogger({ service: 'agent-orchestrator' });

export interface CompileBriefOptions {
  topic?: string;
  targetDurationSec?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  narrativeTone?: 'epic' | 'academic' | 'reflective';
  conversationId?: string;
  projectId?: string;
}

/**
 * Checks if a turn text is relevant to the given topic to prevent context poisoning across unrelated topics
 */
function isTopicRelevant(text: string, topic: string): boolean {
  if (!text || !topic) return false;
  const topicWords = topic
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !/lịch|sử|việt|nam|cho|tôi|về|hỏi|như|thế|nào/i.test(w));
  if (topicWords.length === 0) return true;
  const lowerText = text.toLowerCase();
  return topicWords.some((word) => lowerText.includes(word));
}

/**
 * Extracts key proper noun entities from conversation turns that are relevant to the topic
 */
function extractKeyEntities(history: ChatTurnContext[], topic: string): string[] {
  const entities = new Set<string>();

  // 1. Extract entities directly from the topic title first
  const topicMatches = topic.match(/(?:[A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+)+)/g);
  if (topicMatches) {
    for (const m of topicMatches) {
      const cleaned = m.trim();
      if (cleaned.length > 3) entities.add(cleaned);
    }
  }

  // 2. Extract entities only from topic-relevant turns
  const relevantTurns = history.filter((turn) => isTopicRelevant(turn.content, topic));
  for (const turn of relevantTurns) {
    const matches = turn.content.match(/(?:[A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+)+)/g);
    if (matches) {
      for (const m of matches) {
        const cleaned = m.trim();
        if (cleaned.length > 3 && !/ChronoViet|Hệ Thống|Trợ Lý/i.test(cleaned)) {
          entities.add(cleaned);
        }
      }
    }
  }

  return Array.from(entities).slice(0, 10);
}

/**
 * Extracts historical citations referenced in conversation
 */
function extractCitations(history: ChatTurnContext[], topic: string): string[] {
  const citations = new Set<string>();
  const citationPatterns = [
    /Đại Việt Sử Ký Toàn Thư(?:\s*\([^)]+\))?/gi,
    /Khâm Định Việt Sử(?:\s*Thông Giám Cương Mục)?/gi,
    /Việt Sử Lược/gi,
    /Lam Sơn Thực Lục/gi,
    /Đại Nam Thực Lục/gi,
    /Gia Định Thành Thông Chí/gi,
  ];

  const relevantTurns = history.filter((t) => isTopicRelevant(t.content, topic));
  const turnsToScan = relevantTurns.length > 0 ? relevantTurns : history;

  for (const turn of turnsToScan) {
    for (const pattern of citationPatterns) {
      const match = turn.content.match(pattern);
      if (match) {
        for (const m of match) {
          citations.add(m.trim());
        }
      }
    }
  }

  if (citations.size === 0) {
    citations.add('Đại Việt Sử Ký Toàn Thư');
  }

  return Array.from(citations);
}

/**
 * Synthesizes multi-turn dialogue into a concise research summary without cross-topic poisoning
 */
function buildBriefSummary(history: ChatTurnContext[], topic: string): string {
  if (!history || history.length === 0) {
    return `Nghiên cứu tổng quan về sự kiện và nhân vật lịch sử: ${topic}.`;
  }

  const relevantAssistantTurns = history.filter(
    (t) => t.role === 'assistant' && isTopicRelevant(t.content, topic)
  );

  if (relevantAssistantTurns.length > 0) {
    const combined = relevantAssistantTurns
      .map((t) => t.content.replace(/[#*`_]/g, ' ').replace(/\s+/g, ' ').trim())
      .join(' ')
      .slice(0, 600);
    return combined.length > 30 ? combined : `Nghiên cứu chi tiết về ${topic}.`;
  }

  return `Nghiên cứu tổng quan và chi tiết về sự kiện, nhân vật lịch sử: ${topic}.`;
}

/**
 * Compiles conversation history or custom parameters into a structured, persisted VideoBrief
 */
export async function compileChatToVideoBrief(
  history: ChatTurnContext[] = [],
  options: CompileBriefOptions = {}
): Promise<VideoBrief> {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  const briefId = `brief_${timestamp}_${randomSuffix}`;

  let resolvedTopic = options.topic?.trim();
  if (!resolvedTopic && history.length > 0) {
    // Determine topic from first user turn or key entity
    const firstUserTurn = history.find((t) => t.role === 'user');
    resolvedTopic = firstUserTurn?.content.replace(/[?!.]/g, '').trim() || 'Lịch sử Việt Nam';
  }
  if (!resolvedTopic) {
    resolvedTopic = 'Chiến thắng Bạch Đằng năm 938';
  }

  const keyEntities = extractKeyEntities(history, resolvedTopic);
  const citations = extractCitations(history, resolvedTopic);
  const summary = buildBriefSummary(history, resolvedTopic);

  const brief: VideoBrief = VideoBriefSchema.parse({
    id: briefId,
    conversationId: options.conversationId || null,
    projectId: options.projectId || null,
    topic: resolvedTopic,
    summary,
    keyEntities,
    citations,
    targetDurationSec: options.targetDurationSec || 60,
    aspectRatio: options.aspectRatio || '16:9',
    narrativeTone: options.narrativeTone || 'epic',
    createdAt: new Date().toISOString(),
  });

  // Persist to database (PostgreSQL with in-memory fallback)
  const pgUp = await isPgAvailable();
  if (pgUp) {
    try {
      await query(
        `INSERT INTO video_briefs (
          id, conversation_id, project_id, topic, summary, key_entities, citations,
          target_duration_sec, aspect_ratio, narrative_tone, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          topic = EXCLUDED.topic,
          summary = EXCLUDED.summary,
          key_entities = EXCLUDED.key_entities,
          citations = EXCLUDED.citations,
          target_duration_sec = EXCLUDED.target_duration_sec,
          aspect_ratio = EXCLUDED.aspect_ratio,
          narrative_tone = EXCLUDED.narrative_tone`,
        [
          brief.id,
          brief.conversationId,
          brief.projectId,
          brief.topic,
          brief.summary,
          JSON.stringify(brief.keyEntities),
          JSON.stringify(brief.citations),
          brief.targetDurationSec,
          brief.aspectRatio,
          brief.narrativeTone,
          brief.createdAt,
        ]
      );
      log.info('brief.persisted_pg', `Saved video brief ${brief.id} to PostgreSQL`, { briefId: brief.id });
    } catch (err: any) {
      log.warn('brief.pg_persist_failed', `Failed to write video brief to PostgreSQL: ${err.message}`, { error: err.message });
      inMemoryStore.videoBriefs.set(brief.id, brief);
    }
  } else {
    inMemoryStore.videoBriefs.set(brief.id, brief);
    log.info('brief.persisted_memory', `Saved video brief ${brief.id} to InMemory store`, { briefId: brief.id });
  }

  return brief;
}

export async function getVideoBriefById(briefId: string): Promise<VideoBrief | null> {
  const pgUp = await isPgAvailable();
  if (pgUp) {
    try {
      const rows = await query<any>(`SELECT * FROM video_briefs WHERE id = $1 LIMIT 1`, [briefId]);
      if (rows && rows.length > 0) {
        const r = rows[0];
        return VideoBriefSchema.parse({
          id: r.id,
          conversationId: r.conversation_id,
          projectId: r.project_id,
          topic: r.topic,
          summary: r.summary,
          keyEntities: Array.isArray(r.key_entities) ? r.key_entities : typeof r.key_entities === 'string' ? JSON.parse(r.key_entities) : [],
          citations: Array.isArray(r.citations) ? r.citations : typeof r.citations === 'string' ? JSON.parse(r.citations) : [],
          targetDurationSec: r.target_duration_sec || 60,
          aspectRatio: r.aspect_ratio || '16:9',
          narrativeTone: r.narrative_tone || 'epic',
          createdAt: r.created_at,
        });
      }
    } catch (err: any) {
      log.warn('brief.pg_read_failed', `Failed to read video brief from PostgreSQL: ${err.message}`);
    }
  }

  const mem = inMemoryStore.videoBriefs.get(briefId);
  return mem ? (mem as VideoBrief) : null;
}

export async function getVideoBriefsByConversationId(conversationId: string): Promise<VideoBrief[]> {
  const pgUp = await isPgAvailable();
  if (pgUp) {
    try {
      const rows = await query<any>(
        `SELECT * FROM video_briefs WHERE conversation_id = $1 ORDER BY created_at DESC`,
        [conversationId]
      );
      return rows.map((r: any) =>
        VideoBriefSchema.parse({
          id: r.id,
          conversationId: r.conversation_id,
          projectId: r.project_id,
          topic: r.topic,
          summary: r.summary,
          keyEntities: Array.isArray(r.key_entities) ? r.key_entities : typeof r.key_entities === 'string' ? JSON.parse(r.key_entities) : [],
          citations: Array.isArray(r.citations) ? r.citations : typeof r.citations === 'string' ? JSON.parse(r.citations) : [],
          targetDurationSec: r.target_duration_sec || 60,
          aspectRatio: r.aspect_ratio || '16:9',
          narrativeTone: r.narrative_tone || 'epic',
          createdAt: r.created_at,
        })
      );
    } catch (err: any) {
      log.warn('brief.pg_read_by_conv_failed', `Failed to read briefs for conversation ${conversationId}: ${err.message}`);
    }
  }

  const results: VideoBrief[] = [];
  for (const b of inMemoryStore.videoBriefs.values()) {
    if (b.conversationId === conversationId) {
      results.push(b);
    }
  }
  return results;
}
