import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../../../app/Router';
import { supabase } from '../../../lib/supabase/client';

interface Props { profileId: string; teamNumber: string; }
type Team = { team_number: number; name: string; purpose: string; created_at: string };

type Profile = { display_name: string | null; username: string | null; avatar_url: string | null };

type SummaryCardProps = { label: string; value: string; caption: string; icon: string };

function initials(name: string) {
  const value = name.trim();
  return value ? value.split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() : 'T';
}

function SummaryCard({ label, value, caption, icon }: SummaryCardProps) {
  return (
    <article className="ctd-summary-card">
      <div className="ctd-card-icon" aria-hidden="true">{icon}</div>
      <div className="ctd-card-label">{label}</div>
      <div className="ctd-card-value">{value}</div>
      <div className="ctd-card-caption">{caption}</div>
    </article>
  );
}

export function ContractorTeamPage({ profileId, teamNumber }: Props) {
  const [team, setTeam] = useState<Team | null>(null);
  const [leader, setLeader] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [membersOpen, setMembersOpen] = useState(false);
  const [addMembersOpen, setAddMembersOpen] = useState(false);

  const parsedTeamNumber = useMemo(() => Number(teamNumber), [teamNumber]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      if (!Number.isSafeInteger(parsedTeamNumber) || parsedTeamNumber < 100001) {
        setError('Invalid Team ID.');
        setLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from('contractor_teams')
        .select('team_number,name,purpose,created_at')
        .eq('leader_profile_id', profileId)
        .eq('team_number', parsedTeamNumber)
        .maybeSingle<Team>();

      if (!active) return;
      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }
      if (!data) {
        setError('This team could not be found in your Contractor workspace.');
        setLoading(false);
        return;
      }

      setTeam(data);
      const { data: leaderData } = await supabase
        .from('profiles')
        .select('display_name,username,avatar_url')
        .eq('id', profileId)
        .maybeSingle<Profile>();
      if (active) setLeader(leaderData ?? null);
      setLoading(false);
    };

    void load();
    return () => { active = false; };
  }, [parsedTeamNumber, profileId]);

  return (
    <main className="contractor-team-page">
      <style>{`
        .contractor-team-page{min-height:calc(100dvh - 82px);box-sizing:border-box;padding:18px 12px 104px;background:radial-gradient(circle at 7% 0,rgba(16,185,129,.16),transparent 31%),radial-gradient(circle at 95% 10%,rgba(99,102,241,.16),transparent 30%),linear-gradient(180deg,#f8fffd 0%,#f5f8ff 100%);color:#172033}
        .ctd-shell{width:min(760px,100%);margin:0 auto}
        .ctd-top{display:flex;align-items:center;gap:10px;margin-bottom:14px}
        .ctd-back{width:42px;height:42px;flex:0 0 auto;border:1px solid rgba(255,255,255,.9);border-radius:14px;background:linear-gradient(145deg,#fff,#eaf5f3);box-shadow:0 9px 20px rgba(15,23,42,.09),inset 0 1px 0 #fff;color:#334155;font-size:22px;font-weight:950;cursor:pointer}
        .ctd-kicker{font-size:9px;letter-spacing:.18em;font-weight:950;color:#0f766e;text-transform:uppercase}
        .ctd-title{margin:3px 0 0;font-size:clamp(25px,7vw,37px);line-height:1;font-weight:950;letter-spacing:-.045em}
        .ctd-hero{position:relative;overflow:hidden;padding:21px;border-radius:28px;border:1px solid rgba(255,255,255,.86);background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(236,253,245,.94) 52%,rgba(239,246,255,.95));box-shadow:0 24px 60px rgba(15,23,42,.13),inset 0 1px 0 #fff}
        .ctd-hero:before{content:'';position:absolute;width:250px;height:250px;right:-105px;top:-120px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,.22),rgba(20,184,166,.05) 58%,transparent 70%);pointer-events:none}
        .ctd-hero:after{content:'';position:absolute;width:170px;height:170px;left:-95px;bottom:-105px;border-radius:50%;background:radial-gradient(circle,rgba(16,185,129,.16),transparent 68%);pointer-events:none}
        .ctd-hero-grid{position:relative;display:flex;align-items:center;justify-content:space-between;gap:14px}
        .ctd-identity{min-width:0;display:flex;align-items:center;gap:13px}
        .ctd-avatar{width:62px;height:62px;flex:0 0 auto;border-radius:20px;display:grid;place-items:center;overflow:hidden;background:linear-gradient(145deg,#d1fae5,#dbeafe);color:#047857;font-size:21px;font-weight:950;box-shadow:0 10px 22px rgba(15,23,42,.09),inset 0 1px 0 #fff}
        .ctd-avatar img{width:100%;height:100%;object-fit:cover}
        .ctd-name{margin:0;font-size:clamp(22px,6vw,31px);line-height:1.05;font-weight:950;letter-spacing:-.04em;overflow-wrap:anywhere}
        .ctd-purpose{margin:7px 0 0;color:#64748b;font-size:12px;line-height:1.5;overflow-wrap:anywhere}
        .ctd-id-line{margin-top:7px;color:#0f766e;font-size:10px;font-weight:900;letter-spacing:.06em}
        .ctd-leader{position:relative;margin-top:16px;padding-top:14px;border-top:1px solid rgba(100,116,139,.13);display:flex;align-items:center;gap:8px;color:#475569;font-size:11px;font-weight:800}
        .ctd-leader strong{color:#172033}
        .ctd-actions{display:flex;gap:8px;flex:0 0 auto}
        .ctd-action{width:44px;height:44px;border-radius:14px;border:1px solid rgba(255,255,255,.88);background:linear-gradient(145deg,#fff,#eef8f6);box-shadow:0 8px 18px rgba(15,23,42,.08),inset 0 1px 0 #fff;color:#0f766e;font-size:19px;font-weight:950;cursor:pointer}
        .ctd-add{min-height:44px;padding:0 13px;border:0;border-radius:14px;background:linear-gradient(145deg,#059669,#047857);box-shadow:0 5px 0 rgba(4,120,87,.16),0 12px 24px rgba(5,150,105,.17);color:#fff;font:inherit;font-size:11px;font-weight:950;white-space:nowrap;cursor:pointer}
        .ctd-section-kicker{margin:20px 3px 9px;color:#64748b;font-size:9px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}
        .ctd-summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
        .ctd-summary-card{position:relative;min-height:151px;box-sizing:border-box;padding:16px;border-radius:21px;border:1px solid rgba(255,255,255,.84);background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(248,250,252,.9));box-shadow:0 17px 34px rgba(15,23,42,.09),inset 0 1px 0 #fff;overflow:hidden}
        .ctd-summary-card:after{content:'';position:absolute;right:-28px;bottom:-38px;width:100px;height:100px;border-radius:50%;background:radial-gradient(circle,rgba(16,185,129,.13),transparent 68%);pointer-events:none}
        .ctd-card-icon{width:32px;height:32px;display:grid;place-items:center;border-radius:11px;background:linear-gradient(145deg,#ecfdf5,#dbeafe);color:#047857;font-size:15px;box-shadow:inset 0 1px 0 #fff}
        .ctd-card-label{margin-top:14px;color:#64748b;font-size:9px;font-weight:950;letter-spacing:.13em;text-transform:uppercase}
        .ctd-card-value{margin-top:4px;color:#172033;font-size:24px;font-weight:950;letter-spacing:-.035em}
        .ctd-card-caption{margin-top:4px;color:#94a3b8;font-size:9px;font-weight:700;line-height:1.4}
        .ctd-zero-state{margin-top:11px;padding:12px 13px;border-radius:15px;border:1px solid rgba(16,185,129,.12);background:rgba(255,255,255,.72);color:#64748b;font-size:10px;line-height:1.5;text-align:center}
        .ctd-panel-backdrop{position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,.25);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);display:grid;align-items:start;justify-items:center;padding:80px 14px 20px;box-sizing:border-box}
        .ctd-panel{width:min(390px,100%);border:1px solid rgba(255,255,255,.9);border-radius:23px;background:linear-gradient(145deg,rgba(255,255,255,.99),rgba(240,253,250,.97));box-shadow:0 30px 80px rgba(15,23,42,.22),inset 0 1px 0 #fff;padding:17px}
        .ctd-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:13px}
        .ctd-panel-title{font-size:13px;font-weight:950;letter-spacing:.12em;color:#0f766e}
        .ctd-close{width:34px;height:34px;border:1px solid rgba(100,116,139,.14);border-radius:11px;background:#fff;color:#475569;font-weight:950;cursor:pointer}
        .ctd-member-empty{padding:18px 12px;border-radius:16px;background:rgba(255,255,255,.76);border:1px dashed rgba(100,116,139,.2);text-align:center;color:#64748b;font-size:11px;line-height:1.55}
        .ctd-add-copy{color:#64748b;font-size:11px;line-height:1.6;margin:0 0 14px}
        .ctd-panel-primary{width:100%;min-height:44px;border:0;border-radius:13px;background:linear-gradient(145deg,#059669,#047857);color:#fff;font:inherit;font-weight:950;cursor:pointer}
        .ctd-state{width:min(760px,100%);margin:0 auto;padding:20px;border-radius:20px;background:rgba(255,255,255,.92);border:1px solid rgba(148,163,184,.16);box-shadow:0 12px 28px rgba(15,23,42,.08)}
        .ctd-error{color:#b91c1c;font-size:12px}
        .ctd-retry{margin-top:10px;min-height:40px;padding:0 13px;border:0;border-radius:12px;background:#0f766e;color:#fff;font-weight:900;cursor:pointer}
        @media(max-width:520px){.ctd-hero-grid{align-items:flex-start}.ctd-actions{flex-direction:column}.ctd-add{padding:0 11px}.ctd-action{width:42px;height:42px}.ctd-summary-card{min-height:145px}}
        @media(max-width:370px){.ctd-identity{gap:9px}.ctd-avatar{width:52px;height:52px;border-radius:17px}.ctd-add{font-size:10px;padding:0 9px}.ctd-summary-grid{grid-template-columns:1fr}.ctd-summary-card{min-height:132px}}
      `}</style>

      <div className="ctd-shell">
        <div className="ctd-top">
          <button type="button" className="ctd-back" onClick={() => navigate('/work/contractor?view=dashboard')} aria-label="Back to Contractor Dashboard">‹</button>
          <div>
            <div className="ctd-kicker">TEAM WORKSPACE</div>
            <h1 className="ctd-title">Team Dashboard</h1>
          </div>
        </div>

        {loading ? (
          <div className="ctd-state"><strong>Loading Team Workspace…</strong><p style={{margin:'6px 0 0',color:'#64748b',fontSize:12}}>Loading your real team identity.</p></div>
        ) : error ? (
          <div className="ctd-state"><div className="ctd-error">{error}</div><button type="button" className="ctd-retry" onClick={() => window.location.reload()}>Retry</button></div>
        ) : team ? (
          <>
            <section className="ctd-hero" aria-label="Team identity">
              <div className="ctd-hero-grid">
                <div className="ctd-identity">
                  <div className="ctd-avatar">
                    {leader?.avatar_url ? <img src={leader.avatar_url} alt="Team leader"/> : initials(team.name)}
                  </div>
                  <div style={{minWidth:0}}>
                    <h2 className="ctd-name">{team.name}</h2>
                    <div className="ctd-id-line">Team ID · {team.team_number}</div>
                    <p className="ctd-purpose">{team.purpose}</p>
                  </div>
                </div>
                <div className="ctd-actions">
                  <button type="button" className="ctd-add" onClick={() => setAddMembersOpen(true)}>＋ Add Members</button>
                  <button type="button" className="ctd-action" onClick={() => setMembersOpen(true)} aria-label="Open team members">⋮</button>
                </div>
              </div>
              <div className="ctd-leader">
                <span aria-hidden="true">♛</span>
                <span>Team Leader · <strong>{leader?.display_name || 'Current Contractor'}</strong></span>
              </div>
            </section>

            <div className="ctd-section-kicker">TEAM WORK OVERVIEW</div>
            <section className="ctd-summary-grid" aria-label="Team work summary">
              <SummaryCard label="Today" value="PKR 0" caption="No member work recorded yet" icon="◷" />
              <SummaryCard label="Weekly" value="PKR 0" caption="No member work recorded yet" icon="▥" />
              <SummaryCard label="Monthly" value="PKR 0" caption="No member work recorded yet" icon="◫" />
              <SummaryCard label="Grand Total" value="PKR 0" caption="No member work recorded yet" icon="◆" />
            </section>
            <div className="ctd-zero-state">Team totals will populate from real member work entries once team-member work linkage is active. No fake totals are shown.</div>
          </>
        ) : null}
      </div>

      {membersOpen && (
        <div className="ctd-panel-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setMembersOpen(false); }}>
          <section className="ctd-panel" role="dialog" aria-modal="true" aria-labelledby="ctd-members-title">
            <div className="ctd-panel-head">
              <div id="ctd-members-title" className="ctd-panel-title">MY TEAM MEMBERS</div>
              <button type="button" className="ctd-close" onClick={() => setMembersOpen(false)} aria-label="Close team members">×</button>
            </div>
            <div className="ctd-member-empty">No team member records exist yet. Add Members is ready for the dedicated member workflow; this panel never invents member rows.</div>
          </section>
        </div>
      )}

      {addMembersOpen && (
        <div className="ctd-panel-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setAddMembersOpen(false); }}>
          <section className="ctd-panel" role="dialog" aria-modal="true" aria-labelledby="ctd-add-title">
            <div className="ctd-panel-head">
              <div id="ctd-add-title" className="ctd-panel-title">ADD MEMBERS</div>
              <button type="button" className="ctd-close" onClick={() => setAddMembersOpen(false)} aria-label="Close add members">×</button>
            </div>
            <p className="ctd-add-copy">The team dashboard is monitoring-only. Member invitation/assignment is intentionally kept for its dedicated Team Work workflow, so no fake selector or invitation record is created here.</p>
            <button type="button" className="ctd-panel-primary" onClick={() => setAddMembersOpen(false)}>Got it</button>
          </section>
        </div>
      )}
    </main>
  );
}
