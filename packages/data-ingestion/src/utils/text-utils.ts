/**
 * Shared Text & Frontmatter Utilities for Data Ingestion
 */

export interface ParsedFrontmatter {
  body: string;
  metadata: Record<string, string>;
}

/**
 * Parses YAML frontmatter from raw Markdown text if present.
 */
export function parseFrontmatter(rawText: string): ParsedFrontmatter {
  const trimmed = rawText.trimStart();
  let delimiter: string | null = null;
  if (trimmed.startsWith('---')) delimiter = '---';
  else if (trimmed.startsWith('...')) delimiter = '...';

  if (!delimiter) {
    return { body: rawText, metadata: {} };
  }

  let endIdx = -1;
  let delimOffset = 0;

  const match = trimmed.slice(3).match(/\n(?:---|\.\.\.)/);
  if (match && match.index !== undefined) {
    endIdx = match.index + 3;
    delimOffset = match[0].length;
  } else {
    const trailingMatch = trimmed.slice(3).match(/(?:\.\.\.|---)\s*\n/);
    if (trailingMatch && trailingMatch.index !== undefined) {
      endIdx = trailingMatch.index + 3;
      delimOffset = trailingMatch[0].length;
    }
  }

  if (endIdx === -1) {
    return { body: rawText, metadata: {} };
  }

  const frontmatterStr = trimmed.substring(3, endIdx).trim();
  const body = trimmed.substring(endIdx + delimOffset).trim();
  const metadata: Record<string, string> = {};

  for (const line of frontmatterStr.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim().toLowerCase();
      let val = line.substring(colonIdx + 1).trim();
      val = val.replace(/\s*(?:\.\.\.|---)\s*$/, '');
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      metadata[key] = val;
    }
  }

  return { body, metadata };
}
