export interface GraphTriple {
  sourceEntity: string;
  relationType: string;
  targetEntity: string;
  hopCount: number;
}

export async function searchLocalGraphCTE(
  _entityId: string,
  _maxHops: number = 2
): Promise<GraphTriple[]> {
  // Stub implementation for PostgreSQL Recursive CTE k-hop search
  return [];
}
