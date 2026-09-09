import { useEffect, useState } from 'react';
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'T';
}

export function WorkerTeamWorkPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      const { data, error: queryError } = await supabase.rpc('get_worker_team_work_teams');
      if (!active) return;
      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }
      setTeams((data ?? []) as Team[]);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  return (
    <main className="worker-team-work" style={{ width: '100%', boxSizing: 'border-box' }}>
      <style>{`
        .worker-team-work{min-height:calc(100dvh - 82px);padding:14px 12px 108px;background:radial-gradient(circle at 8% 0,rgba(99,102,241,.15),transparent 31%),radial-gradient(circle at 94% 10%,rgba(20,184,166,.12),transparent 29%),linear-gradient(180deg,#f8fafc 0%,#f4f7fb 100%);color:#172033}
        .wtw-shell{width:min(900px,100%);margin:0 auto}
        .wtw-top{display:flex;align-items:center;gap:9px;margin-bottom:12px;padding:4px 2px}
        .wtw-back{width:39px;height:39px;flex:0 0 auto;border:1px solid rgba(255,255,255,.95);border-radius:13px;background:linear-gradient(145deg,#fff,#edf2ff);color:#334155;font-size:22px;font-weight:950;cursor:pointer;box-shadow:0 8px 18px rgba(15,23,42,.09),inset 0 1px 0 #fff}
        .wtw-kicker{display:inline-flex;padding:5px 9px;border:1px solid rgba(99,102,241,.17);border-radius:999px;background:linear-gradient(145deg,rgba(238,242,255,.98),rgba(236,253,245,.9));color:#4f46e5;font-size:8px;font-weight:950;letter-spacing:.17em;text-transform:uppercase;box-shadow:inset 0 1px 0 #fff,0 5px 12px rgba(15,23,42,.05)}
        .wtw-title{margin:6px 0 0;font-size:clamp(28px,7vw,42px);line-height:.98;letter-spacing:-.055em;font-weight:950;color:#111827;text-shadow:0 2px 0 rgba(255,255,255,.9),0 8px 20px rgba(15,23,42,.08)}
        .wtw-subtitle{margin:7px 0 0;color:#64748b;font-size:11px;line-height:1.5;max-width:650px}
        .wtw-hero{position:relative;overflow:hidden;margin-bottom:14px;padding:18px;border:1px solid rgba(255,255,255,.92);border-radius:23px;background:linear-gradient(145deg,rgba(255,255,255,.99),rgba(241,245,255,.96) 54%,rgba(236,253,245,.93));box-shadow:0 20px 45px rgba(15,23,42,.11),inset 0 1px 0 #fff}
        .wtw-hero:before{content:'';position:absolute;right:-75px;top:-95px;width:210px;height:210px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,.19),rgba(20,184,166,.07) 57%,transparent 72%);pointer-events:none}
        .wtw-hero-grid{position:relative;display:flex;align-items:center;justify-content:space-between;gap:16px}
        .wtw-hero-copy{min-width:0}.wtw-hero-title{margin:0;font-size:18px;font-weight:950;letter-spacing:-.03em}.wtw-hero-copy p{margin:5px 0 0;color:#64748b;font-size:10px;line-height:1.5}
        .wtw-count{flex:0 0 auto;min-width:64px;padding:10px 9px;text-align:center;border:1px solid rgba(99,102,241,.15);border-radius:14px;background:rgba(255,255,255,.72);box-shadow:inset 0 1px 0 #fff,0 8px 15px rgba(15,23,42,.06)}
        .wtw-count strong{display:block;font-size:20px;line-height:1;font-weight:950;color:#4f46e5}.wtw-count span{display:block;margin-top:4px;color:#64748b;font-size:7px;font-weight:950;letter-spacing:.1em;text-transform:uppercase}
        .wtw-section-label{margin:0 3px 8px;color:#64748b;font-size:8px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}
        .wtw-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
        .wtw-card{position:relative;overflow:hidden;min-width:0;padding:15px;border:1px solid rgba(255,255,255,.94);border-radius:19px;background:linear-gradient(145deg,rgba(255,255,255,.99),rgba(248,250,252,.96));box-shadow:0 13px 27px rgba(15,23,42,.075),inset 0 1px 0 #fff;transition:transform .17s ease,box-shadow .17s ease,border-color .17s ease}
        .wtw-card:before{content:'';position:absolute;right:-35px;bottom:-48px;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,.11),transparent 68%);pointer-events:none}
        .wtw-card:hover{transform:translateY(-2px);border-color:rgba(99,102,241,.2);box-shadow:0 18px 32px rgba(15,23,42,.1),inset 0 1px 0 #fff}
        .wtw-card-head{position:relative;display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.wtw-team-identity{display:flex;align-items:center;gap:9px;min-width:0}
        .wtw-avatar{width:43px;height:43px;flex:0 0 43px;display:grid;place-items:center;overflow:hidden;border:1px solid rgba(99,102,241,.14);border-radius:14px;background:linear-gradient(145deg,#e0e7ff,#d1fae5);color:#4f46e5;font-size:13px;font-weight:950;box-shadow:0 7px 14px rgba(15,23,42,.08),inset 0 1px 0 #fff}.wtw-avatar img{width:100%;height:100%;object-fit:cover}
        .wtw-team-name{margin:0;color:#172033;font-size:16px;line-height:1.15;font-weight:950;letter-spacing:-.025em;overflow-wrap:anywhere}.wtw-team-id{margin-top:4px;color:#4f46e5;font-size:8px;font-weight:950;letter-spacing:.07em}
        .wtw-status{flex:0 0 auto;padding:5px 8px;border:1px solid rgba(22,163,74,.15);border-radius:999px;background:linear-gradient(145deg,#f0fdf4,#dcfce7);color:#15803d;font-size:7px;font-weight:950;letter-spacing:.08em;text-transform:uppercase}
        .wtw-purpose{position:relative;margin:12px 0 0;color:#64748b;font-size:10px;line-height:1.5;min-height:30px}.wtw-meta{position:relative;margin-top:11px;padding-top:9px;border-top:1px solid rgba(100,116,139,.11);display:flex;justify-content:space-between;gap:8px;color:#94a3b8;font-size:8px;font-weight:750}.wtw-meta strong{color:#475569}
        .wtw-card-button{position:relative;width:100%;margin-top:11px;min-height:39px;border:1px solid rgba(79,70,229,.16);border-radius:11px;background:linear-gradient(145deg,#fff,#eef2ff);color:#4338ca;font:inherit;font-size:10px;font-weight:950;cursor:pointer;box-shadow:0 7px 13px rgba(79,70,229,.07),inset 0 1px 0 #fff;transition:transform .15s ease,box-shadow .15s ease}.wtw-card-button:hover{transform:translateY(-1px);box-shadow:0 10px 17px rgba(79,70,229,.1),inset 0 1px 0 #fff}.wtw-card-button:active{transform:translateY(1px)}
        .wtw-state{padding:20px;border:1px solid rgba(255,255,255,.94);border-radius:19px;background:rgba(255,255,255,.9);box-shadow:0 13px 27px rgba(15,23,42,.07);text-align:center}.wtw-state strong{font-size:13px}.wtw-state p{margin:6px 0 0;color:#64748b;font-size:10px;line-height:1.5}.wtw-error{color:#b91c1c;font-size:11px;font-weight:800}
        .wtw-refresh{margin-top:10px;min-height:36px;padding:0 12px;border:0;border-radius:10px;background:#4f46e5;color:#fff;font:inherit;font-size:10px;font-weight:900;cursor:pointer}
        @media(max-width:650px){.wtw-grid{grid-template-columns:1fr}}
        @media(max-width:430px){.worker-team-work{padding-left:9px;padding-right:9px}.wtw-hero{padding:15px}.wtw-hero-grid{align-items:flex-start}.wtw-count{min-width:58px}.wtw-card{padding:14px}}
      `}</style>
      <div className="wtw-shell">
        <div className="wtw-top"><button type="button" className="wtw-back" onClick={() => navigate('/work')} aria-label="Back to My Work">‹</button><div><div className="wtw-kicker">TEAM WORK</div><h1 className="wtw-title">My Teams</h1></div></div>
        <section className="wtw-hero" aria-label="Team Work introduction"><div className="wtw-hero-grid"><div className="wtw-hero-copy"><h2 className="wtw-hero-title">Approved team workspace</h2><p>Only teams where your Worker account is an active member appear here. Personal My Work totals stay separate.</p></div><div className="wtw-count" aria-label={`${teams.length} approved teams`}><strong>{teams.length}</strong><span>Teams</span></div></div></section>
        <div className="wtw-section-label">YOUR APPROVED TEAMS</div>
        {loading ? <div className="wtw-state"><strong>Loading your teams…</strong><p>Checking your real approved Team Work memberships.</p></div> : error ? <div className="wtw-state"><div className="wtw-error">{error}</div><button type="button" className="wtw-refresh" onClick={() => window.location.reload()}>Retry</button></div> : teams.length === 0 ? <div className="wtw-state"><strong>No approved teams yet</strong><p>When a Contractor invitation is accepted, that real team will appear here automatically.</p></div> : <div className="wtw-grid">{teams.map(team => <article className="wtw-card" key={team.team_id}><div className="wtw-card-head"><div className="wtw-team-identity"><div className="wtw-avatar">{team.leader_avatar_url ? <img src={team.leader_avatar_url} alt="Team owner"/> : initials(team.team_name)}</div><div style={{minWidth:0}}><h2 className="wtw-team-name">{team.team_name}</h2><div className="wtw-team-id">TEAM ID · {team.team_number}</div></div></div><span className="wtw-status">Approved</span></div><p className="wtw-purpose">{team.team_purpose}</p><div className="wtw-meta"><span>Team Owner</span><strong>{team.leader_display_name || team.leader_username || 'Work Social Contractor'}</strong></div><button type="button" className="wtw-card-button" onClick={() => navigate(`/work/team-work/${team.team_number}`)}>Open Team Work&nbsp;→</button></article>)}</div>}
      </div>
    </main>
  );
}
