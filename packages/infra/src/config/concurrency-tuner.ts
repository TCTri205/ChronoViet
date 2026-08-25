/**
 * Adaptive Concurrency & Hardware-Aware Batch Tuner
 * Dynamically computes safe batch/concurrency limits for TTS, VLM, and Image Crawling
 * based on Host RAM (Apple Silicon Unified Memory / Linux RAM), CPU cores, and Inference Routing Mode.
 */

import * as os from 'os';
import { envConfig } from '../config.js';
import { createLogger } from '../logger.js';

const log = createLogger({ service: 'infra-concurrency-tuner' });

export type ConcurrencySubsystem = 'TTS' | 'VLM' | 'CRAWL';

let customTotalMemoryBytes: number | null = null;
let customRoutingMode: 'cloud' | 'local' | null = null;

/**
 * Set custom mock total memory for deterministic unit testing.
 */
export function setCustomMemoryForTesting(bytes: number | null): void {
  customTotalMemoryBytes = bytes;
}

/**
 * Set custom mock routing mode for deterministic unit testing.
 */
export function setCustomRoutingModeForTesting(mode: 'cloud' | 'local' | null): void {
  customRoutingMode = mode;
}

export function resetConcurrencyTunerForTesting(): void {
  customTotalMemoryBytes = null;
  customRoutingMode = null;
}

/**
 * Calculate dynamic, hardware-safe batch concurrency for the requested subsystem.
 */
export function getAdaptiveConcurrency(subsystem: ConcurrencySubsystem): number {
  const routingMode = customRoutingMode ?? envConfig.INFERENCE_ROUTING_MODE ?? 'local';
  const totalBytes = customTotalMemoryBytes ?? os.totalmem();
  const totalGb = totalBytes / (1024 * 1024 * 1024);

  // 1. Cloud-routed mode: Network I/O bound -> Higher concurrency
  if (routingMode === 'cloud') {
    switch (subsystem) {
      case 'CRAWL':
        return 8;
      case 'TTS':
        return 6;
      case 'VLM':
        return 6;
      default:
        return 4;
    }
  }

  // 2. Local-routed mode: Hardware/Memory bound -> Scaled by Unified Memory / RAM
  if (totalGb < 16) {
    // Low RAM (< 16GB, e.g. 8GB M1/M2 or budget VM): Strict throttle to avoid OOM
    switch (subsystem) {
      case 'TTS':
        return 1;
      case 'VLM':
        return 1;
      case 'CRAWL':
        return 2;
      default:
        return 1;
    }
  } else if (totalGb < 32) {
    // Mid RAM (16GB - 31GB, e.g. 16GB / 24GB Mac): Moderate batching
    switch (subsystem) {
      case 'TTS':
        return 2;
      case 'VLM':
        return 2;
      case 'CRAWL':
        return 4;
      default:
        return 2;
    }
  } else {
    // High RAM (>= 32GB, e.g. 32GB/64GB+ Mac Studio / Pro): Full safe batching
    switch (subsystem) {
      case 'TTS':
        return 4;
      case 'VLM':
        return 4;
      case 'CRAWL':
        return 6;
      default:
        return 4;
    }
  }
}
