import { useEffect, useState } from 'react';
import type { ProfileUpdateInput } from '../api/updateProfile';
import { getProfile } from '../api/getProfile';
import { updateProfile } from '../api/updateProfile';
import { AvatarUploader } from './AvatarUploader';
import { PostFeed } from '../../posts/components/PostFeed';
import { supabase } from '../../../lib/supabase/client';

type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  gender: string | null;
  location: string | null;
  website: string | null;
  created_at: string;
  updated_at: string;
};

interface ProfilePanelProps { profileId: string; viewerId?: string; }

function formatJoinedDate(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

export function ProfilePanel({ profileId, viewerId }: ProfilePanelProps) {
  const isOwner = !viewerId || viewerId === profileId;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<ProfileUpdateInput>({ display_name: '', bio: '', date_of_birth: '', gender: '', location: '', website: '' });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);
  const [friend, setFriend] = useState(false);
  const [friendPending, setFriendPending] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      setLoading(true); setError(null);
      const { data, error: profileError } = await getProfile(profileId);
      if (!active) return;
      if (profileError || !data) { setProfile(null); setError(profileError?.message ?? 'Profile could not be loaded.'); setLoading(false); return; }
      const next = data as Profile;
      setProfile(next);
      setForm({ display_name: next.display_name ?? '', bio: next.bio ?? '', date_of_birth: next.date_of_birth ?? '', gender: next.gender ?? '', location: next.location ?? '', website: next.website ?? '' });
      setLoading(false);
    }
    void loadProfile();
    return () => { active = false; };
  }, [profileId]);

  useEffect(() => {
    if (isOwner || !viewerId) return;
    let active = true;
    async function loadRelationship() {
      const [{ data: follows, error: followError }, { data: friendships, error: friendError }, { data: requests, error: requestError }] = await Promise.all([
        supabase.from('follows').select('following_id').eq('follower_id', viewerId).eq('following_id', profileId).maybeSingle(),
        supabase.from('friends').select('profile_a_id, profile_b_id').or(`and(profile_a_id.eq.${viewerId},profile_b_id.eq.${profileId}),and(profile_a_id.eq.${profileId},profile_b_id.eq.${viewerId})`).maybeSingle(),
        supabase.from('friend_requests').select('id, status').eq('sender_id', viewerId).eq('receiver_id', profileId).eq('status', 'pending').maybeSingle(),
      ]);
      if (!active) return;
      if (followError || friendError || requestError) { setError((followError ?? friendError ?? requestError)?.message ?? 'Relationship status could not be loaded.'); return; }
      setFollowing(Boolean(follows)); setFriend(Boolean(friendships)); setFriendPending(Boolean(requests));
    }
    void loadRelationship();
    return () => { active = false; };
  }, [isOwner, viewerId, profileId]);

  const openEditor = () => {
    if (!profile || !isOwner) return;
    setForm({ display_name: profile.display_name ?? '', bio: profile.bio ?? '', date_of_birth: profile.date_of_birth ?? '', gender: profile.gender ?? '', location: profile.location ?? '', website: profile.website ?? '' });
    setError(null); setSaved(false); setEditing(true);
  };

  const handleSave = async () => {
    if (!profile || !isOwner) return;
    const normalized: ProfileUpdateInput = { display_name: form.display_name.trim(), bio: form.bio.trim(), date_of_birth: form.date_of_birth, gender: form.gender, location: form.location.trim(), website: form.website.trim() };
    if (!normalized.display_name) { setError('Display name is required.'); return; }
    setSaving(true); setError(null); setSaved(false);
    const { data, error: updateError } = await updateProfile(profileId, normalized);
    if (updateError || !data) { setError(updateError?.message ?? 'Profile could not be saved.'); setSaving(false); return; }
    const next = data as Profile;
    setProfile(next);
    setForm({ display_name: next.display_name ?? '', bio: next.bio ?? '', date_of_birth: next.date_of_birth ?? '', gender: next.gender ?? '', location: next.location ?? '', website: next.website ?? '' });
    setEditing(false); setSaved(true); setSaving(false);
  };

  const handleAvatarUploaded = (publicUrl: string) => {
    setProfile((current) => current ? { ...current, avatar_url: publicUrl } : current);
    setSaved(true); setError(null);
  };

  const toggleFollow = async () => {
    if (!viewerId || isOwner || busyAction) return;
    setBusyAction(true); setError(null);
    const result = following
      ? await supabase.from('follows').delete().eq('follower_id', viewerId).eq('following_id', profileId)
      : await supabase.from('follows').insert({ follower_id: viewerId, following_id: profileId });
    if (result.error) setError(result.error.message); else setFollowing(!following);
    setBusyAction(false);
  };

  const sendFriendRequest = async () => {
    if (!viewerId || isOwner || friend || friendPending || busyAction) return;
    setBusyAction(true); setError(null);
    const { error: requestError } = await supabase.from('friend_requests').insert({ sender_id: viewerId, receiver_id: profileId, status: 'pending' });
    if (requestError) setError(requestError.message); else setFriendPending(true);
    setBusyAction(false);
  };

  const chatWithProfile = async () => {
    if (!viewerId || isOwner || busyAction) return;
    setBusyAction(true); setError(null);
    const [a, b] = [viewerId, profileId].sort();
    const directKey = `${a}:${b}`;
    let { data: conversation, error: findError } = await supabase.from('conversations').select('id').eq('kind', 'direct').eq('direct_key', directKey).maybeSingle();
    if (findError) { setError(findError.message); setBusyAction(false); return; }
    if (!conversation) {
      const { data: created, error: createError } = await supabase.from('conversations').insert({ kind: 'direct', created_by: viewerId, direct_user_a: a, direct_user_b: b, direct_key: directKey }).select('id').single();
      if (createError) { setError(createError.message); setBusyAction(false); return; }
      const { error: memberError } = await supabase.from('conversation_members').insert([{ conversation_id: created.id, profile_id: viewerId }, { conversation_id: created.id, profile_id: profileId }]);
      if (memberError) { setError(memberError.message); setBusyAction(false); return; }
      conversation = created;
    }
    window.location.assign(`/inbox?conversation=${encodeURIComponent(conversation.id)}`);
  };

  if (loading) return <section className="foundation-card"><p>Loading profile…</p></section>;
  if (error && !profile) return <section className="foundation-card"><p role="alert">{error}</p></section>;
  if (!profile) return <section className="foundation-card"><p>Profile not found.</p></section>;

  if (editing && isOwner) {
    return <section className="foundation-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div><p className="eyebrow">Edit Profile</p><h2>Edit your profile</h2></div>
        <button type="button" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
      </div>
      <AvatarUploader userId={profileId} avatarUrl={profile.avatar_url} onUploaded={handleAvatarUploaded} />
      <label>Display name<input value={form.display_name} onChange={(e) => setForm((v) => ({ ...v, display_name: e.target.value }))} autoComplete="name" /></label>
      <label>Bio<textarea value={form.bio} onChange={(e) => setForm((v) => ({ ...v, bio: e.target.value }))} rows={3} /></label>
      <label>Date of birth<input type="date" value={form.date_of_birth} onChange={(e) => setForm((v) => ({ ...v, date_of_birth: e.target.value }))} /></label>
      <label>Gender<select value={form.gender} onChange={(e) => setForm((v) => ({ ...v, gender: e.target.value }))}><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="non_binary">Non-binary</option><option value="other">Other</option></select></label>
      <label>Location<input value={form.location} onChange={(e) => setForm((v) => ({ ...v, location: e.target.value }))} placeholder="City, country" /></label>
      <label>Website<input type="url" value={form.website} onChange={(e) => setForm((v) => ({ ...v, website: e.target.value }))} placeholder="https://example.com" /></label>
      {error && <p role="alert">{error}</p>}
      <button type="button" disabled={saving} onClick={() => void handleSave()}>{saving ? 'Saving…' : 'Save profile'}</button>
    </section>;
  }

  return <section>
    <section className="foundation-card" style={{ textAlign: 'center' }}>
      {profile.avatar_url ? <img src={profile.avatar_url} alt={`${profile.display_name} profile`} width={112} height={112} style={{ borderRadius: '50%', objectFit: 'cover', display: 'block', margin: '0 auto 16px' }} /> : <div aria-hidden="true" style={{ width: 112, height: 112, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#eee', margin: '0 auto 16px', fontSize: 40 }}>👤</div>}
      <h2 style={{ marginBottom: 4 }}>{profile.display_name}</h2>
      <p style={{ marginTop: 0 }}>@{profile.username}</p>
      {profile.bio && <p style={{ margin: '12px auto', maxWidth: 560 }}>{profile.bio}</p>}
      {profile.location && <p style={{ margin: '8px auto' }}>📍 {profile.location}</p>}
      {profile.website && <p style={{ margin: '8px auto' }}><a href={profile.website} target="_blank" rel="noreferrer">{profile.website}</a></p>}
      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
        {isOwner ? <>
          <button type="button" onClick={() => window.location.assign('/friends')}>Friends</button>
          <button type="button" disabled aria-label="Followers">Followers</button>
          <button type="button" onClick={openEditor}>Edit</button>
        </> : <>
          <button type="button" onClick={() => void chatWithProfile()} disabled={busyAction}>💬 Chat with {profile.display_name}</button>
          <button type="button" onClick={() => void toggleFollow()} disabled={busyAction}>{following ? 'Following' : 'Follow'}</button>
          <button type="button" onClick={() => void sendFriendRequest()} disabled={busyAction || friend}>{friend ? 'Friends' : friendPending ? 'Request sent' : 'Add as Friend'}</button>
        </>}
      </div>
      {error && <p role="alert">{error}</p>}
      {saved && <p role="status">Profile saved.</p>}
    </section>

    <section style={{ marginTop: 20 }}>
      <PostFeed refreshKey={0} profileId={profileId} feedProfileId={profileId} scope="profile" />
    </section>

    <footer className="foundation-card" style={{ marginTop: 20, textAlign: 'center' }}>
      <p>Joined {formatJoinedDate(profile.created_at)}</p>
    </footer>
  </section>;
}
