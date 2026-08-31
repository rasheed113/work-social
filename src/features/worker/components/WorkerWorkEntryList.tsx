import { formatWorkDecimal } from '../logic/workEntryCalculations';
import { formatWorkEntrySizes } from '../logic/workEntrySizes';
import type { WorkEntry } from '../types/workEntry';

interface WorkerWorkEntryListProps {
  entries: WorkEntry[];
  emptyTitle?: string;
  emptyDescription?: string;
  onOpen: (entry: WorkEntry) => void;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function WorkerWorkEntryList({ entries, emptyTitle = 'No Work Entries yet', emptyDescription = 'Saved Work Entries will appear here.', onOpen }: WorkerWorkEntryListProps) {
  if (!entries.length) {
    return (
      <section className="worker-entry-list__empty">
        <span className="worker-entry-list__empty-mark" aria-hidden="true">○</span>
        <h2>{emptyTitle}</h2>
        <p>{emptyDescription}</p>
      </section>
    );
  }
  return (
    <section className="worker-entry-list" aria-label="My Work Entries">
      <style>{`
        .worker-entry-list{display:grid;gap:9px}
        .worker-entry-list__card{position:relative;width:100%;min-width:0;padding:12px 13px;border:1px solid rgba(99,102,241,.14);border-radius:16px;background:linear-gradient(145deg,rgba(255,255,255,.99),rgba(248,250,252,.98) 60%,rgba(244,247,255,.96));box-shadow:0 10px 19px rgba(15,23,42,.065),0 3px 6px rgba(15,23,42,.035),inset 0 1px 0 #fff,inset 0 -1px 0 rgba(148,163,184,.07);text-align:left;cursor:pointer;font:inherit;overflow:visible;isolation:isolate;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
        .worker-entry-list__card::before{content:'';position:absolute;z-index:-1;inset:7px 10px -6px;border-radius:16px;background:linear-gradient(90deg,rgba(99,102,241,.08),rgba(20,184,166,.045));filter:blur(8px);opacity:.6;pointer-events:none;transition:opacity .16s ease}
        .worker-entry-list__card::after{content:'';position:absolute;top:0;left:14px;right:14px;height:1px;border-radius:999px;background:linear-gradient(90deg,rgba(255,255,255,1),rgba(99,102,241,.30),rgba(255,255,255,0));box-shadow:0 1px 4px rgba(255,255,255,.8);pointer-events:none}
        .worker-entry-list__card:hover{transform:translateY(-2px);border-color:rgba(79,70,229,.24);box-shadow:0 15px 27px rgba(15,23,42,.09),0 4px 8px rgba(79,70,229,.06),inset 0 1px 0 #fff,inset 0 -1px 0 rgba(99,102,241,.08)}
        .worker-entry-list__card:hover::before{opacity:.9}.worker-entry-list__card:active{transform:translateY(1px);box-shadow:0 5px 10px rgba(15,23,42,.07),inset 0 2px 4px rgba(15,23,42,.04)}.worker-entry-list__card:focus-visible{outline:2px solid rgba(79,70,229,.72);outline-offset:3px}
        .worker-entry-list__row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:13px}.worker-entry-list__main{min-width:0}.worker-entry-list__name{display:flex;align-items:center;gap:7px;min-width:0;color:#172033;font-size:14px;font-weight:950;letter-spacing:-.015em}.worker-entry-list__name::before{content:'◈';display:grid;place-items:center;flex:0 0 24px;width:24px;height:24px;border:1px solid rgba(99,102,241,.15);border-radius:8px;background:linear-gradient(145deg,#fff,#eef2ff);color:#5b55d6;font-size:10px;box-shadow:0 4px 8px rgba(15,23,42,.055),inset 0 1px 0 #fff}.worker-entry-list__name-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.worker-entry-list__meta{display:block;margin:5px 0 0;padding-left:31px;color:#64748b;font-size:11px;line-height:1.35;font-weight:650;overflow-wrap:anywhere}.worker-entry-list__amount{display:block;min-width:max-content;color:#0f172a;font-size:clamp(18px,4.5vw,23px);line-height:1;font-weight:950;letter-spacing:-.055em;text-shadow:0 1px 0 #fff,0 2px 5px rgba(15,23,42,.10)}
        .worker-entry-list__empty{position:relative;padding:17px 15px;border:1px solid rgba(99,102,241,.13);border-radius:16px;background:linear-gradient(145deg,#fff,#f8fafc);box-shadow:0 9px 18px rgba(15,23,42,.06),inset 0 1px 0 #fff;text-align:center}.worker-entry-list__empty-mark{display:grid;place-items:center;width:31px;height:31px;margin:0 auto;border:1px solid rgba(99,102,241,.14);border-radius:10px;background:linear-gradient(145deg,#fff,#eef2ff);color:#6366f1;box-shadow:0 5px 9px rgba(15,23,42,.06),inset 0 1px 0 #fff}.worker-entry-list__empty h2{margin:8px 0 0;font-size:16px}.worker-entry-list__empty p{margin:5px 0 0;color:#64748b;font-size:12px;line-height:1.5}
        @media (max-width:430px){.worker-entry-list{gap:8px}.worker-entry-list__card{padding:11px 11px;border-radius:15px}.worker-entry-list__row{gap:9px}.worker-entry-list__name{font-size:13px}.worker-entry-list__name::before{flex-basis:22px;width:22px;height:22px}.worker-entry-list__meta{padding-left:29px;font-size:10px}.worker-entry-list__amount{font-size:clamp(17px,5.5vw,21px)}}
      `}</style>
      {entries.map((entry) => (
        <button className="worker-entry-list__card" key={entry.id} type="button" onClick={() => onOpen(entry)}>
          <div className="worker-entry-list__row">
            <div className="worker-entry-list__main">
              <strong className="worker-entry-list__name"><span className="worker-entry-list__name-text">{entry.item_name}</span></strong>
              <span className="worker-entry-list__meta">{formatWorkEntrySizes(entry.size)} · {entry.quantity} pcs · {formatDate(entry.occurred_at)}</span>
            </div>
            <span className="worker-entry-list__amount">{formatWorkDecimal(entry.total)}</span>
          </div>
        </button>
      ))}
    </section>
  );
}
