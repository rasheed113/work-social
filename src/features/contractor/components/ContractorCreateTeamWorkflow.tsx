import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../lib/supabase/client';

interface Props { profileId: string; }

export function ContractorCreateTeamWorkflow({ profileId }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdId, setCreatedId] = useState<number | null>(null);
  const wiredRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const wire = () => {
      const button = document.querySelector<HTMLButtonElement>('.contractor-dashboard .cd-actions > button:first-child');
      if (!button || wiredRef.current === button) return;
      wiredRef.current = button;
      button.dataset.contractorCreateTeam = 'true';
      button.className = 'cd-btn cd-btn-primary cd-create-team-trigger';
      button.setAttribute('aria-label', 'Create a Team');
      button.textContent = '＋ Create a Team';
      button.addEventListener('click', handleOpen, true);
    };

    function handleOpen(event: Event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setError('');
      setCreatedId(null);
      setName('');
      setPurpose('');
      setOpen(true);
    }

    const observer = new MutationObserver(wire);
    observer.observe(document.body, { childList: true, subtree: true });
    wire();
    return () => {
      observer.disconnect();
      const button = wiredRef.current as HTMLButtonElement | null;
      if (button) button.removeEventListener('click', handleOpen, true);
      wiredRef.current = null;
    };
  }, []);

  const createTeam = async () => {
    const cleanName = name.trim();
    const cleanPurpose = purpose.trim();
    if (!cleanName) return setError('Please enter a team name.');
    if (!cleanPurpose) return setError('Please describe what this team is for.');
    setSaving(true);
    setError('');
    const { data, error: insertError } = await supabase
      .from('contractor_teams')
      .insert({ leader_profile_id: profileId, name: cleanName, purpose: cleanPurpose })
      .select('id')
      .single<{ id: number }>();
    setSaving(false);
    if (insertError || !data) {
      setError(insertError?.message ?? 'Team could not be created.');
      return;
    }
    setCreatedId(data.id);
  };

  const close = () => {
    if (saving) return;
    setOpen(false);
  };

  if (!open) return null;

  return createPortal(
    <div className="contractor-team-modal-overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
      <style>{`
        .contractor-team-modal-overlay{position:fixed;inset:0;z-index:1600;display:grid;place-items:center;padding:18px 12px 100px;background:rgba(15,23,42,.46);backdrop-filter:blur(12px)}
        .contractor-team-modal{width:min(100%,520px);max-height:calc(100dvh - 120px);overflow:auto;border:1px solid rgba(255,255,255,.9);border-radius:28px;padding:20px;background:linear-gradient(145deg,#ffffff,#f0fdfa 52%,#eff6ff);box-shadow:0 34px 80px rgba(15,23,42,.28),inset 0 1px 0 #fff;animation:contractorTeamIn .22s ease-out}
        @keyframes contractorTeamIn{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        .contractor-team-orb{width:54px;height:54px;border-radius:18px;display:grid;place-items:center;background:linear-gradient(145deg,#14b8a6,#0f766e 58%,#2563eb);color:#fff;font-size:25px;font-weight:950;box-shadow:0 9px 0 rgba(15,118,110,.14),0 18px 30px rgba(20,184,166,.24),inset 0 1px 0 rgba(255,255,255,.55)}
        .contractor-team-label{display:block;margin:16px 0 7px;font-size:11px;font-weight:950;color:#172033;letter-spacing:.01em}
        .contractor-team-input{width:100%;min-height:48px;box-sizing:border-box;border:1px solid rgba(100,116,139,.18);border-radius:14px;padding:12px 13px;outline:none;background:rgba(255,255,255,.9);color:#172033;font:inherit;box-shadow:inset 0 1px 0 #fff,0 5px 14px rgba(15,23,42,.045)}
        .contractor-team-input:focus{border-color:rgba(13,148,136,.45);box-shadow:0 0 0 4px rgba(20,184,166,.09),inset 0 1px 0 #fff}
        textarea.contractor-team-input{min-height:112px;resize:vertical}
        .contractor-team-create{width:100%;min-height:50px;margin-top:18px;border:0;border-radius:15px;color:#fff;background:linear-gradient(145deg,#14b8a6,#0f766e 52%,#2563eb);font:inherit;font-size:12px;font-weight:950;cursor:pointer;box-shadow:0 7px 0 rgba(15,118,110,.15),0 15px 28px rgba(20,184,166,.2),inset 0 1px 0 rgba(255,255,255,.42);transition:transform .16s ease,filter .16s ease}
        .contractor-team-create:hover{filter:brightness(1.03);transform:translateY(-1px)}
        .contractor-team-create:active{transform:translateY(3px);box-shadow:0 3px 0 rgba(15,118,110,.15),0 8px 16px rgba(20,184,166,.16)}
        .contractor-team-success{margin-top:16px;padding:15px;border-radius:17px;border:1px solid rgba(16,185,129,.2);background:linear-gradient(145deg,#ecfdf5,#eff6ff);box-shadow:inset 0 1px 0 #fff,0 10px 22px rgba(15,23,42,.06)}
        .contractor-team-id{margin-top:9px;padding:12px;border-radius:12px;background:#fff;border:1px dashed rgba(5,150,105,.24);font-size:22px;font-weight:950;color:#047857;letter-spacing:.03em;text-align:center}
        .contractor-team-copy{width:100%;min-height:42px;margin-top:9px;border:1px solid rgba(5,150,105,.2);border-radius:12px;background:#fff;color:#047857;font:inherit;font-size:11px;font-weight:950;cursor:pointer}
        .contractor-team-error{margin-top:12px;padding:10px 12px;border-radius:12px;background:#fff1f2;color:#be123c;font-size:11px;font-weight:800}
      `}</style>
      <section className="contractor-team-modal" role="dialog" aria-modal="true" aria-labelledby="contractor-team-title">
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
          <div>
            <div className="contractor-team-orb">＋</div>
            <div style={{marginTop:14,color:'#0f766e',fontSize:9,fontWeight:950,letterSpacing:'.14em',textTransform:'uppercase'}}>Contractor Team</div>
            <h2 id="contractor-team-title" style={{margin:'4px 0',fontSize:27,letterSpacing:'-.04em',color:'#172033'}}>Create a Team</h2>
            <p style={{margin:0,color:'#64748b',fontSize:11,lineHeight:1.55}}>Keep the purpose in your own words. This becomes searchable team context for future Work Social automation.</p>
          </div>
          <button type="button" onClick={close} aria-label="Close" style={{width:38,height:38,borderRadius:12,border:'1px solid rgba(100,116,139,.14)',background:'linear-gradient(145deg,#fff,#eef2f7)',color:'#475569',fontSize:18,cursor:'pointer'}}>×</button>
        </div>

        {!createdId ? <>
          <label className="contractor-team-label">Team Name
            <input className="contractor-team-input" value={name} onChange={e=>setName(e.target.value)} maxLength={160} placeholder="e.g. Stitching Machine Operators" autoFocus />
          </label>
          <label className="contractor-team-label">Team Purpose
            <textarea className="contractor-team-input" value={purpose} onChange={e=>setPurpose(e.target.value)} maxLength={1000} placeholder="What is this team for? Write it naturally…" />
          </label>
          {error&&<div className="contractor-team-error" role="alert">{error}</div>}
          <button className="contractor-team-create" type="button" disabled={saving} onClick={()=>void createTeam()}>{saving?'Creating Team…':'Create Team'}</button>
        </> : <div className="contractor-team-success" role="status">
          <div style={{fontSize:12,fontWeight:950,color:'#166534'}}>Team created successfully ✓</div>
          <div style={{marginTop:4,fontSize:10,color:'#64748b'}}>Your unique Team ID has been generated. You are the Team Leader.</div>
          <div className="contractor-team-id">{createdId}</div>
          <button className="contractor-team-copy" type="button" onClick={()=>navigator.clipboard?.writeText(String(createdId))}>Copy Team ID</button>
        </div>}
      </section>
    </div>,
    document.body,
  );
}
