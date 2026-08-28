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

  return <div className="auth-card premium-signup-card">
    <style>{`
      .premium-signup-card { position: relative; overflow: hidden; width: min(100%, 560px); padding: 34px; border: 1px solid rgba(99,102,241,.18); border-radius: 28px; background: linear-gradient(145deg, rgba(255,255,255,.98), rgba(246,245,255,.96) 55%, rgba(239,251,255,.94)); box-shadow: 0 24px 60px rgba(15,23,42,.12), 0 8px 24px rgba(79,70,229,.08), inset 0 1px 0 #fff; isolation: isolate; }
      .premium-signup-card::before { content: ''; position: absolute; width: 330px; height: 230px; top: -150px; left: 50%; transform: translateX(-50%); border-radius: 50%; background: radial-gradient(circle, rgba(109,93,252,.22), rgba(34,193,220,.08) 46%, transparent 72%); pointer-events: none; z-index: -1; }
      .premium-signup-card h1 { margin: 0 0 7px; font-size: clamp(29px, 6vw, 38px); line-height: 1.05; font-weight: 950; letter-spacing: -.045em; color: transparent; background: linear-gradient(135deg, #5146e5, #6d5dfc 45%, #18aeca); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
      .premium-signup-card > p:first-of-type { margin: 0 0 25px; color: #64748b; font-size: 14px; font-weight: 650; line-height: 1.5; }
      .premium-signup-card > button:not(.link-button) { width: 100%; min-height: 50px; border: 1px solid rgba(148,163,184,.24); border-radius: 15px; background: rgba(255,255,255,.88); color: #1e293b; font: inherit; font-size: 14px; font-weight: 850; box-shadow: 0 7px 18px rgba(15,23,42,.06), inset 0 1px 0 #fff; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
      .premium-signup-card > button:not(.link-button):hover:not(:disabled) { transform: translateY(-1px); border-color: rgba(109,93,252,.28); box-shadow: 0 10px 24px rgba(79,70,229,.11), inset 0 1px 0 #fff; }
      .premium-signup-card > button:not(.link-button):active:not(:disabled) { transform: translateY(1px); }
      .premium-signup-card button:disabled { opacity: .58; cursor: default; }
      .premium-signup-card .auth-divider { display: flex; align-items: center; gap: 12px; margin: 23px 0; color: #94a3b8; font-size: 10px; font-weight: 900; letter-spacing: .18em; }
      .premium-signup-card .auth-divider::before, .premium-signup-card .auth-divider::after { content: ''; height: 1px; flex: 1; background: linear-gradient(90deg, transparent, rgba(148,163,184,.32), transparent); }
      .premium-signup-card form { display: grid; gap: 12px; margin: 0; }
      .premium-signup-card form input { width: 100%; min-height: 50px; padding: 12px 15px; border: 1px solid rgba(148,163,184,.30); border-radius: 15px; outline: none; background: rgba(255,255,255,.82); color: #17202a; font: inherit; font-size: 14px; font-weight: 600; box-shadow: inset 0 1px 0 rgba(255,255,255,.96), 0 3px 10px rgba(15,23,42,.025); transition: border-color .18s ease, box-shadow .18s ease, background .18s ease; }
      .premium-signup-card form input::placeholder { color: #94a3b8; font-weight: 550; }
      .premium-signup-card form input:hover { border-color: rgba(109,93,252,.30); background: rgba(255,255,255,.94); }
      .premium-signup-card form input:focus { border-color: rgba(109,93,252,.68); background: #fff; box-shadow: 0 0 0 4px rgba(109,93,252,.08), 0 8px 20px rgba(79,70,229,.08), inset 0 1px 0 #fff; }
      .premium-signup-card form button[type="submit"] { width: 100%; min-height: 51px; margin-top: 4px; border: 0; border-radius: 15px; background: linear-gradient(135deg, #5146e5, #6d5dfc 48%, #18aeca); color: #fff; font: inherit; font-size: 14px; font-weight: 900; box-shadow: 0 10px 23px rgba(79,70,229,.22), inset 0 1px 0 rgba(255,255,255,.25); cursor: pointer; transition: transform .18s ease, box-shadow .18s ease; }
      .premium-signup-card form button[type="submit"]:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 13px 28px rgba(79,70,229,.27), inset 0 1px 0 rgba(255,255,255,.28); }
      .premium-signup-card form button[type="submit"]:active:not(:disabled) { transform: translateY(1px); }
      .premium-signup-card p[role="status"] { margin: 15px 0 0; padding: 11px 13px; border: 1px solid rgba(109,93,252,.13); border-radius: 13px; background: rgba(246,245,255,.86); color: #475569; font-size: 13px; line-height: 1.45; overflow-wrap: anywhere; }
      .premium-signup-card .link-button { display: block; width: 100%; margin: 18px 0 0; padding: 9px; border: 0; background: transparent; color: #5b4de8; font: inherit; font-size: 13px; font-weight: 850; cursor: pointer; transition: color .18s ease, transform .18s ease; }
      .premium-signup-card .link-button:hover { color: #3f36b8; transform: translateY(-1px); }
      @media (max-width: 600px) { .premium-signup-card { padding: 25px 18px 21px; border-radius: 22px; } .premium-signup-card > p:first-of-type { margin-bottom: 21px; } .premium-signup-card form { gap: 10px; } .premium-signup-card form input, .premium-signup-card > button:not(.link-button), .premium-signup-card form button[type="submit"] { min-height: 48px; } }
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
