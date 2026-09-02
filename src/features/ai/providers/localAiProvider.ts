import type {
  AiAttachment,
  AiGenerationOptions,
  AiMessage,
  AiProvider,
  AiProviderStatus,
  AiResponse,
} from './contracts';

export const LOCAL_AI_NOT_INSTALLED = 'Local AI is not installed yet. Offline inference will be enabled in a later phase.';

/** Architectural boundary only. This provider intentionally performs no inference or network calls. */
export class LocalAiProvider implements AiProvider {
  readonly id = 'local' as const;
  readonly mode = 'offline' as const;

  getStatus(): AiProviderStatus {
    return { state: 'unavailable', provider: this.id, mode: this.mode, reason: LOCAL_AI_NOT_INSTALLED };
  }

  async sendMessage(
    _messages: AiMessage[],
    _attachments: AiAttachment[] = [],
    _options?: AiGenerationOptions,
  ): Promise<AiResponse> {
    throw new Error(LOCAL_AI_NOT_INSTALLED);
  }
}
