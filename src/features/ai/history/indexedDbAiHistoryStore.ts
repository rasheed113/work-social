import {
  AI_HISTORY_LIMITS,
  AiHistoryError,
  type AiConversation,
  type AiConversationSummary,
  type AiHistoryAttachment,
  type AiHistoryMessage,
  type AiHistoryStore,
  type CreateConversationInput,
  type UpdateConversationInput,
  createAiHistoryId,
  nowIso,
} from './contracts';
import { containsSecretLikeText } from '../security/security';

const DATABASE_NAME = 'work-social-ai-history';
const DATABASE_VERSION = 2;
const CONVERSATIONS_STORE = 'conversations';
const MEMORIES_STORE = 'memories';
const IDB_KEY_PATH = 'id';

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
function validString(value: unknown, allowEmpty = false): value is string { return typeof value === 'string' && (allowEmpty || value.length > 0); }
function validIso(value: unknown): value is string { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }

function validateAttachment(value: unknown): AiHistoryAttachment {
  if (!isRecord(value)) throw new AiHistoryError('INVALID_RECORD', 'Stored attachment metadata is malformed.');
  const id = value.id;
  const mimeType = value.mimeType;
  const name = value.name;
  const size = value.size === undefined ? null : value.size;
  const reference = value.reference;
  if (!validString(id) || !validString(mimeType)
    || (name !== null && !validString(name, true))
    || (size !== null && (!Number.isSafeInteger(size) || size < 0))
    || !validString(reference)) throw new AiHistoryError('INVALID_RECORD', 'Stored attachment metadata is malformed.');
  if (mimeType.length > AI_HISTORY_LIMITS.maxAttachmentMimeTypeLength
    || (name !== null && name.length > AI_HISTORY_LIMITS.maxAttachmentNameLength)
    || reference.length > AI_HISTORY_LIMITS.maxAttachmentReferenceLength
    || (size !== null && size > AI_HISTORY_LIMITS.maxAttachmentSizeBytes)) throw new AiHistoryError('INVALID_RECORD', 'Stored attachment metadata exceeds history limits.');
  if ((name !== null && containsSecretLikeText(name)) || containsSecretLikeText(reference)) throw new AiHistoryError('INVALID_RECORD', 'Stored attachment metadata contains prohibited credential-like data.');
  return { id, mimeType, name: name as string | null, size: size as number | null, reference };
}

function validateMessage(value: unknown): AiHistoryMessage {
  if (!isRecord(value) || !validString(value.id) || !['user', 'assistant', 'system'].includes(String(value.role))
    || !validString(value.content, true) || !validIso(value.createdAt)) throw new AiHistoryError('INVALID_RECORD', 'Stored history message is malformed.');
  if (value.content.length > AI_HISTORY_LIMITS.maxMessageContentLength) throw new AiHistoryError('INVALID_RECORD', 'Stored history message exceeds the content limit.');
  if (containsSecretLikeText(value.content)) throw new AiHistoryError('INVALID_RECORD', 'Stored history message contains prohibited credential-like data.');
  if (value.provider !== undefined && value.provider !== 'gemini' && value.provider !== 'local') throw new AiHistoryError('INVALID_RECORD', 'Stored message has an invalid provider.');
  if (value.mode !== undefined && value.mode !== 'online' && value.mode !== 'offline') throw new AiHistoryError('INVALID_RECORD', 'Stored message has an invalid mode.');
  if (value.attachments !== undefined && (!Array.isArray(value.attachments) || value.attachments.length > AI_HISTORY_LIMITS.maxAttachmentsPerMessage)) throw new AiHistoryError('INVALID_RECORD', 'Stored message has an invalid attachment list.');
  const attachments = value.attachments === undefined ? undefined : value.attachments.map(validateAttachment);
  return {
    id: value.id,
    role: value.role as AiHistoryMessage['role'],
    content: value.content,
    createdAt: value.createdAt,
    ...(value.provider !== undefined ? { provider: value.provider as AiHistoryMessage['provider'] } : {}),
    ...(value.mode !== undefined ? { mode: value.mode as AiHistoryMessage['mode'] } : {}),
    ...(attachments !== undefined ? { attachments } : {}),
  };
}

function validateConversation(value: unknown): AiConversation {
  if (!isRecord(value) || !validString(value.id) || (value.title !== null && !validString(value.title, true))
    || !validIso(value.createdAt) || !validIso(value.updatedAt) || !Array.isArray(value.messages)) throw new AiHistoryError('INVALID_RECORD', 'Stored conversation is malformed.');
  if (value.title !== null && value.title.length > AI_HISTORY_LIMITS.maxTitleLength) throw new AiHistoryError('INVALID_RECORD', 'Stored conversation title exceeds the limit.');
  if (value.title !== null && containsSecretLikeText(value.title)) throw new AiHistoryError('INVALID_RECORD', 'Stored conversation title contains prohibited credential-like data.');
  const summary = value.summary === undefined ? null : value.summary;
  if (summary !== null && (!validString(summary, true) || summary.length > AI_HISTORY_LIMITS.maxSummaryLength)) throw new AiHistoryError('INVALID_RECORD', 'Stored conversation summary is malformed or exceeds the limit.');
  if (summary !== null && containsSecretLikeText(summary)) throw new AiHistoryError('INVALID_RECORD', 'Stored conversation summary contains prohibited credential-like data.');
  if (value.messages.length > AI_HISTORY_LIMITS.maxMessagesPerConversation) throw new AiHistoryError('INVALID_RECORD', 'Stored conversation exceeds the message limit.');
  const messages = value.messages.map(validateMessage);
  const ids = new Set<string>();
  for (const message of messages) {
    if (ids.has(message.id)) throw new AiHistoryError('INVALID_RECORD', 'Stored conversation contains duplicate message IDs.');
    ids.add(message.id);
  }
  return { id: value.id, title: value.title as string | null, summary: summary as string | null, createdAt: value.createdAt, updatedAt: value.updatedAt, messages };
}

function validateTitle(title: string | null | undefined): string | null | undefined {
  if (title === undefined) return undefined;
  if (title === null) return null;
  if (typeof title !== 'string' || title.length > AI_HISTORY_LIMITS.maxTitleLength) throw new AiHistoryError('LIMIT_EXCEEDED', `Conversation title must be ${AI_HISTORY_LIMITS.maxTitleLength} characters or fewer.`);
  if (containsSecretLikeText(title)) throw new AiHistoryError('INVALID_ARGUMENT', 'Credential-like conversation titles are not allowed.');
  return title;
}
function validateSummary(summary: string | null | undefined): string | null | undefined {
  if (summary === undefined) return undefined;
  if (summary === null) return null;
  if (typeof summary !== 'string' || summary.length > AI_HISTORY_LIMITS.maxSummaryLength) throw new AiHistoryError('LIMIT_EXCEEDED', `Conversation summary must be ${AI_HISTORY_LIMITS.maxSummaryLength} characters or fewer.`);
  if (containsSecretLikeText(summary)) throw new AiHistoryError('INVALID_ARGUMENT', 'Credential-like conversation summaries are not allowed.');
  return summary;
}
function validateMessageInput(message: AiHistoryMessage): AiHistoryMessage {
  try {
    const validated = validateMessage(message);
    if (validated.id.length > 200) throw new AiHistoryError('LIMIT_EXCEEDED', 'Message ID is too long.');
    return validated;
  } catch (error) {
    if (error instanceof AiHistoryError && error.code === 'LIMIT_EXCEEDED') throw error;
    if (error instanceof AiHistoryError && error.code === 'INVALID_RECORD' && containsSecretLikeText(message.content)) throw new AiHistoryError('INVALID_ARGUMENT', 'Credential-like history content is not allowed.');
    throw new AiHistoryError('INVALID_ARGUMENT', 'History message is invalid.', error);
  }
}

function getIndexedDb(): IDBFactory {
  if (typeof indexedDB === 'undefined') throw new AiHistoryError('STORAGE_UNAVAILABLE', 'IndexedDB is unavailable in this environment.');
  return indexedDB;
}

export class IndexedDbAiHistoryStore implements AiHistoryStore {
  private databasePromise: Promise<IDBDatabase> | null = null;
  async listConversations(): Promise<AiConversationSummary[]> {
    return this.withStore('readonly', async (store) => (await requestAll(store)).map((record) => {
      const conversation = validateConversation(record);
      return { id: conversation.id, title: conversation.title, summary: conversation.summary, createdAt: conversation.createdAt, updatedAt: conversation.updatedAt, messageCount: conversation.messages.length };
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }
  async getConversation(id: string): Promise<AiConversation | null> {
    this.validateId(id, 'conversation');
    return this.withStore('readonly', async (store) => { const record = await request(store.get(id)); return record === undefined ? null : validateConversation(record); });
  }
  async createConversation(input: CreateConversationInput = {}): Promise<AiConversation> {
    const id = input.id ?? createAiHistoryId('conversation'); this.validateId(id, 'conversation');
    const title = validateTitle(input.title) ?? null; const summary = validateSummary(input.summary) ?? null; const createdAt = input.createdAt ?? nowIso();
    if (!validIso(createdAt)) throw new AiHistoryError('INVALID_ARGUMENT', 'Conversation createdAt must be a valid timestamp.');
    const conversation: AiConversation = { id, title, summary, createdAt, updatedAt: createdAt, messages: [] };
    return this.withStore('readwrite', async (store) => {
      if (await request(store.count()) >= AI_HISTORY_LIMITS.maxConversations) throw new AiHistoryError('LIMIT_EXCEEDED', `A maximum of ${AI_HISTORY_LIMITS.maxConversations} conversations is supported.`);
      if (await request(store.get(id)) !== undefined) throw new AiHistoryError('DUPLICATE_ID', `Conversation ${id} already exists.`);
      await request(store.add(conversation)); return conversation;
    });
  }
  async appendMessage(id: string, message: AiHistoryMessage): Promise<AiConversation> {
    this.validateId(id, 'conversation'); const validatedMessage = validateMessageInput(message);
    return this.withStore('readwrite', async (store) => {
      const record = await request(store.get(id)); if (record === undefined) throw new AiHistoryError('CONVERSATION_NOT_FOUND', `Conversation ${id} was not found.`);
      const conversation = validateConversation(record);
      if (conversation.messages.some((item) => item.id === validatedMessage.id)) throw new AiHistoryError('DUPLICATE_ID', `Message ${validatedMessage.id} already exists in conversation ${id}.`);
      if (conversation.messages.length >= AI_HISTORY_LIMITS.maxMessagesPerConversation) throw new AiHistoryError('LIMIT_EXCEEDED', `A maximum of ${AI_HISTORY_LIMITS.maxMessagesPerConversation} messages per conversation is supported.`);
      const updated: AiConversation = { ...conversation, updatedAt: validatedMessage.createdAt, messages: [...conversation.messages, validatedMessage] };
      await request(store.put(updated)); return updated;
    });
  }
  async updateConversation(id: string, input: UpdateConversationInput): Promise<AiConversation> {
    this.validateId(id, 'conversation'); const title = validateTitle(input.title); const summary = validateSummary(input.summary);
    return this.withStore('readwrite', async (store) => {
      const record = await request(store.get(id)); if (record === undefined) throw new AiHistoryError('CONVERSATION_NOT_FOUND', `Conversation ${id} was not found.`);
      const conversation = validateConversation(record); const updated: AiConversation = { ...conversation, title: title === undefined ? conversation.title : title, summary: summary === undefined ? conversation.summary : summary, updatedAt: nowIso() };
      await request(store.put(updated)); return updated;
    });
  }
  async deleteConversation(id: string): Promise<void> {
    this.validateId(id, 'conversation'); return this.withStore('readwrite', async (store) => {
      const existing = await request(store.get(id)); if (existing === undefined) throw new AiHistoryError('CONVERSATION_NOT_FOUND', `Conversation ${id} was not found.`);
      validateConversation(existing); await request(store.delete(id));
    });
  }
  async clear(): Promise<void> { await this.withStore('readwrite', async (store) => { await request(store.clear()); }); }
  private validateId(id: string, kind: string): void { if (!validString(id) || id.length > 200) throw new AiHistoryError('INVALID_ARGUMENT', `Invalid ${kind} ID.`); }
  private openDatabase(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    const promise = new Promise<IDBDatabase>((resolve, reject) => {
      let requestHandle: IDBOpenDBRequest;
      try { requestHandle = getIndexedDb().open(DATABASE_NAME, DATABASE_VERSION); }
      catch (error) { reject(new AiHistoryError('STORAGE_UNAVAILABLE', 'Could not access IndexedDB.', error)); return; }
      requestHandle.onupgradeneeded = () => { const database = requestHandle.result; if (!database.objectStoreNames.contains(CONVERSATIONS_STORE)) database.createObjectStore(CONVERSATIONS_STORE, { keyPath: IDB_KEY_PATH }); if (!database.objectStoreNames.contains(MEMORIES_STORE)) database.createObjectStore(MEMORIES_STORE, { keyPath: IDB_KEY_PATH }); };
      requestHandle.onsuccess = () => { const database = requestHandle.result; database.onversionchange = () => database.close(); resolve(database); };
      requestHandle.onerror = () => reject(new AiHistoryError('STORAGE_FAILED', 'Could not open AI history storage.', requestHandle.error));
      requestHandle.onblocked = () => reject(new AiHistoryError('STORAGE_FAILED', 'AI history storage is blocked by another database connection.'));
    }).catch((error) => { this.databasePromise = null; throw error instanceof AiHistoryError ? error : new AiHistoryError('STORAGE_FAILED', 'Could not open AI history storage.', error); });
    this.databasePromise = promise;
    return promise;
  }
  private async withStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => Promise<T>): Promise<T> {
    const database = await this.openDatabase();
    return new Promise<T>((resolve, reject) => {
      let transaction: IDBTransaction;
      try { transaction = database.transaction(CONVERSATIONS_STORE, mode); }
      catch (error) { reject(new AiHistoryError('STORAGE_FAILED', 'Could not start AI history transaction.', error)); return; }
      const store = transaction.objectStore(CONVERSATIONS_STORE); let result: T; let operationError: unknown = null;
      operation(store).then((value) => { result = value; }).catch((error) => { operationError = error; try { transaction.abort(); } catch { /* Transaction may already be inactive. */ } });
      transaction.oncomplete = () => { if (operationError) reject(operationError instanceof AiHistoryError ? operationError : new AiHistoryError('STORAGE_FAILED', 'AI history operation failed.', operationError)); else resolve(result!); };
      transaction.onerror = () => reject(operationError instanceof AiHistoryError ? operationError : new AiHistoryError('STORAGE_FAILED', 'AI history transaction failed.', transaction.error));
      transaction.onabort = () => reject(operationError instanceof AiHistoryError ? operationError : new AiHistoryError('STORAGE_FAILED', 'AI history transaction was aborted.', transaction.error));
    });
  }
}
function request<T>(requestHandle: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { requestHandle.onsuccess = () => resolve(requestHandle.result); requestHandle.onerror = () => reject(new AiHistoryError('STORAGE_FAILED', 'IndexedDB request failed.', requestHandle.error)); }); }
function requestAll(store: IDBObjectStore): Promise<unknown[]> { return request(store.getAll()) as Promise<unknown[]>; }
export { DATABASE_NAME as AI_HISTORY_DATABASE_NAME, DATABASE_VERSION as AI_HISTORY_DATABASE_VERSION, MEMORIES_STORE as AI_MEMORY_STORE_NAME };