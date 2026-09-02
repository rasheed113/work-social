import type {
  AiAttachment,
  AiGenerationOptions,
  AiMessage,
  AiProvider,
  AiProviderStatus,
  AiResponse,
} from './contracts';

export type GeminiMessageHandler = (
  messages: AiMessage[],
  attachments: AiAttachment[],
  options?: AiGenerationOptions,
) => Promise<AiResponse>;

/** Adapter boundary for the existing Work Social Gemini implementation. */
export class GeminiAiProvider implements AiProvider {
  readonly id = 'gemini' as const;
  readonly mode = 'online' as const;

  constructor(private readonly handler: GeminiMessageHandler) {}

  getStatus(): AiProviderStatus {
    return { state: 'ready', provider: this.id, mode: this.mode };
  }

  sendMessage(
    messages: AiMessage[],
    attachments: AiAttachment[] = [],
    options?: AiGenerationOptions,
  ): Promise<AiResponse> {
    return this.handler(messages, attachments, options);
  }
}
