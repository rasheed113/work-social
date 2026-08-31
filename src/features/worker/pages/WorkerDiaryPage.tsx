import { useEffect, useMemo, useState } from 'react';
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatDay(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formFor(entry: WorkerDiaryEntry): WorkerDiaryEntryInput {
  return {
    entry_type: entry.entry_type,
    title: entry.title ?? '',
    content: entry.content,
    completed: entry.completed ?? false,
  };
}

export function WorkerDiaryPage() {
  const session = useCurrentWorkerProfileId();
  const diary = useWorkerDiary(Boolean(session.profileId));
  const [captureOpen, setCaptureOpen] = useState(false);
  const [viewing, setViewing] = useState<WorkerDiaryEntry | null>(null);
  const [editing, setEditing] = useState<WorkerDiaryEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkerDiaryEntry | null>(null);
  const [form, setForm] = useState<WorkerDiaryEntryInput>(emptyForm);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 2200);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const groups = useMemo(() => {
    const result: Array<{ key: string; label: string; entries: WorkerDiaryEntry[] }> = [];
    for (const entry of diary.entries) {
      const key = new Date(entry.created_at).toDateString();
      const existing = result[result.length - 1];
      if (existing?.key === key) existing.entries.push(entry);
      else result.push({ key, label: formatDay(entry.created_at), entries: [entry] });
    }
    return result;
  }, [diary.entries]);

  const openCreate = () => {
    setEditing(null);
    setViewing(null);
    setForm({ ...emptyForm });
    setCaptureOpen(true);
  };

  const openEdit = (entry: WorkerDiaryEntry) => {
    setViewing(null);
    setEditing(entry);
    setForm(formFor(entry));
    setCaptureOpen(true);
  };

  const chooseType = (entryType: WorkerDiaryEntryType) => {
    setForm(current => ({
      ...current,
      entry_type: entryType,
      completed: entryType === 'todo' ? false : null,
    }));
  };

  const save = async () => {
    if (diary.saving || !form.content.trim()) return;
    const result = editing
      ? await diary.update(editing.id, form)
      : await diary.create(form);
    if (!result.error) {
      setCaptureOpen(false);
      setEditing(null);
      setForm({ ...emptyForm });
      setSaved(true);
    }
  };

  const remove = async () => {
    if (!deleteTarget || diary.saving) return;
    const result = await diary.remove(deleteTarget.id);
    if (!result.error) {
      setDeleteTarget(null);
      setViewing(null);
      setSaved(true);
    }
  };

  if (session.loading) {
    return <main style={pageStyle}><p style={mutedStyle}>Loading your private diary…</p></main>;
  }

  if (session.error || !session.profileId) {
    return <main style={pageStyle}><p role="alert" style={errorStyle}>{session.error ?? 'Authenticated Worker is unavailable.'}</p></main>;
  }

  const hasSearch = diary.search.trim().length > 0;

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <button type="button" onClick={() => navigate('/work')} style={backButtonStyle}>← Work House</button>
        <span style={{ flex: 1 }} />
        <span style={privacyBadgeStyle}>🔒 Private</span>
      </header>

      <section style={heroStyle}>
        <div style={eyebrowStyle}>Personal workspace</div>
        <h1 style={titleStyle}>Personal Diary</h1>
        <p style={subtitleStyle}>Your private space for thoughts, notes, plans and everything in between.</p>
      </section>

      <section style={searchStyle} aria-label="Diary search">
        <span aria-hidden="true">⌕</span>
        <input value={diary.search} onChange={event => diary.setSearch(event.target.value)} placeholder="Search your diary…" aria-label="Search your diary" style={searchInputStyle} />
        {diary.search && <button type="button" onClick={() => diary.setSearch('')} style={clearButtonStyle} aria-label="Clear search">×</button>}
      </section>

      {diary.error && <section role="alert" style={errorCardStyle}>{diary.error}</section>}
      {saved && <div role="status" style={savedStyle}>✓ Saved</div>}

      {diary.loading ? (
        <section style={stateCardStyle}>Loading diary…</section>
      ) : groups.length === 0 ? (
        <section style={emptyStyle}>
          <div style={emptyIconStyle}>{hasSearch ? '⌕' : '✦'}</div>
          <h2 style={{ margin: '0 0 8px' }}>{hasSearch ? 'No matches found.' : 'Nothing here yet.'}</h2>
          <p style={subtitleStyle}>{hasSearch ? 'Try another word or clear the search.' : 'Start a private note, task, idea, journal entry or anything at all.'}</p>
          {!hasSearch && <button type="button" onClick={openCreate} style={primaryButtonStyle}>+ Add</button>}
        </section>
      ) : (
        <div>
          {groups.map(group => (
            <section key={group.key} style={{ marginBottom: 24 }}>
              <div style={dateHeadingStyle}>{group.label}</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {group.entries.map(entry => {
                  const meta = TYPE_META[entry.entry_type];
                  const completed = entry.entry_type === 'todo' && entry.completed;
                  return (
                    <article key={entry.id} style={entryCardStyle}>
                      <button type="button" onClick={() => setViewing(entry)} style={entryMainStyle}>
                        <span style={iconStyle}>{meta.icon}</span>
                        <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                          <span style={metaStyle}>{meta.label} · {formatDate(entry.created_at)}</span>
                          {entry.title && <strong style={entryTitleStyle}>{entry.title}</strong>}
                          <span style={{ ...contentStyle, textDecoration: completed ? 'line-through' : undefined, opacity: completed ? 0.6 : 1 }}>{entry.content}</span>
                        </span>
                      </button>
                      <div style={actionsStyle}>
                        {entry.entry_type === 'todo' && <button type="button" onClick={() => void diary.toggleTodo(entry.id, !entry.completed)} style={actionButtonStyle}>{entry.completed ? '↶ Uncomplete' : '✓ Complete'}</button>}
                        <button type="button" onClick={() => openEdit(entry)} style={actionButtonStyle}>Edit</button>
                        <button type="button" onClick={() => setDeleteTarget(entry)} style={{ ...actionButtonStyle, color: '#b91c1c' }}>Delete</button>
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

      <button type="button" onClick={openCreate} aria-label="Add diary entry" style={fabStyle}>+</button>

      {captureOpen && (
        <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="capture-title">
          <div style={modalStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <div style={eyebrowStyle}>{editing ? 'Edit entry' : 'Quick capture'}</div>
                <h2 id="capture-title" style={modalTitleStyle}>{editing ? `Edit ${TYPE_META[form.entry_type].label}` : 'What do you want to add?'}</h2>
              </div>
              <button type="button" onClick={() => setCaptureOpen(false)} style={closeButtonStyle}>×</button>
            </div>

            {!editing && (
              <div style={typeGridStyle}>
                {(Object.keys(TYPE_META) as WorkerDiaryEntryType[]).map(type => (
                  <button key={type} type="button" onClick={() => chooseType(type)} style={{ ...typeButtonStyle, ...(form.entry_type === type ? selectedTypeStyle : {}) }}>
                    <span style={{ fontSize: 22 }}>{TYPE_META[type].icon}</span>
                    <strong>{TYPE_META[type].label}</strong>
                    <small>{TYPE_META[type].hint}</small>
                  </button>
                ))}
              </div>
            )}

            <div style={formStyle}>
              <div style={selectedTypeStyleText}><span>{TYPE_META[form.entry_type].icon}</span><strong>{TYPE_META[form.entry_type].label}</strong></div>
              {(form.entry_type === 'note' || form.entry_type === 'idea') && (
                <input value={form.title ?? ''} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="Title (optional)" maxLength={200} style={inputStyle} />
              )}
              <textarea autoFocus value={form.content} onChange={event => setForm(current => ({ ...current, content: event.target.value }))} placeholder={form.entry_type === 'journal' ? "What's on your mind?" : 'Write something…'} maxLength={20000} rows={form.entry_type === 'journal' ? 9 : 6} style={{ ...inputStyle, resize: 'vertical', minHeight: form.entry_type === 'journal' ? 190 : 135 }} />
              {form.entry_type === 'todo' && (
                <label style={todoLabelStyle}><input type="checkbox" checked={Boolean(form.completed)} onChange={event => setForm(current => ({ ...current, completed: event.target.checked }))} /> Mark as complete</label>
              )}
              <div style={modalActionsStyle}>
                <button type="button" onClick={() => setCaptureOpen(false)} style={secondaryButtonStyle}>Cancel</button>
                <button type="button" onClick={() => void save()} disabled={diary.saving || !form.content.trim()} style={primaryButtonStyle}>{diary.saving ? 'Saving…' : editing ? 'Save changes' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewing && (
        <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="view-title">
          <div style={modalStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <div style={eyebrowStyle}>{TYPE_META[viewing.entry_type].icon} {TYPE_META[viewing.entry_type].label}</div>
                <h2 id="view-title" style={modalTitleStyle}>{viewing.title || 'Diary entry'}</h2>
              </div>
              <button type="button" onClick={() => setViewing(null)} style={closeButtonStyle}>×</button>
            </div>
            <p style={metaStyle}>{formatDate(viewing.created_at)}{viewing.updated_at !== viewing.created_at ? ' · edited' : ''}</p>
            <div style={viewContentStyle}>{viewing.content}</div>
            {viewing.entry_type === 'todo' && <div style={{ marginTop: 14, fontWeight: 800 }}>{viewing.completed ? '✓ Completed' : '○ Pending'}</div>}
            <div style={modalActionsStyle}>
              <button type="button" onClick={() => openEdit(viewing)} style={secondaryButtonStyle}>Edit</button>
              <button type="button" onClick={() => setDeleteTarget(viewing)} style={{ ...secondaryButtonStyle, color: '#b91c1c' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <div style={{ ...modalStyle, maxWidth: 430 }}>
            <div style={eyebrowStyle}>Permanent deletion</div>
            <h2 id="delete-title" style={modalTitleStyle}>Delete this entry?</h2>
            <p style={subtitleStyle}>This permanently removes the selected Diary entry. It cannot be recovered from the Diary.</p>
            <div style={modalActionsStyle}>
              <button type="button" onClick={() => setDeleteTarget(null)} style={secondaryButtonStyle}>Cancel</button>
              <button type="button" onClick={() => void remove()} disabled={diary.saving} style={{ ...primaryButtonStyle, background: '#b91c1c' }}>{diary.saving ? 'Deleting…' : 'Delete permanently'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const pageStyle: React.CSSProperties = { width: '100%', maxWidth: 900, margin: '0 auto', padding: '18px 14px 140px', boxSizing: 'border-box', color: '#0f172a' };
const headerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 };
const backButtonStyle: React.CSSProperties = { border: 0, background: 'transparent', color: '#475569', padding: '7px 0', fontWeight: 800, cursor: 'pointer', fontSize: 13 };
const privacyBadgeStyle: React.CSSProperties = { border: '1px solid rgba(34,197,94,.2)', background: 'rgba(34,197,94,.08)', color: '#15803d', borderRadius: 999, padding: '7px 10px', fontSize: 11, fontWeight: 900 };
const heroStyle: React.CSSProperties = { padding: '22px 20px', borderRadius: 24, border: '1px solid rgba(99,102,241,.12)', background: 'linear-gradient(145deg,rgba(255,255,255,.97),rgba(248,250,252,.94))', boxShadow: '0 16px 40px rgba(15,23,42,.07)', marginBottom: 12 };
const eyebrowStyle: React.CSSProperties = { color: '#6366f1', fontSize: 10, fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase' };
const titleStyle: React.CSSProperties = { margin: '5px 0 0', fontSize: 'clamp(30px,7vw,44px)', lineHeight: 1.02, letterSpacing: '-.045em' };
const subtitleStyle: React.CSSProperties = { margin: '9px 0 0', color: '#64748b', lineHeight: 1.55, fontSize: 14, maxWidth: 610 };
const searchStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, minHeight: 50, padding: '0 13px', borderRadius: 16, border: '1px solid rgba(100,116,139,.18)', background: '#fff', boxShadow: '0 8px 22px rgba(15,23,42,.05)', marginBottom: 16 };
const searchInputStyle: React.CSSProperties = { width: '100%', border: 0, outline: 0, background: 'transparent', color: '#0f172a', fontSize: 14, fontWeight: 650 };
const clearButtonStyle: React.CSSProperties = { width: 28, height: 28, border: 0, borderRadius: 999, background: '#f1f5f9', color: '#475569', cursor: 'pointer', fontSize: 18 };
const errorStyle: React.CSSProperties = { color: '#b91c1c', fontSize: 12, lineHeight: 1.45, fontWeight: 750 };
const errorCardStyle: React.CSSProperties = { padding: 12, borderRadius: 14, background: '#fef2f2', border: '1px solid #fecaca', marginBottom: 12 };
const savedStyle: React.CSSProperties = { position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 1400, background: '#0f172a', color: '#fff', borderRadius: 999, padding: '10px 14px', fontSize: 12, fontWeight: 850, boxShadow: '0 12px 30px rgba(15,23,42,.25)' };
const stateCardStyle: React.CSSProperties = { padding: 28, textAlign: 'center', color: '#64748b', borderRadius: 20, border: '1px solid rgba(100,116,139,.12)', background: '#fff' };
const emptyStyle: React.CSSProperties = { textAlign: 'center', padding: '54px 20px', borderRadius: 24, border: '1px dashed rgba(99,102,241,.22)', background: '#f8fafc' };
const emptyIconStyle: React.CSSProperties = { width: 48, height: 48, display: 'grid', placeItems: 'center', margin: '0 auto 14px', borderRadius: 16, background: 'rgba(99,102,241,.09)', color: '#6366f1', fontSize: 23 };
const primaryButtonStyle: React.CSSProperties = { minHeight: 44, padding: '0 16px', border: 0, borderRadius: 13, background: 'linear-gradient(145deg,#4f46e5,#2563eb)', color: '#fff', fontWeight: 900, cursor: 'pointer', boxShadow: '0 9px 20px rgba(37,99,235,.18)' };
const secondaryButtonStyle: React.CSSProperties = { minHeight: 44, padding: '0 15px', border: '1px solid rgba(100,116,139,.2)', borderRadius: 13, background: 'transparent', color: '#334155', fontWeight: 850, cursor: 'pointer' };
const dateHeadingStyle: React.CSSProperties = { margin: '0 4px 9px', color: '#64748b', fontSize: 11, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' };
const entryCardStyle: React.CSSProperties = { border: '1px solid rgba(99,102,241,.11)', borderRadius: 19, background: '#fff', boxShadow: '0 9px 24px rgba(15,23,42,.055)', overflow: 'hidden' };
const entryMainStyle: React.CSSProperties = { width: '100%', display: 'flex', gap: 12, alignItems: 'flex-start', padding: '15px 15px 12px', border: 0, background: 'transparent', cursor: 'pointer', color: 'inherit' };
const iconStyle: React.CSSProperties = { width: 34, height: 34, flex: '0 0 34px', display: 'grid', placeItems: 'center', borderRadius: 11, background: '#f8fafc', fontSize: 17 };
const metaStyle: React.CSSProperties = { display: 'block', color: '#64748b', fontSize: 10, fontWeight: 850, marginBottom: 5 };
const entryTitleStyle: React.CSSProperties = { display: 'block', fontSize: 15, lineHeight: 1.35, marginBottom: 3 };
const contentStyle: React.CSSProperties = { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: '#475569', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' };
const actionsStyle: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 3, flexWrap: 'wrap', padding: '0 9px 9px 60px' };
const actionButtonStyle: React.CSSProperties = { minHeight: 31, padding: '0 8px', border: 0, borderRadius: 9, background: 'transparent', color: '#475569', fontSize: 11, fontWeight: 800, cursor: 'pointer' };
const loadMoreStyle: React.CSSProperties = { display: 'block', margin: '4px auto 0', minHeight: 42, padding: '0 16px', border: '1px solid rgba(99,102,241,.18)', borderRadius: 12, background: 'transparent', color: '#4f46e5', fontWeight: 850, cursor: 'pointer' };
const fabStyle: React.CSSProperties = { position: 'fixed', right: 18, bottom: 86, zIndex: 1250, width: 62, height: 62, border: 0, borderRadius: 22, background: 'linear-gradient(145deg,#4f46e5,#2563eb)', color: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 18px 34px rgba(37,99,235,.3)', fontSize: 30, cursor: 'pointer' };
const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(15,23,42,.56)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 12 };
const modalStyle: React.CSSProperties = { width: 'min(100%, 680px)', maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto', borderRadius: 24, padding: 18, background: '#fff', color: '#0f172a', boxShadow: '0 24px 70px rgba(15,23,42,.35)', boxSizing: 'border-box' };
const modalHeaderStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18 };
const modalTitleStyle: React.CSSProperties = { margin: '4px 0 0', fontSize: 23 };
const closeButtonStyle: React.CSSProperties = { width: 36, height: 36, border: 0, borderRadius: 11, background: '#f1f5f9', color: '#475569', cursor: 'pointer', fontSize: 23 };
const typeGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(135px,1fr))', gap: 8, marginBottom: 16 };
const typeButtonStyle: React.CSSProperties = { minHeight: 94, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: 12, border: '1px solid rgba(100,116,139,.15)', borderRadius: 15, background: '#f8fafc', color: '#0f172a', textAlign: 'left', cursor: 'pointer' };
const selectedTypeStyle: React.CSSProperties = { borderColor: 'rgba(99,102,241,.45)', background: 'rgba(99,102,241,.08)' };
const formStyle: React.CSSProperties = { display: 'grid', gap: 10 };
const selectedTypeStyleText: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, color: '#334155', fontSize: 13 };
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid rgba(100,116,139,.2)', borderRadius: 14, padding: '12px 13px', background: '#f8fafc', color: '#0f172a', font: 'inherit', lineHeight: 1.55, outline: 0 };
const todoLabelStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 750, color: '#475569' };
const modalActionsStyle: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 };
const viewContentStyle: React.CSSProperties = { padding: 15, borderRadius: 15, background: '#f8fafc', color: '#334155', lineHeight: 1.7, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' };
const mutedStyle: React.CSSProperties = { color: '#64748b', padding: '24px 14px' };
