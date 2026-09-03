import type { AiModel, ModelDownloadProgress, ModelDownloader } from './modelContracts';
import { LocalInferenceRuntimeError } from '../runtime/localInferenceContracts';
import { sanitizeDiagnosticUrl, sanitizeMessage, type LocalAiDiagnostic } from '../runtime/localAiDiagnostics';

export class WebModelDownloader implements ModelDownloader {
  private activeController: AbortController | null = null;
  async download(model: AiModel, signal?: AbortSignal, onProgress?: (progress: ModelDownloadProgress) => void): Promise<Blob> {
    const url = model.downloadSource?.uri;
    if (!url) throw new LocalInferenceRuntimeError('MODEL_DOWNLOAD_FAILED', 'Local model download source is not configured.', makeDiagnostic('MODEL_DOWNLOAD_FAILED', 'The model URL is missing.', model));
    if (this.activeController) throw new LocalInferenceRuntimeError('MODEL_DOWNLOAD_FAILED', 'Another local model download is already active.');
    const controller = new AbortController(); this.activeController = controller;
    const forwardAbort = () => controller.abort(); signal?.addEventListener('abort', forwardAbort, { once: true });
    try {
      let response: Response;
      try { response = await fetch(url, { signal: controller.signal, cache: 'no-store' }); }
      catch (error) {
        if (controller.signal.aborted) throw error;
        throw new LocalInferenceRuntimeError('MODEL_DOWNLOAD_FAILED', 'The browser could not fetch the local model resource.', makeDiagnostic('MODEL_DOWNLOAD_FAILED', 'Browser fetch failed; no HTTP response was received.', model, url, error));
      }
      if (!response.ok) throw new LocalInferenceRuntimeError('MODEL_DOWNLOAD_FAILED', `The local model resource returned HTTP ${response.status}.`, makeDiagnostic('MODEL_DOWNLOAD_FAILED', `The local model resource returned HTTP ${response.status}.`, model, url, undefined, response));
      const total = Number(response.headers.get('content-length')) || model.sizeBytes || null;
      if (!response.body) {
        try { const data = await response.blob(); onProgress?.({ receivedBytes: data.size, totalBytes: total }); return data; }
        catch (error) { throw new LocalInferenceRuntimeError('MODEL_DOWNLOAD_FAILED', 'The browser could not read the local model response body.', makeDiagnostic('MODEL_DOWNLOAD_FAILED', 'The model response body could not be read.', model, url, error, response)); }
      }
      const reader = response.body.getReader(); const chunks: ArrayBuffer[] = []; let receivedBytes = 0;
      while (true) {
        let result: ReadableStreamReadResult<Uint8Array>;
        try { result = await reader.read(); }
        catch (error) { if (controller.signal.aborted) throw error; throw new LocalInferenceRuntimeError('MODEL_DOWNLOAD_FAILED', 'The browser could not finish reading the local model resource.', makeDiagnostic('MODEL_DOWNLOAD_FAILED', 'The model response stream could not be read to completion.', model, url, error, response)); }
        const { done, value } = result; if (done) break;
        if (value) { const copy = new Uint8Array(value.byteLength); copy.set(value); chunks.push(copy.buffer); receivedBytes += copy.byteLength; onProgress?.({ receivedBytes, totalBytes: total }); }
      }
      return new Blob(chunks, { type: 'application/octet-stream' });
    } finally { signal?.removeEventListener('abort', forwardAbort); if (this.activeController === controller) this.activeController = null; }
  }
  cancel(): void { this.activeController?.abort(); }
}

function makeDiagnostic(code: string, message: string, model: AiModel, url?: string, error?: unknown, response?: Response): LocalAiDiagnostic {
  return { stage: 'MODEL_DOWNLOAD', code, message, resource: 'Qwen GGUF model', url: sanitizeDiagnosticUrl(url), status: response?.status, statusText: response?.statusText, responseType: response?.type, errorName: error instanceof Error ? error.name : undefined, errorMessage: error instanceof Error ? sanitizeMessage(error.message) : undefined, cause: error instanceof Error ? sanitizeMessage(error.message) : undefined, timestamp: new Date().toISOString(), modelId: model.id, modelVersion: model.version };
}
