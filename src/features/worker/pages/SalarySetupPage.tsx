import { useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../../../app/Router';
import { useWorkerProfile } from '../hooks/useWorkerProfile';
import { getSalaryPolicy, saveBonusPolicy, saveSalaryPolicy, updateSalaryPolicy } from '../api/salary';
import { SalaryAllowanceSection } from '../components/SalaryAllowanceSection';
import type { BonusAmountType, BonusFrequency, OvertimeMultiplier, SalaryPolicyInput, SalaryType } from '../types/salary';

const card: React.CSSProperties = { padding: 16, border: '1px solid rgba(148,163,184,.24)', borderRadius: 18, background: 'linear-gradient(145deg,rgba(255,255,255,.99),rgba(248,250,252,.97))', boxShadow: '0 12px 30px rgba(15,23,42,.07), inset 0 1px 0 rgba(255,255,255,.96)' };
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', minHeight: 42, padding: '8px 11px', borderRadius: 11, border: '1px solid #d7dee8', background: '#fff', font: 'inherit', outline: 'none', color: '#172033' };
const label: React.CSSProperties = { display: 'grid', gap: 6, color: '#334155', fontWeight: 800, fontSize: 12.5 };
const hint: React.CSSProperties = { color: '#64748b', fontSize: 11.5, lineHeight: 1.45, fontWeight: 550 };
const primary: React.CSSProperties = { minHeight: 48, padding: '0 18px', border: 0, borderRadius: 13, background: 'linear-gradient(145deg,#312e81,#0f172a)', color: '#fff', fontWeight: 900, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 0 rgba(2,6,23,.2), 0 12px 24px rgba(15,23,42,.14)' };

type PickerOption = { value: string; label: string; description?: string };

function PremiumPicker({ label: fieldLabel, value, options, onChange, highlighted = false }: { label: string; value: string; options: PickerOption[]; onChange: (value: string) => void; highlighted?: boolean }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value) ?? options[0];
  return <>
    <div style={{ ...label, padding: highlighted ? 8 : 0, margin: highlighted ? -8 : 0, borderRadius: 14, background: highlighted ? '#fffbeb' : 'transparent', boxShadow: highlighted ? '0 0 0 5px rgba(245,158,11,.12)' : undefined }}>
      {fieldLabel}
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} style={{ ...input, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer', textAlign: 'left', boxShadow: '0 3px 10px rgba(15,23,42,.04)' }}>
        <span>{selected?.label ?? value}</span><span style={{ color: '#6366f1', fontWeight: 900 }}>⌄</span>
      </button>
      {highlighted && <span style={{ color: '#b45309', fontSize: 11, fontWeight: 900 }}>Required step — choose your salary cycle.</span>}
    </div>
    {open && <div role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 18, background: 'rgba(2,6,23,.58)', backdropFilter: 'blur(10px)' }}>
      <div role="dialog" aria-modal="true" aria-label={fieldLabel} style={{ width: '100%', maxWidth: 430, maxHeight: 'min(78vh,620px)', overflow: 'auto', borderRadius: 22, padding: 16, background: 'linear-gradient(145deg,#ffffff,#eef2ff)', border: '1px solid rgba(255,255,255,.9)', boxShadow: '0 30px 80px rgba(2,6,23,.3), inset 0 1px 0 #fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}><div><div style={{ color: '#6366f1', fontSize: 9.5, fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase' }}>Choose setting</div><h3 style={{ margin: '4px 0 0', fontSize: 19, color: '#0f172a' }}>{fieldLabel}</h3></div><button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ width: 34, height: 34, border: 0, borderRadius: '50%', background: '#e2e8f0', color: '#334155', fontSize: 18, cursor: 'pointer' }}>×</button></div>
        <div style={{ display: 'grid', gap: 8 }}>{options.map(option => { const active = option.value === value; return <button key={option.value} type="button" onClick={() => { onChange(option.value); setOpen(false); }} style={{ width: '100%', padding: '12px 13px', borderRadius: 15, border: active ? '1.5px solid #6366f1' : '1px solid #dbe3ee', background: active ? 'linear-gradient(145deg,#eef2ff,#e0e7ff)' : '#fff', textAlign: 'left', cursor: 'pointer', boxShadow: active ? '0 8px 18px rgba(99,102,241,.13)' : '0 3px 10px rgba(15,23,42,.04)' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><strong style={{ color: '#172033', fontSize: 13.5 }}>{option.label}</strong><span style={{ color: active ? '#4f46e5' : '#94a3b8', fontWeight: 900 }}>{active ? '✓' : '○'}</span></div>{option.description && <div style={{ marginTop: 4, color: '#64748b', fontSize: 11.5, lineHeight: 1.4 }}>{option.description}</div>}</button>; })}</div>
      </div>
    </div>}
  </>;
}

function SectionHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) { return <div><div style={{ color: '#6366f1', fontSize: 9.5, fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase' }}>{eyebrow}</div><h2 style={{ margin: '4px 0 4px', color: '#0f172a', fontSize: 18, letterSpacing: '-.02em' }}>{title}</h2><p style={{ margin: 0, color: '#64748b', fontSize: 11.5, lineHeight: 1.45 }}>{subtitle}</p></div>; }

export function SalarySetupPage({ profileId }: { profileId: string }) {
  const { workerProfile, loading, error } = useWorkerProfile(profileId);
  const focus = new URLSearchParams(window.location.search).get('focus');
  const focusSalaryType = focus === 'salary-type';
  const focusAllowances = focus === 'allowances';
  const salaryTypeRef = useRef<HTMLDivElement>(null);
  const [privacyAccepted, setPrivacyAccepted] = useState(focusSalaryType || focusAllowances);
  const [salaryTypeHighlighted, setSalaryTypeHighlighted] = useState(focusSalaryType);
  const [showRules, setShowRules] = useState(true);
  const [showBonus, setShowBonus] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [policyId, setPolicyId] = useState<string | null>(null);
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

  const expectedMonths = useMemo(() => bonusFrequency === 'custom' ? (Number(bonusExpectedMonths) || 0) : ({ yearly: 1, '6_months': 2, '3_months': 4 } as Record<Exclude<BonusFrequency, 'custom'>, number>)[bonusFrequency], [bonusFrequency, bonusExpectedMonths]);

  useEffect(() => {
    if (loading || error || !workerProfile) return;
    let cancelled = false;
    void getSalaryPolicy(profileId).then(result => {
      if (cancelled || result.error || !result.data) return;
      const policy = result.data;
      setPolicyId(policy.id);
      setSalary(String(policy.salary_amount ?? ''));
      setCurrency(policy.currency ?? 'PKR');
      setSalaryType(policy.salary_type);
      setHours(policy.working_hours == null ? '' : String(policy.working_hours));
      setOt(policy.overtime_multiplier);
      setSundayPaid(Boolean(policy.sunday_paid));
      setHolidaysPaid(Boolean(policy.holidays_paid));
      setNotificationTime(policy.attendance_notification_time ? String(policy.attendance_notification_time).slice(0, 5) : '');
      setPayDate(policy.pay_date == null ? '' : String(policy.pay_date));
      setStartDate(policy.salary_start_date ?? new Date().toISOString().slice(0, 10));
      setTotalSalary(policy.total_salary == null ? '' : String(policy.total_salary));
      setBasicSalary(policy.basic_salary == null ? '' : String(policy.basic_salary));
      setAbsentRule(policy.absent_rule);
      setAbsenceDeduction(policy.salary_deduction_per_absent_day == null ? '' : String(policy.salary_deduction_per_absent_day));
      setLeaveTreatment(policy.leave_treatment);
      setNote(policy.custom_rule_note ?? '');
    });
    return () => { cancelled = true; };
  }, [profileId, loading, error, workerProfile]);

  useEffect(() => {
    if ((!focusSalaryType && !focusAllowances) || !privacyAccepted || loading || error || !workerProfile) return;
    const timer = window.setTimeout(() => { if (focusSalaryType) { salaryTypeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setSalaryTypeHighlighted(true); window.setTimeout(() => setSalaryTypeHighlighted(false), 3600); } }, 180);
    return () => window.clearTimeout(timer);
  }, [focusSalaryType, focusAllowances, privacyAccepted, loading, error, workerProfile]);

  if (loading) return <main className="salary-setup-page" style={{ padding: 24 }}>Loading Salary Setup…</main>;
  if (error || !workerProfile) return <main className="salary-setup-page" style={{ padding: 24 }}><p role="alert">{error ?? 'Worker profile unavailable.'}</p></main>;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage(''); setSaved(false);
    const amount = Number(salary); const workingHours = hours ? Number(hours) : null;
    if (!Number.isFinite(amount) || amount <= 0) return setMessage('Please enter a valid positive salary amount.');
    if (!currency.trim() || currency.trim().length < 3) return setMessage('Please enter a valid currency code.');
    if (workingHours !== null && (!Number.isFinite(workingHours) || workingHours <= 0)) return setMessage('Working hours must be positive when selected.');
    if (!startDate) return setMessage('Please select a salary start date.');
    if (absentRule === 'daily_salary' && (!absenceDeduction || Number(absenceDeduction) < 0)) return setMessage('Enter the salary deduction per absent day.');
    if (showBonus && bonusAmountType === 'fixed_amount' && (!bonusFixedAmount || Number(bonusFixedAmount) <= 0)) return setMessage('Enter a valid fixed bonus amount.');
    if (showBonus && bonusFrequency === 'custom' && (!bonusExpectedMonths || Number(bonusExpectedMonths) < 1)) return setMessage('Enter the expected number of bonus months.');
    setSaving(true);
    const policy: SalaryPolicyInput = { salary_amount: amount, currency: currency.trim().toUpperCase(), salary_type: salaryType, working_hours: workingHours, overtime_multiplier: ot, sunday_paid: sundayPaid, holidays_paid: holidaysPaid, attendance_notification_time: notificationTime || null, pay_date: payDate ? Number(payDate) : null, salary_start_date: startDate, total_salary: totalSalary ? Number(totalSalary) : null, basic_salary: basicSalary ? Number(basicSalary) : null, attendance_allowance: null, other_allowance: null, absent_rule: absentRule, salary_deduction_per_absent_day: absenceDeduction ? Number(absenceDeduction) : null, allowance_loss_rule: null, allowance_loss_after_absences: null, leave_treatment: leaveTreatment, custom_rule_note: note.trim() || null };
    const policyResult = policyId ? await updateSalaryPolicy(workerProfile.id, policyId, policy) : await saveSalaryPolicy(workerProfile.id, policy);
    if (policyResult.error) { setSaving(false); return setMessage(policyResult.error.message); }
    if (policyResult.data?.id) setPolicyId(policyResult.data.id);
    if (showBonus) { const bonusResult = await saveBonusPolicy(workerProfile.id, { frequency: bonusFrequency, expected_month_count: expectedMonths, amount_type: bonusAmountType, fixed_amount: bonusAmountType === 'fixed_amount' ? Number(bonusFixedAmount) : null, effective_from: startDate }); if (bonusResult.error) { setSaving(false); return setMessage(`Salary saved, but bonus setup could not be saved: ${bonusResult.error.message}`); } }
    setSaving(false); setSaved(true);
  };

  if (!privacyAccepted) return <main className="salary-setup-page" style={{ width: '100%', maxWidth: 680, margin: '0 auto', padding: '30px 14px 112px', boxSizing: 'border-box' }}><section style={{ ...card, textAlign: 'center', padding: 26 }}><div style={{ width: 52, height: 52, margin: '0 auto 14px', borderRadius: 16, display: 'grid', placeItems: 'center', background: 'linear-gradient(145deg,#eef2ff,#dbeafe)', color: '#3730a3', fontSize: 24 }}>✓</div><div style={{ color: '#4f46e5', fontSize: 10.5, fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase' }}>Salary Person • Secure Setup</div><h1 style={{ margin: '7px 0 10px', fontSize: 26, letterSpacing: '-.03em' }}>Your Salary Data Is Private</h1><p style={{ color: '#475569', lineHeight: 1.6, margin: 0, fontSize: 13 }}>Your salary information is used to maintain your personal salary, attendance, overtime, bonus, allowance, and salary records in Work Social. It is not intended for public Social display or sharing.</p><div style={{ marginTop: 16, padding: 13, borderRadius: 13, background: '#f8fafc', textAlign: 'left', color: '#475569', fontSize: 12, lineHeight: 1.5 }}><strong style={{ color: '#0f172a' }}>Before you continue:</strong><br/>Review each salary rule carefully. Your selections will be used by the salary calculator for future records.</div><button type="button" onClick={() => setPrivacyAccepted(true)} style={{ ...primary, width: '100%', marginTop: 18 }}>Continue to Salary Setup</button><button type="button" onClick={() => navigate('/work/finance')} style={{ marginTop: 9, minHeight: 38, border: 0, background: 'transparent', color: '#64748b', fontWeight: 800, cursor: 'pointer' }}>Cancel</button></section></main>;

  if (saved) return <main className="salary-setup-page" style={{ width: '100%', maxWidth: 680, margin: '0 auto', padding: '30px 14px 112px', boxSizing: 'border-box' }}><section style={{ ...card, textAlign: 'center', padding: 28 }}><div style={{ width: 60, height: 60, margin: '0 auto 14px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'linear-gradient(145deg,#ecfdf5,#d1fae5)', color: '#047857', fontSize: 29 }}>✓</div><div style={{ color: '#047857', fontSize: 10.5, fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase' }}>Setup Complete</div><h1 style={{ margin: '7px 0 10px', fontSize: 25 }}>Salary Setup Saved Successfully</h1><p style={{ color: '#475569', lineHeight: 1.6, fontSize: 13 }}>Your salary policy{showBonus ? ' and bonus policy' : ''} has been saved. Your allowance rules are stored separately with their own conditions and history.</p><div style={{ margin: '18px 0', padding: 14, borderRadius: 13, background: '#f8fafc', textAlign: 'left', color: '#475569', lineHeight: 1.55, fontSize: 12 }}><strong style={{ color: '#0f172a' }}>For accurate records</strong><br/>• Add overtime hours whenever you actually work overtime.<br/>• Respond to daily attendance notifications when they appear.<br/>• Keep your attendance and overtime records up to date.</div><button type="button" onClick={() => navigate('/work/finance')} style={{ ...primary, width: '100%' }}>Go to Salary Dashboard</button></section></main>;

  const salaryTypeOptions: PickerOption[] = [{ value:'daily', label:'Daily', description:'Salary calculated per working day.' }, { value:'weekly', label:'Weekly', description:'Salary cycle based on seven days.' }, { value:'15_days', label:'15 Days', description:'Salary cycle based on fifteen days.' }, { value:'monthly', label:'Monthly', description:'Salary cycle based on the calendar month.' }];
  const hoursOptions: PickerOption[] = [{value:'8',label:'8 hours',description:'Standard eight-hour workday.'},{value:'12',label:'12 hours',description:'Twelve-hour workday.'},{value:'',label:'Optional / not set',description:'Leave working hours unspecified.'}];
  const otOptions: PickerOption[] = [{value:'1',label:'1× Standard',description:'Normal hourly rate.'},{value:'1.5',label:'1.5×',description:'One and a half times the hourly rate.'},{value:'2',label:'2×',description:'Double the hourly rate.'}];
  const yesNo = (yesLabel = 'Yes', noLabel = 'No'): PickerOption[] => [{value:'true',label:yesLabel},{value:'false',label:noLabel}];
  const absentOptions: PickerOption[] = [{value:'none',label:'No absence deduction',description:'Absences do not deduct base salary.'},{value:'daily_salary',label:'Deduct daily salary for each absence',description:'Apply the saved deduction amount for each absent day.'}];
  const leaveOptions: PickerOption[] = [{value:'paid',label:'Paid leave',description:'Leave days remain paid.'},{value:'unpaid',label:'Unpaid leave',description:'Leave days are treated as unpaid.'}];
  const bonusFreqOptions: PickerOption[] = [{value:'yearly',label:'Yearly'},{value:'6_months',label:'Every 6 Months'},{value:'3_months',label:'Every 3 Months'},{value:'custom',label:'Custom'}];
  const bonusAmountOptions: PickerOption[] = [{value:'half_salary',label:'Half Salary'},{value:'full_salary',label:'Full Salary'},{value:'fixed_amount',label:'Fixed Amount'}];

  return <main className="salary-setup-page" style={{ width: '100%', maxWidth: 760, margin: '0 auto', padding: '20px 12px 112px', boxSizing: 'border-box' }}><style>{`@keyframes salaryTypeAttention { 0%,100% { box-shadow:0 0 0 0 rgba(245,158,11,0); } 50% { box-shadow:0 0 0 6px rgba(245,158,11,.18),0 8px 24px rgba(245,158,11,.12); } } .salary-setup-page{color:#172033}.salary-setup-page form>section{position:relative;overflow:hidden}.salary-setup-page form>section:before{content:'';position:absolute;inset:0 0 auto;height:2px;background:linear-gradient(90deg,transparent,rgba(99,102,241,.38),rgba(20,184,166,.22),transparent);pointer-events:none}.salary-setup-page input,.salary-setup-page textarea{border-color:#d7dee8!important;border-radius:11px!important}.salary-setup-page input:focus,.salary-setup-page textarea:focus{border-color:#818cf8!important;box-shadow:0 0 0 4px rgba(99,102,241,.1)!important;outline:none!important}@media(max-width:560px){.salary-setup-page form>section{padding:14px!important;border-radius:16px!important}}`}</style><button type="button" onClick={() => navigate('/work/identity')} style={{ minHeight:36,padding:'0 11px',borderRadius:10,fontWeight:850,border:'1px solid #dfe5ed',background:'linear-gradient(180deg,#fff,#f5f7fa)',color:'#334155',cursor:'pointer' }}>← Work Identity</button><header style={{ margin:'15px 2px 17px' }}><div style={{display:'inline-flex',alignItems:'center',padding:'5px 9px',borderRadius:999,background:'linear-gradient(145deg,#eef2ff,#e0e7ff)',color:'#4338ca',fontSize:9.5,fontWeight:900,letterSpacing:'.11em',textTransform:'uppercase'}}>Salary Person</div><h1 style={{margin:'9px 0 5px',fontSize:27,letterSpacing:'-.035em'}}>Salary Setup</h1><p style={{margin:0,color:'#64748b',lineHeight:1.5,fontSize:12.5}}>Set your salary policy once, then define each allowance with clear questions and answers so future salary records remain explainable.</p></header><form onSubmit={submit} style={{display:'grid',gap:11}}>
    <section style={{...card,display:'grid',gap:13}}><SectionHeader eyebrow="01 · Core policy" title="Salary & Working Terms" subtitle="Your core salary, working hours and overtime calculation settings."/><div style={{display:'grid',gap:10}}><label style={{...label,fontSize:13.5}}>Salary Amount<input required type="number" min="0.01" step="0.01" value={salary} onChange={e=>setSalary(e.target.value)} style={{...input,fontSize:18,fontWeight:900,padding:'10px 12px'}} placeholder="e.g. 150000"/></label><div style={{display:'grid',gridTemplateColumns:'1fr 1.35fr',gap:10}}><label style={label}>Currency<input required maxLength={10} value={currency} onChange={e=>setCurrency(e.target.value)} style={input} placeholder="PKR"/></label><div ref={salaryTypeRef}><PremiumPicker label="Salary Type" value={salaryType} options={salaryTypeOptions} highlighted={salaryTypeHighlighted} onChange={value=>{setSalaryType(value as SalaryType);setSalaryTypeHighlighted(false)}}/></div></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><PremiumPicker label="Working Hours" value={hours} options={hoursOptions} onChange={setHours}/><PremiumPicker label="Overtime Rate" value={String(ot)} options={otOptions} onChange={value=>setOt(Number(value) as OvertimeMultiplier)}/></div><p style={{...hint,margin:0,padding:'9px 10px',borderRadius:10,background:'#f8fafc'}}>Overtime is calculated from these saved values; no manual hourly rate is required.</p></div></section>
    <section style={{...card,display:'grid',gap:13}}><SectionHeader eyebrow="02 · Work calendar" title="Work Rules & Notifications" subtitle="Set weekly rest, holiday and reminder behavior."/><div style={{display:'grid',gap:10}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><PremiumPicker label="Sunday Paid" value={String(sundayPaid)} options={yesNo()} onChange={value=>setSundayPaid(value==='true')}/><PremiumPicker label="Holidays Paid" value={String(holidaysPaid)} options={yesNo()} onChange={value=>setHolidaysPaid(value==='true')}/></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><label style={label}>Attendance Notification Time<input type="time" value={notificationTime} onChange={e=>setNotificationTime(e.target.value)} style={input}/><span style={hint}>Leave empty to disable attendance reminders.</span></label><label style={label}>Pay Date <span style={{fontWeight:500}}>(notification only)</span><input type="number" min="1" max="31" value={payDate} onChange={e=>setPayDate(e.target.value)} placeholder="Optional" style={input}/></label></div><label style={label}>Salary Start Date<input required type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} style={input}/></label></div></section>
    <SalaryAllowanceSection profileId={profileId} effectiveFrom={startDate} focused={focusAllowances}/>
    <section style={{...card,display:'grid',gap:13}}><button type="button" onClick={()=>setShowRules(v=>!v)} style={{border:0,background:'transparent',padding:0,textAlign:'left',cursor:'pointer'}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}><SectionHeader eyebrow="04 · Absence policy" title="Salary Rules & Absence" subtitle="Keep salary deductions and leave treatment separate from allowance loss conditions."/><span style={{width:30,height:30,borderRadius:'50%',display:'grid',placeItems:'center',background:'#eef2ff',color:'#4f46e5',fontWeight:900}}>{showRules?'−':'+'}</span></div></button>{showRules&&<div style={{display:'grid',gap:10}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><label style={label}>Total Salary<input type="number" min="0" step="0.01" value={totalSalary} onChange={e=>setTotalSalary(e.target.value)} style={input} placeholder="Optional"/></label><label style={label}>Basic Salary<input type="number" min="0" step="0.01" value={basicSalary} onChange={e=>setBasicSalary(e.target.value)} style={input} placeholder="Optional"/></label></div><PremiumPicker label="Absent Rule" value={absentRule} options={absentOptions} onChange={value=>setAbsentRule(value as 'none'|'daily_salary')}/>{absentRule==='daily_salary'&&<label style={label}>Salary Deduction per Absent Day<input type="number" min="0" step="0.01" value={absenceDeduction} onChange={e=>setAbsenceDeduction(e.target.value)} style={input}/></label>}<PremiumPicker label="Leave Treatment" value={leaveTreatment} options={leaveOptions} onChange={value=>setLeaveTreatment(value as 'paid'|'unpaid')}/><label style={label}>Custom Salary Rule / Note<textarea rows={3} value={note} onChange={e=>setNote(e.target.value)} style={{...input,resize:'vertical'}} placeholder="Optional note for your own salary record"/></label></div>}</section>
    <section style={{...card,display:'grid',gap:13}}><button type="button" onClick={()=>setShowBonus(v=>!v)} style={{border:0,background:'transparent',padding:0,textAlign:'left',cursor:'pointer'}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}><SectionHeader eyebrow="05 · Optional" title="Bonus Settings" subtitle="Configure expected bonus frequency and amount when needed."/><span style={{width:30,height:30,borderRadius:'50%',display:'grid',placeItems:'center',background:'#f1f5f9',color:'#475569',fontWeight:900}}>{showBonus?'−':'+'}</span></div></button>{showBonus&&<div style={{display:'grid',gap:10}}><PremiumPicker label="Bonus Frequency" value={bonusFrequency} options={bonusFreqOptions} onChange={value=>{const next=value as BonusFrequency;setBonusFrequency(next);if(next!=='custom')setBonusExpectedMonths(String(({yearly:1,'6_months':2,'3_months':4} as Record<Exclude<BonusFrequency,'custom'>,number>)[next]))}}/><PremiumPicker label="Bonus Amount" value={bonusAmountType} options={bonusAmountOptions} onChange={value=>setBonusAmountType(value as BonusAmountType)}/><label style={label}>Expected Bonus Months<input type="number" min="1" step="1" value={expectedMonths||''} onChange={e=>setBonusExpectedMonths(e.target.value)} disabled={bonusFrequency!=='custom'} style={{...input,opacity:bonusFrequency==='custom'?1:.7}}/><span style={hint}>Yearly = 1, every 6 months = 2, every 3 months = 4. Custom lets you choose the count.</span></label>{bonusAmountType==='fixed_amount'&&<label style={label}>Fixed Bonus Amount<input type="number" min="0.01" step="0.01" value={bonusFixedAmount} onChange={e=>setBonusFixedAmount(e.target.value)} style={input}/></label>}</div>}</section>
    {message&&<div role="alert" style={{padding:13,borderRadius:12,background:'#fef2f2',color:'#991b1b',fontWeight:750,lineHeight:1.45}}>{message}</div>}<button type="submit" disabled={saving} style={{...primary,width:'100%',opacity:saving?.72:1}}>{saving?'Saving your salary setup…':'Save Salary Setup'}</button><p style={{...hint,textAlign:'center',margin:0}}>Your salary policy and allowance rules are stored as personal Salary Person records. Allowance conditions remain independent so one allowance can be lost without changing another.</p></form></main>;
}
