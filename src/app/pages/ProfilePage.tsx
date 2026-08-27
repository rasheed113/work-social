import { ProfilePanel } from '../../features/profile/components/ProfilePanel';
import { signOut } from '../../features/auth/api/signOut';

interface ProfilePageProps { profileId: string; viewerId?: string; }

export function ProfilePage({ profileId, viewerId }: ProfilePageProps) {
  const isOwner = !viewerId || viewerId === profileId;
  return <main>
    <h1>{isOwner ? 'Profile' : 'Public Profile'}</h1>
    <ProfilePanel profileId={profileId} viewerId={viewerId} />
    {isOwner && <section className="foundation-card" aria-label="Account">
      <h2>Account</h2>
      <button type="button" onClick={() => void signOut()}>Sign out</button>
    </section>}
  </main>;
}
