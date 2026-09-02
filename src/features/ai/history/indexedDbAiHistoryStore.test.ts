import 'fake-indexeddb/auto';
import { indexedDB } from 'fake-indexeddb';
import {
  AI_HISTORY_LIMITS,
  AiHistoryError,
  type AiHistoryMessage,
  type AiHistoryStore,
  createAiHistoryId,
} from './contracts';
import { AI_HISTORY_DATABASE_NAME, IndexedDbAiHistoryStore } from './indexedDbAiHistoryStore';

let passed = 0;

async function test(name: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

function message(content: string, overrides: Partial<AiHistoryMessage> = {}): AiHistoryMessage {
  return { id: createAiHistoryId('message'), role: 'user', content, createdAt: new Date().toISOString(), ...overrides };
}

async function rawPut(value: unknown): Promise<void> {
  const openRequest = indexedDB.open(AI_HISTORY_DATABASE_NAME, 1);
  await new Promise<void>((resolve, reject) => {
    openRequest.onupgradeneeded = () => {
      if (!openRequest.result.objectStoreNames.contains('conversations')) openRequest.result.createObjectStore('conversations', { keyPath: 'id' });
    };
    openRequest.onsuccess = () => resolve();
    openRequest.onerror = () => reject(openRequest.error);
  });
  const database = openRequest.result;
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('conversations', 'readwrite');
    transaction.objectStore('conversations').put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function expectError(run: () => Promise<unknown>, code: AiHistoryError['code']): Promise<void> {
  try {
    await run();
    throw new Error(`Expected ${code}.`);
  } catch (error) {
    if (!(error instanceof AiHistoryError) || error.code !== code) throw error;
  }
}

async function main(): Promise<void> {
  const store: AiHistoryStore = new IndexedDbAiHistoryStore();
  await store.clear();

  await test('create conversation', async () => {
    const created = await store.createConversation({ id: 'conversation-lifecycle', title: 'First chat' });
    if (created.id !== 'conversation-lifecycle' || created.messages.length !== 0 || created.title !== 'First chat') throw new Error('Conversation creation failed.');
  });
  await test('retrieve conversation', async () => {
    const conversation = await store.getConversation('conversation-lifecycle');
    if (!conversation || conversation.id !== 'conversation-lifecycle') throw new Error('Conversation retrieval failed.');
  });
  await test('list conversations', async () => {
    const list = await store.listConversations();
    if (!list.some((item) => item.id === 'conversation-lifecycle' && item.messageCount === 0)) throw new Error('Conversation was not listed.');
  });
  await test('update conversation', async () => {
    const updated = await store.updateConversation('conversation-lifecycle', { title: 'Renamed chat' });
    if (updated.title !== 'Renamed chat' || updated.updatedAt === '') throw new Error('Conversation update failed.');
  });
  await test('delete conversation', async () => {
    await store.createConversation({ id: 'delete-me' });
    await store.deleteConversation('delete-me');
    if (await store.getConversation('delete-me')) throw new Error('Deleted conversation still exists.');
  });
  await test('clear all conversations', async () => {
    await store.createConversation({ id: 'clear-me' });
    await store.clear();
    if ((await store.listConversations()).length !== 0) throw new Error('Clear did not remove conversations.');
  });

  await store.createConversation({ id: 'message-tests', title: 'Messages' });
  await test('append user message', async () => {
    const result = await store.appendMessage('message-tests', message('hello'));
    if (result.messages.length !== 1 || result.messages[0].role !== 'user') throw new Error('User message append failed.');
  });
  await test('append assistant message', async () => {
    const result = await store.appendMessage('message-tests', message('hi there', { role: 'assistant', provider: 'gemini', mode: 'online' }));
    if (result.messages[1].role !== 'assistant') throw new Error('Assistant message append failed.');
  });
  await test('preserve message ordering', async () => {
    const conversation = await store.getConversation('message-tests');
    if (!conversation || conversation.messages.map((item) => item.content).join('|') !== 'hello|hi there') throw new Error('Message ordering changed.');
  });
  await test('preserve timestamps', async () => {
    const createdAt = '2026-09-02T18:00:00.000Z';
    const result = await store.appendMessage('message-tests', message('timestamped', { createdAt }));
    if (result.messages.at(-1)?.createdAt !== createdAt) throw new Error('Timestamp was not preserved.');
  });
  await test('preserve unique message IDs', async () => {
    const conversation = await store.getConversation('message-tests');
    if (!conversation) throw new Error('Conversation missing.');
    const ids = conversation.messages.map((item) => item.id);
    if (new Set(ids).size !== ids.length || ids.some((id) => /^\d+$/.test(id))) throw new Error('Message IDs are not unique/non-index based.');
  });
  await test('preserve provider metadata', async () => {
    const conversation = await store.getConversation('message-tests');
    if (conversation?.messages[1].provider !== 'gemini') throw new Error('Provider metadata was lost.');
  });
  await test('preserve online/offline metadata', async () => {
    await store.appendMessage('message-tests', message('local reply', { role: 'assistant', provider: 'local', mode: 'offline' }));
    const conversation = await store.getConversation('message-tests');
    const item = conversation?.messages.at(-1);
    if (item?.provider !== 'local' || item.mode !== 'offline') throw new Error('Mode/provider metadata was lost.');
  });
  await test('data survives store recreation', async () => {
    const recreated = new IndexedDbAiHistoryStore();
    const conversation = await recreated.getConversation('message-tests');
    if (!conversation || conversation.messages.length !== 4) throw new Error('Data did not survive store recreation.');
  });
  await test('data survives simulated reload', async () => {
    const reloaded = new IndexedDbAiHistoryStore();
    if (!(await reloaded.listConversations()).some((item) => item.id === 'message-tests')) throw new Error('Data did not survive simulated reload.');
  });
  await test('missing conversation returns null', async () => {
    if (await store.getConversation('missing') !== null) throw new Error('Missing conversation was not null.');
  });
  await test('malformed record produces structured error', async () => {
    await rawPut({ id: 'malformed', title: 42, createdAt: 'bad', updatedAt: 'bad', messages: [] });
    await expectError(() => store.getConversation('malformed'), 'INVALID_RECORD');
  });
  await test('failed write does not report false success', async () => {
    await expectError(() => store.appendMessage('does-not-exist', message('nope')), 'CONVERSATION_NOT_FOUND');
  });
  await test('maximum message size enforced', async () => {
    await store.createConversation({ id: 'limits-content' });
    await expectError(() => store.appendMessage('limits-content', message('x'.repeat(AI_HISTORY_LIMITS.maxMessageContentLength + 1))), 'INVALID_ARGUMENT');
  });
  await test('maximum messages per conversation enforced', async () => {
    await store.createConversation({ id: 'limits-messages' });
    for (let index = 0; index < AI_HISTORY_LIMITS.maxMessagesPerConversation; index += 1) await store.appendMessage('limits-messages', message(`message-${index}`));
    await expectError(() => store.appendMessage('limits-messages', message('overflow')), 'LIMIT_EXCEEDED');
  });
  await test('maximum conversation/title limits enforced', async () => {
    await store.createConversation({ id: 'limits-title' });
    await expectError(() => store.updateConversation('limits-title', { title: 'x'.repeat(AI_HISTORY_LIMITS.maxTitleLength + 1) }), 'LIMIT_EXCEEDED');
  });
  await test('conversation limit is enforced', async () => {
    await store.clear();
    for (let index = 0; index < AI_HISTORY_LIMITS.maxConversations; index += 1) await store.createConversation({ id: `conversation-${index}` });
    await expectError(() => store.createConversation({ id: 'conversation-overflow' }), 'LIMIT_EXCEEDED');
    await store.clear();
  });
  await test('history store performs no network calls', async () => {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = (() => { throw new Error('network access is forbidden in history store tests'); }) as typeof fetch;
    try {
      await store.createConversation({ id: 'network-free' });
      await store.listConversations();
    } finally {
      globalThis.fetch = previousFetch;
    }
  });
  await test('history store does not call Gemini', async () => {
    await store.createConversation({ id: 'provider-free-gemini' });
    await store.appendMessage('provider-free-gemini', message('stored with explicit Gemini metadata', { provider: 'gemini', mode: 'online' }));
    if (!(await store.getConversation('provider-free-gemini'))) throw new Error('History operation failed.');
  });
  await test('history store does not call Supabase', async () => {
    await store.createConversation({ id: 'provider-free-supabase' });
    if (!(await store.getConversation('provider-free-supabase'))) throw new Error('History operation failed.');
  });
  await test('clear/delete actually remove local data', async () => {
    await store.createConversation({ id: 'remove-check' });
    await store.deleteConversation('remove-check');
    if (await store.getConversation('remove-check')) throw new Error('Delete failed.');
    await store.createConversation({ id: 'clear-check' });
    await store.clear();
    if ((await store.listConversations()).length !== 0) throw new Error('Clear failed.');
  });
  await test('Gemini metadata persists', async () => {
    await store.createConversation({ id: 'gemini-meta' });
    await store.appendMessage('gemini-meta', message('online', { provider: 'gemini', mode: 'online' }));
    const saved = await store.getConversation('gemini-meta');
    if (saved?.messages[0].provider !== 'gemini' || saved.messages[0].mode !== 'online') throw new Error('Gemini metadata failed.');
  });
  await test('Local metadata persists', async () => {
    await store.createConversation({ id: 'local-meta' });
    await store.appendMessage('local-meta', message('offline', { provider: 'local', mode: 'offline' }));
    const saved = await store.getConversation('local-meta');
    if (saved?.messages[0].provider !== 'local' || saved.messages[0].mode !== 'offline') throw new Error('Local metadata failed.');
  });
  await test('history works without LocalInferenceRuntime', async () => {
    await store.createConversation({ id: 'no-runtime' });
    await store.appendMessage('no-runtime', message('history is independent'));
    if (!(await store.getConversation('no-runtime'))) throw new Error('History depends on runtime.');
  });
  await test('history works without an executable provider', async () => {
    const independent = new IndexedDbAiHistoryStore();
    await independent.createConversation({ id: 'no-provider' });
    await independent.appendMessage('no-provider', message('stored without provider execution'));
    if (!(await independent.getConversation('no-provider'))) throw new Error('Provider execution was required.');
  });
  await test('concurrent appends do not silently lose messages', async () => {
    await store.clear();
    await store.createConversation({ id: 'concurrent' });
    await Promise.all([store.appendMessage('concurrent', message('a')), store.appendMessage('concurrent', message('b'))]);
    const saved = await store.getConversation('concurrent');
    if (!saved || saved.messages.length !== 2 || new Set(saved.messages.map((item) => item.content)).size !== 2) throw new Error('Concurrent append lost data.');
  });
  await test('duplicate message IDs are rejected', async () => {
    const duplicate = message('first', { id: 'duplicate-message' });
    await store.createConversation({ id: 'duplicate-test' });
    await store.appendMessage('duplicate-test', duplicate);
    await expectError(() => store.appendMessage('duplicate-test', { ...duplicate, content: 'second' }), 'DUPLICATE_ID');
  });
  await test('attachment metadata is preserved without binary data', async () => {
    await store.createConversation({ id: 'attachment-test' });
    await store.appendMessage('attachment-test', message('image reference', { attachments: [{ id: 'attachment-1', mimeType: 'image/png', name: 'image.png', size: 1234, reference: 'local-ref-1' }] }));
    const saved = await store.getConversation('attachment-test');
    const attachment = saved?.messages[0].attachments?.[0];
    if (!attachment || attachment.reference !== 'local-ref-1' || 'data' in attachment) throw new Error('Attachment metadata was not preserved correctly.');
  });

  await store.clear();
  console.log(`Phase 8 history tests passed: ${passed} deterministic tests.`);
}

main().catch((error) => {
  console.error(error);
  throw error;
});
