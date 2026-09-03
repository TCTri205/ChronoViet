import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { IngestionManifest } from '../cache/ingestion-manifest.js';

describe('IngestionManifest Checkpoint Tracker', () => {
  let tempDir: string;
  let manifestFile: string;
  let testDocFile: string;
  let manifest: IngestionManifest;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-manifest-'));
    manifestFile = path.join(tempDir, 'ingestion_manifest.json');
    testDocFile = path.join(tempDir, 'doc1.md');
    await fs.writeFile(testDocFile, '# Test Document\n\nContent here.');
    manifest = new IngestionManifest(manifestFile);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should return false for unrecorded documents', async () => {
    const isDone = await manifest.isDocumentCompleted('doc1', testDocFile, 'all', false);
    expect(isDone).toBe(false);
  });

  it('should record document completion and return true when file is unchanged', async () => {
    const stat = await fs.stat(testDocFile);
    await manifest.recordDocumentCompleted({
      sourceName: 'doc1',
      title: 'Doc 1',
      filePath: testDocFile,
      fileMtimeMs: Math.floor(stat.mtimeMs),
      chunksCount: 10,
      stage: 'all',
      completedAt: new Date().toISOString(),
    });

    const isDone = await manifest.isDocumentCompleted('doc1', testDocFile, 'all', false);
    expect(isDone).toBe(true);
    expect(await manifest.getCompletedCount()).toBe(1);
  });

  it('should invalidate checkpoint if the document file was modified', async () => {
    const stat = await fs.stat(testDocFile);
    await manifest.recordDocumentCompleted({
      sourceName: 'doc1',
      title: 'Doc 1',
      filePath: testDocFile,
      fileMtimeMs: Math.floor(stat.mtimeMs) - 5000, // simulate older checkpoint
      chunksCount: 10,
      stage: 'all',
      completedAt: new Date().toISOString(),
    });

    const isDone = await manifest.isDocumentCompleted('doc1', testDocFile, 'all', false);
    expect(isDone).toBe(false);
  });

  it('should reject vector-only checkpoint if full stage is requested', async () => {
    const stat = await fs.stat(testDocFile);
    await manifest.recordDocumentCompleted({
      sourceName: 'doc1',
      title: 'Doc 1',
      filePath: testDocFile,
      fileMtimeMs: Math.floor(stat.mtimeMs),
      chunksCount: 10,
      stage: 'vector',
      completedAt: new Date().toISOString(),
    });

    const isVectorDone = await manifest.isDocumentCompleted('doc1', testDocFile, 'vector', false);
    expect(isVectorDone).toBe(true);

    const isAllDone = await manifest.isDocumentCompleted('doc1', testDocFile, 'all', false);
    expect(isAllDone).toBe(false);
  });

  it('should clear manifest on clear()', async () => {
    const stat = await fs.stat(testDocFile);
    await manifest.recordDocumentCompleted({
      sourceName: 'doc1',
      title: 'Doc 1',
      filePath: testDocFile,
      fileMtimeMs: Math.floor(stat.mtimeMs),
      chunksCount: 10,
      stage: 'all',
      completedAt: new Date().toISOString(),
    });

    expect(await manifest.getCompletedCount()).toBe(1);
    await manifest.clear();
    expect(await manifest.getCompletedCount()).toBe(0);
  });
});
