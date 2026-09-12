import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';

interface Props { profileId: string; }

export function ContractorCreateTeamWorkflow({ profileId }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [createdId, setCreatedId] = useState<number | null>(null);
  const wiredButtonRef = useRef<HTMLButtonElement | null>(null);
  const handlerRef = useRef<((event: MouseEvent) => void) | null>(null);

  useEffect(() => {
    const openWorkflow = () => {
      setError('');
      setCreatedId(null);
      setOpen(true);
    };

    window.addEventListener('work-social:create-team', openWorkflow);

    const wire = () => {
      const button = document.querySelector<HTMLButtonElement>('.contractor-dashboard .cd-actions > button:first-child');
      if (!button || wiredButtonRef.current === button) return;
      if (wiredButtonRef.current && handlerRef.current) wiredButtonRef.current.removeEventListener('click', handlerRef.current, true);
      wiredButtonRef.current = button;
      button.textContent = '＋ Create a Team';
      button.className = 'cd-btn cd-btn-primary cd-create-team-trigger';
      const handler = (event: MouseEvent) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        openWorkflow();
      };
      handlerRef.current = handler;
      button.addEventListener('click', handler, true);
    };

    wire();
    const observer = new MutationObserver(wire);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('work-social:create-team', openWorkflow);
      if (wiredButtonRef.current && handlerRef.current) wiredButtonRef.current.removeEventListener('click', handlerRef.current, true);
    };
  }, []);

  const reset = () => { setOpen(false); setName(''); setPurpose(''); setError(''); setCreatedId(null); };

  const createTeam = async () => {
    const trimmedName = name.trim();
    const trimmedPurpose = purpose.trim();
    if (!trimmedName || !trimmedPurpose) { setError('Team Name and Team Purpose are required.'); return; }
    setCreating(true); setError('');
    const { data, error: insertError } = await supabase.from('contractor_teams').insert({ leader_profile_id: profileId, name: trimmedName, purpose: trimmedPurpose }).select('team_number').single();
    setCreating(false);
    if (insertError) { setError(insertError.message || 'Unable to create team.'); return; }
    setCreatedId(data.team_number);
  };

  const copyTeamId = async () => { if (createdId !== null) await navigator.clipboard.writeText(String(createdId)); };
  if (!open) return null;

  return (
    <div className="ctw-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) reset(); }}>
      <div className="ctw-modal" role="dialog" aria-modal="true" aria-labelledby="ctw-title">
        <div className="ctw-orb" aria-hidden="true" />
        <div className="ctw-kicker">CONTRACTOR WORKSPACE</div>
        {createdId === null ? <>
          <div className="ctw-title-row"><div><h2 id="ctw-title">Create a Team</h2><p>Build a dedicated team for your work operations.</p></div><button className="ctw-close" type="button" onClick={reset} aria-label="Close">×</button></div>
          <label className="ctw-label">Team Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Stitching Machine Operators" maxLength={160} autoFocus /></label>
          <label className="ctw-label">Team Purpose<textarea value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="e.g. Manage daily stitching machine operators and production work." maxLength={1000} rows={4} /></label>
          {error && <div className="ctw-error">{error}</div>}
          <button className="ctw-create" type="button" onClick={createTeam} disabled={creating}>{creating ? 'Creating Team…' : 'Create Team'}</button>
        </> : <div className="ctw-success"><div className="ctw-success-icon">✓</div><h2>Team created successfully</h2><p>You are the Team Leader. Your unique numeric Team ID is ready.</p><div className="ctw-id-label">Team ID</div><div className="ctw-id">{createdId}</div><button className="ctw-copy" type="button" onClick={copyTeamId}>Copy Team ID</button><button className="ctw-done" type="button" onClick={reset}>Done</button></div>}
      </div>
      <style>{`.ctw-overlay{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:24px;background:rgba(3,7,18,.66);backdrop-filter:blur(18px);animation:ctwFade .18s ease-out}.ctw-modal{position:relative;width:min(520px,100%);overflow:hidden;border:1px solid rgba(255,255,255,.16);border-radius:30px;padding:34px;background:linear-gradient(145deg,rgba(25,31,52,.97),rgba(9,13,27,.98));box-shadow:0 30px 90px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.1);animation:ctwIn .28s cubic-bezier(.2,.8,.2,1)}.ctw-modal:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 80% 0,rgba(99,102,241,.22),transparent 38%),radial-gradient(circle at 0 100%,rgba(20,184,166,.12),transparent 40%);pointer-events:none}.ctw-orb{position:absolute;right:-50px;top:-70px;width:180px;height:180px;border-radius:50%;background:linear-gradient(145deg,rgba(129,140,248,.65),rgba(45,212,191,.12));filter:blur(1px);box-shadow:-20px 20px 60px rgba(99,102,241,.22),inset 12px 12px 25px rgba(255,255,255,.16);transform:rotate(18deg)}.ctw-kicker,.ctw-title-row,.ctw-label,.ctw-error,.ctw-create,.ctw-success{position:relative;z-index:1}.ctw-kicker{font-size:10px;letter-spacing:.2em;font-weight:800;color:#a5b4fc;margin-bottom:14px}.ctw-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:28px}.ctw-title-row h2,.ctw-success h2{margin:0;color:#fff;font-size:28px;line-height:1.1;letter-spacing:-.03em}.ctw-title-row p,.ctw-success p{margin:9px 0 0;color:#aab2c5;font-size:14px;line-height:1.5}.ctw-close{width:38px;height:38px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.06);color:#dbe2f0;font-size:24px;cursor:pointer}.ctw-label{display:grid;gap:9px;margin-bottom:18px;color:#dfe5f2;font-size:12px;font-weight:800;letter-spacing:.04em}.ctw-label input,.ctw-label textarea{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.1);border-radius:16px;outline:none;padding:14px 15px;color:#fff;background:rgba(255,255,255,.055);box-shadow:inset 0 1px 0 rgba(255,255,255,.04);font:inherit;font-size:14px;resize:vertical;transition:.2s}.ctw-label input:focus,.ctw-label textarea:focus{border-color:rgba(129,140,248,.7);box-shadow:0 0 0 4px rgba(99,102,241,.12),inset 0 1px 0 rgba(255,255,255,.06)}.ctw-label input::placeholder,.ctw-label textarea::placeholder{color:#68738b}.ctw-error{margin:-4px 0 16px;padding:11px 13px;border-radius:13px;background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.2);color:#fca5a5;font-size:12px}.ctw-create{width:100%;border:0;border-radius:17px;padding:15px;color:#fff;font-weight:900;font-size:14px;cursor:pointer;background:linear-gradient(135deg,#6366f1,#14b8a6);box-shadow:0 14px 35px rgba(79,70,229,.3),inset 0 1px 0 rgba(255,255,255,.22);transition:.2s}.ctw-create:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 18px 40px rgba(79,70,229,.38),inset 0 1px 0 rgba(255,255,255,.22)}.ctw-create:disabled{opacity:.65;cursor:wait}.ctw-success{text-align:center;padding:12px 4px 4px}.ctw-success-icon{display:grid;place-items:center;width:72px;height:72px;margin:4px auto 20px;border-radius:24px;color:#fff;font-size:36px;font-weight:900;background:linear-gradient(145deg,#14b8a6,#6366f1);box-shadow:0 18px 45px rgba(20,184,166,.25),inset 0 1px 0 rgba(255,255,255,.25)}.ctw-id-label{margin-top:27px;color:#7f8ba3;font-size:10px;letter-spacing:.2em;font-weight:900}.ctw-id{margin:8px 0 17px;color:#fff;font-size:32px;font-weight:950;letter-spacing:.08em;text-shadow:0 5px 25px rgba(129,140,248,.35)}.ctw-copy,.ctw-done{width:100%;border-radius:15px;padding:13px;font-weight:900;cursor:pointer}.ctw-copy{border:1px solid rgba(129,140,248,.35);color:#c7d2fe;background:rgba(99,102,241,.12);margin-bottom:10px}.ctw-done{border:0;color:#fff;background:rgba(255,255,255,.08)}@keyframes ctwFade{from{opacity:0}to{opacity:1}}@keyframes ctwIn{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
