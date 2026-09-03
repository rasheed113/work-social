import type { AiModel, ModelDownloadProgress, ModelDownloader } from './modelContracts';
import { LocalInferenceRuntimeError } from '../runtime/localInferenceContracts';
import { sanitizeDiagnosticUrl, sanitizeMessage, type LocalAiDiagnostic } from '../runtime/localAiDiagnostics';

const MAX_ATTEMPTS = 2;
const RETRY_DELAYS_MS = [750];

export class WebModelDownloader implements ModelDownloader {
  private activeController: AbortController | null = null;

  async download(model: AiModel, signal?: AbortSignal, onProgress?: (progress: ModelDownloadProgress) => void): Promise<Blob> {
    const url = model.downloadSource?.uri;
    if (!url) throw new LocalInferenceRuntimeError('MODEL_DOWNLOAD_FAILED', 'Local model download source is not configured.', makeDiagnostic('MODEL_DOWNLOAD_FAILED', 'The model URL is missing.', model));
    if (this.activeController) throw new LocalInferenceRuntimeError('MODEL_DOWNLOAD_FAILED', 'Another local model download is already active.');

    const controller = new AbortController();
    this.activeController = controller;
    const forwardAbort = () => controller.abort();
    signal?.addEventListener('abort', forwardAbort, { once: true });
    if (signal?.aborted) controller.abort();

    try {
      let lastError: unknown;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
          return await this.downloadOnce(model, url, controller.signal, onProgress);
        } catch (error) {
          if (controller.signal.aborted) throw error;
          lastError = error;
          if (attempt >= MAX_ATTEMPTS || !isRetryableDownloadError(error)) throw error;
          await delay(RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)], controller.signal);
        }
      }
      throw lastError ?? new LocalInferenceRuntimeError('MODEL_DOWNLOAD_FAILED', 'The local model download failed.');
    } catch (error) {
      if (controller.signal.aborted) {
        throw new LocalInferenceRuntimeError('MODEL_DOWNLOAD_ABORTED', 'The local model download was cancelled.', makeDiagnostic('MODEL_DOWNLOAD_ABORTED', 'The model download was cancelled.', model, url, error));
      }
      throw error;
    } finally {
      signal?.removeEventListener('abort', forwardAbort);
      if (this.activeController === controller) this.activeController = null;
    }
  }

  cancel(): void { this.activeController?.abort(); }

  private async downloadOnce(model: AiModel, url: string, signal: AbortSignal, onProgress?: (progress: ModelDownloadProgress) => void): Promise<Blob> {
    const startedAt = performance.now();
    let response: Response;
    try {
      response = await fetch(url, { signal, cache: 'no-store' });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new LocalInferenceRuntimeError('MODEL_DOWNLOAD_FETCH_FAILED', 'The browser could not fetch the local model resource.', makeDiagnostic('MODEL_DOWNLOAD_FETCH_FAILED', 'Browser fetch failed; no HTTP response was received.', model, url, error, undefined, startedAt));
    }

    const responseMeta = makeResponseMeta(response);
    if (!response.ok) {
      throw new LocalInferenceRuntimeError('MODEL_DOWNLOAD_HTTP_FAILED', `The local model resource returned HTTP ${response.status}.`, makeDiagnostic('MODEL_DOWNLOAD_HTTP_FAILED', `The local model resource returned HTTP ${response.status}.`, model, url, undefined, response, startedAt));
    }

    const declaredLength = parseContentLength(response.headers.get('content-length'));
    const total = declaredLength ?? (model.sizeBytes > 0 ? model.sizeBytes : null);
    onProgress?.({ receivedBytes: 0, totalBytes: total });

    if (!response.body) {
      try {
        const data = await response.blob();
        if (total !== null && data.size !== total) throw new LocalInferenceRuntimeError('MODEL_DOWNLOAD_INCOMPLETE', `The model response ended at ${data.size} bytes; expected ${total} bytes.`, makeDiagnostic('MODEL_DOWNLOAD_INCOMPLETE', 'The model response ended before the expected byte count was received.', model, url, undefined, response, startedAt, data.size, total));
        onProgress?.({ receivedBytes: data.size, totalBytes: total });
        return data;
      } catch (error) {
        if (error instanceof LocalInferenceRuntimeError) throw error;
        throw new LocalInferenceRuntimeError('MODEL_DOWNLOAD_RESPONSE_READ_FAILED', 'The browser could not read the local model response body.', makeDiagnostic('MODEL_DOWNLOAD_RESPONSE_READ_FAILED', 'The model response body could not be read.', model, url, error, response, startedAt));
      }
    }

    const reader = response.body.getReader();
    const chunks: ArrayBuffer[] = [];
    let receivedBytes = 0;
    try {
      while (true) {
        let result: ReadableStreamReadResult<Uint8Array>;
        try {
          result = await reader.read();
        } catch (error) {
          if (signal.aborted) throw error;
          throw new LocalInferenceRuntimeError('MODEL_DOWNLOAD_RESPONSE_READ_FAILED', 'The browser could not finish reading the local model resource.', makeDiagnostic('MODEL_DOWNLOAD_RESPONSE_READ_FAILED', 'The model response stream could not be read to completion.', model, url, error, response, startedAt, receivedBytes, total));
        }
        const { done, value } = result;
        if (done) break;
        if (value) {
          const copy = new Uint8Array(value.byteLength);
          copy.set(value);
          chunks.push(copy.buffer);
          receivedBytes += copy.byteLength;
          onProgress?.({ receivedBytes, totalBytes: total });
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (total !== null && receivedBytes !== total) {
      throw new LocalInferenceRuntimeError('MODEL_DOWNLOAD_INCOMPLETE', `The model response ended at ${receivedBytes} bytes; expected ${total} bytes.`, makeDiagnostic('MODEL_DOWNLOAD_INCOMPLETE', 'The model response ended before the expected byte count was received.', model, url, undefined, response, startedAt, receivedBytes, total));
    }

    return new Blob(chunks, { type: response.headers.get('content-type') ?? 'application/octet-stream' });
  }
}

function isRetryableDownloadError(error: unknown): boolean {
  return error instanceof LocalInferenceRuntimeError && (error.code === 'MODEL_DOWNLOAD_FETCH_FAILED' || error.code === 'MODEL_DOWNLOAD_RESPONSE_READ_FAILED' || error.code === 'MODEL_DOWNLOAD_INCOMPLETE');
}

async function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('The operation was aborted.', 'AbortError')); }, { once: true });
  });
}

function parseContentLength(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function makeResponseMeta(response: Response): Partial<LocalAiDiagnostic> {
  return {
    status: response.status,
    statusText: response.statusText,
    responseType: response.type,
    responseOk: response.ok,
    responseRedirected: response.redirected,
    responseUrl: sanitizeDiagnosticUrl(response.url),
    responseBodyAvailable: response.body !== null,
    contentLength: parseContentLength(response.headers.get('content-length')) ?? undefined,
    contentType: response.headers.get('content-type') ?? undefined,
  };
}

function makeDiagnostic(code: string, message: string, model: AiModel, url?: string, error?: unknown, response?: Response, startedAt?: number, downloadedBytes?: number, expectedBytes?: number | null): LocalAiDiagnostic {
  const elapsedMs = startedAt === undefined ? undefined : Math.max(0, Math.round(performance.now() - startedAt));
  const diagnostic: LocalAiDiagnostic = {
    stage: 'MODEL_DOWNLOAD', code, message, resource: 'Qwen GGUF model', url: sanitizeDiagnosticUrl(url),
    errorName: error instanceof Error ? error.name : undefined,
    errorMessage: error instanceof Error ? sanitizeMessage(error.message) : undefined,
    cause: error instanceof Error ? sanitizeMessage(error.message) : undefined,
    downloadedBytes, elapsedMs,
    browserUserAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    timestamp: new Date().toISOString(), modelId: model.id, modelVersion: model.version,
  };
  if (expectedBytes !== undefined && diagnostic.contentLength === undefined && expectedBytes !== null) diagnostic.contentLength = expectedBytes;
  if (response) Object.assign(diagnostic, makeResponseMeta(response));
  return diagnostic;
}
