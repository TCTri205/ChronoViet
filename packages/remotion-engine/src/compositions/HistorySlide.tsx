import React from 'react';
import { AbsoluteFill } from 'remotion';
import { TimelineScene, ThemeConfig } from '../types';
import { SlideImage } from '../components/SlideImage';
import { ChapterTitle } from '../components/ChapterTitle';
import { OutroSlide } from '../components/OutroSlide';
import { StatCard } from '../components/StatCard';
import { VersusCard } from '../components/VersusCard';
import { BulletHighlight } from '../components/BulletHighlight';
import { QuoteSlide } from '../components/QuoteSlide';
import { MuseumTag } from '../components/MuseumTag';
import { SplitTheory } from '../components/SplitTheory';
import { SponsorSlide } from '../components/SponsorSlide';
import { ChronoIntro } from '../components/ChronoIntro';
import { DocumentarySubtitle } from '../components/DocumentarySubtitle';
import { DocumentaryHeader } from '../components/DocumentaryHeader';

interface HistorySlideProps {
  scene: TimelineScene;
  durationInFrames: number;
  index?: number;
  theme?: ThemeConfig;
}

/**
 * Layer 1 Component — Render Background Image with Ken Burns motion
 */
export const HistoryBackground: React.FC<HistorySlideProps> = ({
  scene,
  durationInFrames,
  theme,
}) => {
  const isPureCode = scene.type === 'PURE_CODE' || (!scene.assetUrl && !scene.secondaryAssetUrl);
  const bgColor = theme?.backgroundColor || '#090d14';
  const glowColor = theme?.accentGlow || 'rgba(212, 175, 55, 0.2)';

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: 'hidden' }}>
      {!isPureCode && (scene.assetUrl || scene.secondaryAssetUrl) ? (
        <SlideImage
          src={scene.assetUrl || ''}
          secondaryAssetUrl={scene.secondaryAssetUrl}
          layoutMode={scene.layoutMode}
          durationInFrames={durationInFrames}
          zoomType={scene.effect || 'KEN_BURNS_ZOOM_IN'}
          customKenBurns={scene.customKenBurns}
          filterStyle={scene.filterStyle || 'HISTORICAL'}
          rotateDeg={scene.rotateDeg}
        />
      ) : (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at 50% 50%, ${glowColor} 0%, ${bgColor} 80%)`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

/**
 * Layer 2 Component — Render Specific Foreground UI Cards (StatCard, QuoteSlide, ChapterTitle, etc.)
 */
export const HistoryForeground: React.FC<HistorySlideProps> = ({
  scene,
  durationInFrames,
  index = 0,
  theme,
}) => {
  const layoutMode = scene.layoutMode || 'BLUR_BG';
  const od = scene.overlayData;

  const isQuoteScene =
    layoutMode === 'QUOTE_CANVAS' ||
    scene.overlayType === 'QUOTE' ||
    (Boolean(od?.quoteText) && !od?.statItems && !od?.bulletPoints && !od?.leftSide && !od?.artifactInfo);

  if (isQuoteScene && (od?.quoteText || scene.text)) {
    return (
      <QuoteSlide
        quoteText={od?.quoteText || scene.text || ''}
        author={od?.author}
        subtitle={od?.subtitle}
        bgImageSrc={scene.assetUrl}
        durationInFrames={durationInFrames}
        theme={theme}
      />
    );
  }

  if (layoutMode === 'TITLE_CARD' || layoutMode === 'CHAPTER_CARD') {
    return (
      <ChapterTitle
        chapterNumber={od?.chapterNumber}
        title={od?.title || scene.text || ''}
        subtitle={od?.subtitle}
        durationInFrames={durationInFrames}
        theme={theme}
      />
    );
  }

  if (layoutMode === 'STAT_CARD') {
    return (
      <StatCard
        title={od?.title}
        name={od?.name}
        role={od?.role}
        details={od?.details}
        statItems={od?.statItems}
        position={od?.position}
        index={index}
        durationInFrames={durationInFrames}
        theme={theme}
      />
    );
  }

  if (layoutMode === 'VERSUS_CARD' || (Boolean(od?.leftSide) && Boolean(od?.rightSide))) {
    return (
      <VersusCard
        title={od?.title}
        leftSide={od?.leftSide}
        rightSide={od?.rightSide}
        bgImageSrc={scene.assetUrl}
        durationInFrames={durationInFrames}
        theme={theme}
      />
    );
  }

  if (layoutMode === 'BULLET_HIGHLIGHT') {
    return (
      <BulletHighlight
        title={od?.title}
        bulletPoints={od?.bulletPoints}
        position={od?.position}
        index={index}
        durationInFrames={durationInFrames}
        theme={theme}
      />
    );
  }

  if (layoutMode === 'MUSEUM_TAG') {
    return (
      <MuseumTag
        title={od?.title}
        subtitle={od?.subtitle}
        artifactInfo={od?.artifactInfo}
        position={od?.position}
        index={index}
        durationInFrames={durationInFrames}
        theme={theme}
      />
    );
  }

  if (layoutMode === 'SPLIT_THEORY') {
    return (
      <SplitTheory
        title={od?.title}
        theories={od?.theories}
        durationInFrames={durationInFrames}
        theme={theme}
      />
    );
  }

  if (layoutMode === 'ARTICLE_UI') {
    return (
      <ChronoIntro
        articleTitle={od?.title || scene.text}
        authorName={od?.author}
        durationInFrames={durationInFrames}
        theme={theme}
      />
    );
  }

  if (layoutMode === 'SPONSOR_UI') {
    return (
      <SponsorSlide
        sponsorTitle={od?.sponsorTitle}
        sponsorDesc={od?.sponsorDesc}
        ctaText={od?.ctaText}
        durationInFrames={durationInFrames}
        theme={theme}
      />
    );
  }

  if (layoutMode === 'OUTRO_CARD') {
    return (
      <OutroSlide
        title={od?.title}
        author={od?.author}
        poemQuote={od?.quoteText || scene.text}
        ctaText={od?.ctaText}
        bulletPoints={od?.bulletPoints}
        bgImageSrc={scene.assetUrl}
        durationInFrames={durationInFrames}
        theme={theme}
      />
    );
  }

  return null;
};

/**
 * Universal Scene Router — Combined 3-Layer Slide (for backwards compatibility)
 */
export const HistorySlide: React.FC<HistorySlideProps> = ({
  scene,
  durationInFrames,
  index,
  theme,
}) => {
  const od = scene.overlayData;

  return (
    <AbsoluteFill style={{ backgroundColor: '#090807', overflow: 'hidden' }}>
      <HistoryBackground scene={scene} durationInFrames={durationInFrames} index={index} theme={theme} />
      <HistoryForeground scene={scene} durationInFrames={durationInFrames} index={index} theme={theme} />
      
      {/* Top Header */}
      <DocumentaryHeader
        seriesTitle="CHRONOVIET DOCUMENTARY"
        chapterTitle={od?.title}
        theme={theme}
      />

      {/* Bottom Subtitle */}
      <DocumentarySubtitle
        text={scene.text || ''}
        durationInFrames={durationInFrames}
        theme={theme}
      />
    </AbsoluteFill>
  );
};

