import { loadFont as loadMerriweather } from '@remotion/google-fonts/Merriweather';
import { loadFont as loadBeVietnamPro } from '@remotion/google-fonts/BeVietnamPro';

// Load Be Vietnam Pro font stack (supports complete Vietnamese diacritics and glyphs)
export const { fontFamily: beVietnamFont } = loadBeVietnamPro();

// Load Merriweather font stack for serif historical quotes
export const { fontFamily: merriweatherFont } = loadMerriweather();

/**
 * Normalizes Vietnamese text strings to Unicode Normalization Form C (NFC).
 * Prevents character decomposition issues (base letter + floating accent mark)
 * when rendered in web browser canvas.
 */
export function normalizeVietnameseText(text?: string | null): string {
  if (!text) return '';
  return String(text).normalize('NFC');
}

/**
 * Safely converts Vietnamese text to Uppercase and normalizes to NFC.
 * Avoids CSS `text-transform: uppercase` bugs in browser engines that separate
 * base characters from diacritics when letter-spacing is applied.
 */
export function toVietnameseUpperCase(text?: string | null): string {
  if (!text) return '';
  return String(text).toUpperCase().normalize('NFC');
}

/**
 * Guarantees a safe font family stack supporting Vietnamese diacritics.
 * If user specifies a font that lacks full Vietnamese glyphs (e.g. Georgia, Impact, system-ui),
 * this inserts Be Vietnam Pro or Merriweather as primary/secondary fallbacks.
 */
export function getSafeFontFamily(customFont?: string, isSerif: boolean = false): string {
  const defaultFont = isSerif
    ? `"${merriweatherFont}", "${beVietnamFont}", serif`
    : `"${beVietnamFont}", "${merriweatherFont}", sans-serif`;

  if (!customFont) {
    return defaultFont;
  }

  // If customFont contains fonts known to lack full Vietnamese diacritics on Windows
  if (
    customFont.includes('Georgia') ||
    customFont.includes('Impact') ||
    customFont.includes('Arial Black') ||
    customFont.includes('system-ui')
  ) {
    return isSerif
      ? `"${merriweatherFont}", "${beVietnamFont}", ${customFont}`
      : `"${beVietnamFont}", "${merriweatherFont}", ${customFont}`;
  }

  return `"${beVietnamFont}", "${merriweatherFont}", ${customFont}`;
}
