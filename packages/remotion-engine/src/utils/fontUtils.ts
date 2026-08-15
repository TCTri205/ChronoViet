// Offline-safe Vietnamese font stack definitions
export const beVietnamFont = "'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
export const merriweatherFont = "'Merriweather', 'Times New Roman', Times, Georgia, serif";

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
    ? `${merriweatherFont}, ${beVietnamFont}, serif`
    : `${beVietnamFont}, ${merriweatherFont}, sans-serif`;

  if (!customFont) {
    return defaultFont;
  }

  return `${customFont}, ${defaultFont}`;
}
