import React, { useState } from 'react';
import type { LocalAiDiagnostic } from '../runtime/localAiDiagnostics';
import { diagnosticNextAction, formatDiagnosticForClipboard } from '../runtime/localAiDiagnostics';

export function LocalAiDiagnosticCard({ diagnostic }: { diagnostic: LocalAiDiagnostic }) {
  const [copied, setCopied] = useState(false);
  const passed = diagnostic.result === 'PASS';
  const copy = async () => { try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(formatDiagnosticForClipboard(diagnostic)); setCopied(true); setTimeout(() => setCopied(false), 1600); } } catch { setCopied(false); } };
  const http = diagnostic.status === undefined ? 'No HTTP response received' : `${diagnostic.status} ${diagnostic.statusText ?? ''}`.trim();
  const bytes = diagnostic.downloadedBytes === undefined ? null : diagnostic.contentLength !== undefined ? `${diagnostic.downloadedBytes} / ${diagnostic.contentLength} bytes` : `${diagnostic.downloadedBytes} bytes`;
  return <details className="ws-local-ai-diagnostic" open={false}>
    <summary className="ws-local-ai-diagnostic-summary">Technical details <span aria-hidden="true">▸</span></summary>
    <div className="ws-local-ai-diagnostic-content" role={passed ? 'status' : 'alert'} aria-label="Offline AI technical diagnostics">
      <div className="ws-local-ai-diagnostic-title">{passed ? 'Offline AI verification' : 'Offline AI diagnostic'}</div>
      <div className="ws-local-ai-diagnostic-grid">
        <div><b>Status</b><span>{passed ? 'PASS' : 'Failed'}</span></div><div><b>Stage</b><span>{diagnostic.stage}</span></div><div><b>Error code</b><span>{diagnostic.code}</span></div>
        {diagnostic.resource && <div><b>Resource</b><span>{diagnostic.resource}</span></div>}
        {diagnostic.url && <div className="wide"><b>Sanitized URL</b><span>{diagnostic.url}</span></div>}
        <div><b>HTTP status</b><span>{http}</span></div>
        {diagnostic.responseOk !== undefined && <div><b>Response OK</b><span>{String(diagnostic.responseOk)}</span></div>}
        {diagnostic.responseType && <div><b>Response type</b><span>{diagnostic.responseType}</span></div>}
        {diagnostic.responseRedirected !== undefined && <div><b>Redirected</b><span>{String(diagnostic.responseRedirected)}</span></div>}
        {diagnostic.responseBodyAvailable !== undefined && <div><b>Response body</b><span>{diagnostic.responseBodyAvailable ? 'Available' : 'Unavailable'}</span></div>}
        {diagnostic.contentType && <div><b>Content type</b><span>{diagnostic.contentType}</span></div>}
        {bytes && <div><b>Downloaded</b><span>{bytes}</span></div>}
        {diagnostic.elapsedMs !== undefined && <div><b>Elapsed</b><span>{diagnostic.elapsedMs} ms</span></div>}
        {diagnostic.filename && <div><b>Model</b><span>{diagnostic.filename}</span></div>}
        {diagnostic.expectedBytes !== undefined && <div><b>Expected bytes</b><span>{diagnostic.expectedBytes}</span></div>}
        {diagnostic.actualBytes !== undefined && <div><b>Actual bytes</b><span>{diagnostic.actualBytes}</span></div>}
        {diagnostic.sha256 && <div className="wide"><b>SHA-256</b><span>{diagnostic.sha256}</span></div>}
        {diagnostic.checksum && <div><b>Checksum</b><span>{diagnostic.checksum}</span></div>}
        {diagnostic.gguf && <div><b>GGUF</b><span>{diagnostic.gguf}</span></div>}
        {diagnostic.storage && <div><b>Storage</b><span>{diagnostic.storage}</span></div>}
        {diagnostic.provider && <div><b>Provider</b><span>{diagnostic.provider}</span></div>}
        {diagnostic.runtime && <div><b>Runtime</b><span>{diagnostic.runtime}</span></div>}
        {diagnostic.source && <div className="wide"><b>Source</b><span>{diagnostic.source}</span></div>}
        {diagnostic.errorName && <div className="wide"><b>Browser error</b><span>{diagnostic.errorName}: {diagnostic.errorMessage ?? diagnostic.message}</span></div>}
        <div className="wide"><b>Message</b><span>{diagnostic.message}</span></div>
        <div className="wide"><b>Next action</b><span>{diagnosticNextAction(diagnostic)}</span></div>
      </div>
      <button type="button" onClick={() => void copy()} className="ws-local-ai-diagnostic-copy">{copied ? 'Copied' : 'Copy diagnostic'}</button>
    </div>
    <style>{`.ws-local-ai-diagnostic{margin-top:10px;border:1px solid rgba(148,163,184,.18);border-radius:12px;background:rgba(15,23,42,.42);color:#cbd5e1;box-sizing:border-box;font:500 11px/1.4 inherit;overflow:hidden}.ws-local-ai-diagnostic-summary{padding:9px 11px;cursor:pointer;list-style:none;font-size:10px;font-weight:800;letter-spacing:.02em;color:#94a3b8}.ws-local-ai-diagnostic-summary::-webkit-details-marker{display:none}.ws-local-ai-diagnostic-summary span{display:inline-block;margin-left:4px;transition:transform .15s ease}.ws-local-ai-diagnostic[open] .ws-local-ai-diagnostic-summary span{transform:rotate(90deg)}.ws-local-ai-diagnostic-summary:focus-visible{outline:2px solid currentColor;outline-offset:-2px}.ws-local-ai-diagnostic-content{padding:0 10px 10px}.ws-local-ai-diagnostic-title{font-size:11px;font-weight:900;margin-bottom:8px;color:#e2e8f0}.ws-local-ai-diagnostic-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.ws-local-ai-diagnostic-grid>div{min-width:0;padding:6px 7px;border:1px solid rgba(148,163,184,.10);border-radius:8px;background:rgba(0,0,0,.10)}.ws-local-ai-diagnostic-grid .wide{grid-column:1/-1}.ws-local-ai-diagnostic-grid b{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin-bottom:2px}.ws-local-ai-diagnostic-grid span{display:block;overflow-wrap:anywhere;color:#cbd5e1}.ws-local-ai-diagnostic-copy{margin-top:8px;border:1px solid rgba(148,163,184,.20);border-radius:8px;padding:7px 9px;background:rgba(51,65,85,.32);color:#e2e8f0;font:800 10px/1 inherit;cursor:pointer}.ws-local-ai-diagnostic-copy:focus-visible{outline:2px solid currentColor;outline-offset:2px}@media(max-width:520px){.ws-local-ai-diagnostic-grid{grid-template-columns:1fr}.ws-local-ai-diagnostic-grid .wide{grid-column:auto}}`}</style>
  </details>;
}
