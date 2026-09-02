import type { ModelManager } from '../model/modelManager';
import { PRIMARY_LOCAL_TEXT_MODEL } from '../model/primaryLocalTextModel';
import { createLocalInferenceRuntime } from '../runtime/localInferenceRuntime';
import { LocalInferenceRuntimeError, type LocalInferenceRuntime, type InferenceRequest } from '../runtime/localInferenceContracts';
import type { AiAttachment, AiGenerationOptions, AiMessage, AiProvider, AiProviderStatus, AiResponse } from './contracts';

export const LOCAL_RUNTIME_UNAVAILABLE = 'LOCAL_RUNTIME_UNAVAILABLE';
export const LOCAL_AI_NOT_INSTALLED = 'Local inference is unavailable in the current web runtime.';

/** Explicit local provider boundary. It never calls Gemini or fabricates an answer. */
export class LocalAiProvider implements AiProvider {
  readonly id = 'local' as const;
  readonly mode = 'offline' as const;
  constructor(
    private readonly runtime: LocalInferenceRuntime = createLocalInferenceRuntime(),
    private readonly modelManager: ModelManager | null = null,
    private readonly modelId: string = PRIMARY_LOCAL_TEXT_MODEL.id,
  ) {}

  getStatus(): AiProviderStatus {
    const state = this.runtime.getStatus();
    if (this.modelManager && this.modelManager.getModel(this.modelId)?.status !== 'INSTALLED' && state !== 'MODEL_READY') {
      return { state: 'unavailable', provider: this.id, mode: this.mode, reason: 'No verified local model is installed.' };
    }
    if (state === 'READY' || state === 'MODEL_READY' || state === 'GENERATING' || state === 'CANCELLING') {
      return { state: 'ready', provider: this.id, mode: this.mode };
    }
    return { state: 'unavailable', provider: this.id, mode: this.mode, reason: state === 'UNAVAILABLE' ? LOCAL_AI_NOT_INSTALLED : `Local runtime state is ${state}.` };
  }

  async sendMessage(messages: AiMessage[], attachments: AiAttachment[] = [], options?: AiGenerationOptions): Promise<AiResponse> {
    if (attachments.length > 0) throw new LocalInferenceRuntimeError('RUNTIME_ERROR', 'Local text inference does not support attachments in Phase 4.');
    if (!this.modelManager) throw new LocalInferenceRuntimeError('LOCAL_RUNTIME_UNAVAILABLE', LOCAL_AI_NOT_INSTALLED);
    try {
      if (this.runtime.getStatus() === 'UNINITIALIZED') await this.runtime.initialize();
      if (this.runtime.getStatus() !== 'MODEL_READY') await this.runtime.loadModel(await this.modelManager.getVerifiedModelReference(this.modelId));
      const request: InferenceRequest = { messages, maxTokens: options?.maxOutputTokens, temperature: options?.temperature, signal: options?.signal };
      const response = await this.runtime.generate(request);
      return { conversationId: messages[0]?.conversationId ?? '', message: response.text, pendingActions: [], provider: this.id, mode: this.mode };
    } catch (error) {
      if (error instanceof LocalInferenceRuntimeError) throw error;
      throw new LocalInferenceRuntimeError('RUNTIME_ERROR', error instanceof Error ? error.message : 'Local inference failed.');
    }
  }
}
