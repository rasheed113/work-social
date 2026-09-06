import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';
import type { ExpenseAccountOption, ExpenseCategoryOption, ExpenseTransactionInput, ExpenseTransactionRecord } from '../domain/transactions';
import { formatTransactionAmount, monthBounds, transactionSign } from '../domain/transactions';
import { createExpenseAccount, createExpenseCategory, createExpenseTransaction, deleteExpenseTransaction, loadExpenseTransactionData, updateExpenseTransaction } from '../data/expenseManagerTransactions';
import { ExpenseTransactionEntry } from '../components/ExpenseTransactionEntry';

interface ExpenseTransactionsPageProps { onNavigate: (path: string) => void }
type FilterType = 'all' | 'expense' | 'income' | 'transfer';
interface SubcategoryOption { id: string; name: string; category_id: string }
function monthAnchor(value: Date, delta: number) { return new Date(value.getFullYear(), value.getMonth() + delta, 1); }

export function ExpenseTransactionsPage({ onNavigate: _onNavigate }: ExpenseTransactionsPageProps) {
  const [userId, setUserId] = useState('');
  const [transactions, setTransactions] = useState<ExpenseTransactionRecord[]>([]);
  const [accounts, setAccounts] = useState<ExpenseAccountOption[]>([]);
  const [categories, setCategories] = useState<ExpenseCategoryOption[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [entryOpen, setEntryOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseTransactionRecord | null>(null);
  const [selected, setSelected] = useState<ExpenseTransactionRecord | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [period, setPeriod] = useState(() => new Date());
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [subcategoryFilter, setSubcategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showAllDates, setShowAllDates] = useState(false);

  const load = async () => {
    if (!userId) return;
    setLoading(true); setLoadError('');
    try {
      const [data, subResult] = await Promise.all([
        loadExpenseTransactionData(userId),
        supabase.from('expense_subcategories').select('id,name,category_id').eq('user_id', userId).eq('is_archived', false).order('name'),
      ]);
      if (subResult.error) throw subResult.error;
      setTransactions(data.transactions); setAccounts(data.accounts); setCategories(data.categories); setSubcategories((subResult.data ?? []) as SubcategoryOption[]);
    } catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not load transactions.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { let active = true; void supabase.auth.getUser().then(({ data, error }) => { if (!active) return; if (error || !data.user) { setLoadError('Your signed-in session could not be resolved.'); setLoading(false); } else setUserId(data.user.id); }); return () => { active = false; }; }, []);
  useEffect(() => { void load(); }, [userId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('intent') === 'add') { setEditing(null); setEntryOpen(true); }
    const categoryId = params.get('categoryId');
    const subcategoryId = params.get('subcategoryId');
    const start = params.get('start');
    if (categoryId) setCategoryFilter(categoryId);
    if (subcategoryId) setSubcategoryFilter(subcategoryId);
    if (start && /^\d{4}-\d{2}-\d{2}$/.test(start)) { const anchor = new Date(`${start}T12:00:00`); if (!Number.isNaN(anchor.getTime())) { setPeriod(anchor); setShowAllDates(false); } }
  }, []);

  useEffect(() => {
    if (subcategoryFilter === 'all') return;
    const selectedSubcategory = subcategories.find((subcategory) => subcategory.id === subcategoryFilter);
    if (!selectedSubcategory) { setSubcategoryFilter('all'); return; }
    if (categoryFilter !== 'all' && selectedSubcategory.category_id !== categoryFilter) setSubcategoryFilter('all');
  }, [subcategories, subcategoryFilter, categoryFilter]);

  const bounds = monthBounds(period);
  const availableSubcategories = useMemo(() => categoryFilter === 'all' ? subcategories : subcategories.filter((subcategory) => subcategory.category_id === categoryFilter), [subcategories, categoryFilter]);
  const activeCategory = categories.find((category) => category.id === categoryFilter) ?? null;
  const activeSubcategory = subcategories.find((subcategory) => subcategory.id === subcategoryFilter) ?? null;

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return transactions.filter((transaction) => {
      if (!showAllDates && (transaction.date < bounds.start || transaction.date > bounds.end)) return false;
      if (filterType !== 'all' && transaction.type !== filterType) return false;
      if (accountFilter !== 'all' && transaction.account_id !== accountFilter && transaction.from_account_id !== accountFilter && transaction.to_account_id !== accountFilter) return false;
      if (categoryFilter !== 'all' && transaction.category_id !== categoryFilter) return false;
      if (subcategoryFilter !== 'all' && transaction.subcategory_id !== subcategoryFilter) return false;
      if (needle && ![transaction.note, transaction.category_name, transaction.subcategory_name, transaction.account_name].some((value) => value?.toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [transactions, bounds.start, bounds.end, filterType, accountFilter, categoryFilter, subcategoryFilter, search, showAllDates]);

  const grouped = useMemo(() => { const map = new Map<string, ExpenseTransactionRecord[]>(); filtered.forEach((transaction) => map.set(transaction.date, [...(map.get(transaction.date) ?? []), transaction])); return [...map.entries()]; }, [filtered]);
  const openAdd = () => { setSelected(null); setEditing(null); setSaveMessage(''); setEntryOpen(true); };
  const openEdit = (transaction: ExpenseTransactionRecord) => { setSelected(null); setEditing(transaction); setEntryOpen(true); };
  const save = async (input: ExpenseTransactionInput) => { if (!userId) throw new Error('Signed-in user is not available.'); const wasEditing = Boolean(editing); if (editing) await updateExpenseTransaction(userId, editing.id, input); else await createExpenseTransaction(userId, input); await load(); setEntryOpen(false); setEditing(null); setSaveMessage(wasEditing ? 'Transaction updated' : 'Transaction saved'); window.setTimeout(() => setSaveMessage(''), 2200); };
  const createAccount = async (input: { name: string; type: string; currency: string }) => { const account = await createExpenseAccount(userId, input); setAccounts((current) => [...current, account].sort((a, b) => a.name.localeCompare(b.name))); return account; };
  const createCategory = async (input: { name: string; type: 'expense' | 'income'; icon?: string }) => { const category = await createExpenseCategory(userId, input); setCategories((current) => [...current, category].sort((a, b) => a.name.localeCompare(b.name))); return category; };
  const deleteSelected = async () => { if (!selected || !userId) return; setDeletePending(true); try { await deleteExpenseTransaction(userId, selected.id); setSelected(null); await load(); setSaveMessage('Transaction deleted'); window.setTimeout(() => setSaveMessage(''), 2200); } catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not delete transaction.'); } finally { setDeletePending(false); } };

  return <section className="expense-transactions">
    <style>{`.expense-transactions{width:min(1120px,100%);margin:0 auto;padding:0 2px 110px;box-sizing:border-box}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 12px}.subtitle{margin:5px 0 0;color:#64748b;font-size:11px;font-weight:650}.add{position:relative;isolation:isolate;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 18px;border:1px solid rgba(255,255,255,.72);border-radius:14px;background:linear-gradient(145deg,#2563eb 0%,#4f46e5 58%,#3730a3 100%);color:#fff;font:inherit;font-size:11px;font-weight:950;letter-spacing:.01em;cursor:pointer;box-shadow:inset 0 1px 1px rgba(255,255,255,.4),inset 0 -3px 5px rgba(15,23,42,.22),0 8px 20px rgba(37,99,235,.28);text-shadow:0 1px 1px rgba(15,23,42,.2);transition:transform .16s ease,box-shadow .16s ease,filter .16s ease}.add::before{content:'';position:absolute;inset:1px;border-radius:13px;background:linear-gradient(180deg,rgba(255,255,255,.2),transparent 42%);pointer-events:none;z-index:-1}.add:hover{filter:saturate(1.08) brightness(1.03);transform:translateY(-1px);box-shadow:inset 0 1px 1px rgba(255,255,255,.48),inset 0 -3px 5px rgba(15,23,42,.22),0 12px 26px rgba(37,99,235,.34)}.add:active{transform:translateY(1px);box-shadow:inset 0 2px 5px rgba(15,23,42,.24),0 5px 12px rgba(37,99,235,.22)}.add:focus-visible{outline:2px solid rgba(37,99,235,.55);outline-offset:3px}.period{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px;border:1px solid rgba(148,163,184,.16);border-radius:17px;background:rgba(255,255,255,.78);box-shadow:0 8px 20px rgba(15,23,42,.05);margin-bottom:10px}.period button{width:42px;min-height:42px;border:0;border-radius:12px;background:transparent;color:#334155;font-size:24px;cursor:pointer}.period-label{font:inherit;font-size:13px;font-weight:900}.filters{display:grid;grid-template-columns:1.6fr repeat(4,1fr);gap:7px;margin-bottom:10px}.input,.select{width:100%;min-height:43px;box-sizing:border-box;border:1px solid rgba(148,163,184,.2);border-radius:12px;background:#fff;color:#334155;padding:0 10px;font:inherit;font-size:11px;font-weight:700;outline:none}.input:focus,.select:focus{border-color:rgba(37,99,235,.45);box-shadow:0 0 0 3px rgba(37,99,235,.08)}.context{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 14px}.chip{display:inline-flex;align-items:center;gap:5px;min-height:28px;padding:0 9px;border:1px solid rgba(37,99,235,.15);border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:10px;font-weight:850}.chip button{border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;padding:0}.group{margin-bottom:15px}.group-title{margin:0 0 6px 4px;color:#64748b;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.list{overflow:hidden;border:1px solid rgba(148,163,184,.16);border-radius:18px;background:rgba(255,255,255,.9);box-shadow:0 10px 25px rgba(15,23,42,.05)}.row{width:100%;display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:11px;align-items:center;padding:12px;border:0;border-bottom:1px solid rgba(148,163,184,.11);background:transparent;text-align:left;cursor:pointer}.row:last-child{border-bottom:0}.row:hover{background:rgba(37,99,235,.035)}.mark{width:40px;height:40px;display:grid;place-items:center;border-radius:13px;background:rgba(37,99,235,.08);color:#2563eb;font-size:17px;font-weight:950}.main{min-width:0}.name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#172033;font-size:12px;font-weight:900}.meta{display:block;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#94a3b8;font-size:10px;font-weight:650}.amount{white-space:nowrap;color:#334155;font-size:12px;font-weight:950}.amount[data-type=income]{color:#047857}.amount[data-type=expense]{color:#b91c1c}.empty,.loading,.errorbox{padding:30px 18px;text-align:center;border:1px solid rgba(148,163,184,.16);border-radius:20px;background:rgba(255,255,255,.85)}.empty h3{margin:0;color:#172033;font-size:15px;font-weight:950}.empty p,.errorbox p{max-width:420px;margin:6px auto 14px;color:#64748b;font-size:11px;line-height:1.55;font-weight:650}.empty button,.retry{min-height:43px;padding:0 13px;border-radius:12px;border:1px solid rgba(37,99,235,.18);background:#2563eb;color:#fff;font:inherit;font-size:11px;font-weight:900;cursor:pointer}.toast{position:fixed;left:50%;bottom:84px;z-index:1300;transform:translateX(-50%);padding:10px 14px;border-radius:999px;background:rgba(15,23,42,.94);color:#fff;font-size:11px;font-weight:850;box-shadow:0 12px 28px rgba(15,23,42,.22)}.detail-backdrop{position:fixed;inset:0;z-index:1100;display:grid;place-items:end center;padding:10px;background:rgba(15,23,42,.4);backdrop-filter:blur(5px)}.detail{width:min(560px,100%);box-sizing:border-box;border:1px solid rgba(148,163,184,.18);border-radius:24px;background:#fff;padding:17px;box-shadow:0 28px 65px rgba(15,23,42,.23)}.detail-top{display:flex;justify-content:space-between;gap:12px}.detail h3{margin:0;color:#0f172a;font-size:20px;font-weight:950}.close{width:40px;height:40px;border:1px solid rgba(148,163,184,.18);border-radius:12px;background:#fff;color:#475569;font-size:20px;cursor:pointer}.detail-amount{margin:15px 0;padding:17px;border-radius:17px;background:linear-gradient(145deg,#f8fafc,#fff);font-size:28px;font-weight:950;letter-spacing:-.04em}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.detail-cell{padding:11px;border:1px solid rgba(148,163,184,.13);border-radius:13px}.detail-cell span{display:block;color:#94a3b8;font-size:9px;font-weight:850;text-transform:uppercase;letter-spacing:.08em}.detail-cell strong{display:block;margin-top:4px;color:#334155;font-size:11px;font-weight:850}.detail-actions{display:flex;gap:8px;margin-top:14px}.detail-actions button{flex:1;min-height:47px;border-radius:13px;font:inherit;font-size:11px;font-weight:900;cursor:pointer}.edit{border:1px solid rgba(37,99,235,.18);background:#2563eb;color:#fff}.delete{border:1px solid rgba(220,38,38,.16);background:#fff;color:#b91c1c}@media(max-width:800px){.filters{grid-template-columns:1fr 1fr}.filters .input{grid-column:1/-1}}@media(max-width:560px){.toolbar{align-items:flex-end}.add{min-height:44px;padding:0 15px;border-radius:13px}.filters{grid-template-columns:1fr}.filters .input{grid-column:auto}.detail-backdrop{padding:0}.detail{border-radius:23px 23px 0 0}}@media(max-width:340px){.add{min-height:42px;padding:0 13px;font-size:10px}}`}</style>

    <div className="toolbar"><div><p className="subtitle">Your Expense Manager ledger, backed by real persisted records.</p></div><button type="button" className="add" onClick={openAdd}>+ Add Transaction</button></div>
    <div className="period"><button type="button" aria-label="Previous month" onClick={() => { setShowAllDates(false); setPeriod((value) => monthAnchor(value, -1)); }}>‹</button><button type="button" className="period-label" onClick={() => setShowAllDates((value) => !value)} aria-pressed={showAllDates}>{showAllDates ? 'All dates' : bounds.label}</button><button type="button" aria-label="Next month" onClick={() => { setShowAllDates(false); setPeriod((value) => monthAnchor(value, 1)); }}>›</button></div>
    <div className="filters" aria-label="Transaction filters">
      <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search category, subcategory, account or note" aria-label="Search transactions" />
      <select className="select" value={filterType} onChange={(event) => setFilterType(event.target.value as FilterType)} aria-label="Transaction type"><option value="all">All types</option><option value="expense">Expenses</option><option value="income">Income</option><option value="transfer">Transfers</option></select>
      <select className="select" value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)} aria-label="Account filter"><option value="all">All accounts</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
      <select className="select" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setSubcategoryFilter('all'); }} aria-label="Category filter"><option value="all">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
      <select className="select" value={subcategoryFilter} onChange={(event) => setSubcategoryFilter(event.target.value)} aria-label="Subcategory filter" disabled={availableSubcategories.length === 0}><option value="all">All subcategories</option>{availableSubcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}</select>
    </div>

    {(activeCategory || activeSubcategory) && <div className="context" aria-label="Active transaction filters">
      {activeCategory && <span className="chip">Category: {activeCategory.name}<button type="button" aria-label="Clear category filter" onClick={() => { setCategoryFilter('all'); setSubcategoryFilter('all'); }}>×</button></span>}
      {activeSubcategory && <span className="chip">Subcategory: {activeSubcategory.name}<button type="button" aria-label="Clear subcategory filter" onClick={() => setSubcategoryFilter('all')}>×</button></span>}
    </div>}

    {loading ? <div className="loading">Loading persisted transactions…</div> : loadError ? <div className="errorbox"><p>{loadError}</p><button type="button" className="retry" onClick={() => void load()}>Retry</button></div> : grouped.length === 0 ? <div className="empty"><h3>{activeSubcategory ? `No transactions for ${activeSubcategory.name}` : activeCategory ? `No transactions for ${activeCategory.name}` : 'No transactions found'}</h3><p>The result is based on your persisted Expense Manager records and the filters currently selected.</p><button type="button" onClick={openAdd}>Add Transaction</button></div> : grouped.map(([date, rows]) => <div className="group" key={date}><h3 className="group-title">{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${date}T00:00:00`))}</h3><div className="list">{rows.map((transaction) => <button type="button" className="row" key={transaction.id} onClick={() => setSelected(transaction)}><span className="mark">{transaction.category_icon || transactionSign(transaction.type)}</span><span className="main"><span className="name">{transaction.note || transaction.category_name || transaction.subcategory_name || (transaction.type === 'transfer' ? 'Transfer' : 'Transaction')}</span><span className="meta">{[transaction.category_name, transaction.subcategory_name, transaction.account_name].filter(Boolean).join(' · ') || 'Uncategorized'}</span></span><span className="amount" data-type={transaction.type}>{formatTransactionAmount(transaction.type, transaction.amount, transaction.account_currency)}</span></button>)}</div></div>)}

    {selected && <div className="detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deletePending) setSelected(null); }}><section className="detail" role="dialog" aria-modal="true" aria-labelledby="transaction-detail-title"><div className="detail-top"><h3 id="transaction-detail-title">Transaction</h3><button type="button" className="close" onClick={() => setSelected(null)} aria-label="Close transaction details">×</button></div><div className="detail-amount">{formatTransactionAmount(selected.type, selected.amount, selected.account_currency)}</div><div className="detail-grid"><div className="detail-cell"><span>Category</span><strong>{selected.category_name || 'None'}</strong></div><div className="detail-cell"><span>Subcategory</span><strong>{selected.subcategory_name || 'None'}</strong></div><div className="detail-cell"><span>Account</span><strong>{selected.account_name || 'None'}</strong></div><div className="detail-cell"><span>Date</span><strong>{selected.date}</strong></div><div className="detail-cell"><span>Note</span><strong>{selected.note || 'None'}</strong></div><div className="detail-cell"><span>Type</span><strong>{selected.type}</strong></div></div><div className="detail-actions"><button type="button" className="edit" onClick={() => openEdit(selected)}>Edit</button><button type="button" className="delete" disabled={deletePending} onClick={() => void deleteSelected()}>{deletePending ? 'Deleting…' : 'Delete'}</button></div></section></div>}
    {entryOpen && <ExpenseTransactionEntry accounts={accounts} categories={categories} initialTransaction={editing} onSave={save} onCreateAccount={createAccount} onCreateCategory={createCategory} onClose={() => { setEntryOpen(false); setEditing(null); }} />}
    {saveMessage && <div className="toast" role="status">{saveMessage}</div>}
  </section>;
}
