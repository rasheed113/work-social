import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Props {
  profileId: string;
}

export function ContractorCreateTeamWorkflow({ profileId }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [createdId, setCreatedId] = useState<number | null>(null);
  const wiredButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const wire = () => {
      const button = document.querySelector<HTMLButtonElement>(
        '.contractor-dashboard .cd-actions > button:first-child',
      );
      if (!button || wiredButtonRef.current === button) return;

      wiredButtonRef.current = button;
      button.textContent = '＋ Create a Team';
      button.className = 'cd-btn cd-btn-primary cd-create-team-trigger';
      button.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setError('');
        setCreatedId(null);
        setOpen(true);
      };
    };

    wire();
    const observer = new MutationObserver(wire);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const close = () => {
    if (creating) return;
    setOpen(false);
    setError('');
    setCreatedId(null);
    setName('');
    setPurpose('');
  };

  const createTeam = async () => {
    const trimmedName = name.trim();
    const trimmedPurpose = purpose.trim();

    if (!trimmedName || !trimmedPurpose) {
      setError('Team Name and Team Purpose are required.');
      return;
    }

    if (trimmedName.length > 160) {
      setError('Team Name must be 160 characters or fewer.');
      return;
    }

    if (trimmedPurpose.length > 1000) {
      setError('Team Purpose must be 1000 characters or fewer.');
      return;
    }

    setCreating(true);
    setError('');

    const { data, error: insertError } = await supabase
      .from('contractor_teams')
      .insert({
        leader_profile_id: profileId,
        name: trimmedName,
        purpose: trimmedPurpose,
      })
      .select('team_number')
      .single();

    setCreating(false);

    if (insertError) {
      setError(insertError.message || 'Unable to create team.');
      return;
    }

    setCreatedId(data.team_number);
  };

  const copyTeamId = async () => {
    if (createdId === null) return;
    await navigator.clipboard?.writeText(String(createdId));
  };

  if (!open) return null;

  return (
    <div className="ctw-overlay" role="dialog" aria-modal="true" aria-labelledby="ctw-title">
      <div className="ctw-modal">
        <div className="ctw-orb" aria-hidden="true">
          <span>＋</span>
        </div>

        <button className="ctw-close" type="button" onClick={close} aria-label="Close">
          ×
        </button>

        {createdId === null ? (
          <>
            <div className="ctw-eyebrow">Contractor Team</div>
            <h2 id="ctw-title">Create a Team</h2>
            <p className="ctw-subtitle">
              Keep the purpose in your own words. This becomes searchable team context for future Work Social automation.
            </p>

            <div className="ctw-field">
              <label htmlFor="ctw-name">Team Name</label>
              <input
                id="ctw-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Stitching Machine Operators"
                maxLength={160}
                autoFocus
              />
            </div>

            <div className="ctw-field">
              <label htmlFor="ctw-purpose">Team Purpose</label>
              <textarea
                id="ctw-purpose"
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
                placeholder="Describe what this team is responsible for..."
                maxLength={1000}
                rows={4}
              />
            </div>

            {error && <div className="ctw-error">{error}</div>}

            <button className="ctw-create" type="button" onClick={createTeam} disabled={creating}>
              {creating ? 'Creating Team…' : 'Create Team'}
            </button>
          </>
        ) : (
          <div className="ctw-success">
            <div className="ctw-success-icon">✓</div>
            <div className="ctw-eyebrow">Team Created</div>
            <h2>Team created successfully ✓</h2>
            <p>Your unique Team ID has been generated. You are the Team Leader.</p>
            <div className="ctw-id-label">Team ID</div>
            <div className="ctw-id">{createdId}</div>
            <button className="ctw-copy" type="button" onClick={copyTeamId}>
              Copy Team ID
            </button>
            <button className="ctw-done" type="button" onClick={close}>
              Done
            </button>
          </div>
        )}
      </div>

      <style>{`
        .ctw-overlay{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:20px;background:rgba(8,15,25,.58);backdrop-filter:blur(16px);animation:ctwFade .18s ease-out}
        .ctw-modal{position:relative;width:min(100%,520px);overflow:hidden;border:1px solid rgba(255,255,255,.38);border-radius:30px;padding:34px 26px 26px;background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(235,247,244,.96));box-shadow:0 35px 90px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.9);animation:ctwPop .24s cubic-bezier(.2,.8,.2,1)}
        .ctw-modal:before{content:'';position:absolute;inset:-35% -20% auto;height:240px;background:radial-gradient(circle,rgba(16,185,129,.23),transparent 68%);pointer-events:none}
        .ctw-orb{position:relative;display:grid;place-items:center;width:72px;height:72px;margin:0 auto 17px;border-radius:24px;transform:rotate(-6deg);background:linear-gradient(145deg,#34d399,#047857);box-shadow:inset 8px 8px 16px rgba(255,255,255,.28),inset -10px -12px 18px rgba(0,70,45,.25),0 18px 30px rgba(4,120,87,.28)}
        .ctw-orb span{font-size:34px;font-weight:900;color:white;transform:rotate(6deg);text-shadow:0 3px 7px rgba(0,0,0,.2)}
        .ctw-close{position:absolute;right:16px;top:14px;width:38px;height:38px;border:0;border-radius:13px;background:rgba(15,23,42,.07);font-size:25px;line-height:1;color:#334155;cursor:pointer}
        .ctw-eyebrow{text-align:center;text-transform:uppercase;letter-spacing:.14em;font-size:11px;font-weight:900;color:#047857}
        .ctw-modal h2{position:relative;margin:5px 0 7px;text-align:center;font-size:27px;letter-spacing:-.04em;color:#12231f}
        .ctw-subtitle{position:relative;margin:0 auto 22px;max-width:430px;text-align:center;font-size:13px;line-height:1.55;color:#60716d}
        .ctw-field{position:relative;margin-top:14px}
        .ctw-field label{display:block;margin:0 0 7px 4px;font-size:12px;font-weight:900;color:#28423a}
        .ctw-field input,.ctw-field textarea{width:100%;box-sizing:border-box;border:1px solid rgba(71,96,88,.16);border-radius:17px;padding:13px 14px;outline:none;background:rgba(255,255,255,.78);color:#172a25;box-shadow:inset 0 2px 7px rgba(20,60,45,.05),0 7px 18px rgba(20,60,45,.04);font:inherit;transition:.18s}
        .ctw-field input:focus,.ctw-field textarea:focus{border-color:#10b981;box-shadow:0 0 0 4px rgba(16,185,129,.12),0 9px 22px rgba(4,120,87,.08)}
        .ctw-field textarea{resize:vertical;min-height:110px}
        .ctw-error{margin-top:12px;border:1px solid rgba(220,38,38,.16);border-radius:14px;padding:10px 12px;background:rgba(254,226,226,.72);color:#b91c1c;font-size:12px;font-weight:700}
        .ctw-create,.ctw-copy,.ctw-done{width:100%;border:0;border-radius:17px;padding:14px 16px;font:inherit;font-weight:900;cursor:pointer}
        .ctw-create{margin-top:18px;color:white;background:linear-gradient(135deg,#059669,#047857);box-shadow:0 14px 28px rgba(4,120,87,.25),inset 0 1px 0 rgba(255,255,255,.22)}
        .ctw-create:disabled{opacity:.62;cursor:wait}
        .ctw-success{text-align:center;padding:14px 0 4px}
        .ctw-success-icon{display:grid;place-items:center;width:68px;height:68px;margin:0 auto 14px;border-radius:22px;background:linear-gradient(145deg,#34d399,#047857);color:#fff;font-size:34px;font-weight:1000;box-shadow:0 16px 30px rgba(4,120,87,.25),inset 5px 5px 10px rgba(255,255,255,.2)}
        .ctw-success h2{margin-top:7px}
        .ctw-success p{max-width:390px;margin:0 auto 19px;color:#5c6e69;font-size:13px;line-height:1.55}
        .ctw-id-label{font-size:11px;text-transform:uppercase;letter-spacing:.14em;font-weight:900;color:#047857}
        .ctw-id{margin:7px auto 16px;width:max-content;max-width:100%;padding:10px 18px;border-radius:16px;background:rgba(4,120,87,.08);color:#075e48;font-size:30px;line-height:1;font-weight:1000;letter-spacing:.06em;box-shadow:inset 0 2px 7px rgba(4,120,87,.06)}
        .ctw-copy{color:#fff;background:linear-gradient(135deg,#0f766e,#115e59);box-shadow:0 12px 25px rgba(15,118,110,.22)}
        .ctw-done{margin-top:9px;color:#28534a;background:rgba(15,118,110,.07)}
        @keyframes ctwFade{from{opacity:0}to{opacity:1}}
        @keyframes ctwPop{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
      `}</style>
    </div>
  );
}
