import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase/client';

type Profile = { id: string; display_name: string | null; username: string | null; avatar_url?: string | null };
type Conversation = { id: string; kind: 'direct' | 'group'; title: string | null; avatar_url: string | null; created_by: string };
type Member = { conversation_id: string; profile_id: string; profile?: Profile };
type Mode = 'members' | 'add' | 'name' | 'avatar' | 'remove' | null;

const BUCKET = 'avatars';
const MAX_AVATAR_SIZE = 10 * 1024 * 1024;
const label = (p?: Profile) => p?.display_name || p?.username || 'User';

export function InboxGroupMenu({ profileId }: { profileId: string }) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [menuPoint, setMenuPoint] = useState({ top: 0, right: 0 });
  const fileInput = useRef<HTMLInputElement | null>(null);

  const conversationId = useMemo(() => {
    try { return new URLSearchParams(window.location.search).get('conversation'); } catch { return null; }
  }, [mode, menuOpen, error]);

  const isCreator = !!conversation && conversation.created_by === profileId;
  const memberIds = useMemo(() => new Set(members.map(m => m.profile_id)), [members]);
  const visibleProfiles = useMemo(() => profiles.filter(p => !memberIds.has(p.id) && p.id !== profileId && `${p.display_name ?? ''} ${p.username ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())), [profiles, memberIds, profileId, query]);
  const removable = useMemo(() => members.filter(m => m.profile_id !== profileId), [members, profileId]);

  const loadGroup = async () => {
    if (!conversationId) { setConversation(null); setMembers([]); return; }
    const { data: c, error: ce } = await supabase.from('conversations').select('id,kind,title,avatar_url,created_by').eq('id', conversationId).maybeSingle();
    if (ce || !c || c.kind !== 'group') { setConversation(null); setMembers([]); return; }
    const { data: rows, error: me } = await supabase.from('conversation_members').select('conversation_id,profile_id').eq('conversation_id', conversationId);
    if (me) { setError(me.message); return; }
    const ids = (rows ?? []).map((m: { profile_id: string }) => m.profile_id);
    const { data: ps, error: pe } = ids.length ? await supabase.from('profiles').select('id,display_name,username,avatar_url').in('id', ids) : { data: [], error: null };
    if (pe) { setError(pe.message); return; }
    const byId = new Map((ps ?? []).map((p: Profile) => [p.id, p]));
    setConversation(c as Conversation);
    setMembers((rows ?? []).map((m: Member) => ({ ...m, profile: byId.get(m.profile_id) })));
  };

  const loadProfiles = async () => {
    const { data, error: e } = await supabase.from('profiles').select('id,display_name,username,avatar_url').neq('id', profileId).order('display_name');
    if (e) setError(e.message); else setProfiles((data ?? []) as Profile[]);
  };

  useEffect(() => { void loadGroup(); }, [conversationId]);

  useEffect(() => {
    let observer: MutationObserver | null = null;
    let installed: HTMLElement | null = null;
    const install = () => {
      if (!conversation) return;
      const section = document.querySelector('main.premium-chat-page section') as HTMLElement | null;
      const header = section?.firstElementChild as HTMLElement | null;
      if (!header) return;
      if (installed && installed.isConnected) return;
      const host = document.createElement('div');
      host.dataset.wsGroupMenuAnchor = 'true';
      host.style.cssText = 'display:flex;align-items:center;flex:0 0 auto;margin-left:8px;';
      header.style.position = header.style.position || 'relative';
      header.appendChild(host);
      installed = host;
      setAnchor(host);
    };
    install();
    const main = document.querySelector('main.premium-chat-page');
    if (main) { observer = new MutationObserver(install); observer.observe(main, { childList: true, subtree: true }); }
    const timer = window.setInterval(install, 250);
    return () => { window.clearInterval(timer); observer?.disconnect(); if (installed?.isConnected) installed.remove(); setAnchor(null); };
  }, [conversation?.id]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => { const target = event.target as Node; if (!(target as HTMLElement)?.closest?.('[data-ws-group-menu], [data-ws-group-menu-popover]')) setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const openMenu = () => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    setMenuPoint({ top: r.bottom + 8, right: Math.max(10, window.innerWidth - r.right) });
    setError(null);
    setMenuOpen(v => !v);
  };

  const openMode = async (next: Exclude<Mode, null>) => {
    setMenuOpen(false); setError(null); setMode(next); setQuery('');
    if (next === 'add') await loadProfiles();
    if (next === 'name') setName(conversation?.title ?? '');
    if (next === 'members' || next === 'remove') await loadGroup();
  };

  const addMember = async (profile: Profile) => {
    if (!conversation) return;
    setSaving(true); setError(null);
    const { error: e } = await supabase.from('conversation_members').insert({ conversation_id: conversation.id, profile_id: profile.id });
    if (e) setError(e.message); else await loadGroup();
    setSaving(false);
  };

  const updateName = async () => {
    if (!conversation || !name.trim()) { setError('Enter a group name.'); return; }
    setSaving(true); setError(null);
    const { error: e } = await supabase.from('conversations').update({ title: name.trim().slice(0, 80) }).eq('id', conversation.id).eq('created_by', profileId);
    if (e) setError(e.message); else { setMode(null); await loadGroup(); }
    setSaving(false);
  };

  const uploadAvatar = async (file: File) => {
    if (!conversation) return;
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    if (file.size > MAX_AVATAR_SIZE) { setError('Group avatar must be 10 MB or smaller.'); return; }
    setSaving(true); setError(null);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${profileId}/groups/${conversation.id}-${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
      if (up.error) throw up.error;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const { error: e } = await supabase.from('conversations').update({ avatar_url: data.publicUrl }).eq('id', conversation.id).eq('created_by', profileId);
      if (e) throw e;
      setMode(null); await loadGroup();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update group avatar.'); }
    finally { setSaving(false); if (fileInput.current) fileInput.current.value = ''; }
  };

  const removeMember = async (member: Member) => {
    if (!conversation || member.profile_id === profileId) return;
    setSaving(true); setError(null);
    const { error: e } = await supabase.from('conversation_members').delete().eq('conversation_id', conversation.id).eq('profile_id', member.profile_id);
    if (e) setError(e.message); else await loadGroup();
    setSaving(false);
  };

  const leaveGroup = async () => {
    if (!conversation) return;
    setSaving(true); setError(null);
    const { error: e } = await supabase.from('conversation_members').delete().eq('conversation_id', conversation.id).eq('profile_id', profileId);
    if (e) setError(e.message); else { setMode(null); setConversation(null); window.history.replaceState({}, '', '/inbox'); window.dispatchEvent(new PopStateEvent('popstate')); }
    setSaving(false);
  };

  if (!conversation || !anchor) return null;
  return <>
    {createPortal(<button type="button" data-ws-group-menu aria-label="Group options" onClick={openMenu} style={{ width: 42, height: 42, borderRadius: 14, border: '1px solid rgba(255,255,255,.72)', background: 'linear-gradient(145deg,rgba(255,255,255,.92),rgba(231,238,255,.82))', color: '#344054', fontSize: 24, lineHeight: 1, fontWeight: 900, cursor: 'pointer', boxShadow: 'inset 0 1px 0 #fff, 0 8px 18px rgba(15,23,42,.13), 0 0 18px rgba(109,93,252,.10)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>⋮</button>, anchor)}
    {menuOpen && createPortal(<div data-ws-group-menu-popover style={{ position: 'fixed', top: menuPoint.top, right: menuPoint.right, zIndex: 5000, width: 250, padding: 8, border: '1px solid rgba(255,255,255,.78)', borderRadius: 20, background: 'linear-gradient(145deg,rgba(255,255,255,.97),rgba(239,244,255,.94))', boxShadow: '0 24px 60px rgba(15,23,42,.24),inset 0 1px 0 #fff', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
      <div style={{ padding: '8px 10px 7px', fontSize: 10, fontWeight: 900, letterSpacing: '.13em', color: '#6d5dfc' }}>GROUP OPTIONS</div>
      <MenuItem icon="◉" text="View Members" onClick={() => void openMode('members')} />
      <MenuItem icon="＋" text="Add Members" onClick={() => void openMode('add')} />
      {isCreator && <>
        <MenuItem icon="✎" text="Update Group Name" onClick={() => void openMode('name')} />
        <MenuItem icon="◌" text="Update Group Avatar" onClick={() => void openMode('avatar')} />
        <MenuItem icon="−" text="Remove Member" onClick={() => void openMode('remove')} />
      </>}
      <div style={{ height: 1, margin: '6px 5px', background: 'rgba(99,102,241,.12)' }} />
      <MenuItem icon="↪" text="Leave Group" danger onClick={() => void leaveGroup()} />
    </div>, document.body)}
    {mode && createPortal(<div role="dialog" aria-modal="true" onMouseDown={e => { if (e.target === e.currentTarget && !saving) setMode(null); }} style={{ position: 'fixed', inset: 0, zIndex: 5100, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15,23,42,.42)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
      <div style={{ width: 'min(500px,calc(100vw - 28px))', maxHeight: 'min(680px,calc(100dvh - 28px))', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,.78)', borderRadius: 24, background: 'linear-gradient(145deg,#fff,#f3f6ff)', boxShadow: '0 30px 80px rgba(15,23,42,.3),inset 0 1px 0 #fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '20px 20px 14px' }}><div><span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '.16em', color: '#6d5dfc' }}>WORK SOCIAL</span><h2 style={{ margin: '4px 0 3px', fontSize: 21, color: '#111827' }}>{mode === 'members' ? 'Group Members' : mode === 'add' ? 'Add Members' : mode === 'name' ? 'Update Group Name' : mode === 'avatar' ? 'Update Group Avatar' : 'Remove Member'}</h2><p style={{ margin: 0, color: '#667085', fontSize: 12 }}>{conversation.title || 'Group conversation'}</p></div><button type="button" onClick={() => setMode(null)} disabled={saving} style={{ width: 38, height: 38, borderRadius: 50, border: '1px solid rgba(99,102,241,.14)', background: '#fff', fontSize: 22, color: '#475467' }}>×</button></div>
        {(mode === 'members' || mode === 'remove') && <div style={{ overflow: 'auto', padding: '0 12px 12px' }}>{members.map(m => <div key={m.profile_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14 }}><Avatar profile={m.profile} /><div style={{ minWidth: 0, flex: 1 }}><strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#344054' }}>{label(m.profile)} {m.profile_id === conversation.created_by && <small style={{ color: '#6d5dfc' }}> · Creator</small>}</strong><small style={{ color: '#98a2b3' }}>{m.profile?.username ? `@${m.profile.username}` : ''}</small></div>{mode === 'remove' && m.profile_id !== profileId && <button type="button" disabled={saving} onClick={() => void removeMember(m)} style={{ border: '1px solid rgba(244,63,94,.18)', borderRadius: 10, padding: '7px 9px', background: 'rgba(255,241,242,.8)', color: '#be123c', fontWeight: 800 }}>Remove</button>}</div>)}</div>}
        {mode === 'add' && <><div style={{ margin: '0 20px 10px' }}><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search people…" style={inputStyle}/></div><div style={{ overflow: 'auto', padding: '0 12px 12px' }}>{visibleProfiles.map(p => <button key={p.id} type="button" disabled={saving} onClick={() => void addMember(p)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: 0, borderRadius: 14, background: 'transparent', textAlign: 'left' }}><Avatar profile={p}/><span style={{ minWidth: 0, flex: 1 }}><strong style={{ display: 'block', color: '#344054' }}>{label(p)}</strong><small style={{ color: '#98a2b3' }}>{p.username ? `@${p.username}` : ''}</small></span><b style={{ color: '#6d5dfc' }}>Add</b></button>)}{!visibleProfiles.length && <p style={{ padding: 12, color: '#98a2b3', fontSize: 12 }}>No people available to add.</p>}</div></>}
        {mode === 'name' && <div style={{ padding: '0 20px 20px' }}><input autoFocus value={name} onChange={e => setName(e.target.value)} maxLength={80} placeholder="Group name" style={inputStyle}/><button type="button" disabled={saving} onClick={() => void updateName()} style={primaryButton}>{saving ? 'Saving…' : 'Save Group Name'}</button></div>}
        {mode === 'avatar' && <div style={{ padding: '0 20px 20px' }}><div style={{ padding: 18, textAlign: 'center', border: '1px dashed rgba(109,93,252,.28)', borderRadius: 18, background: 'rgba(239,246,255,.62)' }}><button type="button" disabled={saving} onClick={() => fileInput.current?.click()} style={primaryButton}>{saving ? 'Uploading…' : 'Choose Group Avatar'}</button><p style={{ margin: '10px 0 0', color: '#98a2b3', fontSize: 10 }}>JPG, PNG, WebP or GIF · max 10 MB</p></div><input ref={fileInput} type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => { const f = e.target.files?.[0]; if (f) void uploadAvatar(f); }}/></div>}
        {error && <p role="alert" style={{ margin: '0 20px 16px', color: '#b42318', fontSize: 12, fontWeight: 700 }}>{error}</p>}
      </div>
    </div>, document.body)}
  </>;
}

function Avatar({ profile }: { profile?: Profile }) { return profile?.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: 38, height: 38, borderRadius: 13, objectFit: 'cover' }} /> : <span style={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 13, background: '#eef2ff' }}>👤</span>; }
function MenuItem({ icon, text, onClick, danger = false }: { icon: string; text: string; onClick: () => void; danger?: boolean }) { return <button type="button" onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 11px', border: 0, borderRadius: 13, background: 'transparent', color: danger ? '#be123c' : '#344054', fontWeight: 800, textAlign: 'left', cursor: 'pointer' }}><span style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 9, background: danger ? 'rgba(244,63,94,.08)' : 'rgba(109,93,252,.08)', color: danger ? '#be123c' : '#6d5dfc' }}>{icon}</span>{text}</button>; }
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '12px 13px', border: '1px solid rgba(99,102,241,.16)', borderRadius: 14, background: '#fff', outline: 'none', boxShadow: 'inset 0 1px 2px rgba(15,23,42,.03)' };
const primaryButton: React.CSSProperties = { width: '100%', marginTop: 12, padding: '12px 16px', border: 0, borderRadius: 14, background: 'linear-gradient(135deg,#6d5dfc,#22c1dc)', color: '#fff', fontWeight: 900, boxShadow: '0 9px 24px rgba(79,70,229,.2)' };
