import type { AiModel, ModelStorage } from './modelContracts';
import { sha256Hex } from './sha256';

const DATABASE_NAME = 'work-social-ai-models';
const STORE_NAME = 'models';
const STORAGE_NAMESPACE = 'models/';

/**
 * Browser-safe storage boundary. This is an origin-scoped IndexedDB adapter,
 * not an Android app-private filesystem implementation.
 */
export class WebModelStorage implements ModelStorage {
  private databasePromise: Promise<IDBDatabase> | null = null;

  getModelPath(model: AiModel): string {
    return `${STORAGE_NAMESPACE}${encodeURIComponent(model.id)}/${encodeURIComponent(model.version)}`;
  }

  async exists(model: AiModel): Promise<boolean> {
    return (await this.read(model)) !== null;
  }

  async getSize(model: AiModel): Promise<number | null> {
    const data = await this.read(model);
    return data?.size ?? null;
  }

  async write(model: AiModel, data: Blob): Promise<void> {
    await this.withStore('readwrite', (store) => store.put(data, this.getModelPath(model)));
  }

  async read(model: AiModel): Promise<Blob | null> {
    return this.withStore<Blob | undefined>('readonly', (store) => store.get(this.getModelPath(model)))
      .then((data) => data ?? null);
  }

  async delete(model: AiModel): Promise<void> {
    await this.withStore('readwrite', (store) => store.delete(this.getModelPath(model)));
  }

  async verifyChecksum(model: AiModel): Promise<boolean> {
    if (!model.sha256) return false;
    const data = await this.read(model);
    if (!data) return false;
    return (await sha256Hex(data)) === model.sha256.toLowerCase();
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available in this runtime.'));
        return;
      }
      let openRequest: IDBOpenDBRequest;
      try { openRequest = indexedDB.open(DATABASE_NAME, 1); }
      catch (error) { reject(error); return; }
      openRequest.onupgradeneeded = () => {
        if (!openRequest.result.objectStoreNames.contains(STORE_NAME)) openRequest.result.createObjectStore(STORE_NAME);
      };
      openRequest.onerror = () => reject(openRequest.error ?? new Error('Unable to open model storage.'));
      openRequest.onblocked = () => reject(new Error('Model storage is blocked by another database connection.'));
      openRequest.onsuccess = () => {
        const database = openRequest.result;
        database.onversionchange = () => { database.close(); this.databasePromise = null; };
        database.onclose = () => { if (this.databasePromise) this.databasePromise = null; };
        resolve(database);
      };
    }).catch((error) => {
      this.databasePromise = null;
      throw error;
    });
    return this.databasePromise;
  }

  private async withStore<T = void>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      let transaction: IDBTransaction;
      try { transaction = database.transaction(STORE_NAME, mode); }
      catch (error) { this.databasePromise = null; reject(error); return; }
      const request = operation(transaction.objectStore(STORE_NAME));
      let result: T;
      let requestError: DOMException | null = null;
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => { requestError = request.error; };
      transaction.oncomplete = () => {
        if (requestError) reject(requestError);
        else resolve(result!);
      };
      transaction.onerror = () => reject(transaction.error ?? requestError ?? new Error('Model storage transaction failed.'));
      transaction.onabort = () => reject(transaction.error ?? requestError ?? new Error('Model storage transaction aborted.'));
    });
  }
}
