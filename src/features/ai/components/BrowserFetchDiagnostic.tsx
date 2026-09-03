import { useState } from 'react';
import { PRIMARY_LOCAL_TEXT_MODEL } from '../model/primaryLocalTextModel';
import { sanitizeDiagnosticUrl, sanitizeMessage } from '../runtime/localAiDiagnostics';

type FetchResult = {
  label: string;
  requestedUrl: string;
  outcome: 'RESOLVED' | 'REJECTED';
  responseReceivedBeforeAbort: boolean;
  status?: number;
  statusText?: string;
  type?: string;
  url?: string;
  redirected?: boolean;
  ok?: boolean;
  contentLength?: string;
  contentType?: string;
  errorName?: string;
  errorMessage?: string;
  elapsedMs: number;
};

const CONTROL_URL = 'https://example.com';
const MODEL_URL = PRIMARY_LOCAL_TEXT_MODEL.downloadSource?.uri;

async function runFetchDiagnostic(label: string, requestedUrl: string): Promise<FetchResult> {
  const startedAt = performance.now();
  const controller = new AbortController();
  try {
    const response = await fetch(requestedUrl, { cache: 'no-store', signal: controller.signal });
    const result: FetchResult = {
      label,
      requestedUrl,
      outcome: 'RESOLVED',
      responseReceivedBeforeAbort: true,
      status: response.status,
      statusText: response.statusText,
      type: response.type,
      url: sanitizeDiagnosticUrl(response.url),
      redirected: response.redirected,
      ok: response.ok,
      contentLength: response.headers.get('content-length') ?? undefined,
      contentType: response.headers.get('content-type') ?? undefined,
      elapsedMs: Math.max(0, Math.round(performance.now() - startedAt)),
    };
    controller.abort();
    return result;
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    return {
      label,
      requestedUrl,
      outcome: 'REJECTED',
      responseReceivedBeforeAbort: false,
      errorName: error instanceof Error ? error.name : undefined,
      errorMessage: error instanceof Error ? sanitizeMessage(error.message) : aborted ? 'The request was aborted.' : 'Unknown browser fetch error.',
      elapsedMs: Math.max(0, Math.round(performance.now() - startedAt)),
    };
  }
}

function displayUrl(value: string | undefined): string { return value ? sanitizeDiagnosticUrl(value) ?? '[unavailable]' : '[unavailable]'; }
function value(value: string | number | boolean | undefined): string { return value === undefined ? '[unavailable]' : String(value); }
function resultLines(result: FetchResult): string[] {
  return [
    `${result.label} fetch: ${result.outcome}`,
    `${result.label} status: ${result.status === undefined ? 'No HTTP response received' : `${result.status} ${result.statusText ?? ''}`.trim()}`,
    `${result.label} response type: ${value(result.type)}`,
    `${result.label} final URL: ${displayUrl(result.url)}`,
    `${result.label} redirected: ${value(result.redirected)}`,
    `${result.label} ok: ${value(result.ok)}`,
    `${result.label} content-length: ${value(result.contentLength)}`,
    `${result.label} content-type: ${value(result.contentType)}`,
    `${result.label} elapsed: ${result.elapsedMs} ms`,
    `${result.label} browser error: ${result.errorName ? `${result.errorName}: ${result.errorMessage ?? ''}`.trim() : '[none]'}`,
    `${result.label} response received before abort: ${result.responseReceivedBeforeAbort ? 'YES' : 'NO'}`,
  ];
}

function formatDiagnostic(control: FetchResult, model: FetchResult): string {
  return [
    'Browser Fetch Diagnostic',
    `Work Social origin: ${sanitizeDiagnosticUrl(window.location.origin) ?? '[unavailable]'}`,
    `Control resource: ${CONTROL_URL}`,
    ...resultLines(control),
    `Hugging Face model: ${displayUrl(MODEL_URL)}`,
    ...resultLines(model),
  ].join('\n');
}

export function BrowserFetchDiagnostic() {
  const [running, setRunning] = useState(false);
  const [control, setControl] = useState<FetchResult | null>(null);
  const [model, setModel] = useState<FetchResult | null>(null);
  const [copied, setCopied] = useState(false);

  const run = async () => {
    if (running) return;
    setRunning(true);
    setCopied(false);
    setControl(null);
    setModel(null);
    const controlResult = await runFetchDiagnostic('Control', CONTROL_URL);
    setControl(controlResult);
    const modelResult = await runFetchDiagnostic('Hugging Face', MODEL_URL ?? '');
    setModel(modelResult);
    setRunning(false);
  };

  const diagnostic = control && model ? formatDiagnostic(control, model) : '';
  const copy = async () => {
    if (!diagnostic || !navigator.clipboard?.writeText) return;
    try { await navigator.clipboard.writeText(diagnostic); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { setCopied(false); }
  };

  const renderResult = (result: FetchResult | null) => result ? <div className="ws-browser-fetch-result">
    <div><b>Fetch</b><span>{result.outcome}</span></div>
    <div><b>Response</b><span>{result.responseReceivedBeforeAbort ? 'Present' : 'None'}</span></div>
    <div><b>HTTP status</b><span>{result.status === undefined ? 'No HTTP response received' : `${result.status} ${result.statusText ?? ''}`.trim()}</span></div>
    <div><b>Response type</b><span>{value(result.type)}</span></div>
    <div><b>Redirected</b><span>{value(result.redirected)}</span></div>
    <div><b>Final URL</b><span>{displayUrl(result.url)}</span></div>
    <div><b>Content-Length</b><span>{value(result.contentLength)}</span></div>
    <div><b>Content-Type</b><span>{value(result.contentType)}</span></div>
    <div><b>Elapsed</b><span>{result.elapsedMs} ms</span></div>
    <div className="wide"><b>Browser error</b><span>{result.errorName ? `${result.errorName}: ${result.errorMessage ?? ''}`.trim() : '[none]'}</span></div>
    <div className="wide"><b>Response before abort</b><span>{result.responseReceivedBeforeAbort ? 'YES' : 'NO'}</span></div>
  </div> : <div className="ws-browser-fetch-pending">Not run yet.</div>;

  return <section className="ws-browser-fetch-diagnostic" aria-label="Browser Fetch Diagnostic">
    <div className="ws-browser-fetch-title">Browser Fetch Diagnostic</div>
    <div className="ws-browser-fetch-origin"><b>Work Social origin</b><span>{window.location.origin}</span></div>
    <div className="ws-browser-fetch-resource"><b>Control</b><span>{CONTROL_URL}</span></div>
    {renderResult(control)}
    <div className="ws-browser-fetch-resource"><b>Hugging Face model</b><span>{displayUrl(MODEL_URL)}</span></div>
    {renderResult(model)}
    <div className="ws-browser-fetch-actions">
      <button type="button" onClick={() => void run()} disabled={running}>{running ? 'Running…' : 'Run browser fetch test'}</button>
      <button type="button" onClick={() => void copy()} disabled={!diagnostic}>{copied ? 'Copied' : 'Copy diagnostic'}</button>
    </div>
    <style>{`.ws-browser-fetch-diagnostic{margin:10px 0;padding:12px;border:1px solid rgba(125,211,252,.22);border-radius:14px;background:rgba(8,18,32,.96);color:#e2e8f0;box-sizing:border-box;font:500 11px/1.35 inherit}.ws-browser-fetch-title{font-size:14px;font-weight:900;color:#fff;margin-bottom:9px}.ws-browser-fetch-origin,.ws-browser-fetch-resource{display:grid;gap:2px;margin-bottom:7px;padding:7px 8px;border-radius:9px;background:rgba(148,163,184,.07)}.ws-browser-fetch-origin b,.ws-browser-fetch-resource b{font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#7dd3fc}.ws-browser-fetch-origin span,.ws-browser-fetch-resource span{overflow-wrap:anywhere}.ws-browser-fetch-result{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-bottom:8px}.ws-browser-fetch-result>div{min-width:0;padding:6px 7px;border:1px solid rgba(148,163,184,.11);border-radius:8px;background:rgba(0,0,0,.12)}.ws-browser-fetch-result .wide{grid-column:1/-1}.ws-browser-fetch-result b{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin-bottom:2px}.ws-browser-fetch-result span{display:block;overflow-wrap:anywhere;color:#f8fafc}.ws-browser-fetch-pending{padding:8px;border-radius:8px;background:rgba(148,163,184,.06);color:#94a3b8;margin-bottom:8px}.ws-browser-fetch-actions{display:flex;gap:7px;flex-wrap:wrap}.ws-browser-fetch-actions button{border:1px solid rgba(125,211,252,.25);border-radius:9px;padding:8px 10px;background:rgba(14,116,144,.22);color:#e0f2fe;font:800 10px/1 inherit;cursor:pointer}.ws-browser-fetch-actions button:disabled{opacity:.5;cursor:default}.ws-browser-fetch-actions button:focus-visible{outline:2px solid currentColor;outline-offset:2px}@media(max-width:520px){.ws-browser-fetch-result{grid-template-columns:1fr}.ws-browser-fetch-result .wide{grid-column:auto}}`}</style>
  </section>;
}
