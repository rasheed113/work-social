import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { ExpenseAccountOption, ExpenseCategoryOption, ExpenseTransactionInput, ExpenseTransactionRecord } from '../domain/transactions';
import { parseDateInput } from '../domain/transactions';

interface ExpenseTransactionEntryProps {
  accounts: ExpenseAccountOption[];
  categories: ExpenseCategoryOption[];
  initialTransaction?: ExpenseTransactionRecord | null;
  onSave: (input: ExpenseTransactionInput) => Promise<void>;
  onCreateAccount: (input: { name: string; type: string; currency: string }) => Promise<ExpenseAccountOption>;
  onCreateCategory: (input: { name: string; type: 'expense' | 'income'; icon?: string }) => Promise<ExpenseCategoryOption>;
  onClose: () => void;
}

const today = () => { const value = new Date(); return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; };

export function ExpenseTransactionEntry({ accounts, categories, initialTransaction, onSave, onCreateAccount, onCreateCategory, onClose }: ExpenseTransactionEntryProps) {
  const [type, setType] = useState<'expense' | 'income' | 'transfer'>(initialTransaction?.type ?? 'expense');
  const [amount, setAmount] = useState(initialTransaction ? String(initialTransaction.amount) : '');
  const [accountId, setAccountId] = useState(initialTransaction?.account_id ?? '');
  const [categoryId, setCategoryId] = useState(initialTransaction?.category_id ?? '');
  const [fromAccountId, setFromAccountId] = useState(initialTransaction?.from_account_id ?? '');
  const [toAccountId, setToAccountId] = useState(initialTransaction?.to_account_id ?? '');
  const [date, setDate] = useState(initialTransaction?.date ?? today());
  const [note, setNote] = useState(initialTransaction?.note ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [setup, setSetup] = useState<'account' | 'category' | null>(null);
  const [setupName, setSetupName] = useState('');
  const [setupCurrency, setSetupCurrency] = useState('PKR');
  const [setupAccountType, setSetupAccountType] = useState('cash');
  const [setupIcon, setSetupIcon] = useState('');
  const [setupSaving, setSetupSaving] = useState(false);
  const visibleCategories = useMemo(() => categories.filter((category) => category.type === (type === 'transfer' ? 'expense' : type)), [categories, type]);

  useEffect(() => { if (type !== 'transfer' && categoryId && !visibleCategories.some((category) => category.id === categoryId)) setCategoryId(''); }, [type, categoryId, visibleCategories]);
  useEffect(() => { const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving && !setupSaving) { if (setup) setSetup(null); else onClose(); } }; window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown); }, [onClose, saving, setup, setupSaving]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    const numericAmount = Number(amount.replace(/,/g, '').trim());
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError('Enter an amount greater than zero.');
    const validDate = parseDateInput(date); if (!validDate) return setError('Choose a valid date.');
    if (type !== 'transfer' && !accountId) return setError('Select an account.');
    if (type !== 'transfer' && !categoryId) return setError(`Select an ${type} category.`);
    if (type === 'transfer' && (!fromAccountId || !toAccountId || fromAccountId === toAccountId)) return setError('Choose two different accounts for a transfer.');
    setSaving(true);
    try { await onSave({ type, amount: numericAmount, account_id: accountId || undefined, category_id: categoryId || undefined, from_account_id: fromAccountId || undefined, to_account_id: toAccountId || undefined, date: validDate, note }); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not save this transaction. Please try again.'); }
    finally { setSaving(false); }
  };

  const saveSetup = async () => {
    if (!setupName.trim()) return setError(`Enter a ${setup === 'account' ? 'account' : 'category'} name.`);
    if (setup === 'account' && !/^[A-Z]{3}$/.test(setupCurrency)) return setError('Currency must be a 3-letter code such as PKR.');
    setSetupSaving(true); setError('');
    try {
      if (setup === 'account') setAccountId((await onCreateAccount({ name: setupName, type: setupAccountType, currency: setupCurrency })).id);
      else if (setup === 'category') setCategoryId((await onCreateCategory({ name: setupName, type: type === 'income' ? 'income' : 'expense', icon: setupIcon })).id);
      setSetup(null); setSetupName(''); setSetupIcon('');
    } catch (setupError) { setError(setupError instanceof Error ? setupError.message : 'Could not create that item.'); }
    finally { setSetupSaving(false); }
  };

  return (
    <div className="expense-entry__backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !saving) onClose(); }}>
      <section className="expense-entry" role="dialog" aria-modal="true" aria-labelledby="expense-entry-title">
        <style>{`.expense-entry__backdrop{position:fixed;inset:0;z-index:1200;display:grid;place-items:end center;padding:10px;background:rgba(15,23,42,.42);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}.expense-entry{width:min(620px,100%);max-height:calc(100dvh - 20px);overflow:auto;box-sizing:border-box;border:1px solid rgba(148,163,184,.2);border-radius:26px;background:linear-gradient(160deg,rgba(255,255,255,.99),rgba(248,250,252,.98));box-shadow:0 30px 70px rgba(15,23,42,.24),inset 0 1px 0 #fff;padding:18px;scroll-padding-bottom:140px}.expense-entry__top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.expense-entry__title{margin:0;font-size:21px;font-weight:950;letter-spacing:-.035em;color:#0f172a}.expense-entry__close{width:40px;height:40px;border:1px solid rgba(148,163,184,.18);border-radius:12px;background:#fff;color:#475569;font-size:20px;cursor:pointer}.expense-entry__types{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:15px}.expense-entry__type{min-height:48px;border:1px solid rgba(148,163,184,.2);border-radius:14px;background:#fff;color:#475569;font:inherit;font-weight:850;cursor:pointer}.expense-entry__type[data-active=true]{border-color:rgba(37,99,235,.35);background:linear-gradient(145deg,rgba(37,99,235,.1),rgba(20,184,166,.07));color:#172033;box-shadow:inset 0 1px 0 #fff}.expense-entry__amount{padding:16px;border:1px solid rgba(37,99,235,.16);border-radius:19px;background:linear-gradient(145deg,rgba(239,246,255,.9),rgba(255,255,255,.96));margin-bottom:14px}.expense-entry__amount-label{display:block;color:#64748b;font-size:11px;font-weight:850;margin-bottom:5px}.expense-entry__amount-input{width:100%;border:0;outline:0;background:transparent;color:#0f172a;font:inherit;font-size:36px;font-weight:950;letter-spacing:-.05em;box-sizing:border-box}.expense-entry__grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}.expense-entry__field{min-width:0}.expense-entry__label{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:0 0 6px;color:#334155;font-size:11px;font-weight:900}.expense-entry__select,.expense-entry__input{width:100%;min-height:48px;box-sizing:border-box;border:1px solid rgba(148,163,184,.24);border-radius:13px;background:#fff;color:#172033;padding:0 12px;font:inherit;font-size:13px;font-weight:700;outline:none}.expense-entry__select:focus,.expense-entry__input:focus{border-color:rgba(37,99,235,.5);box-shadow:0 0 0 3px rgba(37,99,235,.09)}.expense-entry__add-link{border:0;background:transparent;color:#2563eb;font:inherit;font-size:10px;font-weight:900;cursor:pointer}.expense-entry__note{grid-column:1/-1}.expense-entry__error{margin:12px 0 0;padding:10px 12px;border:1px solid rgba(220,38,38,.15);border-radius:12px;background:rgba(254,226,226,.55);color:#991b1b;font-size:11px;font-weight:750;line-height:1.45}.expense-entry__actions{display:flex;gap:9px;margin-top:15px}.expense-entry__cancel,.expense-entry__save{min-height:50px;border-radius:14px;font:inherit;font-weight:900;cursor:pointer}.expense-entry__cancel{flex:0 0 120px;border:1px solid rgba(148,163,184,.2);background:#fff;color:#475569}.expense-entry__save{flex:1;border:1px solid rgba(37,99,235,.2);background:linear-gradient(145deg,#2563eb,#4f46e5);color:#fff;box-shadow:0 10px 20px rgba(37,99,235,.18)}.expense-entry__save:disabled,.expense-entry__cancel:disabled{opacity:.55;cursor:not-allowed}.expense-entry__setup{margin-top:12px;padding:13px;border:1px solid rgba(20,184,166,.16);border-radius:15px;background:rgba(20,184,166,.045)}.expense-entry__setup-title{margin:0 0 9px;font-size:12px;font-weight:900;color:#134e4a}.expense-entry__setup-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.expense-entry__setup-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:9px}.expense-entry__mini{min-height:40px;padding:0 11px;border-radius:11px;border:1px solid rgba(148,163,184,.2);background:#fff;color:#475569;font:inherit;font-size:11px;font-weight:850;cursor:pointer}.expense-entry__mini--primary{border-color:rgba(37,99,235,.2);background:#2563eb;color:#fff}@media(max-width:560px){body:has(.expense-entry__backdrop) .ws-ai-launcher{display:none!important}.expense-entry__backdrop{padding:0;align-items:end}.expense-entry{width:100%;max-height:100dvh;border-radius:24px 24px 0 0;padding:14px 14px max(18px,env(safe-area-inset-bottom));scroll-padding-bottom:160px}.expense-entry__top{margin-bottom:10px}.expense-entry__title{font-size:19px}.expense-entry__close{width:38px;height:38px}.expense-entry__types{gap:6px;margin-bottom:10px}.expense-entry__type{min-height:44px;border-radius:12px}.expense-entry__amount{padding:12px;margin-bottom:10px;border-radius:16px}.expense-entry__amount-input{font-size:32px}.expense-entry__grid{grid-template-columns:1fr;gap:9px}.expense-entry__note{grid-column:auto}.expense-entry__select,.expense-entry__input{min-height:44px}.expense-entry__actions{margin-top:11px;padding-bottom:4px}.expense-entry__cancel{flex-basis:96px}.expense-entry__save,.expense-entry__cancel{min-height:46px}.expense-entry__setup{padding:10px}.expense-entry__setup-grid{grid-template-columns:1fr}.expense-entry form{padding-bottom:10px}}`}</style>
        <div className="expense-entry__top"><h2 id="expense-entry-title" className="expense-entry__title">{initialTransaction ? 'Edit transaction' : 'Add transaction'}</h2><button type="button" className="expense-entry__close" aria-label="Close" onClick={onClose} disabled={saving}>×</button></div>
        <div className="expense-entry__types" role="tablist" aria-label="Transaction type">{(['expense','income','transfer'] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={type === item} className="expense-entry__type" data-active={type === item} onClick={() => setType(item)}>{item === 'expense' ? '− Expense' : item === 'income' ? '+ Income' : '↔ Transfer'}</button>)}</div>
        <form onSubmit={submit} noValidate>
          <div className="expense-entry__amount"><label className="expense-entry__amount-label" htmlFor="transaction-amount">Amount</label><input id="transaction-amount" className="expense-entry__amount-input" inputMode="decimal" autoFocus placeholder="0" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.,]/g, ''))} aria-describedby={error ? 'transaction-error' : undefined} /></div>
          <div className="expense-entry__grid">
            {type !== 'transfer' ? <><div className="expense-entry__field"><label className="expense-entry__label" htmlFor="transaction-category"><span>Category</span><button type="button" className="expense-entry__add-link" onClick={() => { setSetup('category'); setSetupName(''); }}>+ Create</button></label><select id="transaction-category" className="expense-entry__select" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Select category</option>{visibleCategories.map((category) => <option key={category.id} value={category.id}>{category.icon ? `${category.icon} ` : ''}{category.name}</option>)}</select></div><div className="expense-entry__field"><label className="expense-entry__label" htmlFor="transaction-account"><span>Account</span><button type="button" className="expense-entry__add-link" onClick={() => { setSetup('account'); setSetupName(''); }}>+ Create</button></label><select id="transaction-account" className="expense-entry__select" value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Select account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></div></> : <><div className="expense-entry__field"><label className="expense-entry__label" htmlFor="transaction-from">From account</label><select id="transaction-from" className="expense-entry__select" value={fromAccountId} onChange={(event) => setFromAccountId(event.target.value)}><option value="">Select source</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></div><div className="expense-entry__field"><label className="expense-entry__label" htmlFor="transaction-to">To account</label><select id="transaction-to" className="expense-entry__select" value={toAccountId} onChange={(event) => setToAccountId(event.target.value)}><option value="">Select destination</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></div></>}
            <div className="expense-entry__field"><label className="expense-entry__label" htmlFor="transaction-date">Date</label><input id="transaction-date" className="expense-entry__input" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
            <div className="expense-entry__field expense-entry__note"><label className="expense-entry__label" htmlFor="transaction-note">Note <span>Optional</span></label><input id="transaction-note" className="expense-entry__input" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="Add a short note" /></div>
          </div>
          {setup && <div className="expense-entry__setup" aria-label={`Create ${setup}`}><p className="expense-entry__setup-title">Create {setup}</p><div className="expense-entry__setup-grid"><input className="expense-entry__input" autoFocus placeholder={`${setup === 'account' ? 'Account' : 'Category'} name`} value={setupName} onChange={(event) => setSetupName(event.target.value)} />{setup === 'account' ? <><select className="expense-entry__select" value={setupAccountType} onChange={(event) => setSetupAccountType(event.target.value)}><option value="cash">Cash</option><option value="bank">Bank</option><option value="wallet">Wallet</option><option value="savings">Savings</option><option value="credit_card">Credit Card</option><option value="other">Other</option></select><input className="expense-entry__input" value={setupCurrency} onChange={(event) => setSetupCurrency(event.target.value.toUpperCase().slice(0,3))} placeholder="Currency" maxLength={3} /> </> : <input className="expense-entry__input" value={setupIcon} onChange={(event) => setSetupIcon(event.target.value)} placeholder="Icon (optional)" maxLength={4} />}</div><div className="expense-entry__setup-actions"><button type="button" className="expense-entry__mini" onClick={() => setSetup(null)} disabled={setupSaving}>Cancel</button><button type="button" className="expense-entry__mini expense-entry__mini--primary" onClick={saveSetup} disabled={setupSaving}>{setupSaving ? 'Creating…' : 'Create'}</button></div></div>}
          {error && <p id="transaction-error" className="expense-entry__error" role="alert">{error}</p>}
          <div className="expense-entry__actions"><button type="button" className="expense-entry__cancel" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="expense-entry__save" disabled={saving}>{saving ? 'Saving…' : initialTransaction ? 'Save changes' : `Save ${type}`}</button></div>
        </form>
      </section>
    </div>
  );
}
