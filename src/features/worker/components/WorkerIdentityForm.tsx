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

const MACHINE_TYPES = [
  'Singer / Sewing Machine',
  'Button Machine',
  'Kaaj / Overlock Machine',
  'Industrial Sewing Machine',
  'Cutting Machine',
  'Press / Ironing Machine',
  'Packaging Machine',
  'CNC Machine',
  'Lathe Machine',
  'Drill Machine',
  'Other Machine',
] as const;

function skillKey(skill: string) {
  return skill.split(' — ')[0].trim();
}

export function WorkerIdentityForm({ workerProfile, profile, saving, onSave }: WorkerIdentityFormProps) {
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [machineType, setMachineType] = useState('');
  const [machineOther, setMachineOther] = useState('');
  const [otherSkill, setOtherSkill] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDescription(workerProfile?.work_description ?? '');
    setSkills(workerProfile?.skills ?? []);
  }, [workerProfile]);

  const selectedKeys = useMemo(() => new Set(skills.map(skillKey)), [skills]);
  const hasMachine = selectedKeys.has('Machine Operator');
  const hasOther = selectedKeys.has('Other');

  const addSkill = (skill: string) => {
    if (selectedKeys.has(skill)) return;
    setSkills((current) => [...current, skill]);
    setSaved(false);
  };

  const removeSkill = (skill: string) => {
    setSkills((current) => current.filter((item) => item !== skill));
    if (skillKey(skill) === 'Machine Operator') {
      setMachineType('');
      setMachineOther('');
    }
    if (skillKey(skill) === 'Other') setOtherSkill('');
    setSaved(false);
  };

  const applyMachineType = (value: string) => {
    setMachineType(value);
    setSkills((current) => {
      const withoutMachine = current.filter((item) => skillKey(item) !== 'Machine Operator');
      if (!value) return withoutMachine;
      const label = value === 'Other Machine' && machineOther.trim()
        ? `Machine Operator — ${machineOther.trim()}`
        : `Machine Operator — ${value}`;
      return [...withoutMachine, label];
    });
    setSaved(false);
  };

  const applyMachineOther = (value: string) => {
    setMachineOther(value);
    if (machineType !== 'Other Machine') return;
    setSkills((current) => [
      ...current.filter((item) => skillKey(item) !== 'Machine Operator'),
      ...(value.trim() ? [`Machine Operator — ${value.trim()}`] : []),
    ]);
    setSaved(false);
  };

  const applyOtherSkill = (value: string) => {
    setOtherSkill(value);
    setSkills((current) => [
      ...current.filter((item) => skillKey(item) !== 'Other'),
      ...(value.trim() ? [`Other — ${value.trim()}`] : []),
    ]);
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

        <div>
          <span style={{ display: 'block', marginBottom: 4, fontWeight: 700 }}>Skills & Work Areas</span>
          <span style={{ display: 'block', color: '#64748b', fontSize: 13, lineHeight: 1.45, marginBottom: 10 }}>
            Choose the work you actually do. You can add more than one skill.
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
        </div>

        {hasMachine && (
          <div style={{ padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'grid', gap: 10 }}>
            <label>
              <span style={{ display: 'block', marginBottom: 6, fontWeight: 700 }}>Machine Type</span>
              <select value={machineType} onChange={(event) => applyMachineType(event.target.value)} style={{ width: '100%', boxSizing: 'border-box' }}>
                <option value="">Select machine type</option>
                {MACHINE_TYPES.map((machine) => <option key={machine} value={machine}>{machine}</option>)}
              </select>
            </label>
            {machineType === 'Other Machine' && (
              <label>
                <span style={{ display: 'block', marginBottom: 6, fontWeight: 700 }}>Machine name / type</span>
                <input
                  value={machineOther}
                  onChange={(event) => applyMachineOther(event.target.value)}
                  placeholder="Enter the machine name or type"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </label>
            )}
          </div>
        )}

        {hasOther && (
          <label style={{ padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <span style={{ display: 'block', marginBottom: 6, fontWeight: 700 }}>Describe the other skill</span>
            <input
              value={otherSkill}
              onChange={(event) => applyOtherSkill(event.target.value)}
              placeholder="e.g. Tailor, Electrician, Welder, Accountant"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </label>
        )}

        {skills.length > 0 && (
          <div>
            <span style={{ display: 'block', marginBottom: 7, fontWeight: 700, fontSize: 13 }}>Selected</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {skills.map((skill) => (
                <span key={skill} style={{ borderRadius: 999, padding: '6px 10px', background: '#f1f5f9', color: '#334155', fontSize: 13, fontWeight: 700 }}>
                  {skill}
                  <button type="button" onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`} style={{ border: 0, background: 'transparent', marginLeft: 5, cursor: 'pointer', fontWeight: 900 }}>×</button>
                </span>
              ))}
            </div>
          </div>
        )}
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
