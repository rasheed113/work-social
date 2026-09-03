import { createLocalInferenceRuntime, type LocalInferenceEngineAdapter } from './localInferenceRuntime';
import { LocalInferenceRuntimeError, verifiedModelReferenceBrand, type InferenceRequest, type InferenceResponse, type InferenceStreamEvent, type VerifiedLocalModelReference } from './localInferenceContracts';
import type { AiModel } from '../model/modelContracts';

const model = {
  id: 'fixture', name: 'fixture', version: '1', type: 'TEXT', format: 'GGUF', sizeBytes: 1, sha256: 'a'.repeat(64),
  architectureRequirements: { supportedArchitectures: ['arm64-v8a'] }, memoryRequirements: { requiredRamBytes: 1 }, storageRequirements: { requiredFreeStorageBytes: 1 },
  platformRequirements: { requiredPlatform: 'android' as const, minimumAndroidVersion: 26 }, downloadSource: null, availability: 'AVAILABLE' as const, status: 'INSTALLED' as const,
} satisfies AiModel;
function reference(): VerifiedLocalModelReference { return { model, [verifiedModelReferenceBrand]: true, readVerifiedModel: async () => new Blob(['verified']) }; }
function response(text = 'hello local'): InferenceResponse { return { text, finishReason: 'STOP', usage: { promptTokens: null, completionTokens: null, totalTokens: null }, runtimeMetadata: { provider: 'local', runtime: 'fixture', modelId: model.id, modelVersion: model.version } }; }
function assert(condition: boolean, message: string): void { if (!condition) throw new Error(message); }
function equal<T>(actual: T, expected: T, message: string): void { assert(actual === expected, `${message}: expected ${String(expected)}, got ${String(actual)}`); }

class FakeAdapter implements LocalInferenceEngineAdapter {
  readonly name = 'fixture'; readonly streaming = true; readonly cancellation = true;
  loaded = false; disposed = false; cancelled = false; lastRequest: InferenceRequest | null = null; blockNextStream = false; failNextStream = false;
  async initialize(): Promise<void> {}
  async loadModel(modelRef: VerifiedLocalModelReference): Promise<void> { await modelRef.readVerifiedModel(); this.loaded = true; }
  async unloadModel(): Promise<void> { this.loaded = false; }
  async generate(): Promise<InferenceResponse> { throw new Error('runtime.generate must use the streaming adapter path'); }
  async *stream(request: InferenceRequest, signal: AbortSignal): AsyncIterable<InferenceStreamEvent> {
    this.lastRequest = request;
    if (this.failNextStream) { this.failNextStream = false; yield { type: 'ERROR', error: new LocalInferenceRuntimeError('INFERENCE_FAILED', 'fixture generation failure') }; return; }
    if (this.blockNextStream) {
      this.blockNextStream = false;
      await new Promise<void>((resolve, reject) => {
        if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
        signal.addEventListener('abort', () => { this.cancelled = true; reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
        void resolve;
      });
      return;
    }
    const isUrdu = request.messages.at(-1)?.content === 'ہیلو';
    yield { type: 'TOKEN', text: isUrdu ? 'سلام!' : 'hello' };
    yield { type: 'COMPLETE', response: response(isUrdu ? 'سلام!' : 'hello') };
  }
  async cancel(): Promise<void> { this.cancelled = true; }
  async dispose(): Promise<void> { this.disposed = true; this.loaded = false; }
}

async function run(): Promise<void> {
  const unavailable = createLocalInferenceRuntime();
  equal(unavailable.getStatus(), 'UNAVAILABLE', 'default browser runtime is unavailable');
  try { await unavailable.initialize(); throw new Error('unavailable runtime initialized'); }
  catch (error) { assert(error instanceof LocalInferenceRuntimeError && error.code === 'OFFLINE_TEXT_AI_UNAVAILABLE', 'unavailable runtime rejects initialization'); }
  await unavailable.dispose(); equal(unavailable.getStatus(), 'DISPOSED', 'unavailable runtime disposes safely');

  const adapter = new FakeAdapter(); const runtime = createLocalInferenceRuntime(adapter);
  await runtime.initialize(); await runtime.loadModel(reference()); equal(runtime.getStatus(), 'MODEL_READY', 'verified model reaches model ready');

  const englishRequest: InferenceRequest = { messages: [{ id: 'm-en', conversationId: 'c', role: 'user', content: 'hello' }] };
  const english = await runtime.generate(englishRequest);
  equal(english.text, 'hello', 'English generation completes through streaming path');
  equal(adapter.lastRequest?.messages.at(-1)?.content, 'hello', 'English input reaches adapter unchanged');

  const urdu = 'ہیلو';
  const urduRequest: InferenceRequest = { messages: [{ id: 'm-ur', conversationId: 'c', role: 'user', content: urdu }] };
  const urduResponse = await runtime.generate(urduRequest);
  equal(urduResponse.text, 'سلام!', 'Urdu generation completes through streaming path');
  equal(adapter.lastRequest?.messages.at(-1)?.content, urdu, 'Urdu Unicode reaches adapter unchanged');
  equal(runtime.getStatus(), 'MODEL_READY', 'Urdu generation returns to model ready');

  adapter.failNextStream = true;
  try { await runtime.generate(englishRequest); throw new Error('failed generation unexpectedly completed'); }
  catch (error) { assert(error instanceof LocalInferenceRuntimeError && error.code === 'INFERENCE_FAILED', 'generation failure is surfaced honestly'); }
  equal(runtime.getStatus(), 'MODEL_READY', 'generation failure preserves a reusable loaded-model state');
  const retry = await runtime.generate({ ...englishRequest, messages: [{ ...englishRequest.messages[0], id: 'm-en-retry', content: 'hello again' }] });
  equal(retry.text, 'hello', 'retry after generation failure starts a fresh generation');
  equal(adapter.lastRequest?.messages.at(-1)?.content, 'hello again', 'retry request reaches adapter independently');
  equal(runtime.getStatus(), 'MODEL_READY', 'retry leaves runtime reusable');

  adapter.blockNextStream = true;
  const generation = runtime.generate(englishRequest);
  await new Promise((resolve) => setTimeout(resolve, 0));
  equal(runtime.getStatus(), 'GENERATING', 'cancellation test reaches active generation');
  await runtime.cancel();
  try { await generation; throw new Error('cancelled generation completed'); }
  catch (error) { assert(error instanceof LocalInferenceRuntimeError && error.code === 'INFERENCE_CANCELLED', 'cancelled generation is surfaced honestly'); }
  equal(adapter.cancelled, true, 'adapter cancellation is invoked');
  equal(runtime.getStatus(), 'MODEL_READY', 'cancellation preserves loaded model state');

  const events: InferenceStreamEvent[] = [];
  for await (const event of runtime.stream(englishRequest)) events.push(event);
  equal(events.length, 2, 'stream emits token and completion events');
  equal(events[0].type, 'TOKEN', 'first stream event is token');
  equal(events[1].type, 'COMPLETE', 'stream completes');

  await runtime.unloadModel(); equal(runtime.getStatus(), 'READY', 'unload returns to ready');
  await runtime.dispose(); equal(runtime.getStatus(), 'DISPOSED', 'dispose reaches disposed');
  equal(adapter.disposed, true, 'adapter resources are disposed');
  try { await runtime.generate(englishRequest); throw new Error('generation after dispose accepted'); }
  catch (error) { assert(error instanceof LocalInferenceRuntimeError && error.code === 'INVALID_STATE', 'generation after dispose is rejected'); }

  console.log('Local inference runtime tests passed: streaming generation, exact Urdu preservation, failure recovery, cancellation, lifecycle, cleanup.');
}
run().catch((error: unknown) => { console.error(error); throw error; });
