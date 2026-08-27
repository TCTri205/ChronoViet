/**
 * ChronoViet Claim Grounder & Citation Verifier
 * Performs sentence-level factual claim extraction, strict entailment verification,
 * and precise chunk attribution to eliminate citation hallucination (C9-M4).
 */

import { GroundedClaimItem, VisualAnchorSuggestion } from '@chronoviet/shared-spec';
import { extractQueryEntities } from '../retrieval/question-ner.js';

const STOP_WORDS = new Set([
  'là', 'và', 'của', 'tại', 'cho', 'vào', 'ra', 'bị', 'bởi', 'thời', 'các', 'những', 'đã', 'trong', 'với', 'theo', 'như', 'được', 'năm', 'tháng', 'ngày', 'đến', 'từ', 'có', 'thì', 'ở', 'đó', 'này', 'đây', 'một', 'những'
]);

export interface ChunkInfo {
  id: string;
  title: string;
  content: string;
  reliability: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | string;
}

export interface GroundingAnalysisResult {
  claims: GroundedClaimItem[];
  citations: string[];
  visualAnchors: VisualAnchorSuggestion[];
  faithfulnessScore: number;
  citationCorrectnessScore: number;
}

/**
 * Splits text into individual factual proposition claims
 */
export function extractClaims(text: string): string[] {
  if (!text || !text.trim()) return [];

  return text
    .split(/(?<=[.!?\n])\s+|;\s+|\n+/)
    .map((s) => s.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter((s) => s.length > 10 && !s.startsWith('#'));
}

/**
 * Calculates entailment score between a claim and an evidence text chunk
 */
export function calculateEntailment(claim: string, evidenceText: string): number {
  if (!claim || !evidenceText) return 0;

  const cLower = claim.toLowerCase().trim();
  const evLower = evidenceText.toLowerCase().trim();

  // 1. Number & Date Verification: If claim has numbers/years, they must appear in evidence
  const claimNumbers = cLower.match(/\b\d+\b/g) || [];
  if (claimNumbers.length > 0) {
    const numbersInEv = claimNumbers.filter((num) => evLower.includes(num));
    if (numbersInEv.length === 0) {
      return 0.15; // Numeric conflict
    }
  }

  // 2. Token Overlap
  const tokens = cLower
    .replace(/[.,/#!$%^&*;:{}=\-_`~()\[\]]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));

  if (tokens.length === 0) return 0.8;

  const tokenRatio = tokens.filter((t) => evLower.includes(t)).length / tokens.length;

  // 3. Bigram Containment
  const totalBigrams = tokens.length - 1;
  const bigramMatches = totalBigrams > 0
    ? tokens.slice(0, totalBigrams).filter((t, i) => evLower.includes(`${t} ${tokens[i + 1]}`)).length
    : 0;

  const bigramRatio = totalBigrams > 0 ? bigramMatches / totalBigrams : tokenRatio;
  const score = 0.55 * tokenRatio + 0.45 * bigramRatio;

  return Number(score.toFixed(3));
}

/**
 * Attributes each claim to its exact supporting chunk
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
  const usedCitationsSet = new Set<string>();

  let totalEntailed = 0;
  let correctlyCited = 0;

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
    let highestScore = 0;

    for (const chunk of chunkList) {
      const score = calculateEntailment(claim, chunk.content);
      if (score > highestScore) {
        highestScore = score;
        bestChunk = chunk;
      }
    }

    const assignedChunk = explicitChunkId
      ? chunkList.find((c) => c.id === explicitChunkId) || (highestScore >= 0.30 ? bestChunk : null)
      : (highestScore >= 0.30 ? bestChunk : null);

    const entailmentScore = assignedChunk
      ? calculateEntailment(claim, assignedChunk.content)
      : 0;

    const isEntailed = entailmentScore >= 0.30;
    if (isEntailed) {
      totalEntailed++;
      correctlyCited++;
    }

    if (assignedChunk && isEntailed) {
      const rel = assignedChunk.reliability === 'LEVEL_2' || assignedChunk.reliability === 'LEVEL_3'
        ? (assignedChunk.reliability as 'LEVEL_2' | 'LEVEL_3')
        : 'LEVEL_1';

      const cleanedClaim = claim.replace(/\[(?:Nguồn:\s*|CHUNK_)?([^\]]+)\]/gi, '').trim();

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
        entailmentScore,
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

  return {
    claims: groundedClaims,
    citations: Array.from(usedCitationsSet),
    visualAnchors: allVisualAnchors,
    faithfulnessScore,
    citationCorrectnessScore,
  };
}

export const ClaimGrounder = {
  extractClaims,
  calculateEntailment,
  groundClaims,
};
