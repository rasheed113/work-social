import { useEffect, useState } from 'react';
import { getDefaultAiRoutingMode, setDefaultAiRoutingMode, type AiRoutingMode } from '../providers/aiRouter';
import { LocalAiProvider } from '../providers/localAiProvider';
import { buildAiPremiumStatus, type AiPremiumMode } from '../premiumUxState';
import './premiumAiUx.css';

const MODES: AiPremiumMode[] = ['auto', 'online', 'offline'];
const localProvider = new LocalAiProvider();

export function AiPremiumStatus() {
  const [mode, setMode] = useState<AiRoutingMode>(() => getDefaultAiRoutingMode());
  const [localStatus, setLocalStatus] = useState(() => localProvider.getStatus());
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.resolve(localProvider.getStatus()).then((status) => { if (active) setLocalStatus(status); });
    return () => { active = false; };
  }, [mode]);

  const localAvailable = localStatus.state === 'ready';
  const provider = mode === 'online' ? 'gemini' : mode === 'offline' && localAvailable ? 'local' : mode === 'auto' && localAvailable ? 'local' : mode === 'auto' ? 'gemini' : null;
  const routeMode = provider === 'gemini' ? 'online' : provider === 'local' ? 'offline' : null;
  const reasonCode = mode === 'auto' && provider === 'gemini' ? 'AUTO_ONLINE_SELECTED' : mode === 'offline' && !localAvailable ? localStatus.reasonCode : mode === 'online' ? 'ONLINE_EXPLICIT' : mode === 'offline' ? 'OFFLINE_EXPLICIT' : 'AUTO_LOCAL_SELECTED';
  const view = buildAiPremiumStatus({ requestedMode: mode, provider, routeMode, reasonCode, reason: localStatus.reason, localAvailable });

  function choose(nextMode: AiPremiumMode) {
    setDefaultAiRoutingMode(nextMode);
    setMode(nextMode);
  }

  return (
    <section className="ws-ai-status" aria-label="Work Social AI processing status">
      <div className="ws-ai-status-topline">
        <div className="ws-ai-status-brand">
          <span className="ws-ai-status-orb" aria-hidden="true">✦</span>
          <div><strong>Work Social AI</strong><span>{view.routeLabel} · {view.providerLabel}</span></div>
        </div>
        <button className="ws-ai-status-details" type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-controls="ws-ai-status-details-panel">{expanded ? 'Hide status' : 'AI status'}</button>
      </div>
      <div className="ws-ai-mode-list" role="group" aria-label="AI processing mode">
        {MODES.map((item) => <button key={item} type="button" className={`ws-ai-mode${mode === item ? ' selected' : ''}`} aria-pressed={mode === item} onClick={() => choose(item)}>{item.toUpperCase()}</button>)}
      </div>
      <p className="ws-ai-status-detail" role="status">{view.detail}</p>
      {expanded ? <div id="ws-ai-status-details-panel" className="ws-ai-status-grid">
        <div><span>Local AI</span><strong>{view.localLabel}</strong></div>
        <div><span>Model</span><strong>{view.modelLabel}</strong></div>
        <div><span>Vision</span><strong>{view.visionLabel}</strong></div>
        <div><span>Processing</span><strong>{view.processingLabel ?? 'Waiting for a request'}</strong></div>
      </div> : null}
    </section>
  );
}
