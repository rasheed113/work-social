import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { formatContractorMoney } from '../logic/contractorEntryCalculations';

type TrashEntry = {
  id: string;
  item_name: string;
  size: string;
  pieces: number;
  rate_per_piece: number;
  commission_type: 'percentage' | 'per_piece' | null;
  commission_value: number | null;
  commission_mode: 'included' | 'separate' | null;
  commission_per_piece: number;
  actual_rate_per_piece: number;
  total: number;
  occurred_at: string;
  special_note?: string | null;
  deleted_at: string;
};

export function ContractorTrashButton({ profileId }: { profileId: string }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<TrashEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const { data, error: e } = await supabase
      .from('contractor_work_entry_trash')
      .select('id,item_name,size,pieces,rate_per_piece,commission_type,commission_value,commission_mode,commission_per_piece,actual_rate_per_piece,total,occurred_at,special_note,deleted_at')
      .eq('profile_id', profileId)
      .order('deleted_at', { ascending: false })
      .limit(100);
    if (e) setError(e.message);
    setEntries((data ?? []) as TrashEntry[]);
    setLoading(false);
  };

  useEffect(() => { if (open) void load(); }, [open, profileId]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open deleted entries trash"
        style={{ position: 'fixed', right: 16, bottom: 82, zIndex: 40, width: 50, height: 50, border: '1px solid rgba(255,255,255,.85)', borderRadius: 17, background: 'linear-gradient(145deg,rgba(255,255,255,.98),rgba(241,245,249,.94))', boxShadow: '0 14px 30px rgba(15,23,42,.16),inset 0 1px 0 #fff', fontSize: 21, cursor: 'pointer' }}
      >🗑️</button>

      {open && (
        <div onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 100, padding: '20px 12px 90px', display: 'grid', placeItems: 'center', background: 'rgba(15,23,42,.38)', backdropFilter: 'blur(8px)' }}>
          <section role="dialog" aria-modal="true" style={{ width: 'min(720px,100%)', maxHeight: '78vh', overflow: 'auto', border: '1px solid rgba(255,255,255,.9)', borderRadius: 24, padding: 18, background: 'linear-gradient(145deg,rgba(255,255,255,.98),rgba(248,250,252,.94))', boxShadow: '0 30px 80px rgba(15,23,42,.25),inset 0 1px 0 #fff' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div><div style={{ color: '#dc2626', fontSize: 10, fontWeight: 950, letterSpacing: '.12em' }}>DELETED WORK</div><h2 style={{ margin: '3px 0', color: '#172033', fontSize: 25 }}>Trash 🗑️</h2><p style={{ margin: 0, color: '#64748b', fontSize: 12 }}>Deleted Contractor entries are kept here.</p></div>
              <button type="button" onClick={() => setOpen(false)} style={{ width: 38, height: 38, border: 0, borderRadius: 13, background: '#f1f5f9', fontSize: 22, cursor: 'pointer' }}>×</button>
            </header>
            {loading && <p style={{ color: '#64748b', fontSize: 12 }}>Loading trash…</p>}
            {error && <p role="alert" style={{ color: '#b91c1c', fontSize: 12 }}>{error}</p>}
            {!loading && !error && entries.length === 0 && <div style={{ marginTop: 16, padding: 20, borderRadius: 18, textAlign: 'center', background: 'linear-gradient(145deg,#fff,#f8fafc)', color: '#64748b', fontSize: 13 }}>Trash is empty.</div>}
            <div style={{ display: 'grid', gap: 9, marginTop: 14 }}>
              {entries.map((entry) => (
                <article key={entry.id} style={{ padding: 13, borderRadius: 16, border: '1px solid rgba(220,38,38,.12)', background: 'linear-gradient(145deg,#fff,#fff7f7)', boxShadow: '0 8px 18px rgba(15,23,42,.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><div style={{ minWidth: 0 }}><strong style={{ color: '#172033', fontSize: 14 }}>{entry.item_name}</strong><div style={{ marginTop: 3, color: '#64748b', fontSize: 11 }}>Size {entry.size} · {formatContractorMoney(entry.pieces)} pieces · Deleted {new Intl.DateTimeFormat('en-PK', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(entry.deleted_at))}</div></div><strong style={{ color: '#991b1b', whiteSpace: 'nowrap' }}>PKR {formatContractorMoney(entry.total)}</strong></div>
                  <div style={{ marginTop: 7, color: '#64748b', fontSize: 11 }}>Actual rate PKR {formatContractorMoney(entry.actual_rate_per_piece)}/piece · Original date {new Intl.DateTimeFormat('en-PK', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(entry.occurred_at))}</div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
