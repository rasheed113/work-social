import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

type NotificationRow = {
  id: string;
  receiver_id: string;
  sender_id: string;
  type: string;
  post_id: string | null;
  comment_id: string | null;
  is_read: boolean;
  created_at: string;
  metadata: Record<string, unknown> | null;
  sender?: { display_name: string | null; username: string | null; avatar_url: string | null };
};

const labels: Record<string, string> = {
  friend_request: 'sent you a friend request',
  friend_request_accepted: 'accepted your friend request',
  like: 'liked your post',
  comment: 'commented on your post',
  comment_reply: 'replied to your comment',
  mention_post: 'mentioned you in a post',
  mention_comment: 'mentioned you in a comment',
  follow: 'started following you',
};

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

export function NotificationsPage() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) { setError(authError?.message ?? 'You must be signed in.'); setLoading(false); return; }

    const { data, error: notificationError } = await supabase
      .from('notifications')
      .select('id, receiver_id, sender_id, type, post_id, comment_id, is_read, created_at, metadata')
      .eq('receiver_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (notificationError) { setError(notificationError.message); setLoading(false); return; }

    const rows = (data ?? []) as NotificationRow[];
    const senderIds = [...new Set(rows.map((row) => row.sender_id).filter(Boolean))];
    let senderMap = new Map<string, { display_name: string | null; username: string | null; avatar_url: string | null }>();
    if (senderIds.length) {
      const { data: senders, error: senderError } = await supabase.from('profiles').select('id, display_name, username, avatar_url').in('id', senderIds);
      if (senderError) { setError(senderError.message); setLoading(false); return; }
      senderMap = new Map((senders ?? []).map((sender: any) => [sender.id, sender]));
    }
    setItems(rows.map((row) => ({ ...row, sender: senderMap.get(row.sender_id) })));
    setLoading(false);
  };

  useEffect(() => {
    void load();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted || !data.user) return;
      channel = supabase.channel(`notifications:${data.user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `receiver_id=eq.${data.user.id}` }, () => void load())
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `receiver_id=eq.${data.user.id}` }, () => void load())
        .subscribe();
    });
    return () => { mounted = false; if (channel) void supabase.removeChannel(channel); };
  }, []);

  const markRead = async (id: string) => {
    const { error: updateError } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    if (updateError) return setError(updateError.message);
    setItems((current) => current.map((item) => item.id === id ? { ...item, is_read: true } : item));
  };

  const markAllRead = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { error: updateError } = await supabase.from('notifications').update({ is_read: true }).eq('receiver_id', auth.user.id).eq('is_read', false);
    if (updateError) return setError(updateError.message);
    setItems((current) => current.map((item) => ({ ...item, is_read: true })));
  };

  return <main>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <h1>Notifications</h1>
      <button type="button" onClick={() => void markAllRead()} disabled={!items.some((item) => !item.is_read)}>Mark all read</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {loading && <p>Loading notifications…</p>}
    {!loading && !error && items.length === 0 && <p>No notifications yet.</p>}
    {!loading && items.map((item) => <article key={item.id} onClick={() => void markRead(item.id)} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, marginTop: 10, border: '1px solid rgba(0,0,0,.12)', borderRadius: 12, background: item.is_read ? 'white' : 'rgba(0,0,0,.04)', cursor: item.is_read ? 'default' : 'pointer' }}>
      {item.sender?.avatar_url ? <img src={item.sender.avatar_url} alt="" width={44} height={44} style={{ borderRadius: '50%', objectFit: 'cover' }} /> : <div aria-hidden="true" style={{ width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#eee' }}>👤</div>}
      <div style={{ flex: 1 }}><strong>{item.sender?.display_name ?? item.sender?.username ?? 'Someone'}</strong>{' '}{labels[item.type] ?? 'sent you a notification'}<div><small>{formatTime(item.created_at)}</small></div></div>
      {!item.is_read && <span aria-label="Unread">●</span>}
    </article>)}
  </main>;
}
