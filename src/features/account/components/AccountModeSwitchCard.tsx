import { useState } from 'react';
import { navigate } from '../../../app/Router';
import { setWorkerType } from '../../worker/api/salary';

export type AccountMode = 'salary_person' | 'contract' | 'contractor';

interface AccountModeSwitchCardProps {
  currentMode: AccountMode;
  profileId: string;
  onWorkerModeChanged?: () => Promise<void> | void;
}

const cardStyle = {
  padding: 10,
  border: '1px solid rgba(255,255,255,.78)',
  borderRadius: 13,
  background: 'linear-gradient(145deg,rgba(255,255,255,.97),rgba(238,242,255,.86))',
  boxShadow: '0 18px 42px rgba(15,23,42,.10), inset 0 1px 0 rgba(255,255,255,.95)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
};

const modes: Array<{ value: AccountMode; title: string; description: string; badge: string }> = [
  { value: 'salary_person', title: 'Salary Person', description: 'Fixed salary cycle with salary, attendance, overtime and allowance records.', badge: 'SALARY' },
  { value: 'contract', title: 'Work per Job / Contract', description: 'Existing contract-based Work House and earnings flow.', badge: 'CONTRACT' },
  { value: 'contractor', title: 'Contractor', description: 'Contractor account setup and future contractor workspace.', badge: 'CONTRACTOR' },
];

export function AccountModeSwitchCard({ currentMode, profileId, onWorkerModeChanged }: AccountModeSwitchCardProps) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState('');

  const current = modes.find((mode) => mode.value === currentMode) ?? modes[0];

  const choose = async (value: AccountMode) => {
    if (value === currentMode) {
      setOpen(false);
      return;
    }

    setError('');
    setSwitching(true);

    if (value === 'contractor') {
      setSwitching(false);
      setOpen(false);
      navigate('/work/contractor?view=settings');
      return;
    }

    const { error: updateError } = await setWorkerType(profileId, value);
    setSwitching(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setOpen(false);
    await onWorkerModeChanged?.();
    navigate('/work/settings');
  };

  return <>
    <section style={cardStyle} aria-labelledby="account-mode-switch-title">
      <button type="button" onClick={() => { setError(''); setOpen(true); }} disabled={switching} aria-haspopup="dialog" aria-expanded={open} style={{ width: '100%', border: 0, padding: 0, background: 'transparent', textAlign: 'left', cursor: switching ? 'wait' : 'pointer', font: 'inherit' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <h2 id="account-mode-switch-title" style={{ margin: 0, fontSize: 14, color: '#172033', letterSpacing: '-.015em' }}>Account / Work Mode</h2>
            <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: 10.5, lineHeight: 1.35 }}>Switch between your available account settings.</p>
          </div>
          <span style={{ flex: '0 0 auto', padding: '4px 7px', borderRadius: 999, fontSize: 8.5, fontWeight: 950, letterSpacing: '.07em', color: currentMode === 'contractor' ? '#047857' : '#4338ca', background: currentMode === 'contractor' ? 'rgba(16,185,129,.10)' : 'rgba(99,102,241,.10)', border: '1px solid rgba(99,102,241,.10)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.9)' }}>{current.badge}</span>
        </div>
        <div style={{ marginTop: 8, minHeight: 38, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '0 11px', borderRadius: 10, border: '1px solid rgba(99,102,241,.18)', background: 'linear-gradient(145deg,rgba(255,255,255,.95),rgba(238,242,255,.72))', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.95), 0 7px 16px rgba(79,70,229,.07)' }}>
          <span style={{ color: '#172033', fontSize: 12, fontWeight: 800 }}>{current.title}</span>
          <span aria-hidden="true" style={{ color: '#6366f1', fontSize: 16, fontWeight: 900 }}>⌄</span>
        </div>
      </button>
      {error && <p role="alert" style={{ margin: '6px 0 0', color: '#b91c1c', fontSize: 10.5 }}>{error}</p>}
    </section>

    {open && <div role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !switching) setOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15,23,42,.48)', backdropFilter: 'blur(9px)', WebkitBackdropFilter: 'blur(9px)' }}>
      <section role="dialog" aria-modal="true" aria-labelledby="account-mode-dialog-title" style={{ width: 'min(100%, 430px)', padding: 16, borderRadius: 22, border: '1px solid rgba(255,255,255,.72)', background: 'linear-gradient(145deg,rgba(255,255,255,.98),rgba(239,246,255,.94))', boxShadow: '0 30px 80px rgba(15,23,42,.28), inset 0 1px 0 rgba(255,255,255,.95)', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden="true" style={{ position: 'absolute', width: 180, height: 180, borderRadius: '50%', right: -95, top: -105, background: 'rgba(99,102,241,.14)', filter: 'blur(4px)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ color: '#6366f1', fontSize: 10, fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase' }}>ACCOUNT / WORK MODE</div>
          <h2 id="account-mode-dialog-title" style={{ margin: '4px 0 0', fontSize: 22, letterSpacing: '-.035em', color: '#111827' }}>Choose your account mode</h2>
          <p style={{ margin: '5px 0 14px', color: '#64748b', lineHeight: 1.45, fontSize: 11.5 }}>Switch settings surfaces without deleting or converting your existing data.</p>
          <div style={{ display: 'grid', gap: 9 }}>
            {modes.map((mode) => {
              const selected = currentMode === mode.value;
              return <button key={mode.value} type="button" disabled={switching} onClick={() => void choose(mode.value)} style={{ width: '100%', padding: 12, borderRadius: 15, border: selected ? '1.5px solid rgba(79,70,229,.48)' : '1px solid rgba(148,163,184,.22)', background: selected ? 'linear-gradient(145deg,rgba(238,242,255,.98),rgba(219,234,254,.78))' : 'rgba(255,255,255,.82)', boxShadow: selected ? '0 12px 26px rgba(79,70,229,.13), inset 0 1px 0 #fff' : '0 7px 18px rgba(15,23,42,.06), inset 0 1px 0 #fff', textAlign: 'left', cursor: switching ? 'wait' : 'pointer', font: 'inherit', transition: 'transform .15s ease, box-shadow .15s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><strong style={{ fontSize: 14, color: '#172033' }}>{mode.title}</strong><span style={{ padding: '4px 7px', borderRadius: 999, fontSize: 8, fontWeight: 950, letterSpacing: '.08em', color: selected ? (mode.value === 'contractor' ? '#047857' : '#4338ca') : '#64748b', background: selected ? (mode.value === 'contractor' ? 'rgba(16,185,129,.10)' : 'rgba(99,102,241,.12)') : 'rgba(148,163,184,.10)' }}>{selected ? 'CURRENT' : mode.badge}</span></div>
                <span style={{ display: 'block', marginTop: 5, color: '#64748b', fontSize: 11, lineHeight: 1.45 }}>{mode.description}</span>
                <span style={{ display: 'block', marginTop: 8, color: selected ? (mode.value === 'contractor' ? '#047857' : '#4f46e5') : '#475569', fontSize: 10.5, fontWeight: 900 }}>{selected ? 'Selected ✓' : 'Choose this mode →'}</span>
              </button>;
            })}
          </div>
          <button type="button" onClick={() => setOpen(false)} disabled={switching} style={{ width: '100%', marginTop: 11, minHeight: 38, borderRadius: 11, border: '1px solid rgba(148,163,184,.22)', background: 'rgba(255,255,255,.78)', color: '#475569', fontWeight: 850, cursor: switching ? 'wait' : 'pointer' }}>Cancel</button>
        </div>
      </section>
    </div>}
  </>;
}
