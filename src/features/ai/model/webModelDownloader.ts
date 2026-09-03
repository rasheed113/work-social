import type { AiModel, ModelDownloadProgress, ModelDownloader } from './modelContracts';

export class WebModelDownloader implements ModelDownloader {
  private activeController: AbortController | null = null;
  async download(model: AiModel, signal?: AbortSignal, onProgress?: (progress: ModelDownloadProgress) => void): Promise<Blob> {
    if (!model.downloadSource?.uri) throw new Error('LOCAL_MODEL_SOURCE_MISSING: no model download source is configured.');
    if (this.activeController) throw new Error('LOCAL_MODEL_DOWNLOAD_BUSY: another model download is active.');
    const controller = new AbortController(); this.activeController = controller;
    const forwardAbort = () => controller.abort(); signal?.addEventListener('abort', forwardAbort, { once: true });
    try {
      const response = await fetch(model.downloadSource.uri, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`LOCAL_MODEL_DOWNLOAD_FAILED: HTTP ${response.status}.`);
      const total = Number(response.headers.get('content-length')) || model.sizeBytes || null;
      if (!response.body) { const data = await response.blob(); onProgress?.({ receivedBytes: data.size, totalBytes: total }); return data; }
      const reader = response.body.getReader(); const chunks: ArrayBuffer[] = []; let receivedBytes = 0;
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        if (value) { const copy = new Uint8Array(value.byteLength); copy.set(value); chunks.push(copy.buffer); receivedBytes += copy.byteLength; onProgress?.({ receivedBytes, totalBytes: total }); }
      }
      return new Blob(chunks, { type: 'application/octet-stream' });
    } finally { signal?.removeEventListener('abort', forwardAbort); if (this.activeController === controller) this.activeController = null; }
  }
  cancel(): void { this.activeController?.abort(); }
}
