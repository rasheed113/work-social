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
import type { AiProviderId, AiProviderMode, AiRoutingMode } from '../providers/contracts';
import { offlineAiTrace } from '../runtime/localAiDiagnostics';

interface Props { profileId: string; mode: AiRoutingMode; }
type UiMessage = Pick<AiMessage, 'id' | 'role' | 'content'> & { provider?: AiProviderId; mode?: AiProviderMode };
function readMessageProvenance(message: AiMessage): Pick<UiMessage, 'provider' | 'mode'> { const metadata = message.metadata ?? {}; const provider = metadata.provider === 'local' || metadata.provider === 'gemini' ? metadata.provider : undefined; const mode = metadata.mode === 'offline' || metadata.mode === 'online' ? metadata.mode : undefined; return { provider, mode }; }
type VoiceState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING' | 'STOPPING';
type SpeechRecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean;
  onstart: (() => void) | null; onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  start: () => void; stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
declare global { interface Window { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor; } }

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function speechLocale(text: string) { return /[\u0600-\u06ff]/.test(text) ? 'ur-PK' : 'en-US'; }
function isVoiceConfirmation(text: string) {
  return /^(?:haan|han|yes|yep|yeah|ok|okay|kar do|kr do|confirm|confirmed|جی ہاں|ہاں|کر دو|کر دیں|ٹھیک ہے|ٹھیک|yes please)\b/i.test(text.trim());
}
function isVoiceCancellation(text: string) {
  return /^(?:nahi|nahin|no|nope|cancel|cancel it|don't|dont|mat karo|مت کرو|نہیں|منسوخ)\b/i.test(text.trim());
}

export function WorkSocialAiAssistant({ profileId: _profileId, mode }: Props) {
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
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');
  const [voiceAvailable, setVoiceAvailable] = useState(true);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);
  const voiceStateRef = useRef<VoiceState>('IDLE');
  const voiceActiveRef = useRef(false);
  const recognitionCtorRef = useRef<SpeechRecognitionConstructor | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const voiceSessionRef = useRef(0);
  const speechTokenRef = useRef(0);
  const conversationIdRef = useRef<string | null>(null);
  const pendingActionsRef = useRef<AiPendingAction[]>([]);
  const sendingRef = useRef(false);
  const streamBufferRef = useRef('');
  const streamFrameRef = useRef<number | null>(null);
  const streamMessageIdRef = useRef<string | null>(null);

  const setVoice = (next: VoiceState) => { voiceStateRef.current = next; setVoiceState(next); };
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);
  useEffect(() => { pendingActionsRef.current = pendingActions; }, [pendingActions]);
  useEffect(() => { sendingRef.current = sending; }, [sending]);
  useEffect(() => () => { if (streamFrameRef.current !== null) window.cancelAnimationFrame(streamFrameRef.current); }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingHistory(true); setError(null);
    void listAiConversations().then((items) => { if (active) setConversations(items); }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Could not load AI history.');
    }).finally(() => { if (active) setLoadingHistory(false); });
    return () => { active = false; };
  }, [open, _profileId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'auto', block: 'nearest' }); const latest = messages[messages.length - 1]; if (latest?.role === 'assistant') offlineAiTrace('RESPONSE_RENDERED', { provider: latest.provider ?? null, mode: latest.mode ?? null, provenanceKnown: Boolean(latest.provider && latest.mode) }); }, [messages]);

  useEffect(() => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) { setVoiceAvailable(false); return; }
    recognitionCtorRef.current = Recognition;
    return () => {
      voiceActiveRef.current = false; voiceSessionRef.current += 1;
      if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
      try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
      recognitionRef.current = null; window.speechSynthesis?.cancel(); speechRef.current = null; setVoice('IDLE');
    };
  }, []);
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  const stopRecognition = () => {
    const current = recognitionRef.current; recognitionRef.current = null;
    if (current) { current.onresult = null; current.onstart = null; current.onerror = null; current.onend = null; try { current.stop(); } catch { /* already stopped */ } }
  };
  const clearRestartTimer = () => { if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current); restartTimerRef.current = null; };

  const speakVoiceResponse = (text: string, sessionId: number, messageId: string) => {
    if (!voiceActiveRef.current || sessionId !== voiceSessionRef.current) return;
    const clean = text.trim();
    if (!clean) { scheduleListening(sessionId, 150); return; }
    if (!('speechSynthesis' in window)) { scheduleListening(sessionId, 150); return; }
    speechTokenRef.current += 1; const token = speechTokenRef.current; window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean); utterance.lang = speechLocale(clean); utterance.rate = 0.96; utterance.pitch = 1;
    speechRef.current = utterance; setSpeakingId(messageId); setVoice('SPEAKING');
    utterance.onstart = () => { if (!voiceActiveRef.current || token !== speechTokenRef.current || sessionId !== voiceSessionRef.current) return; setSpeakingId(messageId); };
    const finish = () => { if (token !== speechTokenRef.current || sessionId !== voiceSessionRef.current) return; speechRef.current = null; setSpeakingId(null); if (voiceActiveRef.current) scheduleListening(sessionId, 180); else setVoice('IDLE'); };
    utterance.onend = finish; utterance.onerror = finish; window.speechSynthesis.speak(utterance);
  };

  const scheduleListening = (sessionId: number, delay: number) => {
    clearRestartTimer(); if (!voiceActiveRef.current || sessionId !== voiceSessionRef.current) return;
    setVoice('LISTENING'); restartTimerRef.current = window.setTimeout(() => { restartTimerRef.current = null; if (!voiceActiveRef.current || sessionId !== voiceSessionRef.current) return; startListeningSegment(sessionId); }, delay);
  };

  const startListeningSegment = (sessionId: number) => {
    const Recognition = recognitionCtorRef.current;
    if (!Recognition || !voiceActiveRef.current || sessionId !== voiceSessionRef.current || recognitionRef.current) return;
    const recognition = new Recognition(); recognitionRef.current = recognition; recognition.lang = 'ur-PK'; recognition.continuous = false; recognition.interimResults = true;
    let finalText = ''; let handledFinal = false;
    recognition.onstart = () => { if (!voiceActiveRef.current || sessionId !== voiceSessionRef.current) return; setVoice('LISTENING'); };
    recognition.onresult = (event) => {
      if (!voiceActiveRef.current || sessionId !== voiceSessionRef.current || handledFinal) return;
      let latestFinal = ''; let interim = '';
      for (let i = 0; i < event.results.length; i += 1) { const result = event.results[i]; const text = result[0]?.transcript ?? ''; if (result.isFinal) latestFinal += `${text} `; else interim += text; }
      if (latestFinal.trim()) finalText = latestFinal.trim(); const visible = `${finalText} ${interim}`.trim(); if (visible) setDraft(visible);
      if (!finalText.trim() || handledFinal) return; handledFinal = true; stopRecognition(); setDraft(''); setVoice('PROCESSING'); void submitText(finalText.trim(), sessionId, true);
    };
    recognition.onerror = (event) => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      if (!voiceActiveRef.current || sessionId !== voiceSessionRef.current) return;
      if (event.error === 'aborted') return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') { voiceActiveRef.current = false; setVoice('IDLE'); setError('Microphone permission is required.'); return; }
      if (event.error === 'no-speech') { scheduleListening(sessionId, 120); return; }
      setError('Voice input could not be heard. Voice Chat will retry.'); scheduleListening(sessionId, 500);
    };
    recognition.onend = () => { if (recognitionRef.current === recognition) recognitionRef.current = null; if (!voiceActiveRef.current || sessionId !== voiceSessionRef.current) return; if (handledFinal) return; if (voiceStateRef.current === 'LISTENING') scheduleListening(sessionId, 120); };
    try { recognition.start(); } catch { if (recognitionRef.current === recognition) recognitionRef.current = null; if (voiceActiveRef.current && sessionId === voiceSessionRef.current) scheduleListening(sessionId, 300); }
  };

  const stopVoiceMode = () => { voiceActiveRef.current = false; voiceSessionRef.current += 1; setVoice('STOPPING'); clearRestartTimer(); stopRecognition(); speechTokenRef.current += 1; window.speechSynthesis?.cancel(); speechRef.current = null; setSpeakingId(null); setDraft(''); setVoice('IDLE'); };
  const startVoiceMode = () => { if (!voiceAvailable || !recognitionCtorRef.current) { setError('Voice input is not supported by this browser.'); return; } if (voiceActiveRef.current) return; setError(null); voiceActiveRef.current = true; const sessionId = ++voiceSessionRef.current; setVoice('LISTENING'); scheduleListening(sessionId, 0); };

  async function selectConversation(id: string) {
    if (sending || id === conversationId) return; setError(null);
    try { const items = await listAiMessages(id); setConversationId(id); conversationIdRef.current = id; setMessages(items.filter((item) => item.role === 'user' || item.role === 'assistant').map((item) => ({ id: item.id, role: item.role, content: item.content, ...readMessageProvenance(item) }))); setPendingActions([]); pendingActionsRef.current = []; }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load that conversation.'); }
  }
  function newConversation() { if (sending) return; setConversationId(null); conversationIdRef.current = null; setMessages([]); setPendingActions([]); pendingActionsRef.current = []; setError(null); setDraft(''); }

  async function submitText(text: string, voiceSessionId?: number, fromVoice = false) {
    const trimmed = text.trim(); if (!trimmed || sendingRef.current) return;
    const activeVoiceSession = fromVoice && voiceActiveRef.current && voiceSessionId === voiceSessionRef.current; const requestId = ++requestRef.current; const assistantId = `assistant-stream-${requestId}`;
    streamBufferRef.current = ''; streamMessageIdRef.current = assistantId;
    setError(null); setSending(true); sendingRef.current = true; setMessages((current) => [...current, { id: `local-${requestId}`, role: 'user', content: trimmed }]);
    const flushStream = () => {
      streamFrameRef.current = null;
      const nextText = streamBufferRef.current;
      const messageId = streamMessageIdRef.current;
      if (!messageId || requestId !== requestRef.current) return;
      setMessages((current) => {
        const index = current.findIndex((message) => message.id === messageId);
        if (index < 0) return [...current, { id: messageId, role: 'assistant', content: nextText }];
        if (current[index].content === nextText) return current;
        const updated = [...current]; updated[index] = { ...updated[index], content: nextText }; return updated;
      });
    };
    const onOfflineToken = (token: string) => {
      if (requestId !== requestRef.current || mode === 'online') return;
      streamBufferRef.current += token;
      if (streamFrameRef.current === null) streamFrameRef.current = window.requestAnimationFrame(flushStream);
    };
    try {
      const reply = await sendAiMessage(trimmed, conversationIdRef.current, mode, undefined, onOfflineToken);
      if (requestId !== requestRef.current) return;
      if (streamFrameRef.current !== null) { window.cancelAnimationFrame(streamFrameRef.current); streamFrameRef.current = null; }
      if (reply.provider !== (reply.mode === 'offline' ? 'local' : 'gemini')) throw new Error(`AI response provenance mismatch: provider=${reply.provider}, mode=${reply.mode}`);
      if (mode === 'offline' && (reply.provider !== 'local' || reply.mode !== 'offline')) throw new Error(`OFFLINE_ROUTE_VIOLATION: provider=${reply.provider}, mode=${reply.mode}`);
      setConversationId(reply.conversation_id); conversationIdRef.current = reply.conversation_id;
      setMessages((current) => { const index = current.findIndex((message) => message.id === assistantId); const finalMessage: UiMessage = { id: assistantId, role: 'assistant', content: reply.message, provider: reply.provider, mode: reply.mode }; if (index < 0) return [...current, finalMessage]; const updated = [...current]; updated[index] = finalMessage; return updated; });
      streamMessageIdRef.current = null; streamBufferRef.current = '';
      setPendingActions(reply.pending_actions); pendingActionsRef.current = reply.pending_actions;
      setConversations((current) => { const existing = current.find((item) => item.id === reply.conversation_id); if (existing) return current.map((item) => item.id === existing.id ? { ...item, updated_at: new Date().toISOString() } : item); return [{ id: reply.conversation_id, title: trimmed.slice(0, 80), status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...current].slice(0, 30); });
      if (activeVoiceSession) speakVoiceResponse(reply.message, voiceSessionId!, assistantId);
    } catch (reason) { if (requestId === requestRef.current) { if (streamFrameRef.current !== null) { window.cancelAnimationFrame(streamFrameRef.current); streamFrameRef.current = null; } setMessages((current) => current.filter((message) => message.id !== assistantId)); streamMessageIdRef.current = null; streamBufferRef.current = ''; setError(reason instanceof Error ? reason.message : 'Work Social AI could not complete the request.'); if (activeVoiceSession) scheduleListening(voiceSessionId!, 400); } }
    finally { if (requestId === requestRef.current) { setSending(false); sendingRef.current = false; } }
  }
  async function submit() { const text = draft.trim(); if (!text || sending) return; setDraft(''); await submitText(text); }

  async function handleVoiceConfirmation(text: string, sessionId: number) {
    const action = pendingActionsRef.current[0]; if (!action) { await submitText(text, sessionId, true); return; }
    if (isVoiceCancellation(text)) { await submitText(text, sessionId, true); return; }
    if (isVoiceConfirmation(text)) {
      setVoice('PROCESSING');
      try { setConfirming(action.id); const result = await confirmAiAction(action.id); if (!result.success) throw new Error('The action was not completed.'); setPendingActions((current) => current.filter((item) => item.id !== action.id)); pendingActionsRef.current = pendingActionsRef.current.filter((item) => item.id !== action.id); const message = 'Done — the confirmed Work Social action was completed successfully.'; const messageId = `confirmed-${action.id}`; setMessages((current) => [...current, { id: messageId, role: 'assistant', content: message }]); speakVoiceResponse(message, sessionId, messageId); }
      catch (reason) { setError(reason instanceof Error ? reason.message : 'The action could not be confirmed.'); scheduleListening(sessionId, 400); } finally { setConfirming(null); }
      return;
    }
    await submitText(text, sessionId, true);
  }
  async function confirm(action: AiPendingAction) {
    if (confirming || sending) return; setConfirming(action.id); setError(null);
    try { const result = await confirmAiAction(action.id); if (!result.success) throw new Error('The action was not completed.'); setPendingActions((current) => current.filter((item) => item.id !== action.id)); pendingActionsRef.current = pendingActionsRef.current.filter((item) => item.id !== action.id); setMessages((current) => [...current, { id: `confirmed-${action.id}`, role: 'assistant', content: 'Done — the confirmed Work Social action was completed successfully.' }]); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The action could not be confirmed.'); } finally { setConfirming(null); }
  }
  function toggleVoiceMode() { if (voiceActiveRef.current) stopVoiceMode(); else startVoiceMode(); }
  function toggleSpeak(message: UiMessage) {
    if (!('speechSynthesis' in window)) { setError('Speaker playback is not supported by this browser.'); return; }
    if (speakingId === message.id) { speechTokenRef.current += 1; window.speechSynthesis.cancel(); setSpeakingId(null); return; }
    speechTokenRef.current += 1; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(message.content); utterance.lang = speechLocale(message.content); utterance.rate = 0.96; utterance.pitch = 1; utterance.onstart = () => setSpeakingId(message.id); utterance.onend = () => setSpeakingId(null); utterance.onerror = () => setSpeakingId(null); setSpeakingId(message.id); window.speechSynthesis.speak(utterance);
  }

  const voiceLabel = voiceState === 'LISTENING' ? 'Listening…' : voiceState === 'PROCESSING' ? 'Thinking…' : voiceState === 'SPEAKING' ? 'Speaking…' : voiceState === 'STOPPING' ? 'Stopping…' : 'Voice Chat';
  const voiceIcon = voiceState === 'SPEAKING' ? '🔊' : voiceState === 'PROCESSING' ? '⏳' : voiceState === 'LISTENING' ? '●' : '🎙️';

  return (
    <>
      <style>{`
        .ws-ai-launcher{position:fixed;right:18px;bottom:82px;z-index:1500;width:58px;height:58px;border:1px solid rgba(255,255,255,.28);border-radius:20px;background:linear-gradient(145deg,#8b5cf6,#2563eb 58%,#06b6d4);color:#fff;font-size:23px;font-weight:900;cursor:pointer;box-shadow:0 16px 34px rgba(37,99,235,.3),inset 0 1px 1px rgba(255,255,255,.4);transition:transform .18s ease,filter .18s ease}.ws-ai-launcher:hover{transform:translateY(-2px);filter:brightness(1.07)}
        .ws-ai-panel{position:fixed;right:18px;bottom:150px;z-index:1499;width:min(920px,calc(100vw - 36px));height:min(720px,calc(100dvh - 190px));display:grid;grid-template-columns:220px minmax(0,1fr);overflow:hidden;box-sizing:border-box;border:1px solid rgba(255,255,255,.16);border-radius:24px;background:linear-gradient(145deg,rgba(8,14,28,.98),rgba(17,24,39,.98));color:#e5eefb;box-shadow:0 28px 80px rgba(2,6,23,.5),inset 0 1px 0 rgba(255,255,255,.08);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
        .ws-ai-history{min-width:0;border-right:1px solid rgba(255,255,255,.1);padding:14px;overflow:auto;background:rgba(2,6,23,.18)}.ws-ai-history-title{font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#93c5fd;margin:2px 4px 10px}.ws-ai-new{width:100%;padding:10px 11px;margin-bottom:10px;border:1px solid rgba(125,211,252,.2);border-radius:12px;background:rgba(59,130,246,.14);color:#dbeafe;font-weight:800;cursor:pointer;text-align:left}.ws-ai-conversation{display:block;width:100%;padding:10px;margin:4px 0;border:1px solid transparent;border-radius:11px;background:transparent;color:#cbd5e1;text-align:left;cursor:pointer;overflow:hidden}.ws-ai-conversation:hover{background:rgba(255,255,255,.06)}.ws-ai-conversation.active{background:rgba(59,130,246,.16);border-color:rgba(96,165,250,.22);color:#fff}.ws-ai-conversation-title{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:800}.ws-ai-conversation-date{display:block;margin-top:3px;font-size:9px;color:#64748b}
        .ws-ai-main{min-width:0;min-height:0;display:flex;flex-direction:column;height:100%;overflow:hidden}.ws-ai-header{display:flex;align-items:center;gap:10px;flex:0 0 auto;padding:15px 17px;border-bottom:1px solid rgba(255,255,255,.1)}.ws-ai-orb{width:36px;height:36px;display:grid;place-items:center;flex:0 0 36px;border-radius:12px;background:linear-gradient(145deg,#a78bfa,#2563eb);box-shadow:inset 0 1px 1px rgba(255,255,255,.35),0 7px 18px rgba(37,99,235,.22)}.ws-ai-header-copy{min-width:0;flex:1}.ws-ai-header-title{font-weight:900;font-size:15px}.ws-ai-header-sub{font-size:10px;color:#94a3b8;margin-top:2px}.ws-ai-close{border:0;background:transparent;color:#94a3b8;font-size:22px;cursor:pointer;padding:4px 7px;border-radius:9px}.ws-ai-close:hover{background:rgba(255,255,255,.06);color:#fff}
        .ws-ai-messages{flex:1 1 auto;min-height:0;overflow:auto;padding:18px;display:flex;flex-direction:column;gap:11px;overscroll-behavior:contain}.ws-ai-welcome{max-width:560px;margin:auto;text-align:center;padding:30px 20px}.ws-ai-welcome h2{margin:0 0 8px;font-size:23px}.ws-ai-welcome p{margin:0;color:#94a3b8;font-size:13px;line-height:1.55}.ws-ai-message-row{align-self:flex-start;max-width:min(76%,680px);display:flex;flex-direction:column;align-items:flex-start;gap:6px}.ws-ai-bubble{padding:11px 13px;border-radius:15px;font-size:13px;line-height:1.55;white-space:pre-wrap;word-break:break-word}.ws-ai-bubble.user{align-self:flex-end;background:linear-gradient(145deg,#2563eb,#4f46e5);color:#fff;border-bottom-right-radius:5px;box-shadow:0 8px 20px rgba(37,99,235,.18)}.ws-ai-bubble.assistant{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.08);color:#e2e8f0;border-bottom-left-radius:5px}.ws-ai-provenance{display:inline-flex;align-items:center;gap:6px;margin-left:3px;padding:4px 8px;border:1px solid rgba(134,239,172,.2);border-radius:8px;background:rgba(22,101,52,.12);color:#bbf7d0;font-size:10px;font-weight:800}.ws-ai-speaker{display:inline-flex;align-items:center;gap:6px;margin-left:3px;padding:5px 9px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:rgba(255,255,255,.045);color:#94a3b8;font-size:11px;cursor:pointer;transition:all .16s ease}.ws-ai-speaker:hover,.ws-ai-speaker.playing{color:#dbeafe;border-color:rgba(96,165,250,.4);background:rgba(59,130,246,.16)}
        .ws-ai-action{align-self:flex-start;width:min(90%,620px);padding:12px;border:1px solid rgba(251,191,36,.28);border-radius:14px;background:rgba(120,53,15,.16)}.ws-ai-action-title{font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#fbbf24}.ws-ai-action-summary{margin:7px 0 10px;white-space:pre-wrap;font-size:12px;line-height:1.5;color:#f8fafc}.ws-ai-confirm{border:1px solid rgba(250,204,21,.25);border-radius:10px;padding:8px 11px;background:#a16207;color:#fff;font-weight:900;cursor:pointer}.ws-ai-confirm:disabled{opacity:.55;cursor:wait}.ws-ai-error{flex:0 0 auto;margin:0 17px 10px;padding:9px 11px;border:1px solid rgba(248,113,113,.25);border-radius:10px;background:rgba(127,29,29,.18);color:#fecaca;font-size:11px;line-height:1.4}
        .ws-ai-composer{display:flex;flex:0 0 auto;min-height:0;width:100%;box-sizing:border-box;position:relative;z-index:2;gap:8px;padding:13px;border-top:1px solid rgba(255,255,255,.1);background:rgba(2,6,23,.96)}.ws-ai-input-wrap{display:flex;align-items:flex-end;min-width:0;flex:1 1 auto;gap:5px;padding:4px;border:1px solid rgba(255,255,255,.13);border-radius:15px;background:rgba(255,255,255,.055)}.ws-ai-input-wrap:focus-within{border-color:rgba(96,165,250,.55);box-shadow:0 0 0 3px rgba(59,130,246,.1)}.ws-ai-input{display:block;min-width:0;min-height:42px;flex:1 1 auto;box-sizing:border-box;resize:none;max-height:120px;padding:7px 8px;border:0;outline:none;background:transparent;color:#fff;font:inherit;font-size:13px}.ws-ai-voice{width:38px;height:38px;flex:0 0 38px;border:1px solid transparent;border-radius:11px;background:transparent;color:#94a3b8;font-size:17px;cursor:pointer;display:grid;place-items:center}.ws-ai-voice:hover{background:rgba(255,255,255,.07);color:#fff}.ws-ai-voice.listening{background:rgba(34,197,94,.16);border-color:rgba(74,222,128,.4);color:#bbf7d0;animation:ws-ai-mic-pulse 1.2s infinite}.ws-ai-voice.processing{background:rgba(59,130,246,.16);border-color:rgba(96,165,250,.4);color:#bfdbfe}.ws-ai-voice.speaking{background:rgba(124,58,237,.18);border-color:rgba(167,139,250,.45);color:#ddd6fe}.ws-ai-voice:disabled{opacity:.45;cursor:not-allowed}.ws-ai-send{width:46px;min-width:46px;flex:0 0 46px;border:0;border-radius:13px;background:linear-gradient(145deg,#2563eb,#7c3aed);color:#fff;font-weight:900;cursor:pointer}.ws-ai-send:disabled{opacity:.5;cursor:not-allowed}.ws-ai-voice-status{position:absolute;left:16px;bottom:68px;padding:5px 9px;border:1px solid rgba(96,165,250,.25);border-radius:9px;background:rgba(8,14,28,.96);color:#dbeafe;font-size:10px;box-shadow:0 8px 20px rgba(0,0,0,.25)}
        .ws-ai-loading{align-self:flex-start;color:#94a3b8;font-size:12px;padding:5px 2px}.ws-ai-dot{display:inline-block;animation:none}.ws-ai-dot:nth-child(2){animation-delay:.15s}.ws-ai-dot:nth-child(3){animation-delay:.3s}@keyframes ws-ai-pulse{50%{opacity:.25}}@keyframes ws-ai-mic-pulse{50%{transform:scale(.94);opacity:.7}}
        @media(max-width:680px){.ws-ai-panel{right:8px;bottom:142px;width:calc(100vw - 16px);height:calc(100dvh - 165px);grid-template-columns:1fr}.ws-ai-history{display:none}.ws-ai-launcher{right:14px;bottom:78px}.ws-ai-message-row{max-width:88%}.ws-ai-composer{padding:10px}.ws-ai-input{min-height:40px}.ws-ai-send{width:44px;min-width:44px;flex-basis:44px}}
      `}</style>
      <button className="ws-ai-launcher" type="button" aria-label={open ? 'Close Work Social AI' : 'Open Work Social AI'} onClick={() => setOpen((value) => !value)}>{open ? '×' : '✦'}</button>
      {open && <section className="ws-ai-panel" aria-label="Work Social AI Assistant">
        <aside className="ws-ai-history"><div className="ws-ai-history-title">Conversations</div><button className="ws-ai-new" type="button" onClick={newConversation}>＋ New conversation</button>{loadingHistory ? <div style={{ fontSize: 11, color: '#64748b', padding: 8 }}>Loading history…</div> : null}{conversations.map((item) => <button key={item.id} className={`ws-ai-conversation${item.id === conversationId ? ' active' : ''}`} type="button" onClick={() => void selectConversation(item.id)}><span className="ws-ai-conversation-title">{item.title || 'Untitled conversation'}</span><span className="ws-ai-conversation-date">{formatDate(item.updated_at)}</span></button>)}</aside>
        <div className="ws-ai-main"><header className="ws-ai-header"><div className="ws-ai-orb">✦</div><div className="ws-ai-header-copy"><div className="ws-ai-header-title">Work Social AI</div><div className="ws-ai-header-sub">Authenticated · private to your Work Social account</div></div><button className="ws-ai-close" type="button" aria-label="Close" onClick={() => setOpen(false)}>×</button></header>
          <div className="ws-ai-messages">
            {!messages.length && !sending ? <div className="ws-ai-welcome"><h2>Your work companion.</h2><p>Ask about your profile, posts, notifications, or Work Identity entries. AI can prepare consequential actions for your confirmation before anything is written.</p></div> : null}
            {messages.map((message) => message.role === 'assistant' ? <div className="ws-ai-message-row" key={message.id}><div className="ws-ai-bubble assistant">{message.content}</div>{message.provider && message.mode ? <span className="ws-ai-provenance" aria-label={`Generated by ${message.provider === 'local' ? 'Local Wllama' : 'WS AI'} in ${message.mode} mode`}>{message.provider === 'local' ? 'Local Wllama' : 'WS AI'} · {message.mode === 'offline' ? 'Offline' : 'Online'}</span> : null}<button className={`ws-ai-speaker${speakingId === message.id ? ' playing' : ''}`} type="button" onClick={() => toggleSpeak(message)} aria-label={speakingId === message.id ? 'Stop reading this reply' : 'Read this reply aloud'}>{speakingId === message.id ? '■' : '🔊'} <span>{speakingId === message.id ? 'Stop' : 'Listen'}</span></button></div> : <div key={message.id} className="ws-ai-bubble user">{message.content}</div>)}
            {pendingActions.map((action) => <div className="ws-ai-action" key={action.id}><div className="ws-ai-action-title">Confirmation required</div><div className="ws-ai-action-summary">{action.display_summary}</div><button className="ws-ai-confirm" type="button" disabled={confirming !== null || sending} onClick={() => void confirm(action)}>{confirming === action.id ? 'Confirming…' : 'Confirm action'}</button></div>)}
            {sending ? <div className="ws-ai-loading">Work Social AI is thinking <span className="ws-ai-dot">·</span><span className="ws-ai-dot">·</span><span className="ws-ai-dot">·</span></div> : null}<div ref={endRef} />
          </div>
          {error ? <div className="ws-ai-error" role="alert">{error}</div> : null}
          <form className="ws-ai-composer" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            <div className="ws-ai-input-wrap"><textarea className="ws-ai-input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask Work Social AI…" maxLength={12000} rows={1} disabled={sending} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit(); } }} /><button className={`ws-ai-voice${voiceState === 'LISTENING' ? ' listening' : voiceState === 'PROCESSING' ? ' processing' : voiceState === 'SPEAKING' ? ' speaking' : ''}`} type="button" disabled={!voiceAvailable || voiceState === 'STOPPING'} onClick={toggleVoiceMode} aria-pressed={voiceState !== 'IDLE'} aria-label={voiceActiveRef.current ? `Voice Chat ${voiceLabel}` : 'Start Voice Chat'} title={voiceAvailable ? voiceLabel : 'Voice input is not supported'}>{voiceIcon}</button></div>
            <button className="ws-ai-send" type="submit" disabled={sending || !draft.trim()} aria-label="Send">➤</button>
            {voiceState !== 'IDLE' ? <div className="ws-ai-voice-status" role="status">Voice Chat · {voiceLabel}</div> : null}
          </form>
        </div>
      </section>}
    </>
  );
}
