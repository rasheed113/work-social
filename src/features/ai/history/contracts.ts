export type AiHistoryRole = 'user' | 'assistant' | 'system';
export type AiHistoryProvider = 'gemini' | 'local';
export type AiHistoryMode = 'online' | 'offline';

export interface AiHistoryAttachment {
  id: string;
  mimeType: string;
  name: string | null;
  size: number | null;
  reference: string;
}

export interface AiHistoryMessage {
  id: string;
  role: AiHistoryRole;
  content: string;
  createdAt: string;
  provider?: AiHistoryProvider;
  mode?: AiHistoryMode;
  attachments?: AiHistoryAttachment[];
}

export interface AiConversation {
  id: string;
  title: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
  messages: AiHistoryMessage[];
}

export interface AiConversationSummary {
  id: string;
  title: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface CreateConversationInput {
  id?: string;
  title?: string | null;
  summary?: string | null;
  createdAt?: string;
}

export interface UpdateConversationInput {
  title?: string | null;
  summary?: string | null;
}

export interface AiHistoryStore {
  listConversations(): Promise<AiConversationSummary[]>;
  getConversation(id: string): Promise<AiConversation | null>;
  createConversation(input?: CreateConversationInput): Promise<AiConversation>;
  appendMessage(id: string, message: AiHistoryMessage): Promise<AiConversation>;
  updateConversation(id: string, input: UpdateConversationInput): Promise<AiConversation>;
  deleteConversation(id: string): Promise<void>;
  clear(): Promise<void>;
}

export const AI_HISTORY_LIMITS = Object.freeze({
  maxConversations: 100,
  maxMessagesPerConversation: 200,
  maxMessageContentLength: 12_000,
  maxTitleLength: 200,
  maxSummaryLength: 1_024,
  maxAttachmentsPerMessage: 8,
  maxAttachmentNameLength: 255,
  maxAttachmentMimeTypeLength: 127,
  maxAttachmentReferenceLength: 2_048,
  maxAttachmentSizeBytes: 25 * 1024 * 1024,
});

export type AiHistoryErrorCode =
  | 'INVALID_RECORD'
  | 'INVALID_ARGUMENT'
  | 'CONVERSATION_NOT_FOUND'
  | 'DUPLICATE_ID'
  | 'LIMIT_EXCEEDED'
  | 'STORAGE_UNAVAILABLE'
  | 'STORAGE_FAILED';

export class AiHistoryError extends Error {
  constructor(
    readonly code: AiHistoryErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AiHistoryError';
  }
}

export function createAiHistoryId(prefix = 'ai'): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return `${prefix}-${cryptoApi.randomUUID()}`;

  const bytes = new Uint8Array(16);
  if (cryptoApi?.getRandomValues) cryptoApi.getRandomValues(bytes);
  else {
    const seed = Date.now();
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = (seed + index * 31) & 0xff;
  }
  return `${prefix}-${Date.now().toString(36)}-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
