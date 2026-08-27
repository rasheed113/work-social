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

  return <div className="auth-card">
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
