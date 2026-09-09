import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { getWorkerWorkDayBounds, getWorkerWorkMonthBounds, getWorkerWorkWeekBounds, getWorkerWorkWeekStart } from '../logic/workEntryCalculations';
import { formatWorkDecimal } from '../logic/workEntryCalculations';
import { formatWorkEntrySizes } from '../logic/workEntrySizes';
import type { WorkEntry } from '../types/workEntry';

interface WorkerWorkEntryListProps { entries: WorkEntry[]; emptyTitle?: string; emptyDescription?: string; onOpen: (entry: WorkEntry) => void; }
interface TeamWorkHistoryEntry { id: string; item_name: string; size: string[] | null; quantity: string | number; rate: string | number; total: string | number; special_note: string | null; occurred_at: string; team_number: number; team_name: string; }
function formatDate(value: string) { return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
function readHistoryPeriod() { const value = new URLSearchParams(window.location.search).get('period'); return value === 'day' || value === 'week' || value === 'month' ? value : 'lifetime'; }
function parseDateKey(raw: string | null) { if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null; const [year, month, day] = raw.split('-').map(Number); const date = new Date(year, month - 1, day); return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null; }
function getSelectedBounds(period: ReturnType<typeof readHistoryPeriod>) {
  const params = new URLSearchParams(window.location.search);
  const raw = period === 'day' ? params.get('day') : period === 'week' ? params.get('week') : period === 'month' ? params.get('month') : null;
  const parsed = parseDateKey(raw);
  const selected = parsed ?? (period === 'week' ? getWorkerWorkWeekStart() : period === 'month' ? new Date(new Date().getFullYear(), new Date().getMonth(), 1) : new Date());
  if (period === 'day') { const bounds = getWorkerWorkDayBounds(selected); return { start: bounds.dayStart, end: bounds.dayEnd }; }
  if (period === 'week') { const bounds = getWorkerWorkWeekBounds(selected); return { start: bounds.weekStart, end: bounds.weekEnd }; }
  if (period === 'month') { const bounds = getWorkerWorkMonthBounds(selected); return { start: bounds.monthStart, end: bounds.monthEnd }; }
  return null;
}

export function WorkerWorkEntryList({ entries, emptyTitle = 'No Work Entries yet', emptyDescription = 'Saved Work Entries will appear here.', onOpen }: WorkerWorkEntryListProps) {
  const [teamEntries, setTeamEntries] = useState<TeamWorkHistoryEntry[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const period = readHistoryPeriod();
    const bounds = getSelectedBounds(period);
    setTeamLoading(true);
    void (async () => {
      const userResult = await supabase.auth.getUser();
      const userId = userResult.data.user?.id;
      if (!userId) { if (active) { setTeamEntries([]); setTeamLoading(false); } return; }
      const workerResult = await supabase.from('worker_profiles').select('id').eq('profile_id', userId).maybeSingle<{ id: string }>();
      if (workerResult.error || !workerResult.data) { if (active) { setTeamEntries([]); setTeamLoading(false); } return; }
      let query = supabase
        .from('worker_team_work_entries')
        .select('id,item_name,size,quantity,rate,total,special_note,occurred_at,team_id,contractor_teams!inner(team_number,name)')
        .eq('worker_profile_id', workerResult.data.id)
        .eq('lifecycle_state', 'active')
        .order('occurred_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(100);
      if (bounds) query = query.gte('occurred_at', bounds.start).lt('occurred_at', bounds.end);
      const result = await query;
      if (!active) return;
      if (result.error) { setTeamEntries([]); setTeamLoading(false); return; }
      const normalized = (result.data ?? []).map((row) => {
        const team = Array.isArray(row.contractor_teams) ? row.contractor_teams[0] : row.contractor_teams;
        return { id: row.id, item_name: row.item_name, size: row.size, quantity: row.quantity, rate: row.rate, total: row.total, special_note: row.special_note, occurred_at: row.occurred_at, team_number: Number(team?.team_number ?? 0), team_name: team?.name ?? 'Team Work' } satisfies TeamWorkHistoryEntry;
      });
      setTeamEntries(normalized);
      setTeamLoading(false);
    })();
    return () => { active = false; };
  }, [entries]);

  const hasPersonal = entries.length > 0;
  const hasTeam = teamEntries.length > 0;
  if (!hasPersonal && !hasTeam && !teamLoading) return <section className="worker-entry-list__empty"><span className="worker-entry-list__empty-mark" aria-hidden="true">○</span><h2>{emptyTitle}</h2><p>{emptyDescription}</p></section>;
  return <section className="worker-entry-list" aria-label="Work History Entries">
    <style>{`
      .worker-entry-list{display:grid;gap:8px}.worker-entry-list__group-label{display:flex;align-items:center;gap:7px;margin:2px 2px 0;color:#475569;font-size:9px;font-weight:950;letter-spacing:.1em;text-transform:uppercase}.worker-entry-list__tag{display:inline-flex;align-items:center;padding:4px 7px;border:1px solid rgba(15,159,149,.2);border-radius:999px;background:linear-gradient(150deg,#fff,#ecfdf5);color:#0f766e;font-size:8px;font-weight:950;letter-spacing:.06em;box-shadow:0 1px 2px rgba(15,23,42,.06)}
      .worker-entry-list__card{position:relative;display:block;width:100%;min-width:0;padding:10px 11px;border:1px solid rgba(71,85,105,.16);border-radius:14px;background:linear-gradient(150deg,#fff 0%,#f8fafc 60%,#f0f4ff 100%);color:#172033;text-align:left;font:inherit;cursor:pointer;isolation:isolate;box-shadow:0 1px 0 #fff inset,0 -2px 0 rgba(71,85,105,.075) inset,0 2px 4px rgba(15,23,42,.09),0 8px 12px rgba(15,23,42,.055),0 17px 23px rgba(15,23,42,.025);transition:transform .14s ease,box-shadow .14s ease,border-color .14s ease}.worker-entry-list__card:before{content:'';position:absolute;z-index:-1;left:8%;right:8%;bottom:-7px;height:12px;border-radius:50%;background:rgba(15,23,42,.16);filter:blur(8px);opacity:.55}.worker-entry-list__card:after{content:'';position:absolute;top:0;left:12px;right:12px;height:1px;border-radius:99px;background:linear-gradient(90deg,transparent,rgba(255,255,255,1) 18%,rgba(99,102,241,.38) 56%,transparent);box-shadow:0 1px 4px rgba(255,255,255,.9);pointer-events:none}.worker-entry-list__card:hover{transform:translateY(-2px);border-color:rgba(79,70,229,.28);box-shadow:0 1px 0 #fff inset,0 -2px 0 rgba(79,70,229,.08) inset,0 4px 6px rgba(15,23,42,.1),0 12px 18px rgba(15,23,42,.07),0 20px 27px rgba(79,70,229,.035)}.worker-entry-list__card:active{transform:translateY(1px);box-shadow:0 1px 2px rgba(15,23,42,.12) inset,0 2px 4px rgba(15,23,42,.08)}.worker-entry-list__card:focus-visible{outline:2px solid rgba(79,70,229,.72);outline-offset:3px}
      .worker-entry-list__row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px}.worker-entry-list__main{min-width:0}.worker-entry-list__name{display:flex;align-items:center;gap:7px;min-width:0;font-size:13px;font-weight:900;letter-spacing:-.015em}.worker-entry-list__name:before{content:'◈';display:grid;place-items:center;flex:0 0 23px;width:23px;height:23px;border:1px solid rgba(99,102,241,.18);border-radius:7px;background:linear-gradient(150deg,#fff,#e8edff 70%,#e0f7f5);color:#5148c8;font-size:9px;box-shadow:0 2px 4px rgba(15,23,42,.09),1px 1px 0 #fff inset,-1px -1px 2px rgba(79,70,229,.08) inset}.worker-entry-list__name-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.worker-entry-list__meta{display:block;margin:4px 0 0;padding-left:30px;color:#64748b;font-size:10px;line-height:1.35;font-weight:650;overflow-wrap:anywhere}.worker-entry-list__amount{display:inline-flex;align-items:center;justify-content:center;min-width:54px;padding:7px 8px;border:1px solid rgba(37,99,235,.18);border-radius:9px;background:linear-gradient(150deg,#fff,#edf4ff 65%,#e6faf7);color:#0f172a;font-size:16px;line-height:1;font-weight:950;letter-spacing:-.045em;box-shadow:0 1px 0 #fff inset,0 -2px 0 rgba(37,99,235,.08) inset,0 3px 5px rgba(15,23,42,.09),0 6px 10px rgba(37,99,235,.045);text-shadow:0 1px 0 #fff}.worker-entry-list__team-card{cursor:default;background:linear-gradient(150deg,#ffffff 0%,#f8fffd 58%,#eefbf8 100%);border-color:rgba(15,159,149,.18)}.worker-entry-list__team-card:hover{transform:none;border-color:rgba(15,159,149,.25)}.worker-entry-list__team-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:4px 0 0;padding-left:30px;color:#64748b;font-size:9.5px;line-height:1.35;font-weight:700}.worker-entry-list__team-name{color:#0f766e}.worker-entry-list__team-loading{padding:7px 10px;color:#64748b;font-size:10px}
      .worker-entry-list__empty{position:relative;padding:14px;border:1px solid rgba(71,85,105,.14);border-radius:14px;background:linear-gradient(145deg,#fff,#f5f7fa);box-shadow:0 1px 0 #fff inset,0 -1px 0 rgba(71,85,105,.06) inset,0 5px 9px rgba(15,23,42,.07),0 11px 15px rgba(15,23,42,.035);text-align:center}.worker-entry-list__empty-mark{display:grid;place-items:center;width:28px;height:28px;margin:0 auto;border:1px solid rgba(99,102,241,.16);border-radius:8px;background:linear-gradient(145deg,#fff,#eaf0ff);color:#5b55d6;box-shadow:0 3px 5px rgba(15,23,42,.08),1px 1px 0 #fff inset}.worker-entry-list__empty h2{margin:7px 0 0;font-size:15px}.worker-entry-list__empty p{margin:4px 0 0;color:#64748b;font-size:11px;line-height:1.4}
      @media (max-width:430px){.worker-entry-list{gap:7px}.worker-entry-list__card{padding:9px 9px;border-radius:13px}.worker-entry-list__row{gap:7px}.worker-entry-list__name{font-size:12px}.worker-entry-list__name:before{flex-basis:21px;width:21px;height:21px}.worker-entry-list__meta{padding-left:28px;font-size:9.5px}.worker-entry-list__team-meta{padding-left:28px;font-size:9px}.worker-entry-list__amount{min-width:49px;padding:6px 7px;font-size:15px}}
      @media (max-width:340px){.worker-entry-list__meta,.worker-entry-list__team-meta{font-size:9px}.worker-entry-list__amount{min-width:46px;font-size:14px;padding:6px}}
      @media (prefers-reduced-motion:reduce){.worker-entry-list__card{transition:none}}
    `}</style>
    {hasPersonal && <div className="worker-entry-list__group-label"><span className="worker-entry-list__tag">PW · PERSONAL WORK</span><span>Without team</span></div>}
    {entries.map((entry) => <button className="worker-entry-list__card" key={`personal-${entry.id}`} type="button" onClick={() => onOpen(entry)}><div className="worker-entry-list__row"><div className="worker-entry-list__main"><strong className="worker-entry-list__name"><span className="worker-entry-list__name-text">{entry.item_name}</span></strong><span className="worker-entry-list__meta">{formatWorkEntrySizes(entry.size)} · {entry.quantity} pcs · {formatDate(entry.occurred_at)}</span></div><span className="worker-entry-list__amount">{formatWorkDecimal(entry.total)}</span></div></button>)}
    {(hasTeam || teamLoading) && <div className="worker-entry-list__group-label"><span className="worker-entry-list__tag">TW · TEAM WORK</span><span>From Team Workspace</span></div>}
    {teamLoading && !hasTeam && <div className="worker-entry-list__team-loading">Loading Team Work history…</div>}
    {teamEntries.map((entry) => <article className="worker-entry-list__card worker-entry-list__team-card" key={`team-${entry.id}`} aria-label={`Team Work: ${entry.item_name}`}><div className="worker-entry-list__row"><div className="worker-entry-list__main"><strong className="worker-entry-list__name"><span className="worker-entry-list__name-text">{entry.item_name}</span></strong><span className="worker-entry-list__team-meta"><span className="worker-entry-list__tag">TW</span><span className="worker-entry-list__team-name">{entry.team_name}</span><span>· TEAM {entry.team_number}</span><span>· {formatWorkEntrySizes(entry.size)}</span><span>· {entry.quantity} pcs</span><span>· {formatDate(entry.occurred_at)}</span></span></div><span className="worker-entry-list__amount">{formatWorkDecimal(String(entry.total))}</span></div></article>)}
  </section>;
}
