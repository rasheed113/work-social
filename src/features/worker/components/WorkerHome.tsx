import { useState } from 'react';
import { navigate } from '../../../app/Router';
import { useWorkerWorkDashboard } from '../hooks/useWorkerWorkDashboard';
import { WorkerNewWorkEntryModal } from './WorkerNewWorkEntryModal';
import { WorkerWorkSummaryCards } from './WorkerWorkSummaryCards';

interface WorkerHomeProps { profileId: string; }

export function WorkerHome({ profileId }: WorkerHomeProps) {
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const dashboard = useWorkerWorkDashboard(profileId);

  const saveEntry = async (input: Parameters<typeof dashboard.createEntry>[0]) => dashboard.createEntry(input);

  return (
    <main className="worker-home" style={{ width: '100%', maxWidth: 1080, margin: '0 auto', padding: 'clamp(20px, 4vw, 38px) clamp(12px, 3vw, 24px) 112px', boxSizing: 'border-box' }}>
      <style>{`
        .worker-home{color:#172033}
        .worker-home__hero{position:relative;margin-bottom:22px;padding:clamp(20px,4vw,30px);border:1px solid rgba(99,102,241,.16);border-radius:26px;background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(246,248,255,.96) 54%,rgba(240,253,250,.94));box-shadow:0 20px 46px rgba(15,23,42,.10),inset 0 1px 0 rgba(255,255,255,.9);overflow:visible}
        .worker-home__hero::before{content:'';position:absolute;inset:0;pointer-events:none;border-radius:26px;background:radial-gradient(circle at 8% 0%,rgba(99,102,241,.12),transparent 34%),radial-gradient(circle at 92% 100%,rgba(20,184,166,.10),transparent 32%)}
        .worker-home__hero-content,.worker-home__actions{position:relative;z-index:1}
        .worker-home__eyebrow{display:inline-flex;align-items:center;gap:7px;color:#5b5bd6;font-size:11px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}
        .worker-home__eyebrow::before{content:'✦';font-size:12px;text-shadow:0 0 10px rgba(99,102,241,.35)}
        .worker-home__title{margin:7px 0 0;font-size:clamp(34px,7vw,54px);line-height:.98;letter-spacing:-.055em;font-weight:950;color:#111827;text-shadow:0 1px 0 rgba(255,255,255,.9),0 5px 14px rgba(15,23,42,.09)}
        .worker-home__description{max-width:620px;margin:11px 0 0;color:#64748b;font-size:14px;line-height:1.65}
        .worker-home__actions{display:flex;align-items:center;justify-content:flex-end;gap:9px;flex-wrap:wrap;margin-top:22px}
        .worker-home__button{min-height:44px;padding:0 15px;border:1px solid rgba(71,85,105,.16);border-radius:14px;font:inherit;font-size:13px;font-weight:900;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,filter .18s ease;background:rgba(255,255,255,.82);box-shadow:0 8px 18px rgba(15,23,42,.07),inset 0 1px 0 rgba(255,255,255,.9)}
        .worker-home__button:hover{transform:translateY(-1px);box-shadow:0 11px 24px rgba(15,23,42,.10),inset 0 1px 0 rgba(255,255,255,.95)}
        .worker-home__button:active{transform:translateY(1px);box-shadow:0 5px 12px rgba(15,23,42,.07)}
        .worker-home__button:focus-visible,.worker-home__card-button:focus-visible{outline:2px solid rgba(79,70,229,.7);outline-offset:3px}
        .worker-home__button--primary{border-color:rgba(79,70,229,.32);color:#fff;background:linear-gradient(145deg,#635bdf,#4f46e5 58%,#2563eb);box-shadow:inset 0 1px 1px rgba(255,255,255,.24),0 10px 22px rgba(79,70,229,.22)}
        .worker-home__button--primary:hover{filter:brightness(1.04);box-shadow:inset 0 1px 1px rgba(255,255,255,.28),0 13px 28px rgba(79,70,229,.27)}
        .worker-home__button:disabled{opacity:.58;cursor:not-allowed;transform:none}
        .worker-home__section{position:relative;border:1px solid rgba(99,102,241,.14);border-radius:22px;background:rgba(255,255,255,.9);box-shadow:0 14px 34px rgba(15,23,42,.075),inset 0 1px 0 rgba(255,255,255,.95);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
        .worker-home__section--error{margin-bottom:16px;padding:16px;color:#b91c1c;font-size:13px;font-weight:750}
        .worker-home__setup{padding:20px;margin-bottom:16px}
        .worker-home__setup h2,.worker-home__section h2{color:#172033}
        .worker-home__section-copy{margin:7px 0 0;color:#64748b;font-size:13px;line-height:1.55}
        .worker-home__card-button{margin-top:14px;min-height:41px;padding:0 14px;border:1px solid rgba(71,85,105,.14);border-radius:12px;background:linear-gradient(145deg,#fff,#f8fafc);color:#273449;font:inherit;font-size:12px;font-weight:900;cursor:pointer;box-shadow:0 7px 16px rgba(15,23,42,.06);transition:transform .18s ease,box-shadow .18s ease}
        .worker-home__card-button:hover{transform:translateY(-1px);box-shadow:0 10px 20px rgba(15,23,42,.09)}
        .worker-home__card-button:active{transform:translateY(1px)}
        .worker-home__resource-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:16px}
        .worker-home__resource{padding:20px;min-width:0}
        .worker-home__resource--diary{background:linear-gradient(145deg,rgba(255,255,255,.94),rgba(240,253,250,.9));border-color:rgba(20,184,166,.16)}
        .worker-home__resource-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
        .worker-home__resource h2{margin:0;font-size:17px;letter-spacing:-.02em}
        .worker-home__private{flex:0 0 auto;border:1px solid rgba(22,163,74,.14);border-radius:999px;padding:6px 9px;background:rgba(34,197,94,.08);color:#15803d;font-size:10px;font-weight:950;white-space:nowrap;box-shadow:inset 0 1px 0 rgba(255,255,255,.7)}
        @media (min-width:760px){.worker-home__hero{display:flex;align-items:flex-end;justify-content:space-between;gap:24px}.worker-home__actions{flex:0 0 auto;margin-top:0;max-width:310px}}
        @media (max-width:759px){.worker-home__resource-grid{grid-template-columns:1fr}}
        @media (max-width:430px){.worker-home{padding-left:10px;padding-right:10px}.worker-home__hero{padding:18px;border-radius:22px}.worker-home__title{font-size:clamp(32px,13vw,43px)}.worker-home__description{font-size:13px}.worker-home__actions{display:grid;grid-template-columns:1fr 1.2fr}.worker-home__button{width:100%;padding:0 10px}.worker-home__resource{padding:17px}.worker-home__private{font-size:9px;padding:5px 7px}}
      `}</style>

      <header className="worker-home__hero">
        <div className="worker-home__hero-content">
          <div className="worker-home__eyebrow">Worker Work House</div>
          <h1 className="worker-home__title">Home</h1>
          <p className="worker-home__description">Your persisted My Work overview and real Work totals.</p>
        </div>
        <div className="worker-home__actions">
          <button className="worker-home__button" type="button" onClick={() => navigate('/work/trash')}>🗑️ Trash</button>
          <button className="worker-home__button worker-home__button--primary" type="button" onClick={() => setNewEntryOpen(true)} disabled={!dashboard.workerProfileId || dashboard.loading}>+ New Entry</button>
        </div>
      </header>

      {dashboard.error && <p className="worker-home__section worker-home__section--error" role="alert">{dashboard.error}</p>}

      {!dashboard.loading && !dashboard.workerProfileId && !dashboard.error ? (
        <section className="worker-home__section worker-home__setup">
          <h2 style={{ margin: 0, fontSize: 18 }}>Set up Work Identity first</h2>
          <p className="worker-home__section-copy">A Worker Work Entry belongs to a real Worker Identity. No placeholder entries or fake totals are created before that identity exists.</p>
          <button className="worker-home__card-button" type="button" onClick={() => navigate('/work/identity')}>Open Work Identity</button>
        </section>
      ) : (
        <>
          <WorkerWorkSummaryCards totals={dashboard.totals} periodLabels={dashboard.periodLabels} onOpenHistory={(period) => navigate(period === 'lifetime' ? '/work/history' : `/work/history?period=${period}`)} />

          <div className="worker-home__resource-grid">
            <section className="worker-home__section worker-home__resource" aria-labelledby="worker-home-team">
              <h2 id="worker-home-team">Team Work</h2>
              <p className="worker-home__section-copy">Teams and approved Team Work are intentionally outside Phase 3C.</p>
            </section>

            <section className="worker-home__section worker-home__resource" aria-labelledby="worker-home-finance">
              <h2 id="worker-home-finance">Finance</h2>
              <p className="worker-home__section-copy">Finance remains a separate Worker domain and is not implemented here.</p>
              <button className="worker-home__card-button" type="button" onClick={() => navigate('/work/finance')}>Open Finance</button>
            </section>

            <section className="worker-home__section worker-home__resource worker-home__resource--diary" aria-labelledby="worker-home-diary">
              <div className="worker-home__resource-head">
                <div>
                  <h2 id="worker-home-diary">Personal Diary</h2>
                  <p className="worker-home__section-copy">A private space for notes, tasks, ideas, journal writing and anything in between.</p>
                </div>
                <span className="worker-home__private" aria-label="Private" title="Private Worker-owned workspace">🔒 Private</span>
              </div>
              <button className="worker-home__card-button" type="button" onClick={() => navigate('/work/diary')}>Open Personal Diary</button>
            </section>
          </div>
        </>
      )}

      <WorkerNewWorkEntryModal open={newEntryOpen} saving={dashboard.saving} onClose={() => setNewEntryOpen(false)} onSave={saveEntry} />
    </main>
  );
}
