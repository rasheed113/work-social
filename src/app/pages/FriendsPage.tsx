import { WorkSocialPremiumLoader } from '../components/WorkSocialPremiumLoader';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { navigate } from '../Router';

const styles = {
  page: {
    width: '100%', maxWidth: 920, margin: '0 auto', padding: '18px 16px 96px', boxSizing: 'border-box', color: '#f7f8ff',
  } as React.CSSProperties,
  hero: {
    position: 'relative', overflow: 'hidden', borderRadius: 26, padding: '22px 22px 20px', marginBottom: 18,
    background: 'linear-gradient(145deg, rgba(4,14,30,.99) 0%, rgba(5,27,51,.98) 54%, rgba(8,20,40,.99) 100%)',
    boxShadow: '0 24px 65px rgba(0,0,0,.38), inset 0 1px 0 rgba(141,231,255,.15), 0 0 0 1px rgba(0,240,255,.08)',
    border: '1px solid rgba(70,220,255,.28)',
  } as React.CSSProperties,
  glow: { position: 'absolute', width: 240, height: 240, borderRadius: '50%', right: -95, top: -120, background: 'rgba(52, 211, 255, .13)', filter: 'blur(30px)', pointerEvents: 'none' } as React.CSSProperties,
  title: { margin: '2px 0 0', fontSize: 31, lineHeight: 1.05, fontWeight: 900, letterSpacing: '.01em', fontFamily: 'monospace, sans-serif', color: '#effcff', textShadow: '0 0 18px rgba(75,220,255,.32)' } as React.CSSProperties,
  subtitle: { margin: '8px 0 0', color: '#91aabd', fontSize: 13 } as React.CSSProperties,
  searchWrap: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 17, padding: '10px 13px', borderRadius: 13, background: 'rgba(1,10,23,.78)', border: '1px solid rgba(91,224,255,.32)', boxShadow: 'inset 0 0 18px rgba(21,157,196,.08), 0 0 18px rgba(21,157,196,.08)' } as React.CSSProperties,
  search: { flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', color: '#ecfbff', fontSize: 14, fontFamily: 'monospace, sans-serif', letterSpacing: '.02em' } as React.CSSProperties,
  section: { marginTop: 16, padding: 16, borderRadius: 22, background: 'linear-gradient(180deg, rgba(7,20,38,.94), rgba(5,15,29,.97))', color: '#dceff5', border: '1px solid rgba(0,240,255,.16)', boxShadow: '0 14px 36px rgba(0,0,0,.24)' } as React.CSSProperties,
  sectionTitle: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '0 0 12px', fontSize: 17, fontWeight: 850 } as React.CSSProperties,
  row: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 7, padding: 11, marginTop: 8, borderRadius: 17, background: '#fff', border: '1px solid rgba(30,35,80,.08)', boxShadow: '0 7px 20px rgba(30,35,80,.07)', transition: 'transform .18s ease, box-shadow .18s ease' } as React.CSSProperties,
  identity: { display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 } as React.CSSProperties,
  avatar: { width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid rgba(0,220,255,.22)', boxShadow: '0 0 16px rgba(0,220,255,.12)' } as React.CSSProperties,
  avatarFallback: { width: 48, height: 48, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#102b45,#0a1c32)', border: '1px solid rgba(0,240,255,.18)', flexShrink: 0, fontSize: 20, boxShadow: '0 0 16px rgba(0,220,255,.10)' } as React.CSSProperties,
  nameButton: { flex: 1, minWidth: 0, border: 0, background: 'transparent', textAlign: 'left', padding: 0, cursor: 'pointer', color: '#17182b', fontSize: 15 } as React.CSSProperties,
  buttonBase: { border: 0, borderRadius: 10, padding: '7px 10px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' } as React.CSSProperties,
  actions: { display: 'flex', gap: 7, flexWrap: 'wrap', paddingLeft: 59 } as React.CSSProperties,
  follow: { background: '#eef0ff', color: '#4c3acb' } as React.CSSProperties,
  add: { background: 'linear-gradient(135deg,#00bcd4,#1769ff)', color: '#fff', boxShadow: '0 0 16px rgba(0,200,255,.18)' } as React.CSSProperties,
  pending: { background: '#f1f2f6', color: '#666b7c' } as React.CSSProperties,
  friend: { background: 'linear-gradient(135deg,#dff9ed,#c9f3df)', color: '#147447' } as React.CSSProperties,
  accept: { background: 'linear-gradient(135deg,#00a878,#16c784)', color: '#fff', boxShadow: '0 0 16px rgba(0,200,130,.18)' } as React.CSSProperties,
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
  const filtered = useMemo(() => { const q = search.trim().toLowerCase(); return q ? profiles.filter((p) => `${p.display_name ?? ''}`.toLowerCase().includes(q)) : profiles; }, [profiles, search]);
  const sendRequest = async (receiverId: string) => { if (!me || friendIds.has(receiverId) || pendingIds.has(receiverId)) return; const { data, error: e } = await supabase.from('friend_requests').insert({ sender_id: me, receiver_id: receiverId, status: 'pending' }).select('id').single(); if (e) return setError(e.message); setPendingIds((s) => new Set(s).add(receiverId)); setPendingRequestIds((m) => ({ ...m, [receiverId]: data.id })); };
  const cancelRequest = async (receiverId: string) => { if (!me) return; const requestId = pendingRequestIds[receiverId]; if (!requestId) return; const { error: e } = await supabase.from('friend_requests').delete().eq('id', requestId).eq('sender_id', me).eq('receiver_id', receiverId).eq('status', 'pending'); if (e) return setError(e.message); setPendingIds((s) => { const next = new Set(s); next.delete(receiverId); return next; }); setPendingRequestIds((m) => { const next = { ...m }; delete next[receiverId]; return next; }); };
  const respond = async (request: any, status: 'accepted' | 'rejected') => { if (!me) return; const { error: e } = await supabase.from('friend_requests').update({ status }).eq('id', request.id).eq('receiver_id', me); if (e) return setError(e.message); setRequests((current) => current.filter((r) => r.id !== request.id)); if (status === 'accepted') { const [a, b] = [me, request.sender_id].sort(); const { error: friendError } = await supabase.from('friends').insert({ profile_a_id: a, profile_b_id: b }); if (friendError) setError(friendError.message); else setFriendIds((s) => new Set(s).add(request.sender_id)); } };
  const toggleFollow = async (targetId: string) => { if (!me) return; const isFollowing = followingIds.has(targetId); const result = isFollowing ? await supabase.from('follows').delete().eq('follower_id', me).eq('following_id', targetId) : await supabase.from('follows').insert({ follower_id: me, following_id: targetId }); if (result.error) return setError(result.error.message); setFollowingIds((current) => { const next = new Set(current); if (isFollowing) next.delete(targetId); else next.add(targetId); return next; }); };

  return (
    <main style={{ minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
      <div style={styles.page}>
        <section style={styles.hero}>
          <div style={styles.glow} />
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: .36, backgroundImage: 'linear-gradient(rgba(0,240,255,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,.045) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
          <div style={{ position: 'absolute', left: 16, bottom: 14, width: 34, height: 1, background: 'rgba(0,240,255,.55)', boxShadow: '0 0 9px rgba(0,240,255,.35)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#63e8ff', boxShadow: '0 0 12px rgba(99,232,255,.9)' }} /><span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '.19em', textTransform: 'uppercase', color: '#8de7ff', fontFamily: 'monospace' }}>SOCIAL COMMAND CENTER</span></div>
              <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '.12em', color: 'rgba(173,225,238,.52)', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>SYS / FRIENDS</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ minWidth: 0 }}><div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.16em', color: 'rgba(160,226,239,.52)', textTransform: 'uppercase', marginBottom: 6, fontFamily: 'monospace' }}>NETWORK DIRECTORY</div><h1 style={styles.title}>Friends</h1><p style={styles.subtitle}>Connect with people, manage requests and build your circle.</p></div>
              <div aria-hidden="true" style={{ display: 'grid', gap: 4, minWidth: 78, flexShrink: 0, textAlign: 'right' }}><span style={{ fontSize: 8, letterSpacing: '.12em', color: 'rgba(141,231,255,.45)', fontFamily: 'monospace' }}>LINK</span><strong style={{ fontSize: 10, letterSpacing: '.1em', color: '#9af0ff', fontFamily: 'monospace' }}>ONLINE</strong></div>
            </div>
            <div style={styles.searchWrap}><span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1, color: '#78e8ff', textShadow: '0 0 10px rgba(120,232,255,.55)' }}>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people..." aria-label="Search people" style={styles.search} />{search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search" style={{ border: '1px solid rgba(120,232,255,.2)', background: 'rgba(100,220,255,.08)', color: '#bff6ff', borderRadius: 8, width: 29, height: 29, cursor: 'pointer' }}>×</button>}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 9, fontSize: 8, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(157,218,232,.42)', fontFamily: 'monospace' }}><span>DIRECTORY ACCESS // READY</span><span>QUERY: {search.trim() ? 'ACTIVE' : 'IDLE'}</span></div>
          </div>
        </section>
        {error && <p role="alert" style={styles.alert}>{error}</p>}
        {loading && <section style={styles.section}><WorkSocialPremiumLoader title="Friends" message="Loading your social circle…" /></section>}
        {!loading && requests.length > 0 && <section style={styles.section}><h2 style={styles.sectionTitle}><span>🤝 Friend Requests</span><span style={{ fontSize: 12, padding: '5px 9px', borderRadius: 999, background: '#eeeaff', color: '#5b42c7' }}>{requests.length}</span></h2>{requests.map((request) => { const sender = profiles.find((p) => p.id === request.sender_id); return <article key={request.id} style={styles.row}><div style={styles.identity}>{sender?.avatar_url ? <img src={sender.avatar_url} alt="" style={styles.avatar} /> : <div aria-hidden="true" style={styles.avatarFallback}>👤</div>}<div style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block', fontSize: 15 }}>{sender?.display_name ?? 'User'}</strong><span style={{ color: '#85899a', fontSize: 12 }}>wants to connect with you</span></div></div><div style={styles.actions}><button type="button" onClick={() => void respond(request, 'accepted')} style={{ ...styles.buttonBase, ...styles.accept }}>Accept</button><button type="button" onClick={() => void respond(request, 'rejected')} style={{ ...styles.buttonBase, ...styles.reject }}>Reject</button></div></article>; })}</section>}
        {!loading && <section style={styles.section}><h2 style={styles.sectionTitle}><span>{search.trim() ? '🔎 Search results' : '✨ People'}</span><span style={{ fontSize: 12, color: '#888c9d' }}>{filtered.length} people</span></h2>{filtered.map((p) => { const isFriend = friendIds.has(p.id); const isPending = pendingIds.has(p.id); const isFollowing = followingIds.has(p.id); return <article key={p.id} style={styles.row}><div style={styles.identity}><button type="button" onClick={() => navigate(`/profile/${encodeURIComponent(p.id)}`)} aria-label={`Open ${p.display_name ?? 'User'} profile`} style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', flexShrink: 0 }}>{p.avatar_url ? <img src={p.avatar_url} alt="" style={styles.avatar} /> : <div aria-hidden="true" style={styles.avatarFallback}>👤</div>}</button><button type="button" onClick={() => navigate(`/profile/${encodeURIComponent(p.id)}`)} style={styles.nameButton}><strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.display_name ?? 'User'}</strong><span style={{ display: 'block', marginTop: 3, color: '#8a8e9f', fontSize: 12 }}>{isFriend ? 'Friend' : isFollowing ? 'Following you' : 'Work Social member'}</span></button></div><div style={styles.actions}><button type="button" onClick={() => void toggleFollow(p.id)} style={{ ...styles.buttonBase, ...(isFollowing ? styles.pending : styles.follow) }}>{isFollowing ? 'Following' : 'Follow'}</button><button type="button" onClick={() => isPending ? void cancelRequest(p.id) : void sendRequest(p.id)} disabled={isFriend} style={{ ...styles.buttonBase, ...(isFriend ? styles.friend : isPending ? styles.pending : styles.add), opacity: isFriend ? 1 : undefined }}>{isFriend ? '✓ Friends' : isPending ? 'Cancel' : 'Add friend'}</button></div></article>; })}{!filtered.length && <div style={styles.empty}><div style={{ fontSize: 30, marginBottom: 8 }}>🫶</div><strong>No people found</strong><div style={{ marginTop: 4, fontSize: 13 }}>Try a different name.</div></div>}</section>}
      </div>
    </main>
  );
}
