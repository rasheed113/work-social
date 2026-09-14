import type { CSSProperties } from 'react';
import './work-social-premium-loader.css';

interface WorkSocialPremiumLoaderProps {
  title?: string;
  message?: string;
  status?: string;
}

export function WorkSocialPremiumLoader({
  title = 'Opening Work Social',
  message = 'Preparing your workspace…',
  status = 'Securing your workspace',
}: WorkSocialPremiumLoaderProps) {
  return (
    <main className="ws-page-loader" role="status" aria-live="polite" aria-busy="true">
      <section className="ws-page-loader-card" aria-label={`${title}. ${message}`}>
        <div className="ws-page-loader-mark-wrap" aria-hidden="true">
          <div className="ws-page-loader-orbit ws-page-loader-orbit-a" />
          <div className="ws-page-loader-orbit ws-page-loader-orbit-b" />
          <div className="ws-page-loader-orbit ws-page-loader-orbit-c" />
          <div className="ws-page-loader-core-glow" />
          <div className="ws-page-loader-mark">WS</div>
        </div>
        <div className="ws-page-loader-eyebrow">WORK SOCIAL</div>
        <h1 className="ws-page-loader-title">{title}</h1>
        <p className="ws-page-loader-copy">{message}</p>
        <div className="ws-page-loader-status">
          <i />
          <span>{status}</span>
        </div>
      </section>
    </main>
  );
}

export const premiumLoaderStyle: CSSProperties = { minHeight: '100dvh' };
