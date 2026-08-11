/**
 * Corpus Quality Gate & Content Sanitizer
 * Ensures crawled historical text is clean, structured, and meets minimum quality thresholds.
 */

import { SourceReliability } from '@chronoviet/shared-spec';

export interface RawCrawledContent {
  title: string;
  sourceUrl: string;
  rawText: string;
  dynasty?: string;
  sourceReliability?: SourceReliability;
  minWordCount?: number;
}

export interface SanitizedDocument {
  isValid: boolean;
  rejectReason?: string;
  title: string;
  sourceUrl: string;
  cleanedText: string;
  markdownContent: string;
  wordCount: number;
  slug: string;
}

export class QualityGateValidator {
  private minWordCount: number;

  constructor(defaultMinWordCount = 150) {
    this.minWordCount = defaultMinWordCount;
  }

  public sanitize(content: RawCrawledContent): SanitizedDocument {
    const minWords = content.minWordCount ?? this.minWordCount;

    // 1. Clean HTML tags & script/style elements
    let cleaned = content.rawText
      .replace(/<script\b[^<]*>([\s\S]*?)<\/script>/gi, '')
      .replace(/<style\b[^<]*>([\s\S]*?)<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');

    // 2. Normalize whitespace & blank lines
    cleaned = cleaned
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();

    // 3. Strip Wikipedia artifacts if any
    cleaned = cleaned
      .replace(/==\s*Xem thêm\s*==[\s\S]*/gi, '')
      .replace(/==\s*Tham khảo\s*==[\s\S]*/gi, '')
      .replace(/==\s*Liên kết ngoài\s*==[\s\S]*/gi, '')
      .replace(/\[\s*\d+\s*\]/g, ''); // Remove footnote brackets [1], [2]

    // 4. Calculate word count
    const words = cleaned.split(/\s+/).filter((w) => w.length > 0);
    const wordCount = words.length;

    const slug = this.slugify(content.title);

    if (wordCount < minWords) {
      return {
        isValid: false,
        rejectReason: `Word count (${wordCount}) below minimum threshold (${minWords})`,
        title: content.title,
        sourceUrl: content.sourceUrl,
        cleanedText: cleaned,
        markdownContent: '',
        wordCount,
        slug,
      };
    }

    // 5. Generate Structured Markdown with Frontmatter Metadata
    const nowIso = new Date().toISOString();
    const reliability = content.sourceReliability || 'LEVEL_2';
    const dynastyStr = content.dynasty ? `dynasty: "${content.dynasty}"\n` : '';

    const markdownContent = `---
title: "${content.title.replace(/"/g, '\\"')}"
source_url: "${content.sourceUrl}"
source_reliability: "${reliability}"
crawled_at: "${nowIso}"
word_count: ${wordCount}
${dynastyStr}---

# ${content.title}

${cleaned}
`;

    return {
      isValid: true,
      title: content.title,
      sourceUrl: content.sourceUrl,
      cleanedText: cleaned,
      markdownContent,
      wordCount,
      slug,
    };
  }

  public slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
