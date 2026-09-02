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

  private withStore<T = void>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB is not available in this runtime.'));
    }

    return new Promise((resolve, reject) => {
      const openRequest = indexedDB.open(DATABASE_NAME, 1);
      openRequest.onupgradeneeded = () => {
        if (!openRequest.result.objectStoreNames.contains(STORE_NAME)) {
          openRequest.result.createObjectStore(STORE_NAME);
        }
      };
      openRequest.onerror = () => reject(openRequest.error ?? new Error('Unable to open model storage.'));
      openRequest.onsuccess = () => {
        const database = openRequest.result;
        const transaction = database.transaction(STORE_NAME, mode);
        const request = operation(transaction.objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Model storage operation failed.'));
        transaction.oncomplete = () => database.close();
        transaction.onerror = () => reject(transaction.error ?? new Error('Model storage transaction failed.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Model storage transaction aborted.'));
      };
    });
  }
}
