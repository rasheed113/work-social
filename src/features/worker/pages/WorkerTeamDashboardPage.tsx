import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../../../app/Router';
import { supabase } from '../../../lib/supabase/client';

type Team = {
  team_id: number;
  team_number: number;
  team_name: string;
  team_purpose: string;
  team_created_at: string;
  leader_profile_id: string;
  leader_display_name: string | null;
  leader_username: string | null;
  leader_avatar_url: string | null;
  joined_at: string;
};

function teamNumberFromPath() {
  const match = window.location.pathname.match(/^\/work\/team-work\/(\d+)(?:\/|$)/);
  return match ? Number(match[1]) : null;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'T';
}

export function WorkerTeamDashboardPage() {
  const teamNumber = teamNumberFromPath();
  const isFinance = window.location.pathname.endsWith('/finance');
  const isSettings = window.location.pathname.endsWith('/settings');
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!teamNumber) { setError('Team Work workspace is unavailable.'); setLoading(false); return; }
      setLoading(true); setError('');
      const { data, error: queryError } = await supabase.rpc('get_worker_team_work_teams');
      if (!active) return;
      if (queryError) { setError(queryError.message); setLoading(false); return; }
      const selected = ((data ?? []) as Team[]).find(item => Number(item.team_number) === teamNumber) ?? null;
      if (!selected) setError('This Team Work workspace is unavailable for your Worker account.');
      setTeam(selected); setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [teamNumber]);

  const viewTitle = isFinance ? 'Team Finance' : isSettings ? 'Team Settings' : `${team?.team_name ?? 'Team'} Dashboard`;
  const subtitle = isFinance
    ? 'Team-level finance foundation. Personal finance data is never shown here.'
    : isSettings
      ? 'Team-level settings foundation. Personal account settings stay separate.'
      : 'Dedicated Team Dashboard. Personal My Work stays outside this workspace.';
  const teamInitials = useMemo(() => initials(team?.team_name ?? 'Team'), [team?.team_name]);

  if (loading) return <main className="team-dashboard-page"><div className="td-state"><strong>Opening Team Dashboard…</strong><p>Checking your approved membership for this team.</p></div></main>;
  if (error || !team) return <main className="team-dashboard-page"><div className="td-state td-error"><strong>Team Dashboard unavailable</strong><p>{error || 'This team could not be opened.'}</p><button type="button" onClick={() => navigate('/work/team-work')}>← Back to My Teams</button></div></main>;

  return (
    <main className="team-dashboard-page">
      <style>{`
        .team-dashboard-page{min-height:calc(100dvh - 82px);padding:14px 12px 112px;box-sizing:border-box;background:radial-gradient(circle at 8% 0,rgba(99,102,241,.14),transparent 31%),radial-gradient(circle at 94% 12%,rgba(20,184,166,.12),transparent 30%),linear-gradient(180deg,#f8fafc,#f3f6fb);color:#172033}
        .td-shell{width:min(940px,100%);margin:0 auto}.td-top{display:flex;align-items:center;gap:9px;margin-bottom:12px}.td-back{width:40px;height:40px;border:1px solid rgba(255,255,255,.95);border-radius:13px;background:linear-gradient(145deg,#fff,#edf2ff);color:#334155;font-size:22px;font-weight:950;cursor:pointer;box-shadow:0 8px 18px rgba(15,23,42,.09),inset 0 1px 0 #fff}.td-kicker{display:inline-flex;padding:5px 9px;border:1px solid rgba(99,102,241,.16);border-radius:999px;background:linear-gradient(145deg,#eef2ff,#ecfdf5);color:#4f46e5;font-size:8px;font-weight:950;letter-spacing:.16em}.td-title{margin:6px 0 0;font-size:clamp(27px,7vw,42px);line-height:.98;letter-spacing:-.055em;font-weight:950;color:#111827}.td-hero{position:relative;overflow:hidden;margin-bottom:13px;padding:18px;border:1px solid rgba(255,255,255,.94);border-radius:23px;background:linear-gradient(145deg,rgba(255,255,255,.99),rgba(241,245,255,.96) 54%,rgba(236,253,245,.94));box-shadow:0 20px 45px rgba(15,23,42,.11),inset 0 1px 0 #fff}.td-hero:after{content:'';position:absolute;right:-80px;top:-100px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,.17),rgba(20,184,166,.07) 57%,transparent 72%);pointer-events:none}.td-identity{position:relative;display:flex;align-items:center;gap:12px}.td-avatar{width:54px;height:54px;display:grid;place-items:center;overflow:hidden;flex:0 0 54px;border:1px solid rgba(99,102,241,.16);border-radius:17px;background:linear-gradient(145deg,#e0e7ff,#d1fae5);color:#4f46e5;font-size:15px;font-weight:950;box-shadow:0 8px 17px rgba(15,23,42,.09),inset 0 1px 0 #fff}.td-avatar img{width:100%;height:100%;object-fit:cover}.td-name{margin:0;font-size:20px;line-height:1.1;font-weight:950;letter-spacing:-.03em}.td-meta{margin-top:5px;color:#4f46e5;font-size:8px;font-weight:950;letter-spacing:.08em}.td-purpose{position:relative;margin:13px 0 0;color:#64748b;font-size:11px;line-height:1.5}.td-owner{position:relative;margin-top:10px;padding-top:10px;border-top:1px solid rgba(100,116,139,.11);color:#64748b;font-size:9px}.td-owner strong{color:#334155}.td-panel{padding:18px;border:1px solid rgba(255,255,255,.94);border-radius:20px;background:linear-gradient(145deg,rgba(255,255,255,.99),rgba(248,250,252,.96));box-shadow:0 14px 28px rgba(15,23,42,.08),inset 0 1px 0 #fff}.td-panel h2{margin:0;font-size:19px;letter-spacing:-.03em}.td-panel p{margin:7px 0 0;color:#64748b;font-size:11px;line-height:1.55}.td-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}.td-card{padding:14px;border:1px solid rgba(99,102,241,.12);border-radius:15px;background:linear-gradient(145deg,#fff,#f7f9fc);box-shadow:0 8px 16px rgba(15,23,42,.055),inset 0 1px 0 #fff}.td-card span{display:block;color:#94a3b8;font-size:8px;font-weight:950;letter-spacing:.1em;text-transform:uppercase}.td-card strong{display:block;margin-top:6px;color:#334155;font-size:12px}.td-empty{margin-top:14px;padding:14px;border:1px dashed rgba(99,102,241,.22);border-radius:15px;background:rgba(238,242,255,.42);color:#64748b;font-size:10px;line-height:1.5}.td-personal-back{width:100%;margin-top:14px;min-height:44px;border:1px solid rgba(79,70,229,.16);border-radius:13px;background:linear-gradient(145deg,#eef2ff,#fff);color:#4338ca;font:inherit;font-size:10px;font-weight:950;cursor:pointer;box-shadow:0 8px 16px rgba(79,70,229,.08),inset 0 1px 0 #fff}.td-state{width:min(700px,100%);margin:20vh auto 0;padding:22px;text-align:center;border:1px solid rgba(255,255,255,.94);border-radius:20px;background:rgba(255,255,255,.94);box-shadow:0 16px 35px rgba(15,23,42,.1)}.td-state strong{font-size:15px}.td-state p{margin:7px 0;color:#64748b;font-size:10px;line-height:1.5}.td-state button{margin-top:8px;min-height:38px;padding:0 13px;border:0;border-radius:11px;background:#4f46e5;color:#fff;font:inherit;font-size:10px;font-weight:900;cursor:pointer}.td-error strong{color:#b91c1c}@media(max-width:500px){.td-grid{grid-template-columns:1fr}.td-hero{padding:15px}.td-panel{padding:15px}}
      `}</style>
      <div className="td-shell">
        <div className="td-top"><button className="td-back" type="button" onClick={() => navigate('/work/team-work')} aria-label="Back to My Teams">‹</button><div><div className="td-kicker">TEAM DASHBOARD · {team.team_number}</div><h1 className="td-title">{viewTitle}</h1></div></div>
        <section className="td-hero"><div className="td-identity"><div className="td-avatar">{team.leader_avatar_url ? <img src={team.leader_avatar_url} alt="Team owner"/> : teamInitials}</div><div><h2 className="td-name">{team.team_name}</h2><div className="td-meta">TEAM ID · {team.team_number} · APPROVED MEMBER</div></div></div><p className="td-purpose">{subtitle}</p><div className="td-owner">Team Owner · <strong>{team.leader_display_name || team.leader_username || 'Work Social Contractor'}</strong></div></section>
        <section className="td-panel">
          <h2>{viewTitle}</h2>
          <p>{isFinance ? 'Team Finance is a separate context. It will receive Team Finance data only; personal finance records remain outside this workspace.' : isSettings ? 'Team Settings is a separate context for this team. Personal account settings remain outside this workspace.' : 'This is the dedicated Team Dashboard. Personal My Work data is not displayed or queried into this workspace.'}</p>
          <div className="td-grid">
            <div className="td-card"><span>Workspace</span><strong>{team.team_name}</strong></div>
            <div className="td-card"><span>Access</span><strong>Approved membership</strong></div>
          </div>
          {!isFinance && !isSettings && <div className="td-empty">No personal My Work totals are shown here. Real Team Work assignments and Team totals will be attached to this Team Dashboard in the next data slice.</div>}
          {isFinance && <div className="td-empty">Team Finance foundation is ready for real team-level finance data. Nothing from Personal Finance is copied here.</div>}
          {isSettings && <div className="td-empty">Team Settings foundation is ready for team-specific controls without changing Personal Settings.</div>}
          <button type="button" className="td-personal-back" onClick={() => navigate('/work')}>← Back to Personal Workspace</button>
        </section>
      </div>
    </main>
  );
}
