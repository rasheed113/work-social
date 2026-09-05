import { useEffect, useRef, useState } from 'react';
import { listSalaryAllowances, replaceSalaryAllowances, type SalaryAllowance, type SalaryAllowanceFrequency, type SalaryAllowanceInput, type SalaryAllowanceRule } from '../api/salaryAllowances';

const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', minHeight: 41, padding: '8px 10px', borderRadius: 10, border: '1px solid #d7dee8', background: '#fff', font: 'inherit', outline: 'none', color: '#172033', boxShadow: 'inset 0 1px 2px rgba(15,23,42,.025)' };
const label: React.CSSProperties = { display: 'grid', gap: 6, color: '#334155', fontWeight: 800, fontSize: 12 };
const hint: React.CSSProperties = { color: '#64748b', fontSize: 11.5, lineHeight: 1.45, fontWeight: 550 };

const allowanceTypes = ['Attendance', 'Medical', 'Service', 'Married Person', 'Housing', 'Transport', 'Other'];

type Draft = SalaryAllowanceInput & { localId: string };

function emptyDraft(effectiveFrom: string): Draft {
  return { localId: crypto.randomUUID(), allowance_type: 'Attendance', amount: 0, frequency: 'monthly', eligibility_rule: 'always', loss_after_count: null, rule_note: null, effective_from: effectiveFrom };
}

export function SalaryAllowanceSection({ profileId, effectiveFrom, focused = false }: { profileId: string; effectiveFrom: string; focused?: boolean }) {
  const [open, setOpen] = useState(true);
  const [rows, setRows] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const sectionRef = useRef<HTMLElement>(null);
  const [highlighted, setHighlighted] = useState(focused);

  useEffect(() => {
    let active = true;
    listSalaryAllowances(profileId).then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage(error.message);
      setRows((data ?? []).map((row: SalaryAllowance) => ({
        localId: row.id,
        allowance_type: row.allowance_type,
        amount: Number(row.amount) || 0,
        frequency: row.frequency,
        eligibility_rule: row.eligibility_rule,
        loss_after_count: row.loss_after_count,
        rule_note: row.rule_note,
        effective_from: row.effective_from,
      })));
      setLoading(false);
    });
    return () => { active = false; };
  }, [profileId]);

  useEffect(() => {
    if (!focused || loading) return;
    const scrollTimer = window.setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlighted(true);
      window.setTimeout(() => setHighlighted(false), 3600);
    }, 180);
    return () => window.clearTimeout(scrollTimer);
  }, [focused, loading]);

  const update = (localId: string, patch: Partial<Draft>) => setRows(current => current.map(row => row.localId === localId ? { ...row, ...patch } : row));

  const save = async () => {
    setMessage('');
    const valid = rows.every(row => row.amount >= 0 && Number.isFinite(row.amount) && row.allowance_type.trim() && (row.eligibility_rule === 'after_absences' || row.eligibility_rule === 'after_unpaid_leaves' ? !!row.loss_after_count && row.loss_after_count > 0 : true));
    if (!valid) return setMessage('Complete each allowance amount and its loss condition before saving.');
    setSaving(true);
    const result = await replaceSalaryAllowances(profileId, rows.map(({ localId, ...row }) => ({ ...row, rule_note: row.rule_note?.trim() || null, effective_from: effectiveFrom })));
    setSaving(false);
    setMessage(result.error ? result.error.message : rows.length ? 'Allowance rules saved.' : 'No allowances are configured.');
  };

  return <section ref={sectionRef} className="salary-allowance-section" style={{ padding: 16, border: highlighted ? '1px solid #f59e0b' : '1px solid rgba(148,163,184,.24)', borderRadius: 18, background: highlighted ? '#fffbeb' : 'linear-gradient(145deg,rgba(255,255,255,.98),rgba(248,250,252,.96))', boxShadow: highlighted ? '0 0 0 6px rgba(245,158,11,.15), 0 12px 30px rgba(245,158,11,.10)' : '0 10px 26px rgba(15,23,42,.055), inset 0 1px 0 rgba(255,255,255,.95)', display: 'grid', gap: 12, transition: 'box-shadow .25s ease, background .25s ease, border-color .25s ease' }}>
    <button type="button" onClick={() => setOpen(value => !value)} style={{ border: 0, background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><div><div style={{ display:'inline-flex', padding:'4px 8px', borderRadius:999, background:'#eef2ff', color:'#4338ca', fontSize:9, fontWeight:900, letterSpacing:'.08em', textTransform:'uppercase' }}>Salary extras</div><h2 style={{ margin: '6px 0 0', fontSize: 16, color: '#172033', letterSpacing:'-.02em' }}>Dynamic Allowances</h2><p style={{ margin: '4px 0 0', color: '#718096', fontSize: 11, lineHeight: 1.4 }}>Each allowance has its own amount, frequency and loss condition.</p></div><span style={{ flex:'0 0 auto', width:28, height:28, display:'grid', placeItems:'center', borderRadius:9, background:'#f1f5f9', color:'#475569', fontWeight:950 }}>{open ? '−' : '+'}</span></div>
    </button>
    {open && <>
      <div style={{ padding: 12, borderRadius: 13, background: 'linear-gradient(145deg,#f8fafc,#f1f5f9)', border:'1px solid #e2e8f0', color: '#475569', fontSize: 11.5, lineHeight: 1.5 }}><strong style={{ color: '#172033' }}>Better salary records</strong><br/>Answer four simple questions: <strong>what, how much, how often, and when can it be lost?</strong> Each allowance stays independent.</div>
      {loading ? <div style={hint}>Loading your saved allowances…</div> : rows.map((row, index) => {
        const threshold = row.eligibility_rule === 'after_absences' || row.eligibility_rule === 'after_unpaid_leaves';
        return <div key={row.localId} className="salary-allowance-row" style={{ padding: 13, borderRadius: 15, border: '1px solid #e1e7ef', background: 'rgba(255,255,255,.94)', display: 'grid', gap: 10, boxShadow:'0 5px 15px rgba(15,23,42,.035)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}><div style={{ display:'flex', alignItems:'center', gap:7 }}><span style={{ width:25, height:25, display:'grid', placeItems:'center', borderRadius:8, background:'#eef2ff', color:'#4338ca', fontSize:10, fontWeight:950 }}>{index + 1}</span><strong style={{ color: '#172033', fontSize:13 }}>Allowance {index + 1}</strong></div><button type="button" onClick={() => setRows(current => current.filter(item => item.localId !== row.localId))} style={{ border: '1px solid #fecaca', background: '#fff7f7', color: '#b91c1c', borderRadius: 9, minHeight: 31, padding: '0 9px', fontSize:11, fontWeight: 850, cursor: 'pointer' }}>Remove</button></div>
          <label style={label}>Q1 · What is this allowance?<select value={row.allowance_type} onChange={e => update(row.localId, { allowance_type: e.target.value })} style={input}>{allowanceTypes.map(type => <option key={type}>{type}</option>)}</select></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}><label style={label}>Q2 · How much?<input type="number" min="0" step="0.01" value={row.amount || ''} onChange={e => update(row.localId, { amount: Number(e.target.value) })} style={input} placeholder="e.g. 3000"/></label><label style={label}>Q3 · How often?<select value={row.frequency} onChange={e => update(row.localId, { frequency: e.target.value as SalaryAllowanceFrequency })} style={input}><option value="monthly">Monthly</option><option value="other">Other / one-off</option></select></label></div>
          <label style={label}>Q4 · When should this allowance be paid or lost?<select value={row.eligibility_rule} onChange={e => update(row.localId, { eligibility_rule: e.target.value as SalaryAllowanceRule, loss_after_count: null })} style={input}><option value="always">Pay normally — no attendance loss</option><option value="present_only">Pay only when attendance is Present</option><option value="after_absences">Lose after X absences</option><option value="after_unpaid_leaves">Lose after X unpaid leaves</option><option value="custom">Custom condition</option></select></label>
          {row.eligibility_rule === 'present_only' && <div style={{ ...hint, padding: 10, borderRadius: 10, background: '#ecfdf5', border:'1px solid #bbf7d0', color:'#047857' }}>✓ <strong>Present = allowance paid; Absent = allowance becomes 0.</strong></div>}
          {threshold && <label style={label}>After how many {row.eligibility_rule === 'after_absences' ? 'absences' : 'unpaid leaves'} should it be lost?<input type="number" min="1" step="1" value={row.loss_after_count ?? ''} onChange={e => update(row.localId, { loss_after_count: e.target.value ? Number(e.target.value) : null })} style={input} placeholder="e.g. 3"/></label>}
          {row.eligibility_rule === 'custom' && <label style={label}>What is the custom condition?<textarea rows={3} value={row.rule_note ?? ''} onChange={e => update(row.localId, { rule_note: e.target.value })} style={{ ...input, resize: 'vertical' }} placeholder="Example: Pay only after completing 26 working days."/></label>}
          {row.eligibility_rule !== 'custom' && <label style={label}>Optional note / evidence<textarea rows={2} value={row.rule_note ?? ''} onChange={e => update(row.localId, { rule_note: e.target.value })} style={{ ...input, resize: 'vertical' }} placeholder="Optional explanation for your salary record"/></label>}
        </div>;
      })}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}><button type="button" onClick={() => setRows(current => [...current, emptyDraft(effectiveFrom)])} style={{ minHeight: 42, borderRadius: 11, border: '1px dashed #a8b3c2', background: 'linear-gradient(180deg,#fff,#f8fafc)', color: '#334155', fontSize:12, fontWeight: 900, cursor: 'pointer' }}>＋ Add Allowance</button><button type="button" disabled={saving} onClick={save} style={{ minHeight: 42, borderRadius: 11, border: 0, background: 'linear-gradient(145deg,#1e293b,#0f172a)', color: '#fff', fontSize:12, fontWeight: 900, cursor: 'pointer', opacity: saving ? .7 : 1, boxShadow:'0 3px 0 rgba(2,6,23,.18)' }}>{saving ? 'Saving…' : 'Save Allowances'}</button></div>
      {message && <div role="status" style={{ padding: 11, borderRadius: 10, background: message.includes('saved') || message.includes('configured') ? '#ecfdf5' : '#fef2f2', border:`1px solid ${message.includes('saved') || message.includes('configured') ? '#bbf7d0' : '#fecaca'}`, color: message.includes('saved') || message.includes('configured') ? '#047857' : '#991b1b', fontSize:11.5, fontWeight: 750 }}>{message}</div>}
    </>}
  </section>;
}
