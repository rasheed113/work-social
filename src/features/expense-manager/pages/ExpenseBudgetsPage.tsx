import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { createExpenseBudget, getExpenseBudgetByPeriod, loadExpenseBudgets, updateExpenseBudget } from '../data/expenseManagerBudgets';
import { loadExpenseCategories } from '../data/expenseManagerCategories';
import { budgetRemaining, budgetRatio, budgetState, monthBounds, monthValue, validateBudgetInput } from '../domain/budgets';
import type { ExpenseBudgetRecord, ExpenseBudgetInput } from '../domain/budgets';
import type { ExpenseCategoryRecord } from '../domain/categories';

interface ExpenseBudgetsPageProps { onNavigate: (path: string) => void; }
type FormState = { categoryId: string; amount: string; month: string };

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function amount(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function monthLabel(value: string): string {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function databaseError(cause: unknown): string {
  const error = cause as { code?: string; message?: string };
  if (error?.code === '23505') return 'A budget for this category and month already exists.';
  if (error?.code === '23514') return error.message || 'The budget does not satisfy the product rules.';
  return error instanceof Error ? error.message : 'Could not save the budget.';
}

export function ExpenseBudgetsPage({ onNavigate }: ExpenseBudgetsPageProps) {
  const [userId, setUserId] = useState('');
  const [budgets, setBudgets] = useState<ExpenseBudgetRecord[]>([]);
  const [categories, setCategories] = useState<ExpenseCategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseBudgetRecord | null>(null);
  const [form, setForm] = useState<FormState>({ categoryId: '', amount: '', month: currentMonth() });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const [nextBudgets, nextCategories] = await Promise.all([
        loadExpenseBudgets(),
        loadExpenseCategories(userId),
      ]);
      setBudgets(nextBudgets);
      setCategories(nextCategories.filter((category) => category.type === 'expense' && !category.is_archived));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your budgets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!active) return;
      if (authError || !data.user) {
        setError('Your signed-in session could not be resolved.');
        setLoading(false);
        return;
      }
      setUserId(data.user.id);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => { if (userId) void load(); }, [userId]);

  useEffect(() => {
    if (!formOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) setFormOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [formOpen, saving]);

  const activeBudgetCount = budgets.filter((budget) => !budget.category_archived).length;
  const totals = useMemo(() => budgets.reduce((result, budget) => {
    result.limit += budget.budget_amount;
    result.spent += budget.spent;
    return result;
  }, { limit: 0, spent: 0 }), [budgets]);

  const openAdd = () => {
    setEditing(null);
    setForm({ categoryId: categories[0]?.id ?? '', amount: '', month: currentMonth() });
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (budget: ExpenseBudgetRecord) => {
    if (budget.category_archived) {
      setError('Archived categories cannot be assigned to a new or edited budget.');
      return;
    }
    setEditing(budget);
    setForm({ categoryId: budget.category_id, amount: String(budget.budget_amount), month: monthValue(budget.start_date) });
    setFormError('');
    setFormOpen(true);
  };

  const save = async () => {
    if (!userId) {
      setFormError('Your signed-in session could not be resolved.');
      return;
    }
    let bounds: { startDate: string; endDate: string };
    try {
      bounds = monthBounds(form.month);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Choose a valid budget month.');
      return;
    }
    const input: ExpenseBudgetInput = {
      categoryId: form.categoryId,
      amount: Number(form.amount),
      period: 'monthly',
      ...bounds,
    };
    const validationError = validateBudgetInput(input);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      if (await getExpenseBudgetByPeriod(userId, input.categoryId, input.startDate, input.endDate, editing?.id)) {
        setFormError('A budget for this category and month already exists. Edit the existing budget instead.');
        return;
      }
      if (editing) await updateExpenseBudget(userId, editing.id, input);
      else await createExpenseBudget(userId, input);
      await load();
      setFormOpen(false);
      setEditing(null);
      setNotice(editing ? 'Budget updated' : 'Budget created');
      window.setTimeout(() => setNotice(''), 2200);
    } catch (cause) {
      setFormError(databaseError(cause));
    } finally {
      setSaving(false);
    }
  };

  return <section className="expense-budgets" aria-labelledby="budgets-heading">
    <style>{`.expense-budgets{width:min(1120px,100%);margin:0 auto;padding:0 2px 110px;box-sizing:border-box}.expense-budgets__toolbar{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:18px}.expense-budgets__title{margin:0;color:#0f172a;font-size:clamp(23px,6vw,32px);line-height:1.05;letter-spacing:-.045em;font-weight:950}.expense-budgets__subtitle{max-width:680px;margin:6px 0 0;color:#64748b;font-size:11px;line-height:1.55;font-weight:650}.expense-budgets__add{min-height:46px;padding:0 15px;border:1px solid rgba(37,99,235,.2);border-radius:14px;background:linear-gradient(145deg,#2563eb,#4f46e5);color:#fff;font:inherit;font-size:12px;font-weight:900;box-shadow:0 9px 18px rgba(37,99,235,.18);cursor:pointer;white-space:nowrap}.expense-budgets__summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:18px}.expense-budgets__summary-card{padding:14px;border:1px solid rgba(148,163,184,.16);border-radius:17px;background:rgba(255,255,255,.82);box-shadow:0 10px 24px rgba(15,23,42,.05)}.expense-budgets__summary-label{color:#94a3b8;font-size:9px;font-weight:850;text-transform:uppercase;letter-spacing:.08em}.expense-budgets__summary-value{margin-top:5px;color:#172033;font-size:18px;font-weight:950;letter-spacing:-.03em}.expense-budgets__summary-note{margin-top:3px;color:#64748b;font-size:9px;font-weight:700}.expense-budgets__list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.expense-budget-card{min-width:0;padding:16px;border:1px solid rgba(148,163,184,.17);border-radius:20px;background:linear-gradient(145deg,rgba(255,255,255,.97),rgba(248,250,252,.84));box-shadow:0 12px 30px rgba(15,23,42,.06),inset 0 1px 0 rgba(255,255,255,.9)}.expense-budget-card--archived{opacity:.72}.expense-budget-card__head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.expense-budget-card__identity{display:flex;align-items:center;gap:10px;min-width:0}.expense-budget-card__icon{width:44px;height:44px;flex:0 0 44px;display:grid;place-items:center;border:1px solid rgba(37,99,235,.12);border-radius:14px;background:rgba(37,99,235,.07);font-size:20px}.expense-budget-card__identity h3{margin:0;color:#172033;font-size:14px;font-weight:950;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.expense-budget-card__identity p{margin:4px 0 0;color:#94a3b8;font-size:9px;font-weight:750}.expense-budget-card__edit{width:36px;height:36px;border:1px solid rgba(148,163,184,.17);border-radius:10px;background:#fff;color:#475569;font:inherit;font-size:14px;cursor:pointer}.expense-budget-card__edit:disabled{opacity:.45;cursor:not-allowed}.expense-budget-card__numbers{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-top:17px}.expense-budget-card__spent{color:#172033;font-size:19px;font-weight:950;letter-spacing:-.035em}.expense-budget-card__limit{color:#64748b;font-size:10px;font-weight:800}.expense-budget-card__state{font-size:9px;font-weight:950}.expense-budget-card__state--healthy{color:#047857}.expense-budget-card__state--approaching{color:#b45309}.expense-budget-card__state--exceeded{color:#b91c1c}.expense-budget-card__bar{height:9px;margin-top:11px;overflow:hidden;border-radius:999px;background:#e2e8f0}.expense-budget-card__bar-fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,#2563eb,#4f46e5);transition:width .2s ease}.expense-budget-card__bar-fill--exceeded{background:linear-gradient(90deg,#f59e0b,#dc2626)}.expense-budget-card__footer{display:flex;justify-content:space-between;gap:10px;margin-top:10px;color:#64748b;font-size:9px;font-weight:750}.expense-budget-card__footer strong{color:#172033}.expense-budgets__state,.expense-budgets__empty{padding:30px 18px;text-align:center;border:1px solid rgba(148,163,184,.16);border-radius:20px;background:rgba(255,255,255,.88);box-shadow:0 12px 28px rgba(15,23,42,.05);color:#64748b;font-size:11px;font-weight:700}.expense-budgets__empty-icon{width:58px;height:58px;margin:0 auto 11px;display:grid;place-items:center;border-radius:18px;background:rgba(37,99,235,.08);color:#2563eb;font-size:25px}.expense-budgets__empty h3,.expense-budgets__state h3{margin:0;color:#172033;font-size:16px;font-weight:950}.expense-budgets__empty p,.expense-budgets__state p{max-width:470px;margin:7px auto 15px;color:#64748b;font-size:11px;line-height:1.6;font-weight:650}.expense-budgets__empty button,.expense-budgets__state button{min-height:43px;padding:0 14px;border:1px solid rgba(37,99,235,.18);border-radius:12px;background:#2563eb;color:#fff;font:inherit;font-size:11px;font-weight:900;cursor:pointer}.expense-budgets__notice{position:fixed;left:50%;bottom:84px;z-index:1300;transform:translateX(-50%);padding:10px 15px;border:1px solid rgba(16,185,129,.18);border-radius:999px;background:rgba(15,23,42,.94);color:#fff;font-size:11px;font-weight:850;box-shadow:0 12px 28px rgba(15,23,42,.22)}.expense-budgets__backdrop{position:fixed;inset:0;z-index:1200;display:grid;place-items:end center;padding:10px;background:rgba(15,23,42,.42);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}.expense-budgets__dialog{width:min(560px,100%);max-height:min(760px,92vh);overflow:auto;box-sizing:border-box;padding:18px;border:1px solid rgba(148,163,184,.18);border-radius:24px;background:#fff;box-shadow:0 28px 65px rgba(15,23,42,.23)}.expense-budgets__dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.expense-budgets__dialog h3{margin:0;color:#0f172a;font-size:19px;font-weight:950}.expense-budgets__dialog p{margin:4px 0 0;color:#64748b;font-size:10px;font-weight:650;line-height:1.5}.expense-budgets__close{width:40px;height:40px;border:1px solid rgba(148,163,184,.18);border-radius:12px;background:#fff;color:#475569;font-size:19px;cursor:pointer}.expense-budgets__form{display:grid;gap:14px;margin-top:17px}.expense-budgets__field{display:grid;gap:6px}.expense-budgets__field label{color:#334155;font-size:10px;font-weight:900}.expense-budgets__field input,.expense-budgets__field select{width:100%;min-height:48px;box-sizing:border-box;border:1px solid rgba(148,163,184,.2);border-radius:13px;background:#fff;color:#172033;padding:0 12px;font:inherit;font-size:13px;font-weight:750;outline:none}.expense-budgets__field input:focus,.expense-budgets__field select:focus{border-color:rgba(37,99,235,.45);box-shadow:0 0 0 3px rgba(37,99,235,.08)}.expense-budgets__hint{margin-top:0;color:#94a3b8;font-size:9px;font-weight:700}.expense-budgets__form-error{padding:10px 12px;border:1px solid rgba(220,38,38,.13);border-radius:12px;background:rgba(254,226,226,.5);color:#b91c1c;font-size:10px;line-height:1.45;font-weight:800}.expense-budgets__form-actions{display:grid;grid-template-columns:1fr 1.4fr;gap:8px}.expense-budgets__form-actions button{min-height:46px;border-radius:13px;font:inherit;font-size:11px;font-weight:900;cursor:pointer}.expense-budgets__cancel{border:1px solid rgba(148,163,184,.18);background:#fff;color:#475569}.expense-budgets__save{border:1px solid rgba(37,99,235,.2);background:#2563eb;color:#fff}.expense-budgets__save:disabled{opacity:.6;cursor:wait}@media(max-width:700px){.expense-budgets__toolbar{align-items:stretch;flex-direction:column}.expense-budgets__add{width:100%}.expense-budgets__list{grid-template-columns:1fr}.expense-budgets__summary{grid-template-columns:1fr 1fr}}@media(min-width:768px){.expense-budgets__summary{grid-template-columns:repeat(3,minmax(0,1fr))}}`}</style>

    <div className="expense-budgets__toolbar">
      <div><h2 id="budgets-heading" className="expense-budgets__title">Budgets</h2><p className="expense-budgets__subtitle">Set a monthly limit for an expense category and see real spending move against it as transactions change.</p></div>
      <button type="button" className="expense-budgets__add" onClick={openAdd} disabled={!categories.length}>+ Add Budget</button>
    </div>

    {loading ? <div className="expense-budgets__state"><h3>Loading budgets</h3><p>Reading your persisted budgets and current transaction totals.</p></div> : error ? <div className="expense-budgets__state"><h3>Budgets could not load</h3><p>{error}</p><button type="button" onClick={() => void load()}>Retry</button></div> : budgets.length === 0 ? <div className="expense-budgets__empty"><div className="expense-budgets__empty-icon" aria-hidden="true">◎</div><h3>No budgets yet</h3><p>Create your first monthly category budget. Spending will be calculated from real Expense Manager transactions.</p><button type="button" onClick={openAdd} disabled={!categories.length}>{categories.length ? 'Add Budget' : 'Create an expense category first'}</button></div> : <>
      <div className="expense-budgets__summary" aria-label="Budget summary">
        <article className="expense-budgets__summary-card"><div className="expense-budgets__summary-label">Active budgets</div><div className="expense-budgets__summary-value">{activeBudgetCount}</div><div className="expense-budgets__summary-note">Archived categories are preserved.</div></article>
        <article className="expense-budgets__summary-card"><div className="expense-budgets__summary-label">Total limit</div><div className="expense-budgets__summary-value">{amount(totals.limit)}</div><div className="expense-budgets__summary-note">Across persisted budgets.</div></article>
        <article className="expense-budgets__summary-card"><div className="expense-budgets__summary-label">Actual spending</div><div className="expense-budgets__summary-value">{amount(totals.spent)}</div><div className="expense-budgets__summary-note">Expense transactions only.</div></article>
      </div>
      <div className="expense-budgets__list">
        {budgets.map((budget) => {
          const ratio = budgetRatio(budget.spent, budget.budget_amount);
          const state = budgetState(budget.spent, budget.budget_amount);
          const remaining = budgetRemaining(budget.spent, budget.budget_amount);
          return <article className={`expense-budget-card${budget.category_archived ? ' expense-budget-card--archived' : ''}`} key={budget.id}>
            <div className="expense-budget-card__head"><div className="expense-budget-card__identity"><span className="expense-budget-card__icon" style={{ borderColor: `${budget.category_color || '#2563eb'}2b`, background: `${budget.category_color || '#2563eb'}12` }} aria-hidden="true">{budget.category_icon || '◎'}</span><div><h3>{budget.category_name}</h3><p>{monthLabel(monthValue(budget.start_date))}{budget.category_archived ? ' · Archived category' : ''}</p></div></div><button type="button" className="expense-budget-card__edit" onClick={() => openEdit(budget)} disabled={budget.category_archived} aria-label={`Edit ${budget.category_name} budget`}>✎</button></div>
            <div className="expense-budget-card__numbers"><div><span className="expense-budget-card__spent">{amount(budget.spent)}</span> <span className="expense-budget-card__limit">/ {amount(budget.budget_amount)}</span></div><span className={`expense-budget-card__state expense-budget-card__state--${state === 'Approaching Limit' ? 'approaching' : state.toLowerCase()}`}>{state}</span></div>
            <div className="expense-budget-card__bar" aria-label={`${Math.round(ratio * 100)} percent of budget used`}><div className={`expense-budget-card__bar-fill${ratio > 1 ? ' expense-budget-card__bar-fill--exceeded' : ''}`} style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }} /></div>
            <div className="expense-budget-card__footer"><span>{ratio >= 1 ? <><strong>{amount(Math.abs(remaining))}</strong> over limit</> : <><strong>{amount(remaining)}</strong> remaining</>}</span><span>{Math.round(ratio * 100)}% used</span></div>
          </article>;
        })}
      </div>
    </>}

    {formOpen && <div className="expense-budgets__backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setFormOpen(false); }}><div className="expense-budgets__dialog" role="dialog" aria-modal="true" aria-labelledby="budget-form-title">
      <div className="expense-budgets__dialog-head"><div><h3 id="budget-form-title">{editing ? 'Edit budget' : 'Add budget'}</h3><p>Choose an expense category, monthly period, and real spending limit.</p></div><button type="button" className="expense-budgets__close" onClick={() => !saving && setFormOpen(false)} aria-label="Close budget form">×</button></div>
      <div className="expense-budgets__form">
        <div className="expense-budgets__field"><label htmlFor="budget-category">Expense category</label><select id="budget-category" value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}><option value="">Select a category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.icon ? `${category.icon} ` : ''}{category.name}</option>)}</select></div>
        <div className="expense-budgets__field"><label htmlFor="budget-amount">Monthly limit</label><input id="budget-amount" type="number" min="0.01" step="0.01" inputMode="decimal" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="15000" /><span className="expense-budgets__hint">The database remains authoritative for the final amount validation.</span></div>
        <div className="expense-budgets__field"><label htmlFor="budget-month">Budget month</label><input id="budget-month" type="month" value={form.month} onChange={(event) => setForm((current) => ({ ...current, month: event.target.value }))} /><span className="expense-budgets__hint">Monthly budgets are stored as the first through last day of the selected calendar month.</span></div>
        {formError && <div className="expense-budgets__form-error" role="alert">{formError}</div>}
        <div className="expense-budgets__form-actions"><button type="button" className="expense-budgets__cancel" onClick={() => !saving && setFormOpen(false)}>Cancel</button><button type="button" className="expense-budgets__save" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create budget'}</button></div>
      </div>
    </div></div>}
    {notice && <div className="expense-budgets__notice" role="status">✓ {notice}</div>}
    <div className="sr-only" aria-hidden="true">{onNavigate ? '' : ''}</div>
  </section>;
}
