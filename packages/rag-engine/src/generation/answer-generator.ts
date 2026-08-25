/**
 * ChronoViet Historical Answer Generator & Reasoning Pipeline
 * Orchestrates Retrieval, Graph-Guided Context Synthesis, Reasoning Prompting,
 * LLM Inference, and Grounded Claim Attribution.
 */

import {
  HistoricalAnswerGenerationRequest,
  HistoricalAnswerResponse,
  GraphTripleItem,
} from '@chronoviet/shared-spec';
import { callLLM, generateLLMCompletionStream, createLogger } from '@chronoviet/infra';
import { assembleContext } from './context-synthesizer.js';
import { buildPrompt } from './prompt-engine.js';
import { groundClaims } from './claim-grounder.js';
import type { ChronoRagEngine } from '../rag-engine.js';

const log = createLogger({ service: 'rag-answer-generator' });

/**
 * Generates a grounded, deep-reasoning historical answer for a given user query.
 */
export async function generateHistoricalAnswer(
  ragEngine: ChronoRagEngine,
  request: HistoricalAnswerGenerationRequest
): Promise<HistoricalAnswerResponse> {
  const startTime = Date.now();

  // 1. Execute RAG Retrieval
  const retrievalStart = Date.now();
  const searchRes = await ragEngine.search({
    query: request.query,
    entityFilter: request.entityFilter,
    rerankTopK: request.requiresMultiHop ? 6 : 5,
  });
  const retrievalLatencyMs = Date.now() - retrievalStart;

  // 2. Synthesize Context with Graph Triples & Numbered Evidence Chunks
  const contextResult = assembleContext({
    verifiedContext: searchRes.verifiedContext as any,
    triples: searchRes.triples as GraphTripleItem[],
    aliasTable: searchRes.aliasTable,
  });

  // 3. Build Intent-Aware Reasoning Prompt & Token Budget
  const promptResult = buildPrompt({
    query: request.query,
    contextText: contextResult.formattedContext,
    intent: request.intent,
    requiresMultiHop: request.requiresMultiHop,
    maxTokens: request.maxTokens,
    temperature: request.temperature,
  });

  // 4. Generate Answer via LLM
  const genStart = Date.now();
  let answerText = '';
  let totalTokens = 0;

  try {
    const llmRes = await callLLM({
      messages: promptResult.messages,
      temperature: promptResult.temperature,
      maxTokens: promptResult.maxTokens,
    });
    answerText = llmRes.content || '';
    totalTokens = llmRes.usage?.totalTokens || Math.ceil(answerText.length / 3.5);
  } catch (err: any) {
    log.error('rag.generation_failed', `LLM Generation failed: ${err.message}`, {
      query: request.query,
    });
    throw err;
  }
  const generationLatencyMs = Date.now() - genStart;

  // 5. Perform Sentence-Level Grounding & Chunk Attribution
  const grounding = groundClaims(answerText, contextResult.chunkMap);

  log.debug('rag.answer_generated', 'Historical answer generation completed', {
    query: request.query,
    retrievalLatencyMs,
    generationLatencyMs,
    claimsCount: grounding.claims.length,
    faithfulness: grounding.faithfulnessScore,
    citationCorrectnessScore: grounding.citationCorrectnessScore,
  });

  return {
    answerText,
    claims: grounding.claims,
    citations: grounding.citations.length > 0 ? grounding.citations : searchRes.citations,
    triplesUsed: searchRes.triples as GraphTripleItem[],
    metrics: {
      retrievalLatencyMs,
      generationLatencyMs,
      totalTokens,
    },
  };
}

/**
 * Generates a streaming historical answer yielding SSE token events
 */
export async function *generateHistoricalAnswerStream(
  ragEngine: ChronoRagEngine,
  request: HistoricalAnswerGenerationRequest
): AsyncGenerator<{ type: 'token' | 'triples' | 'citations' | 'done'; content?: string; triples?: GraphTripleItem[]; citations?: string[] }> {
  const searchRes = await ragEngine.search({
    query: request.query,
    entityFilter: request.entityFilter,
    rerankTopK: request.requiresMultiHop ? 6 : 5,
  });

  const triples = searchRes.triples as GraphTripleItem[];
  if (triples.length > 0) {
    yield { type: 'triples', triples };
  }
  if (searchRes.citations.length > 0) {
    yield { type: 'citations', citations: searchRes.citations };
  }

  const contextResult = assembleContext({
    verifiedContext: searchRes.verifiedContext as any,
    triples,
    aliasTable: searchRes.aliasTable,
  });

  const promptResult = buildPrompt({
    query: request.query,
    contextText: contextResult.formattedContext,
    intent: request.intent,
    requiresMultiHop: request.requiresMultiHop,
    maxTokens: request.maxTokens,
    temperature: request.temperature,
  });

  let fullText = '';
  for await (const chunk of generateLLMCompletionStream(promptResult.messages, {
    temperature: promptResult.temperature,
    max_tokens: promptResult.maxTokens,
  })) {
    fullText += chunk;
    yield { type: 'token', content: chunk };
  }

  yield {
    type: 'done',
    content: fullText,
    triples,
    citations: searchRes.citations,
  };
}

export const AnswerGenerator = {
  generate: generateHistoricalAnswer,
  generateStream: generateHistoricalAnswerStream,
};
