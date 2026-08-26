import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

export function FriendsPage() {
  const [me, setMe] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? null;
    setMe(userId);
    if (!userId) return;
    const [{ data: people, error: peopleError }, { data: incoming, error: incomingError }, { data: outgoing, error: outgoingError }, { data: friendships, error: friendsError }] = await Promise.all([
      supabase.from('profiles').select('id, display_name, username, avatar_url, bio').neq('id', userId).order('display_name'),
      supabase.from('friend_requests').select('id, sender_id, status, profiles!friend_requests_sender_id_fkey(id, display_name, username, avatar_url, bio)').eq('receiver_id', userId).eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('friend_requests').select('receiver_id, status').eq('sender_id', userId).eq('status', 'pending'),
      supabase.from('friends').select('profile_a_id, profile_b_id').or(`profile_a_id.eq.${userId},profile_b_id.eq.${userId}`),
    ]);
    const firstError = peopleError ?? incomingError ?? outgoingError ?? friendsError;
    if (firstError) return setError(firstError.message);
    setProfiles(people ?? []); setRequests(incoming ?? []);
    setPendingIds(new Set((outgoing ?? []).map((r: any) => r.receiver_id)));
    setFriendIds(new Set((friendships ?? []).map((f: any) => f.profile_a_id === userId ? f.profile_b_id : f.profile_a_id)));
  };
  useEffect(() => { void load(); }, []);
  const filtered = useMemo(() => { const q = search.trim().toLowerCase(); return q ? profiles.filter((p) => `${p.display_name ?? ''} ${p.username ?? ''}`.toLowerCase().includes(q)) : profiles; }, [profiles, search]);
  const sendRequest = async (receiverId: string) => { if (!me || friendIds.has(receiverId) || pendingIds.has(receiverId)) return; const { error: e } = await supabase.from('friend_requests').insert({ sender_id: me, receiver_id: receiverId, status: 'pending' }); if (e) setError(e.message); else setPendingIds((s) => new Set(s).add(receiverId)); };
  const respond = async (request: any, status: 'accepted' | 'rejected') => { const { error: e } = await supabase.from('friend_requests').update({ status }).eq('id', request.id).eq('receiver_id', me!); if (e) return setError(e.message); setRequests((current) => current.filter((r) => r.id !== request.id)); if (status === 'accepted') { const a = [me!, request.sender_id].sort(); const { error: friendError } = await supabase.from('friends').insert({ profile_a_id: a[0], profile_b_id: a[1] }); if (friendError) setError(friendError.message); else setFriendIds((s) => new Set(s).add(request.sender_id)); } };
  return <main><h1>Friends</h1>{error && <p role="alert">{error}</p>}<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people..." aria-label="Search people" />
    {requests.length > 0 && <section><h2>Friend Requests</h2>{requests.map((request) => { const p = request.profiles; return <article key={request.id}><strong>{p?.display_name ?? p?.username ?? 'User'}</strong><div><button type="button" onClick={() => void respond(request, 'accepted')}>Accept</button><button type="button" onClick={() => void respond(request, 'rejected')}>Reject</button></div></article>; })}</section>}
    <section><h2>People</h2>{filtered.map((p) => { const isFriend = friendIds.has(p.id); const isPending = pendingIds.has(p.id); return <article key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>{p.avatar_url ? <img src={p.avatar_url} alt="" width={48} height={48} style={{ borderRadius: '50%', objectFit: 'cover' }} /> : <div aria-hidden="true" style={{ width: 48, height: 48, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#eee' }}>👤</div>}<div><strong>{p.display_name ?? p.username ?? 'User'}</strong>{p.bio && <div>{p.bio}</div>}</div><button type="button" disabled={isFriend || isPending} onClick={() => void sendRequest(p.id)}>{isFriend ? 'Friends' : isPending ? 'Request sent' : 'Add friend'}</button></article>; })}</section>{!filtered.length && <p>No people found.</p>}</main>;
}
