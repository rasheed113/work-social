import { WorkSocialPremiumLoader } from '../components/WorkSocialPremiumLoader';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { navigate } from '../Router';

const styles = {
  page: {
    width: '100%', maxWidth: 920, margin: '0 auto', padding: '18px 16px 96px', boxSizing: 'border-box', color: '#9defff',
  } as React.CSSProperties,
  hero: {
    position: 'relative', overflow: 'hidden', borderRadius: 26, padding: '22px 22px 20px', marginBottom: 18,
    background: 'transparent',
    backgroundImage: 'none',
    backdropFilter: 'none', WebkitBackdropFilter: 'none',
    boxShadow: 'none',
    border: '0',
  } as React.CSSProperties,
  glow: { display: 'none' } as React.CSSProperties,
  title: { margin: '2px 0 0', fontSize: 31, lineHeight: 1.05, fontWeight: 900, letterSpacing: '.12em', fontFamily: 'monospace, sans-serif', textTransform: 'uppercase', color: '#7df5ff', textShadow: '0 0 12px rgba(0,240,255,.55), 0 0 26px rgba(0,180,255,.22)' } as React.CSSProperties,
  subtitle: { margin: '8px 0 0', color: 'rgba(125,245,255,.72)', fontSize: 12, letterSpacing: '.055em', fontFamily: 'monospace, sans-serif' } as React.CSSProperties,
  searchWrap: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 17, padding: '10px 13px', borderRadius: 13, background: 'transparent',
    backgroundImage: 'none', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid rgba(91,224,255,.32)', boxShadow: 'none' } as React.CSSProperties,
  search: { flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', color: '#bfefff', fontSize: 14, fontFamily: 'monospace, sans-serif', letterSpacing: '.02em' } as React.CSSProperties,
  section: { marginTop: 16, padding: 16, borderRadius: 22, background: 'transparent',
    backgroundImage: 'none', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', color: '#bfefff', border: '1px solid rgba(0,240,255,.16)', boxShadow: 'none' } as React.CSSProperties,
  sectionTitle: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '0 0 12px', fontSize: 17, fontWeight: 850, color: '#66e8ff', textShadow: '0 0 12px rgba(75,220,255,.2)' } as React.CSSProperties,
  row: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 7, padding: 11, marginTop: 8, borderRadius: 17, background: 'transparent',
    backgroundImage: 'none', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', color: '#bfefff', border: '1px solid rgba(91,224,255,.14)', boxShadow: 'none', transition: 'transform .18s ease, box-shadow .18s ease' } as React.CSSProperties,
  identity: { display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 } as React.CSSProperties,
  avatar: { width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid rgba(0,220,255,.22)', boxShadow: '0 0 16px rgba(0,220,255,.12)' } as React.CSSProperties,
  avatarFallback: { width: 48, height: 48, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,rgba(16,43,69,.72),rgba(10,28,50,.58))', border: '1px solid rgba(0,240,255,.18)', flexShrink: 0, fontSize: 20, boxShadow: '0 0 16px rgba(0,220,255,.10)' } as React.CSSProperties,
  nameButton: { flex: 1, minWidth: 0, border: 0, background: 'transparent', textAlign: 'left', padding: 0, cursor: 'pointer', color: '#66e8ff', fontSize: 15 } as React.CSSProperties,
  buttonBase: { border: '1px solid rgba(120,232,255,.2)', borderRadius: 10, padding: '7px 10px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', color: '#bfefff', background: 'rgba(100,220,255,.07)' } as React.CSSProperties,
  actions: { display: 'flex', gap: 7, flexWrap: 'wrap', paddingLeft: 59 } as React.CSSProperties,
  follow: { background: 'rgba(108,91,255,.12)', color: '#bfefff', borderColor: 'rgba(155,140,255,.24)' } as React.CSSProperties,
  add: { background: 'rgba(0,188,212,.12)', color: '#bfefff', borderColor: 'rgba(0,240,255,.32)', boxShadow: '0 0 16px rgba(0,200,255,.10)' } as React.CSSProperties,
  pending: { background: 'rgba(120,150,170,.10)', color: '#8fb9c9' } as React.CSSProperties,
  friend: { background: 'rgba(0,180,140,.10)', color: '#bfefff', borderColor: 'rgba(0,220,180,.24)' } as React.CSSProperties,
  accept: { background: 'rgba(0,168,120,.12)', color: '#bfefff', borderColor: 'rgba(0,220,180,.28)', boxShadow: '0 0 16px rgba(0,200,130,.10)' } as React.CSSProperties,
  reject: { background: 'rgba(100,120,140,.08)', color: '#8fb9c9' } as React.CSSProperties,
  alert: { margin: '12px 0 0', padding: '10px 12px', borderRadius: 13, background: 'transparent',
    backgroundImage: 'none', color: '#bfefff', border: '1px solid rgba(255,100,130,.22)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } as React.CSSProperties,
  empty: { padding: '24px 10px', textAlign: 'center', color: '#8fb9c9' } as React.CSSProperties,
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
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#63e8ff', boxShadow: '0 0 12px rgba(99,232,255,.9)' }} /><span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '.24em', textTransform: 'uppercase', color: '#7df5ff', fontFamily: 'monospace', textShadow: '0 0 10px rgba(0,240,255,.45)' }}>SOCIAL COMMAND CENTER</span></div>
              <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '.18em', color: 'rgba(125,245,255,.62)', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>SYS / FRIENDS</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ minWidth: 0 }}><div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '.2em', color: 'rgba(125,245,255,.62)', textTransform: 'uppercase', marginBottom: 6, fontFamily: 'monospace', textShadow: '0 0 8px rgba(0,240,255,.25)' }}>NETWORK DIRECTORY</div><h1 style={styles.title}>Friends</h1><p style={styles.subtitle}>Connect with people, manage requests and build your circle.</p></div>
              <div aria-hidden="true" style={{ display: 'grid', gap: 4, minWidth: 78, flexShrink: 0, textAlign: 'right' }}><span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '.18em', color: 'rgba(125,245,255,.58)', fontFamily: 'monospace' }}>LINK</span><strong style={{ fontSize: 10, fontWeight: 900, letterSpacing: '.16em', color: '#7df5ff', fontFamily: 'monospace', textShadow: '0 0 9px rgba(0,240,255,.35)' }}>ONLINE</strong></div>
            </div>
            <div style={styles.searchWrap}><span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1, color: '#78e8ff', textShadow: '0 0 10px rgba(120,232,255,.55)' }}>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people..." aria-label="Search people" style={styles.search} />{search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search" style={{ border: '1px solid rgba(120,232,255,.2)', background: 'rgba(100,220,255,.08)', color: '#bff6ff', borderRadius: 8, width: 29, height: 29, cursor: 'pointer' }}>×</button>}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 9, fontSize: 8, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(125,245,255,.52)', fontFamily: 'monospace' }}><span>DIRECTORY ACCESS // READY</span><span>QUERY: {search.trim() ? 'ACTIVE' : 'IDLE'}</span></div>
          </div>
        </section>
        {error && <p role="alert" style={styles.alert}>{error}</p>}
        {loading && <section style={styles.section}><WorkSocialPremiumLoader title="Friends" message="Loading your social circle…" /></section>}
        {!loading && requests.length > 0 && <section style={styles.section}><h2 style={styles.sectionTitle}><span>🤝 Friend Requests</span><span style={{ fontSize: 9, fontFamily: 'monospace', color: '#bfefff', fontWeight: 800 }}>{requests.length} INBOUND</span></h2>{requests.map((r) => { const sender = profiles.find((p) => p.id === r.sender_id); return <div key={r.id} style={styles.row}><div style={styles.identity}>{sender?.avatar_url ? <img src={sender.avatar_url} alt="" style={styles.avatar} /> : <div style={styles.avatarFallback}>◉</div>}<button type="button" onClick={() => navigate(`/profile/${r.sender_id}`)} style={styles.nameButton}>{sender?.display_name ?? 'Unknown worker'}</button></div><div style={styles.actions}><button type="button" onClick={() => void respond(r, 'accepted')} style={{ ...styles.buttonBase, ...styles.accept }}>Accept</button><button type="button" onClick={() => void respond(r, 'rejected')} style={{ ...styles.buttonBase, ...styles.reject }}>Decline</button></div></div>})}</section>}
        {!loading && <section style={styles.section}><h2 style={styles.sectionTitle}><span>◈ Network Directory</span><span style={{ fontSize: 9, fontFamily: 'monospace', color: '#bfefff', fontWeight: 800 }}>{filtered.length} NODES</span></h2>{filtered.length === 0 ? <div style={styles.empty}>{search.trim() ? 'No matching people found.' : 'No people available yet.'}</div> : filtered.map((p) => { const isFriend = friendIds.has(p.id); const isPending = pendingIds.has(p.id); const isFollowing = followingIds.has(p.id); return <div key={p.id} style={styles.row}><div style={styles.identity}>{p.avatar_url ? <img src={p.avatar_url} alt="" style={styles.avatar} /> : <div style={styles.avatarFallback}>◉</div>}<button type="button" onClick={() => navigate(`/profile/${p.id}`)} style={styles.nameButton}>{p.display_name ?? 'Unknown worker'}</button></div><div style={styles.actions}>{isFriend ? <span style={{ ...styles.buttonBase, ...styles.friend }}>FRIEND</span> : isPending ? <button type="button" onClick={() => void cancelRequest(p.id)} style={{ ...styles.buttonBase, ...styles.pending }}>PENDING / CANCEL</button> : <button type="button" onClick={() => void sendRequest(p.id)} style={{ ...styles.buttonBase, ...styles.add }}>ADD FRIEND</button>}<button type="button" onClick={() => void toggleFollow(p.id)} style={{ ...styles.buttonBase, ...styles.follow }}>{isFollowing ? 'UNFOLLOW' : 'FOLLOW'}</button></div></div>})}</section>}
      </div>
    </main>
  );
}
