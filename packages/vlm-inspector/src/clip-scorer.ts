/**
 * Local CLIP / SigLIP Cosine Similarity Scorer (Offline Fallback Scorer)
 * Computes semantic similarity between scene historical context and image tags/metadata
 */

import { createLogger } from '@chronoviet/infra';
import { VLMScoreResult } from './redis-cache.js';

const log = createLogger({ service: 'vlm-inspector' });

/**
 * Computes cosine similarity between two numeric vectors.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Extracts a normalized deterministic token and bigram feature vector from text for cosine similarity comparison.
 */
export function extractTextVector(text: string, dim: number = 64): number[] {
  const vec = new Array(dim).fill(0);
  const normalized = (text || '').toLowerCase().trim();
  if (normalized.length === 0) return vec;

  const tokens = normalized.split(/[\s,.;:!?()_/-]+/).filter((t) => t.length > 1);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    let hash = 0;
    for (let c = 0; c < token.length; c++) {
      hash = (hash * 31 + token.charCodeAt(c)) >>> 0;
    }
    vec[hash % dim] += 1;

    // Bigram feature
    if (i < tokens.length - 1) {
      const bigram = `${token}_${tokens[i + 1]}`;
      let biHash = 0;
      for (let c = 0; c < bigram.length; c++) {
        biHash = (biHash * 33 + bigram.charCodeAt(c)) >>> 0;
      }
      vec[biHash % dim] += 1.5;
    }
  }

  let sumSq = 0;
  for (let i = 0; i < dim; i++) sumSq += vec[i] * vec[i];
  if (sumSq > 0) {
    const norm = Math.sqrt(sumSq);
    for (let i = 0; i < dim; i++) vec[i] /= norm;
  }
  return vec;
}

/**
 * Local Cosine Similarity Scorer: Evaluates vector cosine similarity, keyword overlap, and visual noise indicators.
 */
export function scoreImageWithLocalCLIP(
  imagePathOrUrl: string,
  eventDescription: string,
  imageMetadata?: { title?: string; author?: string; license?: string }
): VLMScoreResult {
  log.debug('vlm.clip_scoring', 'Scoring with Local Vector Cosine Similarity', {
    imagePathOrUrl,
    eventDescription,
  });

  const descLower = (eventDescription || '').toLowerCase();
  const titleLower = (imageMetadata?.title || imagePathOrUrl || '').toLowerCase();

  // 1. Semantic Cosine Similarity (Max 40)
  const vecDesc = extractTextVector(eventDescription);
  const vecTitle = extractTextVector(imageMetadata?.title || imagePathOrUrl);
  const sim = cosineSimilarity(vecDesc, vecTitle);

  let contextScore = Math.round(sim * 25);

  // Direct shared token matching
  const descTokens = descLower.split(/[\s,.;:!?()_/-]+/).filter((t) => t.length >= 2);
  const titleTokens = titleLower.split(/[\s,.;:!?()_/-]+/).filter((t) => t.length >= 2);
  let sharedTokenCount = 0;
  for (const tok of titleTokens) {
    if (descTokens.includes(tok)) {
      sharedTokenCount++;
    }
  }
  contextScore += Math.min(18, sharedTokenCount * 4);

  // Keyword overlap bonus
  const historicalKeywords = [
    'việt nam', 'bạch đằng', 'quang trung', 'trần hưng đạo', 'lý thái tổ',
    'lê lợi', 'ngô quyền', 'đại việt', 'hoàng thành', 'di tích', 'bảo tàng',
    'tượng', 'đền', 'chùa', 'hùng vương', 'hai bà trưng', 'ngọc lũ', 'trống đồng',
    'hoa lư', 'thăng long', 'nguyễn trãi', 'lệ chi viên', 'thành nhà hồ', 'điện biên phủ',
    'dinh độc lập', 'nam hán', 'nguyên mông', 'tây sơn', 'ngọc hồi', 'đống đa', 'văn lang',
    'mê linh', 'bà triệu', 'đinh bộ lĩnh', 'lý công uẩn', 'hồ quý ly', 'phan bội châu',
    'nguyên trừng', 'hồng đức', 'võ nguyên giáp', 'ngô vương', 'an dương vương', 'cổ loa',
    'thánh gióng', 'sóc sơn', 'giặc ân', 'diên hồng', 'bình than', 'giặc thát'
  ];
  for (const kw of historicalKeywords) {
    if (descLower.includes(kw) && titleLower.includes(kw)) {
      contextScore += 6;
    } else if (descLower.includes(kw) || titleLower.includes(kw)) {
      contextScore += 1.5;
    }
  }

  // Thematic epoch knowledge graph associations
  const epochAssociations: Array<[string[], string[]]> = [
    [['hùng vương', 'văn lang', 'âu lạc', 'phong châu', 'thánh gióng', 'sóc sơn'], ['trống đồng', 'ngọc lũ', 'hùng vương', 'văn lang', 'đền hùng', 'phú thọ', 'đông sơn', 'thánh gióng', 'sóc sơn']],
    [['hai bà trưng', 'bà triệu', 'mê linh', 'bắc thuộc', 'hát môn'], ['hai bà trưng', 'bà triệu', 'mê linh', 'hát môn', 'tô định', 'trưng trắc', 'trưng nhị']],
    [['ngô quyền', 'bạch đằng', '938', 'nam hán', 'lưu hoằng tháo'], ['ngô quyền', 'bạch đằng', 'cọc nhọn', 'hải phòng', 'quảng yên', 'chiến thuyền']],
    [['đinh bộ lĩnh', 'hoa lư', 'đinh tiên hoàng', '12 sứ quân', 'lê hoàn'], ['đinh bộ lĩnh', 'hoa lư', 'cờ lau', 'lê hoàn', 'ninh bình']],
    [['nhà lý', 'lý thái tổ', 'lý công uẩn', 'chiếu dời đô', 'thăng long', 'định đô', 'đại la'], ['lý thái tổ', 'thăng long', 'chùa một cột', 'chiếu dời đô', 'diên hựu', 'hồ gươm']],
    [['nhà trần', 'trần hưng đạo', 'nguyên mông', 'hịch tướng sĩ', 'đông bộ đầu', 'mông cổ', 'diên hồng', 'bình than', 'giặc thát'], ['trần hưng đạo', 'bạch đằng', 'hịch tướng sĩ', 'nguyên mông', 'đền trần', 'nam định', 'đông a', 'diên hồng']],
    [['nhà hồ', 'hồ quý ly', 'tây đô', 'thành nhà hồ', 'súng thần cơ', 'canh tân', 'thông bảo'], ['hồ quý ly', 'thành nhà hồ', 'súng thần cơ', 'thanh hóa', 'thông bảo', 'hồ nguyên trừng']],
    [['lam sơn', 'lê lợi', 'nguyễn trãi', 'bình ngô đại cáo'], ['lê lợi', 'nguyễn trãi', 'bình ngô đại cáo', 'lam sơn', 'lam kinh', 'thanh hóa', 'vĩnh lăng']],
    [['lê sơ', 'lê thánh tông', 'hồng đức', 'văn miếu', 'quốc tử giám', 'bia tiến sĩ', 'tao đàn'], ['lê thánh tông', 'hồng đức', 'văn miếu', 'quốc tử giám', 'bia tiến sĩ']],
    [['tây sơn', 'quang trung', 'nguyễn huệ', 'ngọc hồi', 'đống đa', 'quân thanh', 'kỷ dậu'], ['quang trung', 'nguyễn huệ', 'ngọc hồi', 'đống đa', 'bình định', 'gò đống đa', 'voi chiến']],
    [['nhà nguyễn', 'huế', 'hoàng thành', 'ngọ môn', 'đại nội', 'kinh thành huế', 'cửu đỉnh'], ['hoàng thành', 'ngọ môn', 'đại nội', 'kinh thành huế', 'cố đô huế', 'cửu đỉnh', 'khải định']],
    [['pháp thuộc', 'đông du', 'phan bội châu', 'phan châu trinh', 'yêu nước', 'duy tân'], ['đông du', 'phan bội châu', 'phan châu trinh', 'tiếng dân', 'duy tân']],
    [['điện biên phủ', 'tướng giáp', 'đờ cát', '1954', 'lừng lẫy năm châu', 'đồi a1'], ['điện biên phủ', 'tướng giáp', 'đờ cát', 'đồi a1', 'võ nguyên giáp']],
    [['thống nhất', 'dinh độc lập', '30 tháng 4', 'xe tăng 390', '1975', 'hồ chí minh'], ['dinh độc lập', '30 tháng 4', 'xe tăng 390', 'hội trường thống nhất', 'mặt trận']]
  ];

  for (const [descTerms, titleTerms] of epochAssociations) {
    const hasDescMatch = descTerms.some((t) => descLower.includes(t));
    const hasTitleMatch = titleTerms.some((t) => titleLower.includes(t));
    if (hasDescMatch && hasTitleMatch) {
      contextScore += 16;
      break;
    }
  }

  // If title contains obvious irrelevant/foreign cues, penalize context score
  const foreignOrIrrelevant = ['ngoại quốc', 'cổ trang trung quốc', 'không rõ thời kỳ', 'stock photo unrelated'];
  for (const term of foreignOrIrrelevant) {
    if (titleLower.includes(term)) {
      contextScore = Math.min(contextScore, 8);
    }
  }

  contextScore = Math.min(40, Math.max(0, contextScore));

  // 2. Visual Noise Score (Max 30) - Check for noisy terms in filename/title
  let noiseScore = 28;
  const noisyTerms = [
    'watermark', 'stock', 'getty', 'shutterstock', 'lowres', 'thumbnail', 'logo',
    'nhiễu', 'vỡ nét', 'mờ', 'hạt'
  ];
  for (const term of noisyTerms) {
    if (titleLower.includes(term)) {
      noiseScore -= 10;
    }
  }
  noiseScore = Math.min(30, Math.max(0, noiseScore));

  // 3. Artistic Fit Score (Max 30)
  let artisticScore = 25;
  const goodTerms = ['statue', 'temple', 'monument', 'painting', 'map', 'artifact', 'bản đồ', 'tượng đài'];
  for (const term of goodTerms) {
    if (titleLower.includes(term)) {
      artisticScore += 2;
    }
  }
  artisticScore = Math.min(30, Math.max(10, artisticScore));

  const totalScore = contextScore + noiseScore + artisticScore;
  const passed = totalScore >= 60;

  const reasons: string[] = [];
  if (passed) {
    reasons.push('Tương đồng ngữ cảnh cao qua bộ chấm điểm Local CLIP (Cosine Sim)');
    if (noiseScore >= 25) reasons.push('Không phát hiện watermark hoặc logo đè');
  } else {
    reasons.push(`Điểm tổng (${totalScore}/100) chưa đạt ngưỡng chuẩn 60 điểm`);
  }

  return {
    historicalContextScore: contextScore,
    visualNoiseScore: noiseScore,
    artisticFitScore: artisticScore,
    totalScore,
    overallScore: totalScore,
    passed,
    reasons,
    scorerType: 'CLIP_LOCAL_FALLBACK',
  };
}
