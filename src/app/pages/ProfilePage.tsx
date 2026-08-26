import { ProfilePanel } from '../../features/profile/components/ProfilePanel';
import { signOut } from '../../features/auth/api/signOut';

interface ProfilePageProps { profileId: string; }

export function ProfilePage({ profileId }: ProfilePageProps) {
  return <main>
    <h1>Profile</h1>
    <ProfilePanel profileId={profileId} />
    <section className="foundation-card" aria-label="Account">
      <h2>Account</h2>
      <button type="button" onClick={() => void signOut()}>Sign out</button>
    </section>
  </main>;
}
