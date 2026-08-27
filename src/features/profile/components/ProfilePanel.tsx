import { useEffect, useState } from 'react';
import type { ProfileUpdateInput } from '../api/updateProfile';
import { getProfile } from '../api/getProfile';
import { updateProfile } from '../api/updateProfile';
import { AvatarUploader } from './AvatarUploader';
import { PostFeed } from '../../posts/components/PostFeed';

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

interface ProfilePanelProps { profileId: string; }

function formatJoinedDate(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

export function ProfilePanel({ profileId }: ProfilePanelProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<ProfileUpdateInput>({ display_name: '', bio: '', date_of_birth: '', gender: '', location: '', website: '' });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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

  const openEditor = () => {
    if (!profile) return;
    setForm({ display_name: profile.display_name ?? '', bio: profile.bio ?? '', date_of_birth: profile.date_of_birth ?? '', gender: profile.gender ?? '', location: profile.location ?? '', website: profile.website ?? '' });
    setError(null); setSaved(false); setEditing(true);
  };

  const handleSave = async () => {
    if (!profile) return;
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

  if (loading) return <section className="foundation-card"><p>Loading profile…</p></section>;
  if (error && !profile) return <section className="foundation-card"><p role="alert">{error}</p></section>;
  if (!profile) return <section className="foundation-card"><p>Profile not found.</p></section>;

  if (editing) {
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
      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
        <button type="button" onClick={() => window.location.assign('/friends')}>Friends</button>
        <button type="button" disabled aria-label="Followers">Followers</button>
        <button type="button" onClick={openEditor}>Edit</button>
      </div>
      {saved && <p role="status">Profile saved.</p>}
    </section>

    <section style={{ marginTop: 20 }}><PostFeed refreshKey={0} profileId={profileId} /></section>

    <footer className="foundation-card" style={{ marginTop: 20, textAlign: 'center' }}>
      <p>Joined {formatJoinedDate(profile.created_at)}</p>
    </footer>
  </section>;
}
