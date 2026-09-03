import { useState } from 'react';
import type { LocalAiDiagnostic } from '../runtime/localAiDiagnostics';
import { diagnosticNextAction, formatDiagnosticForClipboard } from '../runtime/localAiDiagnostics';
export function LocalAiDiagnosticCard({ diagnostic }: { diagnostic: LocalAiDiagnostic }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(formatDiagnosticForClipboard(diagnostic)); setCopied(true); setTimeout(() => setCopied(false), 1600); } } catch { setCopied(false); } };
  const http = diagnostic.status === undefined ? 'No HTTP response received' : `${diagnostic.status} ${diagnostic.statusText ?? ''}`.trim();
  return <section className="ws-local-ai-diagnostic" role="alert" aria-label="Offline AI diagnostic">
    <div className="ws-local-ai-diagnostic-title">Offline AI diagnostic</div>
    <div className="ws-local-ai-diagnostic-grid">
      <div><b>Status</b><span>Failed</span></div><div><b>Stage</b><span>{diagnostic.stage}</span></div><div><b>Error code</b><span>{diagnostic.code}</span></div>
      {diagnostic.resource && <div><b>Resource</b><span>{diagnostic.resource}</span></div>}
      {diagnostic.url && <div className="wide"><b>Sanitized URL</b><span>{diagnostic.url}</span></div>}
      <div><b>HTTP status</b><span>{http}</span></div>
      {diagnostic.responseType && <div><b>Response type</b><span>{diagnostic.responseType}</span></div>}
      {diagnostic.errorName && <div className="wide"><b>Browser error</b><span>{diagnostic.errorName}: {diagnostic.errorMessage ?? diagnostic.message}</span></div>}
      <div className="wide"><b>Message</b><span>{diagnostic.message}</span></div>
      <div className="wide"><b>Next action</b><span>{diagnosticNextAction(diagnostic)}</span></div>
    </div>
    <button type="button" onClick={() => void copy()} className="ws-local-ai-diagnostic-copy">{copied ? 'Copied' : 'Copy diagnostic'}</button>
    <style>{`.ws-local-ai-diagnostic{margin-top:10px;padding:10px;border:1px solid rgba(248,113,113,.30);border-radius:12px;background:rgba(45,16,25,.96);color:#fee2e2;box-sizing:border-box;max-width:100%;font:500 11px/1.35 inherit}.ws-local-ai-diagnostic-title{font-size:12px;font-weight:900;margin-bottom:8px;color:#fff}.ws-local-ai-diagnostic-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.ws-local-ai-diagnostic-grid>div{min-width:0;padding:6px 7px;border:1px solid rgba(254,202,202,.10);border-radius:8px;background:rgba(0,0,0,.12)}.ws-local-ai-diagnostic-grid .wide{grid-column:1/-1}.ws-local-ai-diagnostic-grid b{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#fca5a5;margin-bottom:2px}.ws-local-ai-diagnostic-grid span{display:block;overflow-wrap:anywhere;color:#fee2e2}.ws-local-ai-diagnostic-copy{margin-top:8px;border:1px solid rgba(254,202,202,.22);border-radius:8px;padding:7px 9px;background:rgba(127,29,29,.35);color:#fff;font:800 10px/1 inherit;cursor:pointer}.ws-local-ai-diagnostic-copy:focus-visible{outline:2px solid currentColor;outline-offset:2px}@media(max-width:520px){.ws-local-ai-diagnostic-grid{grid-template-columns:1fr}.ws-local-ai-diagnostic-grid .wide{grid-column:auto}}`}</style>
  </section>;
}
