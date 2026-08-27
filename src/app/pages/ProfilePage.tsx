import { ProfilePanel } from '../../features/profile/components/ProfilePanel';
import { signOut } from '../../features/auth/api/signOut';

interface ProfilePageProps { profileId: string; viewerId?: string; }

export function ProfilePage({ profileId, viewerId }: ProfilePageProps) {
  const isOwner = !viewerId || viewerId === profileId;
  return <main className="premium-profile-page">
    <style>{`
      .premium-profile-page { min-width: 0; }
      .premium-profile-page > h1 {
        margin: 0 0 14px;
        font-size: clamp(28px, 5vw, 40px);
        line-height: 1.05;
        font-weight: 900;
        letter-spacing: -.035em;
        color: transparent;
        background: linear-gradient(135deg, #6d5dfc 0%, #22c1dc 48%, #ff5ca8 100%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        text-shadow: 0 3px 0 rgba(255,255,255,.8), 0 7px 18px rgba(79,70,229,.16);
      }
      .premium-profile-page .foundation-card {
        position: relative;
        min-width: 0;
        box-sizing: border-box;
        border: 1px solid rgba(99,102,241,.14);
        border-radius: 18px;
        background: linear-gradient(145deg, rgba(255,255,255,.98), rgba(241,245,255,.94));
        box-shadow: 0 9px 24px rgba(15,23,42,.07), inset 0 1px 0 rgba(255,255,255,.96);
      }
      .premium-profile-page section[style*="text-align:center"] { overflow: hidden; }
      .premium-profile-page section[style*="text-align:center"]::before {
        content: '';
        position: absolute;
        width: 150px;
        height: 150px;
        top: -82px;
        left: 50%;
        transform: translateX(-50%);
        border-radius: 50%;
        background: radial-gradient(circle, rgba(109,93,252,.16), rgba(34,193,220,0));
        pointer-events: none;
      }
      .premium-profile-page section[style*="text-align:center"] > img {
        position: relative;
        border: 4px solid white;
        box-shadow: 0 7px 22px rgba(79,70,229,.20);
      }
      .premium-profile-page section[style*="text-align:center"] > h2 {
        margin: 12px 0 4px;
        font-size: clamp(22px, 5vw, 30px);
        font-weight: 900;
        letter-spacing: -.025em;
        color: #17202a;
        text-shadow: 0 2px 7px rgba(23,32,42,.10);
      }
      .premium-profile-page section[style*="text-align:center"] button,
      .premium-profile-page > section > .foundation-card button {
        border: 0;
        border-radius: 999px;
        padding: 8px 13px;
        font-weight: 800;
        box-shadow: 0 5px 14px rgba(15,23,42,.08);
      }
      .premium-profile-page > section > section:not(.foundation-card) { min-width: 0; }
      .premium-profile-page > section > footer.foundation-card {
        border-radius: 15px;
        box-shadow: 0 6px 18px rgba(15,23,42,.055);
      }
      @media (max-width: 767px) {
        .premium-profile-page > h1 { margin-bottom: 12px; }
        .premium-profile-page section[style*="text-align:center"] > h2 { font-size: 22px; }
      }
    `}</style>
    <h1>{isOwner ? 'Profile' : 'Public Profile'}</h1>
    <ProfilePanel profileId={profileId} viewerId={viewerId} />
    {isOwner && <section className="foundation-card" aria-label="Account">
      <h2>Account</h2>
      <button type="button" onClick={() => void signOut()}>Sign out</button>
    </section>}
  </main>;
}
