/**
 * Context Window Budgeting & Pruner (4,200 token peak recall zone)
 * Preserves Turn 1 Topic Anchor, RAG Context, Semantic Graph Triples, and Backward-Pruned Recent History.
 */

import { ChatTurnContext } from './query-rewriter.js';

export interface ContextBudgetPlan {
  systemPersonaBudget: number;      // ~300 tokens
  turn1AnchorBudget: number;        // ~80 tokens
  ragContextBudget: number;         // ~2,100 tokens
  historyBudget: number;            // ~800 tokens
  generationBuffer: number;         // ~900 tokens
}

export const DEFAULT_CONTEXT_BUDGET: ContextBudgetPlan = {
  systemPersonaBudget: 300,
  turn1AnchorBudget: 80,
  ragContextBudget: 2100,
  historyBudget: 800,
  generationBuffer: 900,
};

/**
 * Approximate token count for Vietnamese text (approx 1 token ~ 3.5 chars / 0.75 words)
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.5);
}

function clampTurnContent(content: string, maxTurnTokens: number = 300): string {
  if (!content) return '';
  const est = estimateTokens(content);
  if (est <= maxTurnTokens) return content;
  const maxChars = Math.floor(maxTurnTokens * 3.5);
  return content.slice(0, maxChars) + '...';
}

/**
 * Prunes conversation history turns to stay strictly within historyBudget (default 800 tokens)
 * Always preserves Turn 1 (initial anchor topic) if present.
 */
export function pruneConversationHistory(
  history: ChatTurnContext[],
  maxTokens: number = DEFAULT_CONTEXT_BUDGET.historyBudget
): ChatTurnContext[] {
  if (!history || history.length === 0) return [];

  const turn1Raw = history[0];
  const turn1: ChatTurnContext = {
    role: turn1Raw.role,
    content: clampTurnContent(turn1Raw.content, Math.min(120, DEFAULT_CONTEXT_BUDGET.turn1AnchorBudget * 1.5)),
  };

  if (history.length === 1) {
    return [turn1];
  }

  const remaining = history.slice(1);
  const selectedReversed: ChatTurnContext[] = [];

  let tokenSum = estimateTokens(turn1.content);

  // Accumulate turns backwards from most recent
  for (let i = remaining.length - 1; i >= 0; i--) {
    const rawTurn = remaining[i];
    const turn: ChatTurnContext = {
      role: rawTurn.role,
      content: clampTurnContent(rawTurn.content, 250),
    };
    const turnTokens = estimateTokens(turn.content);
    if (tokenSum + turnTokens > maxTokens) {
      break;
    }
    tokenSum += turnTokens;
    selectedReversed.push(turn);
  }

  const selectedInOrder = selectedReversed.reverse();

  // Combine Turn 1 with selected recent turns
  return [turn1, ...selectedInOrder];
}

/**
 * Truncates RAG context to fit within ragContextBudget (default 2,100 tokens)
 */
export function pruneRagContext(
  contextText: string,
  maxTokens: number = DEFAULT_CONTEXT_BUDGET.ragContextBudget
): string {
  if (!contextText) return '';
  const est = estimateTokens(contextText);
  if (est <= maxTokens) return contextText;

  const maxChars = Math.floor(maxTokens * 3.5);
  return contextText.slice(0, maxChars) + '\n[...nội dung được rút gọn theo giới hạn ngữ cảnh...]';
}

/**
 * Prunes knowledge graph triples with Entity-Priority & Bridge-Graph retention.
 * Direct bridge triples connecting query entities (A <-> B) get priority 100.
 * Core identity triples (Húy, Niên hiệu, Năm sinh/mất, Phả hệ) get priority 50.
 * Peripheral 1-hop relations get priority 10.
 */
export function pruneGraphTriples(
  triples: Array<{ source?: string; relation?: string; target?: string; confidence?: number }>,
  maxTriples: number = 15,
  queryEntityNames: string[] = []
): string {
  if (!triples || triples.length === 0) {
    return 'Không có quan hệ thực thể đặc thù.';
  }

  const queryNorms = queryEntityNames.map((n) => n.trim().toLowerCase()).filter(Boolean);

  const scoredTriples = triples.map((t) => {
    const src = (t.source || '').toLowerCase();
    const tgt = (t.target || '').toLowerCase();
    const rel = (t.relation || '').toUpperCase();

    let priority = 10;

    // Direct Bridge Triple (Connecting 2 distinct query entities)
    if (queryNorms.length >= 2) {
      const srcMatches = queryNorms.some((qn) => src.includes(qn) || qn.includes(src));
      const tgtMatches = queryNorms.some((qn) => tgt.includes(qn) || qn.includes(tgt));
      if (srcMatches && tgtMatches) {
        priority = 100;
      }
    }

    // Core Identity & Genealogy Relations
    if (priority < 100 && /(?:ALIAS|REIGN|BORN|DIED|FATHER|MOTHER|CHILD|SIBLING|SPOUSE|FOUNDED|COMMANDED|LED_BY|TEMPLE_NAME|POSTHUMOUS)/.test(rel)) {
      priority = 50;
    }

    return { triple: t, priority, conf: t.confidence || 1.0 };
  });

  // Sort descending by priority, then confidence
  scoredTriples.sort((a, b) => b.priority - a.priority || b.conf - a.conf);

  const sliced = scoredTriples.slice(0, maxTriples).map((st) => st.triple);
  return sliced.map((t) => `- ${t.source} [${t.relation}] -> ${t.target}`).join('\n');
}

/**
 * Hard safety clamp on total prompt messages to strictly avoid exceeding LLM context limits (e.g. 32k or 4k-8k safe zone)
 */
export function clampTotalPromptMessages<T extends { role: string; content: string }>(
  messages: T[],
  maxTotalTokens: number = 5000
): T[] {
  if (!messages || messages.length === 0) return [];

  let totalTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  if (totalTokens <= maxTotalTokens) {
    return messages;
  }

  // If prompt exceeds budget, clone and prune from system / history
  return messages.map((m, idx) => {
    // Preserve user turn (usually last) intact if possible
    if (idx === messages.length - 1 && m.role === 'user') {
      return m;
    }
    // Cap system prompt or history if oversized
    const tokenCap = m.role === 'system' ? 2500 : 400;
    const est = estimateTokens(m.content);
    if (est > tokenCap) {
      return {
        ...m,
        content: clampTurnContent(m.content, tokenCap),
      };
    }
    return m;
  });
}
