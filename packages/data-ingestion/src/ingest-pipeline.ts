import { seedDualBranch } from './seeder/dual-branch-seeder.js';
import { IngestionExecutionTelemetry } from '@chronoviet/shared-spec';

export interface IngestionMetadata {
  title: string;
  source: string;
  dynasty?: string;
  sourceReliability?: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';
  pageNumber?: number;
  correlationId?: string;
}

export interface IngestionResult {
  title: string;
  parentChunksCount: number;
  childChunksCount: number;
  entitiesExtracted: number;
  triplesExtracted: number;
  chunksIngested: number;
  durationMs: number;
  correlationId?: string;
  telemetry?: IngestionExecutionTelemetry;
}

export async function ingestDocument(
  content: string,
  metadata: IngestionMetadata
): Promise<IngestionResult> {
  const seedResult = await seedDualBranch(
    content,
    {
      title: metadata.title,
      sourceName: metadata.source,
      dynasty: metadata.dynasty,
      sourceReliability: metadata.sourceReliability,
      pageNumber: metadata.pageNumber,
    },
    {
      correlationId: metadata.correlationId,
    }
  );

  return {
    title: seedResult.title,
    parentChunksCount: seedResult.parentChunksCount,
    childChunksCount: seedResult.childChunksCount,
    entitiesExtracted: seedResult.entitiesExtracted,
    triplesExtracted: seedResult.triplesExtracted,
    chunksIngested: seedResult.chunksIngested,
    durationMs: seedResult.durationMs,
    correlationId: seedResult.correlationId,
    telemetry: seedResult.telemetry,
  };
}


