import { z } from 'zod';

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

// Type Exports
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
export type LicenseType = z.infer<typeof LicenseTypeSchema>;
export type Attribution = z.infer<typeof AttributionSchema>;
export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;
export type SoundEffect = z.infer<typeof SoundEffectSchema>;
export type TimelineSceneInput = z.input<typeof TimelineSceneSchema>;
export type TimelineScene = z.output<typeof TimelineSceneSchema>;
export type ChronoVideoScript = z.infer<typeof ChronoVideoScriptSchema>;
export type ChronoVideoProps = ChronoVideoScript;


