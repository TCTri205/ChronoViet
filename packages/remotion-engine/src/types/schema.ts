import { z } from 'zod';

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

export const ThemeConfigSchema = z.object({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  fontFamily: z.string().optional(),
  accentGlow: z.string().optional(),
});

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

export const KenBurnsEffectSchema = z.enum([
  'KEN_BURNS_ZOOM_IN',
  'KEN_BURNS_ZOOM_OUT',
  'KEN_BURNS_PAN_LEFT',
  'KEN_BURNS_PAN_RIGHT',
  'KEN_BURNS_PAN_UP',
  'KEN_BURNS_PAN_DOWN',
]);

export const LayoutModeSchema = z.enum([
  'BLUR_BG',
  'HISTORICAL_FRAME',
  'QUOTE_CANVAS',
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
]);

export const FilterStyleSchema = z.enum(['HISTORICAL', 'SEPIA', 'VINTAGE', 'NONE']);

export const TransitionTypeSchema = z.enum([
  'DISSOLVE',
  'FADE_TO_BLACK',
  'LIGHT_LEAK',
  'GLITCH',
  'SLIDE_LEFT',
  'SLIDE_RIGHT',
  'SLIDE_UP',
  'SLIDE_DOWN',
  'WIPE',
  'FLIP',
  'CLOCK_WIPE',
  'ZOOM_DREAMY',
  'CROSS_ZOOM',
  'LINEAR_BLUR',
  'NONE',
]);

export const CaptionWordSchema = z.object({
  word: z.string(),
  startFrame: z.number(),
  endFrame: z.number(),
});

export const CustomKenBurnsSchema = z.object({
  scaleFrom: z.number().optional(),
  scaleTo: z.number().optional(),
  originX: z.number().optional(), // 0 to 1
  originY: z.number().optional(), // 0 to 1
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
