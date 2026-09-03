import { Wllama, LoggerWithoutDebug } from '@wllama/wllama';
import type { InferenceRequest, InferenceResponse, InferenceStreamEvent, LocalInferenceCapabilities, LocalInferenceEngineAdapter, VerifiedLocalModelReference } from './localInferenceContracts';
import { LocalInferenceRuntimeError } from './localInferenceContracts';

const CAPABILITIES: LocalInferenceCapabilities = Object.freeze({ textGeneration: true, visionInput: false, multimodalInput: false, streaming: true, cancellation: true });
export const WLLAMA_ASSET_CONFIG = Object.freeze({ default: '/wllama/wllama.wasm' });
export const WLLAMA_COMPAT_CONFIG = Object.freeze({ wasm: '/wllama-compat/wllama.wasm', worker: '/wllama-compat/wllama.js' });
type WllamaEngine = Wllama & { setCompat: (compat: null | 'default' | { wasm: string; worker: string }) => void };
type WllamaEngineFactory = () => WllamaEngine;

/** Mirrors wllama's compatibility decision without depending on its private helpers. */
export function needsWllamaCompat(webAssembly: typeof WebAssembly = WebAssembly): boolean {
  const hasJSPI = typeof (webAssembly as unknown as { Suspending?: unknown }).Suspending !== 'undefined';
  if (!hasJSPI) return true;
  try {
    new webAssembly.Memory({ address: 'i64', initial: 1n } as unknown as WebAssembly.MemoryDescriptor);
    return false;
  } catch {
    return true;
  }
}

export class BrowserLocalInferenceAdapter implements LocalInferenceEngineAdapter {
  readonly name = 'wllama-llama.cpp-wasm'; readonly streaming = true; readonly cancellation = true; readonly capabilities = CAPABILITIES;
  private engine: WllamaEngine | null = null; private loadedModelKey: string | null = null;
  constructor(private readonly createEngine: WllamaEngineFactory = () => new Wllama(WLLAMA_ASSET_CONFIG, { logger: LoggerWithoutDebug }) as WllamaEngine) {}

  async initialize(): Promise<void> {
    if (this.engine) return;
    if (typeof WebAssembly === 'undefined') throw new LocalInferenceRuntimeError('RUNTIME_UNAVAILABLE', 'WebAssembly is unavailable in this browser.');
    try {
      this.engine = this.createEngine();
      // Phase 18.1 forced non-compat mode. That breaks browsers without JSPI/MEMORY64.
      // Keep the default wllama path on capable browsers and use bundled compat assets only when required.
      if (needsWllamaCompat()) this.engine.setCompat(WLLAMA_COMPAT_CONFIG);
    } catch (error) {
      this.engine = null;
      throw new LocalInferenceRuntimeError('RUNTIME_UNAVAILABLE', sanitizeEngineError(error));
    }
  }

  async loadModel(model: VerifiedLocalModelReference): Promise<void> {
    if (!this.engine) throw new LocalInferenceRuntimeError('INVALID_STATE', 'The local inference engine is not initialized.');
    const key = `${model.model.id}|${model.model.version}|${model.model.sha256 ?? ''}`;
    if (this.loadedModelKey === key && this.engine.isModelLoaded()) return;
    const data = await model.readVerifiedModel();
    if (data.size === 0) throw new LocalInferenceRuntimeError('MODEL_INVALID', 'The verified local model is empty.');
    try { await this.engine.loadModel([data], { n_ctx: 2048, n_gpu_layers: 99999 }); this.loadedModelKey = key; }
    catch (error) { this.loadedModelKey = null; throw new LocalInferenceRuntimeError('MODEL_LOAD_FAILED', sanitizeEngineError(error)); }
  }
  async unloadModel(): Promise<void> { if (!this.engine) return; try { await this.engine.exit(); this.loadedModelKey = null; } catch (error) { throw new LocalInferenceRuntimeError('MODEL_LOAD_FAILED', sanitizeEngineError(error)); } }
  async generate(request: InferenceRequest, signal: AbortSignal): Promise<InferenceResponse> {
    if (!this.engine?.isModelLoaded()) throw new LocalInferenceRuntimeError('MODEL_NOT_READY', 'The local model is not loaded.');
    if (request.attachments?.length) throw new LocalInferenceRuntimeError('VISION_NOT_SUPPORTED', 'The installed local model is text-only.');
    if (signal.aborted) throw new LocalInferenceRuntimeError('INFERENCE_CANCELLED', 'Local generation was cancelled.');
    try {
      const response = await this.engine.createChatCompletion({ messages: toWllamaMessages(request), max_tokens: request.maxTokens, temperature: request.temperature, top_p: request.topP, abortSignal: signal });
      return mapResponse(response, request.stopSequences ?? []);
    } catch (error) {
      if (signal.aborted) throw new LocalInferenceRuntimeError('INFERENCE_CANCELLED', 'Local generation was cancelled.');
      if (error instanceof LocalInferenceRuntimeError) throw error;
      throw new LocalInferenceRuntimeError('INFERENCE_FAILED', sanitizeEngineError(error));
    }
  }
  async *stream(request: InferenceRequest, signal: AbortSignal): AsyncIterable<InferenceStreamEvent> {
    if (!this.engine?.isModelLoaded()) { yield { type: 'ERROR', error: new LocalInferenceRuntimeError('MODEL_NOT_READY', 'The local model is not loaded.') }; return; }
    if (request.attachments?.length) { yield { type: 'ERROR', error: new LocalInferenceRuntimeError('VISION_NOT_SUPPORTED', 'The installed local model is text-only.') }; return; }
    if (signal.aborted) { yield { type: 'ERROR', error: new LocalInferenceRuntimeError('INFERENCE_CANCELLED', 'Local generation was cancelled.') }; return; }
    let text = ''; let finishReason: InferenceResponse['finishReason'] = 'STOP';
    try {
      const result = await this.engine.createChatCompletion({ messages: toWllamaMessages(request), max_tokens: request.maxTokens, temperature: request.temperature, top_p: request.topP, stream: true, abortSignal: signal });
      if (!isAsyncIterable(result)) throw new LocalInferenceRuntimeError('INFERENCE_FAILED', 'The local engine did not return a stream.');
      for await (const chunk of result) {
        const delta = readDelta(chunk);
        if (delta) {
          const candidate = text + delta; const stopIndex = firstStopIndex(candidate, request.stopSequences ?? []);
          if (stopIndex >= 0) { const emitted = candidate.slice(text.length, stopIndex); if (emitted) yield { type: 'TOKEN', text: emitted }; text = candidate.slice(0, stopIndex); break; }
          text = candidate; yield { type: 'TOKEN', text: delta };
        }
        const rawFinish = readFinishReason(chunk); if (rawFinish === 'length') finishReason = 'LENGTH'; else if (rawFinish === 'stop') finishReason = 'STOP';
      }
      if (signal.aborted) { yield { type: 'ERROR', error: new LocalInferenceRuntimeError('INFERENCE_CANCELLED', 'Local generation was cancelled.') }; return; }
      yield { type: 'COMPLETE', response: { text, finishReason, usage: { promptTokens: null, completionTokens: null, totalTokens: null }, runtimeMetadata: { provider: 'local', runtime: this.name, modelId: 'loaded-local-model', modelVersion: 'loaded' } } };
    } catch (error) { yield { type: 'ERROR', error: signal.aborted ? new LocalInferenceRuntimeError('INFERENCE_CANCELLED', 'Local generation was cancelled.') : error instanceof LocalInferenceRuntimeError ? error : new LocalInferenceRuntimeError('INFERENCE_FAILED', sanitizeEngineError(error)) }; }
  }
  async cancel(): Promise<void> {}
  async dispose(): Promise<void> { if (!this.engine) return; try { await this.engine.exit(); } finally { this.engine = null; this.loadedModelKey = null; } }
}
function toWllamaMessages(request: InferenceRequest): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> { return request.messages.filter((message) => message.role !== 'tool').map((message) => ({ role: message.role as 'system' | 'user' | 'assistant', content: message.content })); }
type ChatResponseShape = { choices?: Array<{ message?: { content?: unknown }; finish_reason?: unknown }>; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
function mapResponse(response: unknown, stops: string[]): InferenceResponse { const value = response as ChatResponseShape; const first = value?.choices?.[0]; const raw = typeof first?.message?.content === 'string' ? first.message.content : ''; if (!raw) throw new LocalInferenceRuntimeError('INFERENCE_FAILED', 'The local engine returned an empty completion.'); const stopIndex = firstStopIndex(raw, stops); return { text: stopIndex >= 0 ? raw.slice(0, stopIndex) : raw, finishReason: first?.finish_reason === 'length' ? 'LENGTH' : 'STOP', usage: { promptTokens: value.usage?.prompt_tokens ?? null, completionTokens: value.usage?.completion_tokens ?? null, totalTokens: value.usage?.total_tokens ?? null }, runtimeMetadata: { provider: 'local', runtime: 'wllama-llama.cpp-wasm', modelId: 'loaded-local-model', modelVersion: 'loaded' } }; }
function firstStopIndex(text: string, stops: string[]): number { let index = -1; for (const stop of stops) { if (!stop) continue; const found = text.indexOf(stop); if (found >= 0 && (index < 0 || found < index)) index = found; } return index; }
function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> { return !!value && typeof value === 'object' && Symbol.asyncIterator in value; }
function readDelta(value: unknown): string { const chunk = value as { choices?: Array<{ delta?: { content?: unknown } }> }; return typeof chunk.choices?.[0]?.delta?.content === 'string' ? chunk.choices[0].delta.content : ''; }
function readFinishReason(value: unknown): string | null { const chunk = value as { choices?: Array<{ finish_reason?: unknown }> }; return typeof chunk.choices?.[0]?.finish_reason === 'string' ? chunk.choices[0].finish_reason : null; }
function sanitizeEngineError(error: unknown): string { if (error instanceof LocalInferenceRuntimeError) return error.message; if (error instanceof Error) return error.message.replace(/https?:\/\/[^\s]+/gi, '[remote-url-redacted]').replace(/(?:api[_-]?key|token|authorization)\s*[:=]\s*[^\s,;]+/gi, '[secret-redacted]').slice(0, 500) || 'Local inference engine failed.'; return 'Local inference engine failed.'; }
