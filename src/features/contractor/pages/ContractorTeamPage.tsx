import { useEffect, useState } from 'react';
import { navigate } from '../../../app/Router';
import { supabase } from '../../../lib/supabase/client';

interface Props { profileId: string; teamNumber: string; }
type Team = { team_number: number; name: string; purpose: string; created_at: string };

export function ContractorTeamPage({ profileId, teamNumber }: Props) {
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      const parsed = Number(teamNumber);
      if (!Number.isSafeInteger(parsed) || parsed < 1) {
        setError('Invalid Team ID.');
        setLoading(false);
        return;
      }
      const { data, error: queryError } = await supabase
        .from('contractor_teams')
        .select('team_number,name,purpose,created_at')
        .eq('leader_profile_id', profileId)
        .eq('team_number', parsed)
        .maybeSingle<Team>();
      if (!active) return;
      if (queryError) setError(queryError.message);
      else if (!data) setError('This team could not be found in your Contractor workspace.');
      else setTeam(data);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [profileId, teamNumber]);

  return (
    <main className="contractor-team-page">
      <style>{`.contractor-team-page{min-height:calc(100dvh - 82px);box-sizing:border-box;padding:18px 12px 104px;background:radial-gradient(circle at 10% 0,rgba(20,184,166,.12),transparent 32%),radial-gradient(circle at 90% 8%,rgba(99,102,241,.12),transparent 30%);color:#172033}.ctp-shell{width:min(760px,100%);margin:0 auto}.ctp-top{display:flex;align-items:center;gap:10px;margin-bottom:14px}.ctp-back{width:40px;height:40px;border:1px solid rgba(255,255,255,.85);border-radius:13px;background:linear-gradient(145deg,#fff,#edf5f5);box-shadow:0 8px 18px rgba(15,23,42,.08),inset 0 1px 0 #fff;color:#334155;font-size:21px;font-weight:900;cursor:pointer}.ctp-kicker{font-size:9px;letter-spacing:.17em;font-weight:950;color:#0f766e;text-transform:uppercase}.ctp-title{margin:3px 0 0;font-size:clamp(26px,7vw,38px);line-height:1;font-weight:950;letter-spacing:-.04em}.ctp-card{position:relative;overflow:hidden;padding:20px;border-radius:24px;border:1px solid rgba(255,255,255,.82);background:linear-gradient(145deg,rgba(255,255,255,.97),rgba(240,253,250,.92) 58%,rgba(239,246,255,.92));box-shadow:0 20px 50px rgba(15,23,42,.11),inset 0 1px 0 #fff}.ctp-card:before{content:'';position:absolute;right:-80px;top:-90px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,.2),rgba(20,184,166,.04) 58%,transparent 70%);pointer-events:none}.ctp-id-label{position:relative;font-size:9px;font-weight:950;letter-spacing:.15em;color:#64748b}.ctp-id{position:relative;margin:5px 0 18px;font-size:27px;font-weight:950;color:#0f766e;letter-spacing:.08em}.ctp-name{position:relative;margin:0;font-size:25px;font-weight:950;letter-spacing:-.03em}.ctp-purpose{position:relative;margin:8px 0 0;color:#64748b;font-size:12px;line-height:1.55}.ctp-role{position:relative;display:inline-flex;margin-top:15px;padding:7px 10px;border-radius:999px;background:#ecfdf5;border:1px solid rgba(5,150,105,.15);color:#047857;font-size:9px;font-weight:950;letter-spacing:.08em;text-transform:uppercase}.ctp-nav{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.ctp-nav button{min-height:46px;border:1px solid rgba(100,116,139,.15);border-radius:14px;background:linear-gradient(145deg,#fff,#f3f7f8);color:#334155;font:inherit;font-size:10px;font-weight:900;cursor:not-allowed;opacity:.72}.ctp-note{margin-top:10px;padding:11px 13px;border-radius:13px;background:rgba(255,255,255,.72);border:1px solid rgba(148,163,184,.15);color:#64748b;font-size:10px;line-height:1.5}.ctp-state{width:min(760px,100%);margin:0 auto;padding:20px;border-radius:20px;background:rgba(255,255,255,.9);border:1px solid rgba(148,163,184,.16);box-shadow:0 12px 28px rgba(15,23,42,.08)}.ctp-error{color:#b91c1c;font-size:12px}.ctp-retry{margin-top:10px;min-height:40px;padding:0 13px;border:0;border-radius:12px;background:#0f766e;color:#fff;font-weight:900;cursor:pointer}@media(max-width:420px){.ctp-nav{grid-template-columns:1fr}.ctp-card{padding:17px}}`}</style>
      <div className="ctp-shell">
        <div className="ctp-top"><button type="button" className="ctp-back" onClick={() => navigate('/work/contractor?view=dashboard')} aria-label="Back to Contractor Dashboard">‹</button><div><div className="ctp-kicker">TEAM WORKSPACE</div><h1 className="ctp-title">Team Dashboard</h1></div></div>
        {loading ? <div className="ctp-state">Loading your real team…</div> : error ? <div className="ctp-state"><div className="ctp-error">{error}</div><button type="button" className="ctp-retry" onClick={() => window.location.reload()}>Retry</button></div> : team ? <><section className="ctp-card"><div className="ctp-id-label">TEAM ID</div><div className="ctp-id">{team.team_number}</div><h2 className="ctp-name">{team.name}</h2><p className="ctp-purpose">{team.purpose}</p><span className="ctp-role">Team Leader</span></section><nav className="ctp-nav" aria-label="Team workspace sections"><button type="button" aria-disabled="true">Dashboard</button><button type="button" aria-disabled="true">Finance</button><button type="button" aria-disabled="true">Settings</button></nav><div className="ctp-note">Team workspace navigation is ready. Team Finance and Team Settings remain inactive until their dedicated phases are implemented.</div></> : null}
      </div>
    </main>
  );
}
