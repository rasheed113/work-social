import {
  AiContextError,
  buildAiContext,
  DEFAULT_MAX_CONTEXT_CHARACTERS,
  MAX_CONTEXT_CHARACTERS,
  MAX_CURRENT_REQUEST_CHARACTERS,
  type AiContextOptions,
} from './contextBuilder';
import type { AiConversation } from '../history/contracts';
import type { AiMemory } from '../history/memoryContracts';

let passed = 0;

async function test(name: string, run: () => Promise<void> | void): Promise<void> {
  try {
    await run();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

const options = (overrides: Partial<AiContextOptions> = {}): AiContextOptions => ({
  maxCharacters: DEFAULT_MAX_CONTEXT_CHARACTERS,
  maxMessages: 16,
  includeSummary: true,
  ...overrides,
});

function conversation(overrides: Partial<AiConversation> = {}): AiConversation {
  return {
    id: 'conversation-1',
    title: null,
    summary: null,
    createdAt: '2026-09-02T18:00:00.000Z',
    updatedAt: '2026-09-02T18:01:00.000Z',
    messages: [],
    ...overrides,
  };
}

function historyMessage(id: string, content: string, role: 'user' | 'assistant' | 'system' = 'user') {
  return { id, role, content, createdAt: '2026-09-02T18:00:00.000Z' } as const;
}

function memory(id: string, key: string, value: string): AiMemory {
  return { id, key, value, createdAt: '2026-09-02T18:00:00.000Z', updatedAt: '2026-09-02T18:01:00.000Z' };
}

async function main(): Promise<void> {
  await test('empty conversation keeps current request', () => {
    const result = buildAiContext(conversation(), { conversationId: 'conversation-1', id: 'request-1', content: 'hello' }, options());
    if (result.messages.length !== 1 || result.messages[0].role !== 'user' || result.messages[0].content !== 'hello') throw new Error('Current request was not preserved.');
    if (result.includedMessageCount !== 1 || result.truncated) throw new Error('Empty context metadata is incorrect.');
  });

  await test('single user history message is included', () => {
    const result = buildAiContext(conversation({ messages: [historyMessage('m1', 'previous')] }), { conversationId: 'conversation-1', id: 'request-1', content: 'current' }, options());
    if (result.messages.map((item) => item.content).join('|') !== 'previous|current') throw new Error('Single history message was not ordered before the request.');
  });

  await test('recent messages preserve chronological order', () => {
    const result = buildAiContext(conversation({ messages: [historyMessage('m1', 'one'), historyMessage('m2', 'two'), historyMessage('m3', 'three')] }), { conversationId: 'conversation-1', id: 'request-1', content: 'current' }, options());
    if (result.messages.map((item) => item.content).join('|') !== 'one|two|three|current') throw new Error('Recent message ordering is incorrect.');
  });

  await test('newest messages are prioritized when the budget is exceeded', () => {
    const result = buildAiContext(conversation({ messages: [historyMessage('m1', 'aaaaaa'), historyMessage('m2', 'bbbbbb'), historyMessage('m3', 'cccccc')] }), { conversationId: 'conversation-1', id: 'request-1', content: 'request' }, options({ maxCharacters: 20 }));
    if (result.messages.map((item) => item.content).join('|') !== 'bbbbbb|cccccc|request') throw new Error('Newest-message priority is incorrect.');
    if (!result.truncated) throw new Error('Truncation was not reported.');
  });

  await test('old messages are removed while newest fitting messages remain', () => {
    const result = buildAiContext(conversation({ messages: [historyMessage('m1', 'old'), historyMessage('m2', 'new')] }), { conversationId: 'conversation-1', id: 'request-1', content: 'request' }, options({ maxCharacters: 11 }));
    if (result.messages.map((item) => item.content).join('|') !== 'new|request') throw new Error('Old message was not removed.');
  });

  await test('current request is preserved even when it exceeds the context budget', () => {
    const result = buildAiContext(conversation({ messages: [historyMessage('m1', 'history')] }), { conversationId: 'conversation-1', id: 'request-1', content: 'request-long' }, options({ maxCharacters: 5 }));
    if (result.messages.at(-1)?.content !== 'request-long') throw new Error('Current request was dropped.');
    if (!result.truncated || result.estimatedCharacters !== 'request-long'.length) throw new Error('Oversized-request context metadata is incorrect.');
  });

  await test('current request above the independent request limit fails structurally', () => {
    try {
      buildAiContext(conversation(), { conversationId: 'conversation-1', id: 'request-1', content: 'x'.repeat(MAX_CURRENT_REQUEST_CHARACTERS + 1) }, options());
      throw new Error('Expected CONTEXT_TOO_LARGE.');
    } catch (error) {
      if (!(error instanceof AiContextError) || error.code !== 'CONTEXT_TOO_LARGE') throw error;
    }
  });

  await test('summary is included when space permits', () => {
    const result = buildAiContext(conversation({ summary: 'compact summary' }), { conversationId: 'conversation-1', id: 'request-1', content: 'request' }, options({ maxCharacters: 100 }));
    if (result.summary !== 'compact summary' || result.messages[0]?.role !== 'system' || !result.messages[0]?.content.startsWith('Conversation summary:')) throw new Error('Summary was not included.');
  });

  await test('summary is omitted when insufficient space remains', () => {
    const result = buildAiContext(conversation({ summary: 'compact summary' }), { conversationId: 'conversation-1', id: 'request-1', content: 'request' }, options({ maxCharacters: 'request'.length }));
    if (result.summary !== null || result.messages.length !== 1 || !result.truncated) throw new Error('Summary overflow policy is incorrect.');
  });

  await test('maximum message count is enforced', () => {
    const result = buildAiContext(conversation({ summary: 'summary', messages: [historyMessage('m1', 'one'), historyMessage('m2', 'two')] }), { conversationId: 'conversation-1', id: 'request-1', content: 'request' }, options({ maxMessages: 2, maxCharacters: 100 }));
    if (result.messages.length !== 2 || result.messages.at(-1)?.content !== 'request' || !result.truncated) throw new Error('Maximum message count was not enforced.');
  });

  await test('character estimate equals returned message content length', () => {
    const result = buildAiContext(conversation({ summary: 'sum', messages: [historyMessage('m1', 'hello')] }), { conversationId: 'conversation-1', id: 'request-1', content: 'request' }, options({ maxCharacters: 100 }));
    const expected = result.messages.reduce((total, item) => total + item.content.length, 0);
    if (result.estimatedCharacters !== expected) throw new Error('Character estimate is incorrect.');
  });

  await test('same inputs produce identical output', () => {
    const input = conversation({ summary: 'sum', messages: [historyMessage('m1', 'one'), historyMessage('m2', 'two')] });
    const request = { conversationId: 'conversation-1', id: 'request-1', content: 'request' };
    const first = buildAiContext(input, request, options({ maxCharacters: 60 }));
    const second = buildAiContext(input, request, options({ maxCharacters: 60 }));
    if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('Context construction is not deterministic.');
  });

  await test('explicitly selected memory is included', () => {
    const result = buildAiContext(conversation(), { conversationId: 'conversation-1', id: 'request-1', content: 'hello' }, options({ maxCharacters: 100, memoryIds: ['mem-1'] }), [memory('mem-1', 'preferred_language', 'English')]);
    const item = result.messages.find((candidate) => candidate.id === 'context-memory-mem-1');
    if (!item || result.memories[0]?.id !== 'mem-1') throw new Error('Explicit memory selection failed.');
  });

  await test('irrelevant memory is excluded', () => {
    const result = buildAiContext(conversation(), { conversationId: 'conversation-1', id: 'request-1', content: 'hello' }, options({ maxCharacters: 100 }), [memory('mem-1', 'preferred_language', 'English')]);
    if (result.memories.length !== 0 || result.messages.some((item) => item.id === 'context-memory-mem-1')) throw new Error('Irrelevant memory was included.');
  });

  await test('deterministic exact-key matching selects memory', () => {
    const result = buildAiContext(conversation(), { conversationId: 'conversation-1', id: 'request-1', content: 'Please use preferred_language in this answer.' }, options({ maxCharacters: 100 }), [memory('mem-1', 'preferred_language', 'English')]);
    if (result.memories.length !== 1 || result.memories[0].key !== 'preferred_language') throw new Error('Exact-key memory matching failed.');
  });

  await test('memory cannot override current request ordering', () => {
    const result = buildAiContext(conversation(), { conversationId: 'conversation-1', id: 'request-1', content: 'preferred_language' }, options({ maxCharacters: 100 }), [memory('mem-1', 'preferred_language', 'English')]);
    if (result.messages.at(-1)?.role !== 'user' || result.messages.at(-1)?.content !== 'preferred_language') throw new Error('Memory displaced current request.');
  });

  await test('memory cannot displace newer conversation when budget is tight', () => {
    const result = buildAiContext(conversation({ messages: [historyMessage('m1', 'recent')] }), { conversationId: 'conversation-1', id: 'request-1', content: 'preferred_language' }, options({ maxCharacters: 'recent'.length + 'preferred_language'.length }), [memory('mem-1', 'preferred_language', 'English')]);
    if (result.messages.some((item) => item.id === 'context-memory-mem-1')) throw new Error('Memory was allowed to displace recent context.');
  });

  await test('no memory does not cause failure', () => {
    const result = buildAiContext(conversation(), { conversationId: 'conversation-1', id: 'request-1', content: 'hello' }, options());
    if (result.memories.length !== 0) throw new Error('Unexpected memory result.');
  });

  await test('context builder performs no network calls', async () => {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = (() => { throw new Error('network access is forbidden in context tests'); }) as typeof fetch;
    try {
      buildAiContext(conversation(), { conversationId: 'conversation-1', id: 'request-1', content: 'offline' }, options());
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  await test('context size limits reject values above the documented maximum', () => {
    try {
      buildAiContext(conversation(), { conversationId: 'conversation-1', content: 'x' }, options({ maxCharacters: MAX_CONTEXT_CHARACTERS + 1 }));
      throw new Error('Expected invalid maxCharacters.');
    } catch (error) {
      if (!(error instanceof AiContextError) || error.code !== 'INVALID_ARGUMENT') throw error;
    }
  });

  console.log(`Phase 9 context tests passed: ${passed} deterministic tests.`);
}

main().catch((error) => {
  console.error(error);
  throw error;
});
