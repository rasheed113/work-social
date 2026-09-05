import { useEffect, useState } from 'react';
import { navigate } from '../../../app/Router';
import { getFinalizedSalaryTotals, getSalaryPolicy } from '../api/salary';
import { useWorkerProfile } from '../hooks/useWorkerProfile';
import type { SalaryPolicy } from '../types/salary';

const shell = { width: '100%', maxWidth: 1080, margin: '0 auto', padding: '20px 14px 120px', boxSizing: 'border-box' as const };
const panel = { border: '1px solid rgba(148,163,184,.22)', borderRadius: 22, background: 'rgba(255,255,255,.96)', boxShadow: '0 18px 45px rgba(15,23,42,.07)', overflow: 'hidden' as const };
const button = { minHeight: 42, padding: '0 14px', borderRadius: 11, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 800, cursor: 'pointer' };
const money = (value: number, currency: string) => `${currency} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function SalaryFinancePage({ profileId }: { profileId: string }) {
  const { workerProfile, loading } = useWorkerProfile(profileId);
  const [policy, setPolicy] = useState<SalaryPolicy | null>(null);
  const [totals, setTotals] = useState({ months: 0, base: 0, overtime: 0, bonuses: 0, adjustments: 0, total: 0 });
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!workerProfile) return;
    void (async () => {
      const [policyResult, totalsResult] = await Promise.all([
        getSalaryPolicy(profileId),
        getFinalizedSalaryTotals(profileId),
      ]);
      setPolicy(policyResult.data);
      if (totalsResult.error) setStatus(totalsResult.error.message);
      else setTotals(totalsResult.data.reduce((acc, row) => ({
        months: acc.months + 1,
        base: acc.base + Number(row.base_salary || 0),
        overtime: acc.overtime + Number(row.overtime_amount || 0),
        bonuses: acc.bonuses + Number(row.bonus_amount || 0),
        adjustments: acc.adjustments + Number(row.adjustments || 0),
        total: acc.total + Number(row.final_amount || 0),
      }), { months: 0, base: 0, overtime: 0, bonuses: 0, adjustments: 0, total: 0 }));
    })();
  }, [profileId, workerProfile]);

  if (loading) return <main style={{ padding: 24 }}>Loading Salary Finance…</main>;
  if (!workerProfile) return <main style={{ padding: 24 }}>Worker profile unavailable.</main>;

  const currency = policy?.currency ?? 'PKR';
  const salaryType = policy?.salary_type === '15_days' ? '15 Days' : policy?.salary_type ? policy.salary_type.charAt(0).toUpperCase() + policy.salary_type.slice(1) : 'Not configured';

  return <main style={{ ...shell, background: 'linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%)' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 18 }}>
      <div>
        <div style={{ display: 'inline-flex', padding: '6px 10px', borderRadius: 999, background: '#eff6ff', color: '#1d4ed8', fontSize: 11, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>Salary Finance</div>
        <h1 style={{ margin: '10px 0 4px', fontSize: 'clamp(28px,6vw,40px)', letterSpacing: '-.035em' }}>Your Salary Finance</h1>
        <p style={{ margin: 0, color: '#64748b', lineHeight: 1.5 }}>Your pay structure and finalized salary finances, kept separate from the dashboard.</p>
      </div>
      <button type="button" onClick={() => navigate('/work')} style={button}>Salary Dashboard</button>
    </header>

    <section style={{ ...panel, marginBottom: 16 }}>
      <div style={{ padding: 20, background: 'linear-gradient(135deg,#111827,#1f2937)', color: '#fff' }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '.1em', opacity: .7 }}>SALARY POLICY</div>
        <h2 style={{ margin: '7px 0 0', fontSize: 26 }}>Configured Pay Structure</h2>
      </div>
      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
        <Metric label="Salary Type" value={salaryType} />
        <Metric label="Currency" value={currency} />
        <Metric label="Salary Amount" value={money(policy?.salary_amount ?? 0, currency)} />
        <Metric label="Basic Salary" value={money(policy?.basic_salary ?? 0, currency)} />
        <Metric label="Working Hours" value={policy?.working_hours ? `${policy.working_hours} h/day` : 'Not set'} />
        <Metric label="OT Multiplier" value={`${Number(policy?.overtime_multiplier ?? 0)}×`} />
        <Metric label="Attendance Allowance" value={money(policy?.attendance_allowance ?? 0, currency)} />
        <Metric label="Other Allowance" value={money(policy?.other_allowance ?? 0, currency)} />
      </div>
      <div style={{ padding: '0 16px 16px' }}><button type="button" onClick={() => navigate('/work/finance?setup=1')} style={button}>Edit Salary Setup</button></div>
    </section>

    <section style={{ ...panel, marginBottom: 16, padding: 18 }}>
      <div style={{ color: '#64748b', fontSize: 11, fontWeight: 900, letterSpacing: '.1em' }}>FINALIZED FINANCE</div>
      <h2 style={{ margin: '5px 0 2px', fontSize: 28 }}>{money(totals.total, currency)}</h2>
      <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>{totals.months} completed salary {totals.months === 1 ? 'month' : 'months'}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 10, marginTop: 16 }}>
        <Metric label="Total Base" value={money(totals.base, currency)} />
        <Metric label="Total Overtime" value={money(totals.overtime, currency)} />
        <Metric label="Total Bonuses" value={money(totals.bonuses, currency)} />
        <Metric label="Total Adjustments" value={money(totals.adjustments, currency)} />
      </div>
    </section>

    {status && <div role="alert" style={{ padding: 12, borderRadius: 12, background: '#fef2f2', color: '#b91c1c', fontWeight: 700 }}>{status}</div>}
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={{ padding: 13, borderRadius: 14, background: '#f8fafc', border: '1px solid #eef2f7' }}><div style={{ color: '#64748b', fontSize: 11, fontWeight: 800 }}>{label}</div><div style={{ marginTop: 4, fontWeight: 900 }}>{value}</div></div>;
}
