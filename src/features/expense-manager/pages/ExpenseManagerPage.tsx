import type { ExpenseManagerSection } from '../components/ExpenseManagerNavigation';
import { ExpenseManagerNavigation } from '../components/ExpenseManagerNavigation';
import { ExpenseOverviewDashboard } from '../components/ExpenseOverviewDashboard';
import { ExpenseTransactionsPage } from './ExpenseTransactionsPage';
import { ExpenseAccountsPage } from './ExpenseAccountsPage';
import { ExpenseCategoriesPage } from './ExpenseCategoriesPage';
import { ExpenseBudgetsPage } from './ExpenseBudgetsPage';
import { ExpenseReportsPage } from './ExpenseReportsPage';

const sectionCopy: Record<ExpenseManagerSection, { title: string; description: string }> = {
  overview: { title: 'Financial Overview', description: 'See your position, spending, accounts, budgets, and recent activity.' },
  transactions: { title: 'Transactions', description: 'Record, review, edit, and delete your financial transactions.' },
  accounts: { title: 'Accounts', description: 'Manage money locations and balances from your persisted activity.' },
  categories: { title: 'Categories', description: 'Organize expense and income transactions with your categories.' },
  budgets: { title: 'Budgets', description: 'Set monthly limits and track real spending against each budget.' },
  reports: { title: 'Reports', description: 'Review spending, income, activity, trends, and budget performance.' },
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
    <style>{`
      .expense-manager-page{min-height:100%;width:100%;max-width:100%;min-width:0;box-sizing:border-box;overflow-x:hidden;padding:0 10px max(82px,env(safe-area-inset-bottom));background:radial-gradient(circle at 12% 4%,rgba(59,130,246,.07),transparent 28%),radial-gradient(circle at 92% 18%,rgba(20,184,166,.055),transparent 24%),linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%);color:#172033}
      .expense-manager-page *,.expense-manager-page *::before,.expense-manager-page *::after{box-sizing:border-box}
      .expense-manager-page img,.expense-manager-page svg,.expense-manager-page canvas{max-width:100%}
      .expense-manager-page table{max-width:100%;border-collapse:collapse}
      .expense-manager-page input,.expense-manager-page select,.expense-manager-page textarea,.expense-manager-page button{max-width:100%;font:inherit}
      .expense-manager-page input,.expense-manager-page select,.expense-manager-page textarea{min-width:0}
      .expense-manager-page :where([class*="__toolbar"],[class*="__filters"],[class*="__grid"],[class*="__row"]){min-width:0;max-width:100%}
      .expense-manager-page :where([class*="__panel"],[class*="__card"],[class*="__list"],[class*="__table"]){max-width:100%}
      .expense-manager-page :where(p,.expense-manager-page__description){overflow-wrap:break-word}
      .expense-manager-page__hero{width:min(1120px,100%);margin:0 auto;padding:10px 2px 12px}
      .expense-manager-page__eyebrow{display:inline-flex;align-items:center;min-height:24px;padding:0 8px;border:1px solid rgba(37,99,235,.12);border-radius:999px;background:rgba(255,255,255,.72);color:#2563eb;font-size:9px;font-weight:900;letter-spacing:.11em;text-transform:uppercase;box-shadow:0 3px 9px rgba(15,23,42,.035)}
      .expense-manager-page__title{margin:7px 0 4px;font-size:clamp(23px,6vw,42px);line-height:1.06;letter-spacing:-.045em;font-weight:950;color:#0f172a}
      .expense-manager-page__description{max-width:680px;margin:0;color:#64748b;font-size:12px;line-height:1.45;font-weight:600}
      .expense-manager-page .expense-transactions__title,.expense-manager-page .expense-categories__title,.expense-manager-page .expense-budgets__title{display:none}
      @media(min-width:768px){.expense-manager-page{padding-left:18px;padding-right:18px}.expense-manager-page__hero{padding-top:18px;padding-bottom:16px}}
      @media(max-width:767px){
        .expense-manager-page{padding-left:8px;padding-right:8px;padding-bottom:max(84px,calc(env(safe-area-inset-bottom) + 76px))}
        .expense-manager-page__hero{padding:8px 4px 7px}
        .expense-manager-page__eyebrow{display:none}
        .expense-manager-page__title{margin:0;font-size:21px;line-height:1.15;letter-spacing:-.03em}
        .expense-manager-page__description{display:none}
      }
      @media(max-width:380px){.expense-manager-page{padding-left:6px;padding-right:6px}.expense-manager-page__hero{padding-top:6px;padding-bottom:6px}.expense-manager-page__title{font-size:20px}}
      @media(prefers-reduced-motion:reduce){.expense-manager-page *,.expense-manager-page *::before,.expense-manager-page *::after{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important;animation-iteration-count:1!important}}
    `}</style>
    <ExpenseManagerNavigation pathname={pathname} onNavigate={onNavigate} />
    <section className="expense-manager-page__hero" aria-labelledby="expense-manager-title"><span className="expense-manager-page__eyebrow">Expense Manager</span><h1 id="expense-manager-title" className="expense-manager-page__title">{copy.title}</h1><p className="expense-manager-page__description">{copy.description}</p></section>
    {section === 'overview' ? <ExpenseOverviewDashboard onNavigate={onNavigate} /> : section === 'transactions' ? <ExpenseTransactionsPage onNavigate={onNavigate} /> : section === 'accounts' ? <ExpenseAccountsPage onNavigate={onNavigate} /> : section === 'categories' ? <ExpenseCategoriesPage onNavigate={onNavigate} /> : section === 'budgets' ? <ExpenseBudgetsPage onNavigate={onNavigate} /> : <ExpenseReportsPage onNavigate={onNavigate} />}
  </main>;
}
