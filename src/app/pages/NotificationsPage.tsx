import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

type NotificationRow = {
  id: string; receiver_id: string; sender_id: string; type: string; post_id: string | null; comment_id: string | null;
  is_read: boolean; created_at: string; metadata: Record<string, unknown> | null;
  sender?: { display_name: string | null; username: string | null; avatar_url: string | null };
};

const labels: Record<string, string> = {
  friend_request: 'sent you a friend request', friend_accept: 'accepted your friend request', like: 'liked your post', comment: 'commented on your post',
  comment_reply: 'replied to your comment', mention_post: 'mentioned you in a post', mention_comment: 'mentioned you in a comment', follow: 'started following you', message: 'sent you a message',
};
const typeIcons: Record<string, string> = {
  friend_request: '👥', friend_accept: '🤝', like: '❤️', comment: '💬', comment_reply: '↩️', mention_post: '@', mention_comment: '@', follow: '✨', message: '💌',
};
function formatTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(); }
function openNotificationTarget(item: NotificationRow) {
  if (item.post_id) {
    const params = new URLSearchParams({ post: item.post_id }); if (item.comment_id) params.set('comment', item.comment_id);
    window.sessionStorage.setItem('work-social:notification-target', JSON.stringify({ postId: item.post_id, commentId: item.comment_id, type: item.type }));
    window.history.pushState({}, '', `/?${params.toString()}`); window.dispatchEvent(new PopStateEvent('popstate')); return;
  }
  if (item.type === 'follow' || item.type === 'friend_request' || item.type === 'friend_accept') { window.history.pushState({}, '', '/friends'); window.dispatchEvent(new PopStateEvent('popstate')); return; }
  if (item.type === 'message') {
    const conversationId = typeof item.metadata?.conversation_id === 'string' ? item.metadata.conversation_id : null;
    window.history.pushState({}, '', conversationId ? `/inbox?conversation=${encodeURIComponent(conversationId)}` : '/inbox'); window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

export function NotificationsPage() {
  const [items, setItems] = useState<NotificationRow[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true); setError(null); const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) { setError(authError?.message ?? 'You must be signed in.'); setLoading(false); return; }
    const { data, error: notificationError } = await supabase.from('notifications').select('id, receiver_id, sender_id, type, post_id, comment_id, is_read, created_at, metadata').eq('receiver_id', auth.user.id).order('created_at', { ascending: false }).limit(100);
    if (notificationError) { setError(notificationError.message); setLoading(false); return; }
    const rows = (data ?? []) as NotificationRow[]; const senderIds = [...new Set(rows.map((row) => row.sender_id).filter(Boolean))]; let senderMap = new Map<string, { display_name: string | null; username: string | null; avatar_url: string | null }>();
    if (senderIds.length) { const { data: senders, error: senderError } = await supabase.from('profiles').select('id, display_name, username, avatar_url').in('id', senderIds); if (senderError) { setError(senderError.message); setLoading(false); return; } senderMap = new Map((senders ?? []).map((sender: any) => [sender.id, sender])); }
    setItems(rows.map((row) => ({ ...row, sender: senderMap.get(row.sender_id) }))); setLoading(false);
  };
  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let recoveryTimer: number | null = null;
    let recoveryRunning = false;
    const recentLimit = 100;

    const mergeItems = (rows: NotificationRow[]) => {
      if (!rows.length || !mounted) return;
      setItems(current => {
        const map = new Map(current.map(item => [item.id, item]));
        for (const row of rows) {
          const existing = map.get(row.id);
          map.set(row.id, existing ? { ...existing, ...row } : row);
        }
        return [...map.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
      });
    };

    const hydrateSenders = async (rows: NotificationRow[]) => {
      const ids = [...new Set(rows.map(row => row.sender_id).filter(Boolean))];
      if (!ids.length || !mounted) return;
      const { data, error } = await supabase.from('profiles').select('id, display_name, username, avatar_url').in('id', ids);
      if (error || !data?.length || !mounted) return;
      const senderMap = new Map((data as any[]).map(sender => [sender.id, sender]));
      setItems(current => current.map(item => senderMap.has(item.sender_id) ? { ...item, sender: senderMap.get(item.sender_id) } : item));
    };

    const syncRecent = async () => {
      if (!mounted || recoveryRunning) return;
      recoveryRunning = true;
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user || !mounted) return;
        const { data, error } = await supabase.from('notifications').select('id, receiver_id, sender_id, type, post_id, comment_id, is_read, created_at, metadata').eq('receiver_id', auth.user.id).order('created_at', { ascending: false }).limit(recentLimit);
        if (error || !mounted) return;
        const rows = (data ?? []) as NotificationRow[];
        mergeItems(rows);
        await hydrateSenders(rows);
      } finally {
        recoveryRunning = false;
      }
    };

    const handleNotification = (payload: any) => {
      if (!mounted) return;
      const event = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
      const row = ((event === 'DELETE' ? payload.old : payload.new) ?? null) as NotificationRow | null;
      if (!row?.id) return;
      if (event !== 'DELETE' && row.receiver_id !== payload.new?.receiver_id) return;
      if (event === 'DELETE') {
        setItems(current => current.filter(item => item.id !== row.id));
        return;
      }
      mergeItems([row]);
      void hydrateSenders([row]);
    };

    const recover = () => {
      if (!mounted) return;
      if (!supabase.realtime.isConnected()) supabase.realtime.connect();
      if (recoveryTimer !== null) window.clearTimeout(recoveryTimer);
      recoveryTimer = window.setTimeout(() => { recoveryTimer = null; void syncRecent(); }, 250);
    };

    const subscribe = (userId: string) => {
      if (!mounted) return;
      if (channel) void supabase.removeChannel(channel);
      channel = supabase.channel(`notifications:${userId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `receiver_id=eq.${userId}` }, handleNotification)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `receiver_id=eq.${userId}` }, handleNotification)
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications' }, handleNotification)
        .subscribe(status => {
          if (status === 'SUBSCRIBED') void syncRecent();
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') recover();
        });
    };

    void load();
    supabase.auth.getUser().then(({ data }) => { if (mounted && data.user) subscribe(data.user.id); });

    const onVisibility = () => { if (document.visibilityState === 'visible') recover(); };
    const onFocus = () => recover();
    const onOnline = () => recover();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      if (recoveryTimer !== null) window.clearTimeout(recoveryTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);
  const markRead = async (id: string) => { const { error: updateError } = await supabase.from('notifications').update({ is_read: true }).eq('id', id); if (updateError) return setError(updateError.message); setItems((current) => current.map((item) => item.id === id ? { ...item, is_read: true } : item)); };
  const handleNotificationClick = async (item: NotificationRow) => { await markRead(item.id); openNotificationTarget(item); };
  const markAllRead = async () => { const { data: auth } = await supabase.auth.getUser(); if (!auth.user) return; const { error: updateError } = await supabase.from('notifications').update({ is_read: true }).eq('receiver_id', auth.user.id).eq('is_read', false); if (updateError) return setError(updateError.message); setItems((current) => current.map((item) => ({ ...item, is_read: true }))); };
  const unreadCount = items.filter((item) => !item.is_read).length;

  return <main style={{ minWidth: 0 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, padding: '10px 2px 12px', borderBottom: '1px solid rgba(92,92,180,.10)' }}>
      <div style={{ minWidth: 0 }}><h1 style={{ margin: 0, letterSpacing: '-0.035em', fontSize: 'clamp(25px, 7vw, 34px)', fontWeight: 850, background: 'linear-gradient(135deg, #17152d 0%, #4f46e5 52%, #2563eb 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Notifications</h1><div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 7, padding: '4px 9px', borderRadius: 999, background: unreadCount ? 'rgba(79,70,229,.09)' : 'rgba(34,197,94,.09)', border: unreadCount ? '1px solid rgba(79,70,229,.13)' : '1px solid rgba(34,197,94,.13)', color: unreadCount ? '#4f46e5' : '#16803c', fontSize: 12, fontWeight: 750 }}><span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: unreadCount ? '#4f46e5' : '#22c55e', boxShadow: unreadCount ? '0 0 0 3px rgba(79,70,229,.10)' : '0 0 0 3px rgba(34,197,94,.10)' }} />{unreadCount ? `${unreadCount} unread` : 'All caught up'}</div></div>
      <button type="button" onClick={() => void markAllRead()} disabled={!unreadCount} style={{ border: 0, borderRadius: 999, padding: '8px 13px', fontWeight: 700, background: unreadCount ? 'linear-gradient(135deg, #6d5dfc, #3b82f6)' : 'rgba(0,0,0,.07)', color: unreadCount ? 'white' : 'rgba(0,0,0,.45)', boxShadow: unreadCount ? '0 5px 16px rgba(76,92,220,.24)' : 'none', cursor: unreadCount ? 'pointer' : 'default' }}>Mark all read</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {loading && <p>Loading notifications…</p>}
    {!loading && !error && items.length === 0 && <div style={{ padding: 22, textAlign: 'center', border: '1px solid rgba(0,0,0,.08)', borderRadius: 18, background: 'linear-gradient(145deg, rgba(255,255,255,.96), rgba(245,247,255,.9))', boxShadow: '0 10px 28px rgba(0,0,0,.06)' }}><div style={{ fontSize: 30 }}>🔔</div><strong>No notifications yet.</strong><p style={{ margin: '6px 0 0', opacity: .62 }}>Activity from your community will appear here.</p></div>}
    {!loading && items.map((item) => {
      const icon = typeIcons[item.type] ?? '🔔';
      return <article key={item.id} onClick={() => void handleNotificationClick(item)} style={{ display: 'flex', gap: 11, alignItems: 'center', minWidth: 0, padding: 11, marginTop: 9, border: item.is_read ? '1px solid rgba(0,0,0,.08)' : '1px solid rgba(91,91,245,.22)', borderRadius: 15, background: item.is_read ? 'rgba(255,255,255,.88)' : 'linear-gradient(135deg, rgba(245,247,255,.98), rgba(255,255,255,.98))', boxShadow: item.is_read ? '0 5px 16px rgba(0,0,0,.045)' : '0 7px 20px rgba(80,82,190,.10)', cursor: 'pointer', transition: 'transform .18s ease, box-shadow .18s ease' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {item.sender?.avatar_url ? <img src={item.sender.avatar_url} alt="" width={43} height={43} style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid white', boxShadow: '0 3px 10px rgba(0,0,0,.12)' }} /> : <div aria-hidden="true" style={{ width: 43, height: 43, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #e9e7ff, #dbeafe)', fontSize: 19 }}>👤</div>}
          <span aria-hidden="true" style={{ position: 'absolute', right: -3, bottom: -2, width: 21, height: 21, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'white', boxShadow: '0 2px 7px rgba(0,0,0,.13)', fontSize: 11 }}>{icon}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.35 }}><div><strong>{item.sender?.display_name ?? item.sender?.username ?? 'Someone'}</strong>{' '}{labels[item.type] ?? 'sent you a notification'}</div><small style={{ display: 'block', marginTop: 3, opacity: .55 }}>{formatTime(item.created_at)}</small></div>
        {!item.is_read && <span aria-label="Unread" style={{ width: 8, height: 8, flexShrink: 0, borderRadius: '50%', background: '#4f46e5', boxShadow: '0 0 0 4px rgba(79,70,229,.10)' }} />}
      </article>;
    })}
  </main>;
}
