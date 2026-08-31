import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
// @ts-ignore Vite handles CSS side-effect imports at build time.
import './app/styles.css';
import './app/auth-premium.css';
import './app/worker-diary-responsive.css';
import './app/worker-finance-premium.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
