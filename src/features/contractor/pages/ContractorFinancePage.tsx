import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { navigate } from '../../../app/Router';

type Summary = {
  total_payable: number | string;
  total_commission: number | string;
  total_received: number | string;
  paid_against_payable: number | string;
  due: number | string;
  advance_paid: number | string;
  payment_coverage: number | string;
};

type Entry = {
  id: string;
  team_number: number | null;
  team_name: string | null;
  item_name: string;
  pieces: number | string;
  total: number | string;
  occurred_at: string;
};

type Payment = {
  id: string;
  team_number: number | null;
  team_name: string | null;
  amount: number | string;
  paid_at: string;
  note: string | null;
};

const shell = {
  width: '100%',
  maxWidth: 760,
  minHeight: '100%',
  margin: '0 auto',
  padding: '18px 12px 104px',
  boxSizing: 'border-box' as const,
  background: 'radial-gradient(circle at 8% 0%,rgba(59,130,246,.13),transparent 30%),radial-gradient(circle at 92% 12%,rgba(124,58,237,.13),transparent 28%)',
};
const card = {
  padding: 15,
  border: '1px solid rgba(255,255,255,.78)',
  borderRadius: 18,
  background: 'linear-gradient(145deg,rgba(255,255,255,.97),rgba(248,250,252,.91))',
  boxShadow: '0 18px 42px rgba(15,23,42,.10),inset 0 1px 0 rgba(255,255,255,.95)',
};

function money(value: number | string) {
  return new Intl.NumberFormat('en-PK', { maximumFractionDigits: 4 }).format(Number(value) || 0);
}
function date(value: string) {
  return new Intl.DateTimeFormat('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}
function num(value: number | string) { return Number(value) || 0; }

export function ContractorFinancePage() {
  const [profileId, setProfileId] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const user = await supabase.auth.getUser();
    const id = user.data.user?.id ?? '';
    if (user.error || !id) {
      setError(user.error?.message || 'Authenticated contractor identity is unavailable.');
      setLoading(false);
      return;
    }
    setProfileId(id);

    const [summaryResult, entriesResult, paymentsResult] = await Promise.all([
      supabase.rpc('get_contractor_stage2_finance_summary', { p_team_id: null }),
      supabase.rpc('get_contractor_stage2_finance_entries', { p_team_id: null }),
      supabase.rpc('get_contractor_stage2_finance_payments', { p_team_id: null }),
    ]);

    const firstError = summaryResult.error || entriesResult.error || paymentsResult.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }
    setSummary((summaryResult.data?.[0] as Summary | undefined) ?? null);
    setEntries((entriesResult.data as Entry[] | null) ?? []);
    setPayments((paymentsResult.data as Payment[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  if (loading) return <main style={shell}><section style={{ ...card, marginTop: 18 }}><strong>Loading Contractor Finance…</strong></section></main>;
  if (error) return <main style={shell}><section style={{ ...card, marginTop: 18 }} role="alert"><strong>Contractor Finance could not be loaded</strong><p style={{ color: '#64748b', fontSize: 12 }}>{error}</p><button type="button" onClick={() => void load()}>Retry</button></section></main>;

  const s = summary ?? { total_payable: 0, total_commission: 0, total_received: 0, paid_against_payable: 0, due: 0, advance_paid: 0, payment_coverage: 0 };
  return <main style={shell}>
    <header style={{ marginBottom: 14 }}>
      <div style={{ color: '#2563eb', fontSize: 10, fontWeight: 900, letterSpacing: '.12em' }}>CONTRACTOR FINANCE</div>
      <h1 style={{ margin: '4px 0', fontSize: 34, letterSpacing: '-.045em' }}>Finance</h1>
      <p style={{ margin: 0, color: '#64748b', fontSize: 12 }}>Company → Contractor accounting. Real entries and real payments only.</p>
    </header>

    <section style={{ ...card, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 12 }}>
      <Metric title="Payable" value={`PKR ${money(s.total_payable)}`} />
      <Metric title="Received" value={`PKR ${money(s.total_received)}`} />
      <Metric title="Due" value={`PKR ${money(s.due)}`} />
      <Metric title="Advance" value={`PKR ${money(s.advance_paid)}`} />
      <Metric title="Commission" value={`PKR ${money(s.total_commission)}`} />
      <Metric title="Coverage" value={`${money(s.payment_coverage)}%`} />
    </section>

    <section style={{ ...card, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div><strong>Payment Position</strong><div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>Paid against payable: PKR {money(s.paid_against_payable)}</div></div>
        <button type="button" onClick={() => navigate('/work/contractor?view=overview')} style={ghost}>Overview</button>
      </div>
      <div style={{ height: 9, marginTop: 12, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden' }}><div style={{ width: `${Math.min(Math.max(num(s.payment_coverage), 0), 100)}%`, height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#2563eb,#7c3aed)' }} /></div>
    </section>

    <section style={{ ...card, marginBottom: 12 }}>
      <h2 style={heading}>Recent Work</h2>
      {!entries.length ? <Empty text="No contractor work entries yet." /> : entries.slice(0, 8).map(entry => <div key={entry.id} style={row}><div><strong>{entry.item_name}</strong><div style={sub}>{entry.team_number ? `Team ${entry.team_number}` : 'Unassigned'} · {date(entry.occurred_at)}</div></div><div style={{ textAlign: 'right' }}><strong>PKR {money(entry.total)}</strong><div style={sub}>{money(entry.pieces)} pcs</div></div></div>)}
    </section>

    <section style={card}>
      <h2 style={heading}>Payment History</h2>
      {!payments.length ? <Empty text="No contractor payments recorded yet." /> : payments.slice(0, 8).map(payment => <div key={payment.id} style={row}><div><strong>Payment received</strong><div style={sub}>{payment.team_number ? `Team ${payment.team_number}` : 'All / unassigned'} · {date(payment.paid_at)}{payment.note ? ` · ${payment.note}` : ''}</div></div><strong>PKR {money(payment.amount)}</strong></div>)}
    </section>
    <div style={{ marginTop: 10, color: '#94a3b8', fontSize: 10 }}>Contractor finance is separate from Team Finance. Commission is not treated as a payment.</div>
    <span aria-hidden="true">{profileId}</span>
  </main>;
}

function Metric({ title, value }: { title: string; value: string }) { return <div style={{ padding: 12, borderRadius: 14, background: 'linear-gradient(145deg,#eff6ff,#f5f3ff)', border: '1px solid rgba(59,130,246,.13)' }}><div style={{ color: '#64748b', fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em' }}>{title}</div><div style={{ marginTop: 5, fontSize: 16, fontWeight: 950 }}>{value}</div></div>; }
const heading = { margin: '0 0 8px', fontSize: 16, letterSpacing: '-.02em' };
const row = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderTop: '1px solid rgba(148,163,184,.15)', fontSize: 12 };
const sub = { marginTop: 3, color: '#64748b', fontSize: 10 };
const ghost = { minHeight: 34, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(59,130,246,.2)', background: '#eff6ff', color: '#1d4ed8', fontWeight: 850 };
function Empty({ text }: { text: string }) { return <div style={{ padding: '14px 0', color: '#94a3b8', fontSize: 11 }}>{text}</div>; }
