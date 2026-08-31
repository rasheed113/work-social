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
    <main className="worker-home" style={{ width: '100%', maxWidth: 1080, margin: '0 auto', padding: 'clamp(16px, 3vw, 28px) clamp(10px, 2.5vw, 20px) 104px', boxSizing: 'border-box' }}>
      <style>{`
        .worker-home{--home-ink:#172033;--home-muted:#64748b;position:relative;color:var(--home-ink)}
        .worker-home::before{content:'';position:fixed;z-index:-1;inset:0;pointer-events:none;background:radial-gradient(circle at 10% 0%,rgba(99,102,241,.055),transparent 32%),radial-gradient(circle at 92% 35%,rgba(20,184,166,.045),transparent 34%),linear-gradient(180deg,#f8fafc 0%,#f5f7fb 58%,#f8fafc 100%)}
        .worker-home__hero{position:relative;margin-bottom:16px;padding:clamp(16px,3vw,22px);border:1px solid rgba(99,102,241,.18);border-radius:20px;background:linear-gradient(145deg,rgba(255,255,255,.99) 0%,rgba(247,249,255,.98) 58%,rgba(242,253,251,.96) 100%);box-shadow:0 16px 28px rgba(15,23,42,.08),0 4px 9px rgba(15,23,42,.045),inset 0 1px 0 rgba(255,255,255,1),inset 0 -1px 0 rgba(99,102,241,.06);isolation:isolate}
        .worker-home__hero::before{content:'';position:absolute;z-index:-1;inset:7px 12px -7px;border-radius:20px;background:linear-gradient(90deg,rgba(99,102,241,.11),rgba(20,184,166,.07));filter:blur(10px);opacity:.75}
        .worker-home__hero::after{content:'';position:absolute;top:0;left:18px;right:18px;height:1px;border-radius:999px;background:linear-gradient(90deg,rgba(255,255,255,1),rgba(99,102,241,.42),rgba(20,184,166,.24),rgba(255,255,255,0));box-shadow:0 1px 4px rgba(255,255,255,.8);pointer-events:none}
        .worker-home__hero-content,.worker-home__actions{position:relative;z-index:1}
        .worker-home__eyebrow{display:inline-flex;align-items:center;gap:7px;color:#5553c9;font-size:10px;font-weight:950;letter-spacing:.13em;text-transform:uppercase}
        .worker-home__eyebrow::before{content:'✦';display:grid;place-items:center;width:19px;height:19px;border:1px solid rgba(99,102,241,.16);border-radius:7px;background:linear-gradient(145deg,#fff,rgba(99,102,241,.08));box-shadow:0 3px 7px rgba(15,23,42,.06),inset 0 1px 0 #fff;color:#635bdf;font-size:10px;text-shadow:0 1px 0 #fff}
        .worker-home__title{margin:5px 0 0;font-size:clamp(30px,5.5vw,43px);line-height:1;letter-spacing:-.055em;font-weight:950;color:#111827;text-shadow:0 1px 0 rgba(255,255,255,.98),0 3px 8px rgba(15,23,42,.09)}
        .worker-home__description{max-width:620px;margin:8px 0 0;color:var(--home-muted);font-size:13px;line-height:1.5}
        .worker-home__actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:16px}
        .worker-home__button{min-height:40px;padding:0 13px;border:1px solid rgba(71,85,105,.16);border-radius:12px;font:inherit;font-size:12px;font-weight:900;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease,filter .16s ease;background:linear-gradient(145deg,rgba(255,255,255,1),rgba(246,248,251,.96));box-shadow:0 7px 13px rgba(15,23,42,.065),0 2px 4px rgba(15,23,42,.035),inset 0 1px 0 #fff,inset 0 -1px 0 rgba(148,163,184,.07)}
        .worker-home__button::first-letter{filter:saturate(.8)}
        .worker-home__button:hover{transform:translateY(-2px);box-shadow:0 11px 18px rgba(15,23,42,.09),0 3px 6px rgba(15,23,42,.04),inset 0 1px 0 #fff}
        .worker-home__button:active{transform:translateY(1px);box-shadow:0 4px 8px rgba(15,23,42,.07),inset 0 2px 4px rgba(15,23,42,.035)}
        .worker-home__button:focus-visible,.worker-home__card-button:focus-visible{outline:2px solid rgba(79,70,229,.72);outline-offset:3px}
        .worker-home__button--primary{border-color:rgba(79,70,229,.32);color:#fff;background:linear-gradient(145deg,#6b63e4 0%,#5148df 56%,#2563eb 100%);box-shadow:inset 0 1px 1px rgba(255,255,255,.3),0 9px 16px rgba(79,70,229,.20),0 2px 5px rgba(37,99,235,.12)}
        .worker-home__button--primary:hover{filter:brightness(1.035);box-shadow:inset 0 1px 1px rgba(255,255,255,.34),0 12px 20px rgba(79,70,229,.24),0 3px 7px rgba(37,99,235,.13)}
        .worker-home__button:disabled{opacity:.58;cursor:not-allowed;transform:none}
        .worker-home__section{position:relative;border:1px solid rgba(99,102,241,.14);border-radius:18px;background:linear-gradient(145deg,rgba(255,255,255,.99),rgba(248,250,252,.97));box-shadow:0 11px 22px rgba(15,23,42,.065),0 3px 7px rgba(15,23,42,.035),inset 0 1px 0 #fff,inset 0 -1px 0 rgba(148,163,184,.07);isolation:isolate}
        .worker-home__section::after{content:'';position:absolute;top:0;left:14px;right:14px;height:1px;border-radius:999px;background:linear-gradient(90deg,rgba(255,255,255,1),rgba(99,102,241,.24),rgba(255,255,255,0));pointer-events:none}
        .worker-home__section--error{margin-bottom:14px;padding:14px;color:#b91c1c;font-size:12px;font-weight:750}
        .worker-home__setup{padding:17px;margin-bottom:14px}
        .worker-home__setup h2,.worker-home__section h2{color:#172033}
        .worker-home__section-copy{margin:6px 0 0;color:#64748b;font-size:12px;line-height:1.5}
        .worker-home__card-button{margin-top:11px;min-height:38px;padding:0 12px;border:1px solid rgba(71,85,105,.14);border-radius:11px;background:linear-gradient(145deg,#fff,#f5f7fa);color:#273449;font:inherit;font-size:11px;font-weight:900;cursor:pointer;box-shadow:0 6px 11px rgba(15,23,42,.055),0 2px 4px rgba(15,23,42,.03),inset 0 1px 0 #fff;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
        .worker-home__card-button:hover{transform:translateY(-1px);border-color:rgba(79,70,229,.2);box-shadow:0 9px 15px rgba(15,23,42,.08),inset 0 1px 0 #fff}
        .worker-home__card-button:active{transform:translateY(1px);box-shadow:0 4px 7px rgba(15,23,42,.06),inset 0 2px 3px rgba(15,23,42,.035)}
        .worker-home__resource-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px;margin-top:12px}
        .worker-home__resource{--resource-accent:99,102,241;position:relative;padding:15px;min-width:0;overflow:visible}
        .worker-home__resource::before{content:'';position:absolute;z-index:-1;inset:8px 9px -6px;border-radius:18px;background:rgba(var(--resource-accent),.10);filter:blur(9px);opacity:.6}
        .worker-home__resource--team{--resource-accent:99,102,241;border-color:rgba(99,102,241,.18);background:linear-gradient(145deg,#fff 0%,#f8f8ff 62%,#f3f4ff 100%)}
        .worker-home__resource--finance{--resource-accent:16,185,129;border-color:rgba(16,185,129,.18);background:linear-gradient(145deg,#fff 0%,#f7fcfa 62%,#f0fdf8 100%)}
        .worker-home__resource--diary{--resource-accent:20,184,166;border-color:rgba(20,184,166,.2);background:linear-gradient(145deg,#fff 0%,#f5fcfb 62%,#effcf9 100%)}
        .worker-home__resource:hover{transform:translateY(-2px);border-color:rgba(var(--resource-accent),.28);box-shadow:0 16px 28px rgba(15,23,42,.085),0 4px 8px rgba(var(--resource-accent),.07),inset 0 1px 0 #fff,inset 0 -1px 0 rgba(var(--resource-accent),.08);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
        .worker-home__resource-head{display:flex;align-items:flex-start;justify-content:space-between;gap:9px}
        .worker-home__resource-title{display:flex;align-items:center;gap:9px;min-width:0}
        .worker-home__resource-icon{display:grid;place-items:center;flex:0 0 31px;width:31px;height:31px;border:1px solid rgba(var(--resource-accent),.18);border-radius:10px;background:linear-gradient(145deg,#fff,rgba(var(--resource-accent),.08));color:rgb(var(--resource-accent));font-size:13px;font-weight:950;box-shadow:0 5px 10px rgba(15,23,42,.065),inset 0 1px 0 #fff,inset 0 -1px 2px rgba(var(--resource-accent),.08);text-shadow:0 1px 0 #fff}
        .worker-home__resource h2{margin:0;font-size:15px;letter-spacing:-.02em;line-height:1.2}
        .worker-home__private{flex:0 0 auto;border:1px solid rgba(22,163,74,.16);border-radius:999px;padding:5px 8px;background:linear-gradient(145deg,rgba(240,253,244,.98),rgba(220,252,231,.72));color:#15803d;font-size:9px;font-weight:950;white-space:nowrap;box-shadow:0 3px 6px rgba(22,163,74,.07),inset 0 1px 0 #fff}
        @media (min-width:760px){.worker-home__hero{display:flex;align-items:center;justify-content:space-between;gap:20px}.worker-home__actions{flex:0 0 auto;margin-top:0;max-width:300px}.worker-home__description{font-size:12px}}
        @media (max-width:759px){.worker-home__resource-grid{grid-template-columns:1fr}}
        @media (max-width:430px){.worker-home{padding-left:9px;padding-right:9px}.worker-home__hero{padding:15px;border-radius:18px}.worker-home__title{font-size:clamp(29px,11vw,38px)}.worker-home__description{font-size:12px}.worker-home__actions{display:grid;grid-template-columns:1fr 1.2fr;gap:7px}.worker-home__button{width:100%;min-height:39px;padding:0 9px}.worker-home__resource{padding:14px}.worker-home__resource-icon{flex-basis:29px;width:29px;height:29px}.worker-home__private{font-size:8px;padding:5px 7px}}
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
            <section className="worker-home__section worker-home__resource worker-home__resource--team" aria-labelledby="worker-home-team">
              <div className="worker-home__resource-title">
                <span className="worker-home__resource-icon" aria-hidden="true">◫</span>
                <h2 id="worker-home-team">Team Work</h2>
              </div>
              <p className="worker-home__section-copy">Teams and approved Team Work are intentionally outside Phase 3C.</p>
            </section>

            <section className="worker-home__section worker-home__resource worker-home__resource--finance" aria-labelledby="worker-home-finance">
              <div className="worker-home__resource-title">
                <span className="worker-home__resource-icon" aria-hidden="true">🪙</span>
                <h2 id="worker-home-finance">Finance</h2>
              </div>
              <p className="worker-home__section-copy">Finance remains a separate Worker domain and is not implemented here.</p>
              <button className="worker-home__card-button" type="button" onClick={() => navigate('/work/finance')}>Open Finance</button>
            </section>

            <section className="worker-home__section worker-home__resource worker-home__resource--diary" aria-labelledby="worker-home-diary">
              <div className="worker-home__resource-head">
                <div className="worker-home__resource-title">
                  <span className="worker-home__resource-icon" aria-hidden="true">✎</span>
                  <h2 id="worker-home-diary">Personal Diary</h2>
                </div>
                <span className="worker-home__private" aria-label="Private" title="Private Worker-owned workspace">🔒 Private</span>
              </div>
              <p className="worker-home__section-copy">A private space for notes, tasks, ideas, journal writing and anything in between.</p>
              <button className="worker-home__card-button" type="button" onClick={() => navigate('/work/diary')}>Open Personal Diary</button>
            </section>
          </div>
        </>
      )}

      <WorkerNewWorkEntryModal open={newEntryOpen} saving={dashboard.saving} onClose={() => setNewEntryOpen(false)} onSave={saveEntry} />
    </main>
  );
}
