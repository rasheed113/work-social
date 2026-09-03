import assert from 'node:assert/strict';
import { WebModelDownloader } from './webModelDownloader';
import { LocalInferenceRuntimeError } from '../runtime/localInferenceContracts';
const model = { id: 'test', name: 'test', version: '1', type: 'TEXT' as const, format: 'GGUF' as const, sizeBytes: 4, sha256: null, architectureRequirements: { supportedArchitectures: [] }, memoryRequirements: { requiredRamBytes: 1 }, storageRequirements: { requiredFreeStorageBytes: 1 }, platformRequirements: { requiredPlatform: 'any' as const }, downloadSource: { kind: 'external' as const, uri: 'https://example.invalid/model.gguf?token=secret' }, availability: 'AVAILABLE' as const, status: 'NOT_INSTALLED' as const };
async function check(fetchImpl: typeof fetch, verify: (error: LocalInferenceRuntimeError) => void) { const original = globalThis.fetch; globalThis.fetch = fetchImpl; try { await assert.rejects(() => new WebModelDownloader().download(model), (error: unknown) => { if (!(error instanceof LocalInferenceRuntimeError)) return false; verify(error); return true; }); } finally { globalThis.fetch = original; } }
async function run(): Promise<void> {
  await check(async () => { throw new TypeError('Failed to fetch'); }, (error) => { assert.equal(error.code, 'MODEL_DOWNLOAD_FAILED'); assert.equal(error.diagnostic?.status, undefined); assert.equal(error.diagnostic?.errorName, 'TypeError'); assert.equal(error.diagnostic?.url, 'https://example.invalid/model.gguf'); });
  for (const status of [404, 403, 500]) await check(async () => new Response('failure', { status }), (error) => { assert.equal(error.diagnostic?.status, status); assert.equal(error.diagnostic?.errorName, undefined); });
  const bodyError = { ok: true, status: 200, statusText: 'OK', type: 'basic', headers: new Headers(), body: { getReader() { return { read: async () => { throw new Error('stream broke'); } }; } } } as unknown as Response;
  await check(async () => bodyError, (error) => { assert.equal(error.diagnostic?.status, 200); assert.match(error.diagnostic?.message ?? '', /body|stream/i); });
  console.log('webModelDownloader.test.ts: PASS');
}
run().catch((error) => { console.error(error); throw error; });
