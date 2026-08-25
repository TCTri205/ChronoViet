import { z } from 'zod';
export { z };

// ==========================================
// 1. CORE CONFIG & THEME SCHEMAS
// ==========================================
export const ThemeConfigSchema = z.object({
  primaryColor: z.string().default('#C89D35'),
  secondaryColor: z.string().default('#9B1B1B'),
  backgroundColor: z.string().default('#0E0C0A'),
  gradientBg: z.string().optional(),
  fontFamily: z.string().default('Merriweather, serif'),
  customFontUrl: z.string().optional(),
  headerTitle: z.string().optional(),
  accentGlow: z.string().default('rgba(200, 157, 53, 0.4)'),
});

export const CaptionWordSchema = z.object({
  word: z.string(),
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(0),
});

export const WordTimestampSchema = z.object({
  word: z.string(),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
});

export const VieNeuTTSRequestSchema = z.object({
  text: z.string().min(1),
  speakerId: z.string().optional().default('vi_historical_male_1'),
  speedRatio: z.number().positive().optional().default(1.0),
  sampleRate: z.number().int().positive().optional().default(24000),
  paddingMs: z.number().int().min(0).optional().default(300),
  fps: z.number().int().positive().optional().default(30),
});

export const VieNeuTTSResponseSchema = z.object({
  status: z.enum(['SUCCESS', 'ERROR']),
  audioUrl: z.string(),
  audioDurationMs: z.number().min(0),
  calculatedFramesAt30fps: z.number().int().min(0),
  wordTimestamps: z.array(WordTimestampSchema),
  errorMsg: z.string().optional(),
  engineType: z.string().optional(),
});


export const LicenseTypeSchema = z.enum([
  'PUBLIC_DOMAIN',
  'CC0',
  'CC_BY_4_0',
  'CC_BY_SA_4_0',
  'UNKNOWN',
]);

export const AttributionSchema = z.object({
  author: z.string(),
  sourceUrl: z.string().optional(),
  license: z.string().optional(),
});

export const VideoDomainSchema = z.enum([
  'BIOGRAPHY',
  'BATTLE',
  'DYNASTY',
  'MYSTERY',
  'ARTIFACT',
]);

export const TemplateIdSchema = z.enum([
  'HISTORICAL_DOCUMENTARY',
  'QUICK_SHORTS',
  'MODERN_NEWS',
]);

export const AspectRatioSchema = z.enum(['16:9', '9:16', '1:1']).default('16:9');

export const FilterStyleSchema = z.enum([
  'HISTORICAL',
  'SEPIA',
  'VINTAGE',
  'NONE',
]);

export const KenBurnsEffectSchema = z.enum([
  'KEN_BURNS_ZOOM_IN',
  'KEN_BURNS_ZOOM_OUT',
  'KEN_BURNS_PAN_LEFT',
  'KEN_BURNS_PAN_RIGHT',
  'KEN_BURNS_PAN_UP',
  'KEN_BURNS_PAN_DOWN',
  'NONE',
]);

export const TransitionTypeSchema = z.enum([
  'DISSOLVE',
  'FADE',
  'FADE_TO_BLACK',
  'LIGHT_LEAK',
  'FILM_BURN',
  'GLITCH',
  'SLIDE_LEFT',
  'SLIDE_RIGHT',
  'SLIDE_UP',
  'SLIDE_DOWN',
  'ZOOM_IN',
  'ZOOM_OUT',
  'WIPE',
  'FLIP',
  'CLOCK_WIPE',
  'ZOOM_DREAMY',
  'CROSS_ZOOM',
  'LINEAR_BLUR',
  'NONE',
]);

export const LayoutModeSchema = z.enum([
  'BLUR_BG',
  'HISTORICAL_FRAME',
  'QUOTE_CANVAS',
  'QUOTE_SLIDE',
  'CHAPTER_CARD',
  'ARTICLE_UI',
  'SPONSOR_UI',
  'OUTRO_CARD',
  'SPLIT_COMPARE',
  'FULL_CONTAIN',
  'FULL_COVER',
  'TITLE_CARD',
  'STAT_CARD',
  'VERSUS_CARD',
  'BULLET_HIGHLIGHT',
  'MUSEUM_TAG',
  'SPLIT_THEORY',
  'VIGNETTE_DARK',
  'CENTER_SCALE',
  'PURE_IMAGE_FULL',
  'DOCUMENTARY_GRID',
  'NEWSPAPER_ARCHIVE',
  'GALLERY_3D',
  'HERO_SPOTLIGHT',
  'TIMELINE_CHRONO',
  'MAP_TACTICAL',
  'ARMY_STRENGTH',
  'CHARACTER_PROFILE',
  'ROYAL_DECREE',
  'ARTIFACT_INSPECT',
  'POEM_RECITING',
]);

export type LayoutMode = z.infer<typeof LayoutModeSchema>;

// Helper Sets for Layout Classification (Pure Image vs Pure Code)
export const PURE_IMAGE_LAYOUTS = new Set([
  'BLUR_BG',
  'HISTORICAL_FRAME',
  'FULL_COVER',
  'FULL_CONTAIN',
  'CENTER_SCALE',
  'VIGNETTE_DARK',
  'SPLIT_COMPARE',
  'PURE_IMAGE_FULL',
  'DOCUMENTARY_GRID',
  'NEWSPAPER_ARCHIVE',
  'GALLERY_3D',
]);

export const isPureImageLayout = (layoutMode?: LayoutMode | string): boolean => {
  if (!layoutMode) return false;
  return PURE_IMAGE_LAYOUTS.has(layoutMode);
};

export const SoundEffectSchema = z.object({
  sfxUrl: z.string(),
  offsetFrame: z.number().int().min(0).default(0),
  volume: z.number().min(0).max(1).default(0.85),
});

export const CustomKenBurnsSchema = z.object({
  scaleFrom: z.number().optional(),
  scaleTo: z.number().optional(),
  originX: z.number().optional(),
  originY: z.number().optional(),
});

export const OverlayPositionSchema = z.enum([
  'LEFT',
  'RIGHT',
  'TOP_LEFT',
  'TOP_RIGHT',
  'BOTTOM_LEFT',
  'BOTTOM_RIGHT',
  'CENTER',
]);

// ==========================================
// 2. DISCRIMINATED UNIONS & OVERLAY SCHEMAS
// ==========================================
export const TitleCardOverlaySchema = z.object({
  chapterNumber: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  seriesTitle: z.string().optional(),
  author: z.string().optional(),
  position: OverlayPositionSchema.optional(),
});

export const StatItemSchema = z.object({
  label: z.string(),
  value: z.string(),
  color: z.string().optional(),
});

export const StatCardOverlaySchema = z.object({
  title: z.string().optional(),
  name: z.string().optional(),
  role: z.string().optional(),
  details: z.string().optional(),
  statItems: z.array(StatItemSchema).optional(),
  position: OverlayPositionSchema.optional(),
});

export const VersusSideSchema = z.object({
  name: z.string(),
  stat: z.string(),
  color: z.string().optional(),
  badge: z.string().optional(),
});

export const VersusCardOverlaySchema = z.object({
  title: z.string().optional(),
  leftSide: VersusSideSchema.optional(),
  rightSide: VersusSideSchema.optional(),
  position: OverlayPositionSchema.optional(),
});

export const QuoteCanvasOverlaySchema = z.object({
  quoteText: z.string().optional(),
  author: z.string().optional(),
  subtitle: z.string().optional(),
  position: OverlayPositionSchema.optional(),
});

export const BulletHighlightOverlaySchema = z.object({
  title: z.string().optional(),
  bulletPoints: z.array(z.string()).optional(),
  position: OverlayPositionSchema.optional(),
});

export const ArtifactInfoSchema = z.object({
  origin: z.string().optional(),
  material: z.string().optional(),
  period: z.string().optional(),
  location: z.string().optional(),
  dimensions: z.string().optional(),
});

export const MuseumTagOverlaySchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  artifactInfo: ArtifactInfoSchema.optional(),
  position: OverlayPositionSchema.optional(),
});

export const HistoricalTheorySchema = z.object({
  title: z.string(),
  desc: z.string(),
  probability: z.string().optional(),
});

export const SplitTheoryOverlaySchema = z.object({
  title: z.string().optional(),
  theories: z.array(HistoricalTheorySchema).optional(),
  position: OverlayPositionSchema.optional(),
});

export const OutroCardOverlaySchema = z.object({
  title: z.string().optional(),
  author: z.string().optional(),
  quoteText: z.string().optional(),
  ctaText: z.string().optional(),
  bulletPoints: z.array(z.string()).optional(),
  position: OverlayPositionSchema.optional(),
});

export const ArticleIntroOverlaySchema = z.object({
  title: z.string().optional(),
  author: z.string().optional(),
  seriesTitle: z.string().optional(),
  position: OverlayPositionSchema.optional(),
});

export const SponsorOverlaySchema = z.object({
  sponsorTitle: z.string().optional(),
  sponsorDesc: z.string().optional(),
  ctaText: z.string().optional(),
  position: OverlayPositionSchema.optional(),
});

export const LooseOverlayDataSchema = z.object({
  name: z.string().optional(),
  role: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  seriesTitle: z.string().optional(),
  chapterNumber: z.string().optional(),
  author: z.string().optional(),
  quoteText: z.string().optional(),
  sponsorTitle: z.string().optional(),
  sponsorDesc: z.string().optional(),
  ctaText: z.string().optional(),
  details: z.string().optional(),
  position: OverlayPositionSchema.optional(),
  statItems: z.array(StatItemSchema).optional(),
  leftSide: VersusSideSchema.optional(),
  rightSide: VersusSideSchema.optional(),
  bulletPoints: z.array(z.string()).optional(),
  artifactInfo: ArtifactInfoSchema.optional(),
  theories: z.array(HistoricalTheorySchema).optional(),
});

export const OverlayDataSchema = LooseOverlayDataSchema;

export const AssetMetadataSchema = z.object({
  width: z.number().optional(),
  height: z.number().optional(),
  aspectRatio: z.string().optional(),
  durationSec: z.number().optional(),
  mimeType: z.string().optional(),
});

export const BaseTimelineSceneSchema = z.object({
  id: z.string(),
  type: z.enum(['PURE_CODE', 'PURE_IMAGE']).optional(),
  durationInFrames: z.number().optional(),
  durationInSeconds: z.number().optional(),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
  layoutMode: LayoutModeSchema.optional(),
  overlayType: z.string().optional(),
  component: z.string().optional(),
  text: z.string().optional(),
  captions: z.array(CaptionWordSchema).optional(),
  assetUrl: z.string().optional(),
  assetMetadata: AssetMetadataSchema.optional(),
  secondaryAssetUrl: z.string().optional(),
  secondaryAssetMetadata: AssetMetadataSchema.optional(),
  effect: KenBurnsEffectSchema.optional(),
  customKenBurns: CustomKenBurnsSchema.optional(),
  filterStyle: FilterStyleSchema.optional(),
  rotateDeg: z.number().optional(),
  fallbackLayoutMode: LayoutModeSchema.optional(),
  fallbackOverlayData: OverlayDataSchema.optional(),
  transition: TransitionTypeSchema.optional(),
  transitionDurationFrames: z.number().optional(),
  sceneAudioUrl: z.string().optional(),
  sfxUrl: z.string().optional(),
  soundEffects: z.array(SoundEffectSchema).optional(),
  attribution: AttributionSchema.optional(),
  license: LicenseTypeSchema.optional(),
  overlayData: OverlayDataSchema.optional(),
  hideSubtitle: z.boolean().optional(),
  hideHeader: z.boolean().optional(),
  layoutProps: z.record(z.string(), z.unknown()).optional(),
});

export const TimelineSceneSchema = BaseTimelineSceneSchema;

// ==========================================
// 4. MAIN SCRIPT SCHEMA (`script.json`)
// ==========================================
export const ChronoVideoScriptSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  videoType: VideoDomainSchema.optional(),
  templateId: TemplateIdSchema.optional(),
  theme: ThemeConfigSchema.optional(),
  aspectRatio: AspectRatioSchema.default('16:9'),
  audioUrl: z.string().optional(),
  captionsUrl: z.string().optional(),
  bgmUrl: z.string().optional(),
  bgmVolume: z.number().optional(),
  defaultLayoutMode: LayoutModeSchema.optional(),
  defaultFilterStyle: FilterStyleSchema.optional(),
  defaultTransition: TransitionTypeSchema.optional(),
  enableTransitions: z.boolean().optional(),
  timeline: z.array(TimelineSceneSchema),
  captions: z.array(CaptionWordSchema).optional(),
  fps: z.number().optional(),
});

export const ChronoVideoSchema = ChronoVideoScriptSchema;

// ==========================================
// 5. RAG ENGINE SCHEMAS (`packages/rag-engine`)
// ==========================================
export const RagSearchRequestSchema = z.object({
  query: z.string().min(1),
  entityFilter: z.array(z.string()).optional(),
  maxTokens: z.number().int().positive().optional().default(2048),
  rerankTopK: z.number().int().positive().optional().default(5),
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
});

export const GraphTripleItemSchema = z.object({
  source: z.string(),
  relation: z.string(),
  target: z.string(),
  confidence: z.number().min(0).max(1).default(1.0),
});

export const GroundedClaimItemSchema = z.object({
  claimText: z.string(),
  sourceChunkId: z.string(),
  sourceTitle: z.string(),
  reliability: z.enum(['LEVEL_1', 'LEVEL_2', 'LEVEL_3']).default('LEVEL_1'),
  entailmentScore: z.number().min(0).max(1).default(1.0),
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

const IsoDateStringSchema = z
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

export const VideoBriefSchema = z.object({
  id: z.string(),
  conversationId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  topic: z.string(),
  summary: z.string(),
  keyEntities: z.array(z.string()).default([]),
  citations: z.array(z.union([z.string(), HistoricalCitationItemSchema])).default([]),
  targetDurationSec: z.number().int().positive().default(60),
  aspectRatio: AspectRatioSchema.default('16:9'),
  narrativeTone: z.enum(['epic', 'academic', 'reflective']).default('epic'),
  createdAt: IsoDateStringSchema,
});

export const RagSearchResponseSchema = z.object({
  verifiedContext: z.array(HistoricalContextEntitySchema),
  aliasTable: z.record(z.string(), z.array(z.string())),
  citations: z.array(z.string()),
  triples: z.array(GraphTripleItemSchema).default([]),
  retrievalLatencyMs: z.number().min(0),
});

// Type Exports
export type GraphTripleItem = z.infer<typeof GraphTripleItemSchema>;
export type HistoricalCitationItem = z.infer<typeof HistoricalCitationItemSchema>;
export type Conversation = z.infer<typeof ConversationSchema>;
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;
export type VideoBrief = z.infer<typeof VideoBriefSchema>;
export type AssetMetadata = z.infer<typeof AssetMetadataSchema>;
export type StatItem = z.infer<typeof StatItemSchema>;
export type VersusSide = z.infer<typeof VersusSideSchema>;
export type ArtifactInfo = z.infer<typeof ArtifactInfoSchema>;
export type HistoricalTheory = z.infer<typeof HistoricalTheorySchema>;
export type OverlayPosition = z.infer<typeof OverlayPositionSchema>;
export type OverlayData = z.infer<typeof OverlayDataSchema>;
export type CustomKenBurns = z.infer<typeof CustomKenBurnsSchema>;
export type TransitionType = z.infer<typeof TransitionTypeSchema>;
export type FilterStyle = z.infer<typeof FilterStyleSchema>;
export type KenBurnsEffect = z.infer<typeof KenBurnsEffectSchema>;
export type TemplateId = z.infer<typeof TemplateIdSchema>;
export type VideoDomain = z.infer<typeof VideoDomainSchema>;
export type AspectRatio = z.infer<typeof AspectRatioSchema>;
export type CaptionWord = z.infer<typeof CaptionWordSchema>;
export type WordTimestamp = z.infer<typeof WordTimestampSchema>;
export type VieNeuTTSRequest = z.infer<typeof VieNeuTTSRequestSchema>;
export type VieNeuTTSResponse = z.infer<typeof VieNeuTTSResponseSchema>;
export type LicenseType = z.infer<typeof LicenseTypeSchema>;
export type Attribution = z.infer<typeof AttributionSchema>;
export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;
export type SoundEffect = z.infer<typeof SoundEffectSchema>;
export type TimelineSceneInput = z.input<typeof TimelineSceneSchema>;
export type TimelineScene = z.output<typeof TimelineSceneSchema>;
export type ChronoVideoScript = z.infer<typeof ChronoVideoScriptSchema>;
export type ChronoVideoProps = ChronoVideoScript;
export const VideoProjectSchema = ChronoVideoScriptSchema;
export type VideoProject = ChronoVideoScript;

export type RagSearchRequestInput = z.input<typeof RagSearchRequestSchema>;
export type RagSearchRequest = z.output<typeof RagSearchRequestSchema>;
export type HistoricalContextEntity = z.infer<typeof HistoricalContextEntitySchema>;
export type RagSearchResponse = z.infer<typeof RagSearchResponseSchema>;
export type GroundedClaimItem = z.infer<typeof GroundedClaimItemSchema>;
export type HistoricalAnswerGenerationRequest = z.infer<typeof HistoricalAnswerGenerationRequestSchema>;
export type HistoricalAnswerResponse = z.infer<typeof HistoricalAnswerResponseSchema>;

// ==========================================
// 6. DATA INGESTION & ETL SCHEMAS (MODULE 0)
// ==========================================
export const SourceReliabilityEnum = z.enum(['LEVEL_1', 'LEVEL_2', 'LEVEL_3']);

export const HistoricalEpochEnum = z.enum([
  'EPOCH_01', // Hùng Vương - Văn Lang & Âu Lạc (-179 TCN)
  'EPOCH_02', // Bắc Thuộc & Các Cuộc Khởi Nghĩa (179 TCN - 938)
  'EPOCH_03', // Ngô - Đinh - Tiền Lê (938 - 1009)
  'EPOCH_04', // Nhà Lý (1009 - 1225)
  'EPOCH_05', // Nhà Trần (1225 - 1400)
  'EPOCH_06', // Nhà Hồ & Canh Tân (1400 - 1407)
  'EPOCH_07', // Bắc Thuộc Lần 4 & Lam Sơn (1407 - 1427)
  'EPOCH_08', // Nhà Lê Sơ (1428 - 1527)
  'EPOCH_09', // Nam - Bắc Triều & Trịnh - Nguyễn (1527 - 1777)
  'EPOCH_10', // Tây Sơn & Phong Trào Khởi Nghĩa (1771 - 1802)
  'EPOCH_11', // Nhà Nguyễn Độc Lập (1802 - 1858)
  'EPOCH_12', // Pháp Thuộc & Phong Trào Yêu Nước (1858 - 1945)
  'EPOCH_13', // Kháng Chiến Chống Pháp (1945 - 1954)
  'EPOCH_14', // Kháng Chiến Chống Mỹ & Thống Nhất (1954 - 1975)
  'EPOCH_15', // Bảo Vệ Tổ Quốc, Đổi Mới & Hiện Đại (1975 - Nay)
]);

export const EntityTypeEnum = z.enum([
  'HISTORICAL_PERSON',
  'LOCATION',
  'EVENT_BATTLE',
  'DYNASTY_ERA',
  'ORGANIZATION',
  'ARTIFACT',
  'DOCUMENT_CULTURE',
]);

export const AliasTypeEnum = z.enum([
  'ROYAL_TITLE',
  'OFFICIAL_TITLE',
  'PHONETIC_VARIANT',
  'FOLK_BIRTH_NAME',
  'OTHER',
]);

export const StructuredAliasSchema = z.object({
  name: z.string(),
  type: AliasTypeEnum.default('OTHER'),
  confidence: z.number().min(0).max(1).default(1.0),
  notes: z.string().optional(),
});

export const AuditActionTypeEnum = z.enum([
  'MERGE_ENTITY',
  'ALIAS_UPDATE',
  'MODERN_OVERRIDE',
  'CONFLICT_RESOLVE',
]);

export const EntityAuditLogSchema = z.object({
  logId: z.number().int().optional(),
  entityId: z.string(),
  actionType: AuditActionTypeEnum,
  modifiedBy: z.string().default('SYSTEM'),
  timestamp: z.string().optional(),
  previousState: z.record(z.string(), z.unknown()).default({}),
  newState: z.record(z.string(), z.unknown()).default({}),
  rationale: z.string().optional(),
});

export function getCanonicalEntityIdPrefix(entityType: z.infer<typeof EntityTypeEnum> | string): string {
  switch (entityType) {
    case 'HISTORICAL_PERSON': return 'person_';
    case 'LOCATION': return 'loc_';
    case 'EVENT_BATTLE': return 'event_';
    case 'DYNASTY_ERA': return 'dynasty_';
    case 'ORGANIZATION': return 'org_';
    case 'ARTIFACT': return 'artifact_';
    case 'DOCUMENT_CULTURE': return 'doc_';
    default: return 'entity_';
  }
}

export const TranslationVariantSchema = z.object({
  translator: z.string(),
  text: z.string(),
  notes: z.string().optional(),
});

export const ChunkMetadataSchema = z.object({
  chunk_id: z.string(),
  parent_chunk_id: z.string().optional(),
  title: z.string().optional(),
  dynasty: z.string().optional(),
  epoch_ids: z.array(z.union([HistoricalEpochEnum, z.string()])).optional(),
  time_start: z.number().int().optional(),
  time_end: z.number().int().optional(),
  key_figures: z.array(z.string()).default([]),
  location: z.string().optional(),
  source_name: z.string().optional(),
  source_reliability: SourceReliabilityEnum.optional(),
  license_status: z.enum(['PUBLIC_DOMAIN', 'CREATIVE_COMMONS', 'FAIR_USE_SUMMARY', 'UNKNOWN']).optional(),
  page_number: z.number().int().optional(),
  translation_variants: z.array(TranslationVariantSchema).optional(),
  original_text: z.string().optional(),
  original_language: z.string().optional(),
  translated_text: z.string().optional(),
  perspective_tag: z.string().optional(),
  has_modern_scholarly_override: z.boolean().optional(),
});

export const ExtractedEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.union([EntityTypeEnum, z.string()]),
  aliases: z.array(z.string()).default([]),
  structuredAliases: z.array(StructuredAliasSchema).optional(),
});

export const ExtractedRelationshipSchema = z.object({
  source: z.string(),
  target: z.string(),
  relation_type: z.string(),
  confidence: z.number().min(0).max(1).default(1.0),
  source_name: z.string().optional(),
});

export const TripleExtractionSchema = z.object({
  entities: z.array(ExtractedEntitySchema),
  relationships: z.array(ExtractedRelationshipSchema),
});

export const HistoricalRelationTypeEnum = z.enum([
  'LED_BY',
  'PART_OF',
  'HAPPENED_IN',
  'HAPPENED_AT',
  'SAME_AS_LOCATION',
  'ALIAS_OF',
  'ROYAL_LINEAGE',
  'MENTIONED_IN',
]);

export const CandidateEntitySpanSchema = z.object({
  text: z.string(),
  type: z.union([EntityTypeEnum, z.string()]),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1).default(1.0),
  sourceLayer: z.enum(['GAZETTEER', 'RULE_PREFIX', 'PROPER_NOUN_REGEX', 'HYBRID']).default('GAZETTEER'),
  suggestedCanonicalId: z.string().optional(),
});

export const GoldenBenchmarkEntitySchema = z.object({
  id: z.string(),
  canonicalId: z.string().optional(),
  name: z.string(),
  type: z.union([EntityTypeEnum, z.string()]),
  aliases: z.array(z.string()).default([]),
  startOffset: z.number().int().nonnegative().optional(),
  endOffset: z.number().int().nonnegative().optional(),
});

export const GoldenBenchmarkTripleSchema = z.object({
  sourceEntityId: z.string(),
  relationType: z.union([HistoricalRelationTypeEnum, z.string()]),
  targetEntityId: z.string(),
  isDirectional: z.boolean().default(true),
  confidence: z.number().min(0).max(1).default(1.0),
});

export const GoldenTripleBenchmarkItemSchema = z.object({
  id: z.string(),
  epochId: z.union([HistoricalEpochEnum, z.string()]),
  epochIds: z.array(z.union([HistoricalEpochEnum, z.string()])).optional(),
  sourceText: z.string().min(1),
  groundTruthEntities: z.array(GoldenBenchmarkEntitySchema),
  groundTruthTriples: z.array(GoldenBenchmarkTripleSchema),
  groundTruthEpochs: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const GoldenTripleBenchmarkSchema = z.array(GoldenTripleBenchmarkItemSchema);

export const AssetLicenseRegistrySchema = z.object({
  assetId: z.string(),
  filePath: z.string(),
  license: LicenseTypeSchema,
  author: z.string().optional(),
  sourceUrl: z.string().optional(),
  checksum: z.string().optional(),
  verifiedAt: z.string(),
});

// ============================================================================
// 10. CHRONOEVAL v2.0 COMPONENT BENCHMARK SCHEMAS
// ============================================================================

export const GoldReasoningTripleSchema = z.object({
  subject: z.string(),
  relation: z.string(),
  object: z.string(),
  confidence: z.number().optional().default(1.0),
});

export const GroundTruthChunkSchema = z.object({
  chunk_id: z.string(),
  relevance_grade: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  source_reliability: SourceReliabilityEnum.optional().default('LEVEL_1'),
  key_evidence_claims: z.array(z.string()).optional().default([]),
  title: z.string().optional(),
  text_content: z.string().optional(),
});

export const ChronoevalDatasetItemSchema = z.object({
  query_id: z.string(),
  query: z.string(),
  epoch: z.string().optional(),
  domain: z.string().optional().default('GENERAL_HISTORY'),
  intent: z.string().optional().default('FACT_RETRIEVAL'),
  requires_multihop: z.boolean().default(false),
  temporal_bounds: z
    .object({
      time_start: z.number().optional(),
      time_end: z.number().optional(),
      dynasty: z.string().optional(),
    })
    .optional(),
  gold_reasoning_paths: z.array(z.array(GoldReasoningTripleSchema)).optional().default([]),
  ground_truth_chunks: z.array(GroundTruthChunkSchema).default([]),
  unanswerable_or_false_premise: z.boolean().default(false),
  expected_aliases: z.array(z.string()).optional().default([]),
  canonical_entity_id: z.string().optional(),
  adversarial_trap_type: z.string().optional(),
  parent_query_id: z.string().optional(),
});

export const ClaimVerificationSchema = z.object({
  claim_id: z.string(),
  claim_text: z.string(),
  supporting_chunk_ids: z.array(z.string()).default([]),
  entailment_status: z.enum(['ENTAILED', 'CONTRADICTED', 'NEUTRAL', 'NOT_SUPPORTED']),
  citation_valid: z.boolean().default(false),
  confidence_score: z.number().min(0).max(1).default(1.0),
});

export const AblationConfigSchema = z.object({
  config_id: z.enum(['CONFIG_A', 'CONFIG_B', 'CONFIG_C', 'CONFIG_D', 'CONFIG_E', 'CONFIG_F']),
  name: z.string(),
  dense_enabled: z.boolean(),
  lexical_enabled: z.boolean(),
  graph_enabled: z.boolean(),
  reranker_enabled: z.boolean(),
  context_assembly_enabled: z.boolean(),
});

export const ComponentBenchmarkReportSchema = z.object({
  benchmark_id: z.string(),
  name: z.string(),
  timestamp: z.string(),
  total_evaluated: z.number().int().min(0),
  metrics: z.record(z.string(), z.union([z.number(), z.boolean(), z.string()])),
  kpis_passed: z.boolean(),
  latency_summary: z
    .object({
      p50_ms: z.number(),
      p90_ms: z.number(),
      p95_ms: z.number(),
      p99_ms: z.number(),
      avg_ms: z.number(),
    })
    .optional(),
  details: z.array(z.any()).default([]),
});

export const RegressionQualityGateSchema = z.object({
  gate_id: z.string(),
  metric_name: z.string(),
  baseline_value: z.number(),
  current_value: z.number(),
  delta: z.number(),
  threshold: z.number(),
  passed: z.boolean(),
  is_blocking: z.boolean().default(true),
  message: z.string(),
});

export type SourceReliability = z.infer<typeof SourceReliabilityEnum>;
export type HistoricalEpoch = z.infer<typeof HistoricalEpochEnum>;
export type EntityType = z.infer<typeof EntityTypeEnum>;
export type AliasType = z.infer<typeof AliasTypeEnum>;
export type StructuredAlias = z.infer<typeof StructuredAliasSchema>;
export type AuditActionType = z.infer<typeof AuditActionTypeEnum>;
export type EntityAuditLog = z.infer<typeof EntityAuditLogSchema>;
export type ChunkMetadata = z.infer<typeof ChunkMetadataSchema>;
export type ExtractedEntity = z.infer<typeof ExtractedEntitySchema>;
export type ExtractedRelationship = z.infer<typeof ExtractedRelationshipSchema>;
export type TripleExtraction = z.infer<typeof TripleExtractionSchema>;
export type HistoricalRelationType = z.infer<typeof HistoricalRelationTypeEnum>;
export type CandidateEntitySpan = z.infer<typeof CandidateEntitySpanSchema>;
export type GoldenBenchmarkEntity = z.infer<typeof GoldenBenchmarkEntitySchema>;
export type GoldenBenchmarkTriple = z.infer<typeof GoldenBenchmarkTripleSchema>;
export type GoldenTripleBenchmarkItem = z.infer<typeof GoldenTripleBenchmarkItemSchema>;
export type GoldenTripleBenchmark = z.infer<typeof GoldenTripleBenchmarkSchema>;
export type AssetLicenseRegistry = z.infer<typeof AssetLicenseRegistrySchema>;
export type MediaAssetRegistryEntry = AssetLicenseRegistry;

export type GoldReasoningTriple = z.infer<typeof GoldReasoningTripleSchema>;
export type GroundTruthChunk = z.infer<typeof GroundTruthChunkSchema>;
export type ChronoevalDatasetItem = z.infer<typeof ChronoevalDatasetItemSchema>;
export type ClaimVerification = z.infer<typeof ClaimVerificationSchema>;
export type AblationConfig = z.infer<typeof AblationConfigSchema>;
export type ComponentBenchmarkReport = z.infer<typeof ComponentBenchmarkReportSchema>;
export type RegressionQualityGate = z.infer<typeof RegressionQualityGateSchema>;

// ============================================================================
// 11. WORKSPACE, CHAPTERING & MULTI-AGENT ORCHESTRATION SCHEMAS
// ============================================================================

export const ProjectWorkspaceConfigSchema = z.object({
  projectId: z.string().min(1),
  baseDir: z.string().default('/media/projects'),
  assetsDir: z.string().optional(),
  audioDir: z.string().optional(),
  captionsDir: z.string().optional(),
  tempDir: z.string().optional(),
  outputDir: z.string().optional(),
  cleanupOnComplete: z.boolean().default(true),
  maxDiskUsageMb: z.number().positive().default(2048),
});

export const ChapterPlanSchema = z.object({
  chapterIndex: z.number().int().min(0),
  title: z.string().min(1),
  summary: z.string(),
  targetDurationSeconds: z.number().positive(),
  keyEvents: z.array(z.string()).default([]),
  introducedEntities: z.array(z.string()).default([]),
  transitionHook: z.string().optional(),
  establishedTone: z.string().optional(),
});

export const VisualCandidateSchema = z.object({
  candidateId: z.string(),
  imageUrl: z.string().min(1),
  sourceUrl: z.string().optional(),
  title: z.string().optional(),
  author: z.string().optional(),
  license: LicenseTypeSchema,
  localPath: z.string().optional(),
  sha256: z.string().optional(),
  pHash: z.string().optional(),
  focalPoint: z.tuple([z.number(), z.number()]).optional(),
  score: z
    .object({
      historicalContextScore: z.number().min(0).max(100),
      visualNoiseScore: z.number().min(0).max(100),
      artisticFitScore: z.number().min(0).max(100),
      overallScore: z.number().min(0).max(100),
    })
    .optional(),
  verdict: z.enum(['PASS', 'REJECT']).optional(),
  candidateBatch: z.union([z.literal(1), z.literal(2)]).default(1),
});

export const SceneGenerationSchema = z.object({
  sceneId: z.string(),
  sceneIndex: z.number().int().min(0),
  voiceoverText: z.string().min(1),
  layoutMode: LayoutModeSchema,
  contentType: z.enum(['IMAGE', 'PURE_CODE']).default('IMAGE'),
  targetDurationSeconds: z.number().positive(),
  searchKeywords: z.array(z.string()).default([]),
  searchParams: z.object({
    sceneId: z.string().optional(),
    primaryQuery: z.string().min(1),
    englishQuery: z.string().optional(),
    frenchQuery: z.string().optional(),
    negativeQuery: z.string().optional(),
    facetQueries: z.object({
      portrait: z.string().optional(),
      artifact: z.string().optional(),
      map: z.string().optional(),
      battleOrArt: z.string().optional(),
    }).optional(),
    visualType: z.string().optional(),
    historicalPeriod: z.string().optional(),
    limit: z.number().optional(),
  }).optional(),
  candidates: z.array(VisualCandidateSchema).default([]),
  selectedAsset: VisualCandidateSchema.optional(),
  audioPath: z.string().optional(),
  audioDurationSeconds: z.number().optional(),
  wordTimestamps: z.array(WordTimestampSchema).optional(),
  usePureCodeFallback: z.boolean().default(false),
});

export const MediaAssetRegistrySchema = z.object({
  projectId: z.string(),
  assets: z.array(AssetLicenseRegistrySchema).default([]),
  totalAssets: z.number().int().min(0).default(0),
  allWhitelisted: z.boolean().default(true),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});

export const OrchestratorStatusSchema = z.enum([
  'INIT',
  'RAG_RETRIEVED',
  'OUTLINE_CHAPTERED',
  'CHAPTER_SCRIPT_GENERATED',
  'CHAPTER_FACT_CHECKED',
  'SCENES_SEGMENTED',
  'RESEARCH_COMPLETED',
  'TTS_SYNTHESIZED',
  'DURATION_RECONCILED',
  'KEYWORDS_EXTRACTED',
  'ASSETS_AUDITED',
  'PACKAGED',
  'RENDERING',
  'COMPLETED',
  'NEEDS_HUMAN_REVIEW',
  'FAILED',
  'ABORTED',
]);

export type ProjectWorkspaceConfig = z.infer<typeof ProjectWorkspaceConfigSchema>;
export type ChapterPlan = z.infer<typeof ChapterPlanSchema>;
export type VisualCandidate = z.infer<typeof VisualCandidateSchema>;
export type SceneGeneration = z.infer<typeof SceneGenerationSchema>;
export type MediaAssetRegistry = z.infer<typeof MediaAssetRegistrySchema>;
export type OrchestratorStatus = z.infer<typeof OrchestratorStatusSchema>;








