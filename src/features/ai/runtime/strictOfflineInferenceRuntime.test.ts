import { StrictOfflineInferenceRuntime, OFFLINE_GENERATION_TIMEOUT_MS } from './strictOfflineInferenceRuntime';
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
  equal(OFFLINE_GENERATION_TIMEOUT_MS, 120_000, 'Offline generation deadline is exactly 120 seconds');
  const runtime = new FakeRuntime(); let timeoutHandler: (() => void) | null = null; let cleared = false;
  const strict = new StrictOfflineInferenceRuntime(runtime, {
    setTimeoutImpl: (handler, timeout) => { equal(timeout, 120_000, 'authoritative timeout is 120 seconds'); timeoutHandler = handler; return {} as ReturnType<typeof setTimeout>; },
    clearTimeoutImpl: () => { cleared = true; },
  });
  const request: InferenceRequest = { messages: [{ id: 'm', conversationId: 'c', role: 'user', content: 'hello' }] };

  const events: InferenceStreamEvent[] = [];
  const pending = (async () => { for await (const event of strict.stream(request)) events.push(event); })();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert(runtime.lastSignal !== null, 'stream receives an AbortSignal');
  assert(timeoutHandler !== null, 'timeout is armed at generation start');
  timeoutHandler!();
  await pending;
  equal(runtime.aborted, true, 'timeout aborts the underlying runtime signal');
  equal(events.length, 1, 'timeout emits exactly one terminal error');
  equal(events[0].type, 'ERROR', 'timeout is an error, not a completion');
  assert(events[0].type === 'ERROR' && events[0].error instanceof LocalInferenceRuntimeError && events[0].error.code === 'OFFLINE_GENERATION_TIMEOUT', 'timeout has an explicit failure code');
  assert(events[0].type === 'ERROR' && events[0].error.message.includes('120 seconds'), 'timeout error is user-readable');
  equal(cleared, true, 'timeout timer is cleaned up');

  timeoutHandler = null; cleared = false; runtime.aborted = false;
  const success = await strict.generate(request);
  equal(success.text, 'ok', 'completed generation remains successful');
  assert(timeoutHandler !== null, 'generate also arms the same 120-second deadline');
  equal(cleared, true, 'successful generation clears its timer');

  const parent = new AbortController(); timeoutHandler = null; cleared = false; runtime.aborted = false;
  const abortedEvents: InferenceStreamEvent[] = [];
  const abortPending = (async () => { for await (const event of strict.stream({ ...request, signal: parent.signal })) abortedEvents.push(event); })();
  await new Promise((resolve) => setTimeout(resolve, 0));
  parent.abort();
  await abortPending;
  equal(abortedEvents.length, 1, 'explicit abort emits one terminal error');
  assert(abortedEvents[0].type === 'ERROR' && abortedEvents[0].error instanceof LocalInferenceRuntimeError && abortedEvents[0].error.code === 'INFERENCE_CANCELLED', 'explicit abort is not mislabeled as timeout');
  equal(cleared, true, 'abort timer is cleaned up');

  console.log('Strict Offline inference tests passed: exact 120s timeout, underlying abort propagation, honest timeout failure, cleanup, success, explicit abort.');
}
run().catch((error: unknown) => { console.error(error); throw error; });