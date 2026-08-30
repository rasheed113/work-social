import { useState } from 'react';
import type { FormEvent } from 'react';
import { navigate } from '../../../app/Router';
import { formatWorkDecimal } from '../logic/workEntryCalculations';
import { useWorkerFinance } from '../hooks/useWorkerFinance';
import { createWorkerFinanceTransaction } from '../api/workerFinance';
import {
  getWorkerWorkEntry,
  getWorkerWorkEntryVersions,
  trashWorkerWorkEntry,
  updateWorkerWorkEntry,
} from '../api/workEntries';
import type { WorkEntry, WorkEntryUpdateInput, WorkEntryVersion } from '../types/workEntry';
import type { WorkerFinanceHistoryRow, WorkerFinanceTransactionType } from '../types/finance';
import { WorkerWorkEntryDetails } from './WorkerWorkEntryDetails';

const DECIMAL_RE = /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/;

function decimalToScaled(value: string) {
  const normalized = value.trim();
  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [integerPart, fractionPart = ''] = unsigned.split('.');
  const scaled = BigInt(integerPart || '0') * 10000n + BigInt((fractionPart + '0000').slice(0, 4));
  return negative ? -scaled : scaled;
}

function scaledToDecimal(value: bigint) {
  const negative = value < 0n;
  const unsigned = negative ? -value : value;
  const integerPart = unsigned / 10000n;
  const fractionPart = (unsigned % 10000n).toString().padStart(4, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${integerPart.toString()}${fractionPart ? `.${fractionPart}` : ''}`;
}

function addDecimals(left: string, right: string) {
  return scaledToDecimal(decimalToScaled(left) + decimalToScaled(right));
}

function decimalSign(value: string) {
  const scaled = decimalToScaled(value);
  return scaled > 0n ? 1 : scaled < 0n ? -1 : 0;
}

const cardStyle = {
  border: '1px solid rgba(99,102,241,.14)',
  borderRadius: 20,
  background: 'rgba(255,255,255,.94)',
  boxShadow: '0 12px 30px rgba(15,23,42,.07)',
};
const buttonStyle = {
  minHeight: 44,
  padding: '0 15px',
  borderRadius: 12,
  border: '1px solid rgba(99,102,241,.18)',
  background: '#fff',
  color: '#312e81',
  font: 'inherit',
  fontWeight: 850,
  cursor: 'pointer',
};

function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateAtCurrentLocalTime(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number);
  const now = new Date();
  now.setFullYear(year, month - 1, day);
  return now.toISOString();
}

function formatMoney(value: string, signed = false) {
  const sign = decimalSign(value);
  const prefix = sign > 0 && signed ? '+' : sign < 0 ? '-' : '';
  const absolute = sign < 0 ? value.slice(1) : value;
  return `${prefix}₨${formatWorkDecimal(absolute)}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function transactionLabel(row: WorkerFinanceHistoryRow) {
  if (row.source_kind === 'WORK_ENTRY') return 'Work Entry';
  return row.transaction_type === 'PAYMENT' ? 'Payment' : 'Advance';
}

function isPositive(row: WorkerFinanceHistoryRow) {
  return row.source_kind === 'WORK_ENTRY';
}

interface FinanceFormProps {
  type: WorkerFinanceTransactionType;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

function FinanceForm({ type, onClose, onSaved }: FinanceFormProps) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(localDateInputValue());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const today = localDateInputValue();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = amount.trim();
    if (!DECIMAL_RE.test(normalized) || normalized === '0') {
      setError('Amount must be greater than zero and use up to 4 decimal places.');
      return;
    }
    if (!date || date > today) {
      setError('Choose today or an earlier date.');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createWorkerFinanceTransaction({
      transaction_type: type,
      amount: normalized,
      occurred_at: dateAtCurrentLocalTime(date),
      note,
    });
    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }
    await onSaved();
    setSaving(false);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'grid', placeItems: 'end center', padding: 12, background: 'rgba(15,23,42,.58)', backdropFilter: 'blur(8px)' }}>
      <section role="dialog" aria-modal="true" aria-labelledby="finance-form-title" style={{ width: '100%', maxWidth: 560, padding: 20, borderRadius: 22, background: '#fff', boxShadow: '0 24px 70px rgba(15,23,42,.25)' }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ color: '#64748b', fontSize: 11, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>Worker Finance</div>
            <h2 id="finance-form-title" style={{ margin: '5px 0 0', fontSize: 22 }}>{type === 'PAYMENT' ? 'Add Payment' : 'Add Advance'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...buttonStyle, minHeight: 38, padding: '0 12px' }}>×</button>
        </header>

        <form onSubmit={submit} style={{ display: 'grid', gap: 14, marginTop: 18 }}>
          <label style={{ display: 'grid', gap: 7, fontSize: 13, fontWeight: 800 }}>
            Amount
            <input autoFocus inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="5000" aria-invalid={Boolean(error)} style={{ minHeight: 48, padding: '0 13px', border: '1px solid #cbd5e1', borderRadius: 12, font: 'inherit', fontSize: 16, boxSizing: 'border-box' }} />
          </label>

          <label style={{ display: 'grid', gap: 7, fontSize: 13, fontWeight: 800 }}>
            Date
            <input type="date" max={today} value={date} onChange={(event) => setDate(event.target.value)} style={{ minHeight: 48, padding: '0 13px', border: '1px solid #cbd5e1', borderRadius: 12, font: 'inherit', boxSizing: 'border-box' }} />
            <span style={{ color: '#64748b', fontSize: 12, fontWeight: 600 }}>The time is recorded automatically using the current local time.</span>
          </label>

          <label style={{ display: 'grid', gap: 7, fontSize: 13, fontWeight: 800 }}>
            Note <span style={{ color: '#94a3b8', fontWeight: 600 }}>(optional)</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={3} placeholder="Optional payment details" style={{ padding: '11px 13px', border: '1px solid #cbd5e1', borderRadius: 12, resize: 'vertical', font: 'inherit' }} />
          </label>

          {error && <p role="alert" style={{ margin: 0, color: '#b91c1c', fontSize: 13, fontWeight: 750 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 2 }}>
            <button type="button" onClick={onClose} disabled={saving} style={buttonStyle}>Cancel</button>
            <button type="submit" disabled={saving} style={{ ...buttonStyle, borderColor: '#312e81', background: '#312e81', color: '#fff', opacity: saving ? .65 : 1 }}>{saving ? 'Saving…' : `Save ${type === 'PAYMENT' ? 'Payment' : 'Advance'}`}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function FinanceTransactionDetails({ row, onClose }: { row: WorkerFinanceHistoryRow; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'grid', placeItems: 'center', padding: 14, background: 'rgba(15,23,42,.58)', backdropFilter: 'blur(8px)' }}>
      <section role="dialog" aria-modal="true" aria-labelledby="finance-detail-title" style={{ width: '100%', maxWidth: 520, padding: 22, borderRadius: 22, background: '#fff', boxShadow: '0 24px 70px rgba(15,23,42,.25)' }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ color: '#64748b', fontSize: 11, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>Finance transaction</div>
            <h2 id="finance-detail-title" style={{ margin: '5px 0 0', fontSize: 22 }}>{transactionLabel(row)}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...buttonStyle, minHeight: 38, padding: '0 12px' }}>×</button>
        </header>
        <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
          <div style={{ fontSize: 30, fontWeight: 950, letterSpacing: '-.04em', color: '#dc2626' }}>{formatMoney(row.amount, true)}</div>
          <div style={{ display: 'grid', gap: 4, color: '#475569', fontSize: 13 }}>
            <div><strong>Type:</strong> {row.transaction_type}</div>
            <div><strong>Date:</strong> {formatDate(row.occurred_at)}</div>
            {row.note && <div><strong>Note:</strong> {row.note}</div>}
          </div>
          <p style={{ margin: 0, padding: 12, borderRadius: 12, background: '#f8fafc', color: '#64748b', fontSize: 12, lineHeight: 1.5 }}>Finance transactions are retained as financial history and are not deleted from this UI.</p>
        </div>
      </section>
    </div>
  );
}

export function WorkerFinance() {
  const finance = useWorkerFinance(true);
  const [formType, setFormType] = useState<WorkerFinanceTransactionType | null>(null);
  const [selectedFinanceRow, setSelectedFinanceRow] = useState<WorkerFinanceHistoryRow | null>(null);
  const [selectedWorkEntry, setSelectedWorkEntry] = useState<WorkEntry | null>(null);
  const [workVersions, setWorkVersions] = useState<WorkEntryVersion[]>([]);
  const [workVersionsLoading, setWorkVersionsLoading] = useState(false);
  const [workDetailsError, setWorkDetailsError] = useState<string | null>(null);

  const balanceSign = decimalSign(finance.summary.current_balance);
  const balanceTone = balanceSign > 0 ? '#15803d' : balanceSign < 0 ? '#dc2626' : '#475569';
  const received = addDecimals(finance.summary.payments, finance.summary.advances);

  const openWorkEntry = async (row: WorkerFinanceHistoryRow) => {
    setSelectedFinanceRow(null);
    setWorkDetailsError(null);
    setWorkVersions([]);
    setSelectedWorkEntry(null);
    setWorkVersionsLoading(true);
    const [entryResult, versionsResult] = await Promise.all([getWorkerWorkEntry(row.id), getWorkerWorkEntryVersions(row.id)]);
    if (entryResult.error || !entryResult.data) setWorkDetailsError(entryResult.error?.message ?? 'The original Work Entry is no longer available in your authorized history.');
    else setSelectedWorkEntry(entryResult.data);
    if (!versionsResult.error) setWorkVersions(versionsResult.data);
    else setWorkDetailsError((current) => current ?? versionsResult.error?.message ?? null);
    setWorkVersionsLoading(false);
  };

  const refreshAfterWorkEntryMutation = async () => {
    await Promise.all([finance.reloadSummary(), finance.reloadHistory()]);
  };

  const editEntry = async (entryId: string, input: WorkEntryUpdateInput) => {
    const result = await updateWorkerWorkEntry(entryId, input);
    if (!result.error) {
      await refreshAfterWorkEntryMutation();
      if (result.data) setSelectedWorkEntry(result.data);
    }
    return { error: result.error };
  };

  const trashEntry = async (entryId: string) => {
    const result = await trashWorkerWorkEntry(entryId);
    if (!result.error) {
      await refreshAfterWorkEntryMutation();
      setSelectedWorkEntry(null);
    }
    return { error: result.error };
  };

  const closeWorkDetails = () => {
    setSelectedWorkEntry(null);
    setWorkVersions([]);
    setWorkDetailsError(null);
  };

  return (
    <main style={{ width: '100%', maxWidth: 820, margin: '0 auto', padding: '24px 14px 112px', boxSizing: 'border-box' }}>
      <header style={{ marginBottom: 18 }}>
        <button type="button" onClick={() => navigate('/work')} style={{ border: 0, padding: 0, margin: '0 0 14px', background: 'transparent', color: '#64748b', font: 'inherit', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>← Worker Work House</button>
        <div style={{ color: '#64748b', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Worker domain</div>
        <h1 style={{ margin: '6px 0 0', fontSize: 'clamp(28px, 7vw, 40px)', letterSpacing: '-.04em' }}>Finance</h1>
      </header>

      <section aria-labelledby="finance-balance-title" style={{ ...cardStyle, padding: 22, marginBottom: 14 }}>
        <div id="finance-balance-title" style={{ color: '#475569', fontSize: 11, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>Current Balance</div>
        <div style={{ marginTop: 8, fontSize: 'clamp(34px, 10vw, 54px)', lineHeight: 1, fontWeight: 950, letterSpacing: '-.055em', color: balanceTone }}>
          {finance.summaryLoading ? 'Loading…' : formatMoney(finance.summary.current_balance, true)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10, marginTop: 20 }}>
          <div style={{ padding: 12, borderRadius: 14, background: '#f8fafc' }}><div style={{ color: '#64748b', fontSize: 11, fontWeight: 800 }}>Earned</div><strong style={{ display: 'block', marginTop: 4, fontSize: 16 }}>{formatMoney(finance.summary.earnings)}</strong></div>
          <div style={{ padding: 12, borderRadius: 14, background: '#f8fafc' }}><div style={{ color: '#64748b', fontSize: 11, fontWeight: 800 }}>Received</div><strong style={{ display: 'block', marginTop: 4, fontSize: 16 }}>{formatMoney(received)}</strong></div>
        </div>
        {finance.summaryError && <p role="alert" style={{ margin: '12px 0 0', color: '#b91c1c', fontSize: 13, fontWeight: 750 }}>{finance.summaryError}</p>}
      </section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginBottom: 24 }}>
        <button type="button" onClick={() => setFormType('PAYMENT')} style={{ ...buttonStyle, background: '#312e81', borderColor: '#312e81', color: '#fff' }}>+ Add Payment</button>
        <button type="button" onClick={() => setFormType('ADVANCE')} style={buttonStyle}>+ Add Advance</button>
      </div>

      <section aria-labelledby="finance-history-title">
        <header style={{ marginBottom: 10 }}>
          <h2 id="finance-history-title" style={{ margin: 0, fontSize: 20, letterSpacing: '-.02em' }}>Finance History</h2>
          <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: 13 }}>Work earnings, payments and advances. Newest first.</p>
        </header>

        {finance.historyError && <p role="alert" style={{ ...cardStyle, padding: 14, color: '#b91c1c', fontSize: 13, fontWeight: 750 }}>{finance.historyError}</p>}

        {finance.historyLoading ? (
          <section style={{ ...cardStyle, padding: 20 }}><p style={{ margin: 0, color: '#64748b' }}>Loading Finance History…</p></section>
        ) : finance.transactions.length === 0 ? (
          <section style={{ ...cardStyle, padding: 24, textAlign: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>No Finance History Yet</h3>
            <p style={{ margin: '7px 0 0', color: '#64748b', fontSize: 13 }}>Real Work Entries will appear here as earnings. Payments and advances can be recorded above.</p>
          </section>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {finance.transactions.map((row) => {
              const positive = isPositive(row);
              return (
                <article key={`${row.source_kind}:${row.id}`} style={{ ...cardStyle, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: positive ? '#15803d' : '#dc2626', fontSize: 22, fontWeight: 950, letterSpacing: '-.03em' }}>{formatMoney(row.amount, true)}</div>
                      <div style={{ marginTop: 3, fontWeight: 900 }}>{transactionLabel(row)}</div>
                      {positive && row.item_name && <div style={{ marginTop: 4, color: '#475569', fontSize: 13 }}>{row.item_name}{row.quantity ? ` · ${formatWorkDecimal(row.quantity)} pcs` : ''}</div>}
                      {row.note && !positive && <div style={{ marginTop: 4, color: '#64748b', fontSize: 12 }}>{row.note}</div>}
                      <div style={{ marginTop: 5, color: '#94a3b8', fontSize: 12 }}>{formatDate(row.occurred_at)}</div>
                    </div>
                    <button type="button" onClick={() => positive ? void openWorkEntry(row) : setSelectedFinanceRow(row)} style={{ ...buttonStyle, flex: '0 0 auto', minHeight: 38, padding: '0 11px', fontSize: 12 }}>View Details</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {finance.hasMore && !finance.historyLoading && (
          <button type="button" onClick={() => void finance.loadMore()} disabled={finance.historyLoadingMore} style={{ ...buttonStyle, display: 'block', width: '100%', marginTop: 12, background: finance.historyLoadingMore ? '#f8fafc' : '#fff', color: '#312e81' }}>{finance.historyLoadingMore ? 'Loading more…' : 'More'}</button>
        )}
      </section>

      {formType && <FinanceForm type={formType} onClose={() => setFormType(null)} onSaved={async () => { await Promise.all([finance.reloadSummary(), finance.reloadHistory()]); }} />}
      {selectedFinanceRow && <FinanceTransactionDetails row={selectedFinanceRow} onClose={() => setSelectedFinanceRow(null)} />}
      {workDetailsError && !selectedWorkEntry && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'grid', placeItems: 'center', padding: 14, background: 'rgba(15,23,42,.58)' }}>
          <section role="alertdialog" style={{ width: '100%', maxWidth: 520, padding: 22, borderRadius: 22, background: '#fff' }}>
            <h2 style={{ margin: 0 }}>Work Entry unavailable</h2>
            <p style={{ color: '#64748b', lineHeight: 1.5 }}>{workDetailsError}</p>
            <button type="button" onClick={closeWorkDetails} style={buttonStyle}>Close</button>
          </section>
        </div>
      )}
      <WorkerWorkEntryDetails entry={selectedWorkEntry} versions={workVersions} versionsLoading={workVersionsLoading} actionError={workDetailsError} onClose={closeWorkDetails} onEdit={editEntry} onTrash={trashEntry} />
    </main>
  );
}
