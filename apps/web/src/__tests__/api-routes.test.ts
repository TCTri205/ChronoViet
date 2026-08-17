import { describe, it, expect, vi, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { cleanProjectWorkspace } from '@chronoviet/shared-spec';

// Mock Queues
vi.mock('../lib/queues', () => ({
  enqueueRenderJob: vi.fn().mockResolvedValue({ jobId: 'mock-job-123' }),
  cancelRenderJob: vi.fn().mockResolvedValue(true),
  getRenderQueue: vi.fn(),
  getRenderJobStatus: vi.fn().mockResolvedValue(null),
}));

// Mock RAG Engine
vi.mock('@chronoviet/rag-engine', () => {
  return {
    ChronoRagEngine: vi.fn().mockImplementation(() => ({
      search: vi.fn().mockResolvedValue({
        verifiedContext: [
          {
            entityId: 'e_ngo_quyen',
            canonicalName: 'Ngô Quyền',
            aliases: ['Tiền Ngô Vương'],
            summary: 'Ngô Quyền lãnh đạo quân dân Đại Việt đánh tan quân Nam Hán năm 938.',
            citations: ['Đại Việt Sử Ký Toàn Thư'],
            confidenceScore: 0.95,
          },
        ],
        aliasTable: {},
        citations: ['Đại Việt Sử Ký Toàn Thư'],
        retrievalLatencyMs: 5,
      }),
    })),
  };
});

// Mock LLM streaming and Redis PubSub in shared-spec
vi.mock('@chronoviet/shared-spec', async (importOriginal) => {
  const original = await importOriginal<any>();
  return {
    ...original,
    RedisPubSubManager: vi.fn().mockImplementation(() => ({
      publishRenderEvent: vi.fn().mockResolvedValue(1),
      subscribeToProject: vi.fn().mockResolvedValue(async () => {}),
      close: vi.fn().mockResolvedValue(undefined),
    })),
    generateLLMCompletionStream: vi.fn().mockImplementation(async function* () {
      yield 'Trận ';
      yield 'Bạch Đằng ';
      yield 'năm 938';
    }),
  };
});

// Mock Agent Orchestrator pipeline
vi.mock('@chronoviet/agent-orchestrator', () => ({
  runOrchestratorPipeline: vi.fn().mockResolvedValue({ status: 'COMPLETED' }),
  streamOrchestratorPipeline: vi.fn().mockImplementation(async function* () {
    yield { nodeName: 'rag_init', update: { status: 'RAG_RETRIEVED' } };
    yield { nodeName: 'packager', update: { status: 'COMPLETED' } };
  }),
  defaultCheckpointer: {
    loadLatestProjectState: vi.fn().mockResolvedValue(null),
  },
}));

import { GET as getProjects, POST as createProject } from '../app/api/v1/projects/route';
import { GET as getProjectDetail } from '../app/api/v1/projects/[id]/route';
import { POST as handleChat } from '../app/api/v1/chat/route';
import { POST as triggerRender } from '../app/api/v1/projects/[id]/render/route';
import { POST as handleAbort } from '../app/api/v1/projects/[id]/abort/route';

describe('Web RESTful API Routes', () => {
  describe('POST /api/v1/chat', () => {
    it('returns 400 when query is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/chat', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const res = await handleChat(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('streams response chunks for valid query', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/chat', {
        method: 'POST',
        body: JSON.stringify({ query: 'Trận Bạch Đằng năm 938' }),
      });
      const res = await handleChat(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');

      const reader = res.body?.getReader();
      expect(reader).toBeDefined();
      const { value } = await reader!.read();
      const text = new TextDecoder().decode(value);
      expect(text).toContain('data:');
    });
  });

  const createdProjectIds: string[] = [];

  afterAll(() => {
    for (const pid of createdProjectIds) {
      try {
        cleanProjectWorkspace(pid);
      } catch {}
    }
  });

  describe('POST & GET /api/v1/projects', () => {
    it('returns 400 when topic is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/projects', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const res = await createProject(req);
      expect(res.status).toBe(400);
    });

    it('creates project workspace and returns 201', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/projects', {
        method: 'POST',
        body: JSON.stringify({
          topic: 'Chiến thắng Bạch Đằng',
          targetDurationMinutes: 1,
          videoType: 'BATTLE',
          templateId: 'HISTORICAL_DOCUMENTARY',
        }),
      });
      const res = await createProject(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.projectId).toMatch(/^proj_/);
      expect(data.status).toBe('INIT');
      createdProjectIds.push(data.projectId);
    });

    it('lists project summaries on GET', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/projects');
      const res = await getProjects(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.items)).toBe(true);
      expect(typeof data.total).toBe('number');
      expect(Array.isArray(data.projects)).toBe(true);
    });
  });

  describe('GET /api/v1/projects/[id]', () => {
    it('returns 404 for non-existent project', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/projects/definitely_non_existent_project_99999');
      const res = await getProjectDetail(req, { params: { id: 'definitely_non_existent_project_99999' } });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/projects/[id]/render', () => {
    it('returns 400 if schema is not found', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/projects/definitely_non_existent_project_99999/render', {
        method: 'POST',
        body: JSON.stringify({ outputFormat: 'mp4' }),
      });
      const res = await triggerRender(req, { params: { id: 'definitely_non_existent_project_99999' } });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/projects/[id]/abort', () => {
    it('aborts active project and returns 200 with status ABORTED', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/projects/test_proj_abort_123/abort', {
        method: 'POST',
      });
      const res = await handleAbort(req, { params: { id: 'test_proj_abort_123' } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('ABORTED');
      expect(data.projectId).toBe('test_proj_abort_123');
      createdProjectIds.push('test_proj_abort_123');
    });
  });
});
