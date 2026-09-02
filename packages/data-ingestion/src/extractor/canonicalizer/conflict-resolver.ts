/**
 * 3-Step Historical Conflict Resolution Protocol
 */
export function resolveHistoricalConflict(
  edgeA: { confidence: number; sourceReliability?: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3'; sourceName?: string },
  edgeB: { confidence: number; sourceReliability?: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3'; sourceName?: string }
): { action: 'KEEP_A' | 'KEEP_B' | 'MULTI_PERSPECTIVE'; rationale: string } {
  const wA = edgeA.sourceReliability === 'LEVEL_1' ? 1.0 : edgeA.sourceReliability === 'LEVEL_2' ? 0.8 : 0.5;
  const wB = edgeB.sourceReliability === 'LEVEL_1' ? 1.0 : edgeB.sourceReliability === 'LEVEL_2' ? 0.8 : 0.5;

  const scoreA = edgeA.confidence * wA;
  const scoreB = edgeB.confidence * wB;
  const delta = Math.abs(scoreA - scoreB);

  if ((edgeA.sourceReliability === 'LEVEL_1' && edgeB.sourceReliability === 'LEVEL_1') || delta <= 0.15) {
    return {
      action: 'MULTI_PERSPECTIVE',
      rationale: `Protracted debate threshold met (delta=${delta.toFixed(2)} <= 0.15 or both Level 1). Storing both perspectives.`,
    };
  }

  if (scoreA > scoreB) {
    return { action: 'KEEP_A', rationale: `Edge A score (${scoreA.toFixed(2)}) > Edge B score (${scoreB.toFixed(2)})` };
  } else {
    return { action: 'KEEP_B', rationale: `Edge B score (${scoreB.toFixed(2)}) >= Edge A score (${scoreA.toFixed(2)})` };
  }
}
