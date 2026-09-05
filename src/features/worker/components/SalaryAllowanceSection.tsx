import { useEffect, useState } from 'react';
import { listSalaryAllowances, replaceSalaryAllowances, type SalaryAllowance, type SalaryAllowanceFrequency, type SalaryAllowanceInput, type SalaryAllowanceRule } from '../api/salaryAllowances';

const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '9px 12px', borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', font: 'inherit', outline: 'none' };
const label: React.CSSProperties = { display: 'grid', gap: 7, color: '#334155', fontWeight: 700, fontSize: 14 };
const hint: React.CSSProperties = { color: '#64748b', fontSize: 12, lineHeight: 1.45, fontWeight: 500 };

const allowanceTypes = ['Attendance', 'Medical', 'Service', 'Married Person', 'Housing', 'Transport', 'Other'];

type Draft = SalaryAllowanceInput & { localId: string };

function emptyDraft(effectiveFrom: string): Draft {
  return { localId: crypto.randomUUID(), allowance_type: 'Attendance', amount: 0, frequency: 'monthly', eligibility_rule: 'always', loss_after_count: null, rule_note: null, effective_from: effectiveFrom };
}

export function SalaryAllowanceSection({ profileId, effectiveFrom }: { profileId: string; effectiveFrom: string }) {
  const [open, setOpen] = useState(true);
  const [rows, setRows] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

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

  return <section style={{ padding: 20, border: '1px solid rgba(99,102,241,.14)', borderRadius: 20, background: 'rgba(255,255,255,.96)', boxShadow: '0 12px 34px rgba(15,23,42,.07)', display: 'grid', gap: 14 }}>
    <button type="button" onClick={() => setOpen(value => !value)} style={{ border: 0, background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><div><h2 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Dynamic Allowances</h2><p style={{ margin: '5px 0 0', color: '#64748b', fontSize: 13, lineHeight: 1.45 }}>Record each allowance separately so salary history can explain exactly why it was paid or lost.</p></div><span style={{ color: '#4f46e5', fontWeight: 900 }}>{open ? '−' : '+'}</span></div>
    </button>
    {open && <>
      <div style={{ padding: 14, borderRadius: 14, background: '#f8fafc', color: '#475569', fontSize: 13, lineHeight: 1.55 }}><strong style={{ color: '#0f172a' }}>Better salary records</strong><br/>For every allowance, answer four questions: <strong>what is it, how much is it, how often is it paid, and when can it be lost?</strong> This keeps Attendance, Medical, Service, Married Person and other allowances independent.</div>
      {loading ? <div style={hint}>Loading your saved allowances…</div> : rows.map((row, index) => {
        const threshold = row.eligibility_rule === 'after_absences' || row.eligibility_rule === 'after_unpaid_leaves';
        return <div key={row.localId} style={{ padding: 16, borderRadius: 16, border: '1px solid #e2e8f0', background: '#fff', display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}><strong style={{ color: '#0f172a' }}>Allowance {index + 1}</strong><button type="button" onClick={() => setRows(current => current.filter(item => item.localId !== row.localId))} style={{ border: 0, background: '#fef2f2', color: '#b91c1c', borderRadius: 9, minHeight: 34, padding: '0 10px', fontWeight: 800, cursor: 'pointer' }}>Remove</button></div>
          <label style={label}>Q1 · What is this allowance?<select value={row.allowance_type} onChange={e => update(row.localId, { allowance_type: e.target.value })} style={input}>{allowanceTypes.map(type => <option key={type}>{type}</option>)}</select></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><label style={label}>Q2 · How much?<input type="number" min="0" step="0.01" value={row.amount || ''} onChange={e => update(row.localId, { amount: Number(e.target.value) })} style={input} placeholder="e.g. 3000"/></label><label style={label}>Q3 · How often?<select value={row.frequency} onChange={e => update(row.localId, { frequency: e.target.value as SalaryAllowanceFrequency })} style={input}><option value="monthly">Monthly</option><option value="other">Other / one-off</option></select></label></div>
          <label style={label}>Q4 · When should this allowance be paid or lost?<select value={row.eligibility_rule} onChange={e => update(row.localId, { eligibility_rule: e.target.value as SalaryAllowanceRule, loss_after_count: null })} style={input}><option value="always">Pay normally — no attendance loss</option><option value="present_only">Pay only when attendance is Present</option><option value="after_absences">Lose after X absences</option><option value="after_unpaid_leaves">Lose after X unpaid leaves</option><option value="custom">Custom condition</option></select></label>
          {row.eligibility_rule === 'present_only' && <div style={{ ...hint, padding: 11, borderRadius: 11, background: '#ecfdf5' }}>Answer recorded: <strong>Present = allowance paid; Absent = allowance becomes 0.</strong></div>}
          {threshold && <label style={label}>After how many {row.eligibility_rule === 'after_absences' ? 'absences' : 'unpaid leaves'} should it be lost?<input type="number" min="1" step="1" value={row.loss_after_count ?? ''} onChange={e => update(row.localId, { loss_after_count: e.target.value ? Number(e.target.value) : null })} style={input} placeholder="e.g. 3"/></label>}
          {row.eligibility_rule === 'custom' && <label style={label}>What is the custom condition?<textarea rows={3} value={row.rule_note ?? ''} onChange={e => update(row.localId, { rule_note: e.target.value })} style={{ ...input, resize: 'vertical' }} placeholder="Example: Pay only after completing 26 working days."/></label>}
          {row.eligibility_rule !== 'custom' && <label style={label}>Optional note / evidence<textarea rows={2} value={row.rule_note ?? ''} onChange={e => update(row.localId, { rule_note: e.target.value })} style={{ ...input, resize: 'vertical' }} placeholder="Optional explanation for your salary record"/></label>}
        </div>;
      })}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><button type="button" onClick={() => setRows(current => [...current, emptyDraft(effectiveFrom)])} style={{ minHeight: 44, borderRadius: 12, border: '1px dashed #94a3b8', background: '#f8fafc', color: '#334155', fontWeight: 900, cursor: 'pointer' }}>＋ Add Allowance</button><button type="button" disabled={saving} onClick={save} style={{ minHeight: 44, borderRadius: 12, border: 0, background: '#0f172a', color: '#fff', fontWeight: 900, cursor: 'pointer', opacity: saving ? .7 : 1 }}>{saving ? 'Saving…' : 'Save Allowances'}</button></div>
      {message && <div role="status" style={{ padding: 12, borderRadius: 11, background: message.includes('saved') || message.includes('configured') ? '#ecfdf5' : '#fef2f2', color: message.includes('saved') || message.includes('configured') ? '#047857' : '#991b1b', fontWeight: 700 }}>{message}</div>}
    </>}
  </section>;
}
