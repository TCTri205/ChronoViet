import React from 'react';
import { ChronoVideo } from '../ChronoVideo';
import { ChronoVideoProps } from '../../types';
import mongolViet2Data from '../../data/mongol-viet-2/mongolViet2Timeline.json';

export const MongolViet2Composition: React.FC<Partial<ChronoVideoProps>> = (overrideProps) => {
  const defaultData = mongolViet2Data as unknown as ChronoVideoProps;
  const mergedProps: ChronoVideoProps = {
    ...defaultData,
    ...overrideProps,
    theme: {
      primaryColor: '#0EA5E9',   // Xanh Dương Sky - Spiderum / ChronoViet Video Essay Format
      secondaryColor: '#F59E0B', // Vàng Hào Hùng
      backgroundColor: '#0F172A',
      accentGlow: 'rgba(14, 165, 233, 0.4)',
      ...overrideProps.theme,
    },
  };

  return <ChronoVideo {...mergedProps} />;
};
