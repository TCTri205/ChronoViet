/**
 * ChronoViet Claim Grounder & Citation Verifier
 * Performs sentence-level factual claim extraction, strict entailment verification,
 * polarity conflict detection (victory/defeat inversion), agent-target role validation,
 * kinship consistency, and precise chunk attribution to eliminate citation hallucination (C9-M4).
 */

import {
  GroundedClaimItem,
  VisualAnchorSuggestion,
  splitSentences,
  extractHistoricalCandidateSpans,
} from '@chronoviet/shared-spec';
import {
  extractQueryEntities,
  extractHistoricalYears,
} from '../retrieval/question-ner.js';

const STOP_WORDS = new Set([
  'là', 'và', 'của', 'tại', 'cho', 'vào', 'ra', 'bị', 'bởi', 'thời', 'các', 'những', 'đã', 'trong',
  'với', 'theo', 'như', 'được', 'năm', 'tháng', 'ngày', 'đến', 'từ', 'có', 'thì', 'ở', 'đó', 'này',
  'đây', 'một', 'mà', 'vì', 'do', 'đang', 'sẽ', 'lại', 'qua', 'lên', 'xuống', 'về', 'nơi', 'khi', 'sau', 'trước'
]);

export const VICTORY_TERMS = [
  'thắng', 'đại thắng', 'thắng lợi', 'đánh tan', 'quét sạch', 'tiêu diệt', 'bảo vệ',
  'giải phóng', 'đập tan', 'khởi nghĩa thành công', 'chém chết', 'bắt sống', 'chiến thắng', 'đại phá'
];

export const DEFEAT_TERMS = [
  'thất bại', 'đầu hàng', 'tháo chạy', 'tử trận', 'chết vô số', 'thua trận',
  'bị diệt', 'bị bắt', 'tuẫn tiết', 'thất thủ', 'bị chém', 'vỡ trận'
];

export const TRANSITIVE_VICTORY_ACTIONS = [
  'đại phá', 'đánh tan', 'tiêu diệt', 'đập tan', 'quét sạch', 'đánh bại',
  'chém chết', 'bắt sống', 'bắt được', 'tiêu hao', 'đè bẹp', 'bẻ gãy'
];

export const NEGATION_PATTERNS = [
  /\bkhông\s+phải\b/i,
  /\bkhông\s+có\s+thật\b/i,
  /\bchưa\s+bao\s+giờ\b/i,
  /\bkhông\s+hề\b/i,
  /\bchẳng\s+phải\b/i,
  /\bhoàn\s+toàn\s+sai\b/i,
  /\bsai\s+lệch\b/i,
  /\bhư\s+cấu\b/i,
];

export const KINSHIP_TERMS = [
  'cha của', 'mẹ của', 'anh của', 'em của', 'chị của', 'chồng của', 'vợ của', 'con của', 'ông của', 'cháu của'
];

export const DISCOURSE_PREFIXES = [
  /^(?:dạ|vâng|xin chào|kính chào|thưa bạn|chào bạn|thưa anh\/chị|chào anh\/chị)\b/i,
  /^(?:dưới đây là|sau đây là|trên đây là)\b/i,
  /^(?:tóm lại|nhìn chung|như vậy|có thể thấy|tổng kết lại)\b/i,
  /^(?:hy vọng|chúc bạn|nếu bạn cần|rất vui được)\b/i,
  /^(?:đây là một trong những|đây là)\s+(?:chiến công|sự kiện|trận đánh|thắng lợi|nhân vật)\b/i,
  /^(?:câu trả lời là|đáp án là)\b/i,
  /^(?:để trả lời câu hỏi|về câu hỏi của bạn)\b/i,
];

export const SOURCE_PREAMBLES = [
  /^(?:theo (?:sử sách|sử liệu|ghi chép|tư liệu|nguồn tin|tài liệu|thông tin|đại việt sử ký|lịch sử)|theo tôi được biết|như đã biết)[,:\s]+/i,
  /^(?:dạ|vâng|xin chào|kính chào|thưa bạn|chào bạn)[,.\s]+/i,
  /^(?:tóm lại|nhìn chung|như vậy|dưới đây là|sau đây là)[,:\s]+/i,
];

/**
 * Checks if a sentence is a pure discourse marker, greeting, or meta-statement without substantive facts
 */
export function isDiscourseOrMetaSentence(sentence: string): boolean {
  const clean = sentence.trim().toLowerCase();
  if (clean.length < 12) return true;

  const matchesDiscourse = DISCOURSE_PREFIXES.some((pattern) => pattern.test(clean));
  if (!matchesDiscourse) return false;

  // Check if it carries factual historical entities or temporal years/centuries
  const entities = extractQueryEntities(sentence);
  const years = extractHistoricalYears(sentence);

  const hasSubstantiveFact = entities.entityIds.length > 0 || years.extractedYears.length > 0;
  return !hasSubstantiveFact;
}

export interface ChunkInfo {
  id: string;
  title: string;
  content: string;
  reliability: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | string;
}

export interface ClaimVerificationDetail {
  claimText: string;
  entailmentStatus: 'ENTAILED' | 'CONTRADICTED' | 'NOT_SUPPORTED' | 'NEUTRAL';
  entailmentScore: number;
  sourceChunkId?: string;
  sourceTitle?: string;
}

export interface GroundingAnalysisResult {
  claims: GroundedClaimItem[];
  allClaims?: ClaimVerificationDetail[];
  citations: string[];
  visualAnchors: VisualAnchorSuggestion[];
  faithfulnessScore: number;
  citationCorrectnessScore: number;
  hasContradiction?: boolean;
  isLowConfidence?: boolean;
}

/**
 * Splits text into individual factual proposition claims using SSOT sentence segmentation,
 * stripping conversational preambles while preserving factual statements.
 */
export function extractClaims(text: string): string[] {
  if (!text || !text.trim()) return [];

  const rawSentences = splitSentences(text);
  const claims: string[] = [];

  for (const raw of rawSentences) {
    let s = raw.trim();
    if (!s || s.startsWith('#')) continue;

    // Strip markdown list bullet points and enumeration
    s = s.replace(/^[-*•\d.)\s]+/, '').trim();

    // If the sentence as a whole is pure discourse/meta fluff, filter it out
    if (isDiscourseOrMetaSentence(s)) continue;

    // Strip conversational preambles (e.g. "Theo sử liệu,", "Dạ thưa bạn,")
    for (const preamble of SOURCE_PREAMBLES) {
      s = s.replace(preamble, '').trim();
    }

    if (s.length < 12) continue;
    if (isDiscourseOrMetaSentence(s)) continue;

    // Normalize casing for the beginning of the sentence
    const normalized = s.charAt(0).toUpperCase() + s.slice(1);
    claims.push(normalized);
  }

  return claims;
}

export interface ClaimEntailmentResult {
  status: 'ENTAILED' | 'CONTRADICTED' | 'NOT_SUPPORTED' | 'NEUTRAL';
  score: number;
  conflictReason?: string;
}

/**
 * Analyzes semantic agent-target binding around a transitive victory/conflict verb.
 * Detects whether entity A defeated entity B or vice-versa, accounting for active and passive ('bị') voice.
 */
function detectAgentTargetInversion(
  claim: string,
  evidenceText: string
): boolean {
  const cLower = claim.toLowerCase();
  const evLower = evidenceText.toLowerCase();

  for (const verb of TRANSITIVE_VICTORY_ACTIONS) {
    const cVerbIdx = cLower.indexOf(verb);
    const evVerbIdx = evLower.indexOf(verb);
    if (cVerbIdx === -1 || evVerbIdx === -1) continue;

    const claimSpans = extractHistoricalCandidateSpans(claim).filter((s) => s.suggestedCanonicalId);
    const evSpans = extractHistoricalCandidateSpans(evidenceText).filter((s) => s.suggestedCanonicalId);

    const claimIds = new Set(claimSpans.map((s) => s.suggestedCanonicalId!));
    const sharedIds = Array.from(new Set(evSpans.map((s) => s.suggestedCanonicalId!).filter((id) => claimIds.has(id))));

    if (sharedIds.length < 2) continue;

    const entAId = sharedIds[0];
    const entBId = sharedIds[1];

    const cSpanA = claimSpans.find((s) => s.suggestedCanonicalId === entAId);
    const cSpanB = claimSpans.find((s) => s.suggestedCanonicalId === entBId);
    const evSpanA = evSpans.find((s) => s.suggestedCanonicalId === entAId);
    const evSpanB = evSpans.find((s) => s.suggestedCanonicalId === entBId);

    if (!cSpanA || !cSpanB || !evSpanA || !evSpanB) continue;

    const cPosA = cSpanA.startOffset;
    const cPosB = cSpanB.startOffset;
    const evPosA = evSpanA.startOffset;
    const evPosB = evSpanB.startOffset;

    // Determine roles in claim
    const cIsPassiveA = cLower.slice(0, cVerbIdx).includes('bị') && cPosA < cVerbIdx;
    const cAgentIsA = (cPosA < cVerbIdx && cPosB > cVerbIdx && !cIsPassiveA) ||
                      (cPosB < cVerbIdx && cPosA > cVerbIdx && cLower.slice(0, cVerbIdx).includes('bị'));

    // Determine roles in evidence
    const evIsPassiveA = evLower.slice(0, evVerbIdx).includes('bị') && evPosA < evVerbIdx;
    const evAgentIsA = (evPosA < evVerbIdx && evPosB > evVerbIdx && !evIsPassiveA) ||
                       (evPosB < evVerbIdx && evPosA > evVerbIdx && evLower.slice(0, evVerbIdx).includes('bị'));

    // If roles are directly inverted between the two entities
    if (cAgentIsA !== evAgentIsA) {
      return true;
    }
  }

  return false;
}

/**
 * Strictly verifies whether a claim is entailed, contradicted, or unsupported by evidence.
 * Integrates Stage 1 Historical NER, temporal century/year matching, agent-target role validation,
 * kinship consistency, and composite semantic overlap.
 */
export function verifyClaimEntailmentDetail(claim: string, evidenceText: string): ClaimEntailmentResult {
  if (!claim || !evidenceText) {
    return { status: 'NOT_SUPPORTED', score: 0 };
  }

  const cLower = claim.toLowerCase().trim();
  const evLower = evidenceText.toLowerCase().trim();

  // 1. Historical Entity & Temporal Extraction (< 0.2ms)
  const claimInfo = extractQueryEntities(claim);
  const evInfo = extractQueryEntities(evidenceText);

  // Identify shared historical entities
  const sharedEntities: { id: string; name: string }[] = [];
  for (let i = 0; i < claimInfo.entityIds.length; i++) {
    const id = claimInfo.entityIds[i];
    if (evInfo.entityIds.includes(id) || evLower.includes(claimInfo.entityNames[i].toLowerCase())) {
      sharedEntities.push({ id, name: claimInfo.entityNames[i] });
    }
  }

  // 2. Token Overlap & Content Word Ratio
  const tokens = cLower
    .replace(/[.,/#!$%^&*;:{}=\-_`~()\[\]]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));

  if (tokens.length === 0) return { status: 'ENTAILED', score: 0.8 };

  const evHasVictory = VICTORY_TERMS.some((t) => evLower.includes(t));
  const evHasDefeat = DEFEAT_TERMS.some((t) => evLower.includes(t));

  let matchedTokens = 0;
  for (const t of tokens) {
    if (evLower.includes(t)) {
      matchedTokens++;
    } else if (VICTORY_TERMS.includes(t) && evHasVictory) {
      matchedTokens++;
    }
  }
  const tokenRatio = matchedTokens / tokens.length;

  // Extract numbers (including decimals/thousands separators like 500.000)
  const claimNumbers = cLower.match(/\b\d+(?:[.,]\d+)?\b/g) || [];
  const numbersInEv = claimNumbers.filter((num) => {
    const plain = num.replace(/[.,]/g, '');
    return evLower.includes(num) || evLower.includes(plain);
  });

  // Topical Relevance Gating
  const isTopicallyRelevant =
    tokenRatio >= 0.15 ||
    numbersInEv.length > 0 ||
    sharedEntities.length > 0;

  if (!isTopicallyRelevant) {
    return { status: 'NOT_SUPPORTED', score: 0.10, conflictReason: 'NO_TOPICAL_OVERLAP' };
  }

  // 3. Agent-Target Role Inversion Contradiction
  if (detectAgentTargetInversion(claim, evidenceText)) {
    return {
      status: 'CONTRADICTED',
      score: 0.05,
      conflictReason: 'AGENT_TARGET_INVERSION_CONTRADICTION',
    };
  }

  // 4. Polarity Inversion (Victory vs Defeat conflict)
  const claimHasVictory = VICTORY_TERMS.some((t) => cLower.includes(t));
  const claimHasDefeat = DEFEAT_TERMS.some((t) => cLower.includes(t));

  // Only trigger when claim clearly takes one polarity without acknowledging the other
  if (claimHasVictory && !claimHasDefeat && evHasDefeat && !evHasVictory) {
    return { status: 'CONTRADICTED', score: 0.05, conflictReason: 'POLARITY_INVERSION_CLAIM_VICTORY_EVIDENCE_DEFEAT' };
  }
  if (claimHasDefeat && !claimHasVictory && evHasVictory && !evHasDefeat) {
    return { status: 'CONTRADICTED', score: 0.05, conflictReason: 'POLARITY_INVERSION_CLAIM_DEFEAT_EVIDENCE_VICTORY' };
  }

  // Explicit Victory Negation or Fact Denial Contradiction
  const claimHasVictoryNegation =
    /(?:không\s+phải|không\s+hề|chưa\s+bao\s+giờ|chẳng\s+phải)\s+(?:là\s+)?(?:chiến\s+thắng|thắng\s+lợi|đại\s+thắng|thắng\s+trận)/i.test(cLower) ||
    /(?:hoàn\s+toàn\s+sai|sai\s+lệch|hư\s+cấu|không\s+có\s+thật)/i.test(cLower);

  if (claimHasVictoryNegation && evHasVictory) {
    return { status: 'CONTRADICTED', score: 0.05, conflictReason: 'EXPLICIT_NEGATION_CONTRADICTION' };
  }

  // 5. Kinship Consistency Check
  const claimKinship = KINSHIP_TERMS.find((k) => cLower.includes(k));
  if (claimKinship) {
    const evKinship = KINSHIP_TERMS.find((k) => evLower.includes(k));
    if (evKinship && evKinship !== claimKinship) {
      return { status: 'CONTRADICTED', score: 0.05, conflictReason: `KINSHIP_CONFLICT_${claimKinship}_VS_${evKinship}` };
    }

    // Kinship Target Entity Mismatch (e.g. "con của Lê Lợi" vs "con của Nguyễn Phi Khanh")
    const kinshipTargetRegex = new RegExp(
      `${claimKinship}\\s+([a-zà-ỹ0-9_\\s]{2,30}?)(?=[,.;!?:(]|\\s+(?:và|đã|đang|ông|bà|người|theo|giúp|thì|nhưng|mà|với|trong|tại)|$)`,
      'i'
    );
    const claimTargetMatch = cLower.match(kinshipTargetRegex);
    const evTargetMatch = evLower.match(kinshipTargetRegex);
    if (claimTargetMatch && evTargetMatch) {
      const claimTarget = claimTargetMatch[1].trim();
      const evTarget = evTargetMatch[1].trim();
      if (claimTarget && evTarget && !evTarget.includes(claimTarget) && !claimTarget.includes(evTarget)) {
        return { status: 'CONTRADICTED', score: 0.05, conflictReason: `KINSHIP_TARGET_CONFLICT_${claimTarget}_VS_${evTarget}` };
      }
    }
  }

  // 6. Temporal Year & Century Validation
  const claimYears = extractHistoricalYears(claim);
  const evYears = extractHistoricalYears(evidenceText);

  if (claimYears.extractedYears.length > 0) {
    const hasDirectYearMatch = claimYears.extractedYears.some((y) => {
      const yStr = String(Math.abs(y));
      return evYears.extractedYears.includes(y) || evLower.includes(yStr);
    });

    let hasRangeOverlap = false;
    if (claimYears.temporalRange) {
      if (evYears.temporalRange) {
        hasRangeOverlap =
          claimYears.temporalRange.start <= evYears.temporalRange.end &&
          claimYears.temporalRange.end >= evYears.temporalRange.start;
      } else if (evYears.extractedYears.length > 0) {
        hasRangeOverlap = evYears.extractedYears.some(
          (y) => y >= claimYears.temporalRange!.start && y <= claimYears.temporalRange!.end
        );
      }
    }

    if (!hasDirectYearMatch && !hasRangeOverlap) {
      return { status: 'NOT_SUPPORTED', score: 0.15, conflictReason: 'TEMPORAL_MISMATCH' };
    }
  }

  // 7. Bigram Phrasal Containment
  const totalBigrams = tokens.length - 1;
  let bigramMatches = 0;
  if (totalBigrams > 0) {
    for (let i = 0; i < totalBigrams; i++) {
      const bg = `${tokens[i]} ${tokens[i + 1]}`;
      if (evLower.includes(bg) || (VICTORY_TERMS.some((v) => bg.includes(v)) && evHasVictory)) {
        bigramMatches++;
      }
    }
  }

  const bigramRatio = totalBigrams > 0 ? bigramMatches / totalBigrams : tokenRatio;

  // 8. Composite Semantic Score (Token + Bigram + Entity Ratio)
  let score: number;
  if (claimInfo.entityIds.length > 0) {
    const entityRatio = sharedEntities.length / claimInfo.entityIds.length;
    score = Number((0.35 * tokenRatio + 0.35 * bigramRatio + 0.30 * entityRatio).toFixed(3));
  } else {
    score = Number((0.55 * tokenRatio + 0.45 * bigramRatio).toFixed(3));
  }

  if (score >= 0.30 || (tokenRatio >= 0.50 && claimNumbers.length > 0)) {
    return { status: 'ENTAILED', score };
  } else if (score < 0.20) {
    return { status: 'NOT_SUPPORTED', score };
  } else {
    return { status: 'NEUTRAL', score };
  }
}

/**
 * Calculates entailment score between a claim and an evidence text chunk (0.0 to 1.0)
 */
export function calculateEntailment(claim: string, evidenceText: string): number {
  return verifyClaimEntailmentDetail(claim, evidenceText).score;
}

/**
 * Attributes each claim to its exact supporting chunk and computes faithfulness metrics
 */
export function groundClaims(
  answerText: string,
  chunks: Map<string, ChunkInfo> | ChunkInfo[]
): GroundingAnalysisResult {
  const chunkList: ChunkInfo[] = Array.isArray(chunks)
    ? chunks
    : Array.from(chunks.values());

  const rawClaims = extractClaims(answerText);
  const groundedClaims: GroundedClaimItem[] = [];
  const allClaimsDetail: ClaimVerificationDetail[] = [];
  const usedCitationsSet = new Set<string>();

  let totalEntailed = 0;
  let correctlyCited = 0;
  let hasContradiction = false;

  for (const claim of rawClaims) {
    // 1. Check for inline citation tags like [Nguồn: chunk_id] or [CHUNK_1]
    let explicitChunkId: string | null = null;
    const matchExplicit = claim.match(/\[(?:Nguồn:\s*|CHUNK_)?([^\]]+)\]/i);
    if (matchExplicit && matchExplicit[1]) {
      const candidateTag = matchExplicit[1].trim();
      const found = chunkList.find(
        (c) => c.id === candidateTag || c.title.includes(candidateTag) || candidateTag.includes(c.id)
      );
      if (found) {
        explicitChunkId = found.id;
      }
    }

    // 2. Find best supporting chunk across available chunks
    let bestChunk: ChunkInfo | null = null;
    let highestDetail: ClaimEntailmentResult = { status: 'NOT_SUPPORTED', score: 0 };
    let contradictionChunk: { chunk: ChunkInfo; detail: ClaimEntailmentResult } | null = null;

    for (const chunk of chunkList) {
      const detail = verifyClaimEntailmentDetail(claim, chunk.content);
      if (detail.status === 'CONTRADICTED') {
        contradictionChunk = { chunk, detail };
      }
      if (detail.score > highestDetail.score) {
        highestDetail = detail;
        bestChunk = chunk;
      }
    }

    const assignedChunk = explicitChunkId
      ? chunkList.find((c) => c.id === explicitChunkId) || (highestDetail.score >= 0.30 ? bestChunk : null)
      : (highestDetail.score >= 0.30 ? bestChunk : (contradictionChunk ? contradictionChunk.chunk : null));

    const entailmentDetail = assignedChunk
      ? verifyClaimEntailmentDetail(claim, assignedChunk.content)
      : (contradictionChunk ? contradictionChunk.detail : highestDetail);

    if (entailmentDetail.status === 'CONTRADICTED') {
      hasContradiction = true;
    }

    const isEntailed = entailmentDetail.status === 'ENTAILED';
    if (isEntailed) {
      totalEntailed++;
      correctlyCited++;
    }

    const cleanedClaim = claim.replace(/\[(?:Nguồn:\s*|CHUNK_)?([^\]]+)\]/gi, '').trim();

    allClaimsDetail.push({
      claimText: cleanedClaim,
      entailmentStatus: entailmentDetail.status,
      entailmentScore: entailmentDetail.score,
      sourceChunkId: assignedChunk?.id,
      sourceTitle: assignedChunk?.title,
    });

    if (assignedChunk && isEntailed) {
      const rel = assignedChunk.reliability === 'LEVEL_2' || assignedChunk.reliability === 'LEVEL_3'
        ? (assignedChunk.reliability as 'LEVEL_2' | 'LEVEL_3')
        : 'LEVEL_1';

      // Infer visual anchor suggestions from entities and locations in the claim
      const claimEntities = extractQueryEntities(cleanedClaim);
      const claimVisualAnchors: VisualAnchorSuggestion[] = [];

      for (let i = 0; i < claimEntities.entityIds.length; i++) {
        const entId = claimEntities.entityIds[i];
        const entName = claimEntities.entityNames[i] || entId;

        let visualType: VisualAnchorSuggestion['suggestedVisualType'] = 'DIAGRAM';
        if (entId.startsWith('person_')) {
          visualType = 'PORTRAIT';
        } else if (entId.startsWith('loc_')) {
          visualType = 'MAP';
        } else if (entId.startsWith('event_')) {
          visualType = 'BATTLE_SCENE';
        } else if (entId.startsWith('doc_') || entId.startsWith('artifact_')) {
          visualType = 'DOCUMENT';
        }

        claimVisualAnchors.push({
          entityId: entId,
          label: entName,
          suggestedVisualType: visualType,
          matchedClaimText: cleanedClaim,
        });
      }

      groundedClaims.push({
        claimText: cleanedClaim,
        sourceChunkId: assignedChunk.id,
        sourceTitle: assignedChunk.title,
        reliability: rel,
        entailmentScore: entailmentDetail.score,
        entailmentStatus: 'ENTAILED',
        visualAnchors: claimVisualAnchors.length > 0 ? claimVisualAnchors : undefined,
      });

      usedCitationsSet.add(`${assignedChunk.title} [Nguồn: ${rel}]`);
    }
  }

  const allVisualAnchors: VisualAnchorSuggestion[] = [];
  const seenAnchorKeys = new Set<string>();
  for (const c of groundedClaims) {
    if (c.visualAnchors) {
      for (const a of c.visualAnchors) {
        if (!seenAnchorKeys.has(a.entityId)) {
          seenAnchorKeys.add(a.entityId);
          allVisualAnchors.push(a);
        }
      }
    }
  }

  const totalClaims = Math.max(1, rawClaims.length);
  const faithfulnessScore = Number(((totalEntailed / totalClaims) * 100).toFixed(2));
  const citationCorrectnessScore = Number(((correctlyCited / totalClaims) * 100).toFixed(2));
  const isLowConfidence = faithfulnessScore < 60 || hasContradiction;

  return {
    claims: groundedClaims,
    allClaims: allClaimsDetail,
    citations: Array.from(usedCitationsSet),
    visualAnchors: allVisualAnchors,
    faithfulnessScore,
    citationCorrectnessScore,
    hasContradiction,
    isLowConfidence,
  };
}

export const ClaimGrounder = {
  extractClaims,
  calculateEntailment,
  verifyClaimEntailmentDetail,
  isDiscourseOrMetaSentence,
  groundClaims,
};
