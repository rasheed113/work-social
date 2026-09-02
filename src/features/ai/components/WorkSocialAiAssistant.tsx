import { useEffect, useRef, useState } from 'react';
import {
  confirmAiAction,
  listAiConversations,
  listAiMessages,
  sendAiMessage,
  type AiConversation,
  type AiMessage,
  type AiPendingAction,
} from '../api/workSocialAi';

interface Props {
  profileId: string;
}

type UiMessage = Pick<AiMessage, 'id' | 'role' | 'content'>;

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

export function WorkSocialAiAssistant({ profileId }: Props) {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [pendingActions, setPendingActions] = useState<AiPendingAction[]>([]);
  const [draft, setDraft] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingHistory(true);
    setError(null);
    void listAiConversations()
      .then((items) => {
        if (!active) return;
        setConversations(items);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not load AI history.');
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });
    return () => {
      active = false;
    };
  }, [open, profileId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, pendingActions, sending]);

  async function selectConversation(id: string) {
    if (sending || id === conversationId) return;
    setError(null);
    try {
      const items = await listAiMessages(id);
      setConversationId(id);
      setMessages(items.filter((item) => item.role === 'user' || item.role === 'assistant').map(({ id: messageId, role, content }) => ({ id: messageId, role, content })));
      setPendingActions([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load that conversation.');
    }
  }

  function newConversation() {
    if (sending) return;
    setConversationId(null);
    setMessages([]);
    setPendingActions([]);
    setError(null);
  }

  async function submit() {
    const text = draft.trim();
    if (!text || sending) return;
    const requestId = ++requestRef.current;
    setDraft('');
    setError(null);
    setSending(true);
    const localId = `local-${requestId}`;
    setMessages((current) => [...current, { id: localId, role: 'user', content: text }]);
    try {
      const reply = await sendAiMessage(text, conversationId);
      if (requestId !== requestRef.current) return;
      setConversationId(reply.conversation_id);
      setMessages((current) => [...current, { id: `assistant-${reply.conversation_id}-${requestId}`, role: 'assistant', content: reply.message }]);
      setPendingActions(reply.pending_actions);
      setConversations((current) => {
        const existing = current.find((item) => item.id === reply.conversation_id);
        if (existing) return current.map((item) => item.id === existing.id ? { ...item, updated_at: new Date().toISOString() } : item);
        return [{ id: reply.conversation_id, title: text.slice(0, 80), status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...current].slice(0, 30);
      });
    } catch (reason) {
      if (requestId === requestRef.current) {
        setError(reason instanceof Error ? reason.message : 'Work Social AI could not complete the request.');
      }
    } finally {
      if (requestId === requestRef.current) setSending(false);
    }
  }

  async function confirm(action: AiPendingAction) {
    if (confirming || sending) return;
    setConfirming(action.id);
    setError(null);
    try {
      const result = await confirmAiAction(action.id);
      if (!result.success) throw new Error('The action was not completed.');
      setPendingActions((current) => current.filter((item) => item.id !== action.id));
      setMessages((current) => [...current, { id: `confirmed-${action.id}`, role: 'assistant', content: 'Done — the confirmed Work Social action was completed successfully.' }]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The action could not be confirmed.');
    } finally {
      setConfirming(null);
    }
  }

  return (
    <>
      <style>{`
        .ws-ai-launcher{position:fixed;right:18px;bottom:82px;z-index:1500;width:58px;height:58px;border:1px solid rgba(255,255,255,.28);border-radius:20px;background:linear-gradient(145deg,#8b5cf6,#2563eb 58%,#06b6d4);color:#fff;font-size:23px;font-weight:900;cursor:pointer;box-shadow:0 16px 34px rgba(37,99,235,.3),inset 0 1px 1px rgba(255,255,255,.4);transition:transform .18s ease,filter .18s ease}
        .ws-ai-launcher:hover{transform:translateY(-2px);filter:brightness(1.07)}
        .ws-ai-panel{position:fixed;right:18px;bottom:150px;z-index:1499;width:min(920px,calc(100vw - 36px));height:min(720px,calc(100dvh - 190px));display:grid;grid-template-columns:220px minmax(0,1fr);overflow:hidden;box-sizing:border-box;border:1px solid rgba(255,255,255,.16);border-radius:24px;background:linear-gradient(145deg,rgba(8,14,28,.98),rgba(17,24,39,.98));color:#e5eefb;box-shadow:0 28px 80px rgba(2,6,23,.5),inset 0 1px 0 rgba(255,255,255,.08);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
        .ws-ai-history{min-width:0;border-right:1px solid rgba(255,255,255,.1);padding:14px;overflow:auto;background:rgba(2,6,23,.18)}
        .ws-ai-history-title{font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#93c5fd;margin:2px 4px 10px}
        .ws-ai-new{width:100%;padding:10px 11px;margin-bottom:10px;border:1px solid rgba(125,211,252,.2);border-radius:12px;background:rgba(59,130,246,.14);color:#dbeafe;font-weight:800;cursor:pointer;text-align:left}
        .ws-ai-conversation{display:block;width:100%;padding:10px;margin:4px 0;border:1px solid transparent;border-radius:11px;background:transparent;color:#cbd5e1;text-align:left;cursor:pointer;overflow:hidden}
        .ws-ai-conversation:hover{background:rgba(255,255,255,.06)}
        .ws-ai-conversation.active{background:rgba(59,130,246,.16);border-color:rgba(96,165,250,.22);color:#fff}
        .ws-ai-conversation-title{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:800}
        .ws-ai-conversation-date{display:block;margin-top:3px;font-size:9px;color:#64748b}
        .ws-ai-main{min-width:0;min-height:0;display:flex;flex-direction:column;height:100%;overflow:hidden}
        .ws-ai-header{display:flex;align-items:center;gap:10px;flex:0 0 auto;padding:15px 17px;border-bottom:1px solid rgba(255,255,255,.1)}
        .ws-ai-orb{width:36px;height:36px;display:grid;place-items:center;flex:0 0 36px;border-radius:12px;background:linear-gradient(145deg,#a78bfa,#2563eb);box-shadow:inset 0 1px 1px rgba(255,255,255,.35),0 7px 18px rgba(37,99,235,.22)}
        .ws-ai-header-copy{min-width:0;flex:1}.ws-ai-header-title{font-weight:900;font-size:15px}.ws-ai-header-sub{font-size:10px;color:#94a3b8;margin-top:2px}
        .ws-ai-close{border:0;background:transparent;color:#94a3b8;font-size:22px;cursor:pointer;padding:4px 7px;border-radius:9px}.ws-ai-close:hover{background:rgba(255,255,255,.06);color:#fff}
        .ws-ai-messages{flex:1 1 auto;min-height:0;overflow:auto;padding:18px;display:flex;flex-direction:column;gap:11px;overscroll-behavior:contain}
        .ws-ai-welcome{max-width:560px;margin:auto;text-align:center;padding:30px 20px}.ws-ai-welcome h2{margin:0 0 8px;font-size:23px}.ws-ai-welcome p{margin:0;color:#94a3b8;font-size:13px;line-height:1.55}
        .ws-ai-bubble{max-width:min(76%,680px);padding:11px 13px;border-radius:15px;font-size:13px;line-height:1.55;white-space:pre-wrap;word-break:break-word}
        .ws-ai-bubble.user{align-self:flex-end;background:linear-gradient(145deg,#2563eb,#4f46e5);color:#fff;border-bottom-right-radius:5px;box-shadow:0 8px 20px rgba(37,99,235,.18)}
        .ws-ai-bubble.assistant{align-self:flex-start;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.08);color:#e2e8f0;border-bottom-left-radius:5px}
        .ws-ai-action{align-self:flex-start;width:min(90%,620px);padding:12px;border:1px solid rgba(251,191,36,.28);border-radius:14px;background:rgba(120,53,15,.16)}
        .ws-ai-action-title{font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#fbbf24}.ws-ai-action-summary{margin:7px 0 10px;white-space:pre-wrap;font-size:12px;line-height:1.5;color:#f8fafc}.ws-ai-confirm{border:1px solid rgba(250,204,21,.25);border-radius:10px;padding:8px 11px;background:#a16207;color:#fff;font-weight:900;cursor:pointer}.ws-ai-confirm:disabled{opacity:.55;cursor:wait}
        .ws-ai-error{flex:0 0 auto;margin:0 17px 10px;padding:9px 11px;border:1px solid rgba(248,113,113,.25);border-radius:10px;background:rgba(127,29,29,.18);color:#fecaca;font-size:11px;line-height:1.4}
        .ws-ai-composer{display:flex;flex:0 0 auto;min-height:0;width:100%;box-sizing:border-box;position:relative;z-index:2;gap:9px;padding:13px;border-top:1px solid rgba(255,255,255,.1);background:rgba(2,6,23,.96)}
        .ws-ai-input{display:block;min-width:0;min-height:42px;flex:1 1 auto;box-sizing:border-box;resize:none;max-height:120px;padding:11px 12px;border:1px solid rgba(255,255,255,.13);border-radius:13px;outline:none;background:rgba(255,255,255,.055);color:#fff;font:inherit;font-size:13px}.ws-ai-input:focus{border-color:rgba(96,165,250,.55);box-shadow:0 0 0 3px rgba(59,130,246,.1)}
        .ws-ai-send{width:46px;min-width:46px;flex:0 0 46px;border:0;border-radius:13px;background:linear-gradient(145deg,#2563eb,#7c3aed);color:#fff;font-weight:900;cursor:pointer}.ws-ai-send:disabled{opacity:.5;cursor:not-allowed}
        .ws-ai-loading{align-self:flex-start;color:#94a3b8;font-size:12px;padding:5px 2px}.ws-ai-dot{display:inline-block;animation:ws-ai-pulse 1s infinite}.ws-ai-dot:nth-child(2){animation-delay:.15s}.ws-ai-dot:nth-child(3){animation-delay:.3s}@keyframes ws-ai-pulse{50%{opacity:.25}}
        @media(max-width:680px){.ws-ai-panel{right:8px;bottom:142px;width:calc(100vw - 16px);height:calc(100dvh - 165px);grid-template-columns:1fr}.ws-ai-history{display:none}.ws-ai-launcher{right:14px;bottom:78px}.ws-ai-bubble{max-width:88%}.ws-ai-composer{padding:10px}.ws-ai-input{min-height:40px}.ws-ai-send{width:44px;min-width:44px;flex-basis:44px}}
      `}</style>
      <button className="ws-ai-launcher" type="button" aria-label={open ? 'Close Work Social AI' : 'Open Work Social AI'} onClick={() => setOpen((value) => !value)}>{open ? '×' : '✦'}</button>
      {open && (
        <section className="ws-ai-panel" aria-label="Work Social AI Assistant">
          <aside className="ws-ai-history">
            <div className="ws-ai-history-title">Conversations</div>
            <button className="ws-ai-new" type="button" onClick={newConversation}>＋ New conversation</button>
            {loadingHistory ? <div style={{ fontSize: 11, color: '#64748b', padding: 8 }}>Loading history…</div> : null}
            {conversations.map((item) => (
              <button key={item.id} className={`ws-ai-conversation${item.id === conversationId ? ' active' : ''}`} type="button" onClick={() => void selectConversation(item.id)}>
                <span className="ws-ai-conversation-title">{item.title || 'Untitled conversation'}</span>
                <span className="ws-ai-conversation-date">{formatDate(item.updated_at)}</span>
              </button>
            ))}
          </aside>
          <div className="ws-ai-main">
            <header className="ws-ai-header">
              <div className="ws-ai-orb">✦</div>
              <div className="ws-ai-header-copy"><div className="ws-ai-header-title">Work Social AI</div><div className="ws-ai-header-sub">Authenticated · private to your Work Social account</div></div>
              <button className="ws-ai-close" type="button" aria-label="Close" onClick={() => setOpen(false)}>×</button>
            </header>
            <div className="ws-ai-messages">
              {!messages.length && !sending ? <div className="ws-ai-welcome"><h2>Your work companion.</h2><p>Ask about your profile, posts, notifications, or Work Identity entries. AI can prepare consequential actions for your confirmation before anything is written.</p></div> : null}
              {messages.map((message) => <div key={message.id} className={`ws-ai-bubble ${message.role}`}>{message.content}</div>)}
              {pendingActions.map((action) => <div className="ws-ai-action" key={action.id}><div className="ws-ai-action-title">Confirmation required</div><div className="ws-ai-action-summary">{action.display_summary}</div><button className="ws-ai-confirm" type="button" disabled={confirming !== null || sending} onClick={() => void confirm(action)}>{confirming === action.id ? 'Confirming…' : 'Confirm action'}</button></div>)}
              {sending ? <div className="ws-ai-loading">Work Social AI is thinking <span className="ws-ai-dot">·</span><span className="ws-ai-dot">·</span><span className="ws-ai-dot">·</span></div> : null}
              <div ref={endRef} />
            </div>
            {error ? <div className="ws-ai-error" role="alert">{error}</div> : null}
            <form className="ws-ai-composer" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
              <textarea className="ws-ai-input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask Work Social AI…" maxLength={12000} rows={1} disabled={sending} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit(); } }} />
              <button className="ws-ai-send" type="submit" disabled={sending || !draft.trim()} aria-label="Send">➤</button>
            </form>
          </div>
        </section>
      )}
    </>
  );
}
