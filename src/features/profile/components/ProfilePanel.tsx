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

function formatJoinedDate(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
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
      setSaved(false);

      const { data, error: profileError } = await getProfile(profileId);
      if (!active) return;

      if (profileError || !data) {
        setProfile(null);
        setError(profileError?.message ?? 'Profile could not be loaded.');
        setLoading(false);
        return;
      }

      const nextProfile = data as Profile;
      setProfile(nextProfile);
      setForm({
        display_name: nextProfile.display_name ?? '',
        bio: nextProfile.bio ?? '',
        date_of_birth: nextProfile.date_of_birth ?? '',
        gender: nextProfile.gender ?? '',
        location: nextProfile.location ?? '',
        website: nextProfile.website ?? '',
      });
      setLoading(false);
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, [profileId]);

  async function handleSave() {
    if (!profile) return;

    setSaving(true);
    setSaved(false);
    setError(null);

    const normalized: ProfileUpdateInput = {
      display_name: form.display_name.trim(),
      bio: form.bio.trim(),
      date_of_birth: form.date_of_birth,
      gender: form.gender,
      location: form.location.trim(),
      website: form.website.trim(),
    };

    if (!normalized.display_name) {
      setError('Display name is required.');
      setSaving(false);
      return;
    }

    const { data, error: updateError } = await updateProfile(profileId, normalized);
    if (updateError || !data) {
      setError(updateError?.message ?? 'Profile could not be saved.');
      setSaving(false);
      return;
    }

    const savedProfile = data as Profile;
    setProfile(savedProfile);
    setForm({
      display_name: savedProfile.display_name ?? '',
      bio: savedProfile.bio ?? '',
      date_of_birth: savedProfile.date_of_birth ?? '',
      gender: savedProfile.gender ?? '',
      location: savedProfile.location ?? '',
      website: savedProfile.website ?? '',
    });
    setSaved(true);
    setSaving(false);
  }

  function handleAvatarUploaded(publicUrl: string) {
    setProfile((current) => (current ? { ...current, avatar_url: publicUrl } : current));
    setSaved(true);
    setError(null);
  }

  if (loading) {
    return <section className="foundation-card"><p>Loading profile…</p></section>;
  }

  if (error && !profile) {
    return <section className="foundation-card"><p role="alert">{error}</p></section>;
  }

  if (!profile) {
    return <section className="foundation-card"><p>Profile not found.</p></section>;
  }

  const age = calculateAge(profile.date_of_birth);

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
        <input
          value={form.display_name}
          onChange={(event) => setForm((current) => ({ ...current, display_name: event.target.value }))}
          autoComplete="name"
        />
      </label>

      <label>
        Bio
        <textarea
          value={form.bio}
          onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
          rows={3}
        />
      </label>

      <label>
        Date of birth
        <input
          type="date"
          value={form.date_of_birth}
          onChange={(event) => setForm((current) => ({ ...current, date_of_birth: event.target.value }))}
        />
      </label>

      {age !== null && <p>Age: {age}</p>}

      <label>
        Gender
        <select
          value={form.gender}
          onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
        >
          <option value="">Prefer not to say</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="non_binary">Non-binary</option>
          <option value="other">Other</option>
        </select>
      </label>

      <label>
        Location
        <input
          value={form.location}
          onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
          placeholder="City, country"
          autoComplete="address-level2"
        />
      </label>

      <label>
        Website
        <input
          type="url"
          value={form.website}
          onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))}
          placeholder="https://example.com"
          autoComplete="url"
        />
      </label>

      <p>Joined {formatJoinedDate(profile.created_at)}</p>

      <button type="button" disabled={saving} onClick={() => void handleSave()}>
        {saving ? 'Saving…' : 'Save profile'}
      </button>

      {saved && <p role="status">Profile saved.</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
