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
  if (!rawText.startsWith('---')) {
    return { body: rawText, metadata: {} };
  }

  const endIdx = rawText.indexOf('\n---', 3);
  if (endIdx === -1) {
    return { body: rawText, metadata: {} };
  }

  const frontmatterStr = rawText.substring(3, endIdx).trim();
  const body = rawText.substring(endIdx + 4).trim();
  const metadata: Record<string, string> = {};

  for (const line of frontmatterStr.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim().toLowerCase();
      let val = line.substring(colonIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      metadata[key] = val;
    }
  }

  return { body, metadata };
}
