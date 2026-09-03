import type { AiModel, ModelDownloadProgress, ModelDownloader } from './modelContracts';
import { LocalInferenceRuntimeError } from '../runtime/localInferenceContracts';

export class WebModelDownloader implements ModelDownloader {
  private activeController: AbortController | null = null;
  async download(model: AiModel, signal?: AbortSignal, onProgress?: (progress: ModelDownloadProgress) => void): Promise<Blob> {
    if (!model.downloadSource?.uri) throw new LocalInferenceRuntimeError('MODEL_DOWNLOAD_FAILED', 'Local model download source is not configured.');
    if (this.activeController) throw new LocalInferenceRuntimeError('MODEL_DOWNLOAD_FAILED', 'Another local model download is already active.');
    const controller = new AbortController(); this.activeController = controller;
    const forwardAbort = () => controller.abort(); signal?.addEventListener('abort', forwardAbort, { once: true });
    try {
      let response: Response;
      try {
        response = await fetch(model.downloadSource.uri, { signal: controller.signal, cache: 'no-store' });
      } catch (error) {
        if (controller.signal.aborted) throw error;
        throw new LocalInferenceRuntimeError('MODEL_DOWNLOAD_FAILED', 'The browser could not fetch the local model resource.');
      }
      if (!response.ok) throw new LocalInferenceRuntimeError('MODEL_DOWNLOAD_FAILED', `The local model resource returned HTTP ${response.status}.`);
      const total = Number(response.headers.get('content-length')) || model.sizeBytes || null;
      if (!response.body) { const data = await response.blob(); onProgress?.({ receivedBytes: data.size, totalBytes: total }); return data; }
      const reader = response.body.getReader(); const chunks: ArrayBuffer[] = []; let receivedBytes = 0;
      while (true) {
        let result: ReadableStreamReadResult<Uint8Array>;
        try { result = await reader.read(); } catch (error) {
          if (controller.signal.aborted) throw error;
          throw new LocalInferenceRuntimeError('MODEL_DOWNLOAD_FAILED', 'The browser could not finish reading the local model resource.');
        }
        const { done, value } = result; if (done) break;
        if (value) { const copy = new Uint8Array(value.byteLength); copy.set(value); chunks.push(copy.buffer); receivedBytes += copy.byteLength; onProgress?.({ receivedBytes, totalBytes: total }); }
      }
      return new Blob(chunks, { type: 'application/octet-stream' });
    } finally { signal?.removeEventListener('abort', forwardAbort); if (this.activeController === controller) this.activeController = null; }
  }
  cancel(): void { this.activeController?.abort(); }
}
