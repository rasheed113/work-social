import { FormEvent, useState } from 'react';
import { signIn } from '../api/signIn';
import { signInWithGoogle } from '../api/signInWithGoogle';

export function LoginForm({ onSignup }: { onSignup: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    const { error } = await signIn(email, password);
    setLoading(false);
    setMessage(error ? error.message : 'Signed in successfully.');
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
    <h1>Work Social</h1>
    <p>Sign in to your account</p>
    <button onClick={handleGoogle} disabled={loading}>Continue with Google</button>
    <div className="auth-divider">OR</div>
    <form onSubmit={handleSubmit}>
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
      <button type="submit" disabled={loading}>{loading ? 'Please wait…' : 'Sign In'}</button>
    </form>
    {message && <p role="status">{message}</p>}
    <button className="link-button" onClick={onSignup}>Create account</button>
    <p className="auth-hold">Phone login — Coming Soon</p>
  </div>;
}
