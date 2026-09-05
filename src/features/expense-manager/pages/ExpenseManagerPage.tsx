import type { ExpenseManagerSection } from '../components/ExpenseManagerNavigation';
import { ExpenseManagerNavigation } from '../components/ExpenseManagerNavigation';
import { ExpenseOverviewDashboard } from '../components/ExpenseOverviewDashboard';
import { ExpenseTransactionsPage } from './ExpenseTransactionsPage';
import { ExpenseAccountsPage } from './ExpenseAccountsPage';
import { ExpenseCategoriesPage } from './ExpenseCategoriesPage';
import { ExpenseBudgetsPage } from './ExpenseBudgetsPage';

const sectionCopy: Record<ExpenseManagerSection, { title: string; description: string }> = {
  overview: { title: 'Financial Overview', description: 'Understand your current position, period spending, accounts, budgets, and recent activity from persisted Expense Manager data.' },
  transactions: { title: 'Transactions', description: 'Record, review, edit, and delete real Expense Manager transactions without leaving the finance module.' },
  accounts: { title: 'Accounts', description: 'Manage the places where your money is held or spent, with balances derived from persisted financial activity.' },
  categories: { title: 'Categories', description: 'Organize expense and income transactions with persistent, user-owned categories.' },
  budgets: { title: 'Budgets', description: 'Set monthly category limits and track real spending against each persisted budget.' },
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
    <style>{`.expense-manager-page{min-height:100%;box-sizing:border-box;padding:0 10px 110px;background:radial-gradient(circle at 12% 4%,rgba(59,130,246,.09),transparent 28%),radial-gradient(circle at 92% 18%,rgba(20,184,166,.07),transparent 24%),linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%);color:#172033}.expense-manager-page__hero{width:min(1120px,100%);margin:0 auto;padding:16px 2px}.expense-manager-page__eyebrow{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border:1px solid rgba(37,99,235,.12);border-radius:999px;background:rgba(255,255,255,.72);color:#2563eb;font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;box-shadow:0 4px 12px rgba(15,23,42,.04)}.expense-manager-page__title{margin:11px 0 7px;font-size:clamp(26px,7vw,42px);line-height:1.04;letter-spacing:-.045em;font-weight:950;color:#0f172a}.expense-manager-page__description{max-width:680px;margin:0;color:#64748b;font-size:13px;line-height:1.6;font-weight:650}@media(min-width:768px){.expense-manager-page{padding-left:18px;padding-right:18px}.expense-manager-page__hero{padding-top:22px}}`}</style>
    <ExpenseManagerNavigation pathname={pathname} onNavigate={onNavigate} />
    <section className="expense-manager-page__hero" aria-labelledby="expense-manager-title"><span className="expense-manager-page__eyebrow">Expense Manager</span><h1 id="expense-manager-title" className="expense-manager-page__title">{copy.title}</h1><p className="expense-manager-page__description">{copy.description}</p></section>
    {section === 'overview' ? <ExpenseOverviewDashboard onNavigate={onNavigate} /> : section === 'transactions' ? <ExpenseTransactionsPage onNavigate={onNavigate} /> : section === 'accounts' ? <ExpenseAccountsPage onNavigate={onNavigate} /> : section === 'categories' ? <ExpenseCategoriesPage onNavigate={onNavigate} /> : section === 'budgets' ? <ExpenseBudgetsPage onNavigate={onNavigate} /> : <section style={{ width:'min(1120px,100%)', margin:'0 auto', padding:'24px', boxSizing:'border-box', border:'1px solid rgba(148,163,184,.17)', borderRadius:'22px', background:'rgba(255,255,255,.9)', boxShadow:'0 14px 34px rgba(15,23,42,.07)' }} aria-label={`${copy.title} module boundary`}><h2 style={{margin:0,fontSize:'16px',fontWeight:900}}>Independent finance module</h2><p style={{margin:'7px 0 0',color:'#64748b',fontSize:'12px',lineHeight:1.6,fontWeight:600}}>This route remains intentionally scoped to the Expense Manager namespace. Phase 6 implements Budgets; Reports remain a separate Expense Manager phase.</p></section>}
  </main>;
}
