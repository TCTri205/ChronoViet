import React from 'react';
import { ChronoVideo } from '../ChronoVideo';
import { ChronoVideoProps } from '../../types';
import haiBaTrungData from '../../data/hai-ba-trung/haiBaTrungTimeline.json';

export const HaiBaTrungComposition: React.FC<Partial<ChronoVideoProps>> = (overrideProps) => {
  const defaultData = haiBaTrungData as unknown as ChronoVideoProps;
  const mergedProps: ChronoVideoProps = {
    ...defaultData,
    ...overrideProps,
    theme: {
      primaryColor: '#F59E0B',   // Vàng Giáp Vương Hai Bà
      secondaryColor: '#DC2626', // Đỏ Cờ Nghĩa
      backgroundColor: '#0F172A',
      accentGlow: 'rgba(245, 158, 11, 0.4)',
      ...overrideProps.theme,
    },
  };

  return <ChronoVideo {...mergedProps} />;
};
