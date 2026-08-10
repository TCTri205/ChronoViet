import React from 'react';
import { ChronoVideo } from '../ChronoVideo';
import { ChronoVideoProps } from '../../types';
import quangTrungData from '../../data/quang-trung/quangTrungTimeline.json';

export const QuangTrungComposition: React.FC<Partial<ChronoVideoProps>> = (overrideProps) => {
  const defaultData = quangTrungData as unknown as ChronoVideoProps;
  const mergedProps: ChronoVideoProps = {
    ...defaultData,
    ...overrideProps,
    theme: {
      primaryColor: '#DC2626',   // Đỏ Tây Sơn
      secondaryColor: '#F59E0B', // Vàng Đế Vương
      backgroundColor: '#0F172A',
      accentGlow: 'rgba(220, 38, 38, 0.4)',
      ...overrideProps.theme,
    },
  };

  return <ChronoVideo {...mergedProps} />;
};
