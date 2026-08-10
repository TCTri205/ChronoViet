import { ThemeConfig, TemplateId, VideoDomain } from '../types';
import { COLOR_PALETTE, TEMPLATE_THEMES, DOMAIN_THEMES } from '../constants/config';
import { getSafeFontFamily } from './fontUtils';

export interface ResolvedTheme {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  fontFamily: string;
  accentGlow: string;
}

/**
 * Merges template theme defaults, domain theme defaults, and custom user theme config
 */
export function getMergedTheme(templateId?: TemplateId, customTheme?: ThemeConfig, videoType?: VideoDomain): ResolvedTheme {
  const templateTheme = TEMPLATE_THEMES[templateId || 'HISTORICAL_DOCUMENTARY'] || TEMPLATE_THEMES.HISTORICAL_DOCUMENTARY;
  const domainTheme = videoType ? DOMAIN_THEMES[videoType] : undefined;
  const merged = {
    ...templateTheme,
    ...(domainTheme || {}),
    ...(customTheme || {}),
  };
  return resolveTheme(merged);
}

/**
 * Resolves theme configuration with sensible defaults from COLOR_PALETTE.
 * Ensures all UI components gracefully respect user JSON theme inputs.
 */
export function resolveTheme(theme?: ThemeConfig | null): ResolvedTheme {
  return {
    primaryColor: theme?.primaryColor || COLOR_PALETTE.primaryGold,
    secondaryColor: theme?.secondaryColor || COLOR_PALETTE.chronoBlue,
    backgroundColor: theme?.backgroundColor || COLOR_PALETTE.chronoDarkBg,
    fontFamily: getSafeFontFamily(theme?.fontFamily),
    accentGlow: theme?.accentGlow || COLOR_PALETTE.goldGlow,
  };
}
