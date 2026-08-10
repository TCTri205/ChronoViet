export * from './schema';

export type TemplateId = 'HISTORICAL_DOCUMENTARY' | 'QUICK_SHORTS' | 'MODERN_NEWS';

export type VideoDomain = 'BIOGRAPHY' | 'BATTLE' | 'DYNASTY' | 'MYSTERY' | 'ARTIFACT';

export interface ThemeConfig {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  accentGlow?: string;
}

export interface StatItem {
  label: string;
  value: string;
  color?: string;
}

export interface VersusSide {
  name: string;
  stat: string;
  color?: string;
  badge?: string;
}

export interface ArtifactInfo {
  origin?: string;
  material?: string;
  period?: string;
  location?: string;
  dimensions?: string;
}

export interface HistoricalTheory {
  title: string;
  desc: string;
  probability?: string;
}

export type OverlayPosition = 'LEFT' | 'RIGHT' | 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT' | 'CENTER';

export interface OverlayData {
  name?: string;
  role?: string;
  title?: string;
  subtitle?: string;
  seriesTitle?: string;
  chapterNumber?: string; // e.g. "I", "II", "III"
  author?: string;        // e.g. "Dũng Phan", "Quang Trung - Nguyễn Huệ"
  quoteText?: string;
  sponsorTitle?: string;
  sponsorDesc?: string;
  ctaText?: string;
  details?: string;
  position?: OverlayPosition;
  statItems?: StatItem[];
  leftSide?: VersusSide;
  rightSide?: VersusSide;
  bulletPoints?: string[];
  artifactInfo?: ArtifactInfo;
  theories?: HistoricalTheory[];
}

export type KenBurnsEffect =
  | 'KEN_BURNS_ZOOM_IN'
  | 'KEN_BURNS_ZOOM_OUT'
  | 'KEN_BURNS_PAN_LEFT'
  | 'KEN_BURNS_PAN_RIGHT'
  | 'KEN_BURNS_PAN_UP'
  | 'KEN_BURNS_PAN_DOWN';

export interface CustomKenBurns {
  scaleFrom?: number;
  scaleTo?: number;
  originX?: number; // 0 to 1
  originY?: number; // 0 to 1
}

export type LayoutMode =
  | 'BLUR_BG'
  | 'HISTORICAL_FRAME'
  | 'QUOTE_CANVAS'
  | 'CHAPTER_CARD'
  | 'ARTICLE_UI'
  | 'SPONSOR_UI'
  | 'OUTRO_CARD'
  | 'SPLIT_COMPARE'
  | 'FULL_CONTAIN'
  | 'FULL_COVER'
  | 'TITLE_CARD'
  | 'STAT_CARD'
  | 'VERSUS_CARD'
  | 'BULLET_HIGHLIGHT'
  | 'MUSEUM_TAG'
  | 'SPLIT_THEORY'
  | 'VIGNETTE_DARK'
  | 'CENTER_SCALE';

export type FilterStyle = 'HISTORICAL' | 'SEPIA' | 'VINTAGE' | 'NONE';

export type TransitionType =
  | 'DISSOLVE'
  | 'FADE_TO_BLACK'
  | 'LIGHT_LEAK'
  | 'GLITCH'
  | 'SLIDE_LEFT'
  | 'SLIDE_RIGHT'
  | 'SLIDE_UP'
  | 'SLIDE_DOWN'
  | 'WIPE'
  | 'FLIP'
  | 'CLOCK_WIPE'
  | 'ZOOM_DREAMY'
  | 'CROSS_ZOOM'
  | 'LINEAR_BLUR'
  | 'NONE';

export type AspectRatio = '16:9' | '9:16' | '1:1';

export interface CaptionWord {
  word: string;
  startFrame: number;
  endFrame: number;
}

export interface AudioConfig {
  voiceoverUrl?: string;
  bgmUrl?: string;
  bgmVolume?: number;
  bgmDuckingLevel?: number;
}

export interface TimelineScene {
  id: string;
  startTime?: number;          // in seconds (alternative to durationInFrames)
  endTime?: number;            // in seconds (alternative to durationInFrames)
  durationInFrames?: number;   // preferred: explicit frame count
  type?: 'PURE_CODE' | 'PURE_IMAGE';
  component?: string;          // informational hint for AI Agent
  text?: string;               // voiceover subtitle displayed at bottom bar
  assetUrl?: string;           // main image/video asset URL or public path
  secondaryAssetUrl?: string;  // secondary asset for SPLIT_COMPARE layouts
  sceneAudioUrl?: string;      // per-scene voiceover audio
  sfxUrl?: string;             // per-scene sound effect (drum roll, sword clash, etc.)
  effect?: KenBurnsEffect;     // ken burns motion direction
  customKenBurns?: CustomKenBurns;
  layoutMode?: LayoutMode;     // determines which component renders this scene
  overlayType?: string;        // overlay type indicator (e.g. QUOTE, ARTICLE_INTRO, BIO_CARD)
  filterStyle?: FilterStyle;   // image color grade preset
  rotateDeg?: number;          // optional image rotation in degrees
  transition?: TransitionType; // transition type from this scene to next
  transitionDurationFrames?: number;
  hideSubtitle?: boolean;      // explicitly hide bottom subtitle bar for dedicated UI scenes
  hideHeader?: boolean;        // explicitly hide top brand/chapter header badge
  overlayData?: OverlayData;   // structured data passed to active component
}

export interface ChronoVideoProps {
  title: string;
  subtitle?: string;
  videoType?: VideoDomain;
  templateId?: TemplateId;
  theme?: ThemeConfig;
  aspectRatio: AspectRatio;
  audioUrl?: string;
  bgmUrl?: string;
  bgmVolume?: number;
  defaultLayoutMode?: LayoutMode;
  defaultFilterStyle?: FilterStyle;
  defaultTransition?: TransitionType;
  enableTransitions?: boolean;
  timeline: TimelineScene[];
  captions?: CaptionWord[];
  fps?: number;
}

