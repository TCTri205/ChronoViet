/**
 * Internal Data Types for Ingestion ETL Engine
 */

import { SourceReliability } from '@chronoviet/shared-spec';

export interface RawDocumentInput {
  id: string;
  content: string;
  title: string;
  sourceName: string;
  sourceReliability: SourceReliability;
  format: 'pdf' | 'txt' | 'md' | 'json' | 'scanned_pdf';
  filePath?: string;
  pageCount?: number;
  dynasty?: string;
  timeStart?: number;
  timeEnd?: number;
}

export interface OcrPageStructure {
  pageNumber: number;
  header?: string;
  footer?: string;
  headings: string[];
  textContent: string;
  tables?: string[];
  images?: string[];
}

export interface ChunkingOutput {
  parentChunks: Array<{
    chunkId: string;
    content: string;
    wordCount: number;
    metadata: Record<string, unknown>;
  }>;
  childChunks: Array<{
    chunkId: string;
    parentChunkId: string;
    content: string;
    wordCount: number;
    metadata: Record<string, unknown>;
  }>;
}

export interface DualBranchPayload {
  chunks: Array<{
    chunkId: string;
    parentChunkId?: string;
    content: string;
    embedding?: number[];
    sparseVector?: Record<string, number>;
    metadata: Record<string, unknown>;
  }>;
  entities: Array<{
    id: string;
    name: string;
    type: string;
    aliases: string[];
  }>;
  relationships: Array<{
    source: string;
    target: string;
    relationType: string;
    confidence: number;
  }>;
  entityChunks: Array<{
    entityId: string;
    chunkId: string;
  }>;
}

export interface IngestBenchmarkMetrics {
  totalDocuments: number;
  totalParentChunks: number;
  totalChildChunks: number;
  totalEntities: number;
  totalRelationships: number;
  ingestionTimeMs: number;
  throughputDocsPerSec: number;
  licenseAuditPassedCount?: number;
  licenseAuditFailedCount?: number;
}
