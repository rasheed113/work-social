import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../../../app/Router';
import { getFinalizedSalaryTotals, getSalaryMonthSummary, getSalaryPolicy, saveAttendance, saveOvertime } from '../api/salary';
import { useWorkerProfile } from '../hooks/useWorkerProfile';
import type { AttendanceStatus, SalaryMonthSummary, SalaryPolicy } from '../types/salary';

const card = { padding: 18, border: '1px solid rgba(99,102,241,.14)', borderRadius: 18, background: 'rgba(255,255,255,.94)', boxShadow: '0 10px 28px rgba(15,23,42,.07)' };
const input = { width: '100%', boxSizing: 'border-box' as const, minHeight: 40, padding: '7px 10px', borderRadius: 10, border: '1px solid #cbd5e1', font: 'inherit' };
const money = (value: number, currency: string) => `${currency} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function monthValue(offset: number) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset); return d.toISOString().slice(0, 10); }

export function SalaryDashboardPage({ profileId }: { profileId: string }) {
  const { workerProfile, loading } = useWorkerProfile(profileId);
  const [policy, setPolicy] = useState<SalaryPolicy | null>(null);
  const [summary, setSummary] = useState<SalaryMonthSummary | null>(null);
  const [grand, setGrand] = useState({ months: 0, base: 0, overtime: 0, bonuses: 0, adjustments: 0, total: 0 });
  const [monthOffset, setMonthOffset] = useState(0);
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [attendance, setAttendance] = useState<AttendanceStatus>('present');
  const [overtimeDate, setOvertimeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [overtimeHours, setOvertimeHours] = useState('');
  const [status, setStatus] = useState('');
  const month = useMemo(() => monthValue(monthOffset), [monthOffset]);

  const refresh = async () => {
    const [p, s, g] = await Promise.all([getSalaryPolicy(profileId), getSalaryMonthSummary(month), getFinalizedSalaryTotals(profileId)]);
    setPolicy(p.data); setSummary(s.data);
    if (s.error) setStatus(s.error.message);
    if (!g.error) setGrand(g.data.reduce((acc, row) => ({ months: acc.months + 1, base: acc.base + Number(row.base_salary || 0), overtime: acc.overtime + Number(row.overtime_amount || 0), bonuses: acc.bonuses + Number(row.bonus_amount || 0), adjustments: acc.adjustments + Number(row.adjustments || 0), total: acc.total + Number(row.final_amount || 0) }), { months: 0, base: 0, overtime: 0, bonuses: 0, adjustments: 0, total: 0 }));
  };
  useEffect(() => { if (workerProfile) void refresh(); }, [workerProfile, month]);
  if (loading) return <main style={{ padding: 24 }}>Loading Salary Dashboard…</main>;
  if (!workerProfile) return <main style={{ padding: 24 }}>Worker profile unavailable.</main>;

  const currency = policy?.currency ?? 'PKR';
  const saveAttendanceEntry = async () => { setStatus(''); const { error } = await saveAttendance(workerProfile.id, attendanceDate, attendance); setStatus(error ? error.message : 'Attendance saved.'); if (!error) await refresh(); };
  const saveOvertimeEntry = async () => {
    const hours = Number(overtimeHours);
    if (!Number.isFinite(hours) || hours < 0) { setStatus('Enter valid overtime hours.'); return; }
    setStatus('');
    const { data, error } = await saveOvertime(workerProfile.id, overtimeDate, hours);
    setStatus(error ? error.message : `Overtime saved: ${Number(data?.amount ?? 0).toFixed(2)} ${currency} at ${Number(data?.multiplier ?? 0)}×.`);
    if (!error) { setOvertimeHours(''); await refresh(); }
  };
  const title = new Date(`${month}T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 18 }}><div><div style={{ color: '#64748b', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Salary Person</div><h1 style={{ margin: '5px 0 0' }}>Salary Dashboard</h1></div><button type="button" onClick={() => navigate('/work/identity')} style={{ minHeight: 38, padding: '0 11px', borderRadius: 10 }}>Identity</button></header>
    <section style={{ ...card, marginBottom: 14 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}><div><div style={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>CURRENT MONTH SALARY</div><h2 style={{ margin: '5px 0' }}>{title}</h2></div><div style={{ display: 'flex', gap: 6 }}><button type="button" disabled={monthOffset <= -120} onClick={() => setMonthOffset(v => v - 1)}>← Previous</button>{monthOffset !== 0 && <button type="button" onClick={() => setMonthOffset(0)}>This Month</button>}</div></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 16 }}><Metric label="Base Salary" value={money(summary?.base_salary ?? 0, currency)}/><Metric label="Overtime" value={money(summary?.overtime_amount ?? 0, currency)}/><Metric label="Adjustments" value={money(summary?.adjustments ?? 0, currency)}/><Metric label="Bonus" value={money(summary?.bonus_amount ?? 0, currency)}/><Metric label="Final Salary" value={money(summary?.final_salary ?? 0, currency)} strong/></div></section>
    <section style={{ ...card, marginBottom: 14 }}><div style={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>GRAND SALARY — FINALIZED MONTHS ONLY</div><h2 style={{ margin: '5px 0 14px' }}>{money(grand.total, currency)}</h2><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}><Metric label="Completed Months" value={String(grand.months)}/><Metric label="Total Base" value={money(grand.base, currency)}/><Metric label="Total Overtime" value={money(grand.overtime, currency)}/><Metric label="Total Bonuses" value={money(grand.bonuses, currency)}/><Metric label="Total Adjustments" value={money(grand.adjustments, currency)}/></div><p style={{ color: '#64748b', fontSize: 13, marginBottom: 0 }}>Only salary periods explicitly finalized by the salary system are counted as earned grand salary.</p></section>
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}><section style={card}><h2 style={{ marginTop: 0 }}>Attendance</h2><Metric label="Present Days" value={String(summary?.present_days ?? 0)}/><Metric label="Absent Days" value={String(summary?.absent_days ?? 0)}/><Metric label="Leave Days" value={String(summary?.leave_days ?? 0)}/><Metric label="Paid Days" value={String(summary?.paid_days ?? 0)}/><Metric label="Attendance" value={`${Number(summary?.attendance_percentage ?? 0).toFixed(1)}%`}/></section><section style={card}><h2 style={{ marginTop: 0 }}>Overtime</h2><Metric label="Total Overtime Hours" value={`${Number(summary?.overtime_hours ?? 0).toFixed(2)} h`}/><Metric label="Total Overtime Amount" value={money(summary?.overtime_amount ?? 0, currency)}/><p style={{ color: '#64748b', fontSize: 13 }}>The saved salary policy determines the overtime multiplier and hourly rate.</p></section><section style={card}><h2 style={{ marginTop: 0 }}>Bonus</h2><Metric label="Bonuses received" value={money(summary?.bonus_amount ?? 0, currency)}/><p style={{ color: '#64748b', lineHeight: 1.5, fontSize: 13 }}>Bonus records are included automatically when they exist for this month.</p></section></section>
    <section style={{ ...card, marginTop: 14 }}><h2 style={{ marginTop: 0 }}>Daily Attendance + Overtime</h2><div style={{ display: 'grid', gap: 12 }}><label>Attendance Date<input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} style={input}/></label><label>Attendance<select value={attendance} onChange={e => setAttendance(e.target.value as AttendanceStatus)} style={input}><option value="present">Present</option><option value="absent">Absent</option><option value="leave">Leave</option></select></label><button type="button" onClick={() => void saveAttendanceEntry()} style={{ minHeight: 42 }}>Save Attendance</button><label>Overtime Date<input type="date" value={overtimeDate} onChange={e => setOvertimeDate(e.target.value)} style={input}/></label><label>Overtime Hours<input type="number" min="0" step="0.25" value={overtimeHours} onChange={e => setOvertimeHours(e.target.value)} style={input}/></label><button type="button" onClick={() => void saveOvertimeEntry()} style={{ minHeight: 42 }}>Add Overtime</button>{status && <p role="status" style={{ margin: 0 }}>{status}</p>}</div></section>
    <section style={{ ...card, marginTop: 14 }}><h2 style={{ marginTop: 0 }}>Monthly Detail</h2><p>Present {summary?.present_days ?? 0} · Absent {summary?.absent_days ?? 0} · Leave {summary?.leave_days ?? 0} · OT {Number(summary?.overtime_hours ?? 0).toFixed(2)}h</p><p>Base {money(summary?.base_salary ?? 0, currency)} · OT {money(summary?.overtime_amount ?? 0, currency)} · Bonus {money(summary?.bonus_amount ?? 0, currency)} · Final {money(summary?.final_salary ?? 0, currency)}</p></section>
  </main>;
}
function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div style={{ padding: 12, borderRadius: 12, background: 'rgba(99,102,241,.055)' }}><div style={{ color: '#64748b', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div><div style={{ marginTop: 5, fontSize: strong ? 21 : 16, fontWeight: strong ? 950 : 800 }}>{value}</div></div>; }
