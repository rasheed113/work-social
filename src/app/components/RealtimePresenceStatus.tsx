import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase/client';

type Profile = { id: string; display_name: string | null };
type PresenceEntry = { userId?: string; online_at?: string };

const PRESENCE_CHANNEL = 'work-social-presence';

export function RealtimePresenceStatus({ profileId }: { profileId: string }) {
  const [peer, setPeer] = useState<Profile | null>(null);
  const [online, setOnline] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);

  const conversationId = useMemo(() => new URLSearchParams(window.location.search).get('conversation'), []);

  useEffect(() => {
    const updateHost = () => setHost(document.querySelector('.inbox-call-actions'));
    updateHost();
    const observer = new MutationObserver(updateHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadPeer = async () => {
      if (!conversationId) { setPeer(null); return; }
      const { data, error } = await supabase
        .from('conversation_members')
        .select('profile_id')
        .eq('conversation_id', conversationId)
        .neq('profile_id', profileId)
        .limit(1);
      if (cancelled || error) { setPeer(null); return; }
      const peerId = data?.[0]?.profile_id;
      setPeer(peerId ? { id: peerId, display_name: null } : null);
    };
    void loadPeer();
    return () => { cancelled = true; };
  }, [conversationId, profileId]);

  useEffect(() => {
    if (!peer) { setOnline(false); return; }

    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { private: true, presence: { key: profileId } },
    });

    const sync = () => {
      const state = channel.presenceState<PresenceEntry>();
      const entries = Object.values(state).flat();
      setOnline(entries.some((entry) => entry.userId === peer.id));
    };

    channel
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') sync();
      });

    return () => {
      setOnline(false);
      void supabase.removeChannel(channel);
    };
  }, [peer?.id, profileId]);

  useEffect(() => {
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { private: true, presence: { key: profileId } },
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          userId: profileId,
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => { void supabase.removeChannel(channel); };
  }, [profileId]);

  if (!host) return null;

  return createPortal(
    <>
      <style>{`.inbox-call-actions>.call-presence,.inbox-call-actions>.call-presence-label{display:none!important}.realtime-presence-status{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;color:#64748b}.realtime-presence-dot{width:8px;height:8px;border-radius:50%;background:#94a3b8}.realtime-presence-dot.online{background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.13),0 0 10px rgba(34,197,94,.35)}.inbox-call-stage:has(.inbox-call-local){padding:0!important}.inbox-call-stage:has(.inbox-call-local) .inbox-call-card{width:min(1180px,100vw)!important;height:min(94vh,920px)!important;border-radius:22px}.inbox-call-stage:has(.inbox-call-local) .inbox-call-videos{height:calc(100% - 86px);aspect-ratio:auto!important}.inbox-call-stage:has(.inbox-call-local) .inbox-call-videos video{object-fit:contain;background:#020617}`}</style>
      <span className="realtime-presence-status" aria-label={online ? 'Online' : 'Offline'}>
        <span className={`realtime-presence-dot${online ? ' online' : ''}`} />
        {online ? 'Online' : 'Offline'}
      </span>
    </>,
    host,
  );
}
