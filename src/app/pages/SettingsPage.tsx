import { navigate } from '../Router';

export function SettingsPage() {
  return <main>
    <h1>Profile Settings</h1>
    <section className="foundation-card">
      <h2>Privacy & Safety</h2>
      <p>Manage who can interact with you.</p>
      <button type="button" onClick={() => navigate('/blocked-users')}>🚫 Blocked Users</button>
    </section>
  </main>;
}
