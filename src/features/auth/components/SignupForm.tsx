import { FormEvent, useState } from 'react';
import { signUp } from '../api/signUp';
import { signInWithGoogle } from '../api/signInWithGoogle';

export function SignupForm({ onLogin }: { onLogin: () => void }) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    const { data, error } = await signUp(email, password, displayName);
    setLoading(false);
    if (error) return setMessage(error.message);
    setMessage(data.session ? 'Account created and signed in.' : 'Account created. Check your email if verification is required.');
  }

  async function handleGoogle() {
    setLoading(true);
    setMessage('');
    const { error } = await signInWithGoogle();
    if (error) {
      setLoading(false);
      setMessage(error.message);
    }
  }

  return <div className="auth-card ws-auth-card">
    <style>{`
      .app-shell:has(.ws-auth-card) {
        position: relative;
        min-height: 100dvh;
        overflow-x: hidden;
        overflow-y: auto;
        padding: clamp(18px, 4vw, 32px) !important;
        background: radial-gradient(600px 360px at 12% 8%, rgba(93,82,224,.13), transparent 68%), radial-gradient(520px 340px at 88% 92%, rgba(23,174,202,.11), transparent 70%), linear-gradient(145deg, #f7f8fc 0%, #f3f4fa 48%, #f4f8fa 100%);
        isolation: isolate;
      }
      .app-shell:has(.ws-auth-card)::before, .app-shell:has(.ws-auth-card)::after { content: ''; position: fixed; pointer-events: none; z-index: -1; border-radius: 999px; filter: blur(2px); }
      .app-shell:has(.ws-auth-card)::before { width: 280px; height: 280px; top: -170px; right: -90px; background: radial-gradient(circle, rgba(109,93,252,.12), transparent 70%); }
      .app-shell:has(.ws-auth-card)::after { width: 300px; height: 300px; bottom: -190px; left: -120px; background: radial-gradient(circle, rgba(34,193,220,.10), transparent 70%); }
      .ws-auth-card { width: min(100%, 438px); max-width: 438px; margin: auto; padding: clamp(24px, 5vw, 34px); border: 1px solid rgba(255,255,255,.82); border-radius: 26px; background: linear-gradient(145deg, rgba(255,255,255,.91), rgba(248,249,253,.86) 58%, rgba(242,247,249,.88)); box-shadow: 0 30px 70px rgba(15,23,42,.12), 0 10px 28px rgba(79,70,229,.06), inset 0 1px 0 rgba(255,255,255,.98), inset 0 -1px 0 rgba(148,163,184,.08); backdrop-filter: blur(18px) saturate(125%); -webkit-backdrop-filter: blur(18px) saturate(125%); color: #17202a; overflow: hidden; position: relative; }
      .ws-auth-card::before { content: ''; position: absolute; inset: 0 0 auto; height: 1px; background: linear-gradient(90deg, transparent, rgba(109,93,252,.34), rgba(34,193,220,.24), transparent); pointer-events: none; }
      .ws-auth-card h1 { margin: 0 0 8px; font-size: clamp(29px, 7vw, 36px); line-height: 1.04; font-weight: 900; letter-spacing: -.045em; color: #17202a; }
      .ws-auth-card > p:first-of-type { margin: 0 0 24px; color: #667085; font-size: 14px; font-weight: 550; line-height: 1.5; letter-spacing: .005em; }
      .ws-auth-card > button:not(.link-button) { width: 100%; min-height: 50px; padding: 12px 16px; border: 1px solid rgba(148,163,184,.28); border-radius: 14px; background: rgba(255,255,255,.82); color: #1f2937; font: inherit; font-size: 14px; font-weight: 800; box-shadow: inset 0 1px 0 rgba(255,255,255,.98), 0 6px 16px rgba(15,23,42,.055); cursor: pointer; transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease, background .18s ease; }
      .ws-auth-card > button:not(.link-button):hover:not(:disabled) { transform: translateY(-1px); border-color: rgba(109,93,252,.28); background: rgba(255,255,255,.96); box-shadow: inset 0 1px 0 #fff, 0 10px 22px rgba(15,23,42,.075), 0 0 20px rgba(109,93,252,.055); }
      .ws-auth-card > button:not(.link-button):active:not(:disabled) { transform: translateY(1px); }
      .ws-auth-card button:focus-visible, .ws-auth-card input:focus-visible { outline: 3px solid rgba(109,93,252,.14); outline-offset: 2px; }
      .ws-auth-card button:disabled { opacity: .58; cursor: default; box-shadow: none; }
      .ws-auth-card .auth-divider { display: flex; align-items: center; gap: 12px; margin: 22px 0; color: #98a2b3; font-size: 10px; font-weight: 850; letter-spacing: .18em; }
      .ws-auth-card .auth-divider::before, .ws-auth-card .auth-divider::after { content: ''; height: 1px; flex: 1; background: linear-gradient(90deg, transparent, rgba(148,163,184,.34), transparent); }
      .ws-auth-card form { display: grid; gap: 12px; margin: 0; }
      .ws-auth-card form input { width: 100%; min-height: 50px; padding: 12px 15px; border: 1px solid rgba(148,163,184,.30); border-radius: 14px; outline: none; background: rgba(255,255,255,.72); color: #17202a; font: inherit; font-size: 14px; font-weight: 600; box-shadow: inset 0 1px 0 rgba(255,255,255,.95), 0 3px 10px rgba(15,23,42,.025); transition: border-color .18s ease, box-shadow .18s ease, background .18s ease, transform .18s ease; }
      .ws-auth-card form input::placeholder { color: #98a2b3; font-weight: 500; }
      .ws-auth-card form input:hover { border-color: rgba(109,93,252,.30); background: rgba(255,255,255,.9); }
      .ws-auth-card form input:focus { border-color: rgba(109,93,252,.64); background: #fff; box-shadow: 0 0 0 4px rgba(109,93,252,.075), 0 8px 20px rgba(79,70,229,.07), inset 0 1px 0 #fff; }
      .ws-auth-card form button[type="submit"] { width: 100%; min-height: 50px; margin-top: 3px; border: 0; border-radius: 14px; background: linear-gradient(135deg, #5146e5 0%, #695df5 52%, #18aeca 100%); color: #fff; font: inherit; font-size: 14px; font-weight: 850; letter-spacing: .005em; box-shadow: 0 11px 24px rgba(79,70,229,.20), inset 0 1px 0 rgba(255,255,255,.24); cursor: pointer; transition: transform .18s ease, box-shadow .18s ease, filter .18s ease; }
      .ws-auth-card form button[type="submit"]:hover:not(:disabled) { transform: translateY(-1px); filter: saturate(1.04); box-shadow: 0 14px 29px rgba(79,70,229,.25), inset 0 1px 0 rgba(255,255,255,.27); }
      .ws-auth-card form button[type="submit"]:active:not(:disabled) { transform: translateY(1px); }
      .ws-auth-card p[role="status"] { margin: 14px 0 0; padding: 11px 13px; border: 1px solid rgba(109,93,252,.14); border-radius: 12px; background: rgba(246,245,255,.76); color: #475467; font-size: 13px; line-height: 1.45; overflow-wrap: anywhere; }
      .ws-auth-card .link-button { display: block; width: 100%; margin: 16px 0 0; padding: 8px 10px; border: 0; border-radius: 10px; background: transparent; color: #5146e5; font: inherit; font-size: 13px; font-weight: 800; cursor: pointer; transition: color .18s ease, background .18s ease, transform .18s ease; }
      .ws-auth-card .link-button:hover { color: #3f36b8; background: rgba(109,93,252,.055); transform: translateY(-1px); }
      .ws-auth-card .auth-hold { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 16px 0 0; padding: 9px 11px; border: 1px solid rgba(148,163,184,.20); border-radius: 11px; background: rgba(248,250,252,.58); color: #7b8798; font-size: 11px; font-weight: 650; letter-spacing: .01em; }
      .ws-auth-card .auth-hold::before { content: 'SOON'; padding: 3px 6px; border: 1px solid rgba(109,93,252,.14); border-radius: 999px; background: rgba(109,93,252,.07); color: #6558dd; font-size: 8px; font-weight: 900; letter-spacing: .09em; }
      @media (max-width: 600px) { .app-shell:has(.ws-auth-card) { padding: 16px !important; } .ws-auth-card { padding: 24px 18px 20px; border-radius: 22px; } .ws-auth-card > p:first-of-type { margin-bottom: 21px; } .ws-auth-card form { gap: 10px; } .ws-auth-card form input, .ws-auth-card > button:not(.link-button), .ws-auth-card form button[type="submit"] { min-height: 48px; } }
    `}</style>
    <h1>Create account</h1>
    <p>Join Work Social</p>
    <button type="button" onClick={handleGoogle} disabled={loading}>Continue with Google</button>
    <div className="auth-divider">OR</div>
    <form onSubmit={handleSubmit}>
      <input placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
      <button type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button>
    </form>
    {message && <p role="status">{message}</p>}
    <button type="button" className="link-button" onClick={onLogin}>Back to sign in</button>
  </div>;
}
