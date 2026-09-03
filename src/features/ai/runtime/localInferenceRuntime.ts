import type { InferenceRequest, InferenceResponse, InferenceStreamEvent, LocalInferenceCapabilities, LocalInferenceEngineAdapter, LocalInferenceRuntime, LocalInferenceRuntimeStatus, VerifiedLocalModelReference } from './localInferenceContracts';
import { BROWSER_LOCAL_INFERENCE_CAPABILITIES, LocalInferenceRuntimeError, verifiedModelReferenceBrand } from './localInferenceContracts';
import type { AiModelType } from '../model/modelContracts';
import { sanitizeErrorMessage } from '../security/security';
import { offlineAiTrace, type LocalAiDiagnostic } from './localAiDiagnostics';

const UNAVAILABLE_REASON = 'No platform inference engine is registered for this web runtime.';
const GENERATION_TIMEOUT_MS = 5 * 60_000;
const GENERATION_IDLE_TIMEOUT_MS = 90_000;
let generationSequence = 0;

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
    this.capabilities = adapter
      ? {
          textGeneration: adapter.capabilities?.textGeneration ?? true,
          visionInput: adapter.capabilities?.visionInput ?? false,
          multimodalInput: adapter.capabilities?.multimodalInput ?? false,
          streaming: adapter.capabilities?.streaming ?? adapter.streaming,
          cancellation: adapter.capabilities?.cancellation ?? adapter.cancellation,
        }
      : BROWSER_LOCAL_INFERENCE_CAPABILITIES;
  }

  getStatus(): LocalInferenceRuntimeStatus { return this.status; }
  getCapabilities(): LocalInferenceCapabilities { return { ...this.capabilities }; }

  async initialize(): Promise<void> {
    this.requireAvailable();
    if (this.status === 'READY' || this.status === 'MODEL_READY') return;
    if (this.status === 'INITIALIZING' && this.initializePromise) return this.initializePromise;
    this.requireState('UNINITIALIZED');
    this.status = 'INITIALIZING';
    offlineAiTrace('LOCAL_RUNTIME_STATE', { state: this.status });
    const operation = this.adapter!.initialize()
      .then(() => {
        if (this.status !== 'DISPOSED') this.status = 'READY';
        offlineAiTrace('LOCAL_RUNTIME_STATE', { state: this.status });
      })
      .catch((error) => {
        if (this.status !== 'DISPOSED') this.status = 'ERROR';
        offlineAiTrace('LOCAL_RUNTIME_STATE', { state: this.status, errorCode: error instanceof LocalInferenceRuntimeError ? error.code : 'RUNTIME_INITIALIZATION_FAILED' });
        throw this.runtimeError(error, 'Runtime initialization failed.', 'RUNTIME_INITIALIZATION_FAILED');
      });
    this.initializePromise = operation;
    try { await operation; } finally { if (this.initializePromise === operation) this.initializePromise = null; }
  }

  async loadModel(model: VerifiedLocalModelReference): Promise<void> {
    this.requireAvailable();
    offlineAiTrace('MODEL_VERIFICATION_STARTED', { modelId: model?.model?.id ?? null, modelVersion: model?.model?.version ?? null });
    if (!model || model[verifiedModelReferenceBrand] !== true) {
      offlineAiTrace('MODEL_VERIFICATION_COMPLETED', { result: 'FAIL', modelId: model?.model?.id ?? null });
      throw new LocalInferenceRuntimeError('INVALID_MODEL_REFERENCE', 'Model must be issued by ModelManager after checksum verification.');
    }
    offlineAiTrace('MODEL_VERIFICATION_COMPLETED', { result: 'PASS', modelId: model.model.id, modelVersion: model.model.version });
    const modelKey = getModelKey(model);
    if (this.status === 'MODEL_READY' && sameModel(this.loadedModel, model)) return;
    if (this.status === 'LOADING_MODEL' && this.loadModelPromise) {
      if (this.loadingModelKey === modelKey) return this.loadModelPromise;
      throw new LocalInferenceRuntimeError('INVALID_STATE', 'A different model is already loading.');
    }
    this.requireState('READY', 'MODEL_READY');
    this.status = 'LOADING_MODEL';
    this.loadingModelKey = modelKey;
    offlineAiTrace('LOCAL_RUNTIME_STATE', { state: this.status, modelId: model.model.id, modelVersion: model.model.version });
    offlineAiTrace('MODEL_LOAD_STARTED', { modelId: model.model.id, modelVersion: model.model.version });
    const operation = (async () => {
      try {
        await model.readVerifiedModel();
        await this.adapter!.loadModel(model);
        this.loadedModel = model;
        if (this.status !== 'DISPOSED') this.status = 'MODEL_READY';
        offlineAiTrace('MODEL_LOAD_COMPLETED', { result: 'PASS', state: this.status, modelId: model.model.id, modelVersion: model.model.version });
        offlineAiTrace('LOCAL_RUNTIME_STATE', { state: this.status, modelId: model.model.id, modelVersion: model.model.version });
      } catch (error) {
        this.loadedModel = null;
        if (this.status !== 'DISPOSED') this.status = 'ERROR';
        offlineAiTrace('MODEL_LOAD_COMPLETED', { result: 'FAIL', modelId: model.model.id, modelVersion: model.model.version, errorCode: error instanceof LocalInferenceRuntimeError ? error.code : 'MODEL_LOAD_FAILED' });
        offlineAiTrace('LOCAL_RUNTIME_STATE', { state: this.status, modelId: model.model.id, modelVersion: model.model.version, errorCode: error instanceof LocalInferenceRuntimeError ? error.code : 'MODEL_LOAD_FAILED' });
        throw this.runtimeError(error, 'Verified model loading failed.', 'MODEL_LOAD_FAILED');
      }
    })();
    this.loadModelPromise = operation;
    try { await operation; } finally {
      if (this.loadModelPromise === operation) this.loadModelPromise = null;
      if (this.loadingModelKey === modelKey) this.loadingModelKey = null;
    }
  }

  async unloadModel(): Promise<void> {
    this.requireAvailable();
    this.requireState('MODEL_READY', 'ERROR');
    if (!this.loadedModel) {
      if (this.status === 'ERROR') return;
      throw new LocalInferenceRuntimeError('INVALID_STATE', 'No model is loaded.');
    }
    try {
      await this.adapter!.unloadModel();
      this.loadedModel = null;
      this.status = 'READY';
    } catch (error) {
      this.status = 'ERROR';
      throw this.runtimeError(error, 'Model unload failed.', 'MODEL_LOAD_FAILED');
    }
  }

  async generate(request: InferenceRequest): Promise<InferenceResponse> {
    this.requireAvailable();
    this.requireState('MODEL_READY');
    if (!this.loadedModel) throw new LocalInferenceRuntimeError('MODEL_NOT_READY', 'A verified model must be loaded before generation.');
    this.requireRequestCapability(request);
    const generationId = request.diagnosticRequestId ?? `local-generation-${++generationSequence}`;
    const { controller, signal, cleanup } = this.createGenerationSignal(request.signal);
    this.controller = controller;
    this.status = 'GENERATING';
    const startedAt = nowMs();
    const boundedInput = request.messages.map((message) => message.content.length).reduce((total, length) => total + length, 0);
    offlineAiTrace('GENERATION_STARTED', {
      generationId,
      runtime: this.adapter?.name ?? 'unknown',
      modelLoaded: true,
      messageCount: request.messages.length,
      inputCharCount: boundedInput,
      containsNonAscii: request.messages.some((message) => /[^\x00-\x7F]/.test(message.content)),
      startedAtMs: startedAt,
      contextSize: request.contextSize ?? null,
      maxTokens: request.maxTokens ?? null,
    });
    offlineAiTrace('LOCAL_RUNTIME_STATE', { state: this.status, generationId });

    let overallTimer: ReturnType<typeof setTimeout> | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let lastProgressAt = startedAt;
    const abortGeneration = (reason: 'timeout' | 'idle-timeout') => {
      if (signal.aborted) return;
      offlineAiTrace('GENERATION_ABORTED', { generationId, reason, elapsedMs: nowMs() - startedAt });
      controller.abort();
      if (this.capabilities.cancellation) void this.adapter!.cancel().catch(() => undefined);
    };
    const armIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => abortGeneration('idle-timeout'), GENERATION_IDLE_TIMEOUT_MS);
    };

    overallTimer = setTimeout(() => abortGeneration('timeout'), GENERATION_TIMEOUT_MS);
    armIdleTimer();
    try {
      if (!this.capabilities.streaming) {
        offlineAiTrace('CREATE_CHAT_COMPLETION_STARTED', { generationId, streaming: false, startedAtMs: startedAt });
        const response = await this.adapter!.generate({ ...request, signal, diagnosticRequestId: generationId }, signal);
        if (signal.aborted) throw new LocalInferenceRuntimeError('INFERENCE_CANCELLED', 'Local generation was cancelled.');
        const completedAt = nowMs();
        offlineAiTrace('CREATE_CHAT_COMPLETION_COMPLETED', { generationId, streaming: false, durationMs: completedAt - startedAt });
        offlineAiTrace('RESPONSE_RECEIVED', { generationId, nonEmpty: response.text.trim().length > 0, durationMs: completedAt - startedAt });
        this.status = 'MODEL_READY';
        offlineAiTrace('RESPONSE_RENDERED', { generationId, state: this.status, nonEmpty: response.text.trim().length > 0 });
        return response;
      }

      offlineAiTrace('CREATE_CHAT_COMPLETION_STARTED', { generationId, streaming: true, startedAtMs: startedAt });
      let accumulated = '';
      let completion: InferenceResponse | null = null;
      let firstTokenAt: number | null = null;
      let completed = false;
      for await (const event of this.adapter!.stream({ ...request, signal, diagnosticRequestId: generationId }, signal)) {
        lastProgressAt = nowMs();
        armIdleTimer();
        if (event.type === 'TOKEN') {
          if (firstTokenAt === null) {
            firstTokenAt = lastProgressAt;
            offlineAiTrace('FIRST_TOKEN_RECEIVED', { generationId, durationMs: firstTokenAt - startedAt, firstTokenAtMs: firstTokenAt });
          }
          accumulated += event.text;
        } else if (event.type === 'COMPLETE') {
          completion = event.response;
          completed = true;
        } else if (event.type === 'ERROR') {
          offlineAiTrace('GENERATION_FAILED', { generationId, errorCode: event.error instanceof LocalInferenceRuntimeError ? event.error.code : 'INFERENCE_FAILED', durationMs: lastProgressAt - startedAt });
          throw event.error;
        }
      }
      if (signal.aborted) throw new LocalInferenceRuntimeError('INFERENCE_CANCELLED', 'Local generation was cancelled.');
      if (!completed || !completion) throw new LocalInferenceRuntimeError('INFERENCE_FAILED', 'The local streaming generation ended without a completion event.');
      const response = accumulated.length > 0 ? { ...completion, text: accumulated } : completion;
      const completedAt = nowMs();
      offlineAiTrace('CREATE_CHAT_COMPLETION_COMPLETED', { generationId, streaming: true, durationMs: completedAt - startedAt, firstTokenDurationMs: firstTokenAt === null ? null : firstTokenAt - startedAt, streamTerminated: true });
      offlineAiTrace('RESPONSE_RECEIVED', { generationId, nonEmpty: response.text.trim().length > 0, durationMs: completedAt - startedAt, streaming: true });
      if (!response.text.trim()) throw new LocalInferenceRuntimeError('INFERENCE_FAILED', 'The local runtime returned an empty response.');
      this.status = 'MODEL_READY';
      offlineAiTrace('RESPONSE_RENDERED', { generationId, state: this.status, nonEmpty: true });
      return response;
    } catch (error) {
      this.status = signal.aborted ? 'MODEL_READY' : 'ERROR';
      const code = error instanceof LocalInferenceRuntimeError ? error.code : 'INFERENCE_FAILED';
      if (signal.aborted) {
        if (code !== 'INFERENCE_CANCELLED') offlineAiTrace('GENERATION_ABORTED', { generationId, reason: 'signal-aborted', elapsedMs: nowMs() - startedAt });
        throw new LocalInferenceRuntimeError('INFERENCE_CANCELLED', 'Local generation was cancelled.');
      }
      offlineAiTrace('GENERATION_FAILED', { generationId, errorCode: code, durationMs: nowMs() - startedAt });
      throw this.runtimeError(error, 'Local generation failed.', 'INFERENCE_FAILED');
    } finally {
      if (overallTimer) clearTimeout(overallTimer);
      if (idleTimer) clearTimeout(idleTimer);
      cleanup();
      if (this.controller === controller) this.controller = null;
      offlineAiTrace('LOCAL_RUNTIME_STATE', { state: this.status, generationId, cleanupCompleted: true, lastProgressMs: lastProgressAt - startedAt });
    }
  }

  async *stream(request: InferenceRequest): AsyncIterable<InferenceStreamEvent> {
    this.requireAvailable();
    this.requireState('MODEL_READY');
    if (!this.loadedModel) throw new LocalInferenceRuntimeError('MODEL_NOT_READY', 'A verified model must be loaded before streaming.');
    this.requireRequestCapability(request);
    if (!this.capabilities.streaming) throw new LocalInferenceRuntimeError('INFERENCE_FAILED', 'This local runtime does not support streaming.');
    const { controller, signal, cleanup } = this.createGenerationSignal(request.signal);
    this.controller = controller;
    this.status = 'GENERATING';
    const generationId = request.diagnosticRequestId ?? `local-stream-${++generationSequence}`;
    try {
      offlineAiTrace('GENERATION_STARTED', { generationId, runtime: this.adapter?.name ?? 'unknown', streaming: true, modelLoaded: true, messageCount: request.messages.length, startedAtMs: nowMs() });
      offlineAiTrace('CREATE_CHAT_COMPLETION_STARTED', { generationId, streaming: true, startedAtMs: nowMs() });
      let completed = false;
      for await (const event of this.adapter!.stream({ ...request, signal, diagnosticRequestId: generationId }, signal)) {
        if (event.type === 'TOKEN') offlineAiTrace('FIRST_TOKEN_RECEIVED', { generationId, note: 'stream-token' });
        if (event.type === 'ERROR') {
          this.status = 'ERROR';
          offlineAiTrace('GENERATION_FAILED', { generationId, errorCode: event.error instanceof LocalInferenceRuntimeError ? event.error.code : 'INFERENCE_FAILED' });
          yield event;
          return;
        }
        if (event.type === 'COMPLETE') completed = true;
        yield event;
      }
      if (signal.aborted) {
        this.status = 'MODEL_READY';
        yield { type: 'ERROR', error: new LocalInferenceRuntimeError('INFERENCE_CANCELLED', 'Local streaming was cancelled.') };
        return;
      }
      if (!completed) {
        this.status = 'ERROR';
        const error = new LocalInferenceRuntimeError('INFERENCE_FAILED', 'The local streaming generation ended without a completion event.');
        offlineAiTrace('GENERATION_FAILED', { generationId, errorCode: error.code });
        yield { type: 'ERROR', error };
        return;
      }
      if (this.status === 'GENERATING') this.status = 'MODEL_READY';
      offlineAiTrace('CREATE_CHAT_COMPLETION_COMPLETED', { generationId, streaming: true, streamTerminated: true });
    } catch (error) {
      this.status = signal.aborted ? 'MODEL_READY' : 'ERROR';
      offlineAiTrace(signal.aborted ? 'GENERATION_ABORTED' : 'GENERATION_FAILED', { generationId, errorCode: error instanceof LocalInferenceRuntimeError ? error.code : 'INFERENCE_FAILED' });
      yield { type: 'ERROR', error: signal.aborted ? new LocalInferenceRuntimeError('INFERENCE_CANCELLED', 'Local streaming was cancelled.') : this.runtimeError(error, 'Local streaming failed.', 'INFERENCE_FAILED') };
    } finally {
      cleanup();
      if (this.controller === controller) this.controller = null;
      offlineAiTrace('LOCAL_RUNTIME_STATE', { state: this.status, generationId, cleanupCompleted: true });
    }
  }

  async cancel(): Promise<void> {
    this.requireAvailable();
    this.requireState('GENERATING');
    if (!this.controller) throw new LocalInferenceRuntimeError('INVALID_STATE', 'No generation is active.');
    this.status = 'CANCELLING';
    offlineAiTrace('GENERATION_ABORTED', { reason: 'user-cancel' });
    this.controller.abort();
    if (this.capabilities.cancellation) await this.adapter!.cancel();
    this.status = 'MODEL_READY';
    this.controller = null;
  }

  async dispose(): Promise<void> {
    if (this.status === 'DISPOSED') return;
    if (!this.adapter) { this.status = 'DISPOSED'; this.loadedModel = null; return; }
    try {
      this.controller?.abort();
      if (this.capabilities.cancellation && this.controller) await this.adapter.cancel();
      if (this.loadedModel) await this.adapter.unloadModel();
      await this.adapter.dispose();
      this.loadedModel = null;
      this.controller = null;
      this.initializePromise = null;
      this.loadModelPromise = null;
      this.loadingModelKey = null;
      this.status = 'DISPOSED';
    } catch (error) {
      this.status = 'ERROR';
      throw this.runtimeError(error, 'Runtime disposal failed.', 'INFERENCE_FAILED');
    }
  }

  private requireRequestCapability(request: InferenceRequest): void {
    const modality = request.modality ?? (request.attachments?.length ? 'VISION' : 'TEXT');
    const modelType = this.loadedModel!.model.type as AiModelType;
    if (modality === 'TEXT') {
      if (!this.capabilities.textGeneration) throw new LocalInferenceRuntimeError('MODEL_INCOMPATIBLE', 'The loaded local runtime cannot execute text generation.');
      return;
    }
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

  private requireAvailable(): void {
    if (!this.adapter || this.status === 'UNAVAILABLE') throw new LocalInferenceRuntimeError('OFFLINE_TEXT_AI_UNAVAILABLE', UNAVAILABLE_REASON);
    if (this.status === 'DISPOSED') throw new LocalInferenceRuntimeError('INVALID_STATE', 'Local inference runtime has been disposed.');
  }

  private requireState(...allowed: LocalInferenceRuntimeStatus[]): void {
    if (!allowed.includes(this.status)) throw new LocalInferenceRuntimeError('INVALID_STATE', `Invalid runtime state: ${this.status}`);
  }

  private runtimeError(error: unknown, fallback: string, code: 'MODEL_LOAD_FAILED' | 'INFERENCE_FAILED' | 'RUNTIME_INITIALIZATION_FAILED'): LocalInferenceRuntimeError {
    if (error instanceof LocalInferenceRuntimeError) return error;
    const message = error instanceof Error ? sanitizeErrorMessage(error.message) : fallback;
    const diagnostic = (error as { diagnostic?: LocalAiDiagnostic } | null)?.diagnostic;
    return new LocalInferenceRuntimeError(code, message || fallback, diagnostic);
  }
}

function getModelKey(model: VerifiedLocalModelReference): string { return `${model.model.id}|${model.model.version}|${model.model.sha256 ?? ''}`; }
function sameModel(left: VerifiedLocalModelReference | null, right: VerifiedLocalModelReference): boolean { return !!left && getModelKey(left) === getModelKey(right); }
function nowMs(): number { return typeof performance !== 'undefined' && typeof performance.now === 'function' ? Math.round(performance.now()) : Date.now(); }
export function createLocalInferenceRuntime(adapter?: LocalInferenceEngineAdapter): LocalInferenceRuntime { return new DefaultLocalInferenceRuntime(adapter ?? null); }
export type { LocalInferenceEngineAdapter } from './localInferenceContracts';
