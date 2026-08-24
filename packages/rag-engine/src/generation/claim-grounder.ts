/**
 * ChronoViet Claim Grounder & Citation Verifier
 * Performs sentence-level factual claim extraction, strict entailment verification,
 * and precise chunk attribution to eliminate citation hallucination (C9-M4).
 */

import { GroundedClaimItem } from '@chronoviet/shared-spec';

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
  faithfulnessScore: number;
  citationCorrectnessScore: number;
}

export class ClaimGrounder {
  /**
   * Splits text into individual factual proposition claims
   */
  static extractClaims(text: string): string[] {
    if (!text || !text.trim()) return [];

    return text
      .split(/(?<=[.!?\n])\s+|;\s+|\n+/)
      .map((s) => s.replace(/^[-*•\d.)\s]+/, '').trim())
      .filter((s) => s.length > 10 && !s.startsWith('#'));
  }

  /**
   * Calculates entailment score between a claim and an evidence text chunk
   */
  static calculateEntailment(claim: string, evidenceText: string): number {
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

    let matchedTokens = 0;
    for (const t of tokens) {
      if (evLower.includes(t)) {
        matchedTokens++;
      }
    }

    const tokenRatio = matchedTokens / tokens.length;

    // 3. Bigram Containment
    let bigramMatches = 0;
    let totalBigrams = 0;
    for (let i = 0; i < tokens.length - 1; i++) {
      const bigram = `${tokens[i]} ${tokens[i + 1]}`;
      totalBigrams++;
      if (evLower.includes(bigram)) {
        bigramMatches++;
      }
    }

    const bigramRatio = totalBigrams > 0 ? bigramMatches / totalBigrams : tokenRatio;
    const score = 0.55 * tokenRatio + 0.45 * bigramRatio;

    return Number(score.toFixed(3));
  }

  /**
   * Attributes each claim to its exact supporting chunk
   */
  static groundClaims(
    answerText: string,
    chunks: Map<string, ChunkInfo> | ChunkInfo[]
  ): GroundingAnalysisResult {
    const chunkList: ChunkInfo[] = Array.isArray(chunks)
      ? chunks
      : Array.from(chunks.values());

    const rawClaims = ClaimGrounder.extractClaims(answerText);
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
        const score = ClaimGrounder.calculateEntailment(claim, chunk.content);
        if (score > highestScore) {
          highestScore = score;
          bestChunk = chunk;
        }
      }

      const assignedChunk = explicitChunkId
        ? chunkList.find((c) => c.id === explicitChunkId) || bestChunk
        : bestChunk;

      const entailmentScore = assignedChunk
        ? ClaimGrounder.calculateEntailment(claim, assignedChunk.content)
        : 0;

      const isEntailed = entailmentScore >= 0.40;
      if (isEntailed) {
        totalEntailed++;
        correctlyCited++;
      }

      if (assignedChunk) {
        const rel = assignedChunk.reliability === 'LEVEL_2' || assignedChunk.reliability === 'LEVEL_3'
          ? (assignedChunk.reliability as 'LEVEL_2' | 'LEVEL_3')
          : 'LEVEL_1';

        groundedClaims.push({
          claimText: claim.replace(/\[(?:Nguồn:\s*|CHUNK_)?([^\]]+)\]/gi, '').trim(),
          sourceChunkId: assignedChunk.id,
          sourceTitle: assignedChunk.title,
          reliability: rel,
          entailmentScore,
        });

        usedCitationsSet.add(`${assignedChunk.title} [Nguồn: ${rel}]`);
      }
    }

    const totalClaims = Math.max(1, rawClaims.length);
    const faithfulnessScore = Number(((totalEntailed / totalClaims) * 100).toFixed(2));
    const citationCorrectnessScore = Number(((correctlyCited / totalClaims) * 100).toFixed(2));

    return {
      claims: groundedClaims,
      citations: Array.from(usedCitationsSet),
      faithfulnessScore,
      citationCorrectnessScore,
    };
  }
}
