/**
 * Remotion CLI Stdout Progress Parser
 * Extracts frame progress, percentage and ETA from Remotion CLI output lines.
 */

export interface ParsedRemotionProgress {
  currentFrame?: number;
  totalFrames?: number;
  progressPercent: number;
  estimatedRemainingSec?: number;
}

/**
 * Parses a single chunk or line from Remotion CLI stdout/stderr.
 */
export function parseRemotionStdoutLine(line: string, knownTotalFrames?: number): ParsedRemotionProgress | null {
  if (!line || typeof line !== 'string') return null;

  // Pattern 1: "Rendered 150/1000", "[150/1000]", or "frame: 150/1000"
  const fractionMatch = line.match(/(?:\[|\bframe\s*[:=]?\s*|\bRendered\s*)(\d+)\s*\/\s*(\d+)/i);
  if (fractionMatch) {
    const currentFrame = parseInt(fractionMatch[1], 10);
    const totalFrames = parseInt(fractionMatch[2], 10);
    if (!isNaN(currentFrame) && !isNaN(totalFrames) && totalFrames > 0) {
      return {
        currentFrame,
        totalFrames,
        progressPercent: Math.min(100, Math.max(0, Math.round((currentFrame / totalFrames) * 1000) / 10)),
      };
    }
  }

  // Pattern 3: "NN%" or "NN.N%"
  const percentMatch = line.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percentMatch) {
    const progressPercent = parseFloat(percentMatch[1]);
    if (!isNaN(progressPercent) && progressPercent >= 0 && progressPercent <= 100) {
      const currentFrame = knownTotalFrames ? Math.round((progressPercent / 100) * knownTotalFrames) : undefined;
      return {
        currentFrame,
        totalFrames: knownTotalFrames,
        progressPercent,
      };
    }
  }

  return null;
}
