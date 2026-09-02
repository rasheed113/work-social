import {
  createLocalInferenceRuntime,
  type LocalInferenceEngineAdapter,
} from './localInferenceRuntime';
import {
  LocalInferenceRuntimeError,
  verifiedModelReferenceBrand,
  type InferenceRequest,
  type InferenceResponse,
  type InferenceStreamEvent,
  type VerifiedLocalModelReference,
} from './localInferenceContracts';
import type { AiModel } from '../model/modelContracts';

const model = {
  id: 'fixture', name: 'fixture', version: '1', type: 'TEXT', format: 'GGUF', sizeBytes: 1,
  sha256: 'a'.repeat(64), architectureRequirements: { supportedArchitectures: ['arm64-v8a'] },
  memoryRequirements: { requiredRamBytes: 1 }, storageRequirements: { requiredFreeStorageBytes: 1 },
  platformRequirements: { requiredPlatform: 'android' as const, minimumAndroidVersion: 26 },
  downloadSource: null, availability: 'AVAILABLE' as const, status: 'INSTALLED' as const,
} satisfies AiModel;

function reference(): VerifiedLocalModelReference {
  return { model, [verifiedModelReferenceBrand]: true, readVerifiedModel: async () => new Blob(['verified']) };
}
function request(signal?: AbortSignal): InferenceRequest {
  return { messages: [{ id: 'm', conversationId: 'c', role: 'user', content: 'hello' }], signal };
}
function response(text = 'hello local'): InferenceResponse {
  return { text, finishReason: 'STOP', usage: { promptTokens: null, completionTokens: null, totalTokens: null }, runtimeMetadata: { provider: 'local', runtime: 'fixture', modelId: model.id, modelVersion: model.version } };
}
function assert(condition: boolean, message: string): void { if (!condition) throw new Error(message); }
function equal<T>(actual: T, expected: T, message: string): void { assert(actual === expected, `${message}: expected ${String(expected)}, got ${String(actual)}`); }

class FakeAdapter implements LocalInferenceEngineAdapter {
  readonly name = 'fixture'; readonly streaming = true; readonly cancellation = true;
  loaded = false; disposed = false; cancelled = false;
  async initialize(): Promise<void> {}
  async loadModel(modelRef: VerifiedLocalModelReference): Promise<void> { await modelRef.readVerifiedModel(); this.loaded = true; }
  async unloadModel(): Promise<void> { this.loaded = false; }
  async generate(_request: InferenceRequest, signal: AbortSignal): Promise<InferenceResponse> {
    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      setTimeout(resolve, 1);
    });
    return response();
  }
  async *stream(_request: InferenceRequest, signal: AbortSignal): AsyncIterable<InferenceStreamEvent> {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    yield { type: 'TOKEN', text: 'hello' };
    yield { type: 'TOKEN', text: ' local' };
    yield { type: 'COMPLETE', response: response() };
  }
  async cancel(): Promise<void> { this.cancelled = true; }
  async dispose(): Promise<void> { this.disposed = true; this.loaded = false; }
}

async function run(): Promise<void> {
  const unavailable = createLocalInferenceRuntime();
  equal(unavailable.getStatus(), 'UNAVAILABLE', 'default browser runtime is unavailable');
  try { await unavailable.initialize(); throw new Error('unavailable runtime initialized'); }
  catch (error) { assert(error instanceof LocalInferenceRuntimeError && error.code === 'LOCAL_RUNTIME_UNAVAILABLE', 'unavailable runtime rejects initialization'); }
  await unavailable.dispose(); equal(unavailable.getStatus(), 'DISPOSED', 'unavailable runtime disposes safely');
  await unavailable.dispose();

  const adapter = new FakeAdapter(); const runtime = createLocalInferenceRuntime(adapter);
  equal(runtime.getStatus(), 'UNINITIALIZED', 'adapter runtime starts uninitialized');
  await runtime.initialize(); equal(runtime.getStatus(), 'READY', 'initialize reaches ready');
  await runtime.loadModel(reference()); equal(runtime.getStatus(), 'MODEL_READY', 'verified model reaches model ready');

  try { await runtime.loadModel({ model } as VerifiedLocalModelReference); throw new Error('unbranded model accepted'); }
  catch (error) { assert(error instanceof LocalInferenceRuntimeError && error.code === 'INVALID_MODEL_REFERENCE', 'arbitrary model reference rejected'); }

  const generated = await runtime.generate(request());
  equal(generated.text, 'hello local', 'generation returns adapter output');
  equal(generated.usage.totalTokens, null, 'unknown token usage is not fabricated');
  equal(runtime.getStatus(), 'MODEL_READY', 'generation returns to model ready');

  const events: InferenceStreamEvent[] = [];
  for await (const event of runtime.stream(request())) events.push(event);
  equal(events.length, 3, 'stream emits actual token and completion events');
  equal(events[0].type, 'TOKEN', 'first stream event is token');
  equal(events[1].type, 'TOKEN', 'second stream event is token');
  equal(events[2].type, 'COMPLETE', 'stream completes');
  equal(runtime.getStatus(), 'MODEL_READY', 'stream returns to model ready');

  const generation = runtime.generate(request());
  await new Promise((resolve) => setTimeout(resolve, 0));
  await runtime.cancel();
  try { await generation; throw new Error('cancelled generation completed'); }
  catch (error) { assert(error instanceof LocalInferenceRuntimeError && error.code === 'GENERATION_CANCELLED', 'cancellation is surfaced honestly'); }
  equal(adapter.cancelled, true, 'adapter cancellation is invoked');
  equal(runtime.getStatus(), 'MODEL_READY', 'cancellation preserves loaded model state');

  await runtime.unloadModel(); equal(runtime.getStatus(), 'READY', 'unload returns to ready');
  await runtime.dispose(); equal(runtime.getStatus(), 'DISPOSED', 'dispose reaches disposed');
  equal(adapter.disposed, true, 'adapter resources are disposed');
  try { await runtime.generate(request()); throw new Error('generation after dispose accepted'); }
  catch (error) { assert(error instanceof LocalInferenceRuntimeError && error.code === 'INVALID_STATE', 'generation after dispose is rejected'); }

  console.log('Local inference runtime tests passed: availability, lifecycle, verified handoff, generation, streaming, cancellation, cleanup.');
}
run().catch((error: unknown) => { console.error(error); throw error; });
