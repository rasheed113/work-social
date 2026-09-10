import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../../../app/Router';
import { supabase } from '../../../lib/supabase/client';

interface Props {
  profileId: string;
  teamId: string;
  teamNumber: string;
}

type DetailRow = {
  team_id: number;
  team_number: number;
  team_name: string;
  worker_count: number | string;
  taken_pieces: number | string;
  taken_amount: number | string;
  completed_pieces: number | string;
  completed_amount: number | string;
  worker_profile_id: string | null;
  work_id: string | null;
  worker_display_name: string | null;
  worker_username: string | null;
  worker_avatar_url: string | null;
  worker_completed_pieces: number | string;
  worker_completed_amount: number | string;
  worker_entry_count: number | string;
};

const numberValue = (value: number | string | null | undefined) => Math.max(0, Number(value) || 0);
const pieces = (value: number | string | null | undefined) => numberValue(value).toLocaleString('en-PK', { maximumFractionDigits: 0 });
const money = (value: number | string | null | undefined) => `PKR ${numberValue(value).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
const percent = (done: number, taken: number) => taken > 0 ? Math.min(100, Math.max(0, (done / taken) * 100)) : 0;

function initials(name: string) {
  const value = name.trim();
  return value ? value.split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() : 'W';
}

function status(done: number, taken: number) {
  const remaining = Math.max(taken - done, 0);
  if (taken > 0 && remaining === 0) return { label: 'COMPLETE', tone: 'complete' as const };
  if (taken > 0) return { label: 'IN PROGRESS', tone: 'progress' as const };
  return { label: 'NO WORK', tone: 'idle' as const };
}

export function ContractorTeamDetailPage({ profileId, teamId, teamNumber }: Props) {
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const id = Number(teamId);
    const number = Number(teamNumber);
    if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(number) || number < 100001) {
      setRows([]);
      setError('This team link is invalid.');
      setLoading(false);
      return;
    }
    const result = await supabase.rpc('get_contractor_team_detail', {
      p_team_id: id,
      p_team_number: number,
    });
    if (result.error) {
      console.error('get_contractor_team_detail failed', result.error);
      setRows([]);
      setError('We could not load this team workspace. Please try again.');
      setLoading(false);
      return;
    }
    setRows((result.data ?? []) as DetailRow[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [profileId, teamId, teamNumber]);

  const summary = useMemo(() => {
    const first = rows[0];
    const taken = numberValue(first?.taken_pieces);
    const completed = numberValue(first?.completed_pieces);
    return {
      teamId: first?.team_id ?? Number(teamId),
      teamNumber: first?.team_number ?? Number(teamNumber),
      teamName: first?.team_name ?? 'Team',
      workerCount: Math.max(0, Number(first?.worker_count) || 0),
      takenPieces: taken,
      takenAmount: numberValue(first?.taken_amount),
      completedPieces: completed,
      completedAmount: numberValue(first?.completed_amount),
      remainingPieces: Math.max(taken - completed, 0),
      completion: percent(completed, taken),
    };
  }, [rows, teamId, teamNumber]);

  const teamStatus = status(summary.completedPieces, summary.takenPieces);
  const workers = rows.filter(row => Boolean(row.worker_profile_id));

  return (
    <main className="ctd3-page">
      <style>{`
        .ctd3-page{min-height:100dvh;box-sizing:border-box;padding:14px 12px 34px;background:radial-gradient(circle at 8% 0,rgba(59,130,246,.15),transparent 31%),radial-gradient(circle at 94% 7%,rgba(139,92,246,.15),transparent 30%),linear-gradient(180deg,#f8fbff,#f4f7fc);color:#172033}
        .ctd3-shell{width:min(820px,100%);margin:0 auto}
        .ctd3-top{display:flex;align-items:center;gap:9px;margin-bottom:11px;padding:3px 2px}
        .ctd3-back{width:40px;height:40px;flex:0 0 auto;border:1px solid rgba(255,255,255,.94);border-radius:13px;background:linear-gradient(145deg,#fff,#eef2ff);box-shadow:0 8px 18px rgba(15,23,42,.09),inset 0 1px 0 #fff;color:#334155;font:inherit;font-size:21px;font-weight:950;cursor:pointer}
        .ctd3-back:focus-visible,.ctd3-btn:focus-visible,.ctd3-worker:focus-visible{outline:2px solid rgba(99,102,241,.72);outline-offset:3px}
        .ctd3-kicker{font-size:8px;font-weight:950;letter-spacing:.18em;color:#4f46e5;text-transform:uppercase}
        .ctd3-route{margin-top:3px;font-size:9px;color:#94a3b8;font-weight:800}
        .ctd3-hero{position:relative;overflow:hidden;padding:18px;border-radius:26px;border:1px solid rgba(255,255,255,.95);background:linear-gradient(145deg,rgba(255,255,255,.99),rgba(239,246,255,.96) 55%,rgba(245,243,255,.96));box-shadow:0 22px 52px rgba(15,23,42,.11),inset 0 1px 0 #fff}
        .ctd3-hero:before{content:"";position:absolute;right:-80px;top:-100px;width:230px;height:230px;border-radius:50%;background:radial-gradient(circle,rgba(79,70,229,.13),transparent 68%);pointer-events:none}
        .ctd3-identity{position:relative;display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
        .ctd3-name{min-width:0;font-size:clamp(27px,7vw,42px);line-height:.98;font-weight:950;letter-spacing:-.055em;overflow-wrap:anywhere}
        .ctd3-number{margin-top:7px;font-size:9px;color:#64748b;font-weight:900;letter-spacing:.08em}
        .ctd3-status{flex:0 0 auto;padding:7px 9px;border-radius:999px;font-size:8px;font-weight:950;white-space:nowrap;border:1px solid transparent}
        .ctd3-status.complete{background:#ecfdf5;border-color:#bbf7d0;color:#047857}.ctd3-status.progress{background:#eef2ff;border-color:#c7d2fe;color:#4338ca}.ctd3-status.idle{background:#f8fafc;border-color:#e2e8f0;color:#64748b}
        .ctd3-progress{display:grid;grid-template-columns:142px minmax(0,1fr);gap:18px;align-items:center;margin-top:20px}
        .ctd3-ring{width:142px;height:142px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#4f46e5 calc(var(--p)*1%),#e2e8f0 0);box-shadow:0 15px 34px rgba(79,70,229,.17),inset 0 1px 0 #fff}
        .ctd3-ring-inner{width:112px;height:112px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#fff,#f5f7ff);box-shadow:inset 0 2px 5px rgba(15,23,42,.06),0 5px 12px rgba(15,23,42,.07);text-align:center}
        .ctd3-percent{font-size:28px;line-height:1;font-weight:950;color:#3730a3}.ctd3-percent-caption{margin-top:4px;font-size:7px;color:#64748b;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
        .ctd3-kpis{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ctd3-kpi{padding:11px;border-radius:14px;background:rgba(255,255,255,.78);border:1px solid rgba(255,255,255,.94);box-shadow:inset 0 1px 0 #fff,0 8px 17px rgba(15,23,42,.045);min-width:0}.ctd3-label{font-size:7px;color:#64748b;font-weight:950;letter-spacing:.11em;text-transform:uppercase}.ctd3-value{margin-top:4px;font-size:15px;font-weight:950;overflow-wrap:anywhere}.ctd3-sub{margin-top:2px;font-size:8px;color:#94a3b8;font-weight:750;overflow-wrap:anywhere}
        .ctd3-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:13px}.ctd3-btn{min-height:42px;border-radius:12px;border:1px solid #dbe4e8;background:linear-gradient(145deg,#fff,#f1f5f9);color:#334155;font:inherit;font-size:9px;font-weight:950;cursor:pointer;box-shadow:0 6px 12px rgba(15,23,42,.05)}.ctd3-btn.primary{border-color:rgba(79,70,229,.2);background:linear-gradient(145deg,#eef2ff,#e0e7ff);color:#4338ca}
        .ctd3-section{margin-top:16px}.ctd3-section-head{display:flex;align-items:end;justify-content:space-between;gap:8px;margin:0 3px 9px}.ctd3-section-title{font-size:11px;font-weight:950;letter-spacing:.15em;text-transform:uppercase;color:#475569}.ctd3-section-count{font-size:8px;color:#94a3b8;font-weight:900}
        .ctd3-worker-list{display:grid;gap:8px}.ctd3-worker{padding:12px;border-radius:19px;border:1px solid rgba(255,255,255,.95);background:linear-gradient(145deg,#fff,#f8fafc);box-shadow:0 12px 25px rgba(15,23,42,.065),inset 0 1px 0 #fff}.ctd3-worker-head{display:flex;align-items:center;gap:10px;min-width:0}.ctd3-avatar{width:44px;height:44px;flex:0 0 auto;border-radius:14px;display:grid;place-items:center;overflow:hidden;background:linear-gradient(145deg,#dbeafe,#ede9fe);color:#4338ca;font-size:14px;font-weight:950}.ctd3-avatar img{width:100%;height:100%;object-fit:cover}.ctd3-worker-id{min-width:0}.ctd3-worker-name{font-size:13px;font-weight:950;overflow-wrap:anywhere}.ctd3-worker-username{margin-top:2px;font-size:8px;color:#64748b;font-weight:800;overflow-wrap:anywhere}.ctd3-work-id{margin-left:auto;max-width:42%;font-size:7px;color:#94a3b8;font-weight:850;text-align:right;overflow-wrap:anywhere}.ctd3-worker-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}.ctd3-worker-metric{padding:8px 9px;border-radius:12px;background:linear-gradient(145deg,#f8fafc,#fff);border:1px solid #eef2f7}.ctd3-worker-metric .ctd3-label{font-size:6px}.ctd3-worker-metric .ctd3-value{font-size:12px}.ctd3-worker-note{margin-top:7px;font-size:8px;color:#64748b;font-weight:750;line-height:1.4}.ctd3-no-baseline{margin-top:7px;padding:8px 9px;border-radius:11px;background:#f8fafc;border:1px solid #eef2f7;color:#64748b;font-size:8px;line-height:1.35;font-weight:750}.ctd3-bar{height:7px;margin-top:7px;border-radius:999px;background:#e2e8f0;overflow:hidden}.ctd3-bar-fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,#4f46e5,#06b6d4)}
        .ctd3-state{padding:24px 18px;border-radius:21px;border:1px solid rgba(255,255,255,.94);background:linear-gradient(145deg,#fff,#f8fafc);box-shadow:0 13px 29px rgba(15,23,42,.07),inset 0 1px 0 #fff;text-align:center}.ctd3-state-title{font-size:15px;font-weight:950}.ctd3-state-copy{max-width:460px;margin:6px auto 0;color:#64748b;font-size:10px;line-height:1.5}.ctd3-retry{margin-top:12px;min-height:40px;padding:0 15px;border:0;border-radius:11px;background:linear-gradient(145deg,#4f46e5,#4338ca);color:#fff;font:inherit;font-size:9px;font-weight:950;cursor:pointer}.ctd3-skeleton{position:relative;overflow:hidden}.ctd3-skeleton:after{content:"";position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent);animation:ctd3-shimmer 1.7s ease-in-out infinite}.ctd3-sk-line{height:11px;border-radius:999px;background:#e8edf5}.ctd3-sk-hero{height:350px}.ctd3-sk-worker{height:126px}@keyframes ctd3-shimmer{to{transform:translateX(100%)}}
        @media(max-width:620px){.ctd3-progress{grid-template-columns:108px minmax(0,1fr);gap:11px}.ctd3-ring{width:108px;height:108px}.ctd3-ring-inner{width:84px;height:84px}.ctd3-percent{font-size:22px}.ctd3-kpis{grid-template-columns:1fr}.ctd3-actions{grid-template-columns:1fr 1fr}}
        @media(max-width:430px){.ctd3-page{padding-left:10px;padding-right:10px}.ctd3-hero{padding:15px;border-radius:23px}.ctd3-name{font-size:29px}.ctd3-progress{grid-template-columns:96px minmax(0,1fr);gap:9px}.ctd3-ring{width:96px;height:96px}.ctd3-ring-inner{width:74px;height:74px}.ctd3-percent{font-size:20px}.ctd3-worker-grid{grid-template-columns:1fr}.ctd3-work-id{max-width:38%;font-size:6px}.ctd3-btn{min-height:43px;font-size:8px}}
        @media(prefers-reduced-motion:reduce){.ctd3-skeleton:after{animation:none}.ctd3-btn{transition:none}}
      `}</style>
      <div className="ctd3-shell">
        <header className="ctd3-top">
          <button type="button" className="ctd3-back" onClick={() => navigate('/work/contractor?view=overview')} aria-label="Back to Contractor Overview">‹</button>
          <div><div className="ctd3-kicker">TEAM DRILL-DOWN</div><div className="ctd3-route">Contractor Overview · Operational Detail</div></div>
        </header>

        {loading ? (
          <>
            <section className="ctd3-state ctd3-skeleton ctd3-sk-hero" aria-label="Loading team detail" />
            <section className="ctd3-section"><div className="ctd3-state ctd3-skeleton ctd3-sk-worker" /></section>
            <section className="ctd3-section"><div className="ctd3-state ctd3-skeleton ctd3-sk-worker" /></section>
          </>
        ) : error ? (
          <section className="ctd3-state" role="alert">
            <div className="ctd3-state-title">Team detail unavailable</div>
            <p className="ctd3-state-copy">{error}</p>
            <button type="button" className="ctd3-retry" onClick={() => void load()}>Retry</button>
          </section>
        ) : !rows.length ? (
          <section className="ctd3-state">
            <div className="ctd3-state-title">Team not found</div>
            <p className="ctd3-state-copy">This team is no longer available in your Contractor workspace.</p>
            <button type="button" className="ctd3-retry" onClick={() => navigate('/work/contractor?view=overview')}>Back to Overview</button>
          </section>
        ) : (
          <>
            <section className="ctd3-hero" aria-labelledby="ctd3-team-title">
              <div className="ctd3-identity">
                <div style={{ minWidth: 0 }}>
                  <h1 id="ctd3-team-title" className="ctd3-name">{summary.teamName}</h1>
                  <div className="ctd3-number">TEAM {summary.teamNumber} · {summary.workerCount} {summary.workerCount === 1 ? 'WORKER' : 'WORKERS'}</div>
                </div>
                <div className={`ctd3-status ${teamStatus.tone}`}>{teamStatus.label}</div>
              </div>

              <div className="ctd3-progress">
                <div className="ctd3-ring" style={{ '--p': summary.completion } as React.CSSProperties} aria-label={`${Math.round(summary.completion)} percent complete`}>
                  <div className="ctd3-ring-inner"><div><div className="ctd3-percent">{Math.round(summary.completion)}%</div><div className="ctd3-percent-caption">Complete</div></div></div>
                </div>
                <div>
                  <div className="ctd3-kpis">
                    <div className="ctd3-kpi"><div className="ctd3-label">Taken</div><div className="ctd3-value">{pieces(summary.takenPieces)} pcs</div><div className="ctd3-sub">{money(summary.takenAmount)}</div></div>
                    <div className="ctd3-kpi"><div className="ctd3-label">Completed</div><div className="ctd3-value">{pieces(summary.completedPieces)} pcs</div><div className="ctd3-sub">{money(summary.completedAmount)}</div></div>
                    <div className="ctd3-kpi"><div className="ctd3-label">Remaining</div><div className="ctd3-value">{pieces(summary.remainingPieces)} pcs</div><div className="ctd3-sub">max(taken − completed, 0)</div></div>
                    <div className="ctd3-kpi"><div className="ctd3-label">Workers</div><div className="ctd3-value">{pieces(summary.workerCount)}</div><div className="ctd3-sub">Real team members</div></div>
                  </div>
                </div>
              </div>

              <div className="ctd3-actions">
                <button type="button" className="ctd3-btn primary" onClick={() => navigate(`/work/contractor?view=team-dashboard&team=${encodeURIComponent(String(summary.teamNumber))}`)}>Your Work</button>
                <button type="button" className="ctd3-btn" onClick={() => navigate(`/work/contractor?view=team-work&team=${encodeURIComponent(String(summary.teamNumber))}`)}>Team Workspace</button>
              </div>
            </section>

            <section className="ctd3-section" aria-labelledby="ctd3-workers-title">
              <div className="ctd3-section-head"><div id="ctd3-workers-title" className="ctd3-section-title">Workers</div><div className="ctd3-section-count">{workers.length} REAL MEMBERS</div></div>
              {!workers.length ? (
                <div className="ctd3-state"><div className="ctd3-state-title">No workers yet</div><p className="ctd3-state-copy">This team has no current worker members. Add workers from the existing Team Workspace.</p></div>
              ) : (
                <div className="ctd3-worker-list">
                  {workers.map(worker => {
                    const completed = numberValue(worker.worker_completed_pieces);
                    const teamShare = summary.completedPieces > 0 ? Math.min(100, Math.max(0, (completed / summary.completedPieces) * 100)) : 0;
                    const name = worker.worker_display_name || worker.worker_username || 'Work Social Worker';
                    const entryCount = Math.max(0, Number(worker.worker_entry_count) || 0);
                    return (
                      <article className="ctd3-worker" key={worker.worker_profile_id}>
                        <div className="ctd3-worker-head">
                          <div className="ctd3-avatar" aria-label={`${name} avatar`}>{worker.worker_avatar_url ? <img src={worker.worker_avatar_url} alt="" /> : initials(name)}</div>
                          <div className="ctd3-worker-id"><div className="ctd3-worker-name">{name}</div>{worker.worker_username && <div className="ctd3-worker-username">@{worker.worker_username}</div>}</div>
                          {worker.work_id && <div className="ctd3-work-id">Worker ID<br />{worker.work_id}</div>}
                        </div>
                        <div className="ctd3-worker-grid">
                          <div className="ctd3-worker-metric"><div className="ctd3-label">Completed output</div><div className="ctd3-value">{pieces(completed)} pcs</div></div>
                          <div className="ctd3-worker-metric"><div className="ctd3-label">Active entries</div><div className="ctd3-value">{pieces(entryCount)}</div></div>
                        </div>
                        <div className="ctd3-bar" aria-hidden="true"><div className="ctd3-bar-fill" style={{ width: `${teamShare}%` }} /></div>
                        <div className="ctd3-worker-note">{completed > 0 ? `${Math.round(teamShare)}% of the team's completed output` : 'No active work output recorded yet.'}</div>
                        <div className="ctd3-no-baseline">Individual completion % and remaining pieces are not shown because the current real data model does not assign a separate taken-piece baseline to each worker. No estimate is fabricated.</div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
