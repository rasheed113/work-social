import type { ModelManager } from '../model/modelManager';
import type { AiModel, ModelEligibilityResult } from '../model/modelContracts';
import type { InferenceRequest, InferenceResponse, InferenceStreamEvent, LocalInferenceRuntime, LocalInferenceRuntimeStatus, VerifiedLocalModelReference } from '../runtime/localInferenceContracts';
import { LocalInferenceRuntimeError } from '../runtime/localInferenceContracts';
import { LocalAiProvider, LOCAL_AI_NOT_INSTALLED, OFFLINE_TEXT_AI_UNAVAILABLE } from './localAiProvider';

const message = { id: 'm', conversationId: 'c', role: 'user' as const, content: 'hello' };

function unavailableRuntime(): LocalInferenceRuntime {
  return {
    initialize: async () => undefined,
    loadModel: async (_model: VerifiedLocalModelReference) => undefined,
    unloadModel: async () => undefined,
    generate: async (_request: InferenceRequest): Promise<InferenceResponse> => { throw new Error('generate must not be called in unavailable tests'); },
    stream: (_request: InferenceRequest): AsyncIterable<InferenceStreamEvent> => (async function* () {})(),
    cancel: async () => undefined,
    getStatus: (): LocalInferenceRuntimeStatus => 'UNAVAILABLE',
    dispose: async () => undefined,
  };
}

function readyRuntime(): LocalInferenceRuntime {
  return {
    initialize: async () => undefined,
    loadModel: async (_model: VerifiedLocalModelReference) => undefined,
    unloadModel: async () => undefined,
    generate: async (_request: InferenceRequest): Promise<InferenceResponse> => { throw new Error('test runtime must not generate'); },
    stream: (_request: InferenceRequest): AsyncIterable<InferenceStreamEvent> => (async function* () {})(),
    cancel: async () => undefined,
    getStatus: (): LocalInferenceRuntimeStatus => 'READY',
    dispose: async () => undefined,
  };
}

function managerFor(model: Partial<AiModel>, eligibility: ModelEligibilityResult = { eligible: true, reasons: [], limitations: [] }): ModelManager {
  const base: AiModel = {
    id: 'local-text-3b-4b-primary', name: 'test', version: 'test', type: 'TEXT', format: 'GGUF', sizeBytes: 1,
    sha256: 'verified', architectureRequirements: { supportedArchitectures: ['arm64-v8a'] },
    memoryRequirements: { requiredRamBytes: 1 }, storageRequirements: { requiredFreeStorageBytes: 1 },
    platformRequirements: { requiredPlatform: 'android' }, downloadSource: null, availability: 'AVAILABLE', status: 'INSTALLED',
    ...model,
  };
  return {
    getModel: () => ({ ...base }),
    checkInstallationEligibility: async () => eligibility,
    getVerifiedModelReference: async () => { throw new Error('verified handoff must not be reached in this deterministic boundary test'); },
  } as unknown as ModelManager;
}

async function expectCode(action: () => Promise<unknown>, code: string): Promise<void> {
  try { await action(); throw new Error(`Expected ${code}, but no error was thrown.`); }
  catch (error) {
    if (!(error instanceof LocalInferenceRuntimeError) || error.code !== code) throw new Error(`Expected ${code}.`);
  }
}

async function run(): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => { throw new Error('LocalAiProvider must never use network fetch.'); }) as typeof fetch;
  try {
    const unavailable = new LocalAiProvider(unavailableRuntime());
    const status = unavailable.getStatus();
    if (status.state !== 'unavailable' || status.reasonCode !== OFFLINE_TEXT_AI_UNAVAILABLE) throw new Error('Unavailable local capability was not explicit.');
    if (status.reason !== LOCAL_AI_NOT_INSTALLED) throw new Error('Unavailable reason is not truthful.');
    await expectCode(() => unavailable.sendMessage([message]), OFFLINE_TEXT_AI_UNAVAILABLE);

    await expectCode(() => new LocalAiProvider(readyRuntime(), managerFor({ status: 'NOT_INSTALLED' })).sendMessage([message]), 'MODEL_NOT_INSTALLED');
    await expectCode(() => new LocalAiProvider(readyRuntime(), managerFor({ status: 'INVALID' })).sendMessage([message]), 'MODEL_INVALID');
    await expectCode(() => new LocalAiProvider(readyRuntime(), managerFor({}, { eligible: false, reasons: [{ code: 'UNSUPPORTED_ARCHITECTURE', message: 'CPU architecture is not supported.' }], limitations: [] })).sendMessage([message]), 'MODEL_INCOMPATIBLE');
    await expectCode(() => new LocalAiProvider(readyRuntime(), managerFor({}, { eligible: false, reasons: [{ code: 'INSUFFICIENT_RAM', message: 'Total RAM is below the model requirement.' }], limitations: [] })).sendMessage([message]), 'INSUFFICIENT_RESOURCES');
    await expectCode(() => new LocalAiProvider(readyRuntime(), managerFor({})).sendMessage([message], [{ kind: 'image', mimeType: 'image/png' }]), 'UNSUPPORTED_ATTACHMENT');
    await expectCode(() => new LocalAiProvider(readyRuntime(), managerFor({})).sendMessage([message], [], { contextSize: 16384 }), 'CONTEXT_TOO_LARGE');

    console.log('Phase 5 boundary tests passed: unavailable runtime is explicit, model states are structured, attachments are rejected, bounds are enforced, and no network fallback is used.');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

run().catch((error: unknown) => { console.error(error); throw error; });
