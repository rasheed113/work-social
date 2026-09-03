import type { AiProviderStatusReasonCode, AiRoutingMode } from './providers/contracts';

export type AiPremiumMode = AiRoutingMode;
export type AiPremiumRouteState = 'online' | 'offline' | 'unavailable';

export interface AiPremiumStatusInput {
  requestedMode: AiPremiumMode;
  provider: 'gemini' | 'local' | null;
  routeMode: 'online' | 'offline' | null;
  reasonCode?: AiProviderStatusReasonCode;
  reason?: string;
  localAvailable: boolean;
}

export interface AiPremiumStatusView {
  modeLabel: 'AUTO' | 'ONLINE' | 'OFFLINE';
  providerLabel: 'Gemini' | 'Local AI' | '—';
  routeLabel: 'Online' | 'Offline' | 'Unavailable';
  detail: string;
  processingLabel: 'Processed online' | 'Processed locally' | 'Not sent online' | null;
  localLabel: string;
  modelLabel: string;
  visionLabel: string;
}

export function buildAiPremiumStatus(input: AiPremiumStatusInput): AiPremiumStatusView {
  const modeLabel = input.requestedMode.toUpperCase() as AiPremiumStatusView['modeLabel'];
  const providerLabel = input.provider === 'gemini' ? 'Gemini' : input.provider === 'local' ? 'Local AI' : '—';
  const routeLabel = input.routeMode === 'online' ? 'Online' : input.routeMode === 'offline' ? 'Offline' : 'Unavailable';
  const localUnavailable = !input.localAvailable;
  let detail = input.reason ?? '';

  if (input.requestedMode === 'offline' && !input.localAvailable) {
    detail = 'Offline AI isn’t available on this runtime. Your request is not sent online.';
  } else if (input.requestedMode === 'auto' && input.provider === 'gemini' && localUnavailable) {
    detail = 'Online AI selected automatically · Local AI unavailable';
  } else if (input.requestedMode === 'online') {
    detail = 'Online AI · Gemini';
  } else if (input.requestedMode === 'offline' && input.provider === 'local') {
    detail = 'Offline AI · local processing';
  }

  const processingLabel = input.routeMode === 'online' ? 'Processed online' : input.routeMode === 'offline' ? 'Processed locally' : input.requestedMode === 'offline' ? 'Not sent online' : null;
  const localLabel = localUnavailable ? 'Offline AI · Unavailable on this runtime' : 'Offline AI · Available';
  const modelLabel = input.reasonCode === 'MODEL_NOT_INSTALLED' ? 'Local Model · Not installed' : input.reasonCode === 'MODEL_INVALID' ? 'Local Model · Invalid' : localUnavailable ? 'Local Model · Runtime unavailable' : 'Local Model · Ready';
  const visionLabel = input.reasonCode === 'VISION_NOT_SUPPORTED' ? 'Offline Vision · Not supported' : input.reasonCode === 'VISION_RUNTIME_UNAVAILABLE' ? 'Offline Vision · Unavailable' : localUnavailable ? 'Offline Vision · Runtime unavailable' : 'Offline Vision · Available';

  return { modeLabel, providerLabel, routeLabel, detail, processingLabel, localLabel, modelLabel, visionLabel };
}

export function friendlyAiError(error: unknown, requestedMode: AiPremiumMode): string {
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : '';
  if (requestedMode === 'offline' || code === 'OFFLINE_TEXT_AI_UNAVAILABLE' || code === 'LOCAL_RUNTIME_UNAVAILABLE') {
    return 'Offline AI isn’t available yet on this runtime. Your request was not sent online.';
  }
  if (code === 'MODEL_NOT_INSTALLED') return 'The local AI model is not installed on this runtime.';
  if (code === 'MODEL_INVALID') return 'The local AI model could not be verified, so it was not used.';
  if (code === 'VISION_RUNTIME_UNAVAILABLE' || code === 'VISION_NOT_SUPPORTED') return 'Offline Vision is unavailable on this runtime. The image was not processed locally.';
  if (error instanceof Error && error.message) return error.message;
  return 'Work Social AI could not complete that request.';
}
