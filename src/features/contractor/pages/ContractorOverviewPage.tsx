import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { navigate } from '../../../app/Router';
import { supabase } from '../../../lib/supabase/client';

interface Props { profileId: string; }

type TeamRow = {
  team_id: number;
  team_number: number;
  team_name: string;
  active_workers: number;
  taken_pieces: number;
  taken_amount: number;
  completed_pieces: number;
  completed_amount: number;
  overall_taken_pieces: number;
  overall_taken_amount: number;
  overall_completed_pieces: number;
  overall_completed_amount: number;
};

const money = (value: number) => `PKR ${Math.max(0, Number(value) || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
const pieces = (value: number) => Math.max(0, Number(value) || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 });
const pct = (done: number, taken: number) => taken > 0 ? Math.min(100, Math.max(0, (done / taken) * 100)) : 0;

function teamStatus(done: number, taken: number) {
  const remaining = Math.max(0, taken - done);
  if (remaining === 0 && taken > 0) return { label: 'COMPLETE', tone: 'complete' as const };
  if (taken > 0) return { label: 'IN PROGRESS', tone: 'progress' as const };
  return { label: 'NO WORK', tone: 'idle' as const };
}

export function ContractorOverviewPage({ profileId }: Props) {
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const result = await supabase.rpc('get_contractor_overview');
    if (result.error) {
      console.error('get_contractor_overview failed', result.error);
      setError('We could not load your contractor overview. Please try again.');
      setLoading(false);
      return;
    }
    setRows((result.data ?? []) as TeamRow[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [profileId]);

  const totals = useMemo(() => {
    const first = rows[0];
    return {
      takenPieces: Math.max(0, Number(first?.overall_taken_pieces ?? 0)),
      takenAmount: Math.max(0, Number(first?.overall_taken_amount ?? 0)),
      donePieces: Math.max(0, Number(first?.overall_completed_pieces ?? 0)),
      doneAmount: Math.max(0, Number(first?.overall_completed_amount ?? 0)),
    };
  }, [rows]);

  const completion = pct(totals.donePieces, totals.takenPieces);
  const remaining = Math.max(0, totals.takenPieces - totals.donePieces);

  return (
    <main className="co-page">
      <style>{`
        body:has(.co-page) .work-social-router-shell > nav{display:none!important}
        body:has(.co-page) .work-social-router-shell > div.work-social-page-content{padding-bottom:0!important}
        .co-page{min-height:100dvh;padding:16px 12px 30px;box-sizing:border-box;background:radial-gradient(circle at 8% 0,rgba(59,130,246,.14),transparent 31%),radial-gradient(circle at 94% 10%,rgba(139,92,246,.13),transparent 29%),linear-gradient(180deg,#f8fbff,#f5f7fb);color:#172033}
        .co-shell{width:min(820px,100%);margin:0 auto}
        .co-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
        .co-brand{min-width:0;font-size:12px;font-weight:950;letter-spacing:.12em;color:#334155}
        .co-context{margin-top:3px;font-size:9px;color:#94a3b8;font-weight:800;letter-spacing:.04em}
        .co-settings,.co-btn{font:inherit;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease,filter .16s ease}
        .co-settings{min-height:38px;padding:0 13px;border-radius:12px;border:1px solid rgba(255,255,255,.92);background:linear-gradient(145deg,#fff,#eef2ff);box-shadow:0 8px 18px rgba(15,23,42,.08),inset 0 1px 0 #fff;color:#4338ca;font-size:10px;font-weight:900;white-space:nowrap}
        .co-settings:hover,.co-btn:hover{transform:translateY(-1px);box-shadow:0 11px 22px rgba(15,23,42,.1)}
        .co-settings:active,.co-btn:active{transform:translateY(0)}
        .co-settings:focus-visible,.co-btn:focus-visible{outline:2px solid rgba(99,102,241,.72);outline-offset:3px}
        .co-hero{position:relative;overflow:hidden;padding:18px;border-radius:26px;border:1px solid rgba(255,255,255,.94);background:linear-gradient(145deg,rgba(255,255,255,.99),rgba(239,246,255,.96) 58%,rgba(245,243,255,.96));box-shadow:0 22px 52px rgba(15,23,42,.11),inset 0 1px 0 #fff}
        .co-hero:before{content:"";position:absolute;right:-70px;top:-90px;width:210px;height:210px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,.12),transparent 68%);pointer-events:none}
        .co-kicker{position:relative;font-size:8px;font-weight:950;letter-spacing:.19em;text-transform:uppercase;color:#4f46e5}
        .co-title{position:relative;margin:5px 0 0;font-size:clamp(28px,7vw,40px);line-height:.98;font-weight:950;letter-spacing:-.055em}
        .co-sub{position:relative;max-width:610px;margin:8px 0 0;color:#64748b;font-size:11px;line-height:1.5}
        .co-progress{display:grid;grid-template-columns:150px minmax(0,1fr);align-items:center;gap:20px;margin-top:19px}
        .co-ring{width:150px;height:150px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#4f46e5 calc(var(--p)*1%),#e2e8f0 0);box-shadow:0 15px 34px rgba(79,70,229,.17),inset 0 1px 0 #fff}
        .co-ring-inner{width:118px;height:118px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#fff,#f5f7ff);box-shadow:inset 0 2px 5px rgba(15,23,42,.06),0 5px 12px rgba(15,23,42,.07);text-align:center}
        .co-percent{font-size:30px;line-height:1;font-weight:950;color:#3730a3}
        .co-left{margin-top:6px;font-size:9px;color:#64748b;font-weight:850}
        .co-kpis{display:grid;grid-template-columns:1fr 1fr;gap:9px}
        .co-kpi{min-width:0;padding:12px;border-radius:15px;background:rgba(255,255,255,.78);border:1px solid rgba(255,255,255,.94);box-shadow:inset 0 1px 0 #fff,0 8px 17px rgba(15,23,42,.045)}
        .co-kpi-label{font-size:8px;color:#64748b;font-weight:950;letter-spacing:.12em;text-transform:uppercase}
        .co-kpi-value{margin-top:4px;font-size:17px;font-weight:950;letter-spacing:-.02em;overflow-wrap:anywhere}
        .co-kpi-sub{margin-top:3px;font-size:9px;color:#94a3b8;font-weight:750;overflow-wrap:anywhere}
        .co-remaining{margin-top:9px;padding:10px 12px;border-radius:14px;border:1px solid rgba(245,158,11,.14);background:linear-gradient(145deg,rgba(255,251,235,.8),rgba(255,255,255,.72));color:#92400e;font-size:9px;font-weight:850}
        .co-section{margin-top:16px}
        .co-section-head{display:flex;align-items:end;justify-content:space-between;gap:8px;margin:0 3px 9px}
        .co-section-title{font-size:11px;font-weight:950;letter-spacing:.15em;text-transform:uppercase;color:#475569}
        .co-section-count{font-size:8px;color:#94a3b8;font-weight:900;letter-spacing:.06em}
        .co-list{display:grid;gap:9px}
        .co-team{padding:14px;border-radius:20px;border:1px solid rgba(255,255,255,.95);background:linear-gradient(145deg,#fff,#f8fafc);box-shadow:0 13px 29px rgba(15,23,42,.075),inset 0 1px 0 #fff;transition:transform .18s ease,box-shadow .18s ease}
        .co-team:hover{transform:translateY(-1px);box-shadow:0 17px 34px rgba(15,23,42,.09),inset 0 1px 0 #fff}
        .co-team-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
        .co-team-identity{min-width:0}
        .co-team-name{font-size:16px;font-weight:950;letter-spacing:-.025em;overflow-wrap:anywhere}
        .co-team-number{margin-top:3px;font-size:8px;color:#94a3b8;font-weight:850;letter-spacing:.06em}
        .co-team-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}
        .co-workers,.co-status{padding:5px 8px;border-radius:999px;font-size:8px;font-weight:900;white-space:nowrap}
        .co-workers{background:#f1f5f9;color:#64748b}
        .co-status{border:1px solid transparent}
        .co-status.complete{background:#ecfdf5;border-color:#bbf7d0;color:#047857}
        .co-status.progress{background:#eef2ff;border-color:#c7d2fe;color:#4338ca}
        .co-status.idle{background:#f8fafc;border-color:#e2e8f0;color:#64748b}
        .co-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:11px}
        .co-metric{min-width:0;padding:9px 10px;border-radius:13px;background:linear-gradient(145deg,#f8fafc,#fff);border:1px solid #eef2f7}
        .co-metric-label{font-size:7px;color:#94a3b8;font-weight:950;text-transform:uppercase;letter-spacing:.1em}
        .co-metric-value{margin-top:4px;font-size:12px;font-weight:950;overflow-wrap:anywhere}
        .co-metric-sub{margin-top:2px;font-size:8px;color:#94a3b8;overflow-wrap:anywhere}
        .co-progress-row{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px;font-size:9px;font-weight:950;color:#475569}
        .co-progress-value.complete{color:#047857}.co-progress-value.progress{color:#4338ca}.co-progress-value.idle{color:#64748b}
        .co-bar{height:8px;margin-top:5px;border-radius:999px;background:#e2e8f0;overflow:hidden;box-shadow:inset 0 1px 2px rgba(15,23,42,.08)}
        .co-bar-fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,#4f46e5,#06b6d4);box-shadow:0 2px 7px rgba(79,70,229,.22);transition:width .5s ease}
        .co-bar-fill.complete{background:linear-gradient(90deg,#059669,#10b981);box-shadow:0 2px 7px rgba(5,150,105,.2)}
        .co-remaining-team{margin-top:7px;font-size:8px;color:#64748b;font-weight:800}
        .co-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
        .co-btn{min-height:40px;padding:0 10px;border-radius:12px;border:1px solid #dbe4e8;background:linear-gradient(145deg,#fff,#f1f5f9);color:#334155;font-size:9px;font-weight:950;box-shadow:0 5px 10px rgba(15,23,42,.045)}
        .co-btn.primary{border-color:rgba(79,70,229,.2);background:linear-gradient(145deg,#eef2ff,#e0e7ff);color:#4338ca}
        .co-state{padding:22px 18px;border-radius:20px;border:1px solid rgba(255,255,255,.94);background:linear-gradient(145deg,#fff,#f8fafc);box-shadow:0 13px 29px rgba(15,23,42,.07),inset 0 1px 0 #fff;text-align:center}
        .co-state-title{font-size:14px;font-weight:950;color:#172033}.co-state-copy{margin:6px auto 0;max-width:430px;font-size:10px;line-height:1.5;color:#64748b}
        .co-retry{margin-top:12px;min-height:38px;padding:0 14px;border:0;border-radius:11px;background:linear-gradient(145deg,#4f46e5,#4338ca);color:#fff;font:inherit;font-size:9px;font-weight:950;cursor:pointer;box-shadow:0 8px 17px rgba(79,70,229,.18)}
        .co-error{border-color:#fecaca;background:linear-gradient(145deg,#fffafa,#fff7f7)}.co-error .co-state-title{color:#991b1b}
        .co-skeleton{overflow:hidden;position:relative}.co-skeleton:after{content:"";position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent);animation:co-shimmer 1.7s ease-in-out infinite}.co-sk-line{border-radius:999px;background:#e8edf5}.co-sk-hero{height:220px}.co-sk-card{height:210px}@keyframes co-shimmer{to{transform:translateX(100%)}}
        @media(max-width:620px){.co-progress{grid-template-columns:112px minmax(0,1fr);gap:12px}.co-ring{width:112px;height:112px}.co-ring-inner{width:88px;height:88px}.co-percent{font-size:24px}.co-left{font-size:8px}.co-kpis{grid-template-columns:1fr}.co-kpi-value{font-size:15px}.co-remaining{font-size:8px}.co-team-head{gap:7px}.co-team-meta{display:grid;justify-items:end;gap:5px}.co-workers,.co-status{font-size:7px;padding:4px 7px}}
        @media(max-width:430px){.co-page{padding-left:10px;padding-right:10px}.co-hero{padding:15px;border-radius:23px}.co-title{font-size:29px}.co-progress{grid-template-columns:100px minmax(0,1fr);gap:10px}.co-ring{width:100px;height:100px}.co-ring-inner{width:78px;height:78px}.co-percent{font-size:22px}.co-team{padding:12px}.co-metrics{grid-template-columns:1fr}.co-actions{grid-template-columns:1fr 1fr}.co-btn{min-height:42px;font-size:8px;padding:0 7px}}
        @media(prefers-reduced-motion:reduce){.co-team,.co-btn,.co-settings,.co-bar-fill{transition:none}.co-skeleton:after{animation:none}}
      `}</style>

      <div className="co-shell">
        <header className="co-top">
          <div>
            <div className="co-brand">WORK SOCIAL · CONTRACTOR</div>
            <div className="co-context">Operational command center · Overview</div>
          </div>
          <button className="co-settings" type="button" aria-label="Open Contractor Settings" onClick={() => navigate('/work/contractor?view=settings')}>⚙ Settings</button>
        </header>

        {loading ? (
          <>
            <section className="co-state co-skeleton co-sk-hero" aria-label="Loading contractor overview"><div className="co-sk-line" style={{ width: '28%', height: 8 }} /><div className="co-sk-line" style={{ width: '52%', height: 30, marginTop: 10 }} /><div className="co-sk-line" style={{ width: '76%', height: 10, marginTop: 10 }} /></section>
            <section className="co-section"><div className="co-list"><div className="co-state co-skeleton co-sk-card" /><div className="co-state co-skeleton co-sk-card" /></div></section>
          </>
        ) : error ? (
          <section className="co-state co-error" role="alert">
            <div className="co-state-title">Overview unavailable</div>
            <p className="co-state-copy">Your contractor data could not be loaded right now. Nothing has been changed.</p>
            <button className="co-retry" type="button" onClick={() => void load()}>Retry Overview</button>
          </section>
        ) : (
          <>
            <section className="co-hero" aria-labelledby="co-overall-title">
              <div className="co-kicker">Contractor Overview</div>
              <h1 id="co-overall-title" className="co-title">Overall Progress</h1>
              <p className="co-sub">Company se liya gaya work aur teams ke through completed work ka real operational summary.</p>
              <div className="co-progress">
                <div className="co-ring" style={{ '--p': completion } as CSSProperties} role="img" aria-label={`${completion.toFixed(0)} percent overall completion`}>
                  <div className="co-ring-inner"><div><div className="co-percent">{completion.toFixed(0)}%</div><div className="co-left">{pieces(remaining)} pcs remaining</div></div></div>
                </div>
                <div className="co-kpis">
                  <div className="co-kpi"><div className="co-kpi-label">Total Taken</div><div className="co-kpi-value">{pieces(totals.takenPieces)} pcs</div><div className="co-kpi-sub">{money(totals.takenAmount)}</div></div>
                  <div className="co-kpi"><div className="co-kpi-label">Total Completed</div><div className="co-kpi-value">{pieces(totals.donePieces)} pcs</div><div className="co-kpi-sub">{money(totals.doneAmount)} · {completion.toFixed(0)}% complete</div></div>
                  <div className="co-remaining">{remaining === 0 && totals.takenPieces > 0 ? 'All taken work is complete.' : `${pieces(remaining)} pcs remaining to complete the taken work.`}</div>
                </div>
              </div>
            </section>

            <section className="co-section" aria-labelledby="co-team-title">
              <div className="co-section-head"><div id="co-team-title" className="co-section-title">Team Operations</div><div className="co-section-count">{rows.length} {rows.length === 1 ? 'TEAM' : 'TEAMS'}</div></div>
              {!rows.length ? (
                <div className="co-state"><div className="co-state-title">No teams yet</div><p className="co-state-copy">Create your first Contractor Team to start assigning work and tracking real execution here.</p></div>
              ) : (
                <div className="co-list">
                  {rows.map(team => {
                    const done = Math.max(0, Number(team.completed_pieces || 0));
                    const taken = Math.max(0, Number(team.taken_pieces || 0));
                    const progress = pct(done, taken);
                    const remainingTeam = Math.max(0, taken - done);
                    const status = teamStatus(done, taken);
                    return (
                      <article className="co-team" key={team.team_id}>
                        <div className="co-team-head">
                          <div className="co-team-identity"><div className="co-team-name">{team.team_name}</div><div className="co-team-number">TEAM #{team.team_number}</div></div>
                          <div className="co-team-meta"><span className="co-workers">{Number(team.active_workers || 0)} Workers Active</span><span className={`co-status ${status.tone}`}>{status.label}</span></div>
                        </div>
                        <div className="co-metrics">
                          <div className="co-metric"><div className="co-metric-label">Taken Work</div><div className="co-metric-value">{pieces(taken)} pcs</div><div className="co-metric-sub">{money(Number(team.taken_amount || 0))}</div></div>
                          <div className="co-metric"><div className="co-metric-label">Completed</div><div className="co-metric-value">{pieces(done)} pcs</div><div className="co-metric-sub">{progress.toFixed(0)}% complete</div></div>
                        </div>
                        <div className="co-progress-row"><span>Execution Progress</span><span className={`co-progress-value ${status.tone}`}>{progress.toFixed(0)}%</span></div>
                        <div className="co-bar" aria-hidden="true"><div className={`co-bar-fill ${status.tone}`} style={{ width: `${progress}%` }} /></div>
                        <div className="co-remaining-team">{remainingTeam === 0 && taken > 0 ? 'Complete · 100%' : `${pieces(remainingTeam)} pcs remaining`}</div>
                        <div className="co-actions">
                          <button className="co-btn primary" type="button" aria-label={`Open your work for ${team.team_name}`} onClick={() => navigate(`/work/contractor?view=team-dashboard&team=${team.team_number}`)}>Your Work</button>
                          <button className="co-btn" type="button" aria-label={`Open Team Workspace for ${team.team_name}`} onClick={() => navigate(`/work/contractor?view=team-work&team=${team.team_number}`)}>Team Workspace</button>
                        </div>
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
