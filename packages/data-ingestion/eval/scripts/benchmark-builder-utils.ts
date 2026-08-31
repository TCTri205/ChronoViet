import path from 'path';

export const evalDir = typeof __dirname !== 'undefined'
  ? path.resolve(__dirname, '..')
  : path.resolve(process.cwd(), 'packages/data-ingestion/eval');

export const datasetsDir = path.resolve(evalDir, 'datasets');

export const VALID_RELATIONS = new Set([
  'PART_OF',
  'LED_BY',
  'HAPPENED_IN',
  'HAPPENED_AT',
  'SAME_AS_LOCATION',
  'ALIAS_OF',
  'ROYAL_LINEAGE',
  'MENTIONED_IN',
]);

export const VALID_TYPES = new Set([
  'HISTORICAL_PERSON',
  'LOCATION',
  'EVENT_BATTLE',
  'DYNASTY_ERA',
  'ORGANIZATION',
  'ARTIFACT',
  'DOCUMENT_CULTURE',
]);

export interface EntityInput {
  id: string;
  name: string;
  type: string;
  aliases?: string[];
}

export interface TripleInput {
  sourceEntityId: string;
  relationType: string;
  targetEntityId: string;
  confidence?: number;
}

export interface SnippetInput {
  id: string;
  epochId: string;
  sourceText: string;
  entities: EntityInput[];
  triples: TripleInput[];
  notes?: string;
}

export function buildSnippet(input: SnippetInput) {
  const text = input.sourceText;
  const gtEntities = input.entities.map((e) => {
    if (!VALID_TYPES.has(e.type)) {
      throw new Error(`[${input.id}] Invalid entity type: ${e.type} for entity ${e.name}`);
    }
    const idx = text.indexOf(e.name);
    if (idx === -1) {
      throw new Error(`[${input.id}] Entity name "${e.name}" not found in text: "${text}"`);
    }
    return {
      id: e.id,
      name: e.name,
      type: e.type,
      aliases: e.aliases || [],
      startOffset: idx,
      endOffset: idx + e.name.length,
    };
  });

  const gtTriples = input.triples.map((t) => {
    if (!VALID_RELATIONS.has(t.relationType)) {
      throw new Error(`[${input.id}] Invalid relation: ${t.relationType}`);
    }
    return {
      sourceEntityId: t.sourceEntityId,
      relationType: t.relationType,
      targetEntityId: t.targetEntityId,
      isDirectional: true,
      confidence: t.confidence ?? 1.0,
    };
  });

  return {
    id: input.id,
    epochId: input.epochId,
    sourceText: input.sourceText,
    groundTruthEntities: gtEntities,
    groundTruthTriples: gtTriples,
    notes: input.notes,
  };
}

export function countWords(str: string): number {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

export interface ChunkInput {
  id: string;
  epochId: string;
  sourceDocument: string;
  dynasty: string;
  sectionTitle: string;
  evaluationFocus: string;
  banner: string;
  rawText: string;
  wordCount?: number;
  entities: EntityInput[];
  triples: Array<{
    subjectId: string;
    subjectName: string;
    relationType: string;
    objectId: string;
    objectName: string;
  }>;
}

export function buildChunk(input: ChunkInput) {
  const wordCount = countWords(input.rawText);
  const fullText = `${input.banner}\n\n${input.rawText}`;
  input.entities.forEach((e) => {
    if (!fullText.includes(e.name)) {
      throw new Error(`[${input.id}] Entity "${e.name}" not found in text content!`);
    }
  });

  return {
    id: input.id,
    epochId: input.epochId,
    sourceDocument: input.sourceDocument,
    dynasty: input.dynasty,
    sectionTitle: input.sectionTitle,
    wordCount,
    evaluationFocus: input.evaluationFocus,
    banner: input.banner,
    rawText: input.rawText,
    groundTruthEntities: input.entities.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      aliases: e.aliases || [],
    })),
    groundTruthTriples: input.triples.map((t) => ({
      subjectId: t.subjectId,
      subjectName: t.subjectName,
      relationType: t.relationType,
      objectId: t.objectId,
      objectName: t.objectName,
    })),
    textContent: fullText,
  };
}
