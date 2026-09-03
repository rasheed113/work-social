import assert from 'node:assert/strict';
import { WebModelDownloader } from './webModelDownloader';
import { LocalInferenceRuntimeError } from '../runtime/localInferenceContracts';

const model = { id: 'test', name: 'test', version: '1', type: 'TEXT' as const, format: 'GGUF' as const, sizeBytes: 4, sha256: null, architectureRequirements: { supportedArchitectures: [] }, memoryRequirements: { requiredRamBytes: 1 }, storageRequirements: { requiredFreeStorageBytes: 1 }, platformRequirements: { requiredPlatform: 'any' as const }, downloadSource: { kind: 'external' as const, uri: 'https://example.invalid/model.gguf' }, availability: 'AVAILABLE' as const, status: 'NOT_INSTALLED' as const };

async function run(): Promise<void> {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    await assert.rejects(() => new WebModelDownloader().download(model), (error: unknown) => error instanceof LocalInferenceRuntimeError && error.code === 'MODEL_DOWNLOAD_FAILED' && !error.message.includes('Failed to fetch'));
    globalThis.fetch = async () => new Response('missing', { status: 404 });
    await assert.rejects(() => new WebModelDownloader().download(model), (error: unknown) => error instanceof LocalInferenceRuntimeError && error.code === 'MODEL_DOWNLOAD_FAILED' && error.message.includes('HTTP 404'));
  } finally { globalThis.fetch = originalFetch; }
  console.log('webModelDownloader.test.ts: PASS');
}
run().catch((error: unknown) => { console.error(error); throw error; });
