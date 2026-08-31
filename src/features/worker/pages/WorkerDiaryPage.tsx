import { useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../../../app/Router';
import { useCurrentWorkerProfileId } from '../hooks/useCurrentWorkerProfileId';
import { useWorkerDiary } from '../hooks/useWorkerDiary';
import type { WorkerDiaryEntry, WorkerDiaryEntryInput, WorkerDiaryEntryType } from '../types/diary';

const TYPE_META: Record<WorkerDiaryEntryType, { icon: string; label: string; hint: string }> = {
  note: { icon: '📝', label: 'Note', hint: 'Capture something useful.' },
  todo: { icon: '☑', label: 'To-do', hint: 'Keep a task in view.' },
  idea: { icon: '💡', label: 'Idea', hint: 'Save a thought worth revisiting.' },
  journal: { icon: '📓', label: 'Journal', hint: 'Write freely.' },
  anything: { icon: '✨', label: 'Anything', hint: 'No category needed.' },
};

const emptyForm: WorkerDiaryEntryInput = { entry_type: 'note', title: '', content: '', completed: false };
const FAB_KEY = 'work-social:worker-diary-fab-position';
const FAB_SIZE = 62;
const SAFE_TOP = 78;
const SAFE_BOTTOM = 108;

type FabPosition = { x: number; y: number };

function initialFabPosition(): FabPosition {
  if (typeof window === 'undefined') return { x: 0, y: 0 };
  try {
    const stored = JSON.parse(window.localStorage.getItem(FAB_KEY) ?? 'null') as Partial<FabPosition> | null;
    if (typeof stored?.x === 'number' && typeof stored?.y === 'number') return stored as FabPosition;
  } catch { /* UI preference only; diary data never uses localStorage. */ }
  return { x: Math.max(16, window.innerWidth - FAB_SIZE - 20), y: Math.max(SAFE_TOP, window.innerHeight - SAFE_BOTTOM - FAB_SIZE) };
}

function clampFab(position: FabPosition): FabPosition {
  if (typeof window === 'undefined') return position;
  const maxX = Math.max(12, window.innerWidth - FAB_SIZE - 12);
  const maxY = Math.max(SAFE_TOP, window.innerHeight - SAFE_BOTTOM - FAB_SIZE);
  return { x: Math.min(Math.max(12, position.x), maxX), y: Math.min(Math.max(SAFE_TOP, position.y), maxY) };
}

function snapFab(position: FabPosition): FabPosition {
  const clamped = clampFab(position);
  if (typeof window === 'undefined') return clamped;
  const rightX = Math.max(12, window.innerWidth - FAB_SIZE - 12);
  return { x: clamped.x < window.innerWidth / 2 ? 12 : rightX, y: clamped.y };
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function dateKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatDateHeading(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dateKey(value) === dateKey(today.toISOString())) return 'Today';
  if (dateKey(value) === dateKey(yesterday.toISOString())) return 'Yesterday';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formFor(entry: WorkerDiaryEntry): WorkerDiaryEntryInput {
  return { entry_type: entry.entry_type, title: entry.title ?? '', content: entry.content, completed: entry.completed ?? false };
}

export function WorkerDiaryPage() {
  const session = useCurrentWorkerProfileId();
  const diary = useWorkerDiary(Boolean(session.profileId));
  const [captureOpen, setCaptureOpen] = useState(false);
  const [viewing, setViewing] = useState<WorkerDiaryEntry | null>(null);
  const [editing, setEditing] = useState<WorkerDiaryEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkerDiaryEntry | null>(null);
  const [form, setForm] = useState<WorkerDiaryEntryInput>(emptyForm);
  const [savedMessage, setSavedMessage] = useState(false);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [fab, setFab] = useState<FabPosition>(initialFabPosition);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ pointerId: number; dx: number; dy: number } | null>(null);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  useEffect(() => {
    const onResize = () => setFab(current => clampFab(current));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!savedMessage) return;
    const timer = window.setTimeout(() => setSavedMessage(false), 2200);
    return () => window.clearTimeout(timer);
  }, [savedMessage]);

  const groupedEntries = useMemo(() => {
    const groups: Array<{ key: string; label: string; entries: WorkerDiaryEntry[] }> = [];
    for (const entry of diary.entries) {
      const key = dateKey(entry.created_at);
      const existing = groups.at(-1);
      if (existing?.key === key) existing.entries.push(entry);
      else groups.push({ key, label: formatDateHeading(entry.created_at), entries: [entry] });
    }
    return groups;
  }, [diary.entries]);

  const openCreate = () => { setEditing(null); setViewing(null); setForm({ ...emptyForm }); setCaptureOpen(true); };
  const chooseType = (type: WorkerDiaryEntryType) => setForm(current => ({ ...current, entry_type: type, completed: type === 'todo' ? false : null }));
  const openEdit = (entry: WorkerDiaryEntry) => { setViewing(null); setEditing(entry); setForm(formFor(entry)); setCaptureOpen(true); };

  const save = async () => {
    if (!online || diary.saving || !form.content.trim()) return;
    const result = editing ? await diary.update(editing.id, form) : await diary.create(form);
    if (!result.error) {
      setCaptureOpen(false);
      setEditing(null);
      setForm({ ...emptyForm });
      setSavedMessage(true);
    }
  };

  const remove = async () => {
    if (!deleteTarget || diary.saving) return;
    const result = await diary.remove(deleteTarget.id);
    if (!result.error) {
      setDeleteTarget(null);
      setViewing(null);
      setSavedMessage(false);
    }
  };

  const onFabPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, dx: event.clientX - fab.x, dy: event.clientY - fab.y };
    setDragging(true);
  };

  const onFabPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    setFab(clampFab({ x: event.clientX - dragRef.current.dx, y: event.clientY - dragRef.current.dy }));
  };

  const onFabPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    const snapped = snapFab(fab);
    setFab(snapped);
    try { window.localStorage.setItem(FAB_KEY, JSON.stringify(snapped)); } catch { /* UI preference only. */ }
  };

  if (session.loading) return <main style={pageStyle}><p style={mutedStyle}>Loading your private diary…</p></main>;
  if (session.error || !session.profileId) return <main style={pageStyle}><p role="alert" style={errorStyle}>{session.error ?? 'Authenticated Worker is unavailable.'}</p></main>;

  const hasSearch = diary.search.trim().length > 0;

  return (
    <main style={pageStyle}>
      <style>{`
        .worker-diary-search:focus{outline:2px solid rgba(99,102,241,.35);outline-offset:1px}
        .worker-diary-card:hover{transform:translateY(-1px);box-shadow:0 14px 32px rgba(15,23,42,.09)!important}
        .worker-diary-action:hover{background:rgba(99,102,241,.08)!important}
        .worker-diary-type:hover{transform:translateY(-1px);border-color:rgba(99,102,241,.35)!important}
        @media (prefers-color-scheme:dark){
          .worker-diary-shell{background:rgba(15,23,42,.92)!important;border-color:rgba(148,163,184,.18)!important;color:#e2e8f0!important}
          .worker-diary-card{background:rgba(30,41,59,.86)!important;border-color:rgba(148,163,184,.16)!important;color:#e2e8f0!important}
          .worker-diary-input{background:#0f172a!important;border-color:#334155!important;color:#f8fafc!important}
          .worker-diary-muted{color:#94a3b8!important}
          .worker-diary-divider{border-color:#334155!important}
        }
      `}</style>

      <header style={headerStyle}>
        <button type="button" onClick={() => navigate('/work')} style={backButtonStyle}>← Work House</button>
        <div style={{ flex: 1 }} />
        <span style={privacyBadgeStyle}>🔒 Private</span>
      </header>

      <section className="worker-diary-shell" style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>Personal workspace</div>
          <h1 style={titleStyle}>Personal Diary</h1>
          <p className="worker-diary-muted" style={subtitleStyle}>Your private space for thoughts, notes, plans and everything in between.</p>
        </div>
        {!online && <div role="status" style={offlineStyle}>Offline — saved changes need a connection.</div>}
      </section>

      <section style={searchWrapStyle} aria-label="Diary search">
        <span aria-hidden="true" style={{ fontSize: 17 }}>⌕</span>
        <input className="worker-diary-search worker-diary-input" value={diary.search} onChange={event => diary.setSearch(event.target.value)} placeholder="Search your diary…" aria-label="Search your diary" style={searchInputStyle} />
        {diary.search && <button type="button" onClick={() => diary.setSearch('')} style={clearSearchStyle} aria-label="Clear search">×</button>}
      </section>

      {diary.error && <section role="alert" style={errorCardStyle}>{diary.error}</section>}
      {savedMessage && <div role="status" style={savedStyle}>✓ Saved successfully</div>}

      {diary.loading ? (
        <section style={stateCardStyle}><div style={spinnerStyle}>Loading diary…</div></section>
      ) : groupedEntries.length === 0 ? (
        <section style={emptyCardStyle}>
          <div style={emptyIconStyle}>{hasSearch ? '⌕' : '✦'}</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 21 }}>{hasSearch ? 'No matches found.' : 'Nothing here yet.'}</h2>
          <p className="worker-diary-muted" style={{ margin: '0 auto 18px', maxWidth: 430, color: '#64748b', lineHeight: 1.6 }}>{hasSearch ? 'Try another word or clear the search to return to your timeline.' : "What's on your mind? Start a private note, task, idea, journal entry or anything at all."}</p>
          {!hasSearch && <button type="button" onClick={openCreate} style={primaryButtonStyle}>+ Add</button>}
        </section>
      ) : (
        <div>
          {groupedEntries.map(group => (
            <section key={group.key} style={{ marginBottom: 24 }}>
              <div style={dateHeadingStyle}>{group.label}</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {group.entries.map(entry => {
                  const meta = TYPE_META[entry.entry_type];
                  return (
                    <article key={entry.id} className="worker-diary-card" style={entryCardStyle}>
                      <button type="button" onClick={() => setViewing(entry)} style={entryMainButtonStyle} aria-label={`View ${meta.label}`}>
                        <span style={typeIconStyle}>{meta.icon}</span>
                        <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                          <span style={entryMetaStyle}>{meta.label} · {formatTime(entry.created_at)}</span>
                          {entry.title && <strong style={entryTitleStyle}>{entry.title}</strong>}
                          <span style={{ ...entryContentStyle, textDecoration: entry.entry_type === 'todo' && entry.completed ? 'line-through' : undefined, opacity: entry.entry_type === 'todo' && entry.completed ? .62 : 1 }}>{entry.content}</span>
                        </span>
                      </button>
                      <div style={entryActionsStyle}>
                        {entry.entry_type === 'todo' && <button type="button" className="worker-diary-action" onClick={() => void diary.toggleTodo(entry.id, !entry.completed)} style={smallActionStyle}>{entry.completed ? '↶ Uncomplete' : '✓ Complete'}</button>}
                        <button type="button" className="worker-diary-action" onClick={() => openEdit(entry)} style={smallActionStyle}>Edit</button>
                        <button type="button" className="worker-diary-action" onClick={() => setDeleteTarget(entry)} style={{ ...smallActionStyle, color: '#b91c1c' }}>Delete</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
          {diary.hasMore && <button type="button" onClick={() => void diary.loadMore()} disabled={diary.loadingMore} style={loadMoreStyle}>{diary.loadingMore ? 'Loading…' : 'Load more'}</button>}
        </div>
      )}

      <button type="button" aria-label="Add diary entry" onClick={openCreate} onPointerDown={onFabPointerDown} onPointerMove={onFabPointerMove} onPointerUp={onFabPointerUp} onPointerCancel={onFabPointerUp} style={{ ...fabStyle, left: fab.x, top: fab.y, cursor: dragging ? 'grabbing' : 'grab', transform: dragging ? 'scale(.97)' : undefined }}>
        <span style={{ fontSize: 29, lineHeight: 1 }}>+</span>
      </button>

      {captureOpen && (
        <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="diary-capture-title">
          <div className="worker-diary-shell" style={modalStyle}>
            <div style={modalHeaderStyle}><div><div style={eyebrowStyle}>{editing ? 'Edit entry' : 'Quick capture'}</div><h2 id="diary-capture-title" style={{ margin: '4px 0 0', fontSize: 23 }}>{editing ? `Edit ${TYPE_META[form.entry_type].label}` : 'What do you want to add?'}</h2></div><button type="button" onClick={() => setCaptureOpen(false)} style={closeButtonStyle}>×</button></div>
            {!editing && <div style={typeGridStyle}>{(Object.keys(TYPE_META) as WorkerDiaryEntryType[]).map(type => <button key={type} type="button" className="worker-diary-type" onClick={() => chooseType(type)} style={{ ...typeButtonStyle, ...(form.entry_type === type ? selectedTypeStyle : {}) }}><span style={{ fontSize: 23 }}>{TYPE_META[type].icon}</span><strong>{TYPE_META[type].label}</strong><small>{TYPE_META[type].hint}</small></button>)}</div>}
            <div style={formWrapStyle}>
              <div style={selectedTypeLineStyle}><span>{TYPE_META[form.entry_type].icon}</span><strong>{TYPE_META[form.entry_type].label}</strong></div>
              {(form.entry_type === 'note' || form.entry_type === 'idea') && <input className="worker-diary-input" value={form.title ?? ''} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="Title (optional)" maxLength={200} style={inputStyle} />}
              <textarea className="worker-diary-input" autoFocus value={form.content} onChange={event => setForm(current => ({ ...current, content: event.target.value }))} placeholder={form.entry_type === 'journal' ? "What's on your mind?" : 'Write something…'} maxLength={20000} rows={form.entry_type === 'journal' ? 9 : 6} style={{ ...inputStyle, resize: 'vertical', minHeight: form.entry_type === 'journal' ? 190 : 135 }} />
              {form.entry_type === 'todo' && <label style={todoLabelStyle}><input type="checkbox" checked={Boolean(form.completed)} onChange={event => setForm(current => ({ ...current, completed: event.target.checked }))} /> Mark as complete</label>}
              <div style={modalActionsStyle}><button type="button" onClick={() => setCaptureOpen(false)} style={secondaryButtonStyle}>Cancel</button><button type="button" onClick={() => void save()} disabled={!online || diary.saving || !form.content.trim()} style={primaryButtonStyle}>{diary.saving ? 'Saving…' : editing ? 'Save changes' : 'Save'}</button></div>
              {diary.error && <p role="alert" style={errorStyle}>{diary.error}</p>}
            </div>
          </div>
        </div>
      )}

      {viewing && (
        <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="diary-view-title">
          <div className="worker-diary-shell" style={modalStyle}>
            <div style={modalHeaderStyle}><div><div style={eyebrowStyle}>{TYPE_META[viewing.entry_type].icon} {TYPE_META[viewing.entry_type].label}</div><h2 id="diary-view-title" style={{ margin: '4px 0 0', fontSize: 23 }}>{viewing.title || 'Diary entry'}</h2></div><button type="button" onClick={() => setViewing(null)} style={closeButtonStyle}>×</button></div>
            <p className="worker-diary-muted" style={{ color: '#64748b', fontSize: 12, margin: '0 0 18px' }}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(viewing.created_at))}{viewing.updated_at !== viewing.created_at ? ' · edited' : ''}</p>
            <div style={viewContentStyle}>{viewing.content}</div>
            {viewing.entry_type === 'todo' && <div style={{ marginTop: 14, fontWeight: 800 }}>{viewing.completed ? '✓ Completed' : '○ Pending'}</div>}
            <div style={modalActionsStyle}><button type="button" onClick={() => openEdit(viewing)} style={secondaryButtonStyle}>Edit</button><button type="button" onClick={() => setDeleteTarget(viewing)} style={{ ...secondaryButtonStyle, color: '#b91c1c' }}>Delete</button></div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="diary-delete-title">
          <div className="worker-diary-shell" style={{ ...modalStyle, maxWidth: 430 }}>
            <div style={eyebrowStyle}>Permanent deletion</div>
            <h2 id="diary-delete-title" style={{ margin: '6px 0 8px', fontSize: 22 }}>Delete this entry?</h2>
            <p className="worker-diary-muted" style={{ color: '#64748b', lineHeight: 1.55, margin: 0 }}>This permanently removes the selected Diary entry. It cannot be recovered from the Diary.</p>
            <div style={modalActionsStyle}><button type="button" onClick={() => setDeleteTarget(null)} style={secondaryButtonStyle}>Cancel</button><button type="button" onClick={() => void remove()} disabled={diary.saving} style={{ ...primaryButtonStyle, background: '#b91c1c' }}>{diary.saving ? 'Deleting…' : 'Delete permanently'}</button></div>
          </div>
        </div>
      )}
    </main>
  );
}

const pageStyle: React.CSSProperties = { width: '100%', maxWidth: 900, margin: '0 auto', padding: '18px 14px 180px', boxSizing: 'border-box', color: '#0f172a' };
const headerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 };
const backButtonStyle: React.CSSProperties = { border: 0, background: 'transparent', color: '#475569', padding: '7px 0', fontWeight: 800, cursor: 'pointer', fontSize: 13 };
const privacyBadgeStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid rgba(34,197,94,.2)', background: 'rgba(34,197,94,.08)', color: '#15803d', borderRadius: 999, padding: '7px 10px', fontSize: 11, fontWeight: 900 };
const heroStyle: React.CSSProperties = { padding: '22px 20px', borderRadius: 24, border: '1px solid rgba(99,102,241,.12)', background: 'linear-gradient(145deg,rgba(255,255,255,.97),rgba(248,250,252,.94))', boxShadow: '0 16px 40px rgba(15,23,42,.07)', marginBottom: 12 };
const eyebrowStyle: React.CSSProperties = { color: '#6366f1', fontSize: 10, fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase' };
const titleStyle: React.CSSProperties = { margin: '5px 0 0', fontSize: 'clamp(30px,7vw,44px)', lineHeight: 1.02, letterSpacing: '-.045em' };
const subtitleStyle: React.CSSProperties = { margin: '9px 0 0', color: '#64748b', lineHeight: 1.55, fontSize: 14, maxWidth: 610 };
const offlineStyle: React.CSSProperties = { marginTop: 15, borderRadius: 13, padding: '9px 11px', background: '#fff7ed', color: '#9a3412', fontSize: 12, fontWeight: 800 };
const searchWrapStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, minHeight: 50, padding: '0 13px', borderRadius: 16, border: '1px solid rgba(100,116,139,.18)', background: 'rgba(255,255,255,.96)', boxShadow: '0 8px 22px rgba(15,23,42,.05)', marginBottom: 16 };
const searchInputStyle: React.CSSProperties = { width: '100%', border: 0, outline: 0, background: 'transparent', color: '#0f172a', fontSize: 14, fontWeight: 650 };
const clearSearchStyle: React.CSSProperties = { width: 28, height: 28, border: 0, borderRadius: 999, background: '#f1f5f9', color: '#475569', cursor: 'pointer', fontSize: 18 };
const errorStyle: React.CSSProperties = { color: '#b91c1c', fontSize: 12, lineHeight: 1.45, fontWeight: 750 };
const errorCardStyle: React.CSSProperties = { padding: 12, borderRadius: 14, background: '#fef2f2', border: '1px solid #fecaca', marginBottom: 12 };
const savedStyle: React.CSSProperties = { position: 'fixed', left: '50%', bottom: '92px', transform: 'translateX(-50%)', zIndex: 1400, background: '#0f172a', color: '#fff', borderRadius: 999, padding: '10px 14px', fontSize: 12, fontWeight: 850, boxShadow: '0 12px 30px rgba(15,23,42,.25)' };
const stateCardStyle: React.CSSProperties = { padding: 28, textAlign: 'center', color: '#64748b', borderRadius: 20, border: '1px solid rgba(100,116,139,.12)', background: 'rgba(255,255,255,.8)' };
const spinnerStyle: React.CSSProperties = { fontSize: 13, fontWeight: 750 };
const emptyCardStyle: React.CSSProperties = { textAlign: 'center', padding: '54px 20px', borderRadius: 24, border: '1px dashed rgba(99,102,241,.22)', background: 'rgba(248,250,252,.72)' };
const emptyIconStyle: React.CSSProperties = { width: 48, height: 48, display: 'grid', placeItems: 'center', margin: '0 auto 14px', borderRadius: 16, background: 'rgba(99,102,241,.09)', color: '#6366f1', fontSize: 23 };
const primaryButtonStyle: React.CSSProperties = { minHeight: 44, padding: '0 16px', border: 0, borderRadius: 13, background: 'linear-gradient(145deg,#4f46e5,#2563eb)', color: '#fff', fontWeight: 900, cursor: 'pointer', boxShadow: '0 9px 20px rgba(37,99,235,.18)' };
const secondaryButtonStyle: React.CSSProperties = { minHeight: 44, padding: '0 15px', border: '1px solid rgba(100,116,139,.2)', borderRadius: 13, background: 'transparent', color: '#334155', fontWeight: 850, cursor: 'pointer' };
const dateHeadingStyle: React.CSSProperties = { margin: '0 4px 9px', color: '#64748b', fontSize: 11, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' };
const entryCardStyle: React.CSSProperties = { border: '1px solid rgba(99,102,241,.11)', borderRadius: 19, background: 'rgba(255,255,255,.94)', boxShadow: '0 9px 24px rgba(15,23,42,.055)', overflow: 'hidden', transition: 'transform .18s ease,box-shadow .18s ease' };
const entryMainButtonStyle: React.CSSProperties = { width: '100%', display: 'flex', gap: 12, alignItems: 'flex-start', padding: '15px 15px 12px', border: 0, background: 'transparent', cursor: 'pointer', color: 'inherit' };
const typeIconStyle: React.CSSProperties = { width: 34, height: 34, flex: '0 0 34px', display: 'grid', placeItems: 'center', borderRadius: 11, background: '#f8fafc', fontSize: 17 };
const entryMetaStyle: React.CSSProperties = { display: 'block', color: '#64748b', fontSize: 10, fontWeight: 850, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' };
const entryTitleStyle: React.CSSProperties = { display: 'block', fontSize: 15, lineHeight: 1.35, marginBottom: 3 };
const entryContentStyle: React.CSSProperties = { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: '#475569', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' };
const entryActionsStyle: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 3, flexWrap: 'wrap', padding: '0 9px 9px 60px' };
const smallActionStyle: React.CSSProperties = { minHeight: 31, padding: '0 8px', border: 0, borderRadius: 9, background: 'transparent', color: '#475569', fontSize: 11, fontWeight: 800, cursor: 'pointer' };
const loadMoreStyle: React.CSSProperties = { display: 'block', margin: '4px auto 0', minHeight: 42, padding: '0 16px', border: '1px solid rgba(99,102,241,.18)', borderRadius: 12, background: 'transparent', color: '#4f46e5', fontWeight: 850, cursor: 'pointer' };
const fabStyle: React.CSSProperties = { position: 'fixed', zIndex: 1250, width: FAB_SIZE, height: FAB_SIZE, border: '1px solid rgba(255,255,255,.35)', borderRadius: 22, background: 'linear-gradient(145deg,#4f46e5,#2563eb)', color: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 18px 34px rgba(37,99,235,.3)', touchAction: 'none', userSelect: 'none', transition: 'transform .12s ease' };
const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(15,23,42,.56)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 12 };
const modalStyle: React.CSSProperties = { width: 'min(100%, 680px)', maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto', borderRadius: 24, padding: 18, background: '#fff', color: '#0f172a', boxShadow: '0 24px 70px rgba(15,23,42,.35)', boxSizing: 'border-box' };
const modalHeaderStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18 };
const closeButtonStyle: React.CSSProperties = { width: 36, height: 36, border: 0, borderRadius: 11, background: '#f1f5f9', color: '#475569', cursor: 'pointer', fontSize: 23 };
const typeGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(135px,1fr))', gap: 8, marginBottom: 16 };
const typeButtonStyle: React.CSSProperties = { minHeight: 94, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: 12, border: '1px solid rgba(100,116,139,.15)', borderRadius: 15, background: '#f8fafc', color: '#0f172a', textAlign: 'left', cursor: 'pointer' };
const selectedTypeStyle: React.CSSProperties = { borderColor: 'rgba(99,102,241,.45)', background: 'rgba(99,102,241,.08)', boxShadow: 'inset 0 0 0 1px rgba(99,102,241,.12)' };
const formWrapStyle: React.CSSProperties = { display: 'grid', gap: 10 };
const selectedTypeLineStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, color: '#334155', fontSize: 13 };
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid rgba(100,116,139,.2)', borderRadius: 14, padding: '12px 13px', background: '#f8fafc', color: '#0f172a', font: 'inherit', lineHeight: 1.55, outline: 0 };
const todoLabelStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 750, color: '#475569' };
const modalActionsStyle: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 };
const viewContentStyle: React.CSSProperties = { padding: 15, borderRadius: 15, background: '#f8fafc', color: '#334155', lineHeight: 1.7, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' };
const mutedStyle: React.CSSProperties = { color: '#64748b', padding: '24px 14px' };
