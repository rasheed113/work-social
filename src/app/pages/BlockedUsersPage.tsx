import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

interface BlockedUser { id: string; username: string; display_name: string; avatar_url: string | null; created_at: string; }

export function BlockedUsersPage() {
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase.rpc('get_blocked_users');
    if (e) setError(e.message);
    else setUsers((data ?? []) as BlockedUser[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const unblock = async (id: string) => {
    setBusyId(id);
    setError(null);
    const { error: e } = await supabase.rpc('unblock_user', { p_blocked_id: id });
    if (e) setError(e.message);
    else setUsers((current) => current.filter((user) => user.id !== id));
    setBusyId(null);
  };

  return <main>
    <h1>Blocked Users</h1>
    <p>People you block cannot view your profile or posts, follow or friend you, message you, or interact with your content.</p>
    {loading && <p>Loading blocked users…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !users.length && <section className="foundation-card"><p>No blocked users.</p></section>}
    {!loading && users.length > 0 && <section style={{ display: 'grid', gap: 10 }}>
      {users.map((user) => <article key={user.id} className="foundation-card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {user.avatar_url ? <img src={user.avatar_url} alt="" width={48} height={48} style={{ borderRadius: '50%', objectFit: 'cover' }} /> : <div aria-hidden="true" style={{ width: 48, height: 48, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#eee' }}>👤</div>}
        <div style={{ flex: 1, minWidth: 0 }}><strong>{user.display_name}</strong><small style={{ display: 'block' }}>@{user.username}</small></div>
        <button type="button" onClick={() => void unblock(user.id)} disabled={busyId === user.id}>{busyId === user.id ? 'Unblocking…' : 'Unblock'}</button>
      </article>)}
    </section>}
  </main>;
}
