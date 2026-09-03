import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { WebModelStorage } from './webModelStorage';

const model = {
  id: 'storage-test',
  name: 'Storage test',
  version: '1',
  type: 'TEXT' as const,
  format: 'GGUF' as const,
  sizeBytes: 1,
  sha256: null,
  architectureRequirements: { supportedArchitectures: [] },
  memoryRequirements: { requiredRamBytes: 1 },
  storageRequirements: { requiredFreeStorageBytes: 1 },
  platformRequirements: { requiredPlatform: 'any' as const },
  downloadSource: null,
  availability: 'AVAILABLE' as const,
  status: 'NOT_INSTALLED' as const,
};

async function run(): Promise<void> {
  const storage = new WebModelStorage();
  assert.equal(await storage.read(model), null, 'missing model must remain a normal missing-record result');

  const originalOpen = indexedDB.open.bind(indexedDB);
  (indexedDB as unknown as { open: typeof indexedDB.open }).open = (() => {
    throw new Error('quota/open failure');
  }) as typeof indexedDB.open;

  try {
    // Use a fresh storage instance so the injected IndexedDB.open failure is
    // exercised before WebModelStorage can cache a successful database handle.
    const failingStorage = new WebModelStorage();
    await assert.rejects(
      () => failingStorage.read(model),
      (error: unknown) => {
        const diagnostic = (error as { diagnostic?: { stage?: string; code?: string; errorMessage?: string } }).diagnostic;
        return diagnostic?.stage === 'MODEL_STORAGE_READ'
          && diagnostic.code === 'MODEL_STORAGE_READ_FAILED'
          && /quota\/open failure/.test(diagnostic.errorMessage ?? '');
      },
    );

    const failingWriteStorage = new WebModelStorage();
    await assert.rejects(
      () => failingWriteStorage.write(model, new Blob(['x'])),
      (error: unknown) => {
        const diagnostic = (error as { diagnostic?: { stage?: string; code?: string } }).diagnostic;
        return diagnostic?.stage === 'MODEL_STORAGE_WRITE'
          && diagnostic.code === 'MODEL_STORAGE_WRITE_FAILED';
      },
    );
  } finally {
    (indexedDB as unknown as { open: typeof indexedDB.open }).open = originalOpen;
  }

  console.log('webModelStorage.failure.test.ts: PASS');
}

run().catch((error) => {
  console.error(error);
  throw error;
});
