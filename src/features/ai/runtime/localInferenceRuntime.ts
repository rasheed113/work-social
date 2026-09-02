import type { InferenceRequest, InferenceResponse, InferenceStreamEvent, LocalInferenceCapabilities, LocalInferenceEngineAdapter, LocalInferenceRuntime, LocalInferenceRuntimeStatus, VerifiedLocalModelReference } from './localInferenceContracts';
import { BROWSER_LOCAL_INFERENCE_CAPABILITIES, LocalInferenceRuntimeError, verifiedModelReferenceBrand } from './localInferenceContracts';
import type { AiModelType } from '../model/modelContracts';
import { sanitizeErrorMessage } from '../security/security';

const UNAVAILABLE_REASON = 'No platform inference engine is registered for this web runtime.';

/** Deterministic lifecycle wrapper around a future platform/native inference adapter. */
export class DefaultLocalInferenceRuntime implements LocalInferenceRuntime {
  private status: LocalInferenceRuntimeStatus;
  private loadedModel: VerifiedLocalModelReference | null = null;
  private controller: AbortController | null = null;
  private initializePromise: Promise<void> | null = null;
  private loadModelPromise: Promise<void> | null = null;
  private loadingModelKey: string | null = null;
  private readonly capabilities: LocalInferenceCapabilities;

  constructor(private readonly adapter: LocalInferenceEngineAdapter | null = null) {
    this.status = adapter ? 'UNINITIALIZED' : 'UNAVAILABLE';
    this.capabilities = adapter ? { textGeneration: adapter.capabilities?.textGeneration ?? true, visionInput: adapter.capabilities?.visionInput ?? false, multimodalInput: adapter.capabilities?.multimodalInput ?? false, streaming: adapter.capabilities?.streaming ?? adapter.streaming, cancellation: adapter.capabilities?.cancellation ?? adapter.cancellation } : BROWSER_LOCAL_INFERENCE_CAPABILITIES;
  }
  getStatus(): LocalInferenceRuntimeStatus { return this.status; }
  getCapabilities(): LocalInferenceCapabilities { return { ...this.capabilities }; }
  async initialize(): Promise<void> {
    this.requireAvailable();
    if (this.status === 'READY' || this.status === 'MODEL_READY') return;
    if (this.status === 'INITIALIZING' && this.initializePromise) return this.initializePromise;
    this.requireState('UNINITIALIZED');
    this.status = 'INITIALIZING';
    const operation = this.adapter!.initialize().then(() => {
      if (this.status !== 'DISPOSED') this.status = 'READY';
    }).catch((error) => {
      if (this.status !== 'DISPOSED') this.status = 'ERROR';
      throw this.runtimeError(error, 'Runtime initialization failed.', 'MODEL_LOAD_FAILED');
    });
    this.initializePromise = operation;
    try { await operation; } finally { if (this.initializePromise === operation) this.initializePromise = null; }
  }
  async loadModel(model: VerifiedLocalModelReference): Promise<void> {
    this.requireAvailable();
    if (!model || model[verifiedModelReferenceBrand] !== true) throw new LocalInferenceRuntimeError('INVALID_MODEL_REFERENCE', 'Model must be issued by ModelManager after checksum verification.');
    const modelKey = getModelKey(model);
    if (this.status === 'MODEL_READY' && sameModel(this.loadedModel, model)) return;
    if (this.status === 'LOADING_MODEL' && this.loadModelPromise) {
      if (this.loadingModelKey === modelKey) return this.loadModelPromise;
      throw new LocalInferenceRuntimeError('INVALID_STATE', 'A different model is already loading.');
    }
    this.requireState('READY', 'MODEL_READY');
    this.status = 'LOADING_MODEL';
    this.loadingModelKey = modelKey;
    const operation = (async () => {
      try { await model.readVerifiedModel(); await this.adapter!.loadModel(model); this.loadedModel = model; if (this.status !== 'DISPOSED') this.status = 'MODEL_READY'; }
      catch (error) { this.loadedModel = null; if (this.status !== 'DISPOSED') this.status = 'ERROR'; throw this.runtimeError(error, 'Verified model loading failed.', 'MODEL_LOAD_FAILED'); }
    })();
    this.loadModelPromise = operation;
    try { await operation; } finally {
      if (this.loadModelPromise === operation) this.loadModelPromise = null;
      if (this.loadingModelKey === modelKey) this.loadingModelKey = null;
    }
  }
  async unloadModel(): Promise<void> {
    this.requireAvailable(); this.requireState('MODEL_READY', 'ERROR');
    if (!this.loadedModel) { if (this.status === 'ERROR') return; throw new LocalInferenceRuntimeError('INVALID_STATE', 'No model is loaded.'); }
    try { await this.adapter!.unloadModel(); this.loadedModel = null; this.status = 'READY'; }
    catch (error) { this.status = 'ERROR'; throw this.runtimeError(error, 'Model unload failed.', 'MODEL_LOAD_FAILED'); }
  }
  async generate(request: InferenceRequest): Promise<InferenceResponse> {
    this.requireAvailable(); this.requireState('MODEL_READY');
    if (!this.loadedModel) throw new LocalInferenceRuntimeError('MODEL_NOT_READY', 'A verified model must be loaded before generation.');
    this.requireRequestCapability(request);
    const { controller, signal, cleanup } = this.createGenerationSignal(request.signal); this.controller = controller; this.status = 'GENERATING';
    try { const response = await this.adapter!.generate({ ...request, signal }, signal); this.status = 'MODEL_READY'; return response; }
    catch (error) { this.status = signal.aborted ? 'MODEL_READY' : 'ERROR'; if (signal.aborted) throw new LocalInferenceRuntimeError('INFERENCE_CANCELLED', 'Local generation was cancelled.'); throw this.runtimeError(error, 'Local generation failed.', 'INFERENCE_FAILED'); }
    finally { cleanup(); if (this.controller === controller) this.controller = null; }
  }
  async *stream(request: InferenceRequest): AsyncIterable<InferenceStreamEvent> {
    this.requireAvailable(); this.requireState('MODEL_READY');
    if (!this.loadedModel) throw new LocalInferenceRuntimeError('MODEL_NOT_READY', 'A verified model must be loaded before streaming.');
    this.requireRequestCapability(request);
    if (!this.capabilities.streaming) throw new LocalInferenceRuntimeError('INFERENCE_FAILED', 'This local runtime does not support streaming.');
    const { controller, signal, cleanup } = this.createGenerationSignal(request.signal); this.controller = controller; this.status = 'GENERATING';
    try {
      for await (const event of this.adapter!.stream({ ...request, signal }, signal)) { yield event; if (event.type === 'ERROR') { this.status = 'ERROR'; return; } }
      if (this.status === 'GENERATING') this.status = 'MODEL_READY';
    } catch (error) {
      this.status = signal.aborted ? 'MODEL_READY' : 'ERROR';
      yield { type: 'ERROR', error: signal.aborted ? new LocalInferenceRuntimeError('INFERENCE_CANCELLED', 'Local streaming was cancelled.') : this.runtimeError(error, 'Local streaming failed.', 'INFERENCE_FAILED') };
    } finally { cleanup(); if (this.controller === controller) this.controller = null; }
  }
  async cancel(): Promise<void> {
    this.requireAvailable(); this.requireState('GENERATING');
    if (!this.controller) throw new LocalInferenceRuntimeError('INVALID_STATE', 'No generation is active.');
    this.status = 'CANCELLING'; this.controller.abort();
    if (this.capabilities.cancellation) await this.adapter!.cancel();
    this.status = 'MODEL_READY'; this.controller = null;
  }
  async dispose(): Promise<void> {
    if (this.status === 'DISPOSED') return;
    if (!this.adapter) { this.status = 'DISPOSED'; this.loadedModel = null; return; }
    try { this.controller?.abort(); if (this.capabilities.cancellation && this.controller) await this.adapter.cancel(); if (this.loadedModel) await this.adapter.unloadModel(); await this.adapter.dispose(); this.loadedModel = null; this.controller = null; this.initializePromise = null; this.loadModelPromise = null; this.loadingModelKey = null; this.status = 'DISPOSED'; }
    catch (error) { this.status = 'ERROR'; throw this.runtimeError(error, 'Runtime disposal failed.', 'INFERENCE_FAILED'); }
  }
  private requireRequestCapability(request: InferenceRequest): void {
    const modality = request.modality ?? (request.attachments?.length ? 'VISION' : 'TEXT');
    const modelType = this.loadedModel!.model.type as AiModelType;
    if (modality === 'TEXT') { if (!this.capabilities.textGeneration) throw new LocalInferenceRuntimeError('MODEL_INCOMPATIBLE', 'The loaded local runtime cannot execute text generation.'); return; }
    if (modality === 'VISION') {
      if (!request.attachments?.length || request.attachments.some((attachment) => attachment.kind !== 'image')) throw new LocalInferenceRuntimeError('INVALID_STATE', 'Vision inference requires image attachments only.');
      if (!this.capabilities.visionInput && !this.capabilities.multimodalInput) throw new LocalInferenceRuntimeError('VISION_RUNTIME_UNAVAILABLE', 'The local runtime does not support vision input.');
      if (modelType !== 'VISION' && modelType !== 'MULTIMODAL') throw new LocalInferenceRuntimeError('VISION_NOT_SUPPORTED', 'The loaded local model is not vision-capable.');
      return;
    }
    if (!this.capabilities.multimodalInput) throw new LocalInferenceRuntimeError('VISION_RUNTIME_UNAVAILABLE', 'The local runtime does not support multimodal input.');
    if (modelType !== 'MULTIMODAL') throw new LocalInferenceRuntimeError('VISION_NOT_SUPPORTED', 'The loaded local model is not multimodal.');
  }
  private createGenerationSignal(parent?: AbortSignal): { controller: AbortController; signal: AbortSignal; cleanup: () => void } {
    const controller = new AbortController();
    if (!parent) return { controller, signal: controller.signal, cleanup: () => undefined };
    if (parent.aborted) { controller.abort(); return { controller, signal: controller.signal, cleanup: () => undefined }; }
    const onAbort = () => controller.abort();
    parent.addEventListener('abort', onAbort, { once: true });
    return { controller, signal: controller.signal, cleanup: () => parent.removeEventListener('abort', onAbort) };
  }
  private requireAvailable(): void { if (!this.adapter || this.status === 'UNAVAILABLE') throw new LocalInferenceRuntimeError('OFFLINE_TEXT_AI_UNAVAILABLE', UNAVAILABLE_REASON); if (this.status === 'DISPOSED') throw new LocalInferenceRuntimeError('INVALID_STATE', 'Local inference runtime has been disposed.'); }
  private requireState(...allowed: LocalInferenceRuntimeStatus[]): void { if (!allowed.includes(this.status)) throw new LocalInferenceRuntimeError('INVALID_STATE', `Invalid runtime state: ${this.status}.`); }
  private runtimeError(error: unknown, fallback: string, code: 'MODEL_LOAD_FAILED' | 'INFERENCE_FAILED'): LocalInferenceRuntimeError {
    if (error instanceof LocalInferenceRuntimeError) return error;
    const message = error instanceof Error ? sanitizeErrorMessage(error.message) : fallback;
    return new LocalInferenceRuntimeError(code, message || fallback);
  }
}
function getModelKey(model: VerifiedLocalModelReference): string { return `${model.model.id}|${model.model.version}|${model.model.sha256 ?? ''}`; }
function sameModel(left: VerifiedLocalModelReference | null, right: VerifiedLocalModelReference): boolean { return !!left && getModelKey(left) === getModelKey(right); }
export function createLocalInferenceRuntime(adapter?: LocalInferenceEngineAdapter): LocalInferenceRuntime { return new DefaultLocalInferenceRuntime(adapter ?? null); }
