import assert from 'node:assert/strict';
import { BrowserLocalInferenceAdapter } from './browserLocalInferenceAdapter';
import { LocalInferenceRuntimeError } from './localInferenceContracts';
const engine = () => ({ setCompat() {}, isModelLoaded() { return false; }, async loadModel() {}, async createChatCompletion() {}, async exit() {} }) as never;
async function run(): Promise<void> {
  const normal = new BrowserLocalInferenceAdapter(engine, async () => new Response('missing', { status: 404 }), false); await assert.rejects(() => normal.initialize(), (error: unknown) => error instanceof LocalInferenceRuntimeError && error.code === 'WLLAMA_WASM_FETCH_FAILED' && error.diagnostic?.status === 404 && error.diagnostic?.resource === 'wllama.wasm');
  const compat = new BrowserLocalInferenceAdapter(engine, async (input) => input.toString().endsWith('wllama-compat/wllama.wasm') ? new Response('forbidden', { status: 403 }) : new Response('', { status: 200 }), true); await assert.rejects(() => compat.initialize(), (error: unknown) => error instanceof LocalInferenceRuntimeError && error.code === 'WLLAMA_COMPAT_WASM_FETCH_FAILED' && error.diagnostic?.status === 403);
  console.log('browserLocalInferenceAdapter.http.test.ts: PASS');
}
run().catch((error) => { console.error(error); throw error; });
