import React from 'react';
import { AbsoluteFill } from 'remotion';
import { COLOR_PALETTE } from '../constants/config';
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
import { TimelineChrono } from '../components/TimelineChrono';
import { RoyalDecree } from '../components/RoyalDecree';
import { MapTactical } from '../components/MapTactical';
import { CharacterProfile } from '../components/CharacterProfile';
import { ArtifactInspect } from '../components/ArtifactInspect';
import { PoemReciting } from '../components/PoemReciting';

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
  const hasAsset = Boolean(scene.assetUrl || scene.secondaryAssetUrl);
  const bgColor = theme?.backgroundColor || COLOR_PALETTE.lacquerBlack;
  const glowColor = theme?.accentGlow || COLOR_PALETTE.goldGlow;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: 'hidden' }}>
      {hasAsset ? (
        <SlideImage
          src={scene.assetUrl || ''}
          secondaryAssetUrl={scene.secondaryAssetUrl}
          layoutMode={scene.layoutMode}
          durationInFrames={durationInFrames}
          zoomType={scene.effect || 'KEN_BURNS_ZOOM_IN'}
          customKenBurns={scene.customKenBurns}
          filterStyle={scene.filterStyle || 'HISTORICAL'}
          rotateDeg={scene.rotateDeg}
          isPureCodeScene={scene.type === 'PURE_CODE'}
        />
      ) : (
        <AbsoluteFill
          style={{
            background: theme?.gradientBg || `radial-gradient(circle at 50% 50%, ${glowColor} 0%, ${bgColor} 80%)`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

const getForegroundContent = (
  scene: TimelineScene,
  durationInFrames: number,
  index: number,
  theme?: ThemeConfig
) => {
  const layoutMode = scene.layoutMode || 'BLUR_BG';
  const od = scene.overlayData || scene.fallbackOverlayData;

  if (layoutMode === 'TIMELINE_CHRONO') {
    return (
      <TimelineChrono
        title={od?.title || scene.text}
        subtitle={od?.subtitle}
        durationInFrames={durationInFrames}
        theme={theme}
      />
    );
  }

  if (layoutMode === 'ROYAL_DECREE') {
    return (
      <RoyalDecree
        title={od?.title}
        author={od?.author}
        decreeText={od?.quoteText || scene.text}
        durationInFrames={durationInFrames}
        theme={theme}
      />
    );
  }

  if (layoutMode === 'MAP_TACTICAL') {
    return (
      <MapTactical
        title={od?.title}
        subtitle={od?.subtitle}
        details={od?.details || scene.text}
        durationInFrames={durationInFrames}
        theme={theme}
      />
    );
  }

  if (layoutMode === 'CHARACTER_PROFILE') {
    return (
      <CharacterProfile
        name={od?.name || od?.title}
        role={od?.role}
        details={od?.details || scene.text}
        quote={od?.quoteText}
        durationInFrames={durationInFrames}
        theme={theme}
      />
    );
  }

  if (layoutMode === 'ARTIFACT_INSPECT') {
    return (
      <ArtifactInspect
        title={od?.title}
        subtitle={od?.subtitle}
        artifactInfo={od?.artifactInfo}
        durationInFrames={durationInFrames}
        theme={theme}
      />
    );
  }

  if (layoutMode === 'POEM_RECITING') {
    return (
      <PoemReciting
        title={od?.title}
        author={od?.author}
        poemText={od?.quoteText || scene.text || ''}
        durationInFrames={durationInFrames}
        theme={theme}
      />
    );
  }

  const isQuoteScene =
    layoutMode === 'QUOTE_CANVAS' ||
    layoutMode === 'QUOTE_SLIDE' ||
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
 * Layer 2 Component — Render Specific Foreground UI Cards (StatCard, QuoteSlide, ChapterTitle, etc.)
 */
export const HistoryForeground: React.FC<HistorySlideProps> = ({
  scene,
  durationInFrames,
  index = 0,
  theme,
}) => {
  const content = getForegroundContent(scene, durationInFrames, index, theme);

  if (!content) return null;

  return (
    <AbsoluteFill>
      {content}
    </AbsoluteFill>
  );
};


