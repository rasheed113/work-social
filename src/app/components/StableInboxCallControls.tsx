import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase/client';

type Kind = 'audio' | 'video';
type Profile = { id: string; display_name: string | null; avatar_url: string | null };
type Signal = {
  callId: string;
  from: string;
  to: string;
  kind: Kind;
  type: 'offer' | 'answer' | 'ice' | 'hangup' | 'reject';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  conversationId?: string;
};
type Incoming = { id: string; kind: Kind; offer: RTCSessionDescriptionInit; conversationId: string; from: string };

const rtcConfig: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const userTopic = (id: string) => `work-social-user:${id}`;
const conversationTopic = (id: string) => `work-social-call:${id}`;

const Icon = ({ children }: { children: React.ReactNode }) => <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;
const PhoneIcon = () => <Icon><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 5.2 2 2 0 0 1 4.11 3h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 10.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 0 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z" /></Icon>;
const VideoIcon = () => <Icon><path d="m16 13 5 3V8l-5 3V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5Z" /></Icon>;
const MicIcon = () => <Icon><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8"/></Icon>;
const CameraIcon = () => <Icon><path d="M14 5 15.5 3h3L20 5h1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11Z"/><circle cx="12" cy="12" r="3.5"/></Icon>;
const EndIcon = () => <Icon><path d="m5 9 1-3 3-1 2 2h2l2-2 3 1 1 3-3 2a8 8 0 0 1-8 0L5 9Z"/></Icon>;

export function StableInboxCallControls({ profileId }: { profileId: string }) {
  const [conversationId, setConversationId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('conversation'));
  const [peer, setPeer] = useState<Profile | null>(null);
  const [online, setOnline] = useState(false);
  const [call, setCall] = useState<{ id: string; kind: Kind } | null>(null);
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const [connected, setConnected] = useState(false), [muted, setMuted] = useState(false), [cameraOff, setCameraOff] = useState(false);
  const [header, setHeader] = useState<HTMLElement | null>(null), [error, setError] = useState<string | null>(null);
  const peerRef = useRef<Profile | null>(null), callRef = useRef(call), incomingRef = useRef(incoming);
  const pcRef = useRef<RTCPeerConnection | null>(null), localRef = useRef<MediaStream | null>(null), remoteRef = useRef<MediaStream | null>(null);
  const localVideo = useRef<HTMLVideoElement | null>(null), remoteVideo = useRef<HTMLVideoElement | null>(null), remoteAudio = useRef<HTMLAudioElement | null>(null);
  const personalRef = useRef<ReturnType<typeof supabase.channel> | null>(null), conversationRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]), seenSignals = useRef(new Set<string>()), disconnectTimer = useRef<number | null>(null);

  useEffect(() => { peerRef.current = peer; }, [peer]);
  useEffect(() => { callRef.current = call; }, [call]);
  useEffect(() => { incomingRef.current = incoming; }, [incoming]);

  const syncUrl = useCallback(() => {
    setConversationId(new URLSearchParams(window.location.search).get('conversation'));
    setHeader(document.querySelector('.premium-chat-page section > header, .premium-chat-header, .chat-header'));
  }, []);

  useEffect(() => {
    syncUrl();
    window.addEventListener('popstate', syncUrl);
    return () => window.removeEventListener('popstate', syncUrl);
  }, [syncUrl]);

  const loadProfile = useCallback(async (id: string) => {
    const { data } = await supabase.from('profiles').select('id,display_name,avatar_url').eq('id', id).maybeSingle();
    return (data ?? null) as Profile | null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!conversationId) { setPeer(null); setOnline(false); return; }
      const { data } = await supabase.from('conversation_members').select('profile_id').eq('conversation_id', conversationId).neq('profile_id', profileId).limit(1);
      const id = data?.[0]?.profile_id;
      if (!id) { if (!cancelled) setPeer(null); return; }
      const p = await loadProfile(id);
      if (!cancelled) setPeer(p);
    };
    void load();
    return () => { cancelled = true; };
  }, [conversationId, profileId, loadProfile]);

  const cleanup = useCallback(() => {
    if (disconnectTimer.current) { window.clearTimeout(disconnectTimer.current); disconnectTimer.current = null; }
    pcRef.current?.close(); pcRef.current = null;
    localRef.current?.getTracks().forEach(t => t.stop()); localRef.current = null;
    remoteRef.current?.getTracks().forEach(t => t.stop()); remoteRef.current = null;
    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
    if (remoteAudio.current) remoteAudio.current.srcObject = null;
    pendingIce.current = [];
    setCall(null); setConnected(false); setMuted(false); setCameraOff(false);
  }, []);

  const sendSignal = useCallback(async (signal: Signal) => {
    const payload = { ...signal, conversationId: signal.conversationId ?? conversationId ?? undefined };
    const targets = [conversationRef.current, personalRef.current];
    const results = await Promise.allSettled(targets.filter(Boolean).map(ch => ch!.send({ type: 'broadcast', event: 'signal', payload })));
    if (results.every(r => r.status === 'rejected')) throw new Error('Realtime signaling is unavailable.');
  }, [conversationId]);

  const handleSignal = useCallback(async (signal: Signal) => {
    if (!signal || signal.to !== profileId || signal.from === profileId) return;
    const key = `${signal.callId}:${signal.type}:${signal.candidate?.candidate ?? signal.sdp?.sdp ?? ''}`;
    if (seenSignals.current.has(key)) return;
    seenSignals.current.add(key);
    if (seenSignals.current.size > 300) seenSignals.current.clear();
    try {
      if (signal.type === 'offer' && signal.sdp && signal.conversationId) {
        if (callRef.current || incomingRef.current) return;
        const caller = peerRef.current?.id === signal.from ? peerRef.current : await loadProfile(signal.from);
        if (!caller) return;
        peerRef.current = caller; setPeer(caller); setConversationId(signal.conversationId);
        window.history.replaceState({}, '', `/inbox?conversation=${encodeURIComponent(signal.conversationId)}`);
        setError(null);
        setIncoming({ id: signal.callId, kind: signal.kind, offer: signal.sdp, conversationId: signal.conversationId, from: signal.from });
        return;
      }
      if (signal.type === 'hangup' || signal.type === 'reject') { cleanup(); return; }
      if (signal.type === 'answer' && signal.sdp && pcRef.current) {
        await pcRef.current.setRemoteDescription(signal.sdp);
        for (const candidate of pendingIce.current.splice(0)) await pcRef.current.addIceCandidate(candidate);
        return;
      }
      if (signal.type === 'ice' && signal.candidate) {
        if (pcRef.current?.remoteDescription) await pcRef.current.addIceCandidate(signal.candidate);
        else pendingIce.current.push(signal.candidate);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Call setup failed.');
      cleanup();
    }
  }, [cleanup, loadProfile, profileId]);

  useEffect(() => {
    const channel = supabase.channel(userTopic(profileId), { config: { private: true } });
    channel.on('broadcast', { event: 'signal' }, ({ payload }) => void handleSignal(payload as Signal));
    channel.subscribe(); personalRef.current = channel;
    return () => { personalRef.current = null; void supabase.removeChannel(channel); };
  }, [profileId, handleSignal]);

  useEffect(() => {
    if (!conversationId) { conversationRef.current = null; return; }
    const channel = supabase.channel(conversationTopic(conversationId), { config: { private: true } });
    channel.on('broadcast', { event: 'signal' }, ({ payload }) => void handleSignal(payload as Signal));
    channel.subscribe(); conversationRef.current = channel;
    return () => { if (conversationRef.current === channel) conversationRef.current = null; void supabase.removeChannel(channel); };
  }, [conversationId, handleSignal]);

  useEffect(() => {
    if (!conversationId || !peer?.id) { setOnline(false); return; }
    const channel = supabase.channel('work-social-presence', { config: { presence: { key: profileId } } });
    const refresh = () => {
      const state = channel.presenceState<{ userId?: string; profile_id?: string }>();
      setOnline(Object.entries(state).some(([key, entries]) => key === peer.id || entries.some(x => x.userId === peer.id || x.profile_id === peer.id)));
    };
    channel.on('presence', { event: 'sync' }, refresh).on('presence', { event: 'join' }, refresh).on('presence', { event: 'leave' }, refresh);
    channel.subscribe(async status => { if (status === 'SUBSCRIBED') { await channel.track({ userId: profileId, profile_id: profileId, online_at: new Date().toISOString() }); refresh(); } else setOnline(false); });
    return () => { void supabase.removeChannel(channel); };
  }, [conversationId, peer?.id, profileId]);

  const setupPeer = async (kind: Kind, initiator: boolean, id: string, offer?: RTCSessionDescriptionInit) => {
    const currentPeer = peerRef.current;
    if (!currentPeer) throw new Error('Contact unavailable.');
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Calling requires a secure browser connection.');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === 'video' });
    localRef.current = stream;
    if (localVideo.current) localVideo.current.srcObject = stream;
    const pc = new RTCPeerConnection(rtcConfig); pcRef.current = pc;
    remoteRef.current = new MediaStream();
    if (remoteVideo.current) remoteVideo.current.srcObject = remoteRef.current;
    if (remoteAudio.current) remoteAudio.current.srcObject = remoteRef.current;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    pc.ontrack = event => { const s = event.streams[0] ?? remoteRef.current; if (!s) return; remoteRef.current = s; if (remoteVideo.current) remoteVideo.current.srcObject = s; if (remoteAudio.current) { remoteAudio.current.srcObject = s; void remoteAudio.current.play().catch(() => undefined); } setConnected(true); };
    pc.onicecandidate = event => { if (event.candidate && peerRef.current) void sendSignal({ callId: id, from: profileId, to: peerRef.current.id, kind, type: 'ice', candidate: event.candidate.toJSON() }).catch(e => setError(e instanceof Error ? e.message : 'ICE signaling failed.')); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') { if (disconnectTimer.current) window.clearTimeout(disconnectTimer.current); setConnected(true); }
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') cleanup();
      if (pc.connectionState === 'disconnected') { if (disconnectTimer.current) window.clearTimeout(disconnectTimer.current); disconnectTimer.current = window.setTimeout(() => { if (pcRef.current === pc && pc.connectionState === 'disconnected') cleanup(); }, 5000); }
    };
    if (offer) await pc.setRemoteDescription(offer);
    if (initiator) { const localOffer = await pc.createOffer(); await pc.setLocalDescription(localOffer); await sendSignal({ callId: id, from: profileId, to: currentPeer.id, kind, type: 'offer', sdp: localOffer }); }
  };

  const startCall = async (kind: Kind) => {
    if (!peer || !conversationId || callRef.current || incomingRef.current) return;
    try { const id = crypto.randomUUID(); setError(null); setCall({ id, kind }); await setupPeer(kind, true, id); }
    catch (e) { setError(e instanceof Error ? e.message : 'Microphone/camera permission was denied.'); cleanup(); }
  };

  const acceptIncoming = async () => {
    const item = incomingRef.current; const caller = peerRef.current;
    if (!item || !caller) return;
    setIncoming(null); setError(null); setCall({ id: item.id, kind: item.kind });
    try { await setupPeer(item.kind, false, item.id, item.offer); const pc = pcRef.current; if (!pc) throw new Error('Call connection unavailable.'); const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); await sendSignal({ callId: item.id, from: profileId, to: item.from, kind: item.kind, type: 'answer', sdp: answer, conversationId: item.conversationId }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not accept call.'); cleanup(); }
  };

  const declineIncoming = async () => { const item = incomingRef.current; const caller = peerRef.current; if (!item || !caller) return; try { await sendSignal({ callId: item.id, from: profileId, to: caller.id, kind: item.kind, type: 'reject', conversationId: item.conversationId }); } catch { /* remote timeout is non-fatal for decline */ } setIncoming(null); };
  const hangup = async () => { const active = callRef.current; const caller = peerRef.current; if (active && caller) { try { await sendSignal({ callId: active.id, from: profileId, to: caller.id, kind: active.kind, type: 'hangup' }); } catch { /* local cleanup must still happen */ } } cleanup(); };
  const toggleMute = () => { const track = localRef.current?.getAudioTracks()[0]; if (!track) return; track.enabled = !track.enabled; setMuted(!track.enabled); };
  const toggleCamera = () => { const track = localRef.current?.getVideoTracks()[0]; if (!track) return; track.enabled = !track.enabled; setCameraOff(!track.enabled); };

  useEffect(() => () => { cleanup(); }, [cleanup]);

  const title = peer?.display_name?.trim() || 'Contact';
  const controls = header && peer && conversationId ? createPortal(<div className="inbox-call-actions"><span className={`call-presence ${online ? 'online' : ''}`} title={online ? 'Online' : 'Offline'} /><span className="call-presence-label">{online ? 'Online' : 'Offline'}</span><button type="button" aria-label={`Voice call ${title}`} title="Voice call" onClick={() => void startCall('audio')} disabled={!!call || !!incoming}><PhoneIcon /></button><button type="button" aria-label={`Video call ${title}`} title="Video call" onClick={() => void startCall('video')} disabled={!!call || !!incoming}><VideoIcon /></button></div>, header) : null;

  return <>{controls}<style>{`.inbox-call-actions{margin-left:auto;display:flex;align-items:center;gap:8px}.inbox-call-actions button{width:42px;height:42px;display:grid;place-items:center;border:1px solid rgba(99,102,241,.16);border-radius:14px;background:#fff;color:#3730a3;cursor:pointer;box-shadow:0 6px 18px rgba(15,23,42,.08)}.inbox-call-actions button:hover{transform:translateY(-1px)}.inbox-call-actions button:disabled{opacity:.45;cursor:not-allowed}.inbox-call-actions svg,.inbox-call-card svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.call-presence{width:8px;height:8px;border-radius:50%;background:#94a3b8}.call-presence.online{background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.13),0 0 10px rgba(34,197,94,.35)}.call-presence-label{font-size:11px;font-weight:800;color:#64748b}.inbox-call-stage{position:fixed;inset:0;z-index:5000;background:rgba(8,12,25,.82);backdrop-filter:blur(14px);display:grid;place-items:center;padding:18px}.inbox-call-card{width:min(680px,100%);overflow:hidden;border:1px solid rgba(255,255,255,.18);border-radius:28px;background:linear-gradient(145deg,#111827,#1e1b4b);box-shadow:0 30px 90px rgba(0,0,0,.45);color:#fff}.inbox-call-videos{position:relative;aspect-ratio:16/10;background:#020617}.inbox-call-videos video{width:100%;height:100%;object-fit:cover}.inbox-call-local{position:absolute!important;right:14px;top:14px;width:150px!important;height:100px!important;border-radius:16px;border:2px solid rgba(255,255,255,.35)}.inbox-call-info{padding:18px;display:flex;align-items:center;justify-content:space-between;gap:14px}.inbox-call-name{font-weight:900;font-size:18px}.inbox-call-status{font-size:12px;color:rgba(255,255,255,.65);margin-top:4px}.inbox-call-buttons{display:flex;gap:9px}.inbox-call-buttons button{width:48px;height:48px;border:0;border-radius:16px;background:rgba(255,255,255,.12);color:#fff;display:grid;place-items:center;cursor:pointer}.inbox-call-buttons .end{background:#ef4444}.inbox-incoming{padding:30px;text-align:center}.inbox-incoming-avatar{width:78px;height:78px;margin:0 auto 14px;border-radius:50%;object-fit:cover;background:#312e81}.inbox-incoming-title{font-size:22px;font-weight:900}.inbox-incoming-sub{margin:6px 0 24px;color:rgba(255,255,255,.65)}.inbox-incoming-actions{display:flex;justify-content:center;gap:14px}.inbox-incoming-actions button{min-width:120px;height:48px;border:0;border-radius:16px;font-weight:900;cursor:pointer}.inbox-incoming-actions .accept{background:#22c55e;color:#fff}.inbox-incoming-actions .decline{background:#ef4444;color:#fff}.inbox-call-error{margin:0 18px 18px;padding:10px 12px;border-radius:12px;background:rgba(239,68,68,.14);color:#fecaca;font-size:12px}`}</style>{incoming && <div className="inbox-call-stage" role="dialog" aria-modal="true" aria-label="Incoming call"><div className="inbox-call-card"><div className="inbox-incoming"><img className="inbox-incoming-avatar" src={peer?.avatar_url || ''} alt=""/><div className="inbox-incoming-title">{title}</div><div className="inbox-incoming-sub">Incoming {incoming.kind === 'video' ? 'video' : 'voice'} call</div><div className="inbox-incoming-actions"><button className="decline" type="button" onClick={() => void declineIncoming()}>Decline</button><button className="accept" type="button" onClick={() => void acceptIncoming()}>Accept</button></div></div></div></div>}{call && <div className="inbox-call-stage" role="dialog" aria-modal="true" aria-label={`${call.kind} call with ${title}`}><div className="inbox-call-card"><div className="inbox-call-videos">{call.kind === 'video' ? <><video ref={remoteVideo} autoPlay playsInline /><video ref={localVideo} className="inbox-call-local" autoPlay playsInline muted /></> : <><audio ref={remoteAudio} autoPlay /><div style={{height:'100%',display:'grid',placeItems:'center'}}><PhoneIcon /></div></>}</div><div className="inbox-call-info"><div><div className="inbox-call-name">{title}</div><div className="inbox-call-status">{connected ? 'Connected' : 'Calling…'} · {call.kind === 'video' ? 'Video' : 'Voice'}</div></div><div className="inbox-call-buttons"><button type="button" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}><MicIcon /></button>{call.kind === 'video' && <button type="button" onClick={toggleCamera} aria-label={cameraOff ? 'Turn camera on' : 'Turn camera off'}><CameraIcon /></button>}<button type="button" className="end" onClick={() => void hangup()} aria-label="End call"><EndIcon /></button></div></div>{error && <div className="inbox-call-error">{error}</div>}</div></div>}</>;
}
