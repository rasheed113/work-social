import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../../../app/Router';
import { addSalaryFinanceRecord, getFinalizedSalaryTotals, getSalaryMonthSummary, getSalaryPolicy, listSalaryFinanceRecords, type SalaryFinanceRecord, type SalaryFinanceRecordType } from '../api/salary';
import { useWorkerProfile } from '../hooks/useWorkerProfile';
import type { SalaryMonthSummary, SalaryPolicy } from '../types/salary';

const shell = { width: '100%', maxWidth: 760, margin: '0 auto', padding: '18px 14px 120px', boxSizing: 'border-box' as const };
const card = { border: '1px solid rgba(148,163,184,.2)', borderRadius: 18, background: '#fff', boxShadow: '0 10px 28px rgba(15,23,42,.06)' };
const button = { minHeight: 42, padding: '0 14px', borderRadius: 11, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 800, cursor: 'pointer' };
const input = { width: '100%', minHeight: 44, boxSizing: 'border-box' as const, border: '1px solid #cbd5e1', borderRadius: 11, padding: '0 12px', font: 'inherit', background: '#fff' };
const money = (value: number, currency: string) => `${currency} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const monthKey = new Date().toISOString().slice(0, 10);

function recordLabel(type: SalaryFinanceRecordType) {
  return type === 'payment' ? 'Payment Received' : type === 'advance' ? 'Advance Received' : 'Other Adjustment';
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

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
    setLoading(true);
    setError(null);
    const [policyResult, summaryResult, totalsResult, recordsResult] = await Promise.all([
      getSalaryPolicy(profileId),
      getSalaryMonthSummary(monthKey),
      getFinalizedSalaryTotals(profileId),
      listSalaryFinanceRecords(profileId),
    ]);
    const firstError = policyResult.error ?? summaryResult.error ?? totalsResult.error ?? recordsResult.error;
    if (firstError) setError(firstError.message);
    setPolicy(policyResult.data);
    setSummary(summaryResult.data);
    setRecords(recordsResult.data);
    setCompletedTotal((totalsResult.data ?? []).reduce((total, row) => total + Number(row.final_amount || 0), 0));
    setLoading(false);
  };

  useEffect(() => {
    if (workerProfile) void load();
  }, [profileId, workerProfile]);

  const currency = policy?.currency ?? 'PKR';
  const currentSalary = Number(summary?.final_salary ?? 0);
  const totalSalary = completedTotal + currentSalary;
  const currentMonth = new Date(monthKey).getMonth();
  const currentYear = new Date(monthKey).getFullYear();
  const currentReceived = useMemo(() => records.filter((record) => {
    const date = new Date(record.received_at);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear && (record.entry_type === 'payment' || record.entry_type === 'advance');
  }).reduce((total, record) => total + Number(record.amount || 0), 0), [records, currentMonth, currentYear]);
  const remaining = Math.max(0, currentSalary - currentReceived);
  const status = currentReceived <= 0 ? 'Pending' : currentReceived >= currentSalary && currentSalary > 0 ? 'Paid' : 'Partially Paid';

  const submit = async () => {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) { setError('Enter an amount greater than zero.'); return; }
    setSaving(true);
    setError(null);
    const result = await addSalaryFinanceRecord(profileId, type, amount.trim(), new Date(`${receivedAt}T12:00:00`).toISOString());
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    setAmount('');
    setAddOpen(false);
    setNotice('Finance record added.');
    await load();
  };

  if (profileLoading || loading) return <main style={shell}><p style={{ color: '#64748b' }}>Loading Salary Finance…</p></main>;
  if (!workerProfile) return <main style={shell}><p>Worker profile unavailable.</p></main>;

  return <main style={shell}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
      <div>
        <button type="button" onClick={() => navigate('/work')} style={{ ...button, minHeight: 36, padding: '0 11px', fontSize: 13 }}>← Salary Dashboard</button>
        <h1 style={{ margin: '14px 0 4px', fontSize: 'clamp(28px,7vw,38px)', letterSpacing: '-.035em' }}>Salary Finance</h1>
        <p style={{ margin: 0, color: '#64748b', lineHeight: 1.45 }}>Simple record of salary received and balance.</p>
      </div>
      <button type="button" onClick={() => navigate('/work/finance?setup=1')} style={{ ...button, fontSize: 12 }}>Salary Setup</button>
    </header>

    {error && <div role="alert" style={{ ...card, padding: 12, marginBottom: 12, color: '#b91c1c', background: '#fef2f2', borderColor: '#fecaca', fontSize: 13, fontWeight: 750 }}>{error}</div>}
    {notice && <div role="status" style={{ ...card, padding: 12, marginBottom: 12, color: '#166534', background: '#f0fdf4', borderColor: '#bbf7d0', fontSize: 13, fontWeight: 750 }}>{notice}</div>}

    <section style={{ ...card, padding: 16, marginBottom: 14 }} aria-label="Salary summary">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
        <Summary label="Total Salary" value={money(totalSalary, currency)} />
        <Summary label="Current Salary" value={money(currentSalary, currency)} />
        <Summary label="Received" value={money(currentReceived, currency)} />
        <Summary label="Remaining" value={money(remaining, currency)} />
      </div>
      <div style={{ marginTop: 12, padding: '12px 13px', borderRadius: 13, background: status === 'Paid' ? '#f0fdf4' : '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <span style={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>Current Salary Status</span>
        <strong>{status}</strong>
      </div>
    </section>

    <section style={{ marginBottom: 16 }}>
      <button type="button" onClick={() => setAddOpen((open) => !open)} style={{ width: '100%', minHeight: 48, borderRadius: 13, border: '1px solid #cbd5e1', background: '#111827', color: '#fff', font: 'inherit', fontWeight: 900, cursor: 'pointer' }}>＋ Add Finance Record ▾</button>
      {addOpen && <div style={{ ...card, marginTop: 8, padding: 14 }}>
        <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 800, color: '#475569' }}>Record Type
          <select value={type} onChange={(event) => setType(event.target.value as SalaryFinanceRecordType)} style={input}>
            <option value="advance">Advance Received</option>
            <option value="payment">Payment Received</option>
            <option value="other">Other Adjustment</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6, marginTop: 10, fontSize: 12, fontWeight: 800, color: '#475569' }}>Amount
          <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" style={input} />
        </label>
        <label style={{ display: 'grid', gap: 6, marginTop: 10, fontSize: 12, fontWeight: 800, color: '#475569' }}>Date
          <input type="date" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} style={input} />
        </label>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button type="button" onClick={() => setAddOpen(false)} style={{ ...button, flex: 1 }}>Cancel</button>
          <button type="button" onClick={() => void submit()} disabled={saving} style={{ ...button, flex: 1, background: '#111827', color: '#fff', borderColor: '#111827', opacity: saving ? .65 : 1 }}>{saving ? 'Saving…' : 'Save Record'}</button>
        </div>
      </div>}
    </section>

    <section aria-labelledby="finance-history-heading">
      <h2 id="finance-history-heading" style={{ margin: '0 0 10px', fontSize: 19 }}>Finance History</h2>
      {records.length === 0 ? <div style={{ ...card, padding: 24, textAlign: 'center', color: '#64748b' }}>No finance records yet.</div> : <div style={{ display: 'grid', gap: 9 }}>
        {records.map((record) => <article key={record.id} style={{ ...card, padding: '13px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div><div style={{ fontWeight: 850 }}>{recordLabel(record.entry_type)}</div><div style={{ marginTop: 3, color: '#64748b', fontSize: 12 }}>{dateLabel(record.received_at)}</div></div>
          <strong style={{ whiteSpace: 'nowrap' }}>{money(Number(record.amount || 0), currency)}</strong>
        </article>)}
      </div>}
    </section>
  </main>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div style={{ padding: 12, borderRadius: 13, background: '#f8fafc' }}><div style={{ color: '#64748b', fontSize: 11, fontWeight: 800 }}>{label}</div><div style={{ marginTop: 4, fontWeight: 900, fontSize: 16 }}>{value}</div></div>;
}
