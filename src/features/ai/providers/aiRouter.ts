import type {
  AiAttachment,
  AiGenerationOptions,
  AiMessage,
  AiProvider,
  AiProviderStatus,
  AiRoute,
  AiRoutingMode,
  AiRoutingReasonCode,
  AiResponse,
} from './contracts';
import { AiRoutingError } from './contracts';

/**
 * Deterministic provider router. Provider selection is explicit and never based
 * on a network failure or Gemini response, so routing cannot become a quota bypass.
 */
export class AiRouter {
  constructor(
    private readonly gemini: AiProvider,
    private readonly local: AiProvider,
  ) {}

  async route(
    mode: AiRoutingMode = 'auto',
    attachments: AiAttachment[] = [],
  ): Promise<AiRoute> {
    if (mode === 'online') {
      return {
        provider: 'gemini',
        mode: 'online',
        reasonCode: 'ONLINE_EXPLICIT',
        reason: 'Online mode explicitly selects Gemini.',
      };
    }

    const localStatus = await this.getLocalRoutingStatus(attachments);
    if (mode === 'offline') {
      if (localStatus.state !== 'ready') {
        throw new AiRoutingError(
          localStatus.reasonCode ?? 'LOCAL_RUNTIME_UNAVAILABLE',
          'offline',
          'local',
          localStatus.reason ?? 'Local AI is unavailable in offline mode.',
        );
      }
      return {
        provider: 'local',
        mode: 'offline',
        reasonCode: 'OFFLINE_EXPLICIT',
        reason: 'Offline mode explicitly selects the verified local provider.',
      };
    }

    if (localStatus.state === 'ready') {
      return {
        provider: 'local',
        mode: 'offline',
        reasonCode: 'AUTO_LOCAL_SELECTED',
        reason: 'Local AI is executable and all model, integrity, device, resource, and attachment requirements are satisfied.',
      };
    }

    return {
      provider: 'gemini',
      mode: 'online',
      reasonCode: 'AUTO_ONLINE_SELECTED',
      reason: localStatus.reason ?? 'Local AI is not currently eligible; Gemini is selected explicitly by AUTO policy.',
    };
  }

  /** Backward-compatible explicit provider lookup. Smart routing uses route(). */
  getProvider(preference: 'gemini' | 'local' = 'gemini'): AiProvider {
    return preference === 'local' ? this.local : this.gemini;
  }

  async sendMessage(
    messages: AiMessage[],
    attachments: AiAttachment[] = [],
    options?: AiGenerationOptions & { mode?: AiRoutingMode; provider?: 'gemini' | 'local' },
  ): Promise<AiResponse> {
    const { mode, provider, ...generationOptions } = options ?? {};
    const routingMode: AiRoutingMode = mode ?? (provider === 'local' ? 'offline' : provider === 'gemini' ? 'online' : 'auto');
    const route = await this.route(routingMode, attachments);
    const selectedProvider = route.provider === 'local' ? this.local : this.gemini;
    return selectedProvider.sendMessage(messages, attachments, generationOptions);
  }

  private async getLocalRoutingStatus(attachments: AiAttachment[]): Promise<AiProviderStatus> {
    const localWithRouting = this.local as AiProvider & {
      getRoutingStatus?: (attachments?: AiAttachment[]) => Promise<AiProviderStatus>;
    };

    if (typeof localWithRouting.getRoutingStatus !== 'function') {
      return {
        state: 'unavailable',
        provider: 'local',
        mode: 'offline',
        reason: 'The local provider does not expose a verified routing-readiness check.',
        reasonCode: 'LOCAL_RUNTIME_UNAVAILABLE',
      };
    }

    return localWithRouting.getRoutingStatus(attachments);
  }
}

export type { AiRoutingMode, AiRoute, AiRoutingReasonCode } from './contracts';
