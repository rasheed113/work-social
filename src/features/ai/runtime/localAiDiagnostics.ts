export type LocalAiDiagnosticStage =
  | 'MODEL_DOWNLOAD' | 'MODEL_IMPORT' | 'MODEL_STORAGE_READ' | 'MODEL_STORAGE_WRITE'
  | 'WLLAMA_WASM' | 'WLLAMA_COMPAT_WASM' | 'WLLAMA_JS' | 'WLLAMA_WORKER'
  | 'RUNTIME_INITIALIZATION' | 'MODEL_LOAD' | 'INFERENCE';

export interface LocalAiDiagnostic {
  stage: LocalAiDiagnosticStage; code: string; message: string; result?: 'PASS' | 'FAIL'; resource?: string; url?: string; status?: number; statusText?: string; responseType?: string; responseOk?: boolean; responseRedirected?: boolean; responseUrl?: string; responseBodyAvailable?: boolean; contentLength?: number; contentType?: string; downloadedBytes?: number; elapsedMs?: number; browserUserAgent?: string; errorName?: string; errorMessage?: string; cause?: string; filename?: string; expectedBytes?: number; actualBytes?: number; sha256?: string; checksum?: 'PASS' | 'FAIL'; gguf?: 'VALID' | 'INVALID'; storage?: 'SUCCESS' | 'FAILED' | 'ABORTED'; provider?: 'local' | 'gemini'; runtime?: string; source?: 'imported-local-gguf' | 'downloaded-local-gguf'; timestamp: string; modelId?: string; modelVersion?: string;
}
const STAGES: Record<string, LocalAiDiagnosticStage> = {
  MODEL_DOWNLOAD_FAILED: 'MODEL_DOWNLOAD', MODEL_DOWNLOAD_HTTP_FAILED: 'MODEL_DOWNLOAD', MODEL_DOWNLOAD_FETCH_FAILED: 'MODEL_DOWNLOAD', MODEL_DOWNLOAD_RESPONSE_READ_FAILED: 'MODEL_DOWNLOAD', MODEL_DOWNLOAD_ABORTED: 'MODEL_DOWNLOAD', MODEL_DOWNLOAD_INCOMPLETE: 'MODEL_DOWNLOAD', MODEL_DOWNLOAD_CHECKSUM_FAILED: 'MODEL_DOWNLOAD', MODEL_IMPORT_SIZE_FAILED: 'MODEL_IMPORT', MODEL_IMPORT_GGUF_INVALID: 'MODEL_IMPORT', MODEL_IMPORT_CHECKSUM_FAILED: 'MODEL_IMPORT', MODEL_IMPORT_STORAGE_VERIFY_FAILED: 'MODEL_IMPORT', MODEL_IMPORT_ABORTED: 'MODEL_IMPORT', MODEL_IMPORT_VERIFIED: 'MODEL_IMPORT', MODEL_STORAGE_READ_FAILED: 'MODEL_STORAGE_READ', MODEL_STORAGE_WRITE_FAILED: 'MODEL_STORAGE_WRITE', WLLAMA_WASM_FETCH_FAILED: 'WLLAMA_WASM', WLLAMA_COMPAT_WASM_FETCH_FAILED: 'WLLAMA_COMPAT_WASM', WLLAMA_JS_FETCH_FAILED: 'WLLAMA_JS', WLLAMA_WORKER_ASSET_FAILED: 'WLLAMA_WORKER', RUNTIME_INITIALIZATION_FAILED: 'RUNTIME_INITIALIZATION', MODEL_LOAD_FAILED: 'MODEL_LOAD', INFERENCE_FAILED: 'INFERENCE_FAILED' as LocalAiDiagnosticStage,
};

/** Safe production trace. It deliberately excludes message contents, credentials and tokens. */
export function offlineAiTrace(event: string, fields: Record<string, unknown> = {}): void {
  if (typeof console === 'undefined') return;
  const safe = Object.fromEntries(Object.entries(fields).filter(([key, value]) => {
    if (/message|content|token|secret|password|authorization|cookie|prompt/i.test(key)) return false;
    return ['string', 'number', 'boolean'].includes(typeof value) || value === null;
  }));
  console.info(`[OfflineAI] ${event}`, safe);
  renderOfflineAiDiagnostics(event, safe);
}

type OfflineAiDiagnosticSnapshot = Record<string, unknown>;
let offlineAiDiagnosticSnapshot: OfflineAiDiagnosticSnapshot = {};
let offlineAiDiagnosticsOverlay: HTMLDivElement | null = null;

function renderOfflineAiDiagnostics(event: string, fields: Record<string, unknown>): void {
  if (typeof document === 'undefined') return;
  offlineAiDiagnosticSnapshot = { ...offlineAiDiagnosticSnapshot, ...fields, last_event: event };
  if (!offlineAiDiagnosticsOverlay) {
    const overlay = document.createElement('div');
    overlay.id = 'offline-ai-diagnostics-overlay';
    overlay.setAttribute('aria-label', 'Offline AI diagnostics');
    overlay.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;background:rgba(0,0,0,.88);color:#fff;font:12px/1.35 monospace;padding:10px;border:1px solid rgba(255,255,255,.35);border-radius:8px;max-height:45vh;overflow:auto;white-space:pre-wrap;pointer-events:none;box-sizing:border-box;';
    document.body?.appendChild(overlay);
    offlineAiDiagnosticsOverlay = overlay;
  }
  const s = offlineAiDiagnosticSnapshot;
  const rows = [
    'OFFLINE AI DIAGNOSTICS (TEMPORARY)',
    `event=${String(s.last_event ?? event)}`,
    `TTFT_ms=${formatValue(s.ttft_ms)}`,
    `generation_ms=${formatValue(s.generation_ms)}`,
    `delta_count=${formatValue(s.delta_count)}`,
    `deltas_per_second=${formatValue(s.deltas_per_second)}`,
    `wllama_wait_ms=${formatValue(s.wllama_wait_ms)}`,
    `wllama_deltas_per_second=${formatValue(s.wllama_deltas_per_second)}`,
    `n_threads=${formatValue(s.num_threads ?? s.nThreads ?? s.n_threads)}`,
    `multithread=${formatValue(s.multithread)}`,
    `WebGPU=${formatValue(s.webgpu_supported)}`,
    `crossOriginIsolated=${typeof crossOriginIsolated === 'boolean' ? String(crossOriginIsolated) : 'UNREADABLE'}`,
    `gpu_layers=${formatValue(s.gpu_layers)}`,
    `compat_mode=${formatValue(s.compat_mode)}`,
    `model=${formatValue(s.modelId)}`,
    `model_version=${formatValue(s.modelVersion)}`,
    `context_size=${formatValue(s.context_size ?? s.nCtx)}`,
    `batch_size=${formatValue(s.batch_size ?? s.nBatch)}`,
    `max_tokens=${formatValue(s.maxTokens)}`,
    `completed=${formatValue(s.completed)}`,
    `cancelled=${formatValue(s.cancelled)}`,
    `errored=${formatValue(s.errored)}`,
    `error_code=${formatValue(s.errorCode)}`,
    `error_name=${formatValue(s.errorName)}`,
  ];
  offlineAiDiagnosticsOverlay.textContent = rows.join('\n');
}

function formatValue(value: unknown): string {
  return value === undefined ? 'UNREADABLE' : value === null ? 'null' : String(value);
}

export function hideOfflineAiDiagnosticsOverlay(): void {
  offlineAiDiagnosticsOverlay?.remove();
  offlineAiDiagnosticsOverlay = null;
}

export function sanitizeDiagnosticUrl(value: string | undefined): string | undefined { if (!value) return undefined; try { const url = new URL(value); url.username = ''; url.password = ''; url.search = ''; url.hash = ''; return url.toString(); } catch { return '[invalid-url]'; } }
export function diagnosticForError(error: unknown, fallbackCode = 'RUNTIME_INITIALIZATION_FAILED', fallbackMessage = 'Local AI preparation failed.'): LocalAiDiagnostic { const candidate = error as { diagnostic?: LocalAiDiagnostic } | null; if (candidate?.diagnostic) return candidate.diagnostic; const code = typeof (error as { code?: unknown } | null)?.code === 'string' ? String((error as { code: string }).code) : fallbackCode; const message = error instanceof Error ? error.message : fallbackMessage; return { stage: STAGES[code] ?? 'RUNTIME_INITIALIZATION', code, message: sanitizeMessage(message), result: 'FAIL', errorName: error instanceof Error ? error.name : undefined, errorMessage: error instanceof Error ? sanitizeMessage(error.message) : undefined, timestamp: new Date().toISOString() }; }
export function sanitizeMessage(value: string): string { return value.replace(/https?:\/\/[^\s]+/gi, '[url-redacted]').replace(/(?:authorization|bearer|api[_-]?key|token|cookie|password)\s*[:=]\s*[^\s,;]+/gi, '[secret-redacted]').slice(0, 500) || 'Local AI operation failed.'; }
export function diagnosticNextAction(diagnostic: LocalAiDiagnostic): string { if (diagnostic.result === 'PASS') return 'Local runtime/model verification passed. Send a test prompt and confirm the response provenance is local.'; if (diagnostic.code === 'MODEL_IMPORT_SIZE_FAILED') return 'Select the original GGUF file with the required byte size.'; if (diagnostic.code === 'MODEL_IMPORT_GGUF_INVALID') return 'Select a valid GGUF model file.'; if (diagnostic.code === 'MODEL_IMPORT_CHECKSUM_FAILED') return 'The selected model bytes do not match the required Work Social model; nothing was installed.'; if (diagnostic.code === 'MODEL_IMPORT_ABORTED') return 'The local model import was cancelled.'; if (diagnostic.code === 'MODEL_IMPORT_STORAGE_VERIFY_FAILED') return 'The model was written to browser storage but failed the post-write checksum verification.'; if (diagnostic.code === 'MODEL_IMPORT_VERIFIED') return 'The model is persisted and can proceed through the existing runtime preparation path.'; if (diagnostic.code === 'MODEL_DOWNLOAD_HTTP_FAILED' && diagnostic.status !== undefined) return 'The server returned an HTTP error; check whether the model resource is publicly readable.'; if (diagnostic.code === 'MODEL_DOWNLOAD_FETCH_FAILED') return 'No HTTP response was received. Automatic model delivery is blocked in this browser environment; use Import existing GGUF.'; if (diagnostic.code === 'MODEL_DOWNLOAD_RESPONSE_READ_FAILED') return 'HTTP headers were received, but the response body could not be read to completion.'; if (diagnostic.code === 'MODEL_DOWNLOAD_INCOMPLETE') return 'The response ended before the expected model size was received; retry the download.'; if (diagnostic.code === 'MODEL_DOWNLOAD_CHECKSUM_FAILED') return 'The model bytes arrived, but SHA-256 verification failed; the model was not installed.'; if (diagnostic.code === 'MODEL_DOWNLOAD_ABORTED') return 'The model download was cancelled.'; if (diagnostic.stage === 'MODEL_STORAGE_READ' || diagnostic.stage === 'MODEL_STORAGE_WRITE') return 'Check browser site storage and IndexedDB availability/quota.'; if (diagnostic.status !== undefined) return 'Check whether this resource is available at the reported HTTP status.'; return 'Inspect the reported resource and failure stage on the Android browser.'; }
export function formatDiagnosticForClipboard(diagnostic: LocalAiDiagnostic): string { return ['Offline AI diagnostic', `Stage: ${diagnostic.stage}`, `Error code: ${diagnostic.code}`, `Result: ${diagnostic.result ?? 'FAIL'}`, `Message: ${diagnostic.message}`, diagnostic.resource && `Resource: ${diagnostic.resource}`, diagnostic.url && `URL: ${diagnostic.url}`, diagnostic.status !== undefined ? `HTTP status: ${diagnostic.status} ${diagnostic.statusText ?? ''}`.trim() : 'HTTP status: No HTTP response received', diagnostic.responseOk !== undefined && `Response ok: ${diagnostic.responseOk}`, diagnostic.responseType && `Response type: ${diagnostic.responseType}`, diagnostic.responseRedirected !== undefined && `Redirected: ${diagnostic.responseRedirected}`, diagnostic.responseUrl && `Final response URL: ${diagnostic.responseUrl}`, diagnostic.responseBodyAvailable !== undefined && `Response body available: ${diagnostic.responseBodyAvailable}`, diagnostic.contentLength !== undefined && `Content-Length: ${diagnostic.contentLength}`, diagnostic.contentType && `Content-Type: ${diagnostic.contentType}`, diagnostic.downloadedBytes !== undefined && `Downloaded bytes: ${diagnostic.downloadedBytes}`, diagnostic.elapsedMs !== undefined && `Elapsed ms: ${diagnostic.elapsedMs}`, diagnostic.filename && `Filename: ${diagnostic.filename}`, diagnostic.expectedBytes !== undefined && `Expected bytes: ${diagnostic.expectedBytes}`, diagnostic.actualBytes !== undefined && `Actual bytes: ${diagnostic.actualBytes}`, diagnostic.sha256 && `SHA-256: ${diagnostic.sha256}`, diagnostic.checksum && `Checksum: ${diagnostic.checksum}`, diagnostic.gguf && `GGUF: ${diagnostic.gguf}`, diagnostic.storage && `Storage: ${diagnostic.storage}`, diagnostic.provider && `Provider: ${diagnostic.provider}`, diagnostic.runtime && `Runtime: ${diagnostic.runtime}`, diagnostic.source && `Source: ${diagnostic.source}`, diagnostic.browserUserAgent && `Browser: ${diagnostic.browserUserAgent}`, diagnostic.errorName && `Browser error: ${diagnostic.errorName}: ${diagnostic.errorMessage ?? ''}`, diagnostic.cause && `Cause: ${diagnostic.cause}`, diagnostic.modelId && `Model: ${diagnostic.modelId}`, diagnostic.modelVersion && `Version: ${diagnostic.modelVersion}`].filter(Boolean).join('\n'); }
