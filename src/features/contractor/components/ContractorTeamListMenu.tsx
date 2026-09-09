import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { navigate } from '../../../app/Router';
import { supabase } from '../../../lib/supabase/client';

interface Props { profileId: string; }
type Team = { team_number: number; name: string; purpose: string; created_at: string };
type Anchor = { top: number; left: number; width: number };

export function ContractorTeamListMenu({ profileId }: Props) {
  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const wiredRef = useRef<HTMLButtonElement | null>(null);
  const handlerRef = useRef<((event: MouseEvent) => void) | null>(null);

  const loadTeams = async () => {
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('contractor_teams')
      .select('team_number,name,purpose,created_at')
      .eq('leader_profile_id', profileId)
      .order('created_at', { ascending: false });
    if (queryError) setError(queryError.message);
    else setTeams((data ?? []) as Team[]);
    setLoading(false);
  };

  const position = (button: HTMLButtonElement) => {
    const rect = button.getBoundingClientRect();
    const width = Math.min(360, Math.max(280, window.innerWidth - 20));
    const left = Math.max(10, Math.min(rect.right - width, window.innerWidth - width - 10));
    const height = Math.min(460, window.innerHeight - 24);
    const top = rect.bottom + 8 + height <= window.innerHeight ? rect.bottom + 8 : Math.max(10, rect.top - height - 8);
    setAnchor({ top, left, width });
  };

  useEffect(() => {
    const wire = () => {
      const actions = document.querySelector<HTMLElement>('.contractor-dashboard .cd-actions');
      const createButton = actions?.querySelector<HTMLButtonElement>('button.cd-create-team-trigger');
      if (!actions || !createButton) return;
      let button = actions.querySelector<HTMLButtonElement>('[data-contractor-team-menu-trigger="true"]');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.dataset.contractorTeamMenuTrigger = 'true';
        button.className = 'cd-btn cd-team-list-trigger';
        button.setAttribute('aria-label', 'My Teams');
        button.textContent = '⋮';
        actions.appendChild(button);
      }
      if (wiredRef.current === button) {
        if (open) position(button);
        return;
      }
      if (wiredRef.current && handlerRef.current) wiredRef.current.removeEventListener('click', handlerRef.current, true);
      wiredRef.current = button;
      buttonRef.current = button;
      const handler = (event: MouseEvent) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOpen(value => {
          const next = !value;
          if (next && button) position(button);
          return next;
        });
      };
      handlerRef.current = handler;
      button.addEventListener('click', handler, true);
    };
    wire();
    const observer = new MutationObserver(wire);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (wiredRef.current && handlerRef.current) wiredRef.current.removeEventListener('click', handlerRef.current, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void loadTeams();
    const close = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (buttonRef.current?.contains(target)) return;
      const panel = document.querySelector('[data-contractor-team-menu-panel="true"]');
      if (panel?.contains(target)) return;
      setOpen(false);
    };
    const reposition = () => { if (buttonRef.current) position(buttonRef.current); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      document.removeEventListener('keydown', key);
    };
  }, [open, profileId]);

  if (!open || !anchor) return null;

  const panel = (
    <div data-contractor-team-menu-panel="true" className="ctm-panel" style={{ top: anchor.top, left: anchor.left, width: anchor.width }} role="dialog" aria-label="My Teams">
      <div className="ctm-glow" aria-hidden="true" />
      <div className="ctm-head">
        <div><div className="ctm-kicker">CONTRACTOR WORKSPACE</div><h2>My Teams</h2><p>Choose a team to open its workspace.</p></div>
        <button type="button" className="ctm-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
      </div>
      {loading ? <div className="ctm-state"><span className="ctm-spinner" /> Loading your teams…</div> : error ? <div className="ctm-error">Unable to load teams<br /><small>{error}</small><button type="button" onClick={() => void loadTeams()}>Retry</button></div> : teams.length === 0 ? <div className="ctm-empty"><div className="ctm-empty-icon">＋</div><strong>No teams yet</strong><span>Create your first team from the Create a Team action.</span></div> : <div className="ctm-list">{teams.map((team, index) => <button key={team.team_number} type="button" className="ctm-team" onClick={() => { setOpen(false); navigate(`/work/contractor?view=team&team=${encodeURIComponent(String(team.team_number))}`); }}><span className={`ctm-avatar ctm-avatar-${index % 4}`}>{team.name.trim().charAt(0).toUpperCase() || 'T'}</span><span className="ctm-copy"><strong>{team.name}</strong><span>{team.purpose}</span><em>TEAM ID · {team.team_number}</em></span><span className="ctm-arrow">›</span></button>)}</div>}
      <button type="button" className="ctm-create" onClick={() => { setOpen(false); const trigger = document.querySelector<HTMLButtonElement>('.cd-create-team-trigger'); trigger?.click(); }}>＋ Create a Team</button>
      <style>{`.ctm-panel{position:fixed;z-index:100000;max-height:calc(100dvh - 20px);overflow:hidden;box-sizing:border-box;padding:18px;border:1px solid rgba(255,255,255,.22);border-radius:24px;background:linear-gradient(145deg,rgba(19,28,49,.98),rgba(7,12,25,.99));box-shadow:0 28px 80px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.12);color:#fff;animation:ctmIn .22s cubic-bezier(.2,.8,.2,1)}.ctm-glow{position:absolute;right:-70px;top:-90px;width:210px;height:210px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,.35),rgba(20,184,166,.08) 50%,transparent 72%);filter:blur(5px);pointer-events:none}.ctm-head{position:relative;z-index:1;display:flex;justify-content:space-between;gap:14px;margin-bottom:14px}.ctm-kicker{font-size:9px;letter-spacing:.19em;font-weight:900;color:#a5b4fc}.ctm-head h2{margin:4px 0 0;font-size:24px;letter-spacing:-.04em}.ctm-head p{margin:5px 0 0;font-size:11px;color:#94a3b8}.ctm-close{width:34px;height:34px;flex:0 0 34px;border:1px solid rgba(255,255,255,.12);border-radius:11px;background:rgba(255,255,255,.06);color:#dbeafe;font-size:22px;cursor:pointer}.ctm-list{position:relative;z-index:1;display:grid;gap:7px;max-height:310px;overflow:auto;padding-right:2px}.ctm-team{display:grid;grid-template-columns:40px minmax(0,1fr) 18px;align-items:center;gap:11px;width:100%;padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:16px;background:linear-gradient(145deg,rgba(255,255,255,.08),rgba(255,255,255,.035));color:#fff;text-align:left;cursor:pointer;transition:.18s}.ctm-team:hover{transform:translateY(-1px);border-color:rgba(129,140,248,.34);background:linear-gradient(145deg,rgba(99,102,241,.17),rgba(20,184,166,.08));box-shadow:0 9px 22px rgba(0,0,0,.2)}.ctm-avatar{display:grid;place-items:center;width:40px;height:40px;border-radius:13px;font-size:15px;font-weight:950;border:1px solid rgba(255,255,255,.16);box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 7px 15px rgba(0,0,0,.2)}.ctm-avatar-0{background:linear-gradient(145deg,#6366f1,#14b8a6)}.ctm-avatar-1{background:linear-gradient(145deg,#0ea5e9,#6366f1)}.ctm-avatar-2{background:linear-gradient(145deg,#14b8a6,#22c55e)}.ctm-avatar-3{background:linear-gradient(145deg,#f59e0b,#ef4444)}.ctm-copy{min-width:0;display:grid;gap:3px}.ctm-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:900}.ctm-copy span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:#9aa6ba}.ctm-copy em{font-style:normal;font-size:8px;font-weight:900;letter-spacing:.11em;color:#818cf8}.ctm-arrow{font-size:24px;color:#94a3b8}.ctm-create{position:relative;z-index:1;width:100%;margin-top:11px;padding:12px;border:1px solid rgba(129,140,248,.28);border-radius:14px;background:linear-gradient(135deg,rgba(99,102,241,.25),rgba(20,184,166,.18));color:#e0e7ff;font:inherit;font-size:11px;font-weight:900;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.1)}.ctm-state,.ctm-empty,.ctm-error{position:relative;z-index:1;padding:28px 12px;text-align:center;font-size:11px;color:#9aa6ba}.ctm-spinner{display:block;width:24px;height:24px;margin:0 auto 10px;border:3px solid rgba(255,255,255,.13);border-top-color:#818cf8;border-radius:50%;animation:ctmSpin .8s linear infinite}.ctm-empty{display:grid;gap:7px;place-items:center}.ctm-empty-icon{display:grid;place-items:center;width:50px;height:50px;border-radius:17px;background:rgba(99,102,241,.16);border:1px solid rgba(129,140,248,.25);font-size:25px;color:#c7d2fe}.ctm-empty strong{color:#e2e8f0}.ctm-empty span{max-width:240px;font-size:10px;line-height:1.5}.ctm-error{color:#fca5a5;background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.16);border-radius:13px}.ctm-error small{font-size:9px;overflow-wrap:anywhere}.ctm-error button{display:block;margin:10px auto 0;border:0;border-radius:10px;padding:8px 12px;background:rgba(255,255,255,.09);color:#fff;font-weight:900;cursor:pointer}@keyframes ctmIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}@keyframes ctmSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  return createPortal(panel, document.body);
}
