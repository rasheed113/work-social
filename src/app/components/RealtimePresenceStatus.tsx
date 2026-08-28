import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase/client';

type Profile = { id: string; display_name: string | null };
type PresenceEntry = { userId?: string; profile_id?: string; user_id?: string; online_at?: string };

const PRESENCE_CHANNEL = 'work-social-presence';

export function RealtimePresenceStatus({ profileId }: { profileId: string }) {
  const [peer, setPeer] = useState<Profile | null>(null);
  const [online, setOnline] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const conversationId = useMemo(() => new URLSearchParams(window.location.search).get('conversation'), []);

  useEffect(() => {
    let cancelled = false;
    const updateHost = () => {
      if (!cancelled) setHost(document.querySelector('.inbox-call-actions'));
    };
    updateHost();
    const observer = new MutationObserver(updateHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { cancelled = true; observer.disconnect(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadPeer = async () => {
      try {
        if (!conversationId) { if (!cancelled) setPeer(null); return; }
        const { data, error } = await supabase
          .from('conversation_members')
          .select('profile_id')
          .eq('conversation_id', conversationId)
          .neq('profile_id', profileId)
          .limit(1);
        if (cancelled || error) return;
        const peerId = data?.[0]?.profile_id;
        if (!peerId) { setPeer(null); return; }
        setPeer({ id: peerId, display_name: null });
      } catch { if (!cancelled) setPeer(null); }
    };
    void loadPeer();
    return () => { cancelled = true; };
  }, [conversationId, profileId]);

  useEffect(() => {
    if (!peer?.id || !profileId) { setOnline(false); return; }
    let disposed = false;
    const channel = supabase.channel(PRESENCE_CHANNEL, { config: { presence: { key: profileId } } });

    const sync = () => {
      if (disposed) return;
      try {
        const state = channel.presenceState<PresenceEntry>();
        const entries = Object.entries(state).flatMap(([key, values]) =>
          values.map((entry) => ({ ...entry, __key: key }))
        );
        setOnline(entries.some((entry) =>
          entry.__key === peer.id ||
          entry.userId === peer.id ||
          entry.profile_id === peer.id ||
          entry.user_id === peer.id
        ));
      } catch { setOnline(false); }
    };

    channel
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync)
      .subscribe((status) => {
        if (disposed) return;
        if (status !== 'SUBSCRIBED') { setOnline(false); return; }
        void channel.track({ userId: profileId, profile_id: profileId, online_at: new Date().toISOString() })
          .then(() => sync())
          .catch(() => { if (!disposed) setOnline(false); });
      });

    return () => { disposed = true; setOnline(false); void supabase.removeChannel(channel).catch(() => undefined); };
  }, [peer?.id, profileId]);

  if (!host) return null;
  return createPortal(
    <span className="realtime-presence-status" aria-label={online ? 'Online' : 'Offline'}>
      <span className={`realtime-presence-dot${online ? ' online' : ''}`} />
      {online ? 'Online' : 'Offline'}
    </span>,
    host,
  );
}
