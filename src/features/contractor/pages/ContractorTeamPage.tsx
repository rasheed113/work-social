import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../../../app/Router';
import { supabase } from '../../../lib/supabase/client';
import { ContractorTeamTrash } from '../components/ContractorTeamTrash';

interface Props { profileId: string; teamNumber: string; }
type Team = { team_number: number; name: string; purpose: string; created_at: string };
type Profile = { display_name: string | null; username: string | null; avatar_url: string | null };
type SummaryCardProps = { label: string; value: string; caption: string; icon: string };

function initials(name: string) {
  const value = name.trim();
  return value ? value.split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() : 'T';
}

function SummaryCard({ label, value, caption, icon }: SummaryCardProps) {
  return <article className="ctd-summary-card">
    <div className="ctd-card-icon" aria-hidden="true">{icon}</div>
    <div className="ctd-card-label">{label}</div>
    <div className="ctd-card-value">{value}</div>
    <div className="ctd-card-caption">{caption}</div>
  </article>;
}

export function ContractorTeamPage({ profileId, teamNumber }: Props) {
  const [team, setTeam] = useState<Team | null>(null);
  const [leader, setLeader] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [membersOpen, setMembersOpen] = useState(false);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const parsedTeamNumber = useMemo(() => Number(teamNumber), [teamNumber]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setError('');
      if (!Number.isSafeInteger(parsedTeamNumber) || parsedTeamNumber < 100001) {
        setError('Invalid Team ID.'); setLoading(false); return;
      }
      const { data, error: queryError } = await supabase.from('contractor_teams')
        .select('team_number,name,purpose,created_at').eq('leader_profile_id', profileId)
        .eq('team_number', parsedTeamNumber).maybeSingle<Team>();
      if (!active) return;
      if (queryError) { setError(queryError.message); setLoading(false); return; }
      if (!data) { setError('This team could not be found in your Contractor workspace.'); setLoading(false); return; }
      setTeam(data);
      const { data: leaderData } = await supabase.from('profiles')
        .select('display_name,username,avatar_url').eq('id', profileId).maybeSingle<Profile>();
      if (active) setLeader(leaderData ?? null);
      setLoading(false);
    };
    void load(); return () => { active = false; };
  }, [parsedTeamNumber, profileId]);

  return <main className="contractor-team-page">
    <style>{`
      .contractor-team-page{min-height:calc(100dvh - 82px);box-sizing:border-box;padding:14px 12px 104px;background:radial-gradient(circle at 8% 0,rgba(16,185,129,.16),transparent 30%),radial-gradient(circle at 94% 8%,rgba(99,102,241,.14),transparent 29%),linear-gradient(180deg,#f8fffd,#f5f8ff);color:#172033}
      .ctd-shell{width:min(760px,100%);margin:0 auto}
      .ctd-top{display:flex;align-items:center;gap:9px;margin-bottom:11px;padding:5px 3px}
      .ctd-back{width:38px;height:38px;flex:0 0 auto;border:1px solid rgba(255,255,255,.92);border-radius:13px;background:linear-gradient(145deg,#fff,#e9f5f2);box-shadow:0 8px 18px rgba(15,23,42,.09),inset 0 1px 0 #fff;color:#334155;font-size:21px;font-weight:950;cursor:pointer}
      .ctd-kicker{display:inline-flex;padding:5px 9px;border-radius:999px;border:1px solid rgba(16,185,129,.18);background:linear-gradient(145deg,rgba(236,253,245,.96),rgba(219,234,254,.86));box-shadow:inset 0 1px 0 #fff,0 5px 13px rgba(15,23,42,.06);font-size:8px;letter-spacing:.17em;font-weight:950;color:#047857;text-transform:uppercase}
      .ctd-title{margin:6px 0 0;font-size:clamp(24px,6.5vw,34px);line-height:.98;font-weight:950;letter-spacing:-.05em;text-shadow:0 2px 0 rgba(255,255,255,.9),0 9px 24px rgba(15,23,42,.08)}
      .ctd-hero{position:relative;overflow:hidden;padding:17px;border-radius:24px;border:1px solid rgba(255,255,255,.9);background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(236,253,245,.94) 54%,rgba(239,246,255,.95));box-shadow:0 20px 48px rgba(15,23,42,.12),inset 0 1px 0 #fff}
      .ctd-hero:before{content:'';position:absolute;width:190px;height:190px;right:-75px;top:-100px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,.2),rgba(20,184,166,.05) 58%,transparent 70%);pointer-events:none}
      .ctd-hero-grid{position:relative;display:flex;align-items:center;justify-content:space-between;gap:10px}
      .ctd-identity{min-width:0;display:flex;align-items:center;gap:11px}
      .ctd-avatar{width:54px;height:54px;flex:0 0 auto;border-radius:17px;display:grid;place-items:center;overflow:hidden;background:linear-gradient(145deg,#d1fae5,#dbeafe);color:#047857;font-size:18px;font-weight:950;box-shadow:0 9px 19px rgba(15,23,42,.09),inset 0 1px 0 #fff}
      .ctd-avatar img{width:100%;height:100%;object-fit:cover}
      .ctd-name{margin:0;font-size:clamp(20px,5.5vw,28px);line-height:1.03;font-weight:950;letter-spacing:-.04em;overflow-wrap:anywhere}
      .ctd-id-line{margin-top:5px;color:#0f766e;font-size:9px;font-weight:950;letter-spacing:.06em}
      .ctd-purpose{margin:5px 0 0;color:#64748b;font-size:10px;line-height:1.4;overflow-wrap:anywhere}
      .ctd-actions{display:flex;gap:6px;flex:0 0 auto;align-items:center}
      .ctd-action{width:40px;height:40px;border-radius:12px;border:1px solid rgba(255,255,255,.92);background:linear-gradient(145deg,#fff,#edf8f5);box-shadow:0 7px 16px rgba(15,23,42,.08),inset 0 1px 0 #fff;color:#0f766e;font-size:18px;font-weight:950;cursor:pointer}
      .ctd-add{min-height:40px;padding:0 11px;border:0;border-radius:12px;background:linear-gradient(145deg,#059669,#047857);box-shadow:0 4px 0 rgba(4,120,87,.15),0 9px 18px rgba(5,150,105,.17);color:#fff;font:inherit;font-size:10px;font-weight:950;white-space:nowrap;cursor:pointer}
      .ctd-leader{position:relative;margin-top:12px;padding-top:10px;border-top:1px solid rgba(100,116,139,.12);display:flex;align-items:center;gap:7px;color:#475569;font-size:10px;font-weight:800}
      .ctd-leader strong{color:#172033}
      .ctd-section-kicker{margin:15px 3px 7px;color:#64748b;font-size:8px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}
      .ctd-summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .ctd-summary-card{position:relative;min-height:105px;box-sizing:border-box;padding:11px 12px;border-radius:16px;border:1px solid rgba(255,255,255,.9);background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(248,250,252,.9));box-shadow:0 11px 23px rgba(15,23,42,.075),inset 0 1px 0 #fff;overflow:hidden}
      .ctd-summary-card:after{content:'';position:absolute;right:-25px;bottom:-35px;width:80px;height:80px;border-radius:50%;background:radial-gradient(circle,rgba(16,185,129,.12),transparent 68%);pointer-events:none}
      .ctd-card-icon{width:27px;height:27px;display:grid;place-items:center;border-radius:9px;background:linear-gradient(145deg,#ecfdf5,#dbeafe);color:#047857;font-size:12px;box-shadow:inset 0 1px 0 #fff}
      .ctd-card-label{margin-top:8px;color:#64748b;font-size:8px;font-weight:950;letter-spacing:.12em;text-transform:uppercase}
      .ctd-card-value{margin-top:2px;color:#172033;font-size:17px;font-weight:950;letter-spacing:-.03em}
      .ctd-card-caption{margin-top:2px;color:#94a3b8;font-size:8px;font-weight:700;line-height:1.3}
      .ctd-zero-state{margin-top:8px;padding:9px 11px;border-radius:12px;border:1px solid rgba(16,185,129,.12);background:rgba(255,255,255,.7);color:#64748b;font-size:8px;line-height:1.4;text-align:center}
      .ctd-trash-folder{width:100%;margin-top:9px;min-height:58px;padding:10px 12px;display:flex;align-items:center;gap:10px;text-align:left;border:1px solid rgba(255,255,255,.92);border-radius:16px;background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(254,242,242,.94));box-shadow:0 11px 23px rgba(15,23,42,.075),inset 0 1px 0 #fff;color:#172033;cursor:pointer}
      .ctd-trash-folder span:first-child{font-size:21px}.ctd-trash-folder b{display:block;font-size:11px;font-weight:950}.ctd-trash-folder small{display:block;margin-top:2px;color:#94a3b8;font-size:8px;font-weight:750}
      .ctd-state{padding:17px;border-radius:18px;background:rgba(255,255,255,.92);border:1px solid rgba(148,163,184,.16);box-shadow:0 11px 25px rgba(15,23,42,.08)}
      .ctd-error{color:#b91c1c;font-size:11px}.ctd-retry{margin-top:9px;min-height:36px;padding:0 11px;border:0;border-radius:10px;background:#0f766e;color:#fff;font-size:10px;font-weight:900;cursor:pointer}
      .ctd-panel-backdrop{position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,.25);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);display:grid;align-items:start;justify-items:center;padding:72px 14px 20px;box-sizing:border-box}
      .ctd-panel{width:min(390px,100%);border:1px solid rgba(255,255,255,.92);border-radius:21px;background:linear-gradient(145deg,rgba(255,255,255,.99),rgba(240,253,250,.97));box-shadow:0 28px 70px rgba(15,23,42,.22),inset 0 1px 0 #fff;padding:15px}
      .ctd-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:11px}.ctd-panel-title{font-size:11px;font-weight:950;letter-spacing:.12em;color:#0f766e}.ctd-close{width:32px;height:32px;border:1px solid rgba(100,116,139,.14);border-radius:10px;background:#fff;color:#475569;font-weight:950;cursor:pointer}
      .ctd-member-empty{padding:16px 11px;border-radius:14px;background:rgba(255,255,255,.76);border:1px dashed rgba(100,116,139,.2);text-align:center;color:#64748b;font-size:10px;line-height:1.5}.ctd-add-copy{color:#64748b;font-size:10px;line-height:1.55;margin:0 0 12px}.ctd-panel-primary{width:100%;min-height:40px;border:0;border-radius:11px;background:linear-gradient(145deg,#059669,#047857);color:#fff;font:inherit;font-size:10px;font-weight:950;cursor:pointer}
      @media(max-width:480px){.ctd-hero{padding:14px}.ctd-hero-grid{align-items:flex-start}.ctd-add{font-size:9px;padding:0 9px}.ctd-action{width:38px;height:38px}.ctd-avatar{width:50px;height:50px}.ctd-summary-card{min-height:100px}}
      @media(max-width:370px){.ctd-identity{gap:8px}.ctd-avatar{width:46px;height:46px}.ctd-add{font-size:8px;padding:0 7px}.ctd-summary-grid{grid-template-columns:1fr}.ctd-summary-card{min-height:92px}}
    `}</style>
    <div className="ctd-shell">
      <div className="ctd-top"><button type="button" className="ctd-back" onClick={() => navigate('/work/contractor?view=dashboard')} aria-label="Back to Contractor Dashboard">‹</button><div><div className="ctd-kicker">TEAM WORKSPACE</div><h1 className="ctd-title">Team Dashboard</h1></div></div>
      {loading ? <div className="ctd-state"><strong>Loading Team Workspace…</strong><p style={{margin:'5px 0 0',color:'#64748b',fontSize:10}}>Loading your real team identity.</p></div> : error ? <div className="ctd-state"><div className="ctd-error">{error}</div><button type="button" className="ctd-retry" onClick={() => window.location.reload()}>Retry</button></div> : team ? <>
        <section className="ctd-hero" aria-label="Team identity">
          <div className="ctd-hero-grid"><div className="ctd-identity"><div className="ctd-avatar">{leader?.avatar_url ? <img src={leader.avatar_url} alt="Team leader"/> : initials(team.name)}</div><div style={{minWidth:0}}><h2 className="ctd-name">{team.name}</h2><div className="ctd-id-line">Team ID · {team.team_number}</div><p className="ctd-purpose">{team.purpose}</p></div></div><div className="ctd-actions"><button type="button" className="ctd-add" onClick={() => setAddMembersOpen(true)}>＋ Add Members</button><button type="button" className="ctd-action" onClick={() => setMembersOpen(true)} aria-label="Open team members">⋮</button></div></div>
          <div className="ctd-leader"><span aria-hidden="true">♛</span><span>Team Leader · <strong>{leader?.display_name || 'Current Contractor'}</strong></span></div>
        </section>
        <div className="ctd-section-kicker">TEAM WORK OVERVIEW</div>
        <section className="ctd-summary-grid" aria-label="Team work summary"><SummaryCard label="Today" value="PKR 0" caption="No member work recorded yet" icon="◷"/><SummaryCard label="Weekly" value="PKR 0" caption="No member work recorded yet" icon="▥"/><SummaryCard label="Monthly" value="PKR 0" caption="No member work recorded yet" icon="◫"/><SummaryCard label="Grand Total" value="PKR 0" caption="No member work recorded yet" icon="◆"/></section>
        <div className="ctd-zero-state">Team totals will populate from real member work entries once team-member work linkage is active. No fake totals are shown.</div>
        <button type="button" className="ctd-trash-folder" onClick={() => setTrashOpen(true)} aria-label="Open Team Work Trash"><span aria-hidden="true">🗑️</span><span><b>Trash</b><small>Deleted Team Work</small></span></button>
      </> : null}
    </div>
    {trashOpen && <ContractorTeamTrash teamNumber={parsedTeamNumber} onClose={() => setTrashOpen(false)} />}
    {membersOpen && <div className="ctd-panel-backdrop" role="presentation" onMouseDown={e => { if(e.currentTarget===e.target)setMembersOpen(false); }}><section className="ctd-panel" role="dialog" aria-modal="true" aria-label="Team members"><div className="ctd-panel-head"><div className="ctd-panel-title">MY TEAM MEMBERS</div><button type="button" className="ctd-close" onClick={() => setMembersOpen(false)}>×</button></div><div className="ctd-member-empty">No team members yet. Add Members to start building this team.</div></section></div>}
    {addMembersOpen && <div className="ctd-panel-backdrop" role="presentation" onMouseDown={e => { if(e.currentTarget===e.target)setAddMembersOpen(false); }}><section className="ctd-panel" role="dialog" aria-modal="true" aria-label="Add team members"><div className="ctd-panel-head"><div className="ctd-panel-title">ADD MEMBERS</div><button type="button" className="ctd-close" onClick={() => setAddMembersOpen(false)}>×</button></div><p className="ctd-add-copy">The member invitation and membership workflow will be connected in the Team Members phase. No fake member records are created here.</p><button type="button" className="ctd-panel-primary" onClick={() => setAddMembersOpen(false)}>Close</button></section></div>}
  </main>;
}