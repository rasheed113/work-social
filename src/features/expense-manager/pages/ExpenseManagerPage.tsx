import type { ExpenseManagerSection } from '../components/ExpenseManagerNavigation';
import { ExpenseManagerNavigation } from '../components/ExpenseManagerNavigation';
import { ExpenseOverviewDashboard } from '../components/ExpenseOverviewDashboard';
import { ExpenseTransactionsPage } from './ExpenseTransactionsPage';

const sectionCopy: Record<ExpenseManagerSection, { title: string; description: string }> = {
  overview: { title: 'Financial Overview', description: 'Understand your current position, period spending, accounts, budgets, and recent activity from persisted Expense Manager data.' },
  transactions: { title: 'Transactions', description: 'Record, review, edit, and delete real Expense Manager transactions without leaving the finance module.' },
  accounts: { title: 'Accounts', description: 'Account management remains outside this phase. Existing accounts are consumed directly by Transactions.' },
  categories: { title: 'Categories', description: 'Category management remains outside this phase. Existing categories are consumed directly by Transactions.' },
  budgets: { title: 'Budgets', description: 'Budget management remains outside this phase.' },
  reports: { title: 'Reports', description: 'Reporting and advanced analytics remain outside this phase.' },
};

function sectionFromPath(pathname: string): ExpenseManagerSection {
  if (pathname === '/expense-manager') return 'overview';
  if (pathname === '/expense-manager/transactions') return 'transactions';
  if (pathname === '/expense-manager/accounts') return 'accounts';
  if (pathname === '/expense-manager/categories') return 'categories';
  if (pathname === '/expense-manager/budgets') return 'budgets';
  if (pathname === '/expense-manager/reports') return 'reports';
  return 'overview';
}

interface ExpenseManagerPageProps { pathname: string; onNavigate: (path: string) => void; }

export function ExpenseManagerPage({ pathname, onNavigate }: ExpenseManagerPageProps) {
  const section = sectionFromPath(pathname); const copy = sectionCopy[section];
  return <main className="expense-manager-page">
    <style>{`.expense-manager-page{min-height:100%;box-sizing:border-box;padding:0 10px 110px;background:radial-gradient(circle at 12% 4%,rgba(59,130,246,.09),transparent 28%),radial-gradient(circle at 92% 18%,rgba(20,184,166,.07),transparent 24%),linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%);color:#172033}.expense-manager-page__hero{width:min(1120px,100%);margin:0 auto;padding:16px 2px}.expense-manager-page__eyebrow{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border:1px solid rgba(37,99,235,.12);border-radius:999px;background:rgba(255,255,255,.72);color:#2563eb;font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;box-shadow:0 4px 12px rgba(15,23,42,.04)}.expense-manager-page__title{margin:11px 0 7px;font-size:clamp(26px,7vw,42px);line-height:1.04;letter-spacing:-.045em;font-weight:950;color:#0f172a}.expense-manager-page__description{max-width:680px;margin:0;color:#64748b;font-size:13px;line-height:1.6;font-weight:650}.expense-manager-page__card{width:min(1120px,100%);margin:0 auto;padding:18px;box-sizing:border-box;border:1px solid rgba(148,163,184,.17);border-radius:22px;background:linear-gradient(145deg,rgba(255,255,255,.9),rgba(248,250,252,.82));box-shadow:0 14px 34px rgba(15,23,42,.07),inset 0 1px 0 rgba(255,255,255,.9);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}.expense-manager-page__card-title{margin:0 0 7px;font-size:16px;line-height:1.25;font-weight:900;color:#172033}.expense-manager-page__card-copy{margin:0;color:#64748b;font-size:12px;line-height:1.6;font-weight:600}.expense-manager-page__boundary{display:flex;align-items:flex-start;gap:10px;margin-top:18px;padding:12px;border:1px solid rgba(20,184,166,.12);border-radius:15px;background:rgba(20,184,166,.045)}.expense-manager-page__boundary-mark{display:grid;place-items:center;width:30px;height:30px;flex:0 0 30px;border-radius:10px;background:rgba(20,184,166,.11);color:#0f766e;font-size:14px;font-weight:950}.expense-manager-page__boundary strong{display:block;margin-bottom:2px;font-size:11px;color:#134e4a}.expense-manager-page__boundary span{display:block;color:#64748b;font-size:10px;line-height:1.5;font-weight:600}@media(min-width:768px){.expense-manager-page{padding-left:18px;padding-right:18px}.expense-manager-page__hero{padding-top:22px}.expense-manager-page__card{padding:24px}}`}</style>
    <ExpenseManagerNavigation pathname={pathname} onNavigate={onNavigate} />
    <section className="expense-manager-page__hero" aria-labelledby="expense-manager-title"><span className="expense-manager-page__eyebrow">Expense Manager</span><h1 id="expense-manager-title" className="expense-manager-page__title">{copy.title}</h1><p className="expense-manager-page__description">{copy.description}</p></section>
    {section === 'overview' ? <ExpenseOverviewDashboard onNavigate={onNavigate} /> : section === 'transactions' ? <ExpenseTransactionsPage onNavigate={onNavigate} /> : <section className="expense-manager-page__card" aria-label={`${copy.title} module boundary`}><h2 className="expense-manager-page__card-title">Independent finance module</h2><p className="expense-manager-page__card-copy">This route remains intentionally scoped to the Expense Manager namespace. Phase 3 implements Transactions and fast entry only; later management/reporting modules are not silently expanded here.</p><div className="expense-manager-page__boundary"><span className="expense-manager-page__boundary-mark" aria-hidden="true">✓</span><div><strong>Phase 3 scope protected</strong><span>Transactions are live. Accounts, Categories, Budgets, and Reports remain separate Expense Manager phases.</span></div></div></section>}
  </main>;
}
