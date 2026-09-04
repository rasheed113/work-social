import { StrictOfflineInferenceRuntime } from './strictOfflineInferenceRuntime';
import { LocalInferenceRuntimeError, type InferenceRequest, type InferenceResponse, type InferenceStreamEvent, type LocalInferenceCapabilities, type LocalInferenceRuntime, type LocalInferenceRuntimeStatus, type VerifiedLocalModelReference } from './localInferenceContracts';

function assert(condition: boolean, message: string): void { if (!condition) throw new Error(message); }
function equal<T>(actual: T, expected: T, message: string): void { assert(actual === expected, `${message}: expected ${String(expected)}, got ${String(actual)}`); }
function response(text = 'ok'): InferenceResponse { return { text, finishReason: 'STOP', usage: { promptTokens: null, completionTokens: null, totalTokens: null }, runtimeMetadata: { provider: 'local', runtime: 'fixture', modelId: 'fixture', modelVersion: '1' } }; }

class FakeRuntime implements LocalInferenceRuntime {
  private status: LocalInferenceRuntimeStatus = 'MODEL_READY';
  lastSignal: AbortSignal | null = null;
  aborted = false;
  async initialize(): Promise<void> {}
  async loadModel(_model: VerifiedLocalModelReference): Promise<void> {}
  async unloadModel(): Promise<void> {}
  async generate(request: InferenceRequest): Promise<InferenceResponse> { this.lastSignal = request.signal ?? null; if (request.signal?.aborted) throw new LocalInferenceRuntimeError('INFERENCE_CANCELLED', 'cancelled'); return response(); }
  async *stream(request: InferenceRequest): AsyncIterable<InferenceStreamEvent> {
    this.lastSignal = request.signal ?? null;
    const signal = request.signal;
    if (!signal) throw new Error('signal missing');
    await new Promise<void>((resolve) => { if (signal.aborted) { this.aborted = true; resolve(); return; } signal.addEventListener('abort', () => { this.aborted = true; resolve(); }, { once: true }); });
    yield { type: 'ERROR', error: new LocalInferenceRuntimeError('INFERENCE_CANCELLED', 'cancelled') };
  }
  async cancel(): Promise<void> { this.aborted = true; }
  getStatus(): LocalInferenceRuntimeStatus { return this.status; }
  getCapabilities(): LocalInferenceCapabilities { return { textGeneration: true, visionInput: false, multimodalInput: false, streaming: true, cancellation: true }; }
  async dispose(): Promise<void> { this.status = 'DISPOSED'; }
}

async function run(): Promise<void> {
  const runtime = new FakeRuntime();
  const strict = new StrictOfflineInferenceRuntime(runtime);
  const request: InferenceRequest = { messages: [{ id: 'm', conversationId: 'c', role: 'user', content: 'hello' }] };

  const success = await strict.generate(request);
  equal(success.text, 'ok', 'completed generation remains successful');
  assert(runtime.lastSignal !== null, 'generate receives an AbortSignal');
  equal(runtime.lastSignal?.aborted, false, 'normal generation is not pre-aborted');

  const parent = new AbortController();
  const abortedEvents: InferenceStreamEvent[] = [];
  const abortPending = (async () => { for await (const event of strict.stream({ ...request, signal: parent.signal })) abortedEvents.push(event); })();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert(runtime.lastSignal !== null, 'stream receives an AbortSignal');
  parent.abort();
  await abortPending;
  equal(runtime.aborted, true, 'explicit abort reaches the underlying runtime');
  equal(abortedEvents.length, 1, 'explicit abort emits one terminal error');
  assert(abortedEvents[0].type === 'ERROR' && abortedEvents[0].error instanceof LocalInferenceRuntimeError && abortedEvents[0].error.code === 'INFERENCE_CANCELLED', 'explicit abort remains cancellation');

  console.log('Strict Offline inference tests passed: no generation timeout, successful generation, AbortSignal propagation, explicit cancellation.');
}
run().catch((error: unknown) => { console.error(error); throw error; });
