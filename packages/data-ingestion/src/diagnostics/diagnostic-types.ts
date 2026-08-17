export type DiagnosticIssueType =
  | 'UNMAPPED_ENTITY'
  | 'GENERIC_OR_HALLUCINATED_ENTITY'
  | 'LOW_CONFIDENCE_RELATION'
  | 'TEMPORAL_SPATIAL_MISSING'
  | 'DANGLING_RELATIONSHIP';

export interface IngestDiagnosticIssue {
  type: DiagnosticIssueType;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  document: string;
  chunkId?: string;
  details: string;
  recommendation: string;
  metadata?: Record<string, unknown>;
}

export interface IngestDiagnosticReport {
  timestamp: string;
  totalDocumentsScanned: number;
  totalChunksCreated: number;
  totalTriplesExtracted: number;
  highConfidenceTriplesCount: number;
  quarantinedTriplesCount: number;
  unmappedEntitiesCount: number;
  issuesSummary: Record<DiagnosticIssueType, number>;
  actionableRecommendations: string[];
  issues: IngestDiagnosticIssue[];
}
