import type { AiMessage } from '../providers/contracts';

export const OFFLINE_WLLAMA_CONTEXT_SIZE = 1024;
export const OFFLINE_DEFAULT_MAX_TOKENS = 256;
export const OFFLINE_MAX_CONTEXT_MESSAGES = 8;
// Keep enough room for the system prompt and the current request while avoiding an
// ever-growing prefill. The current request is never truncated here.
export const OFFLINE_MAX_CONTEXT_CHARACTERS = 3_600;
export const OFFLINE_WLLAMA_BATCH_SIZE = 256;
export const OFFLINE_MAX_THREADS = 6;

export function getOfflineWllamaThreadCount(hardwareConcurrency: number | undefined = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 1): number {
  const cores = Number.isFinite(hardwareConcurrency) && hardwareConcurrency > 0 ? Math.floor(hardwareConcurrency) : 1;
  if (cores <= 2) return 1;
  return Math.min(OFFLINE_MAX_THREADS, Math.max(2, Math.floor(cores / 2)));
}

/**
 * Preserve all system messages and the current user request, then retain the
 * newest conversational turns that fit the local prefill budget.
 */
export function boundOfflineMessages(messages: AiMessage[], maxCharacters = OFFLINE_MAX_CONTEXT_CHARACTERS, maxMessages = OFFLINE_MAX_CONTEXT_MESSAGES): AiMessage[] {
  if (messages.length <= maxMessages && messages.reduce((total, message) => total + message.content.length, 0) <= maxCharacters) return messages;

  const current = [...messages].reverse().find((message) => message.role === 'user') ?? messages[messages.length - 1];
  const systems = messages.filter((message) => message.role === 'system' && message.id !== current?.id);
  const candidates = messages.filter((message) => message.id !== current?.id && message.role !== 'system').reverse();
  const selected: AiMessage[] = [];
  let usedCharacters = current?.content.length ?? 0;

  for (const message of systems) {
    if (selected.length + 2 > maxMessages) break;
    if (usedCharacters + message.content.length > maxCharacters) continue;
    selected.push(message);
    usedCharacters += message.content.length;
  }

  for (const message of candidates) {
    if (selected.length + 1 >= maxMessages) break;
    if (usedCharacters + message.content.length > maxCharacters) continue;
    selected.push(message);
    usedCharacters += message.content.length;
  }

  return [...selected, ...(current ? [current] : [])].sort((a, b) => messages.indexOf(a) - messages.indexOf(b));
}
