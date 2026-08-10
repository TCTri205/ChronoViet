import React from 'react';
import { ChronoVideoProps, TemplateId } from '../types';
import { getMergedTheme } from '../utils/themeUtils';

export { getMergedTheme };

export interface TemplateDefinition {
  id: TemplateId;
  name: string;
  description: string;
  defaultAspectRatio: '16:9' | '9:16' | '1:1';
}

export const TEMPLATE_REGISTRY: Record<TemplateId, TemplateDefinition> = {
  HISTORICAL_DOCUMENTARY: {
    id: 'HISTORICAL_DOCUMENTARY',
    name: 'Phim Tài Liệu Lịch Sử Trang Trọng',
    description: 'Phong cách trang trọng, tone vàng cổ điển, phù hợp cho bài học/nghiên cứu chuyên sâu.',
    defaultAspectRatio: '16:9',
  },
  QUICK_SHORTS: {
    id: 'QUICK_SHORTS',
    name: 'Video Ngắn TikTok / Shorts (9:16)',
    description: 'Phong cách nhịp độ nhanh, phông chữ lớn nổi bật, tối ưu cho thiết bị di động.',
    defaultAspectRatio: '9:16',
  },
  MODERN_NEWS: {
    id: 'MODERN_NEWS',
    name: 'Tin Tức / Đồ Họa Số Hiện Đại',
    description: 'Phong cách tin tức truyền thông hiện đại, tone xanh neon & viền tech tinh tế.',
    defaultAspectRatio: '16:9',
  },
};

/**
 * Gets template definition by ID with fallback
 */
export function getTemplateDefinition(templateId?: TemplateId): TemplateDefinition {
  if (templateId && TEMPLATE_REGISTRY[templateId]) {
    return TEMPLATE_REGISTRY[templateId];
  }
  return TEMPLATE_REGISTRY.HISTORICAL_DOCUMENTARY;
}
