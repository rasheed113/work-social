import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { WorkerProfile } from '../types/workerProfile';

interface WorkerIdentityFormProps {
  workerProfile: WorkerProfile | null;
  profile: { display_name: string; avatar_url: string | null; gender: string | null } | null;
  saving: boolean;
  onSave: (input: { work_description: string; skills: string[] }) => Promise<{ error: Error | null }>;
}

export function WorkerIdentityForm({ workerProfile, profile, saving, onSave }: WorkerIdentityFormProps) {
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDescription(workerProfile?.work_description ?? '');
    setSkills(workerProfile?.skills ?? []);
  }, [workerProfile]);

  const addSkill = () => {
    const value = skillInput.trim();
    if (!value || skills.includes(value)) return;
    setSkills((current) => [...current, value]);
    setSkillInput('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    const result = await onSave({ work_description: description, skills });
    setSaved(!result.error);
  };

  return (
    <form className="worker-identity-form" onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
      <section className="foundation-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" width={56} height={56} style={{ borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div aria-hidden="true" style={{ width: 56, height: 56, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#e2e8f0', fontWeight: 800 }}>
            {(profile?.display_name?.trim().charAt(0) || 'W').toUpperCase()}
          </div>
        )}
        <div>
          <strong>{profile?.display_name || 'Your profile'}</strong>
          <div style={{ color: '#64748b', fontSize: 13 }}>Worker Identity</div>
          {profile?.gender && <div style={{ color: '#64748b', fontSize: 12 }}>Gender: {profile.gender}</div>}
        </div>
      </section>

      <section className="foundation-card" style={{ display: 'grid', gap: 12 }}>
        <label>
          <span style={{ display: 'block', marginBottom: 6, fontWeight: 700 }}>Work Role</span>
          <input value="Worker" readOnly aria-readonly="true" style={{ width: '100%', boxSizing: 'border-box' }} />
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 6, fontWeight: 700 }}>Describe Your Work</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
            placeholder="Tell people what you do."
            style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
          />
        </label>

        <div>
          <span style={{ display: 'block', marginBottom: 6, fontWeight: 700 }}>Skills</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={skillInput}
              onChange={(event) => setSkillInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addSkill();
                }
              }}
              placeholder="Add a skill"
              style={{ flex: 1, minWidth: 0 }}
            />
            <button type="button" onClick={addSkill}>Add</button>
          </div>
          {skills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
              {skills.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => setSkills((current) => current.filter((item) => item !== skill))}
                  aria-label={`Remove ${skill}`}
                  style={{ borderRadius: 999, padding: '6px 10px' }}
                >
                  {skill} ×
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {workerProfile?.work_id && (
        <section className="foundation-card">
          <div style={{ color: '#64748b', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em' }}>Work ID</div>
          <code style={{ display: 'block', marginTop: 6, overflowWrap: 'anywhere' }}>{workerProfile.work_id}</code>
        </section>
      )}

      <button type="submit" disabled={saving} style={{ minHeight: 46 }}>
        {saving ? 'Saving…' : 'Save Work Identity'}
      </button>
      {saved && <p role="status" style={{ margin: 0 }}>Work Identity saved.</p>}
    </form>
  );
}
