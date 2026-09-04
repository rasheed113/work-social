import type { InferenceRequest, InferenceResponse, InferenceStreamEvent, LocalInferenceCapabilities, LocalInferenceRuntime, LocalInferenceRuntimeStatus, VerifiedLocalModelReference } from './localInferenceContracts';
import { BROWSER_LOCAL_INFERENCE_CAPABILITIES } from './localInferenceContracts';

/** Preserves Offline AI cancellation/normalization without imposing a generation deadline. */
export class StrictOfflineInferenceRuntime implements LocalInferenceRuntime {
  constructor(private readonly inner: LocalInferenceRuntime) {}
  getStatus(): LocalInferenceRuntimeStatus { return this.inner.getStatus(); }
  getCapabilities(): LocalInferenceCapabilities { return this.inner.getCapabilities?.() ?? BROWSER_LOCAL_INFERENCE_CAPABILITIES; }
  initialize(): Promise<void> { return this.inner.initialize(); }
  loadModel(model: VerifiedLocalModelReference): Promise<void> { return this.inner.loadModel(model); }
  unloadModel(): Promise<void> { return this.inner.unloadModel(); }
  cancel(): Promise<void> { return this.inner.cancel(); }
  dispose(): Promise<void> { return this.inner.dispose(); }

  generate(request: InferenceRequest): Promise<InferenceResponse> {
    const controller = new AbortController();
    const cleanupParent = linkAbortSignal(request.signal, controller);
    return this.inner.generate({ ...request, signal: controller.signal }).finally(cleanupParent);
  }

  async *stream(request: InferenceRequest): AsyncIterable<InferenceStreamEvent> {
    const controller = new AbortController();
    const cleanupParent = linkAbortSignal(request.signal, controller);
    const iterator = this.inner.stream({ ...request, signal: controller.signal })[Symbol.asyncIterator]();
    try {
      while (true) {
        const result = await iterator.next();
        if (result.done) break;
        yield result.value;
      }
    } finally {
      cleanupParent();
      if (request.signal?.aborted && iterator.return) void iterator.return().catch(() => undefined);
    }
  }
}

function linkAbortSignal(parent: AbortSignal | undefined, controller: AbortController): () => void {
  if (!parent) return () => undefined;
  if (parent.aborted) { controller.abort(); return () => undefined; }
  const onAbort = () => controller.abort();
  parent.addEventListener('abort', onAbort, { once: true });
  return () => parent.removeEventListener('abort', onAbort);
}
