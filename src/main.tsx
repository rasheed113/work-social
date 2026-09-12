import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
// @ts-ignore Vite handles CSS side-effect imports at build time.
import './app/styles.css';
import './app/auth-premium.css';
import './app/worker-diary-responsive.css';
import './app/worker-header-alignment.css';
import './features/worker/finance-premium.css';
import './features/worker/settings-premium.css';
import './app/social-navigation-compact.css';
import './features/expense-manager/reports-premium.css';
import './features/expense-manager/transactions-filter-premium.css';
import './features/expense-manager/transactions-filter-popover.css';
import './features/expense-manager/transactions-filter-popover';
import './features/expense-manager/overview-collapsible.css';
import './features/expense-manager/overview-collapsible';
import './features/contractor/team-finance-progress.css';
import './features/contractor/team-work-compact.css';
import './features/contractor/contractor-overview-team-intelligence-premium.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
