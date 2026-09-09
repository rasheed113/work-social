import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';

type Props = { profileId: string; teamNumber: string };
type WorkerResult = {
  profile_id: string;
  work_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  worker_type: string;
};

function initials(name: string) {
  const value = name.trim();
  return value ? value.split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() : 'W';
}

export function ContractorAddMembersWorkflow({ profileId, teamNumber }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WorkerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let disposed = false;
    let observer: MutationObserver | null = null;
    let button: HTMLButtonElement | null = null;

    const attach = () => {
      const next = document.querySelector<HTMLButtonElement>('.contractor-team-page .ctd-add');
      if (!next || next === button) return;
      if (button) button.removeEventListener('click', intercept, true);
      button = next;
      button.addEventListener('click', intercept, true);
    };

    const intercept = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      setQuery('');
      setResults([]);
      setError('');
      setOpen(true);
    };

    attach();
    observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      disposed = true;
      observer?.disconnect();
      if (button) button.removeEventListener('click', intercept, true);
    };
  }, [profileId, teamNumber]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError('');
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      const { data, error: searchError } = await supabase.rpc('search_workers_for_contractor', { p_query: trimmed });
      if (!active) return;
      setLoading(false);
      if (searchError) {
        setResults([]);
        setError(searchError.message);
        return;
      }
      setResults((data ?? []) as WorkerResult[]);
    }, 260);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return open ? <div className="cam-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) setOpen(false); }}>
    <style>{`
      .cam-backdrop{position:fixed;inset:0;z-index:1200;display:grid;place-items:start center;padding:68px 12px 20px;box-sizing:border-box;background:rgba(7,20,30,.34);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);animation:camFade .18s ease-out}
      .cam-panel{position:relative;width:min(440px,100%);max-height:calc(100dvh - 88px);overflow:auto;border:1px solid rgba(255,255,255,.94);border-radius:26px;padding:17px;background:linear-gradient(145deg,rgba(255,255,255,.995),rgba(236,253,245,.985) 55%,rgba(239,246,255,.98));box-shadow:0 34px 90px rgba(15,23,42,.28),inset 0 1px 0 #fff;animation:camRise .22s cubic-bezier(.2,.8,.2,1)}
      .cam-glow{position:absolute;right:-70px;top:-90px;width:210px;height:210px;border-radius:50%;background:radial-gradient(circle,rgba(16,185,129,.2),rgba(99,102,241,.09) 48%,transparent 70%);pointer-events:none}
      .cam-head{position:relative;display:flex;align-items:center;justify-content:space-between;gap:12px}.cam-kicker{display:inline-flex;padding:5px 9px;border-radius:999px;background:linear-gradient(145deg,#ecfdf5,#dbeafe);border:1px solid rgba(16,185,129,.16);color:#047857;font-size:8px;font-weight:950;letter-spacing:.16em}.cam-title{margin:7px 0 0;font-size:25px;line-height:1;font-weight:950;letter-spacing:-.045em;color:#172033;text-shadow:0 2px 0 #fff,0 8px 22px rgba(15,23,42,.08)}.cam-sub{margin:6px 0 0;color:#64748b;font-size:9px;line-height:1.45}.cam-close{width:35px;height:35px;flex:0 0 auto;border:1px solid rgba(100,116,139,.13);border-radius:11px;background:linear-gradient(145deg,#fff,#f1f5f9);box-shadow:0 7px 16px rgba(15,23,42,.08),inset 0 1px 0 #fff;color:#475569;font-size:18px;font-weight:950;cursor:pointer}
      .cam-search{position:relative;margin-top:14px;display:flex;align-items:center;gap:9px;padding:0 12px;border-radius:15px;border:1px solid rgba(255,255,255,.96);background:linear-gradient(145deg,rgba(255,255,255,.99),rgba(248,250,252,.94));box-shadow:0 11px 24px rgba(15,23,42,.09),inset 0 1px 0 #fff}.cam-search-icon{font-size:16px;color:#0f766e}.cam-input{width:100%;min-height:46px;border:0;outline:0;background:transparent;color:#172033;font:inherit;font-size:12px;font-weight:750}.cam-input::placeholder{color:#94a3b8;font-weight:650}.cam-hint{margin:7px 2px 0;color:#94a3b8;font-size:8px}
      .cam-status{margin-top:12px;padding:12px;border-radius:14px;background:rgba(255,255,255,.72);border:1px dashed rgba(100,116,139,.18);color:#64748b;text-align:center;font-size:9px;line-height:1.45}.cam-error{color:#b91c1c;border-color:rgba(185,28,28,.16);background:rgba(254,242,242,.75)}
      .cam-results{display:grid;gap:8px;margin-top:12px}.cam-result{display:flex;align-items:center;gap:10px;padding:10px;border-radius:15px;border:1px solid rgba(255,255,255,.9);background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(248,250,252,.9));box-shadow:0 8px 18px rgba(15,23,42,.06),inset 0 1px 0 #fff}.cam-avatar{width:42px;height:42px;flex:0 0 auto;border-radius:13px;display:grid;place-items:center;overflow:hidden;background:linear-gradient(145deg,#d1fae5,#dbeafe);color:#047857;font-size:13px;font-weight:950;box-shadow:inset 0 1px 0 #fff}.cam-avatar img{width:100%;height:100%;object-fit:cover}.cam-result-body{min-width:0;flex:1}.cam-result-name{color:#172033;font-size:11px;font-weight:950;overflow-wrap:anywhere}.cam-result-user{margin-top:2px;color:#64748b;font-size:8px}.cam-result-id{margin-top:4px;color:#047857;font-size:8px;font-weight:950;letter-spacing:.04em;overflow-wrap:anywhere}.cam-result-type{font-size:7px;font-weight:900;color:#64748b;padding:5px 7px;border-radius:999px;background:#f1f5f9;white-space:nowrap}
      .cam-foot{margin-top:13px;padding-top:11px;border-top:1px solid rgba(100,116,139,.12);color:#94a3b8;font-size:8px;line-height:1.45;text-align:center}.cam-foot strong{color:#64748b}
      @keyframes camFade{from{opacity:0}to{opacity:1}}@keyframes camRise{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
      @media(max-width:480px){.cam-backdrop{padding:58px 10px 14px}.cam-panel{border-radius:22px;padding:14px}.cam-title{font-size:23px}}
    `}</style>
    <section className="cam-panel" role="dialog" aria-modal="true" aria-label="Add team members">
      <div className="cam-glow" aria-hidden="true" />
      <div className="cam-head"><div><div className="cam-kicker">TEAM MEMBERS · {teamNumber}</div><h2 className="cam-title">Add Members</h2><p className="cam-sub">Search real Work Social workers before sending them into this team.</p></div><button type="button" className="cam-close" onClick={() => setOpen(false)} aria-label="Close">×</button></div>
      <label className="cam-search"><span className="cam-search-icon" aria-hidden="true">⌕</span><input autoFocus className="cam-input" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search worker name or Worker ID…" aria-label="Search worker name or Worker ID" /></label>
      <div className="cam-hint">Supports Worker name, username, or unique Worker ID number.</div>
      {query.trim().length < 2 ? <div className="cam-status">Type at least 2 characters to search the real worker directory.</div> : loading ? <div className="cam-status">Searching workers…</div> : error ? <div className="cam-status cam-error">Unable to search workers: {error}</div> : results.length ? <div className="cam-results">{results.map(worker => <article className="cam-result" key={worker.work_id}><div className="cam-avatar">{worker.avatar_url ? <img src={worker.avatar_url} alt=""/> : initials(worker.display_name ?? '')}</div><div className="cam-result-body"><div className="cam-result-name">{worker.display_name || 'Unnamed worker'}</div>{worker.username && <div className="cam-result-user">@{worker.username}</div>}<div className="cam-result-id">Worker ID · {worker.work_id}</div></div><span className="cam-result-type">{worker.worker_type === 'salary_person' ? 'Salary' : 'Contract'}</span></article>)}</div> : <div className="cam-status">No worker matched “{query.trim()}”. Try the worker name or Worker ID.</div>}
      <div className="cam-foot"><strong>Search is real.</strong> No fake members are created by this screen. The actual invitation/membership action remains the next Team Members step.</div>
    </section>
  </div> : null;
}
