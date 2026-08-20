import { describe, it, expect } from 'vitest';
import { getMergedTheme, resolveTheme } from '../utils/themeUtils';
import { COLOR_PALETTE, TEMPLATE_THEMES, DOMAIN_THEMES } from '../constants/config';

describe('themeUtils', () => {
  describe('resolveTheme', () => {
    it('returns default palette values when input theme is null or undefined', () => {
      const theme = resolveTheme(undefined);
      expect(theme.primaryColor).toBe(COLOR_PALETTE.primaryGold);
      expect(theme.secondaryColor).toBe(COLOR_PALETTE.chronoBlue);
      expect(theme.backgroundColor).toBe(COLOR_PALETTE.chronoDarkBg);
      expect(theme.accentGlow).toBe(COLOR_PALETTE.goldGlow);
      expect(theme.fontFamily).toContain('Be Vietnam Pro');
    });

    it('preserves user custom theme values', () => {
      const theme = resolveTheme({
        primaryColor: '#FFD700',
        backgroundColor: '#000000',
        headerTitle: 'CHRONOVIET HISTORICAL ARCHIVE',
      });
      expect(theme.primaryColor).toBe('#FFD700');
      expect(theme.backgroundColor).toBe('#000000');
      expect(theme.headerTitle).toBe('CHRONOVIET HISTORICAL ARCHIVE');
      expect(theme.secondaryColor).toBe(COLOR_PALETTE.chronoBlue);
    });
  });

  describe('getMergedTheme', () => {
    it('resolves default template theme when no options are provided', () => {
      const theme = getMergedTheme();
      const defaultTemplate = TEMPLATE_THEMES.HISTORICAL_DOCUMENTARY;
      expect(theme.primaryColor).toBe(defaultTemplate.primaryColor);
      expect(theme.backgroundColor).toBe(defaultTemplate.backgroundColor);
    });

    it('merges domain theme overrides over template theme', () => {
      const theme = getMergedTheme('HISTORICAL_DOCUMENTARY', undefined, 'BATTLE');
      const battleTheme = DOMAIN_THEMES.BATTLE;
      expect(theme.primaryColor).toBe(battleTheme.primaryColor);
      expect(theme.secondaryColor).toBe(battleTheme.secondaryColor);
    });

    it('allows user custom theme to take highest precedence', () => {
      const theme = getMergedTheme(
        'HISTORICAL_DOCUMENTARY',
        { primaryColor: '#00FF00', headerTitle: 'Custom Title' },
        'BATTLE'
      );
      expect(theme.primaryColor).toBe('#00FF00');
      expect(theme.headerTitle).toBe('Custom Title');
    });
  });
});
