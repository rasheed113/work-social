import { useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../../../app/Router';
import { useWorkerProfile } from '../hooks/useWorkerProfile';
import { saveBonusPolicy, saveSalaryPolicy } from '../api/salary';
import { SalaryAllowanceSection } from '../components/SalaryAllowanceSection';
import type { BonusAmountType, BonusFrequency, OvertimeMultiplier, SalaryPolicyInput, SalaryType } from '../types/salary';

const card: React.CSSProperties = { padding: 16, border: '1px solid rgba(148,163,184,.24)', borderRadius: 18, background: 'linear-gradient(145deg,rgba(255,255,255,.98),rgba(248,250,252,.96))', boxShadow: '0 10px 26px rgba(15,23,42,.055), inset 0 1px 0 rgba(255,255,255,.95)' };
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', minHeight: 42, padding: '8px 11px', borderRadius: 11, border: '1px solid #d7dee8', background: 'rgba(255,255,255,.96)', font: 'inherit', outline: 'none', color: '#172033', boxShadow: 'inset 0 1px 2px rgba(15,23,42,.025)' };
const label: React.CSSProperties = { display: 'grid', gap: 6, color: '#334155', fontWeight: 800, fontSize: 12.5 };
const hint: React.CSSProperties = { color: '#64748b', fontSize: 11.5, lineHeight: 1.45, fontWeight: 550 };
const primary: React.CSSProperties = { minHeight: 48, padding: '0 18px', border: 0, borderRadius: 13, background: 'linear-gradient(145deg,#1e293b,#0f172a)', color: '#fff', fontWeight: 900, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 0 rgba(2,6,23,.22), 0 12px 24px rgba(15,23,42,.14), inset 0 1px 0 rgba(255,255,255,.14)' };

export function SalarySetupPage({ profileId }: { profileId: string }) {
  const { workerProfile, loading, error } = useWorkerProfile(profileId);
  const focus = new URLSearchParams(window.location.search).get('focus');
  const focusSalaryType = focus === 'salary-type';
  const focusAllowances = focus === 'allowances';
  const salaryTypeRef = useRef<HTMLLabelElement>(null);
  const [privacyAccepted, setPrivacyAccepted] = useState(focusSalaryType || focusAllowances);
  const [salaryTypeHighlighted, setSalaryTypeHighlighted] = useState(focusSalaryType);
  const [showRules, setShowRules] = useState(true);
  const [showBonus, setShowBonus] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [salary, setSalary] = useState('');
  const [currency, setCurrency] = useState('PKR');
  const [salaryType, setSalaryType] = useState<SalaryType>('monthly');
  const [hours, setHours] = useState('8');
  const [ot, setOt] = useState<OvertimeMultiplier>(1.5);
  const [sundayPaid, setSundayPaid] = useState(false);
  const [holidaysPaid, setHolidaysPaid] = useState(false);
  const [notificationTime, setNotificationTime] = useState('');
  const [payDate, setPayDate] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [totalSalary, setTotalSalary] = useState('');
  const [basicSalary, setBasicSalary] = useState('');
  const [absentRule, setAbsentRule] = useState<'none' | 'daily_salary'>('none');
  const [absenceDeduction, setAbsenceDeduction] = useState('');
  const [leaveTreatment, setLeaveTreatment] = useState<'paid' | 'unpaid'>('paid');
  const [note, setNote] = useState('');
  const [bonusFrequency, setBonusFrequency] = useState<BonusFrequency>('yearly');
  const [bonusAmountType, setBonusAmountType] = useState<BonusAmountType>('full_salary');
  const [bonusExpectedMonths, setBonusExpectedMonths] = useState('1');
  const [bonusFixedAmount, setBonusFixedAmount] = useState('');

  const expectedMonths = useMemo(() => bonusFrequency === 'custom'
    ? (Number(bonusExpectedMonths) || 0)
    : ({ yearly: 1, '6_months': 2, '3_months': 4 } as Record<Exclude<BonusFrequency, 'custom'>, number>)[bonusFrequency], [bonusFrequency, bonusExpectedMonths]);

  useEffect(() => {
    if ((!focusSalaryType && !focusAllowances) || !privacyAccepted || loading || error || !workerProfile) return;
    const scrollTimer = window.setTimeout(() => {
      if (focusSalaryType) {
        salaryTypeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setSalaryTypeHighlighted(true);
        window.setTimeout(() => setSalaryTypeHighlighted(false), 3600);
      }
    }, 180);
    return () => window.clearTimeout(scrollTimer);
  }, [focusSalaryType, focusAllowances, privacyAccepted, loading, error, workerProfile]);

  if (loading) return <main style={{ padding: 24 }}>Loading Salary Setup…</main>;
  if (error || !workerProfile) return <main style={{ padding: 24 }}><p role="alert">{error ?? 'Worker profile unavailable.'}</p></main>;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage(''); setSaved(false);
    const amount = Number(salary);
    const workingHours = hours ? Number(hours) : null;
    if (!Number.isFinite(amount) || amount <= 0) return setMessage('Please enter a valid positive salary amount.');
    if (!currency.trim() || currency.trim().length < 3) return setMessage('Please enter a valid currency code.');
    if (workingHours !== null && (!Number.isFinite(workingHours) || workingHours <= 0)) return setMessage('Working hours must be positive when selected.');
    if (!startDate) return setMessage('Please select a salary start date.');
    if (absentRule === 'daily_salary' && (!absenceDeduction || Number(absenceDeduction) < 0)) return setMessage('Enter the salary deduction per absent day.');
    if (showBonus && bonusAmountType === 'fixed_amount' && (!bonusFixedAmount || Number(bonusFixedAmount) <= 0)) return setMessage('Enter a valid fixed bonus amount.');
    if (showBonus && bonusFrequency === 'custom' && (!bonusExpectedMonths || Number(bonusExpectedMonths) < 1)) return setMessage('Enter the expected number of bonus months.');

    setSaving(true);
    const policy: SalaryPolicyInput = {
      salary_amount: amount,
      currency: currency.trim().toUpperCase(),
      salary_type: salaryType,
      working_hours: workingHours,
      overtime_multiplier: ot,
      sunday_paid: sundayPaid,
      holidays_paid: holidaysPaid,
      attendance_notification_time: notificationTime || null,
      pay_date: payDate ? Number(payDate) : null,
      salary_start_date: startDate,
      total_salary: totalSalary ? Number(totalSalary) : null,
      basic_salary: basicSalary ? Number(basicSalary) : null,
      attendance_allowance: null,
      other_allowance: null,
      absent_rule: absentRule,
      salary_deduction_per_absent_day: absenceDeduction ? Number(absenceDeduction) : null,
      allowance_loss_rule: null,
      allowance_loss_after_absences: null,
      leave_treatment: leaveTreatment,
      custom_rule_note: note.trim() || null,
    };
    const policyResult = await saveSalaryPolicy(workerProfile.id, policy);
    if (policyResult.error) { setSaving(false); return setMessage(policyResult.error.message); }

    if (showBonus) {
      const bonusResult = await saveBonusPolicy(workerProfile.id, {
        frequency: bonusFrequency,
        expected_month_count: expectedMonths,
        amount_type: bonusAmountType,
        fixed_amount: bonusAmountType === 'fixed_amount' ? Number(bonusFixedAmount) : null,
        effective_from: startDate,
      });
      if (bonusResult.error) { setSaving(false); return setMessage(`Salary saved, but bonus setup could not be saved: ${bonusResult.error.message}`); }
    }
    setSaving(false); setSaved(true);
  };

  if (!privacyAccepted) return <main className="salary-setup-page" style={{ width: '100%', maxWidth: 680, margin: '0 auto', padding: '30px 14px 112px', boxSizing: 'border-box' }}>
    <section style={{ ...card, textAlign: 'center', padding: 26 }}>
      <div style={{ width: 52, height: 52, margin: '0 auto 14px', borderRadius: 16, display: 'grid', placeItems: 'center', background: 'linear-gradient(145deg,#eef2ff,#dbeafe)', color: '#3730a3', fontSize: 24, boxShadow: '0 4px 0 rgba(79,70,229,.12)' }}>✓</div>
      <div style={{ color: '#4f46e5', fontSize: 10.5, fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase' }}>Salary Person • Secure Setup</div>
      <h1 style={{ margin: '7px 0 10px', fontSize: 26, letterSpacing: '-.03em' }}>Your Salary Data Is Private</h1>
      <p style={{ color: '#475569', lineHeight: 1.6, margin: 0, fontSize: 13 }}>Your salary information is used to maintain your personal salary, attendance, overtime, bonus, allowance, and salary records in Work Social. It is not intended for public Social display or sharing.</p>
      <div style={{ marginTop: 16, padding: 13, borderRadius: 13, background: '#f8fafc', textAlign: 'left', color: '#475569', fontSize: 12, lineHeight: 1.5 }}><strong style={{ color: '#0f172a' }}>Before you continue:</strong><br/>Review each salary rule carefully. Your selections will be used by the salary calculator for future records.</div>
      <button type="button" onClick={() => setPrivacyAccepted(true)} style={{ ...primary, width: '100%', marginTop: 18 }}>Continue to Salary Setup</button>
      <button type="button" onClick={() => navigate('/work/finance')} style={{ marginTop: 9, minHeight: 38, border: 0, background: 'transparent', color: '#64748b', fontWeight: 800, cursor: 'pointer' }}>Cancel</button>
    </section>
  </main>;

  if (saved) return <main className="salary-setup-page" style={{ width: '100%', maxWidth: 680, margin: '0 auto', padding: '30px 14px 112px', boxSizing: 'border-box' }}><section style={{ ...card, textAlign: 'center', padding: 28 }}>
    <div style={{ width: 60, height: 60, margin: '0 auto 14px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'linear-gradient(145deg,#ecfdf5,#d1fae5)', color: '#047857', fontSize: 29, boxShadow: '0 4px 0 rgba(4,120,87,.12)' }}>✓</div>
    <div style={{ color: '#047857', fontSize: 10.5, fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase' }}>Setup Complete</div>
    <h1 style={{ margin: '7px 0 10px', fontSize: 25, letterSpacing: '-.025em' }}>Salary Setup Saved Successfully</h1>
    <p style={{ color: '#475569', lineHeight: 1.6, fontSize: 13 }}>Your salary policy{showBonus ? ' and bonus policy' : ''} has been saved. Your allowance rules are stored separately with their own conditions and history.</p>
    <div style={{ margin: '18px 0', padding: 14, borderRadius: 13, background: '#f8fafc', textAlign: 'left', color: '#475569', lineHeight: 1.55, fontSize: 12 }}><strong style={{ color: '#0f172a' }}>For accurate records</strong><br/>• Add overtime hours whenever you actually work overtime.<br/>• Respond to daily attendance notifications when they appear.<br/>• Keep your attendance and overtime records up to date.</div>
    <button type="button" onClick={() => navigate('/work/finance')} style={{ ...primary, width: '100%' }}>Go to Salary Dashboard</button>
  </section></main>;

  return <main className="salary-setup-page" style={{ width: '100%', maxWidth: 760, margin: '0 auto', padding: '20px 12px 112px', boxSizing: 'border-box' }}>
    <style>{`@keyframes salaryTypeAttention { 0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); border-color: #d7dee8; } 50% { box-shadow: 0 0 0 6px rgba(245,158,11,.18), 0 8px 24px rgba(245,158,11,.12); border-color: #f59e0b; } }
.salary-setup-page { color:#172033; }
.salary-setup-page form > section { position:relative; overflow:hidden; }
.salary-setup-page form > section::before { content:''; position:absolute; inset:0 0 auto 0; height:2px; background:linear-gradient(90deg,rgba(99,102,241,.0),rgba(99,102,241,.35),rgba(20,184,166,.22),rgba(99,102,241,0)); pointer-events:none; }
.salary-setup-page form label { transition:transform .18s ease; }
.salary-setup-page form label:focus-within { transform:translateY(-1px); }
.salary-setup-page form input, .salary-setup-page form select, .salary-setup-page form textarea { border-color:#d7dee8 !important; border-radius:11px !important; background:rgba(255,255,255,.98) !important; box-shadow:inset 0 1px 2px rgba(15,23,42,.025), 0 0 0 0 rgba(79,70,229,0) !important; transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease !important; }
.salary-setup-page form input:focus, .salary-setup-page form select:focus, .salary-setup-page form textarea:focus { border-color:#818cf8 !important; box-shadow:0 0 0 4px rgba(99,102,241,.10), 0 5px 14px rgba(15,23,42,.05) !important; outline:none !important; }
.salary-setup-page form select { cursor:pointer; }
@media (max-width:560px) { .salary-setup-page form > section { padding:14px !important; border-radius:16px !important; } .salary-setup-page form > section > div > div { grid-template-columns:1fr !important; } }
`}</style>
    <button type="button" onClick={() => navigate('/work/identity')} style={{ minHeight: 36, padding: '0 11px', borderRadius: 10, fontWeight: 850, border: '1px solid #dfe5ed', background: 'linear-gradient(180deg,#fff,#f5f7fa)', color: '#334155', cursor: 'pointer', boxShadow: '0 2px 0 rgba(100,116,139,.08)' }}>← Work Identity</button>
    <header style={{ margin: '15px 2px 17px' }}><div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'5px 9px', borderRadius:999, background:'linear-gradient(145deg,#eef2ff,#e0e7ff)', color:'#4338ca', fontSize:9.5, fontWeight:900, letterSpacing:'.11em', textTransform:'uppercase' }}>Salary Person</div><h1 style={{ margin: '9px 0 5px', fontSize: 27, letterSpacing: '-.035em', lineHeight:1.1 }}>Salary Setup</h1><p style={{ margin: 0, color: '#64748b', lineHeight: 1.5, fontSize: 12.5, maxWidth:650 }}>Set your salary policy once, then define each allowance with clear questions and answers so future salary records remain explainable.</p></header>
    <form onSubmit={submit} style={{ display: 'grid', gap: 11 }}>
      <section style={{ ...card, display: 'grid', gap: 12 }}><SectionTitle title="Salary & Working Terms" subtitle="Core values used by salary and overtime calculations."/><div style={{ display: 'grid', gap: 10 }}>
        <label style={{ ...label, gridColumn:'1 / -1' }}>Salary Amount<input required type="number" min="0.01" step="0.01" value={salary} onChange={e => setSalary(e.target.value)} style={{ ...input, minHeight: 46, fontSize: 16, fontWeight: 850 }} placeholder="e.g. 150000"/></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 10 }}><label style={label}>Currency<input required maxLength={10} value={currency} onChange={e => setCurrency(e.target.value)} style={input} placeholder="PKR"/></label><label ref={salaryTypeRef} style={{ ...label, padding: salaryTypeHighlighted ? 9 : 0, margin: salaryTypeHighlighted ? -9 : 0, borderRadius: 13, background: salaryTypeHighlighted ? '#fffbeb' : 'transparent', animation: salaryTypeHighlighted ? 'salaryTypeAttention 1.1s ease-in-out 0s 3' : undefined }}>Salary Type<select value={salaryType} onChange={e => { setSalaryType(e.target.value as SalaryType); setSalaryTypeHighlighted(false); }} style={input}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="15_days">15 Days</option><option value="monthly">Monthly</option></select>{salaryTypeHighlighted && <span style={{ color: '#b45309', fontSize: 11, fontWeight: 900 }}>Required step — choose your salary cycle.</span>}</label></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><label style={label}>Working Hours<select value={hours} onChange={e => setHours(e.target.value)} style={input}><option value="8">8 hours</option><option value="12">12 hours</option><option value="">Optional / not set</option></select></label><label style={label}>Overtime Rate<select value={ot} onChange={e => setOt(Number(e.target.value) as OvertimeMultiplier)} style={input}><option value="1">1× Standard</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label></div>
        <p style={{ ...hint, margin: 0, padding:'8px 10px', borderRadius:10, background:'#f8fafc' }}>Overtime is calculated from these saved values; the app does not ask you to enter a manual hourly rate.</p>
      </div></section>

      <section style={{ ...card, display: 'grid', gap: 12 }}><SectionTitle title="Work Rules & Notifications" subtitle="Weekly rest, holidays and reminder preferences."/><div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><label style={label}>Sunday Paid<select value={String(sundayPaid)} onChange={e => setSundayPaid(e.target.value === 'true')} style={input}><option value="true">Yes</option><option value="false">No</option></select></label><label style={label}>Holidays Paid<select value={String(holidaysPaid)} onChange={e => setHolidaysPaid(e.target.value === 'true')} style={input}><option value="true">Yes</option><option value="false">No</option></select></label></div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}><label style={label}>Attendance Notification Time<input type="time" value={notificationTime} onChange={e => setNotificationTime(e.target.value)} style={input}/><span style={hint}>Leave empty to disable reminders.</span></label><label style={label}>Pay Date <span style={{ fontWeight: 550 }}>(notification only)</span><input type="number" min="1" max="31" value={payDate} onChange={e => setPayDate(e.target.value)} placeholder="Optional" style={input}/></label></div>
        <label style={label}>Salary Start Date<input required type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={input}/></label>
      </div></section>

      <SalaryAllowanceSection profileId={profileId} effectiveFrom={startDate} focused={focusAllowances} />

      <section style={{ ...card, display: 'grid', gap: 12 }}><button type="button" onClick={() => setShowRules(v => !v)} style={{ border: 0, background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}><SectionTitle title="Salary Rules & Absence" subtitle="Salary deductions and leave treatment stay separate from allowance loss rules." open={showRules}/></button>{showRules && <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><label style={label}>Total Salary<input type="number" min="0" step="0.01" value={totalSalary} onChange={e => setTotalSalary(e.target.value)} style={input} placeholder="Optional"/></label><label style={label}>Basic Salary<input type="number" min="0" step="0.01" value={basicSalary} onChange={e => setBasicSalary(e.target.value)} style={input} placeholder="Optional"/></label></div>
        <label style={label}>Absent Rule<select value={absentRule} onChange={e => setAbsentRule(e.target.value as 'none'|'daily_salary')} style={input}><option value="none">No absence deduction</option><option value="daily_salary">Deduct daily salary for each absence</option></select></label>
        {absentRule === 'daily_salary' && <label style={label}>Salary Deduction per Absent Day<input type="number" min="0" step="0.01" value={absenceDeduction} onChange={e => setAbsenceDeduction(e.target.value)} style={input}/></label>}
        <label style={label}>Leave Treatment<select value={leaveTreatment} onChange={e => setLeaveTreatment(e.target.value as 'paid'|'unpaid')} style={input}><option value="paid">Paid leave</option><option value="unpaid">Unpaid leave</option></select></label>
        <label style={label}>Custom Salary Rule / Note<textarea rows={3} value={note} onChange={e => setNote(e.target.value)} style={{ ...input, resize: 'vertical' }} placeholder="Optional note for your own salary record"/></label>
      </div>}</section>

      <section style={{ ...card, display: 'grid', gap: 12 }}><button type="button" onClick={() => setShowBonus(v => !v)} style={{ border: 0, background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}><SectionTitle title="Bonus Settings" subtitle="Optional: configure expected bonus frequency and amount." open={showBonus}/></button>{showBonus && <div style={{ display: 'grid', gap: 10 }}>
        <label style={label}>Bonus Frequency<select value={bonusFrequency} onChange={e => { const value = e.target.value as BonusFrequency; setBonusFrequency(value); if (value !== 'custom') setBonusExpectedMonths(String({ yearly: 1, '6_months': 2, '3_months': 4 }[value as Exclude<BonusFrequency, 'custom'>])); }} style={input}><option value="yearly">Yearly</option><option value="6_months">Every 6 Months</option><option value="3_months">Every 3 Months</option><option value="custom">Custom</option></select></label>
        <label style={label}>Expected Bonus Months<input type="number" min="1" step="1" value={expectedMonths || ''} onChange={e => setBonusExpectedMonths(e.target.value)} disabled={bonusFrequency !== 'custom'} style={{ ...input, opacity: bonusFrequency === 'custom' ? 1 : .7 }}/><span style={hint}>Yearly = 1, every 6 months = 2, every 3 months = 4. Custom lets you choose the count.</span></label>
        <label style={label}>Bonus Amount<select value={bonusAmountType} onChange={e => setBonusAmountType(e.target.value as BonusAmountType)} style={input}><option value="half_salary">Half Salary</option><option value="full_salary">Full Salary</option><option value="fixed_amount">Fixed Amount</option></select></label>
        {bonusAmountType === 'fixed_amount' && <label style={label}>Fixed Bonus Amount<input type="number" min="0.01" step="0.01" value={bonusFixedAmount} onChange={e => setBonusFixedAmount(e.target.value)} style={input}/></label>}
      </div>}</section>

      {message && <div role="alert" style={{ padding: 12, borderRadius: 12, background: 'linear-gradient(145deg,#fef2f2,#fff7f7)', border:'1px solid #fecaca', color: '#991b1b', fontWeight: 750, lineHeight: 1.45, fontSize:12 }}>{message}</div>}
      <button type="submit" disabled={saving} style={{ ...primary, opacity: saving ? .7 : 1 }}>{saving ? 'Saving your salary setup…' : 'Save Salary Setup'}</button>
      <p style={{ ...hint, textAlign: 'center', margin: 0, padding:'0 8px' }}>Your salary policy and allowance rules are stored as personal Salary Person records. Allowance conditions remain independent so one allowance can be lost without changing another.</p>
    </form>
  </main>;
}

function SectionTitle({ title, subtitle, open }: { title: string; subtitle: string; open?: boolean }) {
  return <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}><div style={{ minWidth:0 }}><h2 style={{ margin:0, fontSize:15.5, color:'#172033', letterSpacing:'-.018em' }}>{title}</h2><p style={{ margin:'3px 0 0', color:'#718096', fontSize:10.8, lineHeight:1.4 }}>{subtitle}</p></div>{open !== undefined && <span style={{ flex:'0 0 auto', width:28, height:28, display:'grid', placeItems:'center', borderRadius:9, background:'#f1f5f9', color:'#475569', fontWeight:950, boxShadow:'inset 0 1px 0 #fff' }}>{open ? '−' : '+'}</span>}</div>;
}
