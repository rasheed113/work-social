import assert from 'node:assert/strict';
import { LocalAiProvider } from './localAiProvider';
import type { ModelManager } from '../model/modelManager';
import type { AiModel } from '../model/modelContracts';
import type { InferenceRequest, InferenceResponse, InferenceStreamEvent, LocalInferenceRuntime, LocalInferenceRuntimeStatus, VerifiedLocalModelReference } from '../runtime/localInferenceContracts';

const model: AiModel = {
  id: 'local-text-3b-4b-primary', name: 'test', version: '1', type: 'TEXT', format: 'GGUF', sizeBytes: 1, sha256: 'a'.repeat(64),
  architectureRequirements: { supportedArchitectures: ['arm64-v8a'] }, memoryRequirements: { requiredRamBytes: 1 }, storageRequirements: { requiredFreeStorageBytes: 1 },
  platformRequirements: { requiredPlatform: 'android' }, downloadSource: null, availability: 'AVAILABLE', status: 'INSTALLED',
};

function readyRuntime(): LocalInferenceRuntime {
  return {
    initialize: async () => undefined, loadModel: async (_model: VerifiedLocalModelReference) => { throw new Error('warm action path must not load'); }, unloadModel: async () => undefined,
    generate: async (_request: InferenceRequest): Promise<InferenceResponse> => { throw new Error('deterministic Work Entry action must not generate natural-language completion'); },
    stream: (_request: InferenceRequest): AsyncIterable<InferenceStreamEvent> => (async function* () {})(), cancel: async () => undefined,
    getStatus: (): LocalInferenceRuntimeStatus => 'MODEL_READY', dispose: async () => undefined,
  };
}

async function run(): Promise<void> {
  let bridgeCalls = 0;
  const bridge = async (text: string, generatedResponse: string) => {
    bridgeCalls += 1;
    assert.match(text, /Add new entry item shirt size S rate 34 pieces 32/i);
    assert.equal(generatedResponse, '');
    return { conversationId: 'c', assistantMessage: 'I’m ready to add this Work Entry.', pendingActions: [{ id: 'a', displaySummary: 'Work Entry', expiresAt: new Date(Date.now() + 60_000).toISOString() }] };
  };
  const manager = { getModel: () => model } as unknown as ModelManager;
  const provider = new LocalAiProvider(readyRuntime(), manager, model.id, bridge);
  const response = await provider.sendMessage([{ id: 'u', conversationId: 'c', role: 'user', content: 'Add new entry item shirt size S rate 34 pieces 32' }]);
  assert.equal(bridgeCalls, 1);
  assert.equal(response.provider, 'local');
  assert.equal(response.mode, 'offline');
  assert.equal(response.pendingActions.length, 1);
  console.log('Offline Work Entry fast-path test passed.');
}

void run().catch((error) => { console.error(error); process.exitCode = 1; });
