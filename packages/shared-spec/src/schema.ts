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
  'PURE_IMAGE_FULL',
  'ARTICLE_UI',
  'SPLIT_COMPARE',
  'DOCUMENTARY_GRID',
  'NEWSPAPER_ARCHIVE',
  'GALLERY_3D',
  'HERO_SPOTLIGHT',
  'TIMELINE_CHRONO',
  'STAT_CARD',
  'QUOTE_SLIDE',
  'MAP_TACTICAL',
  'ARMY_STRENGTH',
  'CHARACTER_PROFILE',
  'ROYAL_DECREE',
  'ARTIFACT_INSPECT',
  'POEM_RECITING',
  'TITLE_CARD',
  'BLUR_BG',
]);

export const TransitionTypeSchema = z.enum([
  'FADE',
  'FADE_TO_BLACK',
  'GLITCH',
  'DISSOLVE',
  'SLIDE_LEFT',
  'SLIDE_RIGHT',
  'ZOOM_IN',
  'ZOOM_OUT',
  'WIPE',
  'FILM_BURN',
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
  'NONE',
]);

export const TimelineSceneSchema = z.object({
  id: z.string(),
  durationInFrames: z.number().optional(),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
  type: z.enum(['PURE_CODE', 'PURE_IMAGE']).optional(),
  text: z.string().optional(),
  assetUrl: z.string().optional(),
  secondaryAssetUrl: z.string().optional(),
  sceneAudioUrl: z.string().optional(),
  sfxUrl: z.string().optional(),
  layoutMode: LayoutModeSchema.default('BLUR_BG'),
  transition: TransitionTypeSchema.default('GLITCH'),
  filterStyle: FilterStyleSchema.default('HISTORICAL'),
  effect: KenBurnsEffectSchema.default('KEN_BURNS_ZOOM_IN'),
  overlayType: z.string().optional(),
  overlayData: z.record(z.any()).optional(),
  license: LicenseTypeSchema.optional(),
  attribution: AttributionSchema.optional(),
});

export const ChronoVideoSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  videoType: z.enum(['BIOGRAPHY', 'BATTLE', 'DYNASTY', 'MYSTERY', 'ARTIFACT']).default('BATTLE'),
  templateId: z.enum(['HISTORICAL_DOCUMENTARY', 'QUICK_SHORTS', 'MODERN_NEWS']).default('HISTORICAL_DOCUMENTARY'),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']).default('16:9'),
  theme: ThemeConfigSchema.optional(),
  audioUrl: z.string().optional(),
  bgmUrl: z.string().optional(),
  bgmVolume: z.number().default(0.3),
  fps: z.number().default(30),
  captions: z.array(CaptionWordSchema).default([]),
  timeline: z.array(TimelineSceneSchema),
});

export type ChronoVideoProps = z.infer<typeof ChronoVideoSchema>;
export type TimelineScene = z.infer<typeof TimelineSceneSchema>;
