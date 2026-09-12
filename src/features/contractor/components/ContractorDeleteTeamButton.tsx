import { useState } from 'react';
import { supabase } from '../../../lib/supabase/client';

interface Props {
  teamId: number;
  teamName: string;
  onDeleted: () => void;
}

export function ContractorDeleteTeamButton({ teamId, teamName, onDeleted }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const deleteTeam = async () => {
    setDeleting(true);
    setError('');

    const { data, error: deleteError } = await supabase.rpc('delete_contractor_team_empty', {
      p_team_id: teamId,
    });

    if (deleteError) {
      console.error('contractor team delete failed', deleteError);
      setError('Delete could not be completed. Please try again.');
      setDeleting(false);
      return;
    }

    if (data !== true) {
      setError('This team is no longer eligible for deletion. Refresh and try again.');
      setDeleting(false);
      return;
    }

    setDeleting(false);
    setConfirming(false);
    onDeleted();
  };

  return (
    <>
      <style>{`
        .co5-delete-trigger{position:relative;display:flex;align-items:center;justify-content:center;gap:7px;min-height:39px;padding:0 13px;border:1px solid rgba(248,113,113,.22);border-radius:12px;background:linear-gradient(145deg,rgba(255,255,255,.96),rgba(254,242,242,.92));color:#b91c1c;font:inherit;font-size:8px;font-weight:950;letter-spacing:.02em;cursor:pointer;box-shadow:0 8px 18px rgba(127,29,29,.07),inset 0 1px 0 rgba(255,255,255,.95);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
        .co5-delete-trigger:hover{transform:translateY(-1px);border-color:rgba(239,68,68,.4);box-shadow:0 12px 24px rgba(127,29,29,.12),inset 0 1px 0 rgba(255,255,255,1)}
        .co5-delete-trigger:active{transform:translateY(0)}
        .co5-delete-trigger-mark{width:17px;height:17px;display:grid;place-items:center;border-radius:6px;background:linear-gradient(145deg,#fee2e2,#fecaca);color:#dc2626;font-size:9px;box-shadow:inset 0 1px 0 rgba(255,255,255,.9)}
        .co5-delete-overlay{position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.36);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);animation:co5-delete-fade .16s ease-out}
        .co5-delete-modal{width:min(390px,100%);position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.88);border-radius:24px;padding:18px;background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(248,250,252,.96));box-shadow:0 32px 80px rgba(15,23,42,.28),inset 0 1px 0 rgba(255,255,255,1);animation:co5-delete-pop .2s cubic-bezier(.2,.8,.2,1)}
        .co5-delete-modal:before{content:"";position:absolute;inset:-45% 25% auto -20%;height:170px;background:radial-gradient(circle,rgba(239,68,68,.13),transparent 66%);pointer-events:none}
        .co5-delete-modal-top{position:relative;display:flex;gap:11px;align-items:center}
        .co5-delete-modal-icon{width:42px;height:42px;display:grid;place-items:center;flex:0 0 42px;border-radius:14px;background:linear-gradient(145deg,#fff1f2,#fee2e2);border:1px solid rgba(248,113,113,.2);color:#dc2626;box-shadow:0 10px 20px rgba(239,68,68,.1),inset 0 1px 0 rgba(255,255,255,1);font-size:18px;font-weight:950}
        .co5-delete-modal-kicker{display:block;color:#b91c1c;font-size:7px;font-weight:950;letter-spacing:.16em}
        .co5-delete-modal-title{display:block;margin-top:3px;color:#172033;font-size:16px;font-weight:950;letter-spacing:-.025em}
        .co5-delete-modal-copy{position:relative;margin:14px 2px 0;color:#64748b;font-size:9px;line-height:1.55}
        .co5-delete-modal-copy strong{color:#334155}
        .co5-delete-modal-actions{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:17px}
        .co5-delete-modal-actions button{min-height:42px;border-radius:12px;font:inherit;font-size:8px;font-weight:950;cursor:pointer}
        .co5-delete-cancel{border:1px solid #e2e8f0;background:linear-gradient(145deg,#fff,#f1f5f9);color:#475569;box-shadow:0 7px 16px rgba(15,23,42,.06)}
        .co5-delete-confirm-btn{border:1px solid rgba(220,38,38,.2);background:linear-gradient(135deg,#ef4444,#dc2626 58%,#be123c);color:#fff;box-shadow:0 12px 24px rgba(220,38,38,.22),inset 0 1px 0 rgba(255,255,255,.2)}
        .co5-delete-confirm-btn:disabled,.co5-delete-cancel:disabled{opacity:.55;cursor:not-allowed}
        .co5-delete-error{position:relative;margin-top:9px;padding:9px 10px;border:1px solid rgba(239,68,68,.16);border-radius:10px;background:#fff1f2;color:#b91c1c;font-size:8px;font-weight:800;line-height:1.4}
        @keyframes co5-delete-fade{from{opacity:0}to{opacity:1}}
        @keyframes co5-delete-pop{from{opacity:0;transform:translateY(7px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
        @media(max-width:520px){.co5-delete-modal{border-radius:22px;padding:16px}.co5-delete-modal-actions{grid-template-columns:1fr}}
        @media(prefers-reduced-motion:reduce){.co5-delete-overlay,.co5-delete-modal{animation:none}.co5-delete-trigger{transition:none}}
      `}</style>

      <button
        className="co5-delete-trigger"
        type="button"
        onClick={() => {
          setError('');
          setConfirming(true);
        }}
        aria-label={`Delete ${teamName}`}
      >
        <span className="co5-delete-trigger-mark">×</span>
        Delete
      </button>

      {confirming ? (
        <div className="co5-delete-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setConfirming(false); }}>
          <div className="co5-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="co5-delete-title" aria-describedby="co5-delete-copy">
            <div className="co5-delete-modal-top">
              <div className="co5-delete-modal-icon">×</div>
              <div>
                <span className="co5-delete-modal-kicker">PERMANENT ACTION</span>
                <strong className="co5-delete-modal-title" id="co5-delete-title">Delete {teamName}?</strong>
              </div>
            </div>
            <p className="co5-delete-modal-copy" id="co5-delete-copy">
              This permanently removes the empty team. <strong>No worker membership or taken work is attached to it.</strong>
            </p>
            <div className="co5-delete-modal-actions">
              <button className="co5-delete-cancel" type="button" onClick={() => setConfirming(false)} disabled={deleting}>Keep Team</button>
              <button className="co5-delete-confirm-btn" type="button" onClick={() => void deleteTeam()} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete Permanently'}
              </button>
            </div>
            {error ? <div className="co5-delete-error" role="alert">{error}</div> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
