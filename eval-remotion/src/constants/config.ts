import { AspectRatio } from '../types';

export const DEFAULT_FPS = 30;

export const CANVAS_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
};

export const COLOR_PALETTE = {
  // ChronoViet Primary Palette
  chronoBlue: '#2563eb',
  chronoBlueGlow: 'rgba(37, 99, 235, 0.45)',
  chronoDarkBg: '#090d14',
  chronoPaperBg: '#f6f2eb',
  chronoPaperText: '#1f1e1c',
  
  // Historical Gold & Crimson Accents
  primaryGold: '#D4AF37',
  goldGlow: 'rgba(212, 175, 55, 0.35)',
  crimsonDark: '#8B0000',
  glassDarkBg: 'rgba(11, 15, 20, 0.88)',
  textWhite: '#FFFFFF',
  textSubtle: 'rgba(255, 255, 255, 0.85)',
};

export const TEMPLATE_THEMES = {
  HISTORICAL_DOCUMENTARY: {
    primaryColor: '#D4AF37',
    secondaryColor: '#8B0000',
    backgroundColor: '#090d14',
    fontFamily: '"Merriweather", "Be Vietnam Pro", serif',
    accentGlow: 'rgba(212, 175, 55, 0.35)',
  },
  QUICK_SHORTS: {
    primaryColor: '#FFCC00',
    secondaryColor: '#FF2A5F',
    backgroundColor: '#07050A',
    fontFamily: '"Be Vietnam Pro", sans-serif',
    accentGlow: 'rgba(255, 42, 95, 0.45)',
  },
  MODERN_NEWS: {
    primaryColor: '#00E5FF',
    secondaryColor: '#2563EB',
    backgroundColor: '#0A111E',
    fontFamily: '"Be Vietnam Pro", sans-serif',
    accentGlow: 'rgba(0, 229, 255, 0.4)',
  },
};

