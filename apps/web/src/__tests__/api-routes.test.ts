import { describe, it, expect, vi, afterAll } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Queues
vi.mock('../lib/queues', () => ({
  enqueueRenderJob: vi.fn().mockResolvedValue({ jobId: 'mock-job-123' }),
  cancelRenderJob: vi.fn().mockResolvedValue(true),
  getRenderQueue: vi.fn(),
  getRenderJobStatus: vi.fn().mockResolvedValue(null),
}));

// Mock Redis Client
vi.mock('../lib/redis', () => ({
  getRedisClient: vi.fn().mockReturnValue({
    ping: vi.fn().mockResolvedValue('PONG'),
    on: vi.fn(),
  }),
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

// Mock LLM streaming and Redis PubSub in @chronoviet/infra
vi.mock('@chronoviet/infra', async (importOriginal) => {
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
vi.mock('@chronoviet/agent-orchestrator', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    runOrchestratorPipeline: vi.fn().mockResolvedValue({ status: 'COMPLETED' }),
    streamOrchestratorPipeline: vi.fn().mockImplementation(async function* () {
      yield { nodeName: 'rag_init', update: { status: 'RAG_RETRIEVED' } };
      yield { nodeName: 'packager', update: { status: 'COMPLETED' } };
    }),
    handleChatQueryStream: vi.fn().mockImplementation(async function* (req: any) {
      if (req.query?.includes('Nam Hán') || req.query?.includes('error')) {
        yield { type: 'error', error: 'Mô hình AI đang bận hoặc quá tải' };
        return;
      }
      yield { type: 'token', content: 'Trận Bạch Đằng năm 938' };
      yield { type: 'done', content: 'Trận Bạch Đằng năm 938' };
    }),
    resumeOrchestratorPipeline: vi.fn().mockResolvedValue({ status: 'COMPLETED' }),
    defaultCheckpointer: {
      loadLatestProjectState: vi.fn().mockResolvedValue(null),
    },
  };
});

import * as fs from 'fs';
import * as path from 'path';
import { initProjectWorkspace, cleanProjectWorkspace } from '@chronoviet/infra';

import { GET as getProjects, POST as createProject } from '../app/api/v1/projects/route';
import { GET as getProjectDetail } from '../app/api/v1/projects/[id]/route';
import { POST as handleChat } from '../app/api/v1/chat/route';
import { POST as triggerRender } from '../app/api/v1/projects/[id]/render/route';
import { POST as handleAbort } from '../app/api/v1/projects/[id]/abort/route';
import { POST as handleResume } from '../app/api/v1/projects/[id]/resume/route';
import { GET as getConversations, POST as createConversation } from '../app/api/v1/conversations/route';
import { GET as getConversationDetail, DELETE as deleteConversation } from '../app/api/v1/conversations/[id]/route';
import { GET as getMessages, POST as createMessage } from '../app/api/v1/conversations/[id]/messages/route';
import { GET as getStream } from '../app/api/v1/projects/[id]/stream/route';
import { GET as getVideo } from '../app/api/v1/projects/[id]/video/route';
import { GET as getMetrics } from '../app/api/metrics/route';
import { GET as getReadyz } from '../app/api/readyz/route';
import { GET as getHealthz } from '../app/api/healthz/route';
import { middleware } from '../middleware';

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

    it('emits error chunk and fallback when LLM stream encounters an error', async () => {
      const { generateLLMCompletionStream } = await import('@chronoviet/infra');
      vi.mocked(generateLLMCompletionStream).mockImplementationOnce(async function* () {
        throw new Error('Mô hình AI đang bận hoặc quá tải');
      });

      const req = new NextRequest('http://localhost:3000/api/v1/chat', {
        method: 'POST',
        body: JSON.stringify({ query: 'Ngô Quyền đánh quân Nam Hán' }),
      });
      const res = await handleChat(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');

      const reader = res.body?.getReader();
      let streamOutput = '';
      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        streamOutput += new TextDecoder().decode(value);
      }

      expect(streamOutput).toContain('"type":"error"');
      expect(streamOutput).toContain('error');
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

    it('filters out non-project directories lacking metadata.json from project list', async () => {
      const { getDefaultProjectsBaseDir } = await import('@chronoviet/infra');
      const baseDir = getDefaultProjectsBaseDir();
      const dummyTestDir = path.join(baseDir, 'dummy_empty_folder_without_metadata');
      
      try {
        await fs.promises.mkdir(dummyTestDir, { recursive: true });
        const req = new NextRequest('http://localhost:3000/api/v1/projects');
        const res = await getProjects(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        const found = data.items.some((item: any) => item.id === 'dummy_empty_folder_without_metadata');
        expect(found).toBe(false);
      } finally {
        try {
          await fs.promises.rm(dummyTestDir, { recursive: true, force: true });
        } catch {}
      }
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

  describe('GET /api/v1/projects/[id]/stream', () => {
    it('initializes SSE stream and sends events with correlation ID header', async () => {
      const projectId = 'test_proj_stream_001';
      createdProjectIds.push(projectId);
      const req = new NextRequest(`http://localhost:3000/api/v1/projects/${projectId}/stream`, {
        headers: { 'x-request-id': 'test-sse-corr-id' },
      });
      const res = await getStream(req, { params: { id: projectId } });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');
      expect(res.headers.get('x-request-id')).toBe('test-sse-corr-id');

      const reader = res.body?.getReader();
      expect(reader).toBeDefined();
      const { value } = await reader!.read();
      const text = new TextDecoder().decode(value);
      expect(text).toContain('data:');
      expect(text).toContain('test_proj_stream_001');
    });
  });

  describe('GET /api/v1/projects/[id]/video', () => {
    it('returns 404 with correlation ID for non-existent video', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/projects/non_existent_proj/video', {
        headers: { 'x-request-id': 'test-vid-404' },
      });
      const res = await getVideo(req, { params: { id: 'non_existent_proj' } });
      expect(res.status).toBe(404);
      expect(res.headers.get('x-request-id')).toBe('test-vid-404');
    });

    it('returns 200 full video stream and 206 partial content when video file exists', async () => {
      const projectId = 'test_proj_video_001';
      createdProjectIds.push(projectId);
      const paths = initProjectWorkspace(projectId);
      const videoBuffer = Buffer.from('mock-mp4-test-video-stream-bytes-1234567890');
      fs.writeFileSync(path.join(paths.outputDir, 'video.mp4'), videoBuffer);

      // Test full GET (200)
      const fullReq = new NextRequest(`http://localhost:3000/api/v1/projects/${projectId}/video`, {
        headers: { 'x-request-id': 'test-vid-200' },
      });
      const fullRes = await getVideo(fullReq, { params: { id: projectId } });
      expect(fullRes.status).toBe(200);
      expect(fullRes.headers.get('content-type')).toBe('video/mp4');
      expect(fullRes.headers.get('content-length')).toBe(String(videoBuffer.length));
      expect(fullRes.headers.get('x-request-id')).toBe('test-vid-200');

      // Test Range GET (206)
      const rangeReq = new NextRequest(`http://localhost:3000/api/v1/projects/${projectId}/video`, {
        headers: {
          range: 'bytes=0-10',
          'x-request-id': 'test-vid-206',
        },
      });
      const rangeRes = await getVideo(rangeReq, { params: { id: projectId } });
      expect(rangeRes.status).toBe(206);
      expect(rangeRes.headers.get('content-range')).toContain('bytes 0-10/');
      expect(rangeRes.headers.get('content-length')).toBe('11');
      expect(rangeRes.headers.get('x-request-id')).toBe('test-vid-206');

      // Test Invalid Range (416)
      const invalidRangeReq = new NextRequest(`http://localhost:3000/api/v1/projects/${projectId}/video`, {
        headers: {
          range: 'bytes=99999-100000',
          'x-request-id': 'test-vid-416',
        },
      });
      const invalidRangeRes = await getVideo(invalidRangeReq, { params: { id: projectId } });
      expect(invalidRangeRes.status).toBe(416);
      expect(invalidRangeRes.headers.get('x-request-id')).toBe('test-vid-416');
    });
  });

  describe('GET /api/healthz', () => {
    it('returns 200 with service status', async () => {
      const res = await getHealthz();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('ok');
      expect(data.service).toBe('web-app');
    });
  });

  describe('GET /api/readyz', () => {
    it('returns 200 with health checks across 4 primary dependencies', async () => {
      const res = await getReadyz();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBeDefined();
      expect(data.checks).toBeDefined();
      expect(data.checks.redis).toBeDefined();
      expect(data.checks.postgres).toBeDefined();
      expect(data.checks.tts).toBeDefined();
      expect(data.checks.llm).toBeDefined();
    });
  });

  describe('POST /api/v1/projects/:id/resume', () => {
    it('resumes project execution after human review', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/projects/test_proj_resume/resume', {
        method: 'POST',
        body: JSON.stringify({
          approvedScripts: { 0: 'Kịch bản đã được duyệt và hiệu chỉnh.' },
          feedback: 'Đã chuẩn hóa thông tin lịch sử.',
        }),
      });
      const res = await handleResume(req, { params: { id: 'test_proj_resume' } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.projectId).toBe('test_proj_resume');
      expect(data.status).toBe('COMPLETED');
    });
  });

  describe('Conversations & Messages API Routes', () => {
    let convId = '';

    it('creates a new conversation', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/conversations', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Nghiên cứu Chiến dịch Điện Biên Phủ',
          mode: 'RESEARCH',
        }),
      });
      const res = await createConversation(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.conversation).toBeDefined();
      expect(data.conversation.title).toContain('Điện Biên Phủ');
      convId = data.conversation.id;
    });

    it('lists conversations', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/conversations', {
        method: 'GET',
      });
      const res = await getConversations(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.conversations)).toBe(true);
      expect(data.conversations.length).toBeGreaterThan(0);
    });

    it('appends and retrieves conversation messages', async () => {
      const postReq = new NextRequest(`http://localhost:3000/api/v1/conversations/${convId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          role: 'user',
          content: 'Đại tướng Võ Nguyên Giáp chỉ huy chiến dịch thế nào?',
        }),
      });
      const postRes = await createMessage(postReq, { params: { id: convId } });
      expect(postRes.status).toBe(201);

      const getReq = new NextRequest(`http://localhost:3000/api/v1/conversations/${convId}/messages`, {
        method: 'GET',
      });
      const getRes = await getMessages(getReq, { params: { id: convId } });
      expect(getRes.status).toBe(200);
      const data = await getRes.json();
      expect(Array.isArray(data.messages)).toBe(true);
      expect(data.messages.length).toBeGreaterThan(0);
    });

    it('retrieves conversation detail and deletes conversation', async () => {
      const getReq = new NextRequest(`http://localhost:3000/api/v1/conversations/${convId}`, {
        method: 'GET',
      });
      const getRes = await getConversationDetail(getReq, { params: { id: convId } });
      expect(getRes.status).toBe(200);
      const data = await getRes.json();
      expect(data.conversation.id).toBe(convId);

      const delReq = new NextRequest(`http://localhost:3000/api/v1/conversations/${convId}`, {
        method: 'DELETE',
      });
      const delRes = await deleteConversation(delReq, { params: { id: convId } });
      expect(delRes.status).toBe(200);

      const getAfterDel = await getConversationDetail(getReq, { params: { id: convId } });
      expect(getAfterDel.status).toBe(404);
    });
  });

  describe('GET /api/metrics', () => {
    it('returns Prometheus metrics snapshot containing chronoviet metrics', async () => {
      const res = await getMetrics();
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/plain');
      const text = await res.text();
      expect(text).toContain('chronoviet_http_requests_total');
      expect(text).toContain('chronoviet_http_request_duration_seconds');
    });
  });

  describe('Middleware Distributed Tracing & Correlation Header Propagation', () => {
    it('propagates W3C traceparent and x-correlation-id to downstream request and response', () => {
      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
      const correlationId = 'corr-trace-123';
      const req = new NextRequest('http://localhost:3000/api/v1/projects', {
        headers: {
          traceparent,
          'x-correlation-id': correlationId,
        },
      });
      const res = middleware(req);
      expect(res.headers.get('traceparent')).toBe(traceparent);
      expect(res.headers.get('x-correlation-id')).toBe(correlationId);
      expect(res.headers.get('x-request-id')).toBe(correlationId);
    });

    it('derives requestId from traceparent when x-request-id and x-correlation-id are absent', () => {
      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
      const req = new NextRequest('http://localhost:3000/api/v1/projects', {
        headers: {
          traceparent,
        },
      });
      const res = middleware(req);
      expect(res.headers.get('traceparent')).toBe(traceparent);
      expect(res.headers.get('x-request-id')).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    });
  });
});
