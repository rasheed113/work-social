import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase/client';

type Kind = 'audio' | 'video';
type Profile = { id: string; display_name: string | null; avatar_url: string | null };
type Signal = { callId: string; from: string; to: string; kind: Kind; type: 'offer' | 'answer' | 'ice' | 'hangup' | 'reject'; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit; conversationId: string };

// STUN is sufficient when peers can establish a direct path. Keep the list redundant.
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

const Icon = ({ t }: { t: string }) => <span aria-hidden>{({ phone: '📞', video: '🎥', mic: '🎙️', camera: '📷', speaker: '🔊', end: '📵' } as Record<string, string>)[t]}</span>;

export function StableInboxCallControls({ profileId }: { profileId: string }) {
  const [cid, setCid] = useState<string | null>(() => new URLSearchParams(location.search).get('conversation'));
  const [peer, setPeer] = useState<Profile | null>(null);
  const [incoming, setIncoming] = useState<Signal | null>(null);
  const [active, setActive] = useState<{ id: string; kind: Kind; outgoing: boolean } | null>(null);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [header, setHeader] = useState<HTMLElement | null>(null);

  const peerRef = useRef<Profile | null>(null);
  const activeRef = useRef(active);
  const incomingRef = useRef(incoming);
  const cidRef = useRef(cid);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const remoteRef = useRef<MediaStream | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const timerRef = useRef<number | null>(null);
  const seenRef = useRef(new Set<string>());

  useEffect(() => { peerRef.current = peer; }, [peer]);
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { incomingRef.current = incoming; }, [incoming]);
  useEffect(() => { cidRef.current = cid; }, [cid]);

  useEffect(() => {
    const find = () => setHeader(document.querySelector('.premium-chat-page section>header'));
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    localRef.current?.getTracks().forEach(t => t.stop());
    localRef.current = null;
    remoteRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    pendingIceRef.current = [];
    setActive(null);
    setIncoming(null);
    setConnected(false);
    setMuted(false);
    setCameraOff(false);
    setSpeaker(false);
  }, []);

  const loadPeer = useCallback(async (id: string) => {
    const { data } = await supabase.from('profiles').select('id,display_name,avatar_url').eq('id', id).maybeSingle();
    return data as Profile | null;
  }, []);

  const send = useCallback(async (s: Signal) => {
    const { error: e } = await supabase.from('call_signals').insert({
      call_id: s.callId,
      conversation_id: s.conversationId,
      sender_id: s.from,
      recipient_id: s.to,
      kind: s.kind,
      signal_type: s.type,
      sdp: s.sdp ?? null,
      candidate: s.candidate ?? null,
    });
    if (e) throw new Error(e.message);
  }, []);

  const receive = useCallback(async (row: any) => {
    const s: Signal = {
      callId: row.call_id,
      from: row.sender_id,
      to: row.recipient_id,
      kind: row.kind,
      type: row.signal_type,
      sdp: row.sdp || undefined,
      candidate: row.candidate || undefined,
      conversationId: row.conversation_id,
    };
    if (s.to !== profileId || s.from === profileId || !s.callId) return;
    if (row.created_at && Date.now() - new Date(row.created_at).getTime() > 60000) return;
    const key = `${s.callId}:${s.type}:${row.id}`;
    if (seenRef.current.has(key)) return;
    seenRef.current.add(key);
    try {
      if (s.type === 'offer' && s.sdp) {
        if (activeRef.current || incomingRef.current) return;
        const p = peerRef.current?.id === s.from ? peerRef.current : await loadPeer(s.from);
        if (!p) return;
        peerRef.current = p;
        setPeer(p);
        setCid(s.conversationId);
        history.replaceState({}, '', `/inbox?conversation=${encodeURIComponent(s.conversationId)}`);
        setError(null);
        setIncoming(s);
        return;
      }
      if (s.type === 'hangup' || s.type === 'reject') {
        if (activeRef.current?.id === s.callId || incomingRef.current?.callId === s.callId) cleanup();
        return;
      }
      if (s.type === 'answer' && s.sdp && activeRef.current?.id === s.callId && pcRef.current) {
        await pcRef.current.setRemoteDescription(s.sdp);
        for (const c of pendingIceRef.current.splice(0)) await pcRef.current.addIceCandidate(c);
        return;
      }
      if (s.type === 'ice' && s.candidate && (activeRef.current?.id === s.callId || incomingRef.current?.callId === s.callId)) {
        if (pcRef.current?.remoteDescription) await pcRef.current.addIceCandidate(s.candidate);
        else pendingIceRef.current.push(s.candidate);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signaling error');
    }
  }, [cleanup, loadPeer, profileId]);

  useEffect(() => {
    const channel = supabase.channel(`call-signals:${profileId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_signals', filter: `recipient_id=eq.${profileId}` }, payload => void receive(payload.new));
    channel.subscribe(status => setReady(status === 'SUBSCRIBED'));
    return () => { setReady(false); void supabase.removeChannel(channel); };
  }, [profileId, receive]);

  useEffect(() => {
    const sync = () => setCid(new URLSearchParams(location.search).get('conversation'));
    const onLocation = () => sync();
    addEventListener('popstate', sync);
    addEventListener('work-social-location', onLocation);
    sync();
    return () => { removeEventListener('popstate', sync); removeEventListener('work-social-location', onLocation); };
  }, []);

  useEffect(() => {
    let off = false;
    (async () => {
      if (!cid) { setPeer(null); return; }
      const { data } = await supabase.from('conversation_members').select('profile_id').eq('conversation_id', cid).neq('profile_id', profileId).limit(1);
      const id = data?.[0]?.profile_id;
      if (!id) return;
      const p = await loadPeer(id);
      if (!off) setPeer(p);
    })();
    return () => { off = true; };
  }, [cid, profileId, loadPeer]);

  const setup = async (kind: Kind, id: string, offer?: RTCSessionDescriptionInit) => {
    const p = peerRef.current;
    const conversationId = cidRef.current;
    if (!p || !conversationId) throw new Error('Contact unavailable');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Calling requires HTTPS and microphone/camera permission');

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === 'video' });
    localRef.current = stream;
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;
    remoteRef.current = new MediaStream();
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.ontrack = event => {
      remoteRef.current = event.streams[0] || remoteRef.current!;
      if (remoteVideoRef.current) { remoteVideoRef.current.srcObject = remoteRef.current; void remoteVideoRef.current.play().catch(() => undefined); }
      if (remoteAudioRef.current) { remoteAudioRef.current.srcObject = remoteRef.current; void remoteAudioRef.current.play().catch(() => undefined); }
      setConnected(true);
    };
    pc.onicecandidate = event => {
      if (event.candidate) void send({ callId: id, from: profileId, to: p.id, kind, type: 'ice', candidate: event.candidate.toJSON(), conversationId }).catch(e => setError(e instanceof Error ? e.message : 'ICE signaling failed'));
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') { setConnected(true); setError(null); if (timerRef.current) window.clearTimeout(timerRef.current); }
      else if (pc.connectionState === 'failed') setError('Call connection failed. Network/ICE could not establish a peer connection.');
      else if (pc.connectionState === 'disconnected') setError('Call network disconnected. Trying to recover…');
    };

    if (offer) await pc.setRemoteDescription(offer);
    for (const c of pendingIceRef.current.splice(0)) await pc.addIceCandidate(c);
    if (kind === 'video' && localVideoRef.current) localVideoRef.current.srcObject = stream;

    if (!offer) {
      const o = await pc.createOffer();
      await pc.setLocalDescription(o);
      await send({ callId: id, from: profileId, to: p.id, kind, type: 'offer', sdp: o, conversationId });
    }
  };

  const start = async (kind: Kind) => {
    if (!peer || !cid || activeRef.current || incomingRef.current || !ready) return;
    const id = crypto.randomUUID();
    setError(null);
    setActive({ id, kind, outgoing: true });
    try {
      await setup(kind, id);
      timerRef.current = window.setTimeout(() => {
        if (activeRef.current?.id === id && !pcRef.current || (pcRef.current && pcRef.current.connectionState !== 'connected')) {
          setError('No connection established. Please try the call again.');
          cleanup();
        }
      }, 45000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start call');
      cleanup();
    }
  };

  const accept = async () => {
    const s = incomingRef.current;
    if (!s) return;
    setIncoming(null);
    setActive({ id: s.callId, kind: s.kind, outgoing: false });
    try {
      await setup(s.kind, s.callId, s.sdp);
      const pc = pcRef.current;
      if (!pc) throw new Error('Connection unavailable');
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await send({ callId: s.callId, from: profileId, to: s.from, kind: s.kind, type: 'answer', sdp: answer, conversationId: s.conversationId });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not accept call');
      cleanup();
    }
  };

  const decline = async () => {
    const s = incomingRef.current;
    if (s) await send({ ...s, from: profileId, to: s.from, type: 'reject' }).catch(() => undefined);
    setIncoming(null);
  };

  const hangup = async () => {
    const a = activeRef.current;
    const p = peerRef.current;
    const conversationId = cidRef.current;
    if (a && p && conversationId) await send({ callId: a.id, from: profileId, to: p.id, kind: a.kind, type: 'hangup', conversationId }).catch(() => undefined);
    cleanup();
  };

  const mute = () => { const tracks = localRef.current?.getAudioTracks() || []; if (tracks.length) { const on = !tracks.every(t => t.enabled); tracks.forEach(t => { t.enabled = on; }); setMuted(!on); } };
  const camera = () => { const tracks = localRef.current?.getVideoTracks() || []; if (tracks.length) { const on = !tracks.every(t => t.enabled); tracks.forEach(t => { t.enabled = on; }); setCameraOff(!on); } };
  const toggleSpeaker = () => { setSpeaker(v => !v); if (remoteAudioRef.current && 'setSinkId' in remoteAudioRef.current) { const audio = remoteAudioRef.current as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }; void audio.setSinkId('').catch(() => undefined); } };

  useEffect(() => () => cleanup(), [cleanup]);
  if (!cid || !peer) return null;
  const name = peer.display_name?.trim() || 'Contact';
  const toolbar = <div className="inbox-call-toolbar"><button aria-label="Start voice call" onClick={() => void start('audio')} disabled={!ready || !!active || !!incoming}><Icon t="phone" /></button><button aria-label="Start video call" onClick={() => void start('video')} disabled={!ready || !!active || !!incoming}><Icon t="video" /></button></div>;

  return <>
    <style>{`.inbox-call-toolbar{position:absolute;top:50%;right:10px;z-index:8;transform:translateY(-50%);display:flex;gap:5px;padding:3px;border-radius:12px;background:rgba(255,255,255,.82);box-shadow:0 4px 12px rgba(15,23,42,.08);backdrop-filter:blur(8px)}.inbox-call-toolbar button{width:34px;height:34px;border:1px solid rgba(109,93,252,.14);border-radius:10px;background:#fff;font-size:16px}.inbox-call-toolbar button:disabled{opacity:.55}.inbox-call-stage{position:fixed;inset:0;z-index:5000;display:flex;align-items:center;justify-content:center;padding:8px;background:#020617dd}.inbox-call-card{width:min(820px,calc(100vw - 12px));max-height:calc(100vh - 12px);overflow:hidden;border-radius:20px;background:#0b1220;color:#fff}.inbox-call-media{height:min(54vh,500px);min-height:260px;position:relative;background:#020617;display:grid;place-items:center}.inbox-call-media video{width:100%;height:100%;object-fit:contain}.inbox-call-local{position:absolute!important;right:10px;top:10px;width:120px!important;height:82px!important;object-fit:cover!important;border-radius:12px}.inbox-call-info{display:flex;align-items:center;justify-content:space-between;padding:9px 11px calc(10px + env(safe-area-inset-bottom))}.inbox-call-actions{display:flex;gap:6px}.inbox-call-actions button{width:42px;height:42px;border:0;border-radius:50%;background:#334155;color:#fff;font-size:17px}.inbox-call-actions .end{background:#ef4444}.inbox-call-actions .active{background:#2563eb}.inbox-incoming{text-align:center;padding:26px}.inbox-incoming img{width:70px;height:70px;border-radius:50%;object-fit:cover}.inbox-incoming-actions{display:flex;justify-content:center;gap:8px}.inbox-incoming-actions button{padding:11px 24px;border:0;border-radius:12px;color:#fff;font-weight:800}.accept{background:#22c55e}.decline{background:#ef4444}@media(max-width:767px){.inbox-call-toolbar{right:7px}.inbox-call-toolbar button{width:31px;height:31px}.inbox-call-stage{padding:0}.inbox-call-card{width:calc(100vw - 8px)}.inbox-call-media{height:calc(100vh - 125px);min-height:230px}.inbox-call-local{width:100px!important;height:70px!important}}`}</style>
    {header && createPortal(toolbar, header)}
    {incoming && <div className="inbox-call-stage"><div className="inbox-call-card"><div className="inbox-incoming"><img src={peer.avatar_url || ''} alt=""/><h3>{name}</h3><p>Incoming {incoming.kind === 'video' ? 'video' : 'voice'} call</p><div className="inbox-incoming-actions"><button className="decline" onClick={() => void decline()}>Decline</button><button className="accept" onClick={() => void accept()}>Accept</button></div></div></div></div>}
    {active && <div className="inbox-call-stage"><div className="inbox-call-card"><div className="inbox-call-media">{active.kind === 'video' ? <><video ref={remoteVideoRef} autoPlay playsInline/><video ref={localVideoRef} className="inbox-call-local" autoPlay muted playsInline/></> : <><audio ref={remoteAudioRef} autoPlay/><Icon t="phone"/></>}</div><div className="inbox-call-info"><div><b>{name}</b><small style={{ display: 'block', color: '#94a3b8' }}>{connected ? 'Connected' : 'Connecting…'} · {active.kind === 'video' ? 'Video' : 'Voice'}</small></div><div className="inbox-call-actions"><button className={muted ? 'active' : ''} onClick={mute}><Icon t="mic"/></button>{active.kind === 'video' && <button className={cameraOff ? 'active' : ''} onClick={camera}><Icon t="camera"/></button>}<button className={speaker ? 'active' : ''} onClick={toggleSpeaker}><Icon t="speaker"/></button><button className="end" onClick={() => void hangup()}><Icon t="end"/></button></div></div>{error && <small style={{ display: 'block', padding: '0 12px 10px', color: '#fecaca' }}>{error}</small>}</div></div>}
  </>;
}
