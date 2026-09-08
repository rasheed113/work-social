import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../../../app/Router';
import { supabase } from '../../../lib/supabase/client';
import { ContractorNewEntryModal, type ContractorEntryInput } from './ContractorNewEntryModal';
import { ContractorEntryEditModal } from './ContractorEntryEditModal';
import { formatContractorMoney } from '../logic/contractorEntryCalculations';

interface Props { profileId: string; displayName: string | null; }
type Entry = { id: string; item_name: string; size: string; pieces: number; rate_per_piece: number; commission_type: 'percentage' | 'per_piece' | null; commission_value: number | null; commission_mode: 'included' | 'separate' | null; commission_per_piece: number; actual_rate_per_piece: number; total: number; occurred_at: string; special_note?: string | null };
type Totals = { daily_total: number; weekly_total: number; monthly_total: number; lifetime_total: number; commission_total: number };
type PeriodCard = 'daily' | 'weekly' | 'monthly' | 'grand';
type Period = { start: string | null; end: string | null; label: string; total: number; commission: number };

const zero: Totals = { daily_total: 0, weekly_total: 0, monthly_total: 0, lifetime_total: 0, commission_total: 0 };
const select = 'id,item_name,size,pieces,rate_per_piece,commission_type,commission_value,commission_mode,commission_per_piece,actual_rate_per_piece,total,occurred_at,special_note';
const dayKey = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};
const dateFromKey = (key: string) => new Date(`${key}T00:00:00+05:00`);
const shiftDayKey = (key: string, days: number) => dayKey(new Date(dateFromKey(key).getTime() + days * 86400000));
const weekStartKey = (key: string) => shiftDayKey(key, -((dateFromKey(key).getUTCDay() + 6) % 7));
const monthStartKey = (key: string) => `${key.slice(0, 7)}-01`;
const periodFor = (type: PeriodCard, cursor: string): Period => {
  if (type === 'grand') return { start: null, end: null, label: 'All recorded work', total: 0, commission: 0 };
  if (type === 'daily') {
    const end = shiftDayKey(cursor, 1);
    return { start: `${cursor}T00:00:00+05:00`, end: `${end}T00:00:00+05:00`, label: new Intl.DateTimeFormat('en-PK', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'short', year: 'numeric' }).format(dateFromKey(cursor)), total: 0, commission: 0 };
  }
  if (type === 'weekly') {
    const start = weekStartKey(cursor);
    const end = shiftDayKey(start, 7);
    return { start: `${start}T00:00:00+05:00`, end: `${end}T00:00:00+05:00`, label: `${new Intl.DateTimeFormat('en-PK', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'short' }).format(dateFromKey(start))} – ${new Intl.DateTimeFormat('en-PK', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'short', year: 'numeric' }).format(dateFromKey(shiftDayKey(end, -1)))}`, total: 0, commission: 0 };
  }
  const start = monthStartKey(cursor);
  const nextMonth = dayKey(new Date(dateFromKey(start).getTime() + 32 * 86400000)).slice(0, 7);
  return { start: `${start}T00:00:00+05:00`, end: `${nextMonth}-01T00:00:00+05:00`, label: new Intl.DateTimeFormat('en-PK', { timeZone: 'Asia/Karachi', month: 'long', year: 'numeric' }).format(dateFromKey(start)), total: 0, commission: 0 };
};

export function ContractorPersonalDashboard({ profileId, displayName }: Props) {
  const todayKey = dayKey(new Date());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [totals, setTotals] = useState<Totals>(zero);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState<{ type: PeriodCard; period: Period; entries: Entry[] } | null>(null);
  const [viewEntry, setViewEntry] = useState<Entry | null>(null);
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<Entry | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(5);
  const [periodCursors, setPeriodCursors] = useState<Record<PeriodCard, string>>({ daily: todayKey, weekly: todayKey, monthly: todayKey, grand: todayKey });

  const bounds = () => {
    const key = dayKey(new Date());
    const day = dateFromKey(key);
    const week = dateFromKey(weekStartKey(key));
    const month = dateFromKey(monthStartKey(key));
    const nextMonth = dayKey(new Date(month.getTime() + 32 * 86400000)).slice(0, 7);
    return {
      p_day_start: day.toISOString(),
      p_day_end: new Date(day.getTime() + 86400000).toISOString(),
      p_week_start: week.toISOString(),
      p_week_end: new Date(week.getTime() + 7 * 86400000).toISOString(),
      p_month_start: month.toISOString(),
      p_month_end: dateFromKey(`${nextMonth}-01`).toISOString(),
    };
  };

  const load = async () => {
    setLoading(true); setError('');
    const [entryResult, totalResult] = await Promise.all([
      supabase.from('contractor_work_entries').select(select).eq('profile_id', profileId).order('occurred_at', { ascending: false }).order('id', { ascending: false }).limit(60),
      supabase.rpc('get_contractor_work_totals', bounds()),
    ]);
    if (entryResult.error) { setError(entryResult.error.message); setLoading(false); return; }
    if (totalResult.error) { setError(totalResult.error.message); setLoading(false); return; }
    setEntries((entryResult.data ?? []) as Entry[]);
    const row = Array.isArray(totalResult.data) ? totalResult.data[0] : totalResult.data;
    setTotals({ ...zero, ...(row ?? {}) });
    setLoading(false);
  };

  useEffect(() => { void load(); }, [profileId]);

  const openDetail = async (type: PeriodCard, cursor: string) => {
    setDetailLoading(true); setError(''); setVisibleCount(5); setMenuId(null);
    const period = periodFor(type, cursor);
    let query = supabase.from('contractor_work_entries').select(select).eq('profile_id', profileId).order('occurred_at', { ascending: false }).order('id', { ascending: false }).limit(1000);
    if (period.start && period.end) query = query.gte('occurred_at', new Date(period.start).toISOString()).lt('occurred_at', new Date(period.end).toISOString());
    const result = await query;
    if (result.error) { setError(result.error.message); setDetailLoading(false); return; }
    const rows = (result.data ?? []) as Entry[];
    const total = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
    const commission = rows.reduce((sum, row) => sum + Number(row.commission_per_piece || 0) * Number(row.pieces || 0), 0);
    setDetail({ type, period: { ...period, total: type === 'grand' ? Number(totals.lifetime_total) : total, commission }, entries: rows });
    setDetailLoading(false);
  };

  const moveDetail = (direction: -1 | 1) => {
    if (!detail || detail.type === 'grand') return;
    const current = periodCursors[detail.type];
    let next = current;
    if (detail.type === 'daily') next = shiftDayKey(current, direction);
    if (detail.type === 'weekly') next = shiftDayKey(weekStartKey(current), direction * 7);
    if (detail.type === 'monthly') {
      const base = dateFromKey(monthStartKey(current));
      const target = new Date(base.getTime() + direction * 32 * 86400000);
      next = `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-01`;
    }
    if (direction === 1 && next > todayKey) return;
    setPeriodCursors((prev) => ({ ...prev, [detail.type]: next }));
    void openDetail(detail.type, next);
  };

  const saveEntry = async (input: ContractorEntryInput) => {
    setSaving(true); setError('');
    const result = await supabase.from('contractor_work_entries').insert({ profile_id: profileId, ...input });
    setSaving(false);
    if (result.error) { setError(result.error.message); return { error: result.error }; }
    setNewOpen(false); await load();
    if (detail) await openDetail(detail.type, periodCursors[detail.type]);
    return { error: null };
  };

  const saveEditedEntry = async (id: string, input: Partial<Entry>) => {
    setSaving(true); setError('');
    const result = await supabase.from('contractor_work_entries').update(input).eq('id', id).eq('profile_id', profileId);
    setSaving(false);
    if (result.error) { setError(result.error.message); return { error: result.error }; }
    setEditEntry(null); await load();
    if (detail) await openDetail(detail.type, periodCursors[detail.type]);
    return { error: null };
  };

  const confirmDelete = async () => {
    if (!deleteEntry) return;
    setSaving(true); setError('');
    const result = await supabase.from('contractor_work_entries').delete().eq('id', deleteEntry.id).eq('profile_id', profileId);
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    setDeleteEntry(null); await load();
    if (detail) await openDetail(detail.type, periodCursors[detail.type]);
  };

  const cards = useMemo(() => [
    { type: 'daily' as const, label: 'Today', value: totals.daily_total, icon: '◷' },
    { type: 'weekly' as const, label: 'Weekly', value: totals.weekly_total, icon: '↗' },
    { type: 'monthly' as const, label: 'Monthly', value: totals.monthly_total, icon: '▣' },
    { type: 'grand' as const, label: 'Grand Total', value: totals.lifetime_total, icon: '◆' },
  ], [totals]);

  const EntryRow = ({ entry }: { entry: Entry }) => (
    <article className="cd-entry">
      <div className="cd-entry-top">
        <div style={{ minWidth: 0 }}>
          <div className="cd-entry-name">{entry.item_name}</div>
          <div className="cd-entry-meta">
            {new Intl.DateTimeFormat('en-PK', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(entry.occurred_at))}
            {' · '}Size {entry.size}{' · '}{formatContractorMoney(entry.pieces)} pieces{' · '}PKR {formatContractorMoney(entry.actual_rate_per_piece)}/piece actual
          </div>
        </div>
        <div className="cd-row-actions">
          <div className="cd-entry-total">PKR {formatContractorMoney(entry.total)}</div>
          <button className="cd-more" type="button" aria-label="Entry actions" onClick={() => setMenuId(menuId === entry.id ? null : entry.id)}>•••</button>
          {menuId === entry.id && (
            <div className="cd-menu">
              <button type="button" onClick={() => { setViewEntry(entry); setMenuId(null); }}>View Details</button>
              <button type="button" onClick={() => { setEditEntry(entry); setMenuId(null); }}>Edit</button>
              <button type="button" className="danger" onClick={() => { setDeleteEntry(entry); setMenuId(null); }}>Delete</button>
            </div>
          )}
        </div>
      </div>
      <span className="cd-badge">
        {entry.commission_type && entry.commission_mode ? (entry.commission_type === 'percentage' ? `${entry.commission_value}%` : `PKR ${entry.commission_value}/piece`) + ` · ${entry.commission_mode === 'included' ? 'Included' : 'Extra'}` : 'Commission not provided'}
      </span>
    </article>
  );

  const detailOverlay = (entry: Entry) => (
    <div className="cd-detail-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setViewEntry(null); }}>
      <section className="cd-detail cd-entry-full" role="dialog" aria-modal="true">
        <div className="cd-detail-head">
          <div><div className="cd-kicker">Full Work Record</div><h2 className="cd-detail-title">{entry.item_name}</h2><div className="cd-detail-label">Real contractor entry</div></div>
          <button className="cd-close" type="button" onClick={() => setViewEntry(null)}>×</button>
        </div>
        <div className="cd-rich-total"><span>Actual total</span><strong>PKR {formatContractorMoney(entry.total)}</strong></div>
        <div className="cd-info-grid">
          <div><small>Date & Time</small><strong>{new Intl.DateTimeFormat('en-PK', { timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.occurred_at))}</strong></div>
          <div><small>Size</small><strong>{entry.size}</strong></div>
          <div><small>Pieces</small><strong>{formatContractorMoney(entry.pieces)}</strong></div>
          <div><small>Entered Rate / Piece</small><strong>PKR {formatContractorMoney(entry.rate_per_piece)}</strong></div>
          <div><small>Actual Rate / Piece</small><strong>PKR {formatContractorMoney(entry.actual_rate_per_piece)}</strong></div>
          <div><small>Commission / Piece</small><strong>PKR {formatContractorMoney(entry.commission_per_piece)}</strong></div>
          <div><small>Commission</small><strong>{entry.commission_type ? (entry.commission_type === 'percentage' ? `${entry.commission_value}%` : `PKR ${entry.commission_value} / piece`) : 'Not provided'}</strong></div>
          <div><small>Commission Mode</small><strong>{entry.commission_mode === 'included' ? 'Included / Minus' : entry.commission_mode === 'separate' ? 'Extra / Add' : 'Not provided'}</strong></div>
        </div>
        {entry.special_note && <div className="cd-note"><small>Special Note</small><p>{entry.special_note}</p></div>}
      </section>
    </div>
  );

  return (
    <main className="contractor-dashboard">
      <style>{`
        .contractor-dashboard{width:100%;max-width:1080px;margin:0 auto;padding:clamp(14px,3vw,26px) clamp(9px,2.5vw,20px) 104px;box-sizing:border-box;color:#172033}.cd-hero,.cd-section,.cd-commission,.cd-card,.cd-entry,.cd-detail,.cex-modal{box-shadow:inset 0 1px 0 #fff,0 12px 26px rgba(15,23,42,.08)}.cd-hero{position:relative;padding:16px;border-radius:20px;border:1px solid rgba(20,184,166,.16);background:linear-gradient(145deg,#fff,#f3fbfa 60%,#eef5ff);overflow:hidden}.cd-kicker{color:#0f766e;font-size:9px;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.cd-title{margin:4px 0;font-size:clamp(28px,7vw,42px);line-height:1;font-weight:950;letter-spacing:-.055em}.cd-sub{margin:7px 0;font-size:12px;color:#64748b}.cd-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:13px}.cd-btn{min-height:39px;padding:0 12px;border-radius:12px;border:1px solid rgba(71,85,105,.15);font:inherit;font-size:11px;font-weight:900;cursor:pointer;background:linear-gradient(145deg,#fff,#eef3f5);color:#334155}.cd-btn-primary{color:#fff;background:linear-gradient(145deg,#14b8a6,#0f766e 55%,#2563eb)}.cd-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:12px}.cd-card{width:100%;padding:12px;border-radius:17px;border:1px solid rgba(255,255,255,.82);background:linear-gradient(145deg,#fff,#f7fafb);text-align:left;cursor:pointer;font:inherit;color:inherit}.cd-card-head{display:flex;align-items:center;justify-content:space-between}.cd-icon{display:grid;place-items:center;width:29px;height:29px;border-radius:10px;background:linear-gradient(145deg,#fff,#e8f9f6);color:#0f766e;font-weight:950}.cd-label{font-size:9px;color:#64748b;font-weight:900;text-transform:uppercase}.cd-value{margin-top:5px;font-size:19px;font-weight:950}.cd-tap{margin-top:7px;font-size:8px;color:#0f766e;font-weight:900}.cd-section,.cd-commission{margin-top:12px;padding:13px;border-radius:18px;border:1px solid rgba(99,102,241,.13);background:linear-gradient(145deg,#fff,#f8fafc)}.cd-commission{border-color:rgba(22,163,74,.18);background:linear-gradient(145deg,#f0fdf4,#ecfdf5 54%,#eff6ff)}.cd-commission-row{display:flex;justify-content:space-between;align-items:center}.cd-commission-value{font-size:24px;font-weight:950;color:#15803d}.cd-entry{position:relative;padding:10px;border-radius:14px;border:1px solid rgba(148,163,184,.14);background:linear-gradient(145deg,#fff,#f5f8f9)}.cd-entry+.cd-entry{margin-top:7px}.cd-entry-top{display:flex;justify-content:space-between;gap:9px}.cd-entry-name{font-size:13px;font-weight:950}.cd-entry-meta{margin-top:3px;font-size:10px;color:#64748b}.cd-entry-total{font-size:14px;font-weight:950;white-space:nowrap}.cd-row-actions{position:relative;display:flex;gap:5px;align-items:flex-start}.cd-more{width:31px;height:28px;border:1px solid rgba(71,85,105,.12);border-radius:10px;background:linear-gradient(145deg,#fff,#e9f1f4);font-weight:950;letter-spacing:2px;color:#475569;cursor:pointer}.cd-menu{position:absolute;right:0;top:34px;z-index:30;min-width:160px;padding:6px;border-radius:15px;border:1px solid rgba(255,255,255,.9);background:linear-gradient(145deg,#fff,#edf5ff);box-shadow:0 18px 38px rgba(15,23,42,.2)}.cd-menu button{display:block;width:100%;padding:10px;border:0;border-radius:10px;background:transparent;text-align:left;font:inherit;font-size:11px;font-weight:900;color:#334155;cursor:pointer}.cd-menu button:hover{background:#eef7f7}.cd-menu .danger{color:#b91c1c}.cd-badge{display:inline-flex;margin-top:7px;padding:5px 8px;border-radius:999px;font-size:9px;font-weight:900;border:1px solid rgba(20,184,166,.15);background:#f0fdfa;color:#0f766e}.cd-empty{padding:24px;text-align:center;color:#64748b;font-size:11px}.cd-error{margin-top:11px;padding:10px;border-radius:12px;background:#fff7f7;color:#b91c1c;font-size:11px}.cd-detail-overlay,.cex-overlay{position:fixed!important;inset:0!important;z-index:1200!important;display:flex!important;align-items:flex-start!important;justify-content:center!important;overflow:auto!important;box-sizing:border-box!important;padding:16px 10px calc(78px + env(safe-area-inset-bottom))!important;background:rgba(15,23,42,.42);backdrop-filter:blur(8px)}.cd-detail,.cex-modal{width:min(100%,680px);max-height:calc(100dvh - 100px - env(safe-area-inset-bottom));overflow:auto;box-sizing:border-box;margin:0;border-radius:25px;border:1px solid rgba(255,255,255,.9);background:linear-gradient(145deg,#fff,#f7fbfb 58%,#eef4ff);padding:16px}.cd-detail-head{display:flex;justify-content:space-between;gap:10px}.cd-detail-title{margin:4px 0 0;font-size:23px;font-weight:950}.cd-detail-label{margin-top:4px;color:#64748b;font-size:10px}.cd-close{width:36px;height:36px;border-radius:12px;border:1px solid rgba(71,85,105,.13);background:linear-gradient(145deg,#fff,#edf2f5);font-size:18px;cursor:pointer}.cd-detail-nav{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:13px 0 10px;padding:8px;border-radius:15px;background:rgba(255,255,255,.75);border:1px solid rgba(148,163,184,.15)}.cd-nav-btn{min-height:34px;padding:0 11px;border-radius:10px;border:1px solid rgba(71,85,105,.14);background:#fff;font:inherit;font-size:10px;font-weight:900}.cd-detail-total{font-size:25px;font-weight:950}.cd-detail-commission{font-size:10px;color:#15803d;font-weight:900}.cd-more-btn{width:100%;margin-top:10px;min-height:40px;border:1px solid rgba(20,184,166,.2);border-radius:12px;background:linear-gradient(145deg,#fff,#e8f9f6);color:#0f766e;font:inherit;font-size:11px;font-weight:950}.cd-rich-total{margin-top:13px;padding:14px;border-radius:18px;background:linear-gradient(145deg,#effdfa,#eef5ff);border:1px solid rgba(20,184,166,.18)}.cd-rich-total span{display:block;color:#64748b;font-size:9px;font-weight:900;text-transform:uppercase}.cd-rich-total strong{display:block;margin-top:4px;font-size:27px;font-weight:950;color:#0f766e}.cd-info-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:11px}.cd-info-grid div{padding:11px;border-radius:14px;background:linear-gradient(145deg,#fff,#f1f6f8);border:1px solid rgba(148,163,184,.13);box-shadow:inset 0 1px 0 #fff}.cd-info-grid small,.cd-note small{display:block;color:#64748b;font-size:8px;font-weight:900;text-transform:uppercase}.cd-info-grid strong{display:block;margin-top:4px;font-size:12px;font-weight:950}.cd-note{margin-top:9px;padding:12px;border-radius:15px;background:#fff;border:1px solid rgba(99,102,241,.13)}.cd-note p{margin:5px 0 0;font-size:11px;color:#475569;line-height:1.5}@media(min-width:760px){.cd-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.cd-detail-overlay,.cex-overlay{padding-top:24px!important;padding-bottom:90px!important}.cd-detail,.cex-modal{max-height:calc(100dvh - 120px - env(safe-area-inset-bottom))}}@media(max-width:430px){.cd-info-grid{grid-template-columns:1fr}.cd-detail-overlay,.cex-overlay{padding-left:7px!important;padding-right:7px!important;padding-bottom:78px!important}}
      `}</style>

      <section className="cd-hero"><div className="cd-kicker">Contractor Personal Dashboard</div><h1 className="cd-title">Welcome{displayName ? `, ${displayName}` : ''}</h1><p className="cd-sub">Your personal work overview — compact, real, and commission-aware.</p><div className="cd-actions"><button className="cd-btn" type="button" onClick={() => navigate('/work/contractor?view=settings')}>Settings</button><button className="cd-btn cd-btn-primary" type="button" onClick={() => setNewOpen(true)}>＋ New Entry</button></div></section>
      {error && <div className="cd-error">{error}</div>}
      <section className="cd-grid">{cards.map((card) => <button className="cd-card" type="button" key={card.type} onClick={() => void openDetail(card.type, periodCursors[card.type])}><div className="cd-card-head"><span className="cd-icon">{card.icon}</span><span className="cd-label">{card.label}</span></div><div className="cd-value">PKR {formatContractorMoney(card.value)}</div><div className="cd-tap">Tap for details & history</div></button>)}</section>
      <section className="cd-commission"><div className="cd-commission-row"><div><div className="cd-label">Commission</div><div className="cd-commission-value">PKR {formatContractorMoney(totals.commission_total)}</div></div><span className="cd-badge">Recorded commission</span></div></section>
      <section className="cd-section"><div className="cd-entry-name">Team Work</div><div className="cd-entry-meta">Your contractor team workspace entry point. Team execution stays separate from personal work entries.</div><span className="cd-badge">Foundation</span></section>
      <section className="cd-section"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}><div><h2 style={{ margin: 0, fontSize: 15 }}>Recent Entries</h2><div style={{ marginTop: 3, fontSize: 10, color: '#64748b' }}>{loading ? 'Loading…' : `${entries.length} recent entries`}</div></div><button className="cd-btn" type="button" onClick={() => void load()} disabled={loading}>↻ Refresh</button></div>{!loading && !entries.length ? <div className="cd-empty">No entries yet.</div> : entries.map((entry) => <EntryRow key={entry.id} entry={entry} />)}</section>

      {detail && <div className="cd-detail-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setDetail(null); }}><section className="cd-detail" role="dialog" aria-modal="true"><div className="cd-detail-head"><div><h2 className="cd-detail-title">{detail.type === 'daily' ? 'Daily Work' : detail.type === 'weekly' ? 'Weekly Work' : detail.type === 'monthly' ? 'Monthly Work' : 'Grand Total History'}</h2><div className="cd-detail-label">{detail.period.label}</div></div><button className="cd-close" type="button" onClick={() => setDetail(null)}>×</button></div><div className="cd-detail-nav">{detail.type !== 'grand' ? <button className="cd-nav-btn" type="button" onClick={() => moveDetail(-1)}>← Previous</button> : <span /> }<div style={{ textAlign: 'center' }}><div className="cd-detail-total">PKR {formatContractorMoney(detail.period.total)}</div><div className="cd-detail-commission">Commission PKR {formatContractorMoney(detail.period.commission)}</div></div>{detail.type !== 'grand' ? <button className="cd-nav-btn" type="button" onClick={() => moveDetail(1)} disabled={detailLoading || periodCursors[detail.type] >= todayKey}>Next →</button> : <span />}</div>{detailLoading ? <div className="cd-empty">Loading real records…</div> : !detail.entries.length ? <div className="cd-empty">No work recorded for this period.</div> : <><div className="cd-detail-list">{detail.entries.slice(0, visibleCount).map((entry) => <EntryRow key={entry.id} entry={entry} />)}</div>{visibleCount < detail.entries.length && <button className="cd-more-btn" type="button" onClick={() => setVisibleCount((value) => Math.min(value + 10, detail.entries.length))}>View More · show next 10</button>}</>}</section></div>}
      {viewEntry && detailOverlay(viewEntry)}
      <ContractorEntryEditModal entry={editEntry} saving={saving} onClose={() => setEditEntry(null)} onSave={saveEditedEntry} />
      {deleteEntry && <div className="cd-detail-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setDeleteEntry(null); }}><section className="cd-detail" role="dialog" aria-modal="true"><div className="cd-kicker">Secure Record Action</div><h2 className="cd-detail-title">Delete this entry?</h2><p className="cd-sub">This permanently removes the selected work record from your Contractor account.</p><div className="cd-rich-total"><span>Entry</span><strong>{deleteEntry.item_name}</strong><div className="cd-entry-meta">{formatContractorMoney(deleteEntry.pieces)} pieces · PKR {formatContractorMoney(deleteEntry.total)}</div></div><div className="cd-actions"><button className="cd-btn" type="button" onClick={() => setDeleteEntry(null)} disabled={saving}>Cancel</button><button className="cd-btn" type="button" style={{ color: '#fff', background: 'linear-gradient(145deg,#ef4444,#b91c1c)' }} onClick={() => void confirmDelete()} disabled={saving}>{saving ? 'Deleting…' : 'Delete Entry'}</button></div></section></div>}
      {newOpen && <ContractorNewEntryModal saving={saving} onClose={() => setNewOpen(false)} onSave={saveEntry} />}
    </main>
  );
}
