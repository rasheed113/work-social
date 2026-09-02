import { ProfilePanel } from '../../features/profile/components/ProfilePanel';
import { signOut } from '../../features/auth/api/signOut';

interface ProfilePageProps { profileId: string; viewerId?: string; }

export function ProfilePage({ profileId, viewerId }: ProfilePageProps) {
  const isOwner = !viewerId || viewerId === profileId;
  return <main className="premium-profile-page">
    <style>{`
      .premium-profile-page {
        min-width: 0;
        color: #17202a;
      }
      .premium-profile-page > h1 {
        margin: 0 0 16px;
        font-size: clamp(28px, 5vw, 40px);
        line-height: 1.05;
        font-weight: 950;
        letter-spacing: -.04em;
        color: transparent;
        background: linear-gradient(135deg, #5b4de8 0%, #6d5dfc 38%, #22b8d4 72%, #ff5ca8 100%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        filter: drop-shadow(0 7px 16px rgba(79,70,229,.14));
      }
      .premium-profile-page .foundation-card {
        position: relative;
        min-width: 0;
        box-sizing: border-box;
        overflow: hidden;
        border: 1px solid rgba(99,102,241,.15);
        border-radius: 22px;
        background: linear-gradient(145deg, rgba(255,255,255,.985), rgba(241,245,255,.94) 58%, rgba(248,250,252,.96));
        box-shadow: 0 14px 34px rgba(15,23,42,.075), 0 2px 7px rgba(79,70,229,.045), inset 0 1px 0 rgba(255,255,255,.98);
      }
      .premium-profile-page > section > section.foundation-card[style*="text-align:center"] {
        padding: 26px 20px 22px;
        isolation: isolate;
      }
      .premium-profile-page > section > section.foundation-card[style*="text-align:center"]::before {
        content: '';
        position: absolute;
        z-index: -1;
        width: 270px;
        height: 190px;
        top: -105px;
        left: 50%;
        transform: translateX(-50%);
        border-radius: 50%;
        background: radial-gradient(circle, rgba(109,93,252,.18) 0%, rgba(34,193,220,.08) 42%, rgba(255,92,168,0) 72%);
        pointer-events: none;
      }
      .premium-profile-page > section > section.foundation-card[style*="text-align:center"]::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: linear-gradient(180deg, rgba(255,255,255,.26), transparent 35%);
        pointer-events: none;
      }
      .premium-profile-page > section > section.foundation-card[style*="text-align:center"] > img {
        position: relative;
        z-index: 1;
        border: 4px solid rgba(255,255,255,.98);
        outline: 1px solid rgba(109,93,252,.16);
        box-shadow: 0 11px 28px rgba(79,70,229,.22), 0 0 0 7px rgba(109,93,252,.055);
      }
      .premium-profile-page > section > section.foundation-card[style*="text-align:center"] > h2 {
        position: relative;
        z-index: 1;
        margin: 16px 0 5px;
        font-size: clamp(23px, 5vw, 31px);
        line-height: 1.1;
        font-weight: 950;
        letter-spacing: -.03em;
        color: #111827;
        text-shadow: 0 2px 8px rgba(15,23,42,.09);
      }
      .premium-profile-page > section > section.foundation-card[style*="text-align:center"] > p {
        position: relative;
        z-index: 1;
        margin: 5px auto;
        max-width: 680px;
        color: #475569;
        line-height: 1.55;
      }
      .premium-profile-page > section > section.foundation-card[style*="text-align:center"] > p:first-of-type {
        color: #64748b;
        font-size: 13px;
        font-weight: 750;
      }
      .premium-profile-page > section > section.foundation-card[style*="text-align:center"] > div[style*="display:flex"] {
        position: relative;
        z-index: 2;
        margin-top: 17px;
      }
      .premium-profile-page button {
        min-height: 38px;
        border: 1px solid rgba(99,102,241,.12);
        border-radius: 999px;
        padding: 8px 14px;
        background: rgba(255,255,255,.86);
        color: #334155;
        font: inherit;
        font-size: 13px;
        font-weight: 850;
        box-shadow: 0 6px 16px rgba(15,23,42,.065), inset 0 1px 0 rgba(255,255,255,.96);
        transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease;
      }
      .premium-profile-page button:hover:not(:disabled) {
        transform: translateY(-1px);
        border-color: rgba(109,93,252,.28);
        box-shadow: 0 9px 20px rgba(79,70,229,.11), inset 0 1px 0 rgba(255,255,255,.98);
      }
      .premium-profile-page button:active:not(:disabled) { transform: translateY(0); }
      .premium-profile-page button:disabled { opacity: .58; cursor: default; }
      .premium-profile-page > section > section.foundation-card[style*="text-align:center"] > div[style*="display:flex"] button:first-child {
        background: linear-gradient(135deg, #6d5dfc, #22b8d4);
        border-color: transparent;
        color: #fff;
        box-shadow: 0 8px 19px rgba(79,70,229,.20), inset 0 1px 0 rgba(255,255,255,.24);
      }
      .premium-profile-page > section > section.foundation-card[style*="text-align:center"] > div[style*="display:flex"] button:first-child:hover:not(:disabled) {
        box-shadow: 0 11px 24px rgba(79,70,229,.25), inset 0 1px 0 rgba(255,255,255,.28);
      }
      .premium-profile-page > section > section:not(.foundation-card) {
        min-width: 0;
      }
      .premium-profile-page > section > footer.foundation-card {
        margin-top: 18px !important;
        padding: 13px 16px;
        border-radius: 17px;
        text-align: center;
        color: #64748b;
        font-size: 13px;
        box-shadow: 0 8px 22px rgba(15,23,42,.055), inset 0 1px 0 rgba(255,255,255,.96);
      }
      .premium-profile-page > section > footer.foundation-card p { margin: 0; }
      .premium-profile-page > section.foundation-card[aria-label="Account"] {
        margin-top: 18px;
        padding: 14px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        background: linear-gradient(145deg, rgba(255,255,255,.98), rgba(250,245,255,.95));
      }
      .premium-profile-page > section.foundation-card[aria-label="Account"] h2 {
        margin: 0;
        font-size: 16px;
        font-weight: 900;
        letter-spacing: -.015em;
      }
      .premium-profile-page > section.foundation-card[aria-label="Account"] h2::before {
        content: '⚙';
        display: inline-grid;
        place-items: center;
        width: 31px;
        height: 31px;
        margin-right: 9px;
        vertical-align: middle;
        border-radius: 10px;
        background: linear-gradient(135deg, rgba(109,93,252,.14), rgba(34,193,220,.12));
        box-shadow: inset 0 1px 0 rgba(255,255,255,.9);
        font-size: 14px;
      }
      .premium-profile-page > section.foundation-card[aria-label="Account"] button {
        flex-shrink: 0;
        min-height: 36px;
        border-color: rgba(220,38,38,.15);
        background: linear-gradient(135deg, rgba(254,242,242,.98), rgba(255,247,247,.96));
        color: #b4232d;
      }
      .premium-profile-page > section.foundation-card[aria-label="Account"] button:hover:not(:disabled) {
        border-color: rgba(220,38,38,.28);
        box-shadow: 0 8px 18px rgba(127,29,29,.10);
      }
      @media (max-width: 767px) {
        .premium-profile-page > h1 { margin-bottom: 13px; }
        .premium-profile-page > section > section.foundation-card[style*="text-align:center"] { padding: 22px 14px 19px; border-radius: 19px; }
        .premium-profile-page > section > section.foundation-card[style*="text-align:center"] > h2 { font-size: 23px; }
        .premium-profile-page button { min-height: 36px; padding: 7px 11px; font-size: 12.5px; }
        .premium-profile-page > section.foundation-card[aria-label="Account"] { padding: 12px 13px; }
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
