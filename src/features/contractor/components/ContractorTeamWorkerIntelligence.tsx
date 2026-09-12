import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../../../app/Router';
import { supabase } from '../../../lib/supabase/client';

type Movement = 'increasing' | 'decreasing' | 'stable' | 'insufficient';
type Team = { team_id: number; team_number: number; team_name: string; worker_count: number; taken_pieces: number; completed_pieces: number; remaining_pieces: number; progress_pct: number | null; activity_events_7d: number; completed_7d: number; previous_completed_7d: number; movement: Movement; last_activity_at: string | null; lifetime_output_events: number };
type Payload = { generated_at?: string; teams?: Team[] };

const num = (v: unknown) => Math.max(0, Number(v) || 0);
const pcs = (v: unknown) => num(v).toLocaleString('en-PK', { maximumFractionDigits: 0 });
const movementLabel = (movement: Movement) => movement === 'increasing' ? 'MOVING UP' : movement === 'decreasing' ? 'SLOWING DOWN' : movement === 'stable' ? 'STEADY' : 'INSUFFICIENT HISTORY';
const movementTone = (movement: Movement) => movement === 'increasing' ? 'up' : movement === 'decreasing' ? 'down' : movement === 'stable' ? 'steady' : 'neutral';

export function ContractorTeamWorkerIntelligence() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      const result = await supabase.rpc('get_contractor_overview_team_worker_intelligence');
      if (cancelled) return;
      if (result.error) {
        console.error('get_contractor_overview_team_worker_intelligence failed', result.error);
        setTeams([]);
        setError('Team and worker intelligence could not be loaded.');
      } else {
        const data = (result.data ?? {}) as Payload;
        setTeams(Array.isArray(data.teams) ? data.teams : []);
      }
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const model = useMemo(() => {
    const ordered = [...teams].sort((a, b) => num(b.completed_pieces) - num(a.completed_pieces) || num(b.taken_pieces) - num(a.taken_pieces) || num(b.activity_events_7d) - num(a.activity_events_7d) || a.team_number - b.team_number);
    const mostActive = [...teams].sort((a, b) => num(b.activity_events_7d) - num(a.activity_events_7d) || num(b.completed_pieces) - num(a.completed_pieces) || a.team_number - b.team_number)[0] ?? null;
    const maxCompleted = Math.max(1, ...ordered.map(t => num(t.completed_pieces)));
    const totalCompleted = ordered.reduce((sum, t) => sum + num(t.completed_pieces), 0);
    return { ordered, mostActive, maxCompleted, totalCompleted };
  }, [teams]);

  if (loading) return <section className="ctwi" aria-labelledby="ctwi-title"><style>{styles}</style><div className="ctwi-loading"><div className="ctwi-orb"/><div><div className="ctwi-kicker">TEAM INTELLIGENCE</div><h2 id="ctwi-title" className="ctwi-title">Reading team movement…</h2><p className="ctwi-copy">Loading real team and output records.</p></div></div></section>;
  if (error) return <section className="ctwi" aria-labelledby="ctwi-title"><style>{styles}</style><div className="ctwi-error"><div className="ctwi-kicker">TEAM INTELLIGENCE</div><h2 id="ctwi-title" className="ctwi-title">Intelligence unavailable</h2><p className="ctwi-copy">{error}</p></div></section>;
  if (!model.ordered.length) return <section className="ctwi" aria-labelledby="ctwi-title"><style>{styles}</style><div className="ctwi-empty"><div className="ctwi-kicker">TEAM INTELLIGENCE</div><h2 id="ctwi-title" className="ctwi-title">No teams yet</h2><p className="ctwi-copy">There are no contractor-owned teams available for business-wide intelligence.</p></div></section>;

  return <section className="ctwi" aria-labelledby="ctwi-title">
    <style>{styles}</style>
    <header className="ctwi-head">
      <div><div className="ctwi-kicker">TEAM / WORKER INTELLIGENCE</div><h2 id="ctwi-title" className="ctwi-title">Where the business is moving.</h2><p className="ctwi-copy">Teams are ordered by completed output, then real taken volume, then recent activity. Individual worker details stay inside the Team Dashboard.</p></div>
      {model.mostActive && <div className="ctwi-lead"><span>MOST ACTIVE</span><strong>Team {model.mostActive.team_number}</strong><small>{pcs(model.mostActive.activity_events_7d)} real events · 7d</small></div>}
    </header>

    <div className="ctwi-grid" aria-label="Team intelligence">
      {model.ordered.map((team, index) => {
        const contribution = model.totalCompleted > 0 ? num(team.completed_pieces) / model.totalCompleted * 100 : null;
        const outputWidth = num(team.completed_pieces) / model.maxCompleted * 100;
        return <article className={`ctwi-team ${index === 0 ? 'leader' : ''}`} key={team.team_id}>
          <div className="ctwi-team-top">
            <div className="ctwi-rank">#{index + 1}</div>
            <div className="ctwi-team-identity"><div className="ctwi-team-name">{team.team_name}</div><div className="ctwi-team-number">TEAM {team.team_number}</div></div>
            <span className={`ctwi-signal ${movementTone(team.movement)}`}>{movementLabel(team.movement)}</span>
          </div>
          <div className="ctwi-output"><div className="ctwi-output-value">{pcs(team.completed_pieces)}</div><div className="ctwi-output-label">completed pieces</div><div className="ctwi-output-track"><span style={{ width: `${outputWidth}%` }}/></div></div>
          <div className="ctwi-metrics">
            <div><span>TAKEN</span><strong>{pcs(team.taken_pieces)}</strong></div>
            <div><span>REMAINING</span><strong>{pcs(team.remaining_pieces)}</strong></div>
            <div><span>7D ACTIVITY</span><strong>{pcs(team.activity_events_7d)}</strong></div>
            <div><span>WORKERS</span><strong>{pcs(team.worker_count)}</strong></div>
          </div>
          <div className="ctwi-progress-line"><span>Progress</span><strong>{team.progress_pct === null ? 'NO BASELINE' : `${num(team.progress_pct).toFixed(0)}%`}</strong><i><b style={{ width: `${team.progress_pct === null ? 0 : num(team.progress_pct)}%` }}/></i></div>
          <div className="ctwi-contribution">{contribution === null ? 'No completed-output distribution yet.' : `${contribution.toFixed(0)}% of completed output across your teams.`}</div>
          <div className="ctwi-team-foot"><span>{team.worker_count ? `${pcs(team.worker_count)} active workers` : 'NO ACTIVE WORKERS'}</span><span>{movementLabel(team.movement)}</span></div>
          <button className="ctwi-drill" type="button" onClick={() => navigate(`/work/contractor?view=team-dashboard&team=${team.team_number}`)}>Open Team Dashboard <span>↗</span></button>
        </article>;
      })}
    </div>

    <footer className="ctwi-foot"><span>REAL DATA · 7-DAY MOVEMENT WINDOW</span><small>Overview is intentionally team-level. Individual worker records are available inside each Team Dashboard. Slowdown is shown only when current completed output is lower than the previous 7-day period with a non-zero previous baseline.</small></footer>
  </section>;
}

const styles = `
.ctwi{position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.94);border-radius:26px;padding:17px;background:linear-gradient(145deg,rgba(255,255,255,.93),rgba(239,246,255,.82) 54%,rgba(245,243,255,.9));box-shadow:0 26px 58px rgba(15,23,42,.09),0 8px 22px rgba(79,70,229,.06),inset 0 1px 0 rgba(255,255,255,.98);color:#172033}.ctwi:before{content:"";position:absolute;right:-110px;top:-100px;width:310px;height:230px;border-radius:50%;background:radial-gradient(circle,rgba(34,211,238,.16),rgba(99,102,241,.07) 38%,transparent 70%);pointer-events:none}.ctwi-head{position:relative;display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.ctwi-kicker{font-size:8px;font-weight:950;letter-spacing:.2em;color:#4f46e5;text-transform:uppercase}.ctwi-title{margin:4px 0 0;font-size:22px;line-height:1.05;letter-spacing:-.045em;font-weight:950}.ctwi-copy{margin:6px 0 0;max-width:620px;font-size:10px;line-height:1.5;color:#64748b;font-weight:750}.ctwi-lead{min-width:135px;padding:10px 11px;border-radius:15px;border:1px solid rgba(129,140,248,.18);background:linear-gradient(145deg,rgba(239,246,255,.85),rgba(245,243,255,.8));box-shadow:inset 0 1px 0 #fff,0 10px 20px rgba(67,56,202,.06)}.ctwi-lead span{display:block;font-size:7px;letter-spacing:.15em;color:#64748b;font-weight:950}.ctwi-lead strong{display:block;margin-top:3px;font-size:13px;color:#3730a3}.ctwi-lead small{display:block;margin-top:3px;font-size:7px;color:#94a3b8;font-weight:800}.ctwi-grid{position:relative;display:grid;gap:9px;margin-top:14px}.ctwi-team{position:relative;overflow:hidden;padding:13px;border-radius:19px;border:1px solid rgba(255,255,255,.9);background:linear-gradient(145deg,rgba(255,255,255,.83),rgba(248,250,252,.67));box-shadow:0 14px 30px rgba(15,23,42,.055),inset 0 1px 0 #fff;transition:transform .2s ease,box-shadow .2s ease}.ctwi-team:hover{transform:translateY(-2px);box-shadow:0 22px 40px rgba(15,23,42,.085),inset 0 1px 0 #fff}.ctwi-team.leader{border-color:rgba(99,102,241,.23);box-shadow:0 20px 42px rgba(67,56,202,.09),inset 0 1px 0 #fff}.ctwi-team-top{display:flex;align-items:center;gap:9px}.ctwi-rank{width:30px;height:30px;flex:0 0 30px;display:grid;place-items:center;border-radius:10px;background:linear-gradient(145deg,#eef2ff,#e0f2fe);color:#4338ca;font-size:9px;font-weight:950;box-shadow:inset 0 1px 0 #fff}.ctwi-team-identity{min-width:0;flex:1}.ctwi-team-name{font-size:15px;font-weight:950;overflow-wrap:anywhere}.ctwi-team-number{margin-top:2px;font-size:7px;color:#94a3b8;font-weight:900;letter-spacing:.12em}.ctwi-signal{padding:5px 7px;border-radius:999px;font-size:7px;font-weight:950;letter-spacing:.06em;white-space:nowrap;background:#f8fafc;color:#64748b;border:1px solid #e2e8f0}.ctwi-signal.up{background:#ecfdf5;color:#047857;border-color:#bbf7d0}.ctwi-signal.down{background:#fff7ed;color:#9a3412;border-color:#fed7aa}.ctwi-signal.steady{background:#eef2ff;color:#4338ca;border-color:#c7d2fe}.ctwi-output{margin-top:12px;padding:10px 11px;border-radius:15px;background:linear-gradient(145deg,rgba(239,246,255,.76),rgba(245,243,255,.66));border:1px solid rgba(129,140,248,.12)}.ctwi-output-value{font-size:24px;line-height:1;font-weight:950;color:#172554}.ctwi-output-label{margin-top:4px;font-size:7px;color:#64748b;font-weight:900;letter-spacing:.11em;text-transform:uppercase}.ctwi-output-track{height:5px;margin-top:8px;border-radius:99px;background:#e2e8f0;overflow:hidden}.ctwi-output-track span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#4f46e5,#06b6d4);transition:width .45s ease}.ctwi-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:8px}.ctwi-metrics>div{min-width:0;padding:8px 7px;border-radius:12px;background:rgba(255,255,255,.68);border:1px solid rgba(255,255,255,.9)}.ctwi-metrics span{display:block;font-size:6px;letter-spacing:.1em;color:#94a3b8;font-weight:950}.ctwi-metrics strong{display:block;margin-top:3px;font-size:11px;font-weight:950;overflow-wrap:anywhere}.ctwi-progress-line{display:grid;grid-template-columns:auto auto;gap:5px 8px;margin-top:9px;font-size:8px;color:#64748b;font-weight:850}.ctwi-progress-line strong{justify-self:end;color:#4338ca}.ctwi-progress-line i{grid-column:1/-1;height:5px;border-radius:99px;background:#e2e8f0;overflow:hidden}.ctwi-progress-line b{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#06b6d4,#4f46e5)}.ctwi-contribution{margin-top:7px;font-size:8px;color:#94a3b8;font-weight:800}.ctwi-team-foot{display:flex;justify-content:space-between;gap:8px;margin-top:11px;padding:9px 10px;border-radius:13px;background:rgba(248,250,252,.62);border:1px solid rgba(148,163,184,.12)}.ctwi-team-foot span{font-size:7px;color:#64748b;font-weight:950;letter-spacing:.06em}.ctwi-team-foot span:last-child{color:#94a3b8;text-align:right}.ctwi-drill{width:100%;min-height:39px;margin-top:10px;border:1px solid rgba(79,70,229,.16);border-radius:11px;background:linear-gradient(145deg,#eef2ff,#e0e7ff);color:#4338ca;font:inherit;font-size:8px;font-weight:950;cursor:pointer;box-shadow:0 7px 14px rgba(79,70,229,.08)}.ctwi-drill span{margin-left:5px}.ctwi-foot{display:flex;justify-content:space-between;gap:10px;margin-top:11px;padding:9px 10px;border-radius:13px;background:rgba(248,250,252,.62);border:1px solid rgba(148,163,184,.12)}.ctwi-foot span{font-size:7px;color:#64748b;font-weight:950;letter-spacing:.1em}.ctwi-foot small{max-width:650px;font-size:7px;line-height:1.45;color:#94a3b8;font-weight:750;text-align:right}.ctwi-loading,.ctwi-empty,.ctwi-error{min-height:210px;display:grid;place-items:center;text-align:center;padding:20px}.ctwi-orb{width:48px;height:48px;margin:0 auto 10px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#93c5fd 30%,#4f46e5 65%,#06b6d4);box-shadow:0 15px 35px rgba(79,70,229,.2),0 0 0 8px rgba(79,70,229,.07)}@media(max-width:700px){.ctwi-head{flex-direction:column}.ctwi-lead{width:100%;box-sizing:border-box}.ctwi-metrics{grid-template-columns:1fr 1fr}.ctwi-foot{align-items:flex-start;flex-direction:column}.ctwi-foot small{text-align:left}}@media(max-width:430px){.ctwi{padding:13px;border-radius:22px}.ctwi-title{font-size:20px}.ctwi-team{padding:11px}.ctwi-team-top{align-items:flex-start}.ctwi-signal{font-size:6px;padding:5px 6px}.ctwi-foot span{font-size:6px}}@media(prefers-reduced-motion:reduce){.ctwi-team,.ctwi-output-track span{transition:none}.ctwi-team:hover{transform:none}}
`;