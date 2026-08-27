import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { navigate } from '../Router';

const styles = {
  page: {
    width: '100%', maxWidth: 920, margin: '0 auto', padding: '18px 16px 96px', boxSizing: 'border-box', color: '#f7f8ff',
  } as React.CSSProperties,
  hero: {
    position: 'relative', overflow: 'hidden', borderRadius: 26, padding: '24px 22px', marginBottom: 18,
    background: 'linear-gradient(135deg, #171a3a 0%, #20265c 48%, #5d2ca8 100%)',
    boxShadow: '0 20px 55px rgba(31, 25, 91, .32), inset 0 1px 0 rgba(255,255,255,.14)',
    border: '1px solid rgba(255,255,255,.12)',
  } as React.CSSProperties,
  glow: { position: 'absolute', width: 180, height: 180, borderRadius: '50%', right: -70, top: -80, background: 'rgba(89, 211, 255, .22)', filter: 'blur(18px)', pointerEvents: 'none' } as React.CSSProperties,
  title: { margin: 0, fontSize: 30, lineHeight: 1.05, fontWeight: 900, letterSpacing: '-.04em', textShadow: '0 3px 14px rgba(0,0,0,.28)' } as React.CSSProperties,
  subtitle: { margin: '8px 0 0', color: 'rgba(255,255,255,.72)', fontSize: 14 } as React.CSSProperties,
  searchWrap: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, padding: '11px 14px', borderRadius: 17, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.14)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08)' } as React.CSSProperties,
  search: { flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', color: '#fff', fontSize: 15 } as React.CSSProperties,
  section: { marginTop: 16, padding: 16, borderRadius: 22, background: 'linear-gradient(180deg, rgba(255,255,255,.98), rgba(246,247,255,.98))', color: '#17182b', border: '1px solid rgba(99,102,241,.12)', boxShadow: '0 14px 36px rgba(24,25,60,.12)' } as React.CSSProperties,
  sectionTitle: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '0 0 12px', fontSize: 17, fontWeight: 850 } as React.CSSProperties,
  row: { display: 'flex', alignItems: 'center', gap: 9, padding: 11, marginTop: 8, borderRadius: 17, background: '#fff', border: '1px solid rgba(30,35,80,.08)', boxShadow: '0 7px 20px rgba(30,35,80,.07)', transition: 'transform .18s ease, box-shadow .18s ease', minWidth: 0 } as React.CSSProperties,
  avatar: { width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid rgba(111,76,255,.18)', boxShadow: '0 5px 14px rgba(75,62,150,.16)' } as React.CSSProperties,
  avatarFallback: { width: 48, height: 48, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#eef0ff,#dfe4ff)', flexShrink: 0, fontSize: 20, boxShadow: '0 5px 14px rgba(75,62,150,.12)' } as React.CSSProperties,
  nameButton: { flex: 1, minWidth: 0, border: 0, background: 'transparent', textAlign: 'left', padding: 0, cursor: 'pointer', color: '#17182b', fontSize: 15, overflow: 'hidden' } as React.CSSProperties,
  buttonBase: { border: 0, borderRadius: 11, padding: '7px 9px', fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, lineHeight: 1.2 } as React.CSSProperties,
  follow: { background: '#eef0ff', color: '#4c3acb' } as React.CSSProperties,
  add: { background: 'linear-gradient(135deg,#6547ff,#8b4dff)', color: '#fff', boxShadow: '0 6px 14px rgba(101,71,255,.22)' } as React.CSSProperties,
  pending: { background: '#f1f2f6', color: '#666b7c' } as React.CSSProperties,
  friend: { background: 'linear-gradient(135deg,#dff9ed,#c9f3df)', color: '#147447' } as React.CSSProperties,
  accept: { background: 'linear-gradient(135deg,#18a86b,#39c98b)', color: '#fff', boxShadow: '0 6px 14px rgba(24,168,107,.2)' } as React.CSSProperties,
  reject: { background: '#f2f3f7', color: '#626777' } as React.CSSProperties,
  alert: { margin: '12px 0 0', padding: '10px 12px', borderRadius: 13, background: '#fff0f2', color: '#b4233c', border: '1px solid #ffd3da' } as React.CSSProperties,
  empty: { padding: '24px 10px', textAlign: 'center', color: '#777b8d' } as React.CSSProperties,
} satisfies Record<string, React.CSSProperties>;

export function FriendsPage() {
  const [me, setMe] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [pendingRequestIds, setPendingRequestIds] = useState<Record<string, string>>({});
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError) { setError(authError.message); setLoading(false); return; }
    const userId = auth.user?.id ?? null; setMe(userId);
    if (!userId) { setLoading(false); return; }
    const [{ data: people, error: peopleError }, { data: incoming, error: incomingError }, { data: outgoing, error: outgoingError }, { data: friendships, error: friendsError }, { data: follows, error: followsError }] = await Promise.all([
      supabase.from('profiles').select('id, display_name, avatar_url').neq('id', userId).order('display_name', { ascending: true }),
      supabase.from('friend_requests').select('id, sender_id, status').eq('receiver_id', userId).eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('friend_requests').select('id, receiver_id').eq('sender_id', userId).eq('status', 'pending'),
      supabase.from('friends').select('profile_a_id, profile_b_id').or(`profile_a_id.eq.${userId},profile_b_id.eq.${userId}`),
      supabase.from('follows').select('following_id').eq('follower_id', userId),
    ]);
    const firstError = peopleError ?? incomingError ?? outgoingError ?? friendsError ?? followsError;
    if (firstError) { setError(firstError.message); setLoading(false); return; }
    const requestMap: Record<string, string> = {};
    (outgoing ?? []).forEach((r: any) => { requestMap[r.receiver_id] = r.id; });
    setProfiles(people ?? []); setRequests(incoming ?? []); setPendingRequestIds(requestMap); setPendingIds(new Set(Object.keys(requestMap)));
    setFriendIds(new Set((friendships ?? []).map((f: any) => f.profile_a_id === userId ? f.profile_b_id : f.profile_a_id)));
    setFollowingIds(new Set((follows ?? []).map((f: any) => f.following_id)));
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? profiles.filter((p) => `${p.display_name ?? ''}`.toLowerCase().includes(q)) : profiles;
  }, [profiles, search]);

  const sendRequest = async (receiverId: string) => {
    if (!me || friendIds.has(receiverId) || pendingIds.has(receiverId)) return;
    const { data, error: e } = await supabase.from('friend_requests').insert({ sender_id: me, receiver_id: receiverId, status: 'pending' }).select('id').single();
    if (e) return setError(e.message);
    setPendingIds((s) => new Set(s).add(receiverId));
    setPendingRequestIds((m) => ({ ...m, [receiverId]: data.id }));
  };

  const cancelRequest = async (receiverId: string) => {
    if (!me) return;
    const requestId = pendingRequestIds[receiverId];
    if (!requestId) return;
    const { error: e } = await supabase.from('friend_requests').delete().eq('id', requestId).eq('sender_id', me).eq('receiver_id', receiverId).eq('status', 'pending');
    if (e) return setError(e.message);
    setPendingIds((s) => { const next = new Set(s); next.delete(receiverId); return next; });
    setPendingRequestIds((m) => { const next = { ...m }; delete next[receiverId]; return next; });
  };

  const respond = async (request: any, status: 'accepted' | 'rejected') => {
    if (!me) return;
    const { error: e } = await supabase.from('friend_requests').update({ status }).eq('id', request.id).eq('receiver_id', me);
    if (e) return setError(e.message);
    setRequests((current) => current.filter((r) => r.id !== request.id));
    if (status === 'accepted') {
      const [a, b] = [me, request.sender_id].sort();
      const { error: friendError } = await supabase.from('friends').insert({ profile_a_id: a, profile_b_id: b });
      if (friendError) setError(friendError.message);
      else setFriendIds((s) => new Set(s).add(request.sender_id));
    }
  };

  const toggleFollow = async (targetId: string) => {
    if (!me) return;
    const isFollowing = followingIds.has(targetId);
    const result = isFollowing
      ? await supabase.from('follows').delete().eq('follower_id', me).eq('following_id', targetId)
      : await supabase.from('follows').insert({ follower_id: me, following_id: targetId });
    if (result.error) return setError(result.error.message);
    setFollowingIds((current) => { const next = new Set(current); if (isFollowing) next.delete(targetId); else next.add(targetId); return next; });
  };

  return (
    <main style={{ minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
      <div style={styles.page}>
        <section style={styles.hero}>
          <div style={styles.glow} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '.16em', textTransform: 'uppercase', color: '#8de7ff' }}>WORK SOCIAL</div>
            <h1 style={styles.title}>Friends</h1>
            <p style={styles.subtitle}>Connect with people, manage requests and build your circle.</p>
            <div style={styles.searchWrap}>
              <span aria-hidden="true" style={{ fontSize: 18 }}>⌕</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people..." aria-label="Search people" style={styles.search} />
              {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search" style={{ border: 0, background: 'rgba(255,255,255,.12)', color: '#fff', borderRadius: 9, width: 30, height: 30, cursor: 'pointer' }}>×</button>}
            </div>
          </div>
        </section>

        {error && <p role="alert" style={styles.alert}>{error}</p>}

        {loading && <section style={styles.section}><div style={styles.empty}>Loading your social circle…</div></section>}

        {!loading && requests.length > 0 && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}><span>🤝 Friend Requests</span><span style={{ fontSize: 12, padding: '5px 9px', borderRadius: 999, background: '#eeeaff', color: '#5b42c7' }}>{requests.length}</span></h2>
            {requests.map((request) => {
              const sender = profiles.find((p) => p.id === request.sender_id);
              return <article key={request.id} style={styles.row}>
                {sender?.avatar_url ? <img src={sender.avatar_url} alt="" style={styles.avatar} /> : <div aria-hidden="true" style={styles.avatarFallback}>👤</div>}
                <div style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block', fontSize: 15 }}>{sender?.display_name ?? 'User'}</strong><span style={{ color: '#85899a', fontSize: 12 }}>wants to connect with you</span></div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button type="button" onClick={() => void respond(request, 'accepted')} style={{ ...styles.buttonBase, ...styles.accept }}>Accept</button>
                  <button type="button" onClick={() => void respond(request, 'rejected')} style={{ ...styles.buttonBase, ...styles.reject }}>Reject</button>
                </div>
              </article>;
            })}
          </section>
        )}

        {!loading && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}><span>{search.trim() ? '🔎 Search results' : '✨ People'}</span><span style={{ fontSize: 12, color: '#888c9d' }}>{filtered.length} people</span></h2>
            {filtered.map((p) => {
              const isFriend = friendIds.has(p.id);
              const isPending = pendingIds.has(p.id);
              const isFollowing = followingIds.has(p.id);
              return <article key={p.id} style={styles.row}>
                <button type="button" onClick={() => navigate(`/profile/${encodeURIComponent(p.id)}`)} aria-label={`Open ${p.display_name ?? 'User'} profile`} style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', flexShrink: 0 }}>
                  {p.avatar_url ? <img src={p.avatar_url} alt="" style={styles.avatar} /> : <div aria-hidden="true" style={styles.avatarFallback}>👤</div>}
                </button>
                <button type="button" onClick={() => navigate(`/profile/${encodeURIComponent(p.id)}`)} style={styles.nameButton}>
                  <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.display_name ?? 'User'}</strong>
                  <span style={{ display: 'block', marginTop: 3, color: '#8a8e9f', fontSize: 12 }}>{isFriend ? 'Friend' : isFollowing ? 'Following you' : 'Work Social member'}</span>
                </button>
                <button type="button" onClick={() => void toggleFollow(p.id)} style={{ ...styles.buttonBase, ...(isFollowing ? styles.pending : styles.follow) }}>{isFollowing ? 'Following' : 'Follow'}</button>
                <button type="button" onClick={() => isPending ? void cancelRequest(p.id) : void sendRequest(p.id)} disabled={isFriend} style={{ ...styles.buttonBase, ...(isFriend ? styles.friend : isPending ? styles.pending : styles.add), opacity: isFriend ? 1 : undefined }}>
                  {isFriend ? '✓ Friends' : isPending ? 'Cancel' : 'Add friend'}
                </button>
              </article>;
            })}
            {!filtered.length && <div style={styles.empty}><div style={{ fontSize: 30, marginBottom: 8 }}>🫶</div><strong>No people found</strong><div style={{ marginTop: 4, fontSize: 13 }}>Try a different name.</div></div>}
          </section>
        )}
      </div>
    </main>
  );
}
