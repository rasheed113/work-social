import { useEffect, useState } from 'react';
import type { ProfileUpdateInput } from '../api/updateProfile';
import { getProfile } from '../api/getProfile';
import { updateProfile } from '../api/updateProfile';
import { AvatarUploader } from './AvatarUploader';

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

interface ProfilePanelProps {
  profileId: string;
}

function calculateAge(dateOfBirth: string | null) {
  if (!dateOfBirth) return null;
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

export function ProfilePanel({ profileId }: ProfilePanelProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<ProfileUpdateInput>({
    display_name: '',
    bio: '',
    date_of_birth: '',
    gender: '',
    location: '',
    website: '',
  });
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

      setProfile(data as Profile);
      setForm({
        display_name: data.display_name ?? '',
        bio: data.bio ?? '',
        date_of_birth: data.date_of_birth ?? '',
        gender: data.gender ?? '',
        location: data.location ?? '',
        website: data.website ?? '',
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

    setProfile(data as Profile);
    setSaved(true);
    setSaving(false);
  }

  function handleAvatarUploaded(publicUrl: string) {
    setProfile((current) => (current ? { ...current, avatar_url: publicUrl } : current));
    setSaved(true);
  }

  if (loading) return <section className="foundation-card"><p>Loading profile…</p></section>;
  if (error && !profile) return <section className="foundation-card"><p>{error}</p></section>;
  if (!profile) return <section className="foundation-card"><p>Profile not found.</p></section>;

  const age = calculateAge(profile.date_of_birth);
  const joinedDate = new Date(profile.created_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  });

  return (
    <section className="foundation-card">
      <p className="eyebrow">Phase 1 · Profile</p>

      <AvatarUploader
        userId={profileId}
        avatarUrl={profile.avatar_url}
        onUploaded={handleAvatarUploaded}
      />

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
        Date of birth
        <input type="date" value={form.date_of_birth} onChange={(event) => setForm({ ...form, date_of_birth: event.target.value })} />
      </label>

      {age !== null && <p>Age: {age}</p>}

      <label>
        Gender
        <select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}>
          <option value="">Prefer not to say</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="non_binary">Non-binary</option>
          <option value="other">Other</option>
        </select>
      </label>

      <label>
        Location
        <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="City, country" />
      </label>

      <label>
        Website
        <input type="url" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} placeholder="https://example.com" />
      </label>

      <p>Joined {joinedDate}</p>

      <button disabled={saving} onClick={() => void handleSave()}>
        {saving ? 'Saving…' : 'Save profile'}
      </button>

      {saved && <p>Profile saved.</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
