import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../../../app/Router';
import { supabase } from '../../../lib/supabase/client';
import { formatWorkDecimal, getWorkerWorkPeriodBounds } from '../logic/workEntryCalculations';
import { normalizeWorkEntrySizes } from '../logic/workEntrySizes';

type Context = { team_id: number; team_number: number; team_name: string; team_purpose: string; leader_display_name: string | null; worker_profile_id: string };
type Entry = { id: string; item_name: string; size: string[] | null; quantity: string | number; rate: string | number; total: string | number; special_note: string | null; occurred_at: string };
type Totals = { daily_total: string; weekly_total: string; monthly_total: string; lifetime_total: string };
type Period = 'day' | 'week' | 'month' | 'lifetime';

const EMPTY: Totals = { daily_total: '0', weekly_total: '0', monthly_total: '0', lifetime_total: '0' };
const ENTRY_COLUMNS = 'id,item_name,size,quantity,rate,total,special_note,occurred_at';

function teamNumber() {
  const match = window.location.pathname.match(/^\/work\/team-work\/(\d+)(?:\/|$)/);
  return match ? Number(match[1]) : null;
}

function periodLabel(period: Period) {
  const bounds = getWorkerWorkPeriodBounds();
  const now = new Date();
  if (period === 'day') return now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (period === 'week') return `Week of ${new Date(bounds.weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  if (period === 'month') return now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return 'All persisted Team Work';
}

function boundsFor(period: Period) {
  const b = getWorkerWorkPeriodBounds();
  if (period === 'day') return { start: b.dayStart, end: b.dayEnd };
  if (period === 'week') return { start: b.weekStart, end: b.weekEnd };
  if (period === 'month') return { start: b.monthStart, end: b.monthEnd };
  return null;
}

export function WorkerTeamDashboardWorkPage() {
  const number = teamNumber();
  const [context, setContext] = useState<Context | null>(null);
  const [totals, setTotals] = useState<Totals>(EMPTY);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [period, setPeriod] = useState<Period>('lifetime');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'new' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [versions, setVersions] = useState<Array<{ id: string; revision_no: number; item_name: string; quantity: string | number; rate: string | number; total: string | number; recorded_at: string }>>([]);
  const [versionEntry, setVersionEntry] = useState<string | null>(null);

  const load = async () => {
    if (!number) { setError('Team workspace is unavailable.'); setLoading(false); return; }
    setLoading(true); setError('');
    const ctx = await supabase.rpc('get_worker_team_work_context', { p_team_number: number });
    if (ctx.error || !ctx.data?.[0]) { setError(ctx.error?.message ?? 'This Team Work workspace is unavailable for your Worker account.'); setLoading(false); return; }
    const next = ctx.data[0] as Context;
    setContext(next);
    const b = getWorkerWorkPeriodBounds();
    const totalsResult = await supabase.rpc('get_worker_team_work_totals', { p_team_number: number, p_day_start: b.dayStart, p_day_end: b.dayEnd, p_week_start: b.weekStart, p_week_end: b.weekEnd, p_month_start: b.monthStart, p_month_end: b.monthEnd });
    if (totalsResult.error) setError(totalsResult.error.message); else setTotals(((Array.isArray(totalsResult.data) ? totalsResult.data[0] : totalsResult.data) ?? EMPTY) as Totals);
    const rows = await supabase.from('worker_team_work_entries').select(ENTRY_COLUMNS).eq('team_id', next.team_id).eq('worker_profile_id', next.worker_profile_id).eq('lifecycle_state', 'active').order('occurred_at', { ascending: false }).order('id', { ascending: false }).limit(100).returns<Entry[]>();
    if (rows.error) setError(rows.error.message); else setEntries(rows.data ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [number]);

  const filtered = useMemo(() => {
    const b = boundsFor(period);
    return b ? entries.filter(entry => entry.occurred_at >= b.start && entry.occurred_at < b.end) : entries;
  }, [entries, period]);

  const saveEntry = async (form: HTMLFormElement, id?: string) => {
    if (!context) return;
    const data = new FormData(form);
    const item_name = String(data.get('item_name') ?? '').trim();
    const quantity = String(data.get('quantity') ?? '').trim();
    const rate = String(data.get('rate') ?? '').trim();
    const size = normalizeWorkEntrySizes(String(data.get('size') ?? '').split(',').map(v => v.trim()).filter(Boolean));
    const special_note = String(data.get('special_note') ?? '').trim() || null;
    if (!item_name || !/^\d+(?:\.\d{1,4})?$/.test(quantity) || Number(quantity) <= 0 || !/^\d+(?:\.\d{1,4})?$/.test(rate)) return;
    setSaving(true);
    const result = id
      ? await supabase.from('worker_team_work_entries').update({ item_name, size: size.length ? size : null, quantity, rate, special_note }).eq('id', id).eq('team_id', context.team_id).eq('worker_profile_id', context.worker_profile_id)
      : await supabase.from('worker_team_work_entries').insert({ team_id: context.team_id, worker_profile_id: context.worker_profile_id, item_name, size: size.length ? size : null, quantity, rate, special_note });
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    setModal(null); setEditing(null); await load();
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this Team Work entry? It will be retained as a deleted record.')) return;
    setDeleting(id);
    const result = await supabase.rpc('trash_worker_team_work_entry', { p_entry_id: id });
    setDeleting(null);
    if (result.error) setError(result.error.message); else await load();
  };

  const showVersions = async (id: string) => {
    const result = await supabase.from('worker_team_work_entry_versions').select('id,revision_no,item_name,quantity,rate,total,recorded_at').eq('work_entry_id', id).order('revision_no', { ascending: false });
    if (result.error) setError(result.error.message); else { setVersions(result.data ?? []); setVersionEntry(id); }
  };

  if (loading) return <main className="twd"><section className="twd-state"><strong>Opening Team Dashboard…</strong><p>Checking your approved membership and Team Work data.</p></section></main>;
  if (!context) return <main className="twd"><section className="twd-state twd-error"><strong>Team Dashboard unavailable</strong><p>{error || 'This Team Work workspace is unavailable.'}</p><button type="button" onClick={() => navigate('/work/team-work')}>← Back to My Teams</button></section></main>;

  const cards = [
    ['Today', totals.daily_total, 'day'],
    ['Weekly', totals.weekly_total, 'week'],
    ['Monthly', totals.monthly_total, 'month'],
    ['Grand Total', totals.lifetime_total, 'lifetime'],
  ] as const;

  return <main className="twd"><style>{`
    .twd{min-height:calc(100dvh - 82px);padding:14px 10px 112px;background:linear-gradient(180deg,#f8fafc,#f3f6fb);color:#172033}.twd-shell{width:min(980px,100%);margin:0 auto}.twd-top{display:flex;align-items:center;gap:9px;margin-bottom:12px}.twd-back{width:40px;height:40px;border:1px solid #fff;border-radius:13px;background:linear-gradient(145deg,#fff,#edf2ff);font-size:22px;font-weight:950;cursor:pointer}.twd-kicker{display:inline-flex;padding:5px 9px;border-radius:999px;background:#eef2ff;color:#4f46e5;font-size:8px;font-weight:950;letter-spacing:.13em}.twd-title{margin:6px 0 0;font-size:clamp(27px,7vw,42px);line-height:.98;letter-spacing:-.055em;font-weight:950}.twd-hero,.twd-history{padding:16px;border:1px solid #fff;border-radius:20px;background:linear-gradient(145deg,#fff,#f7f9fc);box-shadow:0 14px 28px #0f172a12,inset 0 1px 0 #fff;margin-bottom:12px}.twd-name{margin:0;font-size:18px;font-weight:950}.twd-meta{margin-top:4px;color:#4f46e5;font-size:8px;font-weight:950;letter-spacing:.08em}.twd-purpose{margin:9px 0 0;color:#64748b;font-size:10px}.twd-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.twd-button,.twd-mini{min-height:38px;padding:0 12px;border:1px solid #64748b24;border-radius:10px;background:#fff;color:#475569;font:inherit;font-size:10px;font-weight:900;cursor:pointer;box-shadow:0 6px 12px #0f172a0a}.twd-primary{background:linear-gradient(145deg,#6b63e4,#5148df);color:#fff;border-color:#4f46e555}.twd-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px}.twd-card{padding:15px;border:1px solid #fff;border-radius:17px;background:linear-gradient(145deg,#fff,#f5f8ff);box-shadow:0 12px 24px #0f172a10;cursor:pointer;text-align:left}.twd-card:last-child{grid-column:1/-1;background:linear-gradient(145deg,#eff6ff,#fff,#ecfdf5)}.twd-card-label{font-size:9px;font-weight:950;letter-spacing:.1em;text-transform:uppercase;color:#64748b}.twd-card-value{display:block;margin-top:8px;font-size:clamp(22px,5vw,34px);font-weight:950;letter-spacing:-.05em}.twd-card-period{display:block;margin-top:5px;font-size:9px;color:#94a3b8}.twd-history-head{display:flex;justify-content:space-between;gap:8px}.twd-history h2{margin:0;font-size:18px}.twd-copy{margin:5px 0;color:#64748b;font-size:10px}.twd-filters{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}.twd-filter{min-height:30px;padding:0 10px;border:1px solid #64748b24;border-radius:999px;background:#fff;color:#475569;font:inherit;font-size:9px;font-weight:900;cursor:pointer}.twd-filter.active{background:#eef2ff;color:#4338ca;border-color:#6366f155}.twd-entry-list{display:grid;gap:8px}.twd-entry{padding:12px;border:1px solid #64748b1c;border-radius:14px;background:#fff}.twd-entry-top{display:flex;justify-content:space-between;gap:8px}.twd-entry-name{font-size:12px;font-weight:950}.twd-entry-total{font-size:15px;font-weight:950}.twd-entry-meta,.twd-entry-note{margin-top:4px;color:#64748b;font-size:9px;line-height:1.4}.twd-entry-actions{display:flex;gap:6px;margin-top:9px;flex-wrap:wrap}.twd-mini.danger{color:#b91c1c;background:#fff7f7}.twd-empty,.twd-state{padding:18px;border-radius:16px;background:#fff;color:#64748b;font-size:10px;text-align:center}.twd-state{width:min(600px,100%);margin:40px auto;box-shadow:0 14px 28px #0f172a12}.twd-error{color:#b91c1c}.twd-modal-backdrop{position:fixed;inset:0;z-index:2300;display:grid;place-items:center;padding:12px;background:#0f172a7a;backdrop-filter:blur(8px)}.twd-modal{width:min(520px,100%);max-height:calc(100dvh - 24px);overflow:auto;padding:17px;border:1px solid #fff;border-radius:20px;background:#fff;box-shadow:0 30px 80px #0f172a4d}.twd-modal h3{margin:8px 0 0;font-size:19px}.twd-form{display:grid;gap:8px;margin-top:12px}.twd-form label{display:grid;gap:4px;color:#334155;font-size:9px;font-weight:900}.twd-form input,.twd-form textarea{width:100%;box-sizing:border-box;min-height:40px;padding:9px;border:1px solid #64748b2b;border-radius:10px;background:#fff;color:#172033;font:inherit;font-size:12px}.twd-form textarea{min-height:70px}.twd-two{display:grid;grid-template-columns:1fr 1fr;gap:8px}.twd-modal-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}@media(max-width:600px){.twd-cards{grid-template-columns:1fr 1fr}.twd-card:last-child{grid-column:1/-1}.twd-two{grid-template-columns:1fr}}
  `}</style><div className="twd-shell">
    <div className="twd-top"><button type="button" className="twd-back" onClick={() => navigate('/work/team-work')}>‹</button><div><div className="twd-kicker">TEAM DASHBOARD · {context.team_number}</div><h1 className="twd-title">{context.team_name} Dashboard</h1></div></div>
    <section className="twd-hero"><h2 className="twd-name">{context.team_name}</h2><div className="twd-meta">TEAM ID · {context.team_number} · APPROVED MEMBER</div><p className="twd-purpose">{context.team_purpose || 'Your persisted work inside this approved team workspace.'}</p><div className="twd-actions"><button type="button" className="twd-button twd-primary" onClick={() => setModal('new')}>+ Add New Entry</button><button type="button" className="twd-button" onClick={() => { setPeriod('lifetime'); document.getElementById('team-work-history')?.scrollIntoView({ behavior: 'smooth' }); }}>Work History</button><button type="button" className="twd-button" onClick={() => navigate(`/work/team-work/${context.team_number}/settings`)}>Team Settings</button></div></section>
    <section className="twd-cards" aria-label="Team Work totals">{cards.map(([label,value,p]) => <button type="button" key={label} className="twd-card" onClick={() => { setPeriod(p); document.getElementById('team-work-history')?.scrollIntoView({ behavior: 'smooth' }); }}><span className="twd-card-label">{label}</span><strong className="twd-card-value">{formatWorkDecimal(value)}</strong><span className="twd-card-period">{periodLabel(p)}</span></button>)}</section>
    <section id="team-work-history" className="twd-history"><div className="twd-history-head"><div><h2>Team Work History</h2><p className="twd-copy">Real persisted entries for this team. Edit creates a revision; Delete removes the entry from active totals.</p></div><strong>{filtered.length}</strong></div><div className="twd-filters">{(['day','week','month','lifetime'] as Period[]).map(p => <button type="button" key={p} className={`twd-filter ${period===p?'active':''}`} onClick={() => setPeriod(p)}>{p==='day'?'Today':p==='week'?'Weekly':p==='month'?'Monthly':'Grand Total'}</button>)}</div>{filtered.length===0?<div className="twd-empty">No active Team Work entries for {period==='lifetime'?'this team':periodLabel(period)} yet.</div>:<div className="twd-entry-list">{filtered.map(entry => <article className="twd-entry" key={entry.id}><div className="twd-entry-top"><div><div className="twd-entry-name">{entry.item_name}</div><div className="twd-entry-meta">{new Date(entry.occurred_at).toLocaleString()} · Qty {entry.quantity} · Rate {entry.rate}{entry.size?.length?` · ${entry.size.join(', ')}`:''}</div></div><strong className="twd-entry-total">{formatWorkDecimal(String(entry.total))}</strong></div>{entry.special_note&&<div className="twd-entry-note">{entry.special_note}</div>}<div className="twd-entry-actions"><button type="button" className="twd-mini" onClick={() => { setEditing(entry); setModal('edit'); }}>Edit</button><button type="button" className="twd-mini" onClick={() => void showVersions(entry.id)}>History</button><button type="button" className="twd-mini danger" disabled={deleting===entry.id} onClick={() => void remove(entry.id)}>{deleting===entry.id?'Deleting…':'Delete'}</button></div></article>)}</div>}</section>
  </div>
  {modal&&<div className="twd-modal-backdrop"><section className="twd-modal"><div className="twd-kicker">{modal==='new'?'NEW TEAM WORK ENTRY':'EDIT TEAM WORK ENTRY'}</div><h3>{modal==='new'?'Add New Entry':'Edit Entry'}</h3><form className="twd-form" onSubmit={e => { e.preventDefault(); void saveEntry(e.currentTarget, modal==='edit'?editing?.id:undefined); }}><label>Item Name<input name="item_name" defaultValue={editing?.item_name ?? ''} required autoFocus /></label><label>Sizes<input name="size" defaultValue={editing?.size?.join(', ') ?? ''} placeholder="S, M, L" /></label><div className="twd-two"><label>Quantity<input name="quantity" inputMode="decimal" defaultValue={editing?.quantity ?? ''} required /></label><label>Rate<input name="rate" inputMode="decimal" defaultValue={editing?.rate ?? ''} required /></label></div><label>Special Note<textarea name="special_note" defaultValue={editing?.special_note ?? ''} /></label><div className="twd-modal-actions"><button type="button" className="twd-button" disabled={saving} onClick={() => { setModal(null); setEditing(null); }}>Cancel</button><button type="submit" className="twd-button twd-primary" disabled={saving}>{saving?'Saving…':modal==='new'?'Save Entry':'Save Changes'}</button></div></form></section></div>}
  {versionEntry&&<div className="twd-modal-backdrop"><section className="twd-modal"><div className="twd-kicker">REVISION HISTORY</div><h3>Saved versions</h3>{versions.length===0?<p className="twd-copy">No revisions recorded.</p>:versions.map(v=><div key={v.id} className="twd-entry"><strong>Revision {v.revision_no} · {v.item_name}</strong><div className="twd-entry-meta">{new Date(v.recorded_at).toLocaleString()} · Qty {v.quantity} · Rate {v.rate} · Total {formatWorkDecimal(String(v.total))}</div></div>)}<div className="twd-modal-actions"><button type="button" className="twd-button" onClick={() => setVersionEntry(null)}>Close</button></div></section></div>}
  </main>;
}
