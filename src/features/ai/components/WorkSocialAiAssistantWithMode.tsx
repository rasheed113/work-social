import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { WorkSocialAiAssistant as BaseWorkSocialAiAssistant } from './WorkSocialAiAssistant';
import {
  getDefaultAiRoutingMode,
  setDefaultAiRoutingMode,
  type AiRoutingMode,
} from '../providers/aiRouter';
import { LocalAiProvider } from '../providers/localAiProvider';
import { buildAiPremiumStatus } from '../premiumUxState';
import { shouldOfferOfflineContinuation } from '../onlineLimit';

interface Props {
  profileId: string;
}

const MODES: AiRoutingMode[] = ['auto', 'online', 'offline'];
const localProvider = new LocalAiProvider();

function currentConversationKey(): string {
  const active = document.querySelector<HTMLButtonElement>('.ws-ai-conversation.active');
  if (active) return `conversation:${active.textContent?.trim() ?? ''}`;
  return 'conversation:new';
}

export function WorkSocialAiAssistant({ profileId }: Props) {
  return (
    <>
      <BaseWorkSocialAiAssistant profileId={profileId} />
      <AiChatModeBridge />
    </>
  );
}

function AiChatModeBridge() {
  const [header, setHeader] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<AiRoutingMode>(() => getDefaultAiRoutingMode());
  const [conversationKey, setConversationKey] = useState(() => currentConversationKey());
  const [localStatus, setLocalStatus] = useState(() => localProvider.getStatus());
  const [modesByConversation, setModesByConversation] = useState<Record<string, AiRoutingMode>>({});

  useEffect(() => {
    let disposed = false;
    const findHeader = () => {
      if (disposed) return;
      const next = document.querySelector<HTMLElement>('.ws-ai-panel .ws-ai-header');
      setHeader((current) => current === next ? current : next);
      setConversationKey(currentConversationKey());
    };

    findHeader();
    const observer = new MutationObserver(findHeader);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const nextMode = modesByConversation[conversationKey] ?? 'auto';
    setMode(nextMode);
    setDefaultAiRoutingMode(nextMode);
  }, [conversationKey, modesByConversation]);

  useEffect(() => {
    let active = true;
    void Promise.resolve(localProvider.getStatus()).then((status) => {
      if (active) setLocalStatus(status);
    });
    return () => { active = false; };
  }, [mode]);

  useEffect(() => () => {
    setDefaultAiRoutingMode('auto');
  }, []);

  const status = useMemo(() => {
    const localAvailable = localStatus.state === 'ready';
    const provider = mode === 'online'
      ? 'gemini'
      : mode === 'offline'
        ? (localAvailable ? 'local' : null)
        : (localAvailable ? 'local' : 'gemini');
    const routeMode = provider === 'local' ? 'offline' : provider === 'gemini' ? 'online' : null;
    const reasonCode = mode === 'offline' && !localAvailable
      ? localStatus.reasonCode
      : mode === 'online'
        ? 'ONLINE_EXPLICIT'
        : mode === 'auto' && provider === 'local'
          ? 'AUTO_LOCAL_SELECTED'
          : 'AUTO_ONLINE_SELECTED';
    return buildAiPremiumStatus({
      requestedMode: mode,
      provider,
      routeMode,
      reasonCode,
      reason: localStatus.reason,
      localAvailable,
    });
  }, [localStatus, mode]);

  function choose(nextMode: AiRoutingMode) {
    setModesByConversation((current) => ({ ...current, [conversationKey]: nextMode }));
    setDefaultAiRoutingMode(nextMode);
    setMode(nextMode);
  }

  useEffect(() => {
    const localAvailable = localStatus.state === 'ready';
    const resolvedOnline = mode === 'online' || (mode === 'auto' && !localAvailable);
    if (!resolvedOnline || !localAvailable) return;

    const installContinuationAction = () => {
      const errorSurface = document.querySelector<HTMLElement>('.ws-ai-panel .ws-ai-error');
      if (!errorSurface || !shouldOfferOfflineContinuation(errorSurface.textContent ?? '')) return;
      if (errorSurface.querySelector('[data-ws-ai-switch-offline]')) return;

      const action = document.createElement('button');
      action.type = 'button';
      action.dataset.wsAiSwitchOffline = 'true';
      action.className = 'ws-ai-switch-offline';
      action.setAttribute('aria-label', 'Switch to Offline AI');
      action.textContent = 'Switch to Offline';
      action.addEventListener('click', () => choose('offline'), { once: true });
      errorSurface.appendChild(action);
    };

    installContinuationAction();
    const observer = new MutationObserver(installContinuationAction);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [mode, localStatus.state, conversationKey]);

  if (!header) return null;

  return createPortal(
    <div className="ws-ai-header-mode" aria-label="AI processing mode">
      <div className="ws-ai-header-mode-status" role="status">
        <span>{status.modeLabel}</span>
        <span aria-hidden="true">·</span>
        <span>{status.processingLabel ?? status.routeLabel}</span>
      </div>
      <div className="ws-ai-header-mode-list" role="group" aria-label="AI processing mode">
        {MODES.map((item) => (
          <button
            key={item}
            type="button"
            className={`ws-ai-header-mode-button${mode === item ? ' selected' : ''}`}
            aria-pressed={mode === item}
            onClick={() => choose(item)}
            title={item === 'offline'
              ? 'Use Local AI only. Never send this request online.'
              : item === 'online'
                ? 'Use Gemini online.'
                : 'Prefer local AI when executable; otherwise use Gemini.'}
          >
            {item.toUpperCase()}
          </button>
        ))}
      </div>
      {mode === 'offline' && localStatus.state === 'unavailable' ? (
        <span className="ws-ai-header-mode-detail">{status.detail}</span>
      ) : null}
      <style>{`
        .ws-ai-header{min-width:0!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important}
        .ws-ai-header-mode{flex:0 1 auto;min-width:0;max-width:52%;margin-left:auto;display:flex;align-items:center;justify-content:flex-end;gap:7px;box-sizing:border-box}
        .ws-ai-header-mode-status{min-width:0;max-width:145px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:800;letter-spacing:.02em;color:#94a3b8}
        .ws-ai-header-mode-list{display:inline-flex;flex:0 0 auto;align-items:center;gap:3px;padding:3px;border:1px solid rgba(148,163,184,.18);border-radius:10px;background:rgba(15,23,42,.58);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
        .ws-ai-header-mode-button{appearance:none;border:0;border-radius:7px;padding:5px 7px;background:transparent;color:#94a3b8;font:800 9px/1 inherit;letter-spacing:.06em;cursor:pointer;min-width:0}
        .ws-ai-header-mode-button:hover{background:rgba(148,163,184,.10);color:#e2e8f0}
        .ws-ai-header-mode-button:focus-visible{outline:2px solid currentColor;outline-offset:1px}
        .ws-ai-header-mode-button.selected{background:rgba(134,239,172,.16);color:#dcfce7;box-shadow:inset 0 0 0 1px rgba(134,239,172,.20)}
        .ws-ai-header-mode-detail{position:absolute;right:12px;top:100%;z-index:5;max-width:min(320px,calc(100% - 24px));padding:6px 8px;border:1px solid rgba(248,113,113,.22);border-radius:8px;background:rgba(45,16,25,.94);color:#fecaca;font-size:10px;line-height:1.35;box-sizing:border-box}
        .ws-ai-switch-offline{display:block;margin-top:8px;max-width:100%;padding:8px 11px;border:1px solid rgba(134,239,172,.28);border-radius:10px;background:rgba(22,101,52,.22);color:#dcfce7;font:800 11px/1.2 inherit;cursor:pointer;box-sizing:border-box}
        .ws-ai-switch-offline:hover{background:rgba(22,101,52,.34);color:#fff}
        .ws-ai-switch-offline:focus-visible{outline:2px solid currentColor;outline-offset:2px}
        @media(max-width:680px){
          .ws-ai-header-mode{max-width:68%;gap:4px}
          .ws-ai-header-mode-status{display:none}
          .ws-ai-header-mode-list{gap:2px}
          .ws-ai-header-mode-button{padding:5px 6px;font-size:8px}
        }
      `}</style>
    </div>,
    header,
  );
}
