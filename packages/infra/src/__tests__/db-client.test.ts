import { describe, it, expect, beforeEach } from 'vitest';
import { inMemoryStore, ensureConversationExists, logEntityAuditAction } from '../db/client.js';

describe('InMemoryRagStore FIFO Bounded Eviction (Phase 4 SSOT)', () => {
  beforeEach(() => {
    inMemoryStore.clear();
  });

  it('should enforce MAX_CONVERSATIONS FIFO eviction when capacity is exceeded', async () => {
    // Add 250 conversations
    for (let i = 0; i < 250; i++) {
      await ensureConversationExists(`conv_${i}`, `Conversation ${i}`);
    }

    expect(inMemoryStore.conversations.size).toBeLessThanOrEqual(200);
    // Oldest conversations (0-49) should be evicted
    expect(inMemoryStore.conversations.has('conv_0')).toBe(false);
    expect(inMemoryStore.conversations.has('conv_49')).toBe(false);
    // Recent conversations (50-249) should be present
    expect(inMemoryStore.conversations.has('conv_249')).toBe(true);
    expect(inMemoryStore.conversations.has('conv_200')).toBe(true);
  });

  it('should enforce MAX_MESSAGES FIFO eviction when capacity is exceeded', () => {
    for (let i = 0; i < 2500; i++) {
      inMemoryStore.addMessage({ id: `msg_${i}`, text: `Message ${i}` });
    }

    expect(inMemoryStore.conversationMessages.length).toBe(2000);
    expect(inMemoryStore.conversationMessages[0].id).toBe('msg_500');
    expect(inMemoryStore.conversationMessages[1999].id).toBe('msg_2499');
  });

  it('should enforce MAX_AUDIT_LOGS FIFO eviction when capacity is exceeded', async () => {
    for (let i = 0; i < 1200; i++) {
      await logEntityAuditAction({
        entity_id: `entity_${i}`,
        action_type: 'ALIAS_UPDATE',
        rationale: `Audit ${i}`,
      });
    }

    expect(inMemoryStore.auditLogs.length).toBe(1000);
    expect(inMemoryStore.auditLogs[0].entity_id).toBe('entity_200');
    expect(inMemoryStore.auditLogs[999].entity_id).toBe('entity_1199');
  });

  it('should enforce MAX_QUARANTINE FIFO eviction when capacity is exceeded', () => {
    for (let i = 0; i < 600; i++) {
      inMemoryStore.addQuarantineTriple({
        id: i + 1,
        source_name: `Source ${i}`,
        target_name: `Target ${i}`,
        confidence: 0.5,
        reason: 'LOW_CONFIDENCE',
      });
    }

    expect(inMemoryStore.quarantineTriples.length).toBe(500);
    expect(inMemoryStore.quarantineTriples[0].id).toBe(101);
    expect(inMemoryStore.quarantineTriples[499].id).toBe(600);
  });
});
