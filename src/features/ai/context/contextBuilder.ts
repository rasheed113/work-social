import type { AiAttachment, AiMessage } from '../providers/contracts';
import type { AiConversation } from '../history/contracts';
import type { AiMemory, AiMemoryStore } from '../history/memoryContracts';
import { containsSecretLikeText } from '../security/security';

export const DEFAULT_MAX_CONTEXT_CHARACTERS = 2_048;
export const MAX_CONTEXT_CHARACTERS = 8_192;
export const DEFAULT_MAX_CONTEXT_MESSAGES = 16;
export const MAX_CONTEXT_MESSAGES = 64;
export const MAX_CURRENT_REQUEST_CHARACTERS = 2_048;
export const MAX_SUMMARY_CHARACTERS = 1_024;
export interface AiContextOptions { maxCharacters: number; maxMessages: number; includeSummary: boolean; memoryIds?: string[]; }
export interface AiContextRequest { id?: string; conversationId: string; content: string; createdAt?: string; attachments?: AiAttachment[]; }
export interface AiContextResult { messages: AiMessage[]; summary: string | null; memories: AiMemory[]; includedMessageCount: number; truncated: boolean; estimatedCharacters: number; }
export type AiContextErrorCode = 'INVALID_ARGUMENT' | 'CONTEXT_TOO_LARGE' | 'CONVERSATION_NOT_FOUND';
export class AiContextError extends Error { constructor(readonly code: AiContextErrorCode, message: string, readonly cause?: unknown) { super(message); this.name = 'AiContextError'; } }
export const DEFAULT_AI_CONTEXT_OPTIONS: AiContextOptions = Object.freeze({ maxCharacters: DEFAULT_MAX_CONTEXT_CHARACTERS, maxMessages: DEFAULT_MAX_CONTEXT_MESSAGES, includeSummary: true });

export function buildAiContext(conversation: AiConversation, request: AiContextRequest, options: AiContextOptions = DEFAULT_AI_CONTEXT_OPTIONS, availableMemories: AiMemory[] = []): AiContextResult {
  validateOptions(options);
  if (!conversation || typeof conversation.id !== 'string' || conversation.id.length === 0) throw new AiContextError('INVALID_ARGUMENT', 'A valid conversation is required.');
  if (!request || typeof request.conversationId !== 'string' || request.conversationId !== conversation.id) throw new AiContextError('INVALID_ARGUMENT', 'The current request must belong to the conversation.');
  if (typeof request.content !== 'string' || request.content.length === 0) throw new AiContextError('INVALID_ARGUMENT', 'The current request must not be empty.');
  if (request.content.length > MAX_CURRENT_REQUEST_CHARACTERS) throw new AiContextError('CONTEXT_TOO_LARGE', `The current request exceeds the ${MAX_CURRENT_REQUEST_CHARACTERS}-character request limit.`);
  for (const memory of availableMemories) {
    if (!memory || typeof memory.key !== 'string' || typeof memory.value !== 'string' || containsSecretLikeText(memory.key) || containsSecretLikeText(memory.value)) {
      throw new AiContextError('INVALID_ARGUMENT', 'Context contains prohibited credential-like memory data.');
    }
  }

  const requestMessage: AiMessage = { id: request.id ?? 'context-current-request', conversationId: conversation.id, role: 'user', content: request.content, ...(request.createdAt ? { createdAt: request.createdAt } : {}), ...(request.attachments?.length ? { attachments: request.attachments } : {}) };
  const maxRecentMessages = Math.max(0, options.maxMessages - 1);
  const recentNewestFirst: AiMessage[] = [];
  let usedCharacters = requestMessage.content.length;
  let truncated = false;

  for (let index = conversation.messages.length - 1; index >= 0 && recentNewestFirst.length < maxRecentMessages; index -= 1) {
    const historyMessage = conversation.messages[index];
    if (historyMessage.id === requestMessage.id) { truncated = true; continue; }
    const message = toAiMessage(conversation.id, historyMessage);
    if (usedCharacters + message.content.length <= options.maxCharacters) { recentNewestFirst.push(message); usedCharacters += message.content.length; } else truncated = true;
  }
  const recentMessages = recentNewestFirst.reverse();
  if (conversation.messages.length > recentMessages.length + (conversation.messages.some((item) => item.id === requestMessage.id) ? 1 : 0)) truncated = true;

  let summaryMessage: AiMessage | null = null;
  if (options.includeSummary && conversation.summary) {
    if (conversation.summary.length > MAX_SUMMARY_CHARACTERS) throw new AiContextError('INVALID_ARGUMENT', `Conversation summary exceeds the ${MAX_SUMMARY_CHARACTERS}-character limit.`);
    const candidate: AiMessage = { id: 'context-summary', conversationId: conversation.id, role: 'system', content: `Conversation summary:\n${conversation.summary}` };
    if (recentMessages.length + 2 <= options.maxMessages && usedCharacters + candidate.content.length <= options.maxCharacters) { summaryMessage = candidate; usedCharacters += candidate.content.length; } else truncated = true;
  }

  const relevantMemories = selectRelevantMemories(availableMemories, request.content, options.memoryIds);
  const includedMemories: AiMemory[] = [];
  const includedMemoryMessages: AiMessage[] = [];
  for (const memory of relevantMemories) {
    const messageCountBeforeMemory = 1 + recentMessages.length + (summaryMessage ? 1 : 0) + includedMemories.length;
    if (messageCountBeforeMemory + 1 > options.maxMessages) { truncated = true; break; }
    const candidate: AiMessage = { id: `context-memory-${memory.id}`, conversationId: conversation.id, role: 'system', content: `Local memory ${memory.key}: ${memory.value}` };
    if (usedCharacters + candidate.content.length <= options.maxCharacters) {
      includedMemories.push(memory);
      includedMemoryMessages.push(candidate);
      usedCharacters += candidate.content.length;
    } else truncated = true;
  }
  if (includedMemories.length < relevantMemories.length) truncated = true;

  const messages = [
    ...(summaryMessage ? [summaryMessage] : []),
    ...includedMemoryMessages,
    ...recentMessages,
    requestMessage,
  ];
  return { messages, summary: summaryMessage ? conversation.summary : null, memories: includedMemories, includedMessageCount: messages.length, truncated, estimatedCharacters: usedCharacters };
}

export async function buildConversationContext(historyStore: { getConversation(id: string): Promise<AiConversation | null> }, conversationId: string, request: Omit<AiContextRequest, 'conversationId'>, options: AiContextOptions = DEFAULT_AI_CONTEXT_OPTIONS, memoryStore?: AiMemoryStore): Promise<AiContextResult> {
  const conversation = await historyStore.getConversation(conversationId); if (!conversation) throw new AiContextError('CONVERSATION_NOT_FOUND', `Conversation ${conversationId} was not found.`);
  const memories = memoryStore ? await memoryStore.list() : []; return buildAiContext(conversation, { ...request, conversationId }, options, memories);
}
function validateOptions(options: AiContextOptions): void {
  if (!options || !Number.isInteger(options.maxCharacters) || options.maxCharacters < 1 || options.maxCharacters > MAX_CONTEXT_CHARACTERS) throw new AiContextError('INVALID_ARGUMENT', `maxCharacters must be an integer between 1 and ${MAX_CONTEXT_CHARACTERS}.`);
  if (!Number.isInteger(options.maxMessages) || options.maxMessages < 1 || options.maxMessages > MAX_CONTEXT_MESSAGES) throw new AiContextError('INVALID_ARGUMENT', `maxMessages must be an integer between 1 and ${MAX_CONTEXT_MESSAGES}.`);
  if (typeof options.includeSummary !== 'boolean') throw new AiContextError('INVALID_ARGUMENT', 'includeSummary must be a boolean.');
  if (options.memoryIds && (!Array.isArray(options.memoryIds) || options.memoryIds.some((id) => typeof id !== 'string' || id.length === 0))) throw new AiContextError('INVALID_ARGUMENT', 'memoryIds must contain only non-empty IDs.');
}
function toAiMessage(conversationId: string, message: AiConversation['messages'][number]): AiMessage {
  const attachments = message.attachments?.map((attachment): AiAttachment => ({ id: attachment.id, kind: 'image', mimeType: attachment.mimeType, ...(attachment.name !== null ? { name: attachment.name } : {}), metadata: { reference: attachment.reference, ...(attachment.size !== null ? { declaredSizeBytes: attachment.size } : {}) } }));
  return { id: message.id, conversationId, role: message.role, content: message.content, ...(message.createdAt ? { createdAt: message.createdAt } : {}), ...(attachments?.length ? { attachments } : {}) };
}
function selectRelevantMemories(memories: AiMemory[], request: string, explicitIds?: string[]): AiMemory[] {
  const unique = new Map<string, AiMemory>();
  if (explicitIds) {
    const byId = new Map<string, AiMemory>();
    for (const memory of memories) byId.set(memory.id, memory);
    for (const id of explicitIds) { const memory = byId.get(id); if (memory) unique.set(memory.id, memory); }
  }
  const requestText = request.toLowerCase();
  for (const memory of memories) if (containsExactKey(requestText, memory.key.toLowerCase())) unique.set(memory.id, memory);
  return Array.from(unique.values()).sort((a, b) => a.id.localeCompare(b.id));
}
function containsExactKey(text: string, key: string): boolean {
  if (!key) return false;
  let offset = text.indexOf(key);
  while (offset !== -1) {
    const end = offset + key.length;
    if (!isKeyCharacter(text[offset - 1]) && !isKeyCharacter(text[end])) return true;
    offset = text.indexOf(key, offset + 1);
  }
  return false;
}
function isKeyCharacter(character: string | undefined): boolean { return character !== undefined && /[a-z0-9_-]/.test(character); }
