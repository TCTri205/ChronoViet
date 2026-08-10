export interface VLMScoreResult {
  historicalContextScore: number; // 0-40
  visualNoiseScore: number;       // 0-30
  artisticFitScore: number;        // 0-30
  totalScore: number;              // 0-100
  passed: boolean;                 // totalScore >= 60
  reasons: string[];
}

export async function getCachedVLMScore(_imageSha256: string): Promise<VLMScoreResult | null> {
  // Dual-layer Redis Cache stub (SHA-256 + pHash)
  return null;
}
