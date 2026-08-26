import { useEffect, useState } from 'react';
import type { ProfileUpdateInput } from '../api/updateProfile';
import { getProfile } from '../api/getProfile';
import { updateProfile } from '../api/updateProfile';

type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
};

interface ProfilePanelProps {
  profileId: string;
}

export function ProfilePanel({ profileId }: ProfilePanelProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<ProfileUpdateInput>({ display_name: '', bio: '', avatar_url: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setError(null);
      const { data, error: profileError } = await getProfile(profileId);

      if (!active) return;
      if (profileError || !data) {
        setError(profileError?.message ?? 'Profile could not be loaded.');
        setLoading(false);
        return;
      }

      setProfile(data);
      setForm({
        display_name: data.display_name ?? '',
        bio: data.bio ?? '',
        avatar_url: data.avatar_url ?? '',
      });
      setLoading(false);
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, [profileId]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);

    const { data, error: updateError } = await updateProfile(profileId, form);
    if (updateError || !data) {
      setError(updateError?.message ?? 'Profile could not be saved.');
      setSaving(false);
      return;
    }

    setProfile(data);
    setForm({
      display_name: data.display_name ?? '',
      bio: data.bio ?? '',
      avatar_url: data.avatar_url ?? '',
    });
    setSaved(true);
    setSaving(false);
  }

  if (loading) return <section className="foundation-card"><p>Loading profile…</p></section>;
  if (error && !profile) return <section className="foundation-card"><p>{error}</p></section>;
  if (!profile) return <section className="foundation-card"><p>Profile not found.</p></section>;

  return (
    <section className="foundation-card">
      <p className="eyebrow">Phase 1 · Profile</p>
      <h2>@{profile.username}</h2>
      <label>
        Display name
        <input value={form.display_name} onChange={(event) => setForm({ ...form, display_name: event.target.value })} />
      </label>
      <label>
        Bio
        <textarea value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} />
      </label>
      <label>
        Avatar URL
        <input value={form.avatar_url} onChange={(event) => setForm({ ...form, avatar_url: event.target.value })} />
      </label>
      <button disabled={saving} onClick={() => void handleSave()}>
        {saving ? 'Saving…' : 'Save profile'}
      </button>
      {saved && <p>Profile saved.</p>}
      {error && <p>{error}</p>}
    </section>
  );
}
