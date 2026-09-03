export type LocalAiDiagnosticStage =
  | 'MODEL_DOWNLOAD' | 'MODEL_STORAGE_READ' | 'MODEL_STORAGE_WRITE'
  | 'WLLAMA_WASM' | 'WLLAMA_COMPAT_WASM' | 'WLLAMA_JS' | 'WLLAMA_WORKER'
  | 'RUNTIME_INITIALIZATION' | 'MODEL_LOAD' | 'INFERENCE';

export interface LocalAiDiagnostic {
  stage: LocalAiDiagnosticStage;
  code: string;
  message: string;
  resource?: string;
  url?: string;
  status?: number;
  statusText?: string;
  responseType?: string;
  responseOk?: boolean;
  responseRedirected?: boolean;
  responseUrl?: string;
  responseBodyAvailable?: boolean;
  contentLength?: number;
  contentType?: string;
  downloadedBytes?: number;
  elapsedMs?: number;
  browserUserAgent?: string;
  errorName?: string;
  errorMessage?: string;
  cause?: string;
  timestamp: string;
  modelId?: string;
  modelVersion?: string;
}

const STAGES: Record<string, LocalAiDiagnosticStage> = {
  MODEL_DOWNLOAD_FAILED: 'MODEL_DOWNLOAD', MODEL_DOWNLOAD_HTTP_FAILED: 'MODEL_DOWNLOAD', MODEL_DOWNLOAD_FETCH_FAILED: 'MODEL_DOWNLOAD',
  MODEL_DOWNLOAD_RESPONSE_READ_FAILED: 'MODEL_DOWNLOAD', MODEL_DOWNLOAD_ABORTED: 'MODEL_DOWNLOAD', MODEL_DOWNLOAD_INCOMPLETE: 'MODEL_DOWNLOAD',
  MODEL_DOWNLOAD_CHECKSUM_FAILED: 'MODEL_DOWNLOAD', MODEL_STORAGE_READ_FAILED: 'MODEL_STORAGE_READ', MODEL_STORAGE_WRITE_FAILED: 'MODEL_STORAGE_WRITE',
  WLLAMA_WASM_FETCH_FAILED: 'WLLAMA_WASM', WLLAMA_COMPAT_WASM_FETCH_FAILED: 'WLLAMA_COMPAT_WASM', WLLAMA_JS_FETCH_FAILED: 'WLLAMA_JS',
  WLLAMA_WORKER_ASSET_FAILED: 'WLLAMA_WORKER', RUNTIME_INITIALIZATION_FAILED: 'RUNTIME_INITIALIZATION', MODEL_LOAD_FAILED: 'MODEL_LOAD', INFERENCE_FAILED: 'INFERENCE',
};

export function sanitizeDiagnosticUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try { const url = new URL(value); url.username = ''; url.password = ''; url.search = ''; url.hash = ''; return url.toString(); }
  catch { return '[invalid-url]'; }
}

export function diagnosticForError(error: unknown, fallbackCode = 'RUNTIME_INITIALIZATION_FAILED', fallbackMessage = 'Local AI preparation failed.'): LocalAiDiagnostic {
  const candidate = error as { diagnostic?: LocalAiDiagnostic } | null;
  if (candidate?.diagnostic) return candidate.diagnostic;
  const code = typeof (error as { code?: unknown } | null)?.code === 'string' ? String((error as { code: string }).code) : fallbackCode;
  const message = error instanceof Error ? error.message : fallbackMessage;
  return { stage: STAGES[code] ?? 'RUNTIME_INITIALIZATION', code, message: sanitizeMessage(message), errorName: error instanceof Error ? error.name : undefined, errorMessage: error instanceof Error ? sanitizeMessage(error.message) : undefined, timestamp: new Date().toISOString() };
}

export function sanitizeMessage(value: string): string {
  return value.replace(/https?:\/\/[^\s]+/gi, '[url-redacted]').replace(/(?:authorization|bearer|api[_-]?key|token|cookie|password)\s*[:=]\s*[^\s,;]+/gi, '[secret-redacted]').slice(0, 500) || 'Local AI operation failed.';
}

export function diagnosticNextAction(diagnostic: LocalAiDiagnostic): string {
  if (diagnostic.code === 'MODEL_DOWNLOAD_HTTP_FAILED' && diagnostic.status !== undefined) return 'The server returned an HTTP error; check whether the model resource is publicly readable.';
  if (diagnostic.code === 'MODEL_DOWNLOAD_FETCH_FAILED') return 'No HTTP response was received. Check browser network/CORS access to the model resource.';
  if (diagnostic.code === 'MODEL_DOWNLOAD_RESPONSE_READ_FAILED') return 'HTTP headers were received, but the response body could not be read to completion.';
  if (diagnostic.code === 'MODEL_DOWNLOAD_INCOMPLETE') return 'The response ended before the expected model size was received; retry the download.';
  if (diagnostic.code === 'MODEL_DOWNLOAD_CHECKSUM_FAILED') return 'The model bytes arrived, but SHA-256 verification failed; the model was not installed.';
  if (diagnostic.code === 'MODEL_DOWNLOAD_ABORTED') return 'The model download was cancelled.';
  if (diagnostic.stage === 'MODEL_STORAGE_READ' || diagnostic.stage === 'MODEL_STORAGE_WRITE') return 'Check browser site storage and IndexedDB availability/quota.';
  if (diagnostic.status !== undefined) return 'Check whether this resource is available at the reported HTTP status.';
  return 'Inspect the reported resource and failure stage on the Android browser.';
}

export function formatDiagnosticForClipboard(diagnostic: LocalAiDiagnostic): string {
  return [
    'Offline AI diagnostic', `Stage: ${diagnostic.stage}`, `Error code: ${diagnostic.code}`, `Message: ${diagnostic.message}`,
    diagnostic.resource && `Resource: ${diagnostic.resource}`, diagnostic.url && `URL: ${diagnostic.url}`,
    diagnostic.status !== undefined ? `HTTP status: ${diagnostic.status} ${diagnostic.statusText ?? ''}`.trim() : 'HTTP status: No HTTP response received',
    diagnostic.responseOk !== undefined && `Response ok: ${diagnostic.responseOk}`,
    diagnostic.responseType && `Response type: ${diagnostic.responseType}`,
    diagnostic.responseRedirected !== undefined && `Redirected: ${diagnostic.responseRedirected}`,
    diagnostic.responseUrl && `Final response URL: ${diagnostic.responseUrl}`,
    diagnostic.responseBodyAvailable !== undefined && `Response body available: ${diagnostic.responseBodyAvailable}`,
    diagnostic.contentLength !== undefined && `Content-Length: ${diagnostic.contentLength}`,
    diagnostic.contentType && `Content-Type: ${diagnostic.contentType}`,
    diagnostic.downloadedBytes !== undefined && `Downloaded bytes: ${diagnostic.downloadedBytes}`,
    diagnostic.elapsedMs !== undefined && `Elapsed ms: ${diagnostic.elapsedMs}`,
    diagnostic.browserUserAgent && `Browser: ${diagnostic.browserUserAgent}`,
    diagnostic.errorName && `Browser error: ${diagnostic.errorName}: ${diagnostic.errorMessage ?? ''}`,
    diagnostic.cause && `Cause: ${diagnostic.cause}`, diagnostic.modelId && `Model: ${diagnostic.modelId}`, diagnostic.modelVersion && `Version: ${diagnostic.modelVersion}`,
  ].filter(Boolean).join('\n');
}
