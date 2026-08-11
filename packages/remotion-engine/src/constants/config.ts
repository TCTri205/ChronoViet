import { AspectRatio } from '../types';

export const DEFAULT_FPS = 30;

export const CANVAS_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
};

export const COLOR_PALETTE = {
  // ChronoViet Vietnamese Heritage Primary Palette
  vermilionRed: '#9B1B1B',        // Đỏ Son / Con Dấu Triện / Sắc Phong
  imperialGold: '#C89D35',        // Vàng Hoàng Thành / Hoàng Giáp / Kim Sách
  chuDauCeramic: '#1E3A5F',       // Xanh Gốm Chu Đậu / Chàm Cổ
  ancientWood: '#16120E',         // Nâu Trầm Gỗ Mộc Bản / Nẹp Cổ
  lacquerBlack: '#0E0C0A',        // Đen Sơn Mài trầm uy nghiêm
  docParchment: '#E8DFC5',        // Trắng ngà Giấy Dó / Sắc Phong

  // Legacy mappings for backwards compatibility
  chronoBlue: '#1E3A5F',          // Replaced SaaS Blue with Chu Dau Indigo
  chronoBlueGlow: 'rgba(30, 58, 95, 0.45)',
  chronoDarkBg: '#0E0C0A',        // Lacquer Black
  chronoPaperBg: '#E8DFC5',       // Doc Parchment
  chronoPaperText: '#16120E',     // Ancient Wood Text
  
  // Historical Gold & Crimson Accents
  primaryGold: '#C89D35',
  goldGlow: 'rgba(200, 157, 53, 0.35)',
  crimsonDark: '#9B1B1B',
  glassDarkBg: 'rgba(14, 12, 10, 0.94)',
  textWhite: '#F5F2EB',           // Warm Ivory White instead of harsh #FFF
  textSubtle: 'rgba(245, 242, 235, 0.85)',
};

export const TEMPLATE_THEMES = {
  HISTORICAL_DOCUMENTARY: {
    primaryColor: '#C89D35',
    secondaryColor: '#9B1B1B',
    backgroundColor: '#0E0C0A',
    fontFamily: '"Merriweather", "Be Vietnam Pro", serif',
    accentGlow: 'rgba(200, 157, 53, 0.35)',
  },
  QUICK_SHORTS: {
    primaryColor: '#C89D35',
    secondaryColor: '#9B1B1B',
    backgroundColor: '#16120E',
    fontFamily: '"Be Vietnam Pro", sans-serif',
    accentGlow: 'rgba(155, 27, 27, 0.45)',
  },
  MODERN_NEWS: {
    primaryColor: '#C89D35',
    secondaryColor: '#1E3A5F',
    backgroundColor: '#0E0C0A',
    fontFamily: '"Be Vietnam Pro", sans-serif',
    accentGlow: 'rgba(30, 58, 95, 0.4)',
  },
};

export const DOMAIN_THEMES = {
  BIOGRAPHY: {
    primaryColor: '#C89D35',   // Imperial Gold
    secondaryColor: '#9B1B1B', // Vermilion Red
    backgroundColor: '#0E0C0A',
    fontFamily: '"Merriweather", serif',
    accentGlow: 'rgba(200, 157, 53, 0.4)',
  },
  BATTLE: {
    primaryColor: '#9B1B1B',   // War Vermilion Red
    secondaryColor: '#C89D35', // Imperial Gold
    backgroundColor: '#140D0C',
    fontFamily: '"Merriweather", serif',
    accentGlow: 'rgba(155, 27, 27, 0.45)',
  },
  DYNASTY: {
    primaryColor: '#C89D35',   // Crown Gold
    secondaryColor: '#1E3A5F', // Royal Indigo Chu Dau
    backgroundColor: '#0E0C0A',
    fontFamily: '"Merriweather", serif',
    accentGlow: 'rgba(200, 157, 53, 0.4)',
  },
  MYSTERY: {
    primaryColor: '#4A6B5D',   // Ancient Bronze Patina
    secondaryColor: '#1E3A5F', // Deep Ceramic Indigo
    backgroundColor: '#0A0D0B',
    fontFamily: '"Merriweather", serif',
    accentGlow: 'rgba(74, 107, 93, 0.4)',
  },
  ARTIFACT: {
    primaryColor: '#C89D35',   // Ancient Bronze Gold
    secondaryColor: '#8C5A2B', // Relic Copper
    backgroundColor: '#120F0D',
    fontFamily: '"Merriweather", serif',
    accentGlow: 'rgba(200, 157, 53, 0.4)',
  },
};


