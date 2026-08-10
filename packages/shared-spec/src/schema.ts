import { z } from 'zod';

export const ThemeConfigSchema = z.object({
  primaryColor: z.string().default('#DC2626'),
  secondaryColor: z.string().default('#F59E0B'),
  backgroundColor: z.string().default('#090D14'),
  fontFamily: z.string().default('Merriweather, serif'),
  accentGlow: z.string().default('rgba(220, 38, 38, 0.4)'),
});

export const CaptionWordSchema = z.object({
  word: z.string(),
  startFrame: z.number(),
  endFrame: z.number(),
});

export const LicenseTypeSchema = z.enum([
  'PUBLIC_DOMAIN',
  'CC0',
  'CC_BY_4_0',
  'CC_BY_SA_4_0',
]);

export const AttributionSchema = z.object({
  author: z.string(),
  sourceUrl: z.string(),
  license: LicenseTypeSchema,
});

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

export const StatItemSchema = z.object({
  label: z.string(),
  value: z.string(),
  color: z.string().optional(),
});

export const VersusSideSchema = z.object({
  name: z.string(),
  stat: z.string(),
  color: z.string().optional(),
  badge: z.string().optional(),
});

export const ArtifactInfoSchema = z.object({
  origin: z.string().optional(),
  material: z.string().optional(),
  period: z.string().optional(),
  location: z.string().optional(),
  dimensions: z.string().optional(),
});

export const HistoricalTheorySchema = z.object({
  title: z.string(),
  desc: z.string(),
  probability: z.string().optional(),
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

export const OverlayDataSchema = z.object({
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

export const CustomKenBurnsSchema = z.object({
  scaleFrom: z.number().optional(),
  scaleTo: z.number().optional(),
  originX: z.number().optional(),
  originY: z.number().optional(),
});

export const TimelineSceneSchema = z.object({
  id: z.string(),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
  durationInFrames: z.number().optional(),
  type: z.enum(['PURE_CODE', 'PURE_IMAGE']).optional(),
  component: z.string().optional(),
  text: z.string().optional(),
  assetUrl: z.string().optional(),
  secondaryAssetUrl: z.string().optional(),
  sceneAudioUrl: z.string().optional(),
  sfxUrl: z.string().optional(),
  effect: KenBurnsEffectSchema.optional(),
  customKenBurns: CustomKenBurnsSchema.optional(),
  layoutMode: LayoutModeSchema.optional(),
  overlayType: z.string().optional(),
  filterStyle: FilterStyleSchema.optional(),
  rotateDeg: z.number().optional(),
  transition: TransitionTypeSchema.optional(),
  transitionDurationFrames: z.number().optional(),
  hideSubtitle: z.boolean().optional(),
  hideHeader: z.boolean().optional(),
  overlayData: OverlayDataSchema.optional(),
  license: LicenseTypeSchema.optional(),
  attribution: AttributionSchema.optional(),
});

export const TemplateIdSchema = z.enum([
  'HISTORICAL_DOCUMENTARY',
  'QUICK_SHORTS',
  'MODERN_NEWS',
]);

export const VideoDomainSchema = z.enum([
  'BIOGRAPHY',
  'BATTLE',
  'DYNASTY',
  'MYSTERY',
  'ARTIFACT',
]);

export const AspectRatioSchema = z.enum(['16:9', '9:16', '1:1']);

export const AudioConfigSchema = z.object({
  voiceoverUrl: z.string().optional(),
  bgmUrl: z.string().optional(),
  bgmVolume: z.number().optional(),
  bgmDuckingLevel: z.number().optional(),
});

export const ChronoVideoSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  videoType: VideoDomainSchema.optional(),
  templateId: TemplateIdSchema.optional(),
  theme: ThemeConfigSchema.optional(),
  aspectRatio: AspectRatioSchema.default('16:9'),
  audioUrl: z.string().optional(),
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

export type StatItem = z.infer<typeof StatItemSchema>;
export type VersusSide = z.infer<typeof VersusSideSchema>;
export type ArtifactInfo = z.infer<typeof ArtifactInfoSchema>;
export type HistoricalTheory = z.infer<typeof HistoricalTheorySchema>;
export type OverlayPosition = z.infer<typeof OverlayPositionSchema>;
export type OverlayData = z.infer<typeof OverlayDataSchema>;
export type CustomKenBurns = z.infer<typeof CustomKenBurnsSchema>;
export type LayoutMode = z.infer<typeof LayoutModeSchema>;
export type TransitionType = z.infer<typeof TransitionTypeSchema>;
export type FilterStyle = z.infer<typeof FilterStyleSchema>;
export type KenBurnsEffect = z.infer<typeof KenBurnsEffectSchema>;
export type TemplateId = z.infer<typeof TemplateIdSchema>;
export type VideoDomain = z.infer<typeof VideoDomainSchema>;
export type AspectRatio = z.infer<typeof AspectRatioSchema>;
export type AudioConfig = z.infer<typeof AudioConfigSchema>;
export type CaptionWord = z.infer<typeof CaptionWordSchema>;
export type LicenseType = z.infer<typeof LicenseTypeSchema>;
export type Attribution = z.infer<typeof AttributionSchema>;
export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;
export type TimelineScene = z.infer<typeof TimelineSceneSchema>;
export type ChronoVideoProps = z.infer<typeof ChronoVideoSchema>;
