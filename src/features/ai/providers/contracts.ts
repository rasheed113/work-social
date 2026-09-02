export type AiProviderId = 'gemini' | 'local';
export type AiProviderMode = 'online' | 'offline';

export interface AiMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolName?: string | null;
  toolCallId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export interface AiAttachment {
  id?: string;
  kind: 'image' | 'file';
  mimeType: string;
  name?: string;
  data?: Blob;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface AiGenerationOptions {
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  contextSize?: number;
  stopSequences?: string[];
  signal?: AbortSignal;
}

export interface AiResponse {
  conversationId: string;
  message: string;
  pendingActions: Array<{
    id: string;
    displaySummary: string;
    expiresAt: string;
  }>;
  provider: AiProviderId;
  mode: AiProviderMode;
}

export type AiProviderStatusReasonCode =
  | 'OFFLINE_TEXT_AI_UNAVAILABLE'
  | 'MODEL_NOT_INSTALLED'
  | 'MODEL_INVALID'
  | 'MODEL_INCOMPATIBLE'
  | 'RUNTIME_UNAVAILABLE';

export type AiProviderStatus =
  | { state: 'ready'; provider: AiProviderId; mode: AiProviderMode }
  | { state: 'unavailable'; provider: AiProviderId; mode: AiProviderMode; reason: string; reasonCode?: AiProviderStatusReasonCode };

export interface AiProvider {
  readonly id: AiProviderId;
  readonly mode: AiProviderMode;
  getStatus(): AiProviderStatus;
  sendMessage(
    messages: AiMessage[],
    attachments?: AiAttachment[],
    options?: AiGenerationOptions,
  ): Promise<AiResponse>;
}
