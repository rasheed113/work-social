import { ProfilePanel } from '../../features/profile/components/ProfilePanel';

interface ProfilePageProps { profileId: string; }

export function ProfilePage({ profileId }: ProfilePageProps) {
  return <main><h1>Profile</h1><ProfilePanel profileId={profileId} /></main>;
}
