import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';

type Team = { team_id: number; team_number: number; team_name: string; team_purpose: string };
type TeamFinance = { total_earnings: number; received: number; balance: number; advance: number };

type Props = { teams: Team[]; personalEarnings: number; personalReceived: number };

const money = (value: number) => `PKR ${Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;

/** Worker-only Overall Finance. Never calls Contractor finance RPCs. */
export function WorkerOverallFinanceCard({ teams, personalEarnings, personalReceived }: Props) {
  const [teamFinance, setTeamFinance] = useState<TeamFinance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      setError('');
      const rows = await Promise.all(teams.map(async team => {
        const result = await supabase.rpc('get_worker_team_finance_summary', { p_team_number: team.team_number });
        if (result.error) return { error: result.error };
        const row = (result.data?.[0] ?? null) as Record<string, unknown> | null;
        if (!row) return { error: new Error('Worker Team Finance summary is unavailable.') };
        return { data: {
          total_earnings: Number(row.total_earnings || 0),
          received: Number(row.received_amount || 0),
          balance: Number(row.current_balance || 0),
          advance: Number(row.advance_amount || 0),
        }};
      }));
      if (!live) return;
      const firstError = rows.find(row => 'error' in row)?.error;
      if (firstError) {
        setError(firstError instanceof Error ? firstError.message : String(firstError));
        setTeamFinance([]);
      } else {
        setTeamFinance(rows.flatMap(row => 'data' in row && row.data ? [row.data] : []));
      }
      setLoading(false);
    })().catch(reason => {
      if (!live) return;
      setError(reason instanceof Error ? reason.message : 'Unable to load Worker Team Finance.');
      setLoading(false);
    });
    return () => { live = false; };
  }, [teams]);

  const teamEarnings = teamFinance.reduce((sum, row) => sum + row.total_earnings, 0);
  const teamReceived = teamFinance.reduce((sum, row) => sum + row.received, 0);
  const teamAdvance = teamFinance.reduce((sum, row) => sum + row.advance, 0);
  const overallEarnings = personalEarnings + teamEarnings;
  const overallReceived = personalReceived + teamReceived;
  const overallBalance = overallEarnings - overallReceived;
  const position = overallBalance < 0 ? 'RECEIVED AHEAD' : overallBalance > 0 ? 'EARNED NOT YET RECEIVED' : 'SETTLED';

  return <section className="wo-card">
    <div className="wo-eyebrow">03 · OVERALL FINANCE INTELLIGENCE</div>
    <h2>Personal + authorized team finance</h2>
    <p className="wo-muted">Worker Finance and Worker Team Finance only. Contractor finance is excluded from this intelligence layer.</p>
    {loading ? <div className="wo-empty">Loading real Worker financial data…</div> : error ? <div className="wo-error">{error}</div> : <>
      <div className="wo-fin">
        <div className="wo-finbox"><small>OVERALL EARNINGS</small><strong>{money(overallEarnings)}</strong></div>
        <span className="wo-arrow">→</span>
        <div className="wo-finbox"><small>OVERALL RECEIVED</small><strong>{money(overallReceived)}</strong></div>
        <span className="wo-arrow">→</span>
        <div className="wo-finbox"><small>POSITION</small><strong>{position}</strong></div>
      </div>
      <div className="wo-rem">Balance: <b>{money(overallBalance)}</b> · Team advance: <b>{money(teamAdvance)}</b></div>
      <div className="wo-muted" style={{ marginTop: 8 }}>Personal received keeps its existing lineage-backed Worker payment records. Team received comes only from authorized Worker Team Finance workspaces.</div>
    </>}
  </section>;
}
