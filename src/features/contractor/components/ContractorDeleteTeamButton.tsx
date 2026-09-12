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

    const { data, error: deleteError } = await supabase
      .from('contractor_teams')
      .delete()
      .eq('id', teamId)
      .select('id')
      .maybeSingle();

    if (deleteError) {
      console.error('contractor team delete failed', deleteError);
      setError('Team could not be deleted. It may have members.');
      setDeleting(false);
      return;
    }

    if (!data) {
      setError('Team could not be deleted. It may have members.');
      setDeleting(false);
      return;
    }

    setDeleting(false);
    setConfirming(false);
    onDeleted();
  };

  if (!confirming) {
    return (
      <button
        className="co5-delete-team"
        type="button"
        onClick={() => {
          setError('');
          setConfirming(true);
        }}
      >
        Delete Team
      </button>
    );
  }

  return (
    <div className="co5-delete-confirm" role="alertdialog" aria-label={`Delete ${teamName}`}>
      <div>
        <strong>Delete {teamName}?</strong>
        <span>This permanently removes the empty team.</span>
      </div>
      <div className="co5-delete-confirm-actions">
        <button type="button" onClick={() => setConfirming(false)} disabled={deleting}>
          Cancel
        </button>
        <button type="button" onClick={() => void deleteTeam()} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete Permanently'}
        </button>
      </div>
      {error ? <small>{error}</small> : null}
    </div>
  );
}
