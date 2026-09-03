import { BrowserLocalInferenceAdapter } from './browserLocalInferenceAdapter';
import { verifiedModelReferenceBrand, type VerifiedLocalModelReference } from './localInferenceContracts';
import { PRIMARY_LOCAL_TEXT_MODEL } from '../model/primaryLocalTextModel';
import { sha256Hex } from '../model/sha256';
import type { AiModel } from '../model/modelContracts';

function assert(condition: boolean, message: string): void { if (!condition) throw new Error(message); }
function equal<T>(actual: T, expected: T, message: string): void { assert(actual === expected, `${message}: expected ${String(expected)}, got ${String(actual)}`); }

async function main(): Promise<void> {
  equal(PRIMARY_LOCAL_TEXT_MODEL.sizeBytes, 491400032, 'authoritative Qwen GGUF size');
  equal(PRIMARY_LOCAL_TEXT_MODEL.sha256, '74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db', 'authoritative Qwen GGUF SHA-256');

  const bytes = new Blob(['verified-local-gguf-test']);
  const checksum = await sha256Hex(bytes);
  const model: AiModel = { ...PRIMARY_LOCAL_TEXT_MODEL, sizeBytes: bytes.size, sha256: checksum, version: 'verification-test' };
  let loadedBlob: Blob | null = null;
  let loaded = false;
  const engine = {
    setCompat() {},
    isModelLoaded: () => loaded,
    async loadModel(blobs: Blob[]) { equal(blobs.length, 1, 'wllama receives one local GGUF blob'); loadedBlob = blobs[0]; loaded = true; },
    async createChatCompletion() { return { choices: [{ message: { content: 'real adapter test response' }, finish_reason: 'stop' }] }; },
    async exit() { loaded = false; },
  } as never;
  const reference: VerifiedLocalModelReference = { model, [verifiedModelReferenceBrand]: true, readVerifiedModel: async () => bytes };
  const adapter = new BrowserLocalInferenceAdapter(() => engine, async () => ({ ok: true, status: 200 } as Response), false);
  await adapter.initialize();
  await adapter.loadModel(reference);
  assert(loadedBlob === bytes, 'wllama receives the exact verified Blob returned from the model reference');
  assert(loaded, 'adapter does not report model loaded before wllama load completes');
  const response = await adapter.generate({ messages: [{ id: 'm', conversationId: 'c', role: 'user', content: 'Hi' }], maxTokens: 8, temperature: 0.7, topP: 0.9 }, new AbortController().signal);
  equal(response.runtimeMetadata.provider, 'local', 'inference provider is local');
  equal(response.runtimeMetadata.runtime, 'wllama-llama.cpp-wasm', 'inference runtime is wllama');
  equal(response.runtimeMetadata.modelId, model.id, 'inference metadata identifies the loaded model');
  equal(response.runtimeMetadata.modelVersion, model.version, 'inference metadata identifies the loaded model version');
  equal(response.text, 'real adapter test response', 'response is returned from the runtime adapter');
  await adapter.dispose();
  console.log('Local Qwen verification contract tests passed.');
}

main().catch((error: unknown) => { console.error(error); throw error; });
