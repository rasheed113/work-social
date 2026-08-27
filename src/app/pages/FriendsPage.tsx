import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { navigate } from '../Router';

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

  return <main><h1>Friends</h1><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people..." aria-label="Search people" />{error && <p role="alert">{error}</p>}{loading && <p>Loading people...</p>}{!loading && requests.length > 0 && <section><h2>Friend Requests</h2>{requests.map((request) => <article key={request.id}><strong>{profiles.find((p) => p.id === request.sender_id)?.display_name ?? 'User'}</strong><div><button type="button" onClick={() => void respond(request, 'accepted')}>Accept</button><button type="button" onClick={() => void respond(request, 'rejected')}>Reject</button></div></article>)}</section>}{!loading && <section><h2>{search.trim() ? 'Search results' : 'People'}</h2>{filtered.map((p) => { const isFriend = friendIds.has(p.id); const isPending = pendingIds.has(p.id); const isFollowing = followingIds.has(p.id); return <article key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>{p.avatar_url ? <img src={p.avatar_url} alt="" width={48} height={48} style={{ borderRadius: '50%', objectFit: 'cover' }} /> : <div aria-hidden="true" style={{ width: 48, height: 48, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#eee' }}>👤</div>}<button type="button" onClick={() => navigate(`/profile/${encodeURIComponent(p.id)}`)} style={{ flex: 1, border: 0, background: 'transparent', textAlign: 'left', padding: 0, cursor: 'pointer' }}><strong>{p.display_name ?? 'User'}</strong></button><button type="button" onClick={() => void toggleFollow(p.id)}>{isFollowing ? 'Following' : 'Follow'}</button><button type="button" onClick={() => isPending ? void cancelRequest(p.id) : void sendRequest(p.id)} disabled={isFriend}>{isFriend ? 'Friends' : isPending ? 'Cancel request' : 'Add friend'}</button></article>; })}{!filtered.length && <p>No people found.</p>}</section>}</main>;
}
