import type {
  InferenceRequest, InferenceResponse, InferenceStreamEvent, LocalInferenceEngineAdapter,
  LocalInferenceRuntime, LocalInferenceRuntimeStatus, VerifiedLocalModelReference,
} from './localInferenceContracts';
import { LocalInferenceRuntimeError, verifiedModelReferenceBrand } from './localInferenceContracts';

const UNAVAILABLE_REASON = 'No platform inference engine is registered for this web runtime.';

/** Deterministic lifecycle wrapper around a future platform/native inference adapter. */
export class DefaultLocalInferenceRuntime implements LocalInferenceRuntime {
  private status: LocalInferenceRuntimeStatus;
  private loadedModel: VerifiedLocalModelReference | null = null;
  private controller: AbortController | null = null;

  constructor(private readonly adapter: LocalInferenceEngineAdapter | null = null) {
    this.status = adapter ? 'UNINITIALIZED' : 'UNAVAILABLE';
  }
  getStatus(): LocalInferenceRuntimeStatus { return this.status; }

  async initialize(): Promise<void> {
    this.requireAvailable(); this.requireState('UNINITIALIZED'); this.status = 'INITIALIZING';
    try { await this.adapter!.initialize(); this.status = 'READY'; }
    catch (error) { this.status = 'ERROR'; throw this.runtimeError(error, 'Runtime initialization failed.'); }
  }

  async loadModel(model: VerifiedLocalModelReference): Promise<void> {
    this.requireAvailable(); this.requireState('READY', 'MODEL_READY');
    if (!model || model[verifiedModelReferenceBrand] !== true) {
      throw new LocalInferenceRuntimeError('INVALID_MODEL_REFERENCE', 'Model must be issued by ModelManager after checksum verification.');
    }
    this.status = 'LOADING_MODEL';
    try {
      await model.readVerifiedModel();
      await this.adapter!.loadModel(model);
      this.loadedModel = model; this.status = 'MODEL_READY';
    } catch (error) { this.loadedModel = null; this.status = 'ERROR'; throw this.runtimeError(error, 'Verified model loading failed.'); }
  }

  async unloadModel(): Promise<void> {
    this.requireAvailable(); this.requireState('MODEL_READY', 'ERROR');
    if (!this.loadedModel) {
      if (this.status === 'ERROR') return;
      throw new LocalInferenceRuntimeError('INVALID_STATE', 'No model is loaded.');
    }
    try { await this.adapter!.unloadModel(); this.loadedModel = null; this.status = 'READY'; }
    catch (error) { this.status = 'ERROR'; throw this.runtimeError(error, 'Model unload failed.'); }
  }

  async generate(request: InferenceRequest): Promise<InferenceResponse> {
    this.requireAvailable(); this.requireState('MODEL_READY');
    if (!this.loadedModel) throw new LocalInferenceRuntimeError('MODEL_NOT_READY', 'A verified model must be loaded before generation.');
    const { controller, signal } = this.createGenerationSignal(request.signal);
    this.controller = controller; this.status = 'GENERATING';
    try {
      const response = await this.adapter!.generate({ ...request, signal }, signal);
      this.status = 'MODEL_READY'; return response;
    } catch (error) {
      this.status = signal.aborted ? 'MODEL_READY' : 'ERROR';
      if (signal.aborted) throw new LocalInferenceRuntimeError('GENERATION_CANCELLED', 'Local generation was cancelled.');
      throw this.runtimeError(error, 'Local generation failed.');
    } finally { if (this.controller === controller) this.controller = null; }
  }

  async *stream(request: InferenceRequest): AsyncIterable<InferenceStreamEvent> {
    this.requireAvailable(); this.requireState('MODEL_READY');
    if (!this.loadedModel) throw new LocalInferenceRuntimeError('MODEL_NOT_READY', 'A verified model must be loaded before streaming.');
    if (!this.adapter!.streaming) throw new LocalInferenceRuntimeError('RUNTIME_ERROR', 'This local runtime does not support streaming.');
    const { controller, signal } = this.createGenerationSignal(request.signal);
    this.controller = controller; this.status = 'GENERATING';
    try {
      for await (const event of this.adapter!.stream({ ...request, signal }, signal)) {
        yield event;
        if (event.type === 'ERROR') { this.status = 'ERROR'; return; }
      }
      if (this.status === 'GENERATING') this.status = 'MODEL_READY';
    } catch (error) {
      this.status = signal.aborted ? 'MODEL_READY' : 'ERROR';
      yield { type: 'ERROR', error: signal.aborted
        ? new LocalInferenceRuntimeError('GENERATION_CANCELLED', 'Local streaming was cancelled.')
        : this.runtimeError(error, 'Local streaming failed.') };
    } finally { if (this.controller === controller) this.controller = null; }
  }

  async cancel(): Promise<void> {
    this.requireAvailable(); this.requireState('GENERATING');
    if (!this.controller) throw new LocalInferenceRuntimeError('INVALID_STATE', 'No generation is active.');
    this.status = 'CANCELLING'; this.controller.abort();
    if (this.adapter!.cancellation) await this.adapter!.cancel();
    this.status = 'MODEL_READY'; this.controller = null;
  }

  async dispose(): Promise<void> {
    if (this.status === 'DISPOSED') return;
    if (!this.adapter) { this.status = 'DISPOSED'; this.loadedModel = null; return; }
    try {
      this.controller?.abort();
      if (this.loadedModel) await this.adapter.unloadModel();
      await this.adapter.dispose();
      this.loadedModel = null; this.controller = null; this.status = 'DISPOSED';
    } catch (error) { this.status = 'ERROR'; throw this.runtimeError(error, 'Runtime disposal failed.'); }
  }

  private createGenerationSignal(parent?: AbortSignal): { controller: AbortController; signal: AbortSignal } {
    const controller = new AbortController();
    if (parent) {
      if (parent.aborted) controller.abort();
      else parent.addEventListener('abort', () => controller.abort(), { once: true });
    }
    return { controller, signal: controller.signal };
  }
  private requireAvailable(): void {
    if (!this.adapter || this.status === 'UNAVAILABLE') throw new LocalInferenceRuntimeError('LOCAL_RUNTIME_UNAVAILABLE', UNAVAILABLE_REASON);
    if (this.status === 'DISPOSED') throw new LocalInferenceRuntimeError('INVALID_STATE', 'Local inference runtime has been disposed.');
  }
  private requireState(...allowed: LocalInferenceRuntimeStatus[]): void {
    if (!allowed.includes(this.status)) throw new LocalInferenceRuntimeError('INVALID_STATE', `Invalid runtime state: ${this.status}.`);
  }
  private runtimeError(error: unknown, fallback: string): LocalInferenceRuntimeError {
    return error instanceof LocalInferenceRuntimeError ? error : new LocalInferenceRuntimeError('RUNTIME_ERROR', error instanceof Error ? error.message : fallback);
  }
}

export function createLocalInferenceRuntime(adapter?: LocalInferenceEngineAdapter): LocalInferenceRuntime {
  return new DefaultLocalInferenceRuntime(adapter ?? null);
}
