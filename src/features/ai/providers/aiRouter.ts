import type { AiAttachment, AiGenerationOptions, AiMessage, AiProvider, AiResponse } from './contracts';

export type AiProviderPreference = 'gemini' | 'local';

export class AiRouter {
  constructor(
    private readonly gemini: AiProvider,
    private readonly local: AiProvider,
  ) {}

  getProvider(preference: AiProviderPreference = 'gemini'): AiProvider {
    // Phase 1 deliberately keeps Gemini as the production default.
    return preference === 'local' ? this.local : this.gemini;
  }

  sendMessage(
    messages: AiMessage[],
    attachments: AiAttachment[] = [],
    options?: AiGenerationOptions & { provider?: AiProviderPreference },
  ): Promise<AiResponse> {
    const { provider = 'gemini', ...generationOptions } = options ?? {};
    return this.getProvider(provider).sendMessage(messages, attachments, generationOptions);
  }
}
