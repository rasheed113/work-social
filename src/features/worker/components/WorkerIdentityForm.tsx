import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { WorkerProfile } from '../types/workerProfile';

interface WorkerIdentityFormProps {
  workerProfile: WorkerProfile | null;
  profile: { display_name: string; avatar_url: string | null; gender: string | null } | null;
  saving: boolean;
  onSave: (input: { work_description: string; skills: string[] }) => Promise<{ error: Error | null }>;
}

const SKILL_OPTIONS = [
  'Machine Operator',
  'Pressing / Ironing',
  'Packing',
  'Cutting / Cropping',
  'Production / Assembly',
  'Quality Control',
  'Warehouse / Store',
  'Driver / Delivery',
  'Office / Admin',
  'Sales / Customer Service',
  'Technician / Maintenance',
  'Other',
] as const;

function skillKey(skill: string) {
  return skill.split(' — ')[0].trim();
}

function skillPrompt(skill: string) {
  const prompts: Record<string, string> = {
    'Machine Operator': 'Describe the machine or machine work you handle. Example: Singer sewing machine, CNC machine, or another machine.',
    'Pressing / Ironing': 'Describe the pressing or ironing work you do. Example: steam press, garment ironing, or industrial press.',
    Packing: 'Describe the packing work you do. Example: garment packing, warehouse packing, or product packaging.',
    'Cutting / Cropping': 'Describe the cutting or cropping work you do. Example: fabric cutting, metal cutting, or crop work.',
    'Production / Assembly': 'Describe the production or assembly work you do.',
    'Quality Control': 'Describe what you inspect or check. Example: garment quality, product inspection, or final checking.',
    'Warehouse / Store': 'Describe your warehouse or store work. Example: stock handling, inventory, loading, or store management.',
    'Driver / Delivery': 'Describe the vehicle or delivery work you do. Example: Suzuki driver, truck driver, rider, or delivery van.',
    'Office / Admin': 'Describe your office or admin work. Example: data entry, accounts, reception, or office management.',
    'Sales / Customer Service': 'Describe your sales or customer service work.',
    'Technician / Maintenance': 'Describe the technical or maintenance work you do. Example: electrician, mechanic, machine maintenance, or HVAC.',
    Other: 'Describe this skill or type of work in your own words.',
  };
  return prompts[skill] ?? 'Describe this skill or type of work in your own words.';
}

export function WorkerIdentityForm({ workerProfile, profile, saving, onSave }: WorkerIdentityFormProps) {
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillDialog, setSkillDialog] = useState<string | null>(null);
  const [skillDescription, setSkillDescription] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDescription(workerProfile?.work_description ?? '');
    setSkills(workerProfile?.skills ?? []);
  }, [workerProfile]);

  const selectedKeys = useMemo(() => new Set(skills.map(skillKey)), [skills]);

  const addSkill = (skill: string) => {
    if (selectedKeys.has(skill)) return;
    setSkillDescription('');
    setSkillDialog(skill);
  };

  const confirmSkill = () => {
    const value = skillDescription.trim();
    if (!skillDialog || !value) return;
    setSkills((current) => [...current, `${skillDialog} — ${value}`]);
    setSkillDialog(null);
    setSkillDescription('');
    setSaved(false);
  };

  const removeSkill = (skill: string) => {
    setSkills((current) => current.filter((item) => item !== skill));
    setSaved(false);
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

      <section className="foundation-card" style={{ display: 'grid', gap: 14 }}>
        <label>
          <span style={{ display: 'block', marginBottom: 6, fontWeight: 700 }}>Work Role</span>
          <input value="Worker" readOnly aria-readonly="true" style={{ width: '100%', boxSizing: 'border-box' }} />
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 6, fontWeight: 700 }}>Describe Your Work</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            placeholder="Tell people what you do, your experience, or the kind of work you handle."
            style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
          />
        </label>

        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 800, padding: '4px 0' }}>Skills & Work Areas</summary>
          <div style={{ marginTop: 10, color: '#64748b', fontSize: 13, lineHeight: 1.45 }}>
            Select a skill and briefly describe exactly what you do. This works for any type of worker or company.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {SKILL_OPTIONS.map((skill) => {
              const selected = selectedKeys.has(skill);
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() => selected ? removeSkill(skill) : addSkill(skill)}
                  aria-pressed={selected}
                  style={{
                    borderRadius: 999,
                    padding: '8px 12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: selected ? '1px solid #0f172a' : '1px solid #cbd5e1',
                    background: selected ? '#0f172a' : '#fff',
                    color: selected ? '#fff' : '#334155',
                  }}
                >
                  {selected ? '✓ ' : ''}{skill}
                </button>
              );
            })}
          </div>
          {skills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
              {skills.map((skill) => (
                <span key={skill} style={{ borderRadius: 999, padding: '6px 10px', background: '#f1f5f9', color: '#334155', fontSize: 13, fontWeight: 700 }}>
                  {skill}
                  <button type="button" onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`} style={{ border: 0, background: 'transparent', marginLeft: 5, cursor: 'pointer', fontWeight: 900 }}>×</button>
                </span>
              ))}
            </div>
          )}
        </details>
      </section>

      {skillDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="worker-skill-dialog-title"
          onClick={() => setSkillDialog(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 23, 42, .45)', display: 'grid', placeItems: 'center', padding: 20 }}
        >
          <div className="foundation-card" onClick={(event) => event.stopPropagation()} style={{ width: 'min(100%, 480px)', boxSizing: 'border-box', display: 'grid', gap: 12 }}>
            <div>
              <div id="worker-skill-dialog-title" style={{ fontSize: 18, fontWeight: 900 }}>Describe {skillDialog}</div>
              <div style={{ marginTop: 5, color: '#64748b', fontSize: 13, lineHeight: 1.45 }}>{skillPrompt(skillDialog)}</div>
            </div>
            <textarea
              autoFocus
              value={skillDescription}
              onChange={(event) => setSkillDescription(event.target.value)}
              rows={4}
              placeholder="Describe it here…"
              style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setSkillDialog(null)}>Cancel</button>
              <button type="button" disabled={!skillDescription.trim()} onClick={confirmSkill}>Add Skill</button>
            </div>
          </div>
        </div>
      )}

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
