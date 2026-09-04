import { StrictOfflineInferenceRuntime, OFFLINE_GENERATION_TIMEOUT_MS } from './strictOfflineInferenceRuntime';
import { LocalInferenceRuntimeError, type InferenceRequest, type InferenceResponse, type InferenceStreamEvent, type LocalInferenceCapabilities, type LocalInferenceRuntime, type LocalInferenceRuntimeStatus, type VerifiedLocalModelReference } from './localInferenceContracts';

function assert(condition: boolean, message: string): void { if (!condition) throw new Error(message); }
function equal<T>(actual: T, expected: T, message: string): void { assert(actual === expected, `${message}: expected ${String(expected)}, got ${String(actual)}`); }
function response(text = 'ok'): InferenceResponse { return { text, finishReason: 'STOP', usage: { promptTokens: null, completionTokens: null, totalTokens: null }, runtimeMetadata: { provider: 'local', runtime: 'fixture', modelId: 'fixture', modelVersion: '1' } }; }

class FakeRuntime implements LocalInferenceRuntime {
  private status: LocalInferenceRuntimeStatus = 'MODEL_READY';
  lastSignal: AbortSignal | null = null;
  aborted = false;
  emitToken = false;
  emitControlFirst = false;
  release: (() => void) | null = null;
  controlRelease: (() => void) | null = null;
  async initialize(): Promise<void> {}
  async loadModel(_model: VerifiedLocalModelReference): Promise<void> {}
  async unloadModel(): Promise<void> {}
  async generate(request: InferenceRequest): Promise<InferenceResponse> { this.lastSignal = request.signal ?? null; if (request.signal?.aborted) throw new LocalInferenceRuntimeError('INFERENCE_CANCELLED', 'cancelled'); return response(); }
  async *stream(request: InferenceRequest): AsyncIterable<InferenceStreamEvent> {
    this.lastSignal = request.signal ?? null;
    const signal = request.signal;
    if (!signal) throw new Error('signal missing');
    if (this.emitToken) {
      if (this.emitControlFirst) {
        yield { type: 'TOKEN', text: '' };
        await new Promise<void>((resolve) => { this.controlRelease = resolve; });
      }
      yield { type: 'TOKEN', text: 'hello' };
      await new Promise<void>((resolve) => {
        this.release = resolve;
        if (signal.aborted) { this.aborted = true; resolve(); return; }
        signal.addEventListener('abort', () => { this.aborted = true; resolve(); }, { once: true });
      });
      if (signal.aborted) { yield { type: 'ERROR', error: new LocalInferenceRuntimeError('INFERENCE_CANCELLED', 'cancelled') }; return; }
      yield { type: 'TOKEN', text: ' world' };
      yield { type: 'COMPLETE', response: response('hello world') };
      return;
    }
    await new Promise<void>((resolve) => { if (signal.aborted) { this.aborted = true; resolve(); return; } signal.addEventListener('abort', () => { this.aborted = true; resolve(); }, { once: true }); });
    yield { type: 'ERROR', error: new LocalInferenceRuntimeError('INFERENCE_CANCELLED', 'cancelled') };
  }
  async cancel(): Promise<void> { this.aborted = true; }
  getStatus(): LocalInferenceRuntimeStatus { return this.status; }
  getCapabilities(): LocalInferenceCapabilities { return { textGeneration: true, visionInput: false, multimodalInput: false, streaming: true, cancellation: true }; }
  async dispose(): Promise<void> { this.status = 'DISPOSED'; }
}

async function run(): Promise<void> {
  equal(OFFLINE_GENERATION_TIMEOUT_MS, 40_000, 'Offline first-token timeout is exactly 40 seconds');
  const runtime = new FakeRuntime(); let timeoutHandler: (() => void) | null = null; let cleared = false;
  const strict = new StrictOfflineInferenceRuntime(runtime, {
    setTimeoutImpl: (handler, timeout) => { equal(timeout, 40_000, 'authoritative first-token timeout is 40 seconds'); timeoutHandler = handler; return {} as ReturnType<typeof setTimeout>; },
    clearTimeoutImpl: () => { cleared = true; },
  });
  const request: InferenceRequest = { messages: [{ id: 'm', conversationId: 'c', role: 'user', content: 'hello' }] };

  const events: InferenceStreamEvent[] = [];
  const pending = (async () => { for await (const event of strict.stream(request)) events.push(event); })();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert(runtime.lastSignal !== null, 'stream receives an AbortSignal');
  assert(timeoutHandler !== null, 'thinking timeout is armed at generation start');
  timeoutHandler!();
  await pending;
  equal(runtime.aborted, true, 'timeout aborts the underlying runtime signal');
  equal(events.length, 1, 'timeout emits exactly one terminal error');
  equal(events[0].type, 'ERROR', 'timeout is an error, not a completion');
  assert(events[0].type === 'ERROR' && events[0].error instanceof LocalInferenceRuntimeError && events[0].error.code === 'OFFLINE_GENERATION_TIMEOUT', 'timeout has an explicit failure code');
  assert(events[0].type === 'ERROR' && events[0].error.message.includes('40 seconds'), 'timeout error is user-readable');
  equal(cleared, true, 'timeout timer is cleaned up');

  timeoutHandler = null; cleared = false; runtime.aborted = false; runtime.emitToken = true; runtime.emitControlFirst = true; runtime.release = null; runtime.controlRelease = null;
  const streamedEvents: InferenceStreamEvent[] = [];
  const streamed = (async () => { for await (const event of strict.stream(request)) streamedEvents.push(event); })();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert(timeoutHandler !== null, 'thinking timeout is armed before the first token');
  equal(streamedEvents.length, 1, 'control event is forwarded before the first genuine token');
  equal(streamedEvents[0].type, 'TOKEN', 'control fixture remains a token-shaped event');
  assert(streamedEvents[0].type === 'TOKEN' && streamedEvents[0].text.length === 0, 'empty token does not count as the first genuine token');
  equal(cleared, false, 'empty token does not clear the thinking timeout');
  assert(runtime.controlRelease !== null, 'control fixture is paused before the genuine token');
  runtime.controlRelease!();
  await new Promise((resolve) => setTimeout(resolve, 0));
  equal(streamedEvents.length, 2, 'first genuine token is forwarded immediately');
  equal(streamedEvents[1].type, 'TOKEN', 'genuine generated token is forwarded');
  equal(cleared, true, 'first genuine token permanently clears the thinking timeout');
  const raceCountBeforeGeneration = raceCallCount();
  timeoutHandler!();
  equal(runtime.aborted, false, 'an expired stale timeout callback cannot abort after the first token');
  runtime.release!();
  await streamed;
  equal(streamedEvents.length, 4, 'post-token generation continues without a timeout race');
  equal(streamedEvents[3].type, 'COMPLETE', 'post-token generation completes normally');
  equal(raceCallCount(), raceCountBeforeGeneration, 'no Promise.race calls occur after the first genuine token');

  timeoutHandler = null; cleared = false; runtime.aborted = false; runtime.emitToken = true; runtime.emitControlFirst = false; runtime.release = null;
  const parent = new AbortController();
  const abortedEvents: InferenceStreamEvent[] = [];
  const abortPending = (async () => { for await (const event of strict.stream({ ...request, signal: parent.signal })) abortedEvents.push(event); })();
  await new Promise((resolve) => setTimeout(resolve, 0));
  equal(abortedEvents.length, 1, 'first token arrives before explicit cancellation');
  equal(abortedEvents[0].type, 'TOKEN', 'cancellation test reaches generation phase');
  equal(cleared, true, 'post-token cancellation test has already cleared the thinking timer');
  parent.abort();
  await abortPending;
  equal(runtime.aborted, true, 'user cancellation still aborts the underlying runtime after the first token');
  equal(abortedEvents.length, 2, 'post-token cancellation emits one terminal cancellation event');
  assert(abortedEvents[1].type === 'ERROR' && abortedEvents[1].error instanceof LocalInferenceRuntimeError && abortedEvents[1].error.code === 'INFERENCE_CANCELLED', 'post-token cancellation is not mislabeled as timeout');

  timeoutHandler = null; cleared = false; runtime.aborted = false; runtime.emitToken = false;
  const success = await strict.generate(request);
  equal(success.text, 'ok', 'completed generation remains successful');
  assert(timeoutHandler !== null, 'non-streaming generation still arms the authoritative 40-second deadline');
  equal(cleared, true, 'successful generation clears its timer');

  console.log('Strict Offline inference tests passed: 40s first-token timeout, genuine-token detection, unrestricted post-token streaming, stale-timeout immunity, direct post-token iterator reads, post-token cancellation, cleanup, success, explicit abort.');
}

let raceCalls = 0;
const originalPromiseRace = Promise.race as <T>(iterable: Iterable<T | PromiseLike<T>>) => Promise<Awaited<T>>;
Object.defineProperty(Promise, 'race', {
  configurable: true,
  writable: true,
  value: function <T>(iterable: Iterable<T | PromiseLike<T>>): Promise<Awaited<T>> {
    raceCalls += 1;
    return originalPromiseRace(iterable);
  },
});
function raceCallCount(): number { return raceCalls; }

run().catch((error: unknown) => { console.error(error); throw error; }).finally(() => {
  Object.defineProperty(Promise, 'race', { configurable: true, writable: true, value: originalPromiseRace });
});
