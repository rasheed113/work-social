import type { ModelManager } from '../model/modelManager';
import { PRIMARY_LOCAL_TEXT_MODEL } from '../model/primaryLocalTextModel';
import { createLocalInferenceRuntime } from '../runtime/localInferenceRuntime';
import { LocalInferenceRuntimeError, type LocalInferenceRuntime, type InferenceRequest } from '../runtime/localInferenceContracts';
import type { AiAttachment, AiGenerationOptions, AiMessage, AiProvider, AiProviderStatus, AiResponse } from './contracts';

export const OFFLINE_TEXT_AI_UNAVAILABLE = 'OFFLINE_TEXT_AI_UNAVAILABLE';
/** Backward-compatible alias for callers that used the Phase 4 name. */
export const LOCAL_RUNTIME_UNAVAILABLE = OFFLINE_TEXT_AI_UNAVAILABLE;
export const LOCAL_AI_NOT_INSTALLED = 'Local inference is unavailable in the current web runtime.';
export const LOCAL_AI_UNSUPPORTED_ATTACHMENT = 'Offline text AI does not support attachments in this MVP.';

const DEFAULT_MAX_TOKENS = 512;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_TOP_P = 0.9;
const DEFAULT_CONTEXT_SIZE = 2048;
const MAX_TOKENS = 2048;
const MAX_CONTEXT_SIZE = 8192;
const MAX_STOP_SEQUENCES = 8;

/**
 * Phase 5 provider boundary. It can generate only through an injected real local runtime.
 * The default Vite/browser runtime is intentionally unavailable and never calls Gemini/network APIs.
 */
export class LocalAiProvider implements AiProvider {
  readonly id = 'local' as const;
  readonly mode = 'offline' as const;
  constructor(
    private readonly runtime: LocalInferenceRuntime = createLocalInferenceRuntime(),
    private readonly modelManager: ModelManager | null = null,
    private readonly modelId: string = PRIMARY_LOCAL_TEXT_MODEL.id,
  ) {}

  getStatus(): AiProviderStatus {
    const runtimeState = this.runtime.getStatus();
    if (runtimeState === 'UNAVAILABLE') {
      return { state: 'unavailable', provider: this.id, mode: this.mode, reason: LOCAL_AI_NOT_INSTALLED, reasonCode: OFFLINE_TEXT_AI_UNAVAILABLE };
    }
    if (!this.modelManager) {
      return { state: 'unavailable', provider: this.id, mode: this.mode, reason: 'No ModelManager is connected to the local provider.', reasonCode: 'RUNTIME_UNAVAILABLE' };
    }
    const model = this.modelManager.getModel(this.modelId);
    if (!model || model.status === 'NOT_INSTALLED' || model.status === 'DOWNLOADING' || model.status === 'VERIFYING') {
      return { state: 'unavailable', provider: this.id, mode: this.mode, reason: 'No verified local model is installed.', reasonCode: 'MODEL_NOT_INSTALLED' };
    }
    if (model.status === 'INVALID' || model.status === 'FAILED') {
      return { state: 'unavailable', provider: this.id, mode: this.mode, reason: 'The local model is invalid and cannot be executed.', reasonCode: 'MODEL_INVALID' };
    }
    if (runtimeState === 'READY' || runtimeState === 'MODEL_READY' || runtimeState === 'GENERATING' || runtimeState === 'CANCELLING') {
      return { state: 'ready', provider: this.id, mode: this.mode };
    }
    return { state: 'unavailable', provider: this.id, mode: this.mode, reason: `Local runtime state is ${runtimeState}.`, reasonCode: 'RUNTIME_UNAVAILABLE' };
  }

  async sendMessage(messages: AiMessage[], attachments: AiAttachment[] = [], options?: AiGenerationOptions): Promise<AiResponse> {
    if (attachments.length > 0) throw new LocalInferenceRuntimeError('UNSUPPORTED_ATTACHMENT', LOCAL_AI_UNSUPPORTED_ATTACHMENT);
    if (!messages.length) throw new LocalInferenceRuntimeError('INFERENCE_FAILED', 'At least one AI message is required for local generation.');
    const generation = normalizeGenerationOptions(options);
    if (this.runtime.getStatus() === 'UNAVAILABLE') {
      throw new LocalInferenceRuntimeError('OFFLINE_TEXT_AI_UNAVAILABLE', LOCAL_AI_NOT_INSTALLED);
    }
    if (!this.modelManager) {
      throw new LocalInferenceRuntimeError('OFFLINE_TEXT_AI_UNAVAILABLE', 'No ModelManager is connected to the local provider.');
    }

    try {
      const model = this.modelManager.getModel(this.modelId);
      if (!model || model.status === 'NOT_INSTALLED' || model.status === 'DOWNLOADING' || model.status === 'VERIFYING') {
        throw new LocalInferenceRuntimeError('MODEL_NOT_INSTALLED', 'The local text model is not installed.');
      }
      if (model.status === 'INVALID' || model.status === 'FAILED') {
        throw new LocalInferenceRuntimeError('MODEL_INVALID', 'The local text model failed integrity validation and cannot be executed.');
      }
      const eligibility = await this.modelManager.checkInstallationEligibility(this.modelId);
      if (!eligibility.eligible) {
        const resourceLimited = eligibility.reasons.some((reason) => reason.code === 'INSUFFICIENT_RAM' || reason.code === 'INSUFFICIENT_STORAGE');
        throw new LocalInferenceRuntimeError(resourceLimited ? 'INSUFFICIENT_RESOURCES' : 'MODEL_INCOMPATIBLE', eligibility.reasons.map((reason) => reason.message).join(' '));
      }
      if (this.runtime.getStatus() === 'UNINITIALIZED') await this.runtime.initialize();
      if (this.runtime.getStatus() !== 'MODEL_READY') await this.runtime.loadModel(await this.modelManager.getVerifiedModelReference(this.modelId));
      const request: InferenceRequest = { messages, ...generation };
      const response = await this.runtime.generate(request);
      return { conversationId: messages[0]?.conversationId ?? '', message: response.text, pendingActions: [], provider: this.id, mode: this.mode };
    } catch (error) {
      if (error instanceof LocalInferenceRuntimeError) throw error;
      throw new LocalInferenceRuntimeError('INFERENCE_FAILED', error instanceof Error ? error.message : 'Local inference failed.');
    }
  }
}

function normalizeGenerationOptions(options?: AiGenerationOptions): Pick<InferenceRequest, 'maxTokens' | 'temperature' | 'topP' | 'contextSize' | 'stopSequences' | 'signal'> {
  const maxTokens = options?.maxOutputTokens ?? DEFAULT_MAX_TOKENS;
  const temperature = options?.temperature ?? DEFAULT_TEMPERATURE;
  const topP = options?.topP ?? DEFAULT_TOP_P;
  const contextSize = options?.contextSize ?? DEFAULT_CONTEXT_SIZE;
  const stopSequences = options?.stopSequences ?? [];
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > MAX_TOKENS) throw new LocalInferenceRuntimeError('INFERENCE_FAILED', `maxTokens must be an integer between 1 and ${MAX_TOKENS}.`);
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) throw new LocalInferenceRuntimeError('INFERENCE_FAILED', 'temperature must be between 0 and 2.');
  if (!Number.isFinite(topP) || topP <= 0 || topP > 1) throw new LocalInferenceRuntimeError('INFERENCE_FAILED', 'topP must be greater than 0 and at most 1.');
  if (!Number.isInteger(contextSize) || contextSize < 256 || contextSize > MAX_CONTEXT_SIZE) throw new LocalInferenceRuntimeError('CONTEXT_TOO_LARGE', `contextSize must be between 256 and ${MAX_CONTEXT_SIZE}.`);
  if (stopSequences.length > MAX_STOP_SEQUENCES) throw new LocalInferenceRuntimeError('INFERENCE_FAILED', `At most ${MAX_STOP_SEQUENCES} stop sequences are supported.`);
  return { maxTokens, temperature, topP, contextSize, stopSequences, signal: options?.signal };
}
