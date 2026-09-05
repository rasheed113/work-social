import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../../../app/Router';
import { getFinalizedSalaryTotals, getSalaryMonthSummary, getSalaryPolicy, saveAttendance, saveOvertime } from '../api/salary';
import { listSalaryAllowances, type SalaryAllowance } from '../api/salaryAllowances';
import { useWorkerProfile } from '../hooks/useWorkerProfile';
import type { AttendanceStatus, SalaryMonthSummary, SalaryPolicy } from '../types/salary';

const shell = { width: '100%', maxWidth: 1080, margin: '0 auto', padding: '20px 14px 120px', boxSizing: 'border-box' as const };
const panel = { border: '1px solid rgba(148,163,184,.22)', borderRadius: 22, background: 'rgba(255,255,255,.96)', boxShadow: '0 18px 45px rgba(15,23,42,.07)', overflow: 'hidden' as const };
const input = { width: '100%', boxSizing: 'border-box' as const, minHeight: 42, padding: '8px 11px', borderRadius: 11, border: '1px solid #cbd5e1', background: '#fff', font: 'inherit' };
const button = { minHeight: 42, padding: '0 14px', borderRadius: 11, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 800, cursor: 'pointer' };
const primaryButton = { ...button, border: '0', background: '#111827', color: '#fff' };
const money = (value: number, currency: string) => `${currency} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function monthValue(offset: number) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset); return d.toISOString().slice(0, 10); }

export function SalaryDashboardPage({ profileId }: { profileId: string }) {
  const { workerProfile, loading } = useWorkerProfile(profileId);
  const [policy, setPolicy] = useState<SalaryPolicy | null>(null);
  const [summary, setSummary] = useState<SalaryMonthSummary | null>(null);
  const [allowances, setAllowances] = useState<SalaryAllowance[]>([]);
  const [grand, setGrand] = useState({ months: 0, base: 0, overtime: 0, bonuses: 0, adjustments: 0, total: 0 });
  const [monthOffset, setMonthOffset] = useState(0);
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [attendance, setAttendance] = useState<AttendanceStatus>('present');
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [overtimeDate, setOvertimeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [overtimeHours, setOvertimeHours] = useState('');
  const [overtimeOpen, setOvertimeOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const month = useMemo(() => monthValue(monthOffset), [monthOffset]);

  const refresh = async () => {
    const [p, s, g, a] = await Promise.all([getSalaryPolicy(profileId), getSalaryMonthSummary(month), getFinalizedSalaryTotals(profileId), listSalaryAllowances(profileId)]);
    setPolicy(p.data); setSummary(s.data); setAllowances(a.data ?? []);
    if (s.error) setStatus(s.error.message);
    if (a.error) setStatus(a.error.message);
    if (!g.error) setGrand(g.data.reduce((acc, row) => ({ months: acc.months + 1, base: acc.base + Number(row.base_salary || 0), overtime: acc.overtime + Number(row.overtime_amount || 0), bonuses: acc.bonuses + Number(row.bonus_amount || 0), adjustments: acc.adjustments + Number(row.adjustments || 0), total: acc.total + Number(row.final_amount || 0) }), { months: 0, base: 0, overtime: 0, bonuses: 0, adjustments: 0, total: 0 }));
  };
  useEffect(() => { if (workerProfile) void refresh(); }, [workerProfile, month]);

  if (loading) return <main style={{ padding: 24 }}>Loading Salary Dashboard…</main>;
  if (!workerProfile) return <main style={{ padding: 24 }}>Worker profile unavailable.</main>;

  const currency = policy?.currency ?? 'PKR';
  const title = new Date(`${month}T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const salaryTypeMissing = !policy?.salary_type;
  const salaryTypeLabel = policy?.salary_type === '15_days' ? '15 Days' : policy?.salary_type ? policy.salary_type.charAt(0).toUpperCase() + policy.salary_type.slice(1) : 'Not set';
  const salaryTypeAction = <button type="button" onClick={() => navigate('/work/finance?setup=1&focus=salary-type')} style={{ border: 0, background: 'transparent', padding: 0, color: salaryTypeMissing ? '#b45309' : '#334155', fontWeight: 900, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}>{salaryTypeMissing ? 'Salary cycle: Not set — fix setup' : `Salary cycle: ${salaryTypeLabel}`}</button>;
  const allowanceTotal = allowances.reduce((total, row) => total + Number(row.amount || 0), 0);
  const allowanceAction = <button type="button" onClick={() => navigate('/work/finance?setup=1&focus=allowances')} style={{ width: '100%', border: 0, background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><div><div style={{ fontSize: 11, color: allowances.length ? '#047857' : '#b45309', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>{allowances.length ? 'Set' : 'Not set'}</div><div style={{ marginTop: 5, fontSize: 24, fontWeight: 950 }}>{allowances.length ? money(allowanceTotal, currency) : 'Configure allowances'}</div></div><div style={{ color: allowances.length ? '#047857' : '#b45309', fontWeight: 900 }}>{allowances.length ? 'Change →' : 'Set →'}</div></div><p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 13 }}>{allowances.length ? `${allowances.length} allowance${allowances.length === 1 ? '' : 's'} configured · tap to change` : 'Tap to open Salary Settings and set your allowance rules.'}</p></button>;

  const saveAttendanceEntry = async () => {
    setStatus(''); setBusy(true);
    const { error } = await saveAttendance(workerProfile.id, attendanceDate, attendance);
    setBusy(false); setStatus(error ? error.message : 'Attendance saved successfully.');
    if (!error) { setAttendanceOpen(false); await refresh(); }
  };
  const saveOvertimeEntry = async () => {
    const hours = Number(overtimeHours);
    if (!Number.isFinite(hours) || hours <= 0) { setStatus('Enter overtime hours greater than zero.'); return; }
    setStatus(''); setBusy(true);
    const { data, error } = await saveOvertime(workerProfile.id, overtimeDate, hours);
    setBusy(false); setStatus(error ? error.message : `Overtime saved: ${Number(data?.amount ?? 0).toFixed(2)} ${currency} at ${Number(data?.multiplier ?? 0)}×.`);
    if (!error) { setOvertimeHours(''); setOvertimeOpen(false); await refresh(); }
  };

  return <main style={{ ...shell, background: 'linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%)' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
      <div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 10px', borderRadius: 999, background: '#ecfdf5', color: '#047857', fontSize: 11, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}><span style={{ width: 7, height: 7, borderRadius: 99, background: '#10b981' }} /> Salary Person</div>
        <h1 style={{ margin: '10px 0 4px', fontSize: 'clamp(28px,6vw,40px)', letterSpacing: '-.035em' }}>Your Salary Dashboard</h1>
        <p style={{ margin: 0, color: '#64748b', lineHeight: 1.5 }}>A clear view of your salary, attendance, overtime and completed salary history.</p>
      </div>
      <button type="button" onClick={() => navigate('/work/identity')} style={button}>Work Identity</button>
    </header>

    <section style={{ ...panel, marginBottom: 16 }}>
      <div style={{ padding: '20px 18px', background: 'linear-gradient(135deg,#111827,#1f2937)', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div><div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '.1em', opacity: .7, textTransform: 'uppercase' }}>Current Month Salary</div><h2 style={{ margin: '7px 0 0', fontSize: 25 }}>{title}</h2></div>
          <div style={{ display: 'flex', gap: 7 }}><button type="button" disabled={monthOffset <= -120} onClick={() => setMonthOffset(v => v - 1)} style={{ ...button, borderColor: 'rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff' }}>← Previous</button>{monthOffset !== 0 && <button type="button" onClick={() => setMonthOffset(0)} style={{ ...button, borderColor: 'rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff' }}>This Month</button>}</div>
        </div>
        <div style={{ marginTop: 22, fontSize: 13, opacity: .7 }}>Final salary</div>
        <div style={{ marginTop: 3, fontSize: 'clamp(30px,7vw,48px)', fontWeight: 950, letterSpacing: '-.04em' }}>{money(summary?.final_salary ?? 0, currency)}</div>
      </div>
      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 10 }}>
        <Metric label="Base Salary" value={money(summary?.base_salary ?? 0, currency)} />
        <Metric label="Overtime" value={money(summary?.overtime_amount ?? 0, currency)} />
        <Metric label="Adjustments" value={money(summary?.adjustments ?? 0, currency)} />
        <Metric label="Bonus" value={money(summary?.bonus_amount ?? 0, currency)} />
      </div>
    </section>

    <section style={{ ...panel, marginBottom: 16, padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}><div><div style={{ color: '#64748b', fontSize: 11, fontWeight: 900, letterSpacing: '.1em' }}>GRAND SALARY</div><h2 style={{ margin: '5px 0 2px', fontSize: 28 }}>{money(grand.total, currency)}</h2><p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Finalized salary months only</p></div><div style={{ padding: '9px 12px', borderRadius: 12, background: '#f8fafc', color: '#334155', fontWeight: 900 }}>{grand.months} completed {grand.months === 1 ? 'month' : 'months'}</div></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 10, marginTop: 16 }}><Metric label="Total Base" value={money(grand.base, currency)} /><Metric label="Total Overtime" value={money(grand.overtime, currency)} /><Metric label="Total Bonuses" value={money(grand.bonuses, currency)} /><Metric label="Total Adjustments" value={money(grand.adjustments, currency)} /></div>
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 14, marginBottom: 16 }}>
      <InfoCard title="Attendance" icon="✓"><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Mini label="Present" value={String(summary?.present_days ?? 0)} /><Mini label="Absent" value={String(summary?.absent_days ?? 0)} /><Mini label="Leave" value={String(summary?.leave_days ?? 0)} /><Mini label="Paid Days" value={String(summary?.paid_days ?? 0)} /></div><div style={{ marginTop: 14, padding: 11, borderRadius: 12, background: '#f8fafc' }}><strong>{Number(summary?.attendance_percentage ?? 0).toFixed(1)}%</strong> attendance</div></InfoCard>
      <InfoCard title="Overtime" icon="↗"><div style={{ fontSize: 28, fontWeight: 950 }}>{Number(summary?.overtime_hours ?? 0).toFixed(2)} h</div><p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>Total overtime hours</p><div style={{ marginTop: 14, fontWeight: 900 }}>{money(summary?.overtime_amount ?? 0, currency)}</div><p style={{ margin: '3px 0 0', color: '#64748b', fontSize: 12 }}>Calculated from your saved salary policy.</p></InfoCard>
      <InfoCard title="Allowance" icon="＋"><div style={{ padding: 13, borderRadius: 14, background: allowances.length ? '#ecfdf5' : '#fffbeb', border: allowances.length ? '1px solid #bbf7d0' : '1px solid #fde68a' }}>{allowanceAction}</div>{allowances.length > 0 && <div style={{ display: 'grid', gap: 7, marginTop: 12 }}>{allowances.slice(0, 4).map(row => <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, color: '#475569' }}><span>{row.allowance_type}</span><strong>{money(Number(row.amount), currency)}</strong></div>)}{allowances.length > 4 && <span style={{ color: '#64748b', fontSize: 12 }}>+{allowances.length - 4} more</span>}</div>}</InfoCard>
      <InfoCard title="Bonus" icon="★"><div style={{ fontSize: 24, fontWeight: 950 }}>{money(summary?.bonus_amount ?? 0, currency)}</div><p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>Bonuses recorded this month</p><div style={{ marginTop: 14, padding: 10, borderRadius: 12, background: '#f8fafc', color: '#475569', fontSize: 13 }}>{policy ? salaryTypeAction : 'Complete salary setup to configure your policy.'}</div></InfoCard>
    </section>

    <section style={{ ...panel, marginBottom: 16, padding: 18 }}>
      <div style={{ marginBottom: 14 }}><div style={{ color: '#64748b', fontSize: 11, fontWeight: 900, letterSpacing: '.1em' }}>DAILY WORK RECORD</div><h2 style={{ margin: '5px 0 3px' }}>Attendance & Overtime</h2><p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Keep today's work record accurate. Overtime is calculated using your saved policy.</p></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 14 }}>
        <div style={{ padding: 15, borderRadius: 16, background: '#f8fafc' }}>
          <button type="button" onClick={() => setAttendanceOpen(open => !open)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 0, border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left', font: 'inherit' }}>
            <span><span style={{ display: 'block', fontSize: 17, fontWeight: 900 }}>Attendance</span><span style={{ display: 'block', marginTop: 3, color: '#64748b', fontSize: 12 }}>{attendance === 'present' ? 'Present' : attendance === 'absent' ? 'Absent' : 'Leave'} · {attendanceDate}</span></span>
            <span aria-hidden="true" style={{ fontSize: 18, color: '#64748b' }}>{attendanceOpen ? '⌃' : '⌄'}</span>
          </button>
          {attendanceOpen && <div style={{ marginTop: 14 }}><label style={labelStyle}>Date<input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} style={input} /></label><label style={labelStyle}>Status<select value={attendance} onChange={e => { const value = e.target.value as AttendanceStatus; setAttendance(value); setAttendanceOpen(value !== 'present'); }} style={input}><option value="present">Present</option><option value="absent">Absent</option><option value="leave">Leave</option></select></label><button type="button" disabled={busy} onClick={() => void saveAttendanceEntry()} style={{ ...primaryButton, width: '100%' }}>{busy ? 'Saving…' : 'Save Attendance'}</button></div>}
        </div>
        <div style={{ padding: 15, borderRadius: 16, background: '#f8fafc' }}>
          <button type="button" onClick={() => setOvertimeOpen(open => !open)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 0, border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left', font: 'inherit' }}>
            <span><span style={{ display: 'block', fontSize: 17, fontWeight: 900 }}>Add Overtime</span><span style={{ display: 'block', marginTop: 3, color: '#64748b', fontSize: 12 }}>{overtimeHours ? `${overtimeHours} h` : 'No overtime entered'} · {overtimeDate}</span></span>
            <span aria-hidden="true" style={{ fontSize: 18, color: '#64748b' }}>{overtimeOpen ? '⌃' : '＋'}</span>
          </button>
          {overtimeOpen && <div style={{ marginTop: 14 }}><label style={labelStyle}>Work date<input type="date" value={overtimeDate} onChange={e => setOvertimeDate(e.target.value)} style={input} /></label><label style={labelStyle}>Overtime hours<input type="number" min="0.25" step="0.25" value={overtimeHours} onChange={e => setOvertimeHours(e.target.value)} placeholder="e.g. 2.5" style={input} /></label><button type="button" disabled={busy} onClick={() => void saveOvertimeEntry()} style={{ ...primaryButton, width: '100%' }}>{busy ? 'Saving…' : 'Add Overtime'}</button></div>}
        </div>
      </div>
      {status && <div role="status" style={{ marginTop: 12, padding: 11, borderRadius: 12, background: '#f1f5f9', color: '#334155', fontSize: 13 }}>{status}</div>}
    </section>

    <section style={{ ...panel, padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}><div><div style={{ color: '#64748b', fontSize: 11, fontWeight: 900, letterSpacing: '.1em' }}>MONTHLY DETAIL</div><h2 style={{ margin: '5px 0' }}>{title}</h2></div>{salaryTypeAction}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}><Metric label="Present" value={`${summary?.present_days ?? 0} days`} /><Metric label="Absent" value={`${summary?.absent_days ?? 0} days`} /><Metric label="Leave" value={`${summary?.leave_days ?? 0} days`} /><Metric label="Overtime" value={`${Number(summary?.overtime_hours ?? 0).toFixed(2)} h`} /><Metric label="Final Salary" value={money(summary?.final_salary ?? 0, currency)} strong /></div>
      <p style={{ margin: '14px 0 0', color: '#64748b', fontSize: 12 }}>Previous months can be reviewed with the Previous button above. Grand Salary counts only finalized periods.</p>
    </section>
  </main>;
}

function InfoCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) { return <section style={{ ...panel, padding: 17 }}><div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 14 }}><span aria-hidden="true" style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', borderRadius: 10, background: '#f1f5f9', fontWeight: 950 }}>{icon}</span><h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2></div>{children}</section>; }
const labelStyle = { display: 'grid', gap: 6, marginBottom: 11, color: '#334155', fontSize: 13, fontWeight: 800 };
function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div style={{ padding: 12, borderRadius: 14, background: '#f8fafc', border: '1px solid #eef2f7' }}><div style={{ color: '#64748b', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div><div style={{ marginTop: 5, fontSize: strong ? 20 : 15, fontWeight: strong ? 950 : 850 }}>{value}</div></div>; }
function Mini({ label, value }: { label: string; value: string }) { return <div style={{ padding: 11, borderRadius: 12, background: '#fff', border: '1px solid #eef2f7' }}><div style={{ color: '#64748b', fontSize: 11 }}>{label}</div><strong style={{ display: 'block', marginTop: 3, fontSize: 18 }}>{value}</strong></div>; }
