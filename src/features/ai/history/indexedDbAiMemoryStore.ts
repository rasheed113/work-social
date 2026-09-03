import { containsSecretLikeText, isSecretLikeKey, isSecretLikeValue } from '../security/security';
import {
  AI_MEMORY_LIMITS,
  AiMemoryError,
  type AiMemory,
  type AiMemoryStore,
} from './memoryContracts';
import {
  AI_HISTORY_DATABASE_NAME,
  AI_HISTORY_DATABASE_VERSION,
  AI_MEMORY_STORE_NAME,
} from './indexedDbAiHistoryStore';

const CONVERSATIONS_STORE = 'conversations';
const IDB_KEY_PATH = 'id';

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
function validString(value: unknown, allowEmpty = false): value is string { return typeof value === 'string' && (allowEmpty || value.length > 0); }
function validIso(value: unknown): value is string { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }

function prohibitedMemoryData(key: string, value: string): boolean {
  return isSecretLikeKey(key) || isSecretLikeValue(value) || containsSecretLikeText(value);
}

function validateMemory(value: unknown): AiMemory {
  if (!isRecord(value) || !validString(value.id) || !validString(value.key) || !validString(value.value) || !validIso(value.createdAt) || !validIso(value.updatedAt)) throw new AiMemoryError('INVALID_RECORD', 'Stored AI memory record is malformed.');
  if (value.id.length > AI_MEMORY_LIMITS.maxIdLength || value.key.length > AI_MEMORY_LIMITS.maxKeyLength || value.value.length > AI_MEMORY_LIMITS.maxValueLength) throw new AiMemoryError('INVALID_RECORD', 'Stored AI memory record exceeds the memory limits.');
  if (prohibitedMemoryData(value.key, value.value)) throw new AiMemoryError('INVALID_RECORD', 'Stored AI memory contains a prohibited secret-like value.');
  return { id: value.id, key: value.key, value: value.value, createdAt: value.createdAt, updatedAt: value.updatedAt };
}

function validateMemoryInput(memory: AiMemory): AiMemory {
  try {
    if (!isRecord(memory)) throw new AiMemoryError('INVALID_ARGUMENT', 'AI memory must be an object.');
    if (!validString(memory.id) || memory.id.length > AI_MEMORY_LIMITS.maxIdLength) throw new AiMemoryError('LIMIT_EXCEEDED', `Memory ID must be 1-${AI_MEMORY_LIMITS.maxIdLength} characters.`);
    if (!validString(memory.key)) throw new AiMemoryError('INVALID_ARGUMENT', 'Memory key must not be empty.');
    if (memory.key.length > AI_MEMORY_LIMITS.maxKeyLength) throw new AiMemoryError('LIMIT_EXCEEDED', `Memory key must be ${AI_MEMORY_LIMITS.maxKeyLength} characters or fewer.`);
    if (!validString(memory.value)) throw new AiMemoryError('INVALID_ARGUMENT', 'Memory value must not be empty.');
    if (memory.value.length > AI_MEMORY_LIMITS.maxValueLength) throw new AiMemoryError('LIMIT_EXCEEDED', `Memory value must be ${AI_MEMORY_LIMITS.maxValueLength} characters or fewer.`);
    if (prohibitedMemoryData(memory.key, memory.value)) throw new AiMemoryError('SECRET_NOT_ALLOWED', 'Secret-like memory keys or values are not allowed.');
    if (!validIso(memory.createdAt) || !validIso(memory.updatedAt)) throw new AiMemoryError('INVALID_ARGUMENT', 'Memory timestamps must be valid ISO timestamps.');
    return { id: memory.id, key: memory.key, value: memory.value, createdAt: memory.createdAt, updatedAt: memory.updatedAt };
  } catch (error) {
    if (error instanceof AiMemoryError) throw error;
    throw new AiMemoryError('INVALID_ARGUMENT', 'AI memory is invalid.', error);
  }
}
function getIndexedDb(): IDBFactory { if (typeof indexedDB === 'undefined') throw new AiMemoryError('STORAGE_UNAVAILABLE', 'IndexedDB is unavailable in this environment.'); return indexedDB; }

export class IndexedDbAiMemoryStore implements AiMemoryStore {
  private databasePromise: Promise<IDBDatabase> | null = null;
  async list(): Promise<AiMemory[]> { return this.withStore('readonly', async (store) => (await requestAll(store)).map(validateMemory).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))); }
  async get(id: string): Promise<AiMemory | null> { this.validateId(id); return this.withStore('readonly', async (store) => { const record = await request(store.get(id)); return record === undefined ? null : validateMemory(record); }); }
  async upsert(memory: AiMemory): Promise<AiMemory> {
    const validated = validateMemoryInput(memory);
    return this.withStore('readwrite', async (store) => {
      const existingRecord = await request(store.get(validated.id)); const existing = existingRecord === undefined ? null : validateMemory(existingRecord);
      if (!existing && await request(store.count()) >= AI_MEMORY_LIMITS.maxMemories) throw new AiMemoryError('LIMIT_EXCEEDED', `A maximum of ${AI_MEMORY_LIMITS.maxMemories} local memories is supported.`);
      const next = existing ? { ...validated, createdAt: existing.createdAt } : validated; await request(store.put(next)); return next;
    });
  }
  async delete(id: string): Promise<void> { this.validateId(id); return this.withStore('readwrite', async (store) => { const existing = await request(store.get(id)); if (existing === undefined) throw new AiMemoryError('MEMORY_NOT_FOUND', `Memory ${id} was not found.`); validateMemory(existing); await request(store.delete(id)); }); }
  async clear(): Promise<void> { await this.withStore('readwrite', async (store) => { await request(store.clear()); }); }
  private validateId(id: string): void { if (!validString(id) || id.length > AI_MEMORY_LIMITS.maxIdLength) throw new AiMemoryError('INVALID_ARGUMENT', 'Invalid memory ID.'); }
  private openDatabase(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    const promise = new Promise<IDBDatabase>((resolve, reject) => {
      let requestHandle: IDBOpenDBRequest;
      try { requestHandle = getIndexedDb().open(AI_HISTORY_DATABASE_NAME, AI_HISTORY_DATABASE_VERSION); } catch (error) { reject(new AiMemoryError('STORAGE_UNAVAILABLE', 'Could not access IndexedDB.', error)); return; }
      requestHandle.onupgradeneeded = () => { const database = requestHandle.result; if (!database.objectStoreNames.contains(CONVERSATIONS_STORE)) database.createObjectStore(CONVERSATIONS_STORE, { keyPath: IDB_KEY_PATH }); if (!database.objectStoreNames.contains(AI_MEMORY_STORE_NAME)) database.createObjectStore(AI_MEMORY_STORE_NAME, { keyPath: IDB_KEY_PATH }); };
      requestHandle.onsuccess = () => { const database = requestHandle.result; database.onversionchange = () => database.close(); resolve(database); };
      requestHandle.onerror = () => reject(new AiMemoryError('STORAGE_FAILED', 'Could not open AI memory storage.', requestHandle.error));
      requestHandle.onblocked = () => reject(new AiMemoryError('STORAGE_FAILED', 'AI memory storage is blocked by another database connection.'));
    }).catch((error) => { this.databasePromise = null; throw error instanceof AiMemoryError ? error : new AiMemoryError('STORAGE_FAILED', 'Could not open AI memory storage.', error); });
    this.databasePromise = promise;
    return promise;
  }
  private async withStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => Promise<T>): Promise<T> {
    const database = await this.openDatabase();
    return new Promise<T>((resolve, reject) => {
      let transaction: IDBTransaction;
      try { transaction = database.transaction(AI_MEMORY_STORE_NAME, mode); } catch (error) { reject(new AiMemoryError('STORAGE_FAILED', 'Could not start AI memory transaction.', error)); return; }
      const store = transaction.objectStore(AI_MEMORY_STORE_NAME); let result: T; let operationError: unknown = null;
      operation(store).then((value) => { result = value; }).catch((error) => { operationError = error; try { transaction.abort(); } catch { /* Transaction may already be inactive. */ } });
      transaction.oncomplete = () => { if (operationError) reject(operationError instanceof AiMemoryError ? operationError : new AiMemoryError('STORAGE_FAILED', 'AI memory operation failed.', operationError)); else resolve(result!); };
      transaction.onerror = () => reject(operationError instanceof AiMemoryError ? operationError : new AiMemoryError('STORAGE_FAILED', 'AI memory transaction failed.', transaction.error));
      transaction.onabort = () => reject(operationError instanceof AiMemoryError ? operationError : new AiMemoryError('STORAGE_FAILED', 'AI memory transaction was aborted.', transaction.error));
    });
  }
}
function request<T>(requestHandle: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { requestHandle.onsuccess = () => resolve(requestHandle.result); requestHandle.onerror = () => reject(new AiMemoryError('STORAGE_FAILED', 'IndexedDB memory request failed.', requestHandle.error)); }); }
function requestAll(store: IDBObjectStore): Promise<unknown[]> { return request(store.getAll()) as Promise<unknown[]>; }
