import type { InferenceRequest, InferenceResponse, InferenceStreamEvent, LocalInferenceCapabilities, LocalInferenceRuntime, LocalInferenceRuntimeStatus, VerifiedLocalModelReference } from './localInferenceContracts';
import { BROWSER_LOCAL_INFERENCE_CAPABILITIES, LocalInferenceRuntimeError } from './localInferenceContracts';
import { offlineAiTrace } from './localAiDiagnostics';

export const OFFLINE_GENERATION_TIMEOUT_MS = 40_000;
type TimeoutHandle = ReturnType<typeof setTimeout>;
type SetTimeoutLike = (handler: () => void, timeout: number) => TimeoutHandle;
type ClearTimeoutLike = (handle: TimeoutHandle) => void;
export interface StrictOfflineInferenceRuntimeOptions { setTimeoutImpl?: SetTimeoutLike; clearTimeoutImpl?: ClearTimeoutLike; }

/** Enforces the single product-level Offline AI generation deadline. */
export class StrictOfflineInferenceRuntime implements LocalInferenceRuntime {
  private readonly setTimeoutImpl: SetTimeoutLike;
  private readonly clearTimeoutImpl: ClearTimeoutLike;
  constructor(private readonly inner: LocalInferenceRuntime, options: StrictOfflineInferenceRuntimeOptions = {}) {
    this.setTimeoutImpl = options.setTimeoutImpl ?? ((handler, timeout) => setTimeout(handler, timeout));
    this.clearTimeoutImpl = options.clearTimeoutImpl ?? ((handle) => clearTimeout(handle));
  }
  getStatus(): LocalInferenceRuntimeStatus { return this.inner.getStatus(); }
  getCapabilities(): LocalInferenceCapabilities { return this.inner.getCapabilities?.() ?? BROWSER_LOCAL_INFERENCE_CAPABILITIES; }
  initialize(): Promise<void> { return this.inner.initialize(); }
  loadModel(model: VerifiedLocalModelReference): Promise<void> { return this.inner.loadModel(model); }
  unloadModel(): Promise<void> { return this.inner.unloadModel(); }
  cancel(): Promise<void> { return this.inner.cancel(); }
  dispose(): Promise<void> { return this.inner.dispose(); }

  async generate(request: InferenceRequest): Promise<InferenceResponse> {
    const generationId = request.diagnosticRequestId ?? null;
    const controller = new AbortController();
    const cleanupParent = linkAbortSignal(request.signal, controller);
    let timedOut = false;
    let timer: TimeoutHandle | null = null;
    let rejectTimeout: ((reason?: unknown) => void) | null = null;
    const startedAt = nowMs();
    const timeout = () => {
      if (controller.signal.aborted) return;
      timedOut = true;
      offlineAiTrace('TIMEOUT', { generationId, elapsedMs: nowMs() - startedAt, timeoutMs: OFFLINE_GENERATION_TIMEOUT_MS });
      controller.abort();
      rejectTimeout?.(timeoutError(generationId, startedAt));
    };
    const timeoutPromise = new Promise<never>((_, reject) => { rejectTimeout = reject; timer = this.setTimeoutImpl(timeout, OFFLINE_GENERATION_TIMEOUT_MS); });
    try {
      return await Promise.race([this.inner.generate({ ...request, signal: controller.signal }), timeoutPromise]);
    } catch (error) {
      if (timedOut) throw timeoutError(generationId, startedAt);
      throw error;
    } finally {
      if (timer !== null) this.clearTimeoutImpl(timer);
      cleanupParent();
    }
  }

  async *stream(request: InferenceRequest): AsyncIterable<InferenceStreamEvent> {
    const generationId = request.diagnosticRequestId ?? null;
    const controller = new AbortController();
    const cleanupParent = linkAbortSignal(request.signal, controller);
    let timedOut = false;
    let firstTokenReceived = false;
    let timer: TimeoutHandle | null = null;
    let rejectTimeout: ((reason?: unknown) => void) | null = null;
    const startedAt = nowMs();
    const timeout = () => {
      if (controller.signal.aborted || firstTokenReceived) return;
      timedOut = true;
      offlineAiTrace('TIMEOUT', { generationId, elapsedMs: nowMs() - startedAt, timeoutMs: OFFLINE_GENERATION_TIMEOUT_MS });
      controller.abort();
      rejectTimeout?.(timeoutError(generationId, startedAt));
    };
    const timeoutPromise = new Promise<never>((_, reject) => { rejectTimeout = reject; timer = this.setTimeoutImpl(timeout, OFFLINE_GENERATION_TIMEOUT_MS); });
    const iterator = this.inner.stream({ ...request, signal: controller.signal })[Symbol.asyncIterator]();
    try {
      while (true) {
        const result = await Promise.race([iterator.next(), timeoutPromise]);
        if (result.done) break;
        if (timedOut) {
          yield { type: 'ERROR', error: timeoutError(generationId, startedAt) };
          return;
        }
        if (result.value.type === 'TOKEN' && result.value.text.length > 0) {
          firstTokenReceived = true;
          if (timer !== null) {
            this.clearTimeoutImpl(timer);
            timer = null;
          }
          yield result.value;
          break;
        }
        yield result.value;
      }

      if (timedOut) {
        yield { type: 'ERROR', error: timeoutError(generationId, startedAt) };
        return;
      }

      while (true) {
        const result = await iterator.next();
        if (result.done) break;
        yield result.value;
      }
    } catch (error) {
      if (timedOut) {
        yield { type: 'ERROR', error: timeoutError(generationId, startedAt) };
        return;
      }
      throw error;
    } finally {
      if (timer !== null) this.clearTimeoutImpl(timer);
      cleanupParent();
      if (timedOut && iterator.return) void iterator.return().catch(() => undefined);
    }
  }
}

function timeoutError(generationId: string | null, startedAt: number): LocalInferenceRuntimeError {
  offlineAiTrace('GENERATION_FAILED', { generationId, errorCode: 'OFFLINE_GENERATION_TIMEOUT', durationMs: nowMs() - startedAt });
  return new LocalInferenceRuntimeError('OFFLINE_GENERATION_TIMEOUT', `Offline AI generation timed out after ${OFFLINE_GENERATION_TIMEOUT_MS / 1000} seconds.`);
}
function linkAbortSignal(parent: AbortSignal | undefined, controller: AbortController): () => void {
  if (!parent) return () => undefined;
  if (parent.aborted) { controller.abort(); return () => undefined; }
  const onAbort = () => controller.abort();
  parent.addEventListener('abort', onAbort, { once: true });
  return () => parent.removeEventListener('abort', onAbort);
}
function nowMs(): number { return typeof performance !== 'undefined' && typeof performance.now === 'function' ? Math.round(performance.now()) : Date.now(); }
