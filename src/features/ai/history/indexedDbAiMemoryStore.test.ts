import 'fake-indexeddb/auto';
import { indexedDB } from 'fake-indexeddb';
import {
  AI_HISTORY_DATABASE_NAME,
  AI_HISTORY_DATABASE_VERSION,
  AI_MEMORY_STORE_NAME,
} from './indexedDbAiHistoryStore';
import { AI_MEMORY_LIMITS, AiMemoryError, type AiMemory } from './memoryContracts';
import { IndexedDbAiMemoryStore } from './indexedDbAiMemoryStore';

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

function createMemory(id: string, key = `key-${id}`, value = `value-${id}`): AiMemory {
  return { id, key, value, createdAt: '2026-09-02T18:00:00.000Z', updatedAt: '2026-09-02T18:01:00.000Z' };
}

async function expectError(run: () => Promise<unknown>, code: AiMemoryError['code']): Promise<void> {
  try {
    await run();
    throw new Error(`Expected ${code}.`);
  } catch (error) {
    if (!(error instanceof AiMemoryError) || error.code !== code) throw error;
  }
}

async function rawPut(value: unknown): Promise<void> {
  const openRequest = indexedDB.open(AI_HISTORY_DATABASE_NAME, AI_HISTORY_DATABASE_VERSION);
  await new Promise<void>((resolve, reject) => {
    openRequest.onupgradeneeded = () => {
      const database = openRequest.result;
      if (!database.objectStoreNames.contains('conversations')) database.createObjectStore('conversations', { keyPath: 'id' });
      if (!database.objectStoreNames.contains(AI_MEMORY_STORE_NAME)) database.createObjectStore(AI_MEMORY_STORE_NAME, { keyPath: 'id' });
    };
    openRequest.onsuccess = () => resolve();
    openRequest.onerror = () => reject(openRequest.error);
  });
  const database = openRequest.result;
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(AI_MEMORY_STORE_NAME, 'readwrite');
    transaction.objectStore(AI_MEMORY_STORE_NAME).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function main(): Promise<void> {
  const store = new IndexedDbAiMemoryStore();
  await store.clear();

  await test('create memory', async () => {
    const saved = await store.upsert(createMemory('mem-1', 'preferred_language', 'English'));
    if (saved.id !== 'mem-1' || saved.key !== 'preferred_language' || saved.value !== 'English') throw new Error('Memory creation failed.');
  });

  await test('retrieve memory', async () => {
    const saved = await store.get('mem-1');
    if (!saved || saved.value !== 'English') throw new Error('Memory retrieval failed.');
  });

  await test('list memories', async () => {
    await store.upsert(createMemory('mem-2', 'preferred_response_style', 'concise'));
    const memories = await store.list();
    if (memories.length !== 2 || !memories.some((item) => item.id === 'mem-1')) throw new Error('Memory listing failed.');
  });

  await test('update memory with upsert', async () => {
    const updated = await store.upsert(createMemory('mem-1', 'preferred_language', 'Urdu'));
    if (updated.value !== 'Urdu' || updated.createdAt !== '2026-09-02T18:00:00.000Z') throw new Error('Memory upsert update failed.');
  });

  await test('delete memory', async () => {
    await store.delete('mem-2');
    if (await store.get('mem-2')) throw new Error('Deleted memory still exists.');
  });

  await test('clear memories', async () => {
    await store.clear();
    if ((await store.list()).length !== 0) throw new Error('Memory clear failed.');
  });

  await test('memory persistence survives store recreation', async () => {
    await store.upsert(createMemory('persistent', 'preferred_language', 'English'));
    const recreated = new IndexedDbAiMemoryStore();
    const saved = await recreated.get('persistent');
    if (!saved || saved.value !== 'English') throw new Error('Memory did not survive store recreation.');
  });

  await test('malformed memory is rejected on read', async () => {
    await store.clear();
    await rawPut({ id: 'malformed', key: 'preferred_language', createdAt: 'bad', updatedAt: 'bad' });
    await expectError(() => store.get('malformed'), 'INVALID_RECORD');
  });

  await test('empty memory key is rejected', async () => {
    await expectError(() => store.upsert(createMemory('empty-key', '', 'value')), 'INVALID_ARGUMENT');
  });

  await test('oversized memory key is rejected', async () => {
    await expectError(() => store.upsert(createMemory('long-key', 'x'.repeat(AI_MEMORY_LIMITS.maxKeyLength + 1), 'value')), 'LIMIT_EXCEEDED');
  });

  await test('oversized memory value is rejected', async () => {
    await expectError(() => store.upsert(createMemory('long-value', 'key', 'x'.repeat(AI_MEMORY_LIMITS.maxValueLength + 1))), 'LIMIT_EXCEEDED');
  });

  await test('memory count limit is enforced without truncation', async () => {
    await store.clear();
    for (let index = 0; index < AI_MEMORY_LIMITS.maxMemories; index += 1) await store.upsert(createMemory(`limit-${index}`));
    await expectError(() => store.upsert(createMemory('limit-overflow')), 'LIMIT_EXCEEDED');
    if ((await store.list()).length !== AI_MEMORY_LIMITS.maxMemories) throw new Error('Memory limit did not preserve the existing records.');
  });

  await test('secret-like memory keys are rejected', async () => {
    await expectError(() => store.upsert(createMemory('secret-key', 'api_key', 'not-stored')), 'SECRET_NOT_ALLOWED');
    await expectError(() => store.upsert(createMemory('password-key', 'password', 'not-stored')), 'SECRET_NOT_ALLOWED');
  });

  await test('memory store performs no network calls', async () => {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = (() => { throw new Error('network access is forbidden in memory tests'); }) as typeof fetch;
    try {
      await store.clear();
      await store.upsert(createMemory('offline', 'preferred_language', 'English'));
      await store.list();
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  await test('missing memory returns null', async () => {
    if (await store.get('missing') !== null) throw new Error('Missing memory was not null.');
  });

  await store.clear();
  console.log(`Phase 9 memory tests passed: ${passed} deterministic tests.`);
}

main().catch((error) => {
  console.error(error);
  throw error;
});
