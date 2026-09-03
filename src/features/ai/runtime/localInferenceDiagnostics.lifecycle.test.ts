import assert from 'node:assert/strict';
import { createLocalInferenceRuntime } from './localInferenceRuntime';
import { LocalInferenceRuntimeError, verifiedModelReferenceBrand, type LocalInferenceEngineAdapter, type VerifiedLocalModelReference } from './localInferenceContracts';
import type { InferenceRequest } from './localInferenceContracts';
const model: VerifiedLocalModelReference = { model: { id: 'lifecycle', name: 'lifecycle', version: '1', type: 'TEXT', format: 'GGUF', sizeBytes: 1, sha256: 'a'.repeat(64), architectureRequirements: { supportedArchitectures: [] }, memoryRequirements: { requiredRamBytes: 1 }, storageRequirements: { requiredFreeStorageBytes: 1 }, platformRequirements: { requiredPlatform: 'any' }, downloadSource: null, availability: 'AVAILABLE', status: 'INSTALLED' }, [verifiedModelReferenceBrand]: true, readVerifiedModel: async () => new Blob(['x']) };
const request: InferenceRequest = { messages: [{ id: '1', conversationId: '1', role: 'user', content: 'x' }] };
function adapter(initializeError?: Error, loadError?: Error): LocalInferenceEngineAdapter { return { name: 'test', streaming: false, cancellation: false, capabilities: { textGeneration: true }, async initialize() { if (initializeError) throw initializeError; }, async loadModel() { if (loadError) throw loadError; }, async unloadModel() {}, async generate() { throw new Error('not used'); }, async *stream() {}, async cancel() {}, async dispose() {} }; }
async function run(): Promise<void> {
  const initDiagnostic = { stage: 'WLLAMA_WASM' as const, code: 'WLLAMA_WASM_FETCH_FAILED', message: 'wasm failed', resource: 'wllama.wasm', timestamp: new Date().toISOString() };
  const runtimeInit = createLocalInferenceRuntime(adapter(new LocalInferenceRuntimeError('WLLAMA_WASM_FETCH_FAILED', 'wasm failed', initDiagnostic)));
  await assert.rejects(() => runtimeInit.initialize(), (error: unknown) => error instanceof LocalInferenceRuntimeError && error.code === 'WLLAMA_WASM_FETCH_FAILED' && error.diagnostic?.stage === 'WLLAMA_WASM');
  assert.equal(runtimeInit.getStatus(), 'ERROR');
  const loadDiagnostic = { stage: 'MODEL_LOAD' as const, code: 'MODEL_LOAD_FAILED', message: 'load failed', resource: 'Qwen GGUF model', timestamp: new Date().toISOString() };
  const runtimeLoad = createLocalInferenceRuntime(adapter(undefined, new LocalInferenceRuntimeError('MODEL_LOAD_FAILED', 'load failed', loadDiagnostic)));
  await runtimeLoad.initialize(); await assert.rejects(() => runtimeLoad.loadModel(model), (error: unknown) => error instanceof LocalInferenceRuntimeError && error.code === 'MODEL_LOAD_FAILED' && error.diagnostic?.stage === 'MODEL_LOAD');
  assert.equal(runtimeLoad.getStatus(), 'ERROR');
  console.log('localInferenceDiagnostics.lifecycle.test.ts: PASS');
}
run().catch((error) => { console.error(error); throw error; });
