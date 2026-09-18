/**
 * Video Generation, Remotion Styling, Storyboard & Agent Orchestrator Schemas
 */
import { z } from 'zod';
import { sanitizeSentenceBoundaries } from '../text-utils.js';
import { IsoDateStringSchema, HistoricalContextEntitySchema, HistoricalCitationItemSchema } from './chat.js';

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
export const VideoTypeSchema = VideoDomainSchema;
export type VideoType = z.infer<typeof VideoTypeSchema>;

/**
 * Robust, generic historical domain classifier that inspects user prompt keywords
 * to dynamically infer video intent (BATTLE, BIOGRAPHY, DYNASTY, ARTIFACT, MYSTERY).
 */
export function classifyVideoDomain(topic: string, explicitDomain?: string): VideoDomain {
  if (explicitDomain && VideoDomainSchema.safeParse(explicitDomain).success) {
    return explicitDomain as VideoDomain;
  }
  if (!topic || typeof topic !== 'string') return 'BATTLE';

  const lower = topic.toLowerCase();

  // 1. Combat, Battle, Campaign, Resistance, War keywords
  if (
    /hành quân|thần tốc|đại phá|chiến dịch|trận đánh|trận|quyết chiến|khởi nghĩa|đánh tan|công phá|phòng tuyến|phản công|tiến công|thủy chiến|kháng chiến|chiến tranh|chiến đấu|đánh giặc|giải phóng|tiêu thổ|vệ quốc|bạch đằng|ngọc hồi|đống đa|chi lăng|điện biên phủ|rạch gầm|xoài mút|như nguyệt|xuân 1789|kỷ dậu 1789|mãn thanh|quân thanh|quân giặc|quân xâm lược|xâm lược|vạn quân|chống pháp|chống mỹ|chống tống|chống nguyên|chống minh|chống thanh|chống giặc|cách mạng|tổng tiến công|độc lập dân tộc|bảo vệ biên giới/i.test(
      lower
    )
  ) {
    return 'BATTLE';
  }

  // 2. Artifact, Relic, Cultural Heritage keywords
  if (
    /trống đồng|cổ vật|bảo vật|di vật|hiện vật|di chỉ|thạp đồng|kiếm báu|bia đá|chuông đồng|trống ngọc lũ|hoàng thành|di tích|thành cổ|thành nhà hồ/i.test(
      lower
    )
  ) {
    return 'ARTIFACT';
  }

  // 3. Mystery, Unsolved historical crime/mystery keywords
  if (
    /bí ẩn|vụ án|kỳ án|uẩn khúc|nghi án|lệ chi viên|cái chết của|mất tích|bí mật|truyền thuyết bí ẩn/i.test(
      lower
    )
  ) {
    return 'MYSTERY';
  }

  // 4. Dynasty, Era, Transfer of capital keywords
  if (
    /triều đại|nhà lý|nhà trần|nhà lê|nhà nguyễn|nhà hồ|nhà đinh|nhà tiền lê|thời kỳ|định đô|chiếu dời đô|hưng thịnh|suy vong|chuyển giao quyền lực/i.test(
      lower
    )
  ) {
    return 'DYNASTY';
  }

  // 5. Figure / Person biography keywords
  if (
    /tiểu sử|cuộc đời|thân thế|sự nghiệp|danh nhân|vị vua|danh tướng|bà chúa|lãnh tụ|chủ tịch|đại tướng|tướng quân|thái sư|trạng nguyên|anh hùng|nữ tướng|chân dung/i.test(
      lower
    )
  ) {
    return 'BIOGRAPHY';
  }

  // 6. Fallback: If mentions historical epoch, era or year, default to DYNASTY, otherwise general action documentary BATTLE
  if (/(?:thời|thế kỷ|niên hiệu|thập niên|năm\s+\d{3,4})/i.test(lower)) {
    return 'DYNASTY';
  }

  return 'BATTLE';
}

export const classifyVideoType = classifyVideoDomain;


export const TemplateIdSchema = z.enum([
  'HISTORICAL_DOCUMENTARY',
  'QUICK_SHORTS',
  'MODERN_NEWS',
]);

export const TEMPLATE_TARGET_WPM: Record<TemplateId, number> = {
  QUICK_SHORTS: 215,
  MODERN_NEWS: 210,
  HISTORICAL_DOCUMENTARY: 205,
};

export function getTargetWpm(templateId?: string): number {
  if (templateId === 'QUICK_SHORTS') return TEMPLATE_TARGET_WPM.QUICK_SHORTS;
  if (templateId === 'MODERN_NEWS') return TEMPLATE_TARGET_WPM.MODERN_NEWS;
  return TEMPLATE_TARGET_WPM.HISTORICAL_DOCUMENTARY;
}

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

export const isPureCodeLayout = (layoutMode?: LayoutMode | string): boolean => {
  if (!layoutMode) return false;
  return !PURE_IMAGE_LAYOUTS.has(layoutMode);
};

export const DOMAIN_LAYOUT_WHITELIST: Record<VideoDomain, LayoutMode[]> = {
  BIOGRAPHY: [
    'HISTORICAL_FRAME',
    'FULL_COVER',
    'CENTER_SCALE',
    'QUOTE_SLIDE',
    'TIMELINE_CHRONO',
    'ARTICLE_UI',
    'CHARACTER_PROFILE',
    'STAT_CARD',
  ],
  BATTLE: [
    'HISTORICAL_FRAME',
    'FULL_COVER',
    'VERSUS_CARD',
    'ARMY_STRENGTH',
    'MAP_TACTICAL',
    'STAT_CARD',
    'TIMELINE_CHRONO',
  ],
  ARTIFACT: [
    'HISTORICAL_FRAME',
    'FULL_COVER',
    'ARTIFACT_INSPECT',
    'MUSEUM_TAG',
    'STAT_CARD',
    'CENTER_SCALE',
  ],
  DYNASTY: [
    'HISTORICAL_FRAME',
    'FULL_COVER',
    'ROYAL_DECREE',
    'TIMELINE_CHRONO',
    'STAT_CARD',
    'DOCUMENTARY_GRID',
  ],
  MYSTERY: [
    'HISTORICAL_FRAME',
    'FULL_COVER',
    'SPLIT_THEORY',
    'ARTICLE_UI',
    'QUOTE_SLIDE',
  ],
};

/**
 * Sanitizes and guards text boundaries against truncated or hanging sentence fragments.
 * - Trims hanging trailing clauses that lack a valid sentence-closing punctuation (.!?).
 * - Strips dangling prepositions and conjunctions (e.g., 'vào năm', 'tại', 'khi') before sentence ends.
 * - Removes isolated single-letter trailing initials from truncated strings.
 * - Ensures any valid retained text ends with proper closing punctuation.
 */

export { sanitizeSentenceBoundaries } from '../text-utils.js';

export function splitSentences(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const trimmed = text.trim();
  if (!trimmed) return [];

  // 1. Prevent splitting on newlines after colons, semicolons, dashes, or dangling lists
  let normalized = trimmed
    .replace(/:\s*\n+/g, ': ')
    .replace(/;\s*\n+/g, '; ')
    .replace(/,\s*\n+/g, ', ')
    .replace(/\n+\s*([a-zà-ỹ])/g, ' $1');

  // 2. Protect numbers with decimals and thousands separators
  normalized = normalized.replace(/(\d+)\.\s*(\d+)/g, '$1__NUMDOT__$2');

  // 3. Context-Aware Abbreviation Masking
  normalized = normalized.replace(/\b(GS|PGS|TS|ThS|TP|TX|TT|BS|Q|H|sđd|tr)\.\s+(?=[A-ZÀ-Ỹ0-9])/g, '$1__DOT__ ');
  normalized = normalized.replace(/\b(v\.v)\.(?=\s*[,a-zà-ỹ])/gi, '$1__VVDOT__');

  // 4. Split strictly on terminal punctuation (.!?) followed by whitespace or string end
  const rawParts = normalized
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/__DOT__/g, '.').replace(/__VVDOT__/g, '.').replace(/__NUMDOT__/g, '.').trim())
    .filter((s) => s.length > 0);

  // 5. Clause boundary healing: merge dangling fragments, number remnants, and lowercase continuations
  const healed: string[] = [];
  for (const part of rawParts) {
    if (healed.length > 0) {
      const isFragment =
        /^[a-zà-ỹ]/u.test(part) ||
        /^(?:tiền|hậu|tả|hữu|trung quân|và|hoặc|nhưng|rồi|mà|với|cùng)(?:\s+|$)/iu.test(part) ||
        /^\d{1,4}\s*(?:quân|người|chiến thuyền|khẩu|binh|xe|máy bay|km|dặm)/i.test(part) ||
        part.length < 15;

      const lastIdx = healed.length - 1;
      const prev = healed[lastIdx];
      const prevEndsWithColonOrComma = /[:;,–—]\s*$/.test(prev) || !/[.!?]$/.test(prev);

      if (isFragment || prevEndsWithColonOrComma) {
        healed[lastIdx] = `${prev} ${part}`.replace(/\s+/g, ' ').trim();
        continue;
      }
    }
    healed.push(part);
  }

  return healed.filter((s) => s.length > 5);
}


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

export const MilestoneItemSchema = z.object({
  time: z.string(),
  title: z.string(),
  desc: z.string().optional(),
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
  milestones: z.array(MilestoneItemSchema).optional(),
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
  chapterIndex: z.number().optional(),
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



export const AssetLicenseRegistrySchema = z.object({
  assetId: z.string(),
  filePath: z.string(),
  license: LicenseTypeSchema,
  author: z.string().optional(),
  sourceUrl: z.string().optional(),
  checksum: z.string().optional(),
  verifiedAt: z.string(),
});


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
  entryHook: z.string().optional(),
  exitHook: z.string().optional(),
  climaxFocus: z.string().optional(),
  establishedTone: z.string().optional(),
  timeAnchor: z.union([
    z.string(),
    z.object({
      startYear: z.number().optional(),
      endYear: z.number().optional(),
    }),
  ]).optional(),
  chapterChunks: z.array(HistoricalContextEntitySchema).optional(),
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
      scorerType: z.enum(['LOCAL_VLM', 'OPENAI_VLM', 'GEMINI_CLOUD', 'CLIP_LOCAL_FALLBACK', 'REDIS_CACHE']).optional(),
    })
    .optional(),
  verdict: z.enum(['PASS', 'REJECT']).optional(),
  candidateBatch: z.union([z.literal(1), z.literal(2)]).default(1),
});

export const SceneGenerationSchema = z.object({
  sceneId: z.string(),
  sceneIndex: z.number().int().min(0),
  chapterIndex: z.number().int().min(0).default(0),
  voiceoverText: z.string().min(1),
  normalizedVoiceoverText: z.string().optional(),
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

export const NarrativeLedgerSchema = z.object({
  coveredMilestones: z.array(z.string()).default([]),
  introducedKeyFacts: z.array(z.string()).default([]),
  resolvedAliases: z.array(z.string()).default([]),
  passedTimeAnchor: z.number().optional(),
});


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
export type VideoBrief = z.infer<typeof VideoBriefSchema>;
export type AssetLicenseRegistry = z.infer<typeof AssetLicenseRegistrySchema>;
export type MediaAssetRegistryEntry = AssetLicenseRegistry;
export type ProjectWorkspaceConfig = z.infer<typeof ProjectWorkspaceConfigSchema>;
export type ChapterPlan = z.infer<typeof ChapterPlanSchema>;
export type VisualCandidate = z.infer<typeof VisualCandidateSchema>;
export type SceneGeneration = z.infer<typeof SceneGenerationSchema>;
export type MediaAssetRegistry = z.infer<typeof MediaAssetRegistrySchema>;
export type OrchestratorStatus = z.infer<typeof OrchestratorStatusSchema>;
export type NarrativeLedger = z.infer<typeof NarrativeLedgerSchema>;
