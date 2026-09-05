import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../../../app/Router';
import { addSalaryFinanceRecord, getFinalizedSalaryTotals, getSalaryMonthSummary, getSalaryPolicy, listSalaryFinanceRecords, type SalaryFinanceRecord, type SalaryFinanceRecordType } from '../api/salary';
import { useWorkerProfile } from '../hooks/useWorkerProfile';
import type { SalaryMonthSummary, SalaryPolicy } from '../types/salary';

const shell = { width: '100%', maxWidth: 820, margin: '0 auto', padding: '18px 12px 120px', boxSizing: 'border-box' as const };
const card = { border: '1px solid rgba(148,163,184,.2)', borderRadius: 18, background: 'rgba(255,255,255,.97)', boxShadow: '0 12px 28px rgba(15,23,42,.065), inset 0 1px 0 rgba(255,255,255,1)' };
const button = { minHeight: 40, padding: '0 13px', borderRadius: 11, border: '1px solid rgba(100,116,139,.18)', background: 'linear-gradient(145deg,#fff,#f5f7fb)', fontWeight: 850, cursor: 'pointer', boxShadow: '0 6px 12px rgba(15,23,42,.06), inset 0 1px 0 #fff' };
const input = { width: '100%', minHeight: 42, boxSizing: 'border-box' as const, border: '1px solid #cbd5e1', borderRadius: 11, padding: '0 11px', font: 'inherit', background: '#fff' };
const money = (value: number, currency: string) => `${currency} ${Math.abs(Number(value || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const monthKey = new Date().toISOString().slice(0, 10);
const positive = '#15803d';
const negative = '#dc2626';
const neutral = '#0f172a';

function recordLabel(type: SalaryFinanceRecordType) {
  return type === 'payment' ? 'Payment Received' : type === 'advance' ? 'Advance Received' : 'Other Adjustment';
}
function dateLabel(value: string) { return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); }
function amountColor(value: number) { return value > 0 ? positive : value < 0 ? negative : neutral; }
function signedMoney(value: number, currency: string) { const sign = value > 0 ? '+' : value < 0 ? '-' : ''; return `${sign}${money(value, currency)}`; }

export function SalaryFinancePage({ profileId }: { profileId: string }) {
  const { workerProfile, loading: profileLoading } = useWorkerProfile(profileId);
  const [policy, setPolicy] = useState<SalaryPolicy | null>(null);
  const [summary, setSummary] = useState<SalaryMonthSummary | null>(null);
  const [records, setRecords] = useState<SalaryFinanceRecord[]>([]);
  const [completedTotal, setCompletedTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [type, setType] = useState<SalaryFinanceRecordType>('payment');
  const [amount, setAmount] = useState('');
  const [receivedAt, setReceivedAt] = useState(monthKey);

  const load = async () => {
    setLoading(true); setError(null);
    const [policyResult, summaryResult, totalsResult, recordsResult] = await Promise.all([getSalaryPolicy(profileId), getSalaryMonthSummary(monthKey), getFinalizedSalaryTotals(profileId), listSalaryFinanceRecords(profileId)]);
    const firstError = policyResult.error ?? summaryResult.error ?? totalsResult.error ?? recordsResult.error;
    if (firstError) setError(firstError.message);
    setPolicy(policyResult.data); setSummary(summaryResult.data); setRecords(recordsResult.data);
    setCompletedTotal((totalsResult.data ?? []).reduce((total, row) => total + Number(row.final_amount || 0), 0));
    setLoading(false);
  };
  useEffect(() => { if (workerProfile) void load(); }, [profileId, workerProfile]);

  const currency = policy?.currency ?? 'PKR';
  const currentSalary = Number(summary?.final_salary ?? 0);
  const totalSalary = completedTotal + currentSalary;
  const currentMonth = new Date(monthKey).getMonth();
  const currentYear = new Date(monthKey).getFullYear();
  const currentReceived = useMemo(() => records.filter(record => { const date = new Date(record.received_at); return date.getMonth() === currentMonth && date.getFullYear() === currentYear && (record.entry_type === 'payment' || record.entry_type === 'advance'); }).reduce((total, record) => total + Number(record.amount || 0), 0), [records, currentMonth, currentYear]);
  const currentOtherAdjustment = useMemo(() => records.filter(record => { const date = new Date(record.received_at); return date.getMonth() === currentMonth && date.getFullYear() === currentYear && record.entry_type === 'other'; }).reduce((total, record) => total + Number(record.amount || 0), 0), [records, currentMonth, currentYear]);
  const remaining = currentSalary - currentReceived + currentOtherAdjustment;
  const status = remaining <= 0 && currentSalary > 0 ? 'Paid' : currentReceived <= 0 && currentOtherAdjustment >= 0 ? 'Pending' : 'Partially Paid';

  const submit = async () => {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) { setError('Enter an amount greater than zero.'); return; }
    setSaving(true); setError(null);
    const result = await addSalaryFinanceRecord(profileId, type, amount.trim(), new Date(`${receivedAt}T12:00:00`).toISOString());
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    setAmount(''); setAddOpen(false); setNotice('Finance record added.'); await load();
  };

  if (profileLoading || loading) return <main style={shell}><p style={{ color: '#64748b' }}>Loading Salary Finance…</p></main>;
  if (!workerProfile) return <main style={shell}><p>Worker profile unavailable.</p></main>;

  return <main style={{ ...shell, background: 'radial-gradient(circle at 8% 0%,rgba(99,102,241,.07),transparent 30%),radial-gradient(circle at 95% 18%,rgba(20,184,166,.06),transparent 30%)' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
      <div><button className="finance-action" type="button" onClick={() => navigate('/work')} style={{ ...button, minHeight: 34, padding: '0 10px', fontSize: 12 }}>← Dashboard</button><div style={{ marginTop: 9, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: 99, background: '#10b981', boxShadow: '0 0 0 4px rgba(16,185,129,.10)' }} /><span style={{ color: '#047857', fontSize: 10, fontWeight: 950, letterSpacing: '.12em', textTransform: 'uppercase' }}>Salary Person · Finance</span></div><h1 style={{ margin: '4px 0 2px', fontSize: 'clamp(25px,6vw,34px)', letterSpacing: '-.04em', color: '#0f172a' }}>Salary Finance</h1><p style={{ margin: 0, color: '#64748b', fontSize: 12.5 }}>Track received salary and your current balance.</p></div>
      <button className="finance-action" type="button" onClick={() => navigate('/work/finance?setup=1')} style={{ ...button, fontSize: 11.5 }}>Salary Setup</button>
    </header>
    <style>{`.finance-action{transition:transform .16s ease,box-shadow .16s ease}.finance-action:hover{transform:translateY(-2px);box-shadow:0 10px 18px rgba(15,23,42,.1),inset 0 1px 0 #fff}.finance-action:active{transform:translateY(1px)}.finance-card{transition:transform .16s ease,box-shadow .16s ease}.finance-card:hover{transform:translateY(-2px);box-shadow:0 18px 34px rgba(15,23,42,.09),inset 0 1px 0 #fff}@media(max-width:560px){.finance-grid{grid-template-columns:1fr 1fr!important}.finance-card{border-radius:15px!important}}`}</style>
    {error && <div role="alert" className="finance-card" style={{ ...card, padding: 11, marginBottom: 10, color: '#b91c1c', background: '#fef2f2', borderColor: '#fecaca', fontSize: 12, fontWeight: 750 }}>{error}</div>}
    {notice && <div role="status" className="finance-card" style={{ ...card, padding: 11, marginBottom: 10, color: '#166534', background: '#f0fdf4', borderColor: '#bbf7d0', fontSize: 12, fontWeight: 750 }}>{notice}</div>}

    <section className="finance-card" style={{ ...card, padding: 13, marginBottom: 11 }} aria-label="Salary summary"><div className="finance-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}><Summary label="Total Salary" value={money(totalSalary, currency)} tone={amountColor(totalSalary)} /><Summary label="Current Salary" value={money(currentSalary, currency)} tone={amountColor(currentSalary)} /><Summary label="Received" value={`-${money(currentReceived, currency)}`} tone={negative} /><Summary label="Remaining" value={signedMoney(remaining, currency)} tone={amountColor(remaining)} /></div><div style={{ marginTop: 8, padding: '9px 11px', borderRadius: 11, background: status === 'Paid' ? 'linear-gradient(145deg,#ecfdf5,#d1fae5)' : 'linear-gradient(145deg,#f8fafc,#eef2f7)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><span style={{ color: '#64748b', fontSize: 11, fontWeight: 800 }}>Current Salary Status</span><strong style={{ fontSize: 12, color: status === 'Paid' ? positive : neutral }}>{status}</strong></div></section>

    <section style={{ marginBottom: 13 }}><button className="finance-action" type="button" onClick={() => setAddOpen(open => !open)} style={{ width: '100%', minHeight: 44, borderRadius: 12, border: 0, background: 'linear-gradient(145deg,#111827,#1e1b4b)', color: '#fff', font: 'inherit', fontSize: 12, fontWeight: 900, cursor: 'pointer', boxShadow: '0 9px 18px rgba(15,23,42,.15),inset 0 1px 0 rgba(255,255,255,.12)' }}>＋ Add Finance Record <span style={{ opacity: .7 }}>{addOpen ? '⌃' : '⌄'}</span></button>{addOpen && <div className="finance-card" style={{ ...card, marginTop: 7, padding: 12 }}><label style={{ display: 'grid', gap: 5, fontSize: 11.5, fontWeight: 800, color: '#475569' }}>Record Type<select value={type} onChange={event => setType(event.target.value as SalaryFinanceRecordType)} style={input}><option value="advance">Advance Received</option><option value="payment">Payment Received</option><option value="other">Other Adjustment</option></select></label><label style={{ display: 'grid', gap: 5, marginTop: 9, fontSize: 11.5, fontWeight: 800, color: '#475569' }}>Amount<input inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" style={input} /></label><label style={{ display: 'grid', gap: 5, marginTop: 9, fontSize: 11.5, fontWeight: 800, color: '#475569' }}>Date<input type="date" value={receivedAt} onChange={event => setReceivedAt(event.target.value)} style={input} /></label><div style={{ display: 'flex', gap: 7, marginTop: 10 }}><button className="finance-action" type="button" onClick={() => setAddOpen(false)} style={{ ...button, flex: 1 }}>Cancel</button><button className="finance-action" type="button" onClick={() => void submit()} disabled={saving} style={{ ...button, flex: 1, background: 'linear-gradient(145deg,#4f46e5,#2563eb)', color: '#fff', border: 0, opacity: saving ? .65 : 1 }}>{saving ? 'Saving…' : 'Save Record'}</button></div></div>}</section>

    <section aria-labelledby="finance-history-heading"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}><div><div style={{ color: '#4f46e5', fontSize: 9.5, fontWeight: 950, letterSpacing: '.12em' }}>ACTIVITY</div><h2 id="finance-history-heading" style={{ margin: '3px 0 0', fontSize: 18, letterSpacing: '-.02em' }}>Finance History</h2></div><span style={{ color: '#64748b', fontSize: 10.5 }}>{records.length} record{records.length === 1 ? '' : 's'}</span></div>{records.length === 0 ? <div className="finance-card" style={{ ...card, padding: 22, textAlign: 'center', color: '#64748b', fontSize: 12 }}>No finance records yet.</div> : <div style={{ display: 'grid', gap: 7 }}>{records.map(record => { const rawAmount = Number(record.amount || 0); const signedAmount = record.entry_type === 'payment' || record.entry_type === 'advance' ? -Math.abs(rawAmount) : rawAmount; return <article className="finance-card" key={record.id} style={{ ...card, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}><div style={{ minWidth: 0 }}><div style={{ fontWeight: 850, fontSize: 12.5 }}>{recordLabel(record.entry_type)}</div><div style={{ marginTop: 2, color: '#64748b', fontSize: 10.5 }}>{dateLabel(record.received_at)}</div></div><strong style={{ whiteSpace: 'nowrap', color: amountColor(signedAmount), fontSize: 12.5 }}>{signedMoney(signedAmount, currency)}</strong></article>; })}</div>}</section>
  </main>;
}

function Summary({ label, value, tone = neutral }: { label: string; value: string; tone?: string }) { return <div className="finance-card" style={{ padding: 10, borderRadius: 12, background: 'linear-gradient(145deg,#fff,#f8fafc)', border: '1px solid rgba(148,163,184,.16)', boxShadow: '0 6px 12px rgba(15,23,42,.045),inset 0 1px 0 #fff' }}><div style={{ color: '#64748b', fontSize: 10, fontWeight: 800 }}>{label}</div><div style={{ marginTop: 3, fontWeight: 900, fontSize: 14.5, color: tone, letterSpacing: '-.02em' }}>{value}</div></div>; }
