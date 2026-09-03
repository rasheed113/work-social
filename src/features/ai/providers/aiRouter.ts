import type { AiAttachment, AiGenerationOptions, AiMessage, AiProvider, AiProviderStatus, AiRoute, AiRoutingMode, AiResponse } from './contracts';
import { AiRoutingError } from './contracts';
import { validateVisionImages } from '../vision/imageValidator';

let defaultRoutingMode: AiRoutingMode = 'auto';

export function setDefaultAiRoutingMode(mode: AiRoutingMode): void { defaultRoutingMode = mode; }
export function getDefaultAiRoutingMode(): AiRoutingMode { return defaultRoutingMode; }

/** Deterministic provider router. Provider selection is explicit and never based on a network failure or Gemini response. */
export class AiRouter {
  constructor(private readonly gemini: AiProvider, private readonly local: AiProvider) {}

  async route(mode: AiRoutingMode = defaultRoutingMode, attachments: AiAttachment[] = []): Promise<AiRoute> {
    await validateImagesBeforeRouting(attachments);
    if (mode === 'online') return { provider: 'gemini', mode: 'online', reasonCode: 'ONLINE_EXPLICIT', reason: 'Online mode explicitly selects Gemini.' };
    const localStatus = await this.getLocalRoutingStatus(attachments);
    if (mode === 'offline') {
      if (localStatus.state !== 'ready') throw new AiRoutingError(localStatus.reasonCode ?? 'LOCAL_RUNTIME_UNAVAILABLE', 'offline', 'local', localStatus.reason ?? 'Local AI is unavailable in offline mode.');
      return { provider: 'local', mode: 'offline', reasonCode: 'OFFLINE_EXPLICIT', reason: 'Offline mode explicitly selects the verified local provider.' };
    }
    if (localStatus.state === 'ready') return { provider: 'local', mode: 'offline', reasonCode: 'AUTO_LOCAL_SELECTED', reason: 'Local AI is executable and all model, integrity, device, resource, and attachment requirements are satisfied.' };
    return { provider: 'gemini', mode: 'online', reasonCode: 'AUTO_ONLINE_SELECTED', reason: localStatus.reason ?? 'Local AI is not currently eligible; Gemini is selected explicitly by AUTO policy.' };
  }

  getProvider(preference: 'gemini' | 'local' = 'gemini'): AiProvider { return preference === 'local' ? this.local : this.gemini; }
  async getLocalStatus(attachments: AiAttachment[] = []): Promise<AiProviderStatus> { return this.getLocalRoutingStatus(attachments); }

  async sendMessage(messages: AiMessage[], attachments: AiAttachment[] = [], options?: AiGenerationOptions & { mode?: AiRoutingMode; provider?: 'gemini' | 'local' }): Promise<AiResponse> {
    const { mode, provider, ...generationOptions } = options ?? {};
    const routingMode: AiRoutingMode = mode ?? (provider === 'local' ? 'offline' : provider === 'gemini' ? 'online' : defaultRoutingMode);
    const route = await this.route(routingMode, attachments);
    const selectedProvider = route.provider === 'local' ? this.local : this.gemini;
    return selectedProvider.sendMessage(messages, attachments, generationOptions);
  }

  private async getLocalRoutingStatus(attachments: AiAttachment[]): Promise<AiProviderStatus> {
    const localWithRouting = this.local as AiProvider & { getRoutingStatus?: (attachments?: AiAttachment[]) => Promise<AiProviderStatus> };
    if (typeof localWithRouting.getRoutingStatus !== 'function') return { state: 'unavailable', provider: 'local', mode: 'offline', reason: 'The local provider does not expose a verified routing-readiness check.', reasonCode: 'LOCAL_RUNTIME_UNAVAILABLE' };
    return localWithRouting.getRoutingStatus(attachments);
  }
}

async function validateImagesBeforeRouting(attachments: AiAttachment[]): Promise<void> {
  const images = attachments.filter((attachment) => attachment.kind === 'image');
  if (images.length > 0) await validateVisionImages(images);
}

export type { AiRoutingMode, AiRoute, AiRoutingReasonCode } from './contracts';
