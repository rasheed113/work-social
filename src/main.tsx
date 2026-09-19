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
import './features/contractor/contractor-overview-colorful-premium.css';
import './app/premium-visual-unification.css';
import './app/universal-components.css';
import './app/social-command-center.css';
import './app/social-command-center-post-fix.css';
import './index.css';
import './app/master-glassmorphic-theme.css';
import './app/social-hud-force-theme.css';
import './app/profile-posts-supercomputer.css';
import './app/notifications-transparent-glass.css';
import './app/global-ambient-scroll-motion.css';

if (typeof window !== 'undefined') {
  let scrollFrame = 0;
  const updateAmbientScroll = () => {
    if (scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(() => {
      const scroller = document.querySelector<HTMLElement>('.work-social-page-content');
      const scrollable = scroller ? scroller.scrollHeight - scroller.clientHeight : document.documentElement.scrollHeight - window.innerHeight;
      const scrollTop = scroller ? scroller.scrollTop : window.scrollY;
      const progress = scrollable > 0 ? Math.min(1, Math.max(0, scrollTop / scrollable)) : 0;
      document.documentElement.style.setProperty('--ws-scroll-progress', progress.toFixed(4));
      scrollFrame = 0;
    });
  };
  window.addEventListener('scroll', updateAmbientScroll, { passive: true });
  window.addEventListener('resize', updateAmbientScroll, { passive: true });
  document.addEventListener('scroll', updateAmbientScroll, { passive: true, capture: true });
  updateAmbientScroll();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(
      (registration) => console.info('[Work Social] Service worker registered:', registration.scope),
      (error) => console.warn('[Work Social] Service worker registration failed:', error),
    );
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
