/**
 * Chatbot, Intent Routing & Hybrid RAG Retrieval Schemas
 */
import { z } from 'zod';

// ==========================================
export const ChatIntentSchema = z.enum([
  'CHITCHAT',
  'ENTITY_IDENTITY',
  'VIDEO_INTENT',
  'HISTORICAL_QUERY',
  'OUT_OF_DOMAIN',
]);
export type ChatIntent = z.infer<typeof ChatIntentSchema>;

export const ChatSubIntentSchema = z.enum([
  'FACTOID_LOOKUP',
  'GENEALOGY_RELATION',
  'BATTLE_TACTICS',
  'COMPARATIVE_SYNTHESIS',
  'GENERAL_OVERVIEW',
]);
export type ChatSubIntent = z.infer<typeof ChatSubIntentSchema>;

export const VideoHandoverMetadataSchema = z.object({
  topic: z.string(),
  primaryEntityId: z.string().optional(),
  canonicalName: z.string().optional(),
  summary: z.string().optional(),
});
export type VideoHandoverMetadata = z.infer<typeof VideoHandoverMetadataSchema>;

export const IntentClauseSchema = z.object({
  intent: ChatIntentSchema,
  subIntent: ChatSubIntentSchema.optional(),
  confidence: z.number().min(0).max(1),
  querySnippet: z.string(),
  targetEntityId: z.string().optional(),
  canonicalName: z.string().optional(),
});
export type IntentClause = z.infer<typeof IntentClauseSchema>;

export const CompositeIntentResultSchema = z.object({
  primaryIntent: ChatIntentSchema,
  subIntent: ChatSubIntentSchema.optional(),
  confidence: z.number().min(0).max(1),
  clauses: z.array(IntentClauseSchema),
  hasHistoricalInquiry: z.boolean(),
  hasGreetingOrIdentity: z.boolean(),
  hasOutOfDomain: z.boolean(),
  hasVideoRequest: z.boolean(),
  cleanSearchTopics: z.array(z.string()),
  videoHandover: VideoHandoverMetadataSchema.optional(),
  outOfDomainTopic: z.string().optional(),
});
export type CompositeIntentResult = z.infer<typeof CompositeIntentResultSchema>;


// 5. RAG ENGINE SCHEMAS (`packages/rag-engine`)
// ==========================================
export const RagSearchRequestSchema = z.object({
  query: z.string().min(1),
  entityFilter: z.array(z.string()).optional(),
  maxTokens: z.number().int().positive().optional().default(3200),
  rerankTopK: z.number().int().positive().optional().default(5),
  subIntent: ChatSubIntentSchema.optional(),
  targetYear: z.number().int().optional(),
});

export const HistoricalContextEntitySchema = z.object({
  entityId: z.string(),
  canonicalName: z.string(),
  aliases: z.array(z.string()).default([]),
  summary: z.string(),
  citations: z.array(z.string()).default([]),
  confidenceScore: z.number().min(0).max(1).default(1.0),
  chunkId: z.string().optional(),
  title: z.string().optional(),
  sourceReliability: z.enum(['LEVEL_1', 'LEVEL_2', 'LEVEL_3']).optional(),
  parentChunkId: z.string().optional(),
  timeStart: z.number().int().optional(),
  timeEnd: z.number().int().optional(),
  dynasty: z.string().optional(),
  epochIds: z.array(z.string()).optional(),
});

export const GraphTripleItemSchema = z.object({
  source: z.string(),
  relation: z.string(),
  target: z.string(),
  confidence: z.number().min(0).max(1).default(1.0),
});

export const VisualAnchorSuggestionSchema = z.object({
  entityId: z.string(),
  label: z.string(),
  suggestedVisualType: z.enum(['PORTRAIT', 'MAP', 'BATTLE_SCENE', 'DOCUMENT', 'DIAGRAM', 'HERO_SPOTLIGHT']),
  matchedClaimText: z.string(),
  timecodeSeconds: z.number().min(0).optional(),
});

export type VisualAnchorSuggestion = z.infer<typeof VisualAnchorSuggestionSchema>;

export const GroundedClaimItemSchema = z.object({
  claimText: z.string(),
  sourceChunkId: z.string(),
  sourceTitle: z.string(),
  reliability: z.enum(['LEVEL_1', 'LEVEL_2', 'LEVEL_3']).default('LEVEL_1'),
  entailmentScore: z.number().min(0).max(1).default(1.0),
  entailmentStatus: z.enum(['ENTAILED', 'CONTRADICTED', 'NOT_SUPPORTED', 'NEUTRAL']).default('ENTAILED'),
  visualAnchors: z.array(VisualAnchorSuggestionSchema).optional(),
});

export const HistoricalAnswerGenerationRequestSchema = z.object({
  query: z.string().min(1),
  intent: z.union([z.enum(['EVENT_DETAILS', 'WHY_REASONING', 'COMPARATIVE', 'BIOGRAPHY', 'GENERAL']), z.string()]).optional(),
  requiresMultiHop: z.boolean().optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  stream: z.boolean().optional(),
  entityFilter: z.array(z.string()).optional(),
});

export const HistoricalAnswerResponseSchema = z.object({
  answerText: z.string(),
  claims: z.array(GroundedClaimItemSchema).default([]),
  citations: z.array(z.string()).default([]),
  triplesUsed: z.array(GraphTripleItemSchema).default([]),
  visualAnchors: z.array(VisualAnchorSuggestionSchema).default([]),
  faithfulnessScore: z.number().min(0).max(100).optional(),
  citationCorrectnessScore: z.number().min(0).max(100).optional(),
  isLowConfidence: z.boolean().optional(),
  metrics: z.object({
    retrievalLatencyMs: z.number().min(0),
    generationLatencyMs: z.number().min(0),
    ttftMs: z.number().min(0).optional(),
    totalTokens: z.number().min(0).optional(),
  }),
});

export const HistoricalCitationItemSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  sourceTitle: z.string(),
  quote: z.string().optional(),
  originalExcerpt: z.string().optional(),
  pageNumber: z.number().int().optional(),
  reliability: z.string().optional(),
  reliabilityLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  dynasty: z.string().optional(),
  period: z.string().optional(),
  annalsName: z.string().optional(),
  confidenceScore: z.number().optional(),
  chunkId: z.string().optional(),
});

export const IsoDateStringSchema = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v.toISOString() : v))
  .optional();

export const ConversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  mode: z.enum(['RESEARCH', 'STUDIO']).default('RESEARCH'),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: IsoDateStringSchema,
  updatedAt: IsoDateStringSchema,
});

export const ConversationMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  citations: z.array(z.union([z.string(), HistoricalCitationItemSchema])).default([]),
  intent: z.string().optional(),
  createdAt: IsoDateStringSchema,
});


export const RagSearchResponseSchema = z.object({
  verifiedContext: z.array(HistoricalContextEntitySchema),
  aliasTable: z.record(z.string(), z.array(z.string())),
  citations: z.array(z.string()),
  triples: z.array(GraphTripleItemSchema).default([]),
  retrievalLatencyMs: z.number().min(0),
});


export type RagSearchRequestInput = z.input<typeof RagSearchRequestSchema>;
export type RagSearchRequest = z.output<typeof RagSearchRequestSchema>;
export type HistoricalContextEntity = z.infer<typeof HistoricalContextEntitySchema>;
export type GraphTripleItem = z.infer<typeof GraphTripleItemSchema>;
export type GroundedClaimItem = z.infer<typeof GroundedClaimItemSchema>;
export type HistoricalAnswerGenerationRequest = z.infer<typeof HistoricalAnswerGenerationRequestSchema>;
export type HistoricalAnswerResponse = z.infer<typeof HistoricalAnswerResponseSchema>;
export type HistoricalCitationItem = z.infer<typeof HistoricalCitationItemSchema>;
export type Conversation = z.infer<typeof ConversationSchema>;
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;
export type RagSearchResponse = z.infer<typeof RagSearchResponseSchema>;
