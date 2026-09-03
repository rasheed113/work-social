import assert from 'node:assert/strict';
import worker from './index.js';

const MODEL_URL = 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf';
const MODEL_PATH = '/api/ai-model/qwen2.5-0.5b-instruct-q4_k_m.gguf';

async function run(): Promise<void> {
  const originalFetch = globalThis.fetch;
  let upstreamUrl = '';
  let upstreamRange = null;

  try {
    globalThis.fetch = async (input, init) => {
      upstreamUrl = String(input);
      upstreamRange = new Headers(init?.headers).get('Range');
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([0x47, 0x47]));
          controller.close();
        },
      }), {
        status: 206,
        headers: {
          'content-type': 'application/octet-stream',
          'content-range': 'bytes 0-1/491400032',
          'accept-ranges': 'bytes',
        },
      });
    };

    const request = new Request(`https://work-social.example${MODEL_PATH}`, {
      headers: { Range: 'bytes=0-1' },
    });
    const response = await worker.fetch(request, { ASSETS: { fetch: async () => new Response('asset') } });

    assert.equal(upstreamUrl, MODEL_URL);
    assert.equal(upstreamRange, 'bytes=0-1');
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-range'), 'bytes 0-1/491400032');
    assert.equal(response.headers.get('accept-ranges'), 'bytes');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
    assert.equal(await response.arrayBuffer().then((buffer) => buffer.byteLength), 2);

    const fallback = await worker.fetch(new Request('https://work-social.example/'), {
      ASSETS: { fetch: async () => new Response('asset') },
    });
    assert.equal(await fallback.text(), 'asset');

    globalThis.fetch = async () => { throw new TypeError('origin unavailable'); };
    const failed = await worker.fetch(new Request(`https://work-social.example${MODEL_PATH}`), {
      ASSETS: { fetch: async () => new Response('asset') },
    });
    assert.equal(failed.status, 502);
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('worker/modelProxy.test.mjs: PASS');
}

run().catch((error) => { console.error(error); throw error; });
