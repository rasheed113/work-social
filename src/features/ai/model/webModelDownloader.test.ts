import assert from 'node:assert/strict';
import { WebModelDownloader } from './webModelDownloader';
import { LocalInferenceRuntimeError } from '../runtime/localInferenceContracts';

const model = { id: 'test', name: 'test', version: '1', type: 'TEXT' as const, format: 'GGUF' as const, sizeBytes: 4, sha256: null, architectureRequirements: { supportedArchitectures: [] }, memoryRequirements: { requiredRamBytes: 1 }, storageRequirements: { requiredFreeStorageBytes: 1 }, platformRequirements: { requiredPlatform: 'any' as const }, downloadSource: { kind: 'external' as const, uri: 'https://example.invalid/model.gguf?token=secret' }, availability: 'AVAILABLE' as const, status: 'NOT_INSTALLED' as const };

async function check(fetchImpl: typeof fetch, verify: (error: LocalInferenceRuntimeError) => void): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    await assert.rejects(() => new WebModelDownloader().download(model), (error: unknown) => {
      if (!(error instanceof LocalInferenceRuntimeError)) return false;
      verify(error);
      return true;
    });
  } finally {
    globalThis.fetch = original;
  }
}

async function run(): Promise<void> {
  await check(async () => { throw new TypeError('Failed to fetch'); }, (error) => {
    assert.equal(error.code, 'MODEL_DOWNLOAD_FETCH_FAILED');
    assert.equal(error.diagnostic?.status, undefined);
    assert.equal(error.diagnostic?.errorName, 'TypeError');
    assert.equal(error.diagnostic?.url, 'https://example.invalid/model.gguf');
  });

  for (const status of [404, 403, 500]) await check(async () => new Response('failure', { status }), (error) => {
    assert.equal(error.code, 'MODEL_DOWNLOAD_HTTP_FAILED');
    assert.equal(error.diagnostic?.status, status);
    assert.equal(error.diagnostic?.responseOk, false);
  });

  const bodyError = {
    ok: true, status: 200, statusText: 'OK', type: 'basic', redirected: false, url: 'https://example.invalid/model.gguf', headers: new Headers({ 'content-length': '4' }),
    body: { getReader() { return { read: async () => { throw new Error('stream broke'); }, releaseLock() {} }; } },
  } as unknown as Response;
  await check(async () => bodyError, (error) => {
    assert.equal(error.code, 'MODEL_DOWNLOAD_RESPONSE_READ_FAILED');
    assert.equal(error.diagnostic?.status, 200);
    assert.equal(error.diagnostic?.responseBodyAvailable, true);
    assert.equal(error.diagnostic?.downloadedBytes, 0);
  });

  const original = globalThis.fetch;
  let attempts = 0;
  try {
    globalThis.fetch = async () => {
      attempts += 1;
      if (attempts === 1) throw new TypeError('temporary network failure');
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1]));
          controller.enqueue(new Uint8Array([2, 3, 4]));
          controller.close();
        },
      });
      return new Response(body, { status: 200, headers: { 'content-length': '4', 'content-type': 'application/octet-stream' } });
    };
    const progress: Array<{ receivedBytes: number; totalBytes: number | null }> = [];
    const data = await new WebModelDownloader().download(model, undefined, (value) => progress.push(value));
    assert.equal(data.size, 4);
    assert.equal(attempts, 2);
    assert.deepEqual(progress.at(-1), { receivedBytes: 4, totalBytes: 4 });
    assert.equal(progress[0]?.receivedBytes, 0);
    assert.equal(progress[0]?.totalBytes, 4);
    assert.ok(progress.some((value) => value.receivedBytes === 1 && value.totalBytes === 4));
  } finally { globalThis.fetch = original; }

  const chunks = [new Uint8Array([1, 2]), new Uint8Array([3, 4, 5])];
  const noLengthResponse = new Response(new ReadableStream({
    start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close(); },
  }), { status: 200, headers: { 'content-type': 'application/octet-stream' } });
  const noLengthProgress: Array<{ receivedBytes: number; totalBytes: number | null }> = [];
  try {
    globalThis.fetch = async () => noLengthResponse;
    const data = await new WebModelDownloader().download(model, undefined, (value) => noLengthProgress.push(value));
    assert.equal(data.size, 5);
    assert.ok(noLengthProgress.length >= 3);
    assert.deepEqual(noLengthProgress[0], { receivedBytes: 0, totalBytes: null });
    assert.deepEqual(noLengthProgress.at(-1), { receivedBytes: 5, totalBytes: null });
    assert.ok(noLengthProgress.every((value) => value.totalBytes === null));
  } finally { globalThis.fetch = original; }

  await check(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-length': '4' } }), (error) => {
    assert.equal(error.code, 'MODEL_DOWNLOAD_INCOMPLETE');
    assert.equal(error.diagnostic?.downloadedBytes, 3);
    assert.equal(error.diagnostic?.contentLength, 4);
  });

  const controller = new AbortController();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')), { once: true });
  })) as typeof fetch;
  try {
    const downloader = new WebModelDownloader();
    const pending = downloader.download(model, controller.signal);
    controller.abort();
    await assert.rejects(pending, (error: unknown) => error instanceof LocalInferenceRuntimeError && error.code === 'MODEL_DOWNLOAD_ABORTED');
  } finally { globalThis.fetch = originalFetch; }

  console.log('webModelDownloader.test.ts: PASS');
}

run().catch((error) => { console.error(error); throw error; });
