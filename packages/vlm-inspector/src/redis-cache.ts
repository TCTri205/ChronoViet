export interface VLMScoreResult {
  historicalContextScore: number;
  visualNoiseScore: number;
  artisticFitScore: number;
  totalScore: number;
  passed: boolean;
  reasons: string[];
}

export async function getCachedVLMScore(_imageSha256: string): Promise<VLMScoreResult | null> {
  // Dual-layer Redis Cache stub (SHA-256 + pHash)
  return null;
}
