import type { ModelManager } from '../model/modelManager';
import { PRIMARY_LOCAL_TEXT_MODEL } from '../model/primaryLocalTextModel';
import { webLocalAi } from '../runtime/webLocalAi';
import { LocalInferenceRuntimeError, type LocalInferenceRuntime, type InferenceRequest, type InferenceResponse } from '../runtime/localInferenceContracts';
import type { AiAttachment, AiGenerationOptions, AiMessage, AiProvider, AiProviderStatus, AiResponse } from './contracts';
import { validateVisionImages } from '../vision/imageValidator';
import { isVisionModelCapable } from '../model/modelCapability';
import { offlineAiTrace } from '../runtime/localAiDiagnostics';
import type { LocalActionBridgeResult } from '../assistant/localActionBridge';
import { detectLocalWorkAction } from '../assistant/localWorkActionIntent';
import { boundOfflineMessages, OFFLINE_DEFAULT_MAX_TOKENS, OFFLINE_WLLAMA_CONTEXT_SIZE } from '../runtime/offlineInferenceTuning';

export const OFFLINE_TEXT_AI_UNAVAILABLE = 'OFFLINE_TEXT_AI_UNAVAILABLE';
export const LOCAL_RUNTIME_UNAVAILABLE = OFFLINE_TEXT_AI_UNAVAILABLE;
export const LOCAL_AI_NOT_INSTALLED = 'Local inference is unavailable in the current web runtime.';
export const LOCAL_AI_UNSUPPORTED_ATTACHMENT = 'Offline local AI does not support non-image attachments in this phase.';
const DEFAULT_MAX_TOKENS = OFFLINE_DEFAULT_MAX_TOKENS;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_TOP_P = 0.9;
const DEFAULT_CONTEXT_SIZE = OFFLINE_WLLAMA_CONTEXT_SIZE;
const MAX_TOKENS = 2048;
const MAX_CONTEXT_SIZE = 8192;
const MAX_STOP_SEQUENCES = 8;
const DEFAULT_UNAVAILABLE_CAPABILITIES = { textGeneration: false, visionInput: false, multimodalInput: false, streaming: false, cancellation: false } as const;
export type LocalActionBridge = (text: string, generatedResponse: string, conversationId: string | null) => Promise<LocalActionBridgeResult>;

export class LocalAiProvider implements AiProvider {
  readonly id = 'local' as const;
  readonly mode = 'offline' as const;
  constructor(private readonly runtime: LocalInferenceRuntime = webLocalAi.runtime, private readonly modelManager: ModelManager | null = webLocalAi.modelManager, private readonly modelId: string = PRIMARY_LOCAL_TEXT_MODEL.id, private readonly actionBridge: LocalActionBridge | null = null) {}
  async prepare(): Promise<void> { await webLocalAi.prepare(); }

  getStatus(): AiProviderStatus {
    if (webLocalAi.isPreparing()) return { state: 'unavailable', provider: this.id, mode: this.mode, reason: 'Offline AI is downloading and preparing the local model.', reasonCode: 'MODEL_DOWNLOADING' };
    const runtimeState = this.runtime.getStatus();
    if (runtimeState === 'UNAVAILABLE') return { state: 'unavailable', provider: this.id, mode: this.mode, reason: LOCAL_AI_NOT_INSTALLED, reasonCode: OFFLINE_TEXT_AI_UNAVAILABLE };
    if (!this.modelManager) return { state: 'unavailable', provider: this.id, mode: this.mode, reason: 'No ModelManager is connected to the local provider.', reasonCode: 'RUNTIME_UNAVAILABLE' };
    const model = this.modelManager.getModel(this.modelId);
    if (!model || model.status === 'NOT_INSTALLED' || model.status === 'DOWNLOADING' || model.status === 'VERIFYING') return { state: 'unavailable', provider: this.id, mode: this.mode, reason: 'No verified local model is installed.', reasonCode: model?.status === 'DOWNLOADING' ? 'MODEL_DOWNLOADING' : model?.status === 'VERIFYING' ? 'MODEL_VERIFYING' : 'MODEL_NOT_INSTALLED' };
    if (model.status === 'INVALID' || model.status === 'FAILED') return { state: 'unavailable', provider: this.id, mode: this.mode, reason: 'The local model is invalid and cannot be executed.', reasonCode: 'MODEL_INVALID' };
    if (runtimeState === 'MODEL_READY') {
      const provenance = this.runtime === webLocalAi.runtime && this.modelManager === webLocalAi.modelManager ? webLocalAi.getProvenance() : null;
      const reason = provenance ? `Verified local model is loaded and executable. provider=${provenance.provider}; runtime=${provenance.runtime}; model=${provenance.model}; source=${provenance.source}.` : 'Verified local model and executable local runtime are ready; exact source provenance is not known in this session.';
      return { state: 'ready', provider: this.id, mode: this.mode, reason, reasonCode: 'LOCAL_RUNTIME_READY' };
    }
    return { state: 'unavailable', provider: this.id, mode: this.mode, reason: runtimeState === 'UNINITIALIZED' ? 'Local runtime is not initialized.' : `Local runtime state is ${runtimeState}.`, reasonCode: runtimeState === 'INITIALIZING' ? 'RUNTIME_INITIALIZING' : runtimeState === 'LOADING_MODEL' ? 'MODEL_LOADING' : runtimeState === 'ERROR' ? 'MODEL_LOAD_FAILED' : 'LOCAL_RUNTIME_UNAVAILABLE' };
  }

  async getRoutingStatus(attachments: AiAttachment[] = []): Promise<AiProviderStatus> {
    const images = attachments.filter((attachment) => attachment.kind === 'image'); const files = attachments.filter((attachment) => attachment.kind !== 'image');
    if (files.length > 0) return { state: 'unavailable', provider: this.id, mode: this.mode, reason: LOCAL_AI_UNSUPPORTED_ATTACHMENT, reasonCode: 'UNSUPPORTED_ATTACHMENT' };
    if (images.length > 0) { await validateVisionImages(images); const capabilities = this.runtime.getCapabilities?.() ?? DEFAULT_UNAVAILABLE_CAPABILITIES; if (!capabilities.visionInput && !capabilities.multimodalInput) return { state: 'unavailable', provider: this.id, mode: this.mode, reason: 'The local runtime does not expose a verified vision-capable execution capability.', reasonCode: 'VISION_RUNTIME_UNAVAILABLE' }; }
    if (webLocalAi.isPreparing()) return { state: 'unavailable', provider: this.id, mode: this.mode, reason: 'Offline AI is downloading and preparing the local model.', reasonCode: 'MODEL_DOWNLOADING' };
    const runtimeState = this.runtime.getStatus(); offlineAiTrace('LOCAL_RUNTIME_STATE', { state: runtimeState });
    if (runtimeState === 'UNAVAILABLE' || runtimeState === 'DISPOSED') return { state: 'unavailable', provider: this.id, mode: this.mode, reason: 'No executable local inference runtime is available in the current web runtime.', reasonCode: images.length ? 'VISION_RUNTIME_UNAVAILABLE' : 'LOCAL_RUNTIME_UNAVAILABLE' };
    if (runtimeState === 'ERROR') return { state: 'unavailable', provider: this.id, mode: this.mode, reason: 'Local runtime preparation failed.', reasonCode: 'MODEL_LOAD_FAILED' };
    if (runtimeState !== 'MODEL_READY') return { state: 'unavailable', provider: this.id, mode: this.mode, reason: runtimeState === 'UNINITIALIZED' ? 'Local runtime is not initialized.' : runtimeState === 'INITIALIZING' ? 'Local runtime is initializing.' : runtimeState === 'LOADING_MODEL' ? 'Verified local model is loading.' : 'Local runtime is busy and cannot accept a new route.', reasonCode: runtimeState === 'INITIALIZING' ? 'RUNTIME_INITIALIZING' : runtimeState === 'LOADING_MODEL' ? 'MODEL_LOADING' : 'LOCAL_RUNTIME_UNAVAILABLE' };
    if (!this.modelManager) return { state: 'unavailable', provider: this.id, mode: this.mode, reason: 'No ModelManager is connected to the local provider.', reasonCode: images.length ? 'VISION_RUNTIME_UNAVAILABLE' : 'LOCAL_RUNTIME_UNAVAILABLE' };
    const model = this.modelManager.getModel(this.modelId); offlineAiTrace('MODEL_DISCOVERY', { found: Boolean(model), modelId: this.modelId, modelState: model?.status ?? 'NOT_INSTALLED' });
    if (!model || model.status === 'NOT_INSTALLED' || model.status === 'DOWNLOADING' || model.status === 'VERIFYING' || model.status === 'REMOVING') return { state: 'unavailable', provider: this.id, mode: this.mode, reason: 'No verified local model is installed.', reasonCode: model?.status === 'DOWNLOADING' ? 'MODEL_DOWNLOADING' : model?.status === 'VERIFYING' ? 'MODEL_VERIFYING' : 'MODEL_NOT_INSTALLED' };
    if (model.status === 'INVALID' || model.status === 'FAILED') return { state: 'unavailable', provider: this.id, mode: this.mode, reason: 'The local model is invalid and cannot be executed.', reasonCode: 'MODEL_INVALID' };
    if (images.length > 0 && !isVisionModelCapable(model.type)) return { state: 'unavailable', provider: this.id, mode: this.mode, reason: 'The installed local model is text-only and cannot process images.', reasonCode: 'VISION_NOT_SUPPORTED' };
    offlineAiTrace('MODEL_VERIFIED', { modelId: this.modelId, modelVersion: model.version, checksum: 'PASS', reused: true });
    const provenance = this.runtime === webLocalAi.runtime && this.modelManager === webLocalAi.modelManager ? webLocalAi.getProvenance() : null;
    const reason = provenance ? `Verified local model is loaded and executable. provider=${provenance.provider}; runtime=${provenance.runtime}; model=${provenance.model}; source=${provenance.source}.` : images.length ? 'Verified vision-capable local model and vision-capable runtime are ready; exact source provenance is not known in this session.' : 'Verified local model and executable local runtime are ready; exact source provenance is not known in this session.';
    return { state: 'ready', provider: this.id, mode: this.mode, reason, reasonCode: 'LOCAL_RUNTIME_READY' };
  }

  async sendMessage(messages: AiMessage[], attachments: AiAttachment[] = [], options?: AiGenerationOptions): Promise<AiResponse> {
    if (!messages.length) throw new LocalInferenceRuntimeError('INFERENCE_FAILED', 'At least one AI message is required for local generation.');
    const images = attachments.filter((attachment) => attachment.kind === 'image');
    if (attachments.some((attachment) => attachment.kind !== 'image')) throw new LocalInferenceRuntimeError('UNSUPPORTED_ATTACHMENT', LOCAL_AI_UNSUPPORTED_ATTACHMENT);
    if (images.length > 0) { try { await validateVisionImages(images); } catch (error) { throw visionErrorToRuntimeError(error); } const status = await this.getRoutingStatus(images); if (status.state !== 'ready') throw new LocalInferenceRuntimeError(status.reasonCode === 'VISION_NOT_SUPPORTED' ? 'VISION_NOT_SUPPORTED' : 'VISION_RUNTIME_UNAVAILABLE', status.reason ?? 'Local vision is unavailable.'); }
    const generation = normalizeGenerationOptions(options); const initialState = this.runtime.getStatus(); offlineAiTrace('LOCAL_RUNTIME_STATE', { state: initialState });
    if (initialState === 'UNAVAILABLE') throw new LocalInferenceRuntimeError(images.length ? 'VISION_RUNTIME_UNAVAILABLE' : 'OFFLINE_TEXT_AI_UNAVAILABLE', LOCAL_AI_NOT_INSTALLED);
    if (!this.modelManager) throw new LocalInferenceRuntimeError(images.length ? 'VISION_RUNTIME_UNAVAILABLE' : 'OFFLINE_TEXT_AI_UNAVAILABLE', 'No ModelManager is connected to the local provider.');
    try {
      const model = this.modelManager.getModel(this.modelId); offlineAiTrace('MODEL_DISCOVERY', { found: Boolean(model), modelId: this.modelId, modelState: model?.status ?? 'NOT_INSTALLED' });
      if (!model || model.status === 'NOT_INSTALLED' || model.status === 'DOWNLOADING' || model.status === 'VERIFYING') throw new LocalInferenceRuntimeError('MODEL_NOT_INSTALLED', images.length ? 'The local vision model is not installed.' : 'The local text model is not installed.');
      if (model.status === 'INVALID' || model.status === 'FAILED') throw new LocalInferenceRuntimeError('MODEL_INVALID', 'The local model failed integrity validation and cannot be executed.');
      if (images.length > 0 && !isVisionModelCapable(model.type)) throw new LocalInferenceRuntimeError('VISION_NOT_SUPPORTED', 'The installed local model is text-only and cannot process images.');
      if (this.runtime.getStatus() !== 'MODEL_READY') {
        const eligibility = await this.modelManager.checkInstallationEligibility(this.modelId); if (!eligibility.eligible) { const resourceLimited = eligibility.reasons.some((reason) => reason.code === 'INSUFFICIENT_RAM' || reason.code === 'INSUFFICIENT_STORAGE'); throw new LocalInferenceRuntimeError(resourceLimited ? 'INSUFFICIENT_RESOURCES' : 'MODEL_INCOMPATIBLE', eligibility.reasons.map((reason) => reason.message).join(' ')); }
        if (this.runtime.getStatus() === 'UNINITIALIZED') await this.runtime.initialize();
        if (this.runtime.getStatus() !== 'MODEL_READY') await this.runtime.loadModel(await this.modelManager.getVerifiedModelReference(this.modelId));
      }
      offlineAiTrace('MODEL_READY', { state: this.runtime.getStatus(), modelId: this.modelId, reused: true });
      const latestUser = [...messages].reverse().find((message) => message.role === 'user');
      if (this.actionBridge && latestUser) {
        const actionDetection = detectLocalWorkAction(latestUser.content, new Date().toISOString());
        if (actionDetection.kind !== 'not_action') {
          offlineAiTrace('LOCAL_ACTION_FAST_PATH', { kind: actionDetection.kind, valid: actionDetection.kind === 'action' });
          const bridged = await this.actionBridge(latestUser.content, '', messages[0]?.conversationId || null);
          return { conversationId: bridged.conversationId, message: bridged.assistantMessage, pendingActions: bridged.pendingActions, provider: this.id, mode: this.mode };
        }
      }

      const boundedMessages = boundOfflineMessages(messages);
      offlineAiTrace('OFFLINE_CONTEXT_BOUNDED', { originalMessageCount: messages.length, boundedMessageCount: boundedMessages.length, contextSize: generation.contextSize ?? DEFAULT_CONTEXT_SIZE, maxTokens: generation.maxTokens ?? DEFAULT_MAX_TOKENS });
      const request: InferenceRequest = { messages: boundedMessages, modality: images.length ? 'VISION' : 'TEXT', ...(images.length ? { attachments: images } : {}), ...generation };
      offlineAiTrace('GENERATION_STARTED', { state: this.runtime.getStatus(), messageCount: boundedMessages.length, startedAtMs: nowMs(), streaming: true });

      let response: InferenceResponse | null = null;
      let streamedText = '';
      for await (const event of this.runtime.stream(request)) {
        if (event.type === 'TOKEN') {
          streamedText += event.text;
          options?.onToken?.(event.text);
          continue;
        }
        if (event.type === 'ERROR') {
          offlineAiTrace('GENERATION_FAILED', { errorCode: event.error instanceof LocalInferenceRuntimeError ? event.error.code : 'INFERENCE_FAILED' });
          throw event.error;
        }
        if (event.type === 'COMPLETE') response = event.response;
      }
      if (!response) throw new LocalInferenceRuntimeError('INFERENCE_FAILED', 'Local streaming ended without a completion response.');
      if (streamedText.trim()) response = { ...response, text: streamedText };
      if (!response.text.trim()) throw new LocalInferenceRuntimeError('INFERENCE_FAILED', 'The local runtime returned an empty response.');
      offlineAiTrace('RESPONSE_RECEIVED', { provider: this.id, nonEmpty: true, streaming: true, responseCharCount: response.text.length, completedAtMs: nowMs() });
      offlineAiTrace('RESPONSE_RENDERED', { provider: this.id, state: this.runtime.getStatus(), nonEmpty: true, streaming: true });
      if (!this.actionBridge) return { conversationId: messages[0]?.conversationId ?? '', message: response.text, pendingActions: [], provider: this.id, mode: this.mode };
      const bridged = await this.actionBridge(latestUser?.content ?? '', response.text, messages[0]?.conversationId || null);
      offlineAiTrace('RESPONSE_RECEIVED', { provider: this.id, nonEmpty: bridged.assistantMessage.trim().length > 0, pendingActionCount: bridged.pendingActions.length });
      return { conversationId: bridged.conversationId, message: bridged.assistantMessage, pendingActions: bridged.pendingActions, provider: this.id, mode: this.mode };
    } catch (error) { if (error instanceof LocalInferenceRuntimeError) throw error; throw new LocalInferenceRuntimeError('INFERENCE_FAILED', error instanceof Error ? error.message : 'Local inference failed.'); }
  }
}

function normalizeGenerationOptions(options?: AiGenerationOptions): Pick<InferenceRequest, 'maxTokens' | 'temperature' | 'topP' | 'contextSize' | 'stopSequences' | 'signal'> {
  const maxTokens = options?.maxOutputTokens ?? DEFAULT_MAX_TOKENS; const temperature = options?.temperature ?? DEFAULT_TEMPERATURE; const topP = options?.topP ?? DEFAULT_TOP_P; const contextSize = options?.contextSize ?? DEFAULT_CONTEXT_SIZE; const stopSequences = options?.stopSequences ?? [];
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > MAX_TOKENS) throw new LocalInferenceRuntimeError('INFERENCE_FAILED', `maxTokens must be an integer between 1 and ${MAX_TOKENS}.`);
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) throw new LocalInferenceRuntimeError('INFERENCE_FAILED', 'temperature must be between 0 and 2.');
  if (!Number.isFinite(topP) || topP <= 0 || topP > 1) throw new LocalInferenceRuntimeError('INFERENCE_FAILED', 'topP must be greater than 0 and at most 1.');
  if (!Number.isInteger(contextSize) || contextSize < 256 || contextSize > MAX_CONTEXT_SIZE) throw new LocalInferenceRuntimeError('CONTEXT_TOO_LARGE', `contextSize must be between 256 and ${MAX_CONTEXT_SIZE}.`);
  if (stopSequences.length > MAX_STOP_SEQUENCES) throw new LocalInferenceRuntimeError('INFERENCE_FAILED', `At most ${MAX_STOP_SEQUENCES} stop sequences are supported.`);
  return { maxTokens, temperature, topP, contextSize, stopSequences, signal: options?.signal };
}
function visionErrorToRuntimeError(error: unknown): LocalInferenceRuntimeError { const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : 'INVALID_IMAGE_METADATA'; const message = error instanceof Error ? error.message : 'Image validation failed.'; if (code === 'UNSUPPORTED_IMAGE_TYPE' || code === 'IMAGE_TOO_LARGE' || code === 'IMAGE_COUNT_EXCEEDED' || code === 'INVALID_IMAGE_METADATA') return new LocalInferenceRuntimeError(code, message); return new LocalInferenceRuntimeError('INVALID_IMAGE_METADATA', message); }
function nowMs(): number { return typeof performance !== 'undefined' && typeof performance.now === 'function' ? Math.round(performance.now()) : Date.now(); }
