import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { archiveExpenseCategory, createExpenseCategoryRecord, getExpenseCategoryUsage, loadExpenseCategories, loadExpenseCategoryUsage, updateExpenseCategoryRecord } from '../data/expenseManagerCategories';
import { CATEGORY_COLOR_OPTIONS, CATEGORY_ICON_OPTIONS, categoryTypeLabel, EXPENSE_CATEGORY_TYPES, validateCategoryInput } from '../domain/categories';
import type { ExpenseCategoryRecord, ExpenseCategoryType } from '../domain/categories';

interface ExpenseCategoriesPageProps { onNavigate: (path: string) => void; }
type FormState = { name: string; type: ExpenseCategoryType; icon: string; color: string };
const emptyForm: FormState = { name: '', type: 'expense', icon: '✨', color: CATEGORY_COLOR_OPTIONS[0] };

function amount(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

export function ExpenseCategoriesPage({ onNavigate: _onNavigate }: ExpenseCategoriesPageProps) {
  const [userId, setUserId] = useState('');
  const [categories, setCategories] = useState<ExpenseCategoryRecord[]>([]);
  const [usage, setUsage] = useState<Record<string, { transactionCount: number; totalAmount: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseCategoryRecord | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [nextCategories, nextUsage] = await Promise.all([loadExpenseCategories(userId), loadExpenseCategoryUsage(userId)]);
      setCategories(nextCategories); setUsage(nextUsage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your categories.');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!active) return;
      if (authError || !data.user) { setError('Your signed-in session could not be resolved.'); setLoading(false); return; }
      setUserId(data.user.id);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => { if (userId) void load(); }, [userId]);

  useEffect(() => {
    if (!formOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) setFormOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [formOpen, saving]);

  const groups = useMemo(() => ({
    expense: categories.filter((category) => category.type === 'expense'),
    income: categories.filter((category) => category.type === 'income'),
  }), [categories]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setFormError(''); setFormOpen(true); };
  const openEdit = (category: ExpenseCategoryRecord) => {
    setEditing(category); setForm({ name: category.name, type: category.type, icon: category.icon || '✨', color: category.color || CATEGORY_COLOR_OPTIONS[0] }); setFormError(''); setFormOpen(true);
  };

  const save = async () => {
    const normalized = { ...form, name: form.name.trim() };
    const validationError = validateCategoryInput(normalized);
    if (validationError) { setFormError(validationError); return; }
    if (!userId) { setFormError('Your signed-in session could not be resolved.'); return; }
    setSaving(true); setFormError('');
    try {
      if (editing && editing.type !== normalized.type) {
        const transactionCount = await getExpenseCategoryUsage(userId, editing.id);
        if (transactionCount > 0) {
          setFormError(`This category is used by ${transactionCount} transaction${transactionCount === 1 ? '' : 's'}. Keep its type unchanged to preserve transaction integrity.`);
          return;
        }
      }
      if (editing) await updateExpenseCategoryRecord(userId, editing.id, normalized);
      else await createExpenseCategoryRecord(userId, normalized);
      await load();
      setFormOpen(false); setEditing(null); setNotice(editing ? 'Category updated' : 'Category created');
      window.setTimeout(() => setNotice(''), 2200);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not save the category.');
    } finally { setSaving(false); }
  };

  const archive = async (category: ExpenseCategoryRecord) => {
    const transactionCount = usage[category.id]?.transactionCount ?? 0;
    const message = transactionCount > 0
      ? `Archive “${category.name}”? Its ${transactionCount} existing transaction${transactionCount === 1 ? '' : 's'} will remain unchanged. The category will stop appearing for new entries.`
      : `Archive “${category.name}”? It will stop appearing for new entries.`;
    if (!window.confirm(message)) return;
    setArchivingId(category.id); setError('');
    try {
      await archiveExpenseCategory(userId, category.id);
      await load();
      setNotice('Category archived');
      window.setTimeout(() => setNotice(''), 2200);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not archive the category.');
    } finally { setArchivingId(''); }
  };

  const renderGroup = (type: ExpenseCategoryType, items: ExpenseCategoryRecord[]) => (
    <section className="expense-categories__group" aria-labelledby={`category-group-${type}`}>
      <div className="expense-categories__group-head"><div><h3 id={`category-group-${type}`}>{categoryTypeLabel(type)} categories</h3><p>{items.length} active {items.length === 1 ? 'category' : 'categories'}</p></div><span className={`expense-categories__type-pill expense-categories__type-pill--${type}`}>{type === 'income' ? '↗ Income' : '↘ Expense'}</span></div>
      {items.length === 0 ? <div className="expense-categories__group-empty">No {type} categories yet.</div> : <div className="expense-categories__grid">{items.map((category) => {
        const stats = usage[category.id] ?? { transactionCount: 0, totalAmount: 0 };
        return <article className="expense-category-card" key={category.id}>
          <div className="expense-category-card__top"><div className="expense-category-card__identity"><span className="expense-category-card__icon" style={{ borderColor: `${category.color || '#2563eb'}2b`, background: `${category.color || '#2563eb'}12` }} aria-hidden="true">{category.icon || '✨'}</span><div><h4>{category.name}</h4><p>{stats.transactionCount} {stats.transactionCount === 1 ? 'transaction' : 'transactions'}</p></div></div><div className="expense-category-card__actions"><button type="button" onClick={() => openEdit(category)} aria-label={`Edit ${category.name}`}>✎</button><button type="button" onClick={() => void archive(category)} disabled={archivingId === category.id} aria-label={`Archive ${category.name}`}>{archivingId === category.id ? '…' : '⌁'}</button></div></div>
          <div className="expense-category-card__meta"><span>Activity</span><strong>{stats.totalAmount ? amount(stats.totalAmount) : '—'}</strong></div>
        </article>;
      })}</div>}
    </section>
  );

  return <section className="expense-categories" aria-labelledby="expense-manager-title">
    <style>{`.expense-categories{width:min(1120px,100%);margin:0 auto;padding:0 2px 110px;box-sizing:border-box}.expense-categories__toolbar{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:18px}.expense-categories__title{margin:0;color:#0f172a;font-size:clamp(23px,6vw,32px);line-height:1.05;letter-spacing:-.045em;font-weight:950}.expense-categories__subtitle{max-width:660px;margin:6px 0 0;color:#64748b;font-size:11px;line-height:1.5;font-weight:650}.expense-categories__add{min-height:46px;padding:0 15px;border:1px solid rgba(37,99,235,.2);border-radius:14px;background:linear-gradient(145deg,#2563eb,#4f46e5);color:#fff;font:inherit;font-size:12px;font-weight:900;box-shadow:0 9px 18px rgba(37,99,235,.18);cursor:pointer;white-space:nowrap}.expense-categories__group{margin-top:20px}.expense-categories__group-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}.expense-categories__group-head h3{margin:0;color:#172033;font-size:14px;font-weight:950}.expense-categories__group-head p{margin:4px 0 0;color:#94a3b8;font-size:9px;font-weight:750}.expense-categories__type-pill{padding:7px 9px;border:1px solid rgba(148,163,184,.14);border-radius:999px;background:rgba(255,255,255,.72);font-size:9px;font-weight:900}.expense-categories__type-pill--expense{color:#b45309}.expense-categories__type-pill--income{color:#047857}.expense-categories__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.expense-category-card{min-width:0;padding:15px;border:1px solid rgba(148,163,184,.17);border-radius:19px;background:linear-gradient(145deg,rgba(255,255,255,.96),rgba(248,250,252,.82));box-shadow:0 12px 28px rgba(15,23,42,.06),inset 0 1px 0 rgba(255,255,255,.9)}.expense-category-card__top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.expense-category-card__identity{display:flex;align-items:center;gap:10px;min-width:0}.expense-category-card__icon{width:45px;height:45px;flex:0 0 45px;display:grid;place-items:center;border:1px solid;border-radius:14px;font-size:21px}.expense-category-card h4{margin:0;color:#172033;font-size:13px;font-weight:950;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.expense-category-card__identity p{margin:4px 0 0;color:#94a3b8;font-size:9px;font-weight:750}.expense-category-card__actions{display:flex;gap:5px}.expense-category-card__actions button{width:34px;height:34px;border:1px solid rgba(148,163,184,.17);border-radius:10px;background:#fff;color:#475569;font:inherit;font-size:14px;cursor:pointer}.expense-category-card__actions button:disabled{opacity:.55;cursor:wait}.expense-category-card__meta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:15px;padding-top:10px;border-top:1px solid rgba(148,163,184,.11);color:#94a3b8;font-size:9px;font-weight:800}.expense-category-card__meta strong{color:#172033;font-size:11px}.expense-categories__group-empty,.expense-categories__state,.expense-categories__empty{padding:28px 18px;text-align:center;border:1px solid rgba(148,163,184,.16);border-radius:20px;background:rgba(255,255,255,.88);box-shadow:0 12px 28px rgba(15,23,42,.05);color:#64748b;font-size:11px;font-weight:700}.expense-categories__empty-icon{width:58px;height:58px;margin:0 auto 11px;display:grid;place-items:center;border-radius:18px;background:rgba(37,99,235,.08);color:#2563eb;font-size:25px}.expense-categories__empty h3,.expense-categories__state h3{margin:0;color:#172033;font-size:16px;font-weight:950}.expense-categories__empty p,.expense-categories__state p{max-width:440px;margin:7px auto 15px;color:#64748b;font-size:11px;line-height:1.6;font-weight:650}.expense-categories__empty button,.expense-categories__state button{min-height:43px;padding:0 14px;border:1px solid rgba(37,99,235,.18);border-radius:12px;background:#2563eb;color:#fff;font:inherit;font-size:11px;font-weight:900;cursor:pointer}.expense-categories__notice{position:fixed;left:50%;bottom:84px;z-index:1300;transform:translateX(-50%);padding:10px 15px;border:1px solid rgba(16,185,129,.18);border-radius:999px;background:rgba(15,23,42,.94);color:#fff;font-size:11px;font-weight:850;box-shadow:0 12px 28px rgba(15,23,42,.22)}.expense-categories__backdrop{position:fixed;inset:0;z-index:1200;display:grid;place-items:end center;padding:10px;background:rgba(15,23,42,.42);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}.expense-categories__dialog{width:min(560px,100%);max-height:min(760px,92vh);overflow:auto;box-sizing:border-box;padding:18px;border:1px solid rgba(148,163,184,.18);border-radius:24px;background:#fff;box-shadow:0 28px 65px rgba(15,23,42,.23)}.expense-categories__dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.expense-categories__dialog h3{margin:0;color:#0f172a;font-size:19px;font-weight:950}.expense-categories__dialog p{margin:4px 0 0;color:#64748b;font-size:10px;font-weight:650;line-height:1.5}.expense-categories__close{width:40px;height:40px;border:1px solid rgba(148,163,184,.18);border-radius:12px;background:#fff;color:#475569;font-size:19px;cursor:pointer}.expense-categories__form{display:grid;gap:14px;margin-top:17px}.expense-categories__field{display:grid;gap:6px}.expense-categories__field label{color:#334155;font-size:10px;font-weight:900}.expense-categories__field input,.expense-categories__field select{width:100%;min-height:46px;box-sizing:border-box;border:1px solid rgba(148,163,184,.2);border-radius:13px;background:#fff;color:#172033;padding:0 12px;font:inherit;font-size:12px;font-weight:700;outline:none}.expense-categories__field input:focus,.expense-categories__field select:focus{border-color:rgba(37,99,235,.45);box-shadow:0 0 0 3px rgba(37,99,235,.08)}.expense-categories__choice-label{color:#334155;font-size:10px;font-weight:900}.expense-categories__choice-row{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.expense-categories__choice{min-height:46px;border:1px solid rgba(148,163,184,.18);border-radius:13px;background:#fff;color:#475569;font:inherit;font-size:11px;font-weight:850;cursor:pointer}.expense-categories__choice--active{border-color:rgba(37,99,235,.35);background:rgba(37,99,235,.07);color:#1d4ed8;box-shadow:inset 0 0 0 1px rgba(37,99,235,.08)}.expense-categories__icons{display:grid;grid-template-columns:repeat(8,1fr);gap:6px}.expense-categories__icon-choice{aspect-ratio:1;border:1px solid rgba(148,163,184,.15);border-radius:11px;background:#fff;font-size:19px;cursor:pointer}.expense-categories__icon-choice--active{border-color:rgba(37,99,235,.38);background:rgba(37,99,235,.07);box-shadow:inset 0 0 0 1px rgba(37,99,235,.1)}.expense-categories__colors{display:flex;flex-wrap:wrap;gap:8px}.expense-categories__color-choice{width:30px;height:30px;border:2px solid transparent;border-radius:50%;cursor:pointer;box-shadow:0 2px 7px rgba(15,23,42,.12)}.expense-categories__color-choice--active{outline:2px solid #fff;box-shadow:0 0 0 3px rgba(37,99,235,.35)}.expense-categories__error{padding:10px 11px;border:1px solid rgba(220,38,38,.14);border-radius:12px;background:rgba(254,226,226,.6);color:#991b1b;font-size:10px;font-weight:750;line-height:1.45}.expense-categories__actions{display:flex;gap:8px}.expense-categories__actions button{flex:1;min-height:47px;border-radius:13px;font:inherit;font-size:11px;font-weight:900;cursor:pointer}.expense-categories__cancel{border:1px solid rgba(148,163,184,.2);background:#fff;color:#475569}.expense-categories__save{border:1px solid rgba(37,99,235,.2);background:linear-gradient(145deg,#2563eb,#4f46e5);color:#fff}.expense-categories__save:disabled{opacity:.6;cursor:wait}@media(max-width:760px){.expense-categories__add{width:48px;padding:0;font-size:0}.expense-categories__add::after{content:'+';font-size:22px}.expense-categories__grid{grid-template-columns:1fr}.expense-categories__backdrop{padding:0}.expense-categories__dialog{border-radius:23px 23px 0 0;padding-bottom:max(18px,env(safe-area-inset-bottom))}}@media(max-width:390px){.expense-categories__icons{grid-template-columns:repeat(6,1fr)}}`}</style>
    <div className="expense-categories__toolbar"><div><p className="expense-categories__subtitle">Organize expenses and income with real, user-owned categories. Archived categories stay out of new entries without destroying financial history.</p></div><button type="button" className="expense-categories__add" onClick={openAdd} aria-label="Add category"><span>＋ Add category</span></button></div>

    {loading ? <div className="expense-categories__state" aria-live="polite"><h3>Loading categories</h3><p>Fetching your persisted Expense Manager categories and transaction activity.</p></div> : error ? <div className="expense-categories__state" role="alert"><h3>Categories could not be loaded</h3><p>{error}</p><button type="button" onClick={() => void load()}>Retry</button></div> : categories.length === 0 ? <div className="expense-categories__empty"><div className="expense-categories__empty-icon" aria-hidden="true">✦</div><h3>Build your categories</h3><p>Create the categories you use to organize money coming in and going out. New categories become available to the existing transaction entry flow.</p><button type="button" onClick={openAdd}>Add your first category</button></div> : <>{renderGroup('expense', groups.expense)}{renderGroup('income', groups.income)}</>}

    <div className="expense-categories__notice" hidden={!notice} role="status">✓ {notice}</div>

    {formOpen && <div className="expense-categories__backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setFormOpen(false); }}><section className="expense-categories__dialog" role="dialog" aria-modal="true" aria-labelledby="category-form-title"><div className="expense-categories__dialog-head"><div><h3 id="category-form-title">{editing ? 'Edit category' : 'Add category'}</h3><p>{editing ? 'Update the persisted category without creating a replacement.' : 'Create a category for fast, type-safe transaction entry.'}</p></div><button type="button" className="expense-categories__close" onClick={() => !saving && setFormOpen(false)} aria-label="Close category form">×</button></div><form className="expense-categories__form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <div className="expense-categories__field"><label htmlFor="expense-category-name">Category name</label><input id="expense-category-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={80} autoFocus placeholder="e.g. Groceries" /></div>
      <div className="expense-categories__field"><span className="expense-categories__choice-label">Type</span><div className="expense-categories__choice-row">{EXPENSE_CATEGORY_TYPES.map((item) => <button key={item.value} type="button" className={`expense-categories__choice ${form.type === item.value ? 'expense-categories__choice--active' : ''}`} onClick={() => setForm((current) => ({ ...current, type: item.value }))}>{item.icon} {item.label}</button>)}</div></div>
      <div className="expense-categories__field"><span className="expense-categories__choice-label">Icon</span><div className="expense-categories__icons" role="group" aria-label="Category icon">{CATEGORY_ICON_OPTIONS.map((icon) => <button key={icon} type="button" className={`expense-categories__icon-choice ${form.icon === icon ? 'expense-categories__icon-choice--active' : ''}`} onClick={() => setForm((current) => ({ ...current, icon }))} aria-label={`Use ${icon} icon`} aria-pressed={form.icon === icon}>{icon}</button>)}</div></div>
      <div className="expense-categories__field"><span className="expense-categories__choice-label">Accent</span><div className="expense-categories__colors" role="group" aria-label="Category color">{CATEGORY_COLOR_OPTIONS.map((color) => <button key={color} type="button" className={`expense-categories__color-choice ${form.color === color ? 'expense-categories__color-choice--active' : ''}`} style={{ background: color }} onClick={() => setForm((current) => ({ ...current, color }))} aria-label={`Use ${color} accent`} aria-pressed={form.color === color} />)}</div></div>
      {formError && <div className="expense-categories__error" role="alert">{formError}</div>}
      <div className="expense-categories__actions"><button type="button" className="expense-categories__cancel" onClick={() => !saving && setFormOpen(false)}>Cancel</button><button type="submit" className="expense-categories__save" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create category'}</button></div>
    </form></section></div>}
  </section>;
}
