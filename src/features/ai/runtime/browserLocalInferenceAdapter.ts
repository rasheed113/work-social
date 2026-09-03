import { Wllama, LoggerWithoutDebug } from '@wllama/wllama';
import type { InferenceRequest, InferenceResponse, InferenceStreamEvent, LocalInferenceCapabilities, LocalInferenceEngineAdapter, VerifiedLocalModelReference } from './localInferenceContracts';
import { LocalInferenceRuntimeError } from './localInferenceContracts';
import { sanitizeDiagnosticUrl, sanitizeMessage, offlineAiTrace, type LocalAiDiagnostic } from './localAiDiagnostics';
import { boundOfflineMessages, getOfflineWllamaThreadCount, OFFLINE_WLLAMA_BATCH_SIZE, OFFLINE_WLLAMA_CONTEXT_SIZE } from './offlineInferenceTuning';

const CAPABILITIES: LocalInferenceCapabilities = Object.freeze({ textGeneration: true, visionInput: false, multimodalInput: false, streaming: true, cancellation: true });
const DEFAULT_WLLAMA_WASM_PATH = 'wllama/wllama.wasm';
const DEFAULT_COMPAT_WASM_PATH = 'wllama-compat/wllama.wasm';
const DEFAULT_COMPAT_WORKER_PATH = 'wllama-compat/wllama.js';
export const WLLAMA_ASSET_CONFIG = Object.freeze({ default: resolvePublicAsset(DEFAULT_WLLAMA_WASM_PATH) });
export const WLLAMA_COMPAT_CONFIG = Object.freeze({ wasm: resolvePublicAsset(DEFAULT_COMPAT_WASM_PATH), worker: resolvePublicAsset(DEFAULT_COMPAT_WORKER_PATH) });
type WllamaEngine = Wllama & { setCompat: (compat: null | 'default' | { wasm: string; worker: string }) => void };
type WllamaEngineFactory = () => WllamaEngine;
type FetchLike = typeof fetch;

export function needsWllamaCompat(webAssembly: typeof WebAssembly = WebAssembly): boolean {
  const hasJSPI = typeof (webAssembly as unknown as { Suspending?: unknown }).Suspending !== 'undefined';
  if (!hasJSPI) return true;
  try { new webAssembly.Memory({ address: 'i64', initial: 1n } as unknown as WebAssembly.MemoryDescriptor); return false; }
  catch { return true; }
}

export class BrowserLocalInferenceAdapter implements LocalInferenceEngineAdapter {
  readonly name = 'wllama-llama.cpp-wasm';
  readonly streaming = true;
  readonly cancellation = true;
  readonly capabilities = CAPABILITIES;
  private engine: WllamaEngine | null = null;
  private loadedModelKey: string | null = null;
  private loadedModelMetadata: { modelId: string; modelVersion: string } | null = null;

  constructor(
    private readonly createEngine: WllamaEngineFactory = () => new Wllama(WLLAMA_ASSET_CONFIG, { logger: LoggerWithoutDebug }) as WllamaEngine,
    private readonly fetchAsset: FetchLike = (...args) => fetch(...args),
    private readonly compatibilityRequired: boolean = needsWllamaCompat(),
  ) {}

  async initialize(): Promise<void> {
    if (this.engine) return;
    offlineAiTrace('LOCAL_PROVIDER_SELECTED', { adapter: this.name });
    if (typeof WebAssembly === 'undefined') throw new LocalInferenceRuntimeError('RUNTIME_UNAVAILABLE', 'WebAssembly is unavailable in this browser.');
    try {
      this.engine = this.createEngine();
      if (this.compatibilityRequired) {
        await assertAssetFetchable(WLLAMA_COMPAT_CONFIG.wasm, 'WLLAMA_COMPAT_WASM_FETCH_FAILED', 'wllama.wasm', this.fetchAsset);
        await assertAssetFetchable(WLLAMA_COMPAT_CONFIG.worker, 'WLLAMA_WORKER_ASSET_FAILED', 'wllama.js', this.fetchAsset);
        this.engine.setCompat(WLLAMA_COMPAT_CONFIG);
      } else await assertAssetFetchable(WLLAMA_ASSET_CONFIG.default, 'WLLAMA_WASM_FETCH_FAILED', 'wllama.wasm', this.fetchAsset);
      offlineAiTrace('WLLAMA_LOAD_COMPLETED', { compatibilityRequired: this.compatibilityRequired });
    } catch (error) {
      this.engine = null;
      if (error instanceof LocalInferenceRuntimeError) throw error;
      throw new LocalInferenceRuntimeError('RUNTIME_INITIALIZATION_FAILED', sanitizeEngineError(error), makeDiagnostic('RUNTIME_INITIALIZATION_FAILED', 'The wllama runtime could not initialize.', undefined, error));
    }
  }

  async loadModel(model: VerifiedLocalModelReference): Promise<void> {
    if (!this.engine) throw new LocalInferenceRuntimeError('INVALID_STATE', 'The local inference engine is not initialized.');
    const key = `${model.model.id}|${model.model.version}|${model.model.sha256 ?? ''}`;
    if (this.loadedModelKey === key && this.engine.isModelLoaded()) { offlineAiTrace('MODEL_READY', { modelId: model.model.id, modelVersion: model.model.version, reused: true }); return; }
    const data = await model.readVerifiedModel();
    if (data.size === 0) throw new LocalInferenceRuntimeError('MODEL_INVALID', 'The verified local model is empty.');
    if (data.size !== model.model.sizeBytes) throw new LocalInferenceRuntimeError('MODEL_INVALID', `The verified local model has ${data.size} bytes; expected ${model.model.sizeBytes} bytes.`);
    try {
      const nThreads = getOfflineWllamaThreadCount();
      offlineAiTrace('WLLAMA_LOAD_STARTED', { modelId: model.model.id, modelVersion: model.model.version, bytes: data.size, nCtx: OFFLINE_WLLAMA_CONTEXT_SIZE, nBatch: OFFLINE_WLLAMA_BATCH_SIZE, nThreads });
      await this.engine.loadModel([data], { n_ctx: OFFLINE_WLLAMA_CONTEXT_SIZE, n_batch: OFFLINE_WLLAMA_BATCH_SIZE, n_threads: nThreads, n_gpu_layers: 0 });
      const loaded = this.engine.isModelLoaded();
      const actualThreads = loaded && typeof (this.engine as WllamaEngine & { getNumThreads?: () => number }).getNumThreads === 'function' ? (this.engine as WllamaEngine & { getNumThreads: () => number }).getNumThreads?.() : undefined;
      offlineAiTrace('MODEL_READY', { modelId: model.model.id, modelVersion: model.model.version, isModelLoaded: loaded, nCtx: OFFLINE_WLLAMA_CONTEXT_SIZE, nBatch: OFFLINE_WLLAMA_BATCH_SIZE, nThreads: actualThreads ?? nThreads, reused: false });
      if (!loaded) throw new Error('wllama.loadModel() completed without reporting a loaded model.');
      this.loadedModelKey = key;
      this.loadedModelMetadata = { modelId: model.model.id, modelVersion: model.model.version };
    } catch (error) {
      this.loadedModelKey = null; this.loadedModelMetadata = null;
      throw new LocalInferenceRuntimeError('MODEL_LOAD_FAILED', sanitizeEngineError(error), makeDiagnostic('MODEL_LOAD_FAILED', 'The verified Qwen GGUF could not be loaded by wllama.', model, error));
    }
  }

  async unloadModel(): Promise<void> {
    if (!this.engine) return;
    try { await this.engine.exit(); this.loadedModelKey = null; this.loadedModelMetadata = null; }
    catch (error) { throw new LocalInferenceRuntimeError('MODEL_LOAD_FAILED', sanitizeEngineError(error), makeDiagnostic('MODEL_LOAD_FAILED', 'The local model could not be unloaded.', undefined, error)); }
  }

  async generate(request: InferenceRequest, signal: AbortSignal): Promise<InferenceResponse> {
    if (!this.engine?.isModelLoaded() || !this.loadedModelMetadata) throw new LocalInferenceRuntimeError('MODEL_NOT_READY', 'The local model is not loaded.');
    if (request.attachments?.length) throw new LocalInferenceRuntimeError('VISION_NOT_SUPPORTED', 'The installed local model is text-only.');
    if (signal.aborted) throw new LocalInferenceRuntimeError('INFERENCE_CANCELLED', 'Local generation was cancelled.');
    const startedAt = nowMs();
    try {
      const boundedMessages = boundOfflineMessages(request.messages);
      offlineAiTrace('CREATE_CHAT_COMPLETION_STARTED', { generationId: request.diagnosticRequestId ?? null, messageCount: boundedMessages.length, maxTokens: request.maxTokens, startedAtMs: startedAt, streaming: false, wllamaInvoked: true });
      const response = await this.engine.createChatCompletion({ messages: toWllamaMessages({ ...request, messages: boundedMessages }), max_tokens: request.maxTokens, temperature: request.temperature, top_p: request.topP, abortSignal: signal });
      const completedAt = nowMs();
      offlineAiTrace('CREATE_CHAT_COMPLETION_COMPLETED', { generationId: request.diagnosticRequestId ?? null, responseType: typeof response, durationMs: completedAt - startedAt, completedAtMs: completedAt, streaming: false });
      const mapped = mapResponse(response, request.stopSequences ?? [], this.loadedModelMetadata);
      offlineAiTrace('RESPONSE_RECEIVED', { generationId: request.diagnosticRequestId ?? null, nonEmpty: mapped.text.trim().length > 0, durationMs: nowMs() - startedAt });
      return mapped;
    } catch (error) {
      if (signal.aborted) throw new LocalInferenceRuntimeError('INFERENCE_CANCELLED', 'Local generation was cancelled.');
      if (error instanceof LocalInferenceRuntimeError) throw error;
      throw new LocalInferenceRuntimeError('INFERENCE_FAILED', sanitizeEngineError(error), makeDiagnostic('INFERENCE_FAILED', 'Local generation failed.', undefined, error));
    }
  }

  async *stream(request: InferenceRequest, signal: AbortSignal): AsyncIterable<InferenceStreamEvent> {
    if (!this.engine?.isModelLoaded() || !this.loadedModelMetadata) { yield { type: 'ERROR', error: new LocalInferenceRuntimeError('MODEL_NOT_READY', 'The local model is not loaded.') }; return; }
    if (request.attachments?.length) { yield { type: 'ERROR', error: new LocalInferenceRuntimeError('VISION_NOT_SUPPORTED', 'The installed local model is text-only.') }; return; }
    if (signal.aborted) { yield { type: 'ERROR', error: new LocalInferenceRuntimeError('INFERENCE_CANCELLED', 'Local generation was cancelled.') }; return; }
    let text = '';
    let finishReason: InferenceResponse['finishReason'] = 'STOP';
    const startedAt = nowMs();
    const generationId = request.diagnosticRequestId ?? null;
    try {
      const boundedMessages = boundOfflineMessages(request.messages);
      offlineAiTrace('CREATE_CHAT_COMPLETION_STARTED', { generationId, messageCount: boundedMessages.length, maxTokens: request.maxTokens, startedAtMs: startedAt, streaming: true, wllamaInvoked: true });
      const result = await this.engine.createChatCompletion({ messages: toWllamaMessages({ ...request, messages: boundedMessages }), max_tokens: request.maxTokens, temperature: request.temperature, top_p: request.topP, stream: true, abortSignal: signal });
      if (!isAsyncIterable(result)) throw new LocalInferenceRuntimeError('INFERENCE_FAILED', 'The local engine did not return a stream.');
      let firstTokenAt: number | null = null;
      for await (const chunk of result) {
        const delta = readDelta(chunk);
        if (delta) {
          if (firstTokenAt === null) { firstTokenAt = nowMs(); offlineAiTrace('FIRST_TOKEN_RECEIVED', { generationId, durationMs: firstTokenAt - startedAt, firstTokenAtMs: firstTokenAt }); }
          const candidate = text + delta;
          const stopIndex = firstStopIndex(candidate, request.stopSequences ?? []);
          if (stopIndex >= 0) { const emitted = candidate.slice(text.length, stopIndex); if (emitted) yield { type: 'TOKEN', text: emitted }; text = candidate.slice(0, stopIndex); break; }
          text = candidate;
          yield { type: 'TOKEN', text: delta };
        }
        const rawFinish = readFinishReason(chunk);
        if (rawFinish === 'length') finishReason = 'LENGTH'; else if (rawFinish === 'stop') finishReason = 'STOP';
      }
      const completedAt = nowMs();
      offlineAiTrace('CREATE_CHAT_COMPLETION_COMPLETED', { generationId, durationMs: completedAt - startedAt, completedAtMs: completedAt, streaming: true, firstTokenDurationMs: firstTokenAt === null ? null : firstTokenAt - startedAt, streamTerminated: true, wllamaGeneratedText: text.length > 0 });
      if (signal.aborted) { yield { type: 'ERROR', error: new LocalInferenceRuntimeError('INFERENCE_CANCELLED', 'Local generation was cancelled.') }; return; }
      yield { type: 'COMPLETE', response: { text, finishReason, usage: { promptTokens: null, completionTokens: null, totalTokens: null }, runtimeMetadata: { provider: 'local', runtime: this.name, ...this.loadedModelMetadata } } };
      offlineAiTrace('RESPONSE_RECEIVED', { generationId, nonEmpty: text.trim().length > 0, durationMs: nowMs() - startedAt, streaming: true });
    } catch (error) {
      offlineAiTrace('GENERATION_FAILED', { generationId, errorCode: error instanceof LocalInferenceRuntimeError ? error.code : 'INFERENCE_FAILED', durationMs: nowMs() - startedAt });
      yield { type: 'ERROR', error: signal.aborted ? new LocalInferenceRuntimeError('INFERENCE_CANCELLED', 'Local generation was cancelled.') : error instanceof LocalInferenceRuntimeError ? error : new LocalInferenceRuntimeError('INFERENCE_FAILED', sanitizeEngineError(error), makeDiagnostic('INFERENCE_FAILED', 'Local streaming failed.', undefined, error)) };
    }
  }

  async cancel(): Promise<void> { }
  async dispose(): Promise<void> { if (!this.engine) return; try { await this.engine.exit(); } finally { this.engine = null; this.loadedModelKey = null; this.loadedModelMetadata = null; } }
}

async function assertAssetFetchable(url: string, code: 'WLLAMA_WASM_FETCH_FAILED' | 'WLLAMA_COMPAT_WASM_FETCH_FAILED' | 'WLLAMA_WORKER_ASSET_FAILED', resource: string, fetchImpl: FetchLike): Promise<void> {
  try { const response = await fetchImpl(url, { cache: 'no-store' }); if (!response.ok) throw new LocalInferenceRuntimeError(code, `The required ${resource} returned HTTP ${response.status}.`, makeDiagnostic(code, `The required ${resource} returned HTTP ${response.status}.`, undefined, undefined, response, resource, url)); }
  catch (error) { if (error instanceof LocalInferenceRuntimeError) throw error; throw new LocalInferenceRuntimeError(code, `The browser could not fetch ${resource}.`, makeDiagnostic(code, `The browser could not fetch ${resource}; no HTTP response was received.`, undefined, error, undefined, resource, url)); }
}
function makeDiagnostic(code: string, message: string, model?: VerifiedLocalModelReference, error?: unknown, response?: Response, resource?: string, url?: string): LocalAiDiagnostic { return { stage: code === 'WLLAMA_WASM_FETCH_FAILED' ? 'WLLAMA_WASM' : code === 'WLLAMA_COMPAT_WASM_FETCH_FAILED' ? 'WLLAMA_COMPAT_WASM' : code === 'WLLAMA_WORKER_ASSET_FAILED' ? 'WLLAMA_WORKER' : code === 'MODEL_LOAD_FAILED' ? 'MODEL_LOAD' : code === 'INFERENCE_FAILED' ? 'INFERENCE' : 'RUNTIME_INITIALIZATION', code, message, resource, url: sanitizeDiagnosticUrl(url), status: response?.status, statusText: response?.statusText, responseType: response?.type, errorName: error instanceof Error ? error.name : undefined, errorMessage: error instanceof Error ? sanitizeMessage(error.message) : undefined, cause: error instanceof Error ? sanitizeMessage(error.message) : undefined, timestamp: new Date().toISOString(), modelId: model?.model.id, modelVersion: model?.model.version }; }
function resolvePublicAsset(path: string): string { const base = typeof import.meta.env === 'object' && typeof import.meta.env.BASE_URL === 'string' ? import.meta.env.BASE_URL : '/'; return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`; }
function toWllamaMessages(request: InferenceRequest): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> { return request.messages.filter((message) => message.role !== 'tool').map((message) => ({ role: message.role as 'system' | 'user' | 'assistant', content: message.content })); }
type ChatResponseShape = { choices?: Array<{ message?: { content?: unknown }; finish_reason?: unknown }>; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
function mapResponse(response: unknown, stops: string[], metadata: { modelId: string; modelVersion: string }): InferenceResponse { const value = response as ChatResponseShape; const first = value?.choices?.[0]; const raw = typeof first?.message?.content === 'string' ? first.message.content : ''; if (!raw) throw new LocalInferenceRuntimeError('INFERENCE_FAILED', 'The local engine returned an empty completion.'); const stopIndex = firstStopIndex(raw, stops); return { text: stopIndex >= 0 ? raw.slice(0, stopIndex) : raw, finishReason: first?.finish_reason === 'length' ? 'LENGTH' : 'STOP', usage: { promptTokens: value.usage?.prompt_tokens ?? null, completionTokens: value.usage?.completion_tokens ?? null, totalTokens: value.usage?.total_tokens ?? null }, runtimeMetadata: { provider: 'local', runtime: 'wllama-llama.cpp-wasm', ...metadata } }; }
function firstStopIndex(text: string, stops: string[]): number { let index = -1; for (const stop of stops) { if (!stop) continue; const found = text.indexOf(stop); if (found >= 0 && (index < 0 || found < index)) index = found; } return index; }
function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> { return !!value && typeof value === 'object' && Symbol.asyncIterator in value; }
function readDelta(value: unknown): string { const chunk = value as { choices?: Array<{ delta?: { content?: unknown } }> }; return typeof chunk.choices?.[0]?.delta?.content === 'string' ? chunk.choices[0].delta.content : ''; }
function readFinishReason(value: unknown): string | null { const chunk = value as { choices?: Array<{ finish_reason?: unknown }> }; return typeof chunk.choices?.[0]?.finish_reason === 'string' ? chunk.choices[0].finish_reason : null; }
function sanitizeEngineError(error: unknown): string { return error instanceof Error ? sanitizeMessage(error.message) || 'Local inference engine failed.' : 'Local inference engine failed.' }
function nowMs(): number { return typeof performance !== 'undefined' && typeof performance.now === 'function' ? Math.round(performance.now()) : Date.now(); }
