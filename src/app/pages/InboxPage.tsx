import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

type Profile = { id: string; display_name: string | null; username: string | null; avatar_url?: string | null };
type Conversation = { id: string; kind: 'direct' | 'group'; title: string | null; avatar_url: string | null; created_by: string; updated_at: string };
type Message = { id: string; conversation_id: string; sender_id: string; content: string; created_at: string; read_at: string | null; reply_to_message_id: string | null; edited_at: string | null; deleted_at: string | null };
type Member = { conversation_id: string; profile_id: string; last_read_at: string | null; profile?: Profile };
type Reaction = { message_id: string; profile_id: string; reaction: string };

const REACTIONS = ['😂', '❤️', '👍', '😢', '😡', '😮'];
const reactionToDb: Record<string, string> = { '😂': 'haha', '❤️': 'love', '👍': 'like', '😢': 'sad', '😡': 'angry', '😮': 'wow' };
const dbToReaction: Record<string, string> = { haha: '😂', love: '❤️', like: '👍', sad: '😢', angry: '😡', wow: '😮' };

function nameOf(p?: Profile) { return p?.display_name ?? p?.username ?? 'User'; }
function formatTime(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(); }

export function InboxPage({ profileId }: { profileId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('conversation'));
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyId, setReplyId] = useState<string | null>(null);
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  const longPress = useRef<number | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    const { data: mine, error: mineError } = await supabase.from('conversation_members').select('conversation_id, profile_id, last_read_at').eq('profile_id', profileId);
    if (mineError) { setError(mineError.message); setLoading(false); return; }
    const ids = (mine ?? []).map((x: any) => x.conversation_id);
    if (!ids.length) { setConversations([]); setMembers([]); setMessages([]); setProfiles([]); setReactions([]); setLoading(false); return; }
    const [cr, mr, msg] = await Promise.all([
      supabase.from('conversations').select('id, kind, title, avatar_url, created_by, updated_at').in('id', ids).order('updated_at', { ascending: false }),
      supabase.from('conversation_members').select('conversation_id, profile_id, last_read_at').in('conversation_id', ids),
      supabase.from('messages').select('id, conversation_id, sender_id, content, created_at, read_at, reply_to_message_id, edited_at, deleted_at').in('conversation_id', ids).order('created_at', { ascending: true }),
    ]);
    const firstError = cr.error ?? mr.error ?? msg.error;
    if (firstError) { setError(firstError.message); setLoading(false); return; }
    const rows = (msg.data ?? []) as Message[];
    const memberRows = (mr.data ?? []) as Member[];
    const profileIds = [...new Set(memberRows.map(x => x.profile_id).concat(rows.map(x => x.sender_id)))];
    const pr = profileIds.length ? await supabase.from('profiles').select('id, display_name, username, avatar_url').in('id', profileIds) : { data: [], error: null };
    if (pr.error) { setError(pr.error.message); setLoading(false); return; }
    const rr = rows.length ? await supabase.from('message_reactions').select('message_id, profile_id, reaction').in('message_id', rows.map(x => x.id)) : { data: [], error: null };
    if (rr.error) { setError(rr.error.message); setLoading(false); return; }
    const map = new Map((pr.data ?? []).map((p: any) => [p.id, p as Profile]));
    setConversations((cr.data ?? []) as Conversation[]);
    setMembers(memberRows.map(m => ({ ...m, profile: map.get(m.profile_id) })));
    setMessages(rows);
    setProfiles((pr.data ?? []) as Profile[]);
    setReactions((rr.data ?? []) as Reaction[]);
    setLoading(false);
    const requested = new URLSearchParams(window.location.search).get('conversation');
    if (requested && (cr.data ?? []).some((c: any) => c.id === requested)) setSelectedId(requested);
  };

  useEffect(() => { void load(); return () => { if (longPress.current) window.clearTimeout(longPress.current); }; }, [profileId]);
  useEffect(() => { const resize = () => setMobile(window.innerWidth < 768); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize); }, []);
  useEffect(() => { const ch = supabase.channel(`work-social-chat:${profileId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => void load()).on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => void load()).subscribe(); return () => { void supabase.removeChannel(ch); }; }, [profileId]);

  const selected = conversations.find(c => c.id === selectedId) ?? null;
  const selectedMessages = useMemo(() => messages.filter(m => m.conversation_id === selectedId), [messages, selectedId]);
  const selectedMembers = members.filter(m => m.conversation_id === selectedId);
  const other = selected?.kind === 'direct' ? selectedMembers.find(m => m.profile_id !== profileId)?.profile : undefined;
  const me = profiles.find(p => p.id === profileId);
  const searchPeople = profiles.filter(p => p.id !== profileId && `${p.display_name ?? ''} ${p.username ?? ''}`.toLowerCase().includes(search.toLowerCase().trim()));
  const byId = (id: string | null) => id ? messages.find(m => m.id === id) : undefined;
  const unread = (id: string) => { const member = members.find(m => m.conversation_id === id && m.profile_id === profileId); const cutoff = member?.last_read_at ? Date.parse(member.last_read_at) : 0; return messages.filter(m => m.conversation_id === id && m.sender_id !== profileId && !m.deleted_at && Date.parse(m.created_at) > cutoff).length; };
  const reactionRows = (messageId: string) => { const map = new Map<string, { count: number; mine: boolean }>(); reactions.filter(r => r.message_id === messageId).forEach(r => { const key = dbToReaction[r.reaction] ?? r.reaction; const v = map.get(key) ?? { count: 0, mine: false }; v.count++; if (r.profile_id === profileId) v.mine = true; map.set(key, v); }); return [...map.entries()]; };

  const open = async (id: string) => { setSelectedId(id); const now = new Date().toISOString(); const { error: e } = await supabase.from('conversation_members').update({ last_read_at: now }).eq('conversation_id', id).eq('profile_id', profileId); if (e) setError(e.message); else setMembers(ms => ms.map(m => m.conversation_id === id && m.profile_id === profileId ? { ...m, last_read_at: now } : m)); window.history.replaceState({}, '', `/inbox?conversation=${encodeURIComponent(id)}`); };
  const back = () => { setSelectedId(null); setActionId(null); setDeleteId(null); setEditingId(null); setReplyId(null); setDraft(''); window.history.replaceState({}, '', '/inbox'); };
  const createDirect = async (person: Profile) => { const { data, error: e } = await supabase.rpc('create_direct_conversation', { target_profile: person.id }); if (e || !data) { setError(e?.message ?? 'Could not open chat.'); return; } setSearch(''); await load(); setSelectedId(data as string); window.history.replaceState({}, '', `/inbox?conversation=${encodeURIComponent(data as string)}`); };
  const send = async () => { const text = draft.trim(); if (!text || !selectedId) return; if (editingId) { const { error: e } = await supabase.rpc('edit_message', { p_message_id: editingId, p_content: text }); if (e) setError(e.message); else { setEditingId(null); setDraft(''); } return; } const payload: { conversation_id: string; sender_id: string; content: string; reply_to_message_id?: string } = { conversation_id: selectedId, sender_id: profileId, content: text }; if (replyId) payload.reply_to_message_id = replyId; const { error: e } = await supabase.from('messages').insert(payload); if (e) setError(e.message); else { setDraft(''); setReplyId(null); } };
  const toggleReaction = async (messageId: string, emoji: string) => { const dbReaction = reactionToDb[emoji]; const mine = reactions.find(r => r.message_id === messageId && r.profile_id === profileId); const result = mine?.reaction === dbReaction ? await supabase.rpc('remove_message_reaction', { p_message_id: messageId }) : await supabase.rpc('set_message_reaction', { p_message_id: messageId, p_reaction: dbReaction }); if (result.error) setError(result.error.message); else await load(); setActionId(null); };
  const deleteMe = async (id: string) => { const { error: e } = await supabase.rpc('delete_message_for_me', { p_message_id: id }); if (e) setError(e.message); else await load(); setDeleteId(null); setActionId(null); };
  const deleteEveryone = async (id: string) => { const m = byId(id); if (!m || m.sender_id !== profileId) return; const { error: e } = await supabase.rpc('delete_message_for_everyone', { p_message_id: id }); if (e) setError(e.message); else await load(); setDeleteId(null); setActionId(null); };
  const startPress = (id: string) => { if (longPress.current) window.clearTimeout(longPress.current); longPress.current = window.setTimeout(() => setActionId(id), 500); };
  const endPress = () => { if (longPress.current) { window.clearTimeout(longPress.current); longPress.current = null; } };

  const listVisible = !mobile || !selected;
  const chatVisible = !mobile || !!selected;
  return <main style={{ width: '100%', height: 'calc(100vh - 150px)', minHeight: 420, overflow: 'hidden' }}>
    <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'minmax(0,1fr)' : 'minmax(220px,300px) minmax(0,1fr)', height: '100%', width: '100%', overflow: 'hidden', border: '1px solid rgba(0,0,0,.12)', borderRadius: 14, background: '#fff' }}>
      <aside style={{ display: listVisible ? 'block' : 'none', minWidth: 0, overflowY: 'auto', padding: 10, borderRight: mobile ? 0 : '1px solid rgba(0,0,0,.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h1 style={{ margin: 0, fontSize: 22 }}>Inbox</h1><button type="button">＋ Group</button></div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people..." style={{ width: '100%', marginTop: 9, padding: 9, boxSizing: 'border-box' }} />
        {search.trim() && <div>{searchPeople.map(p => <button key={p.id} type="button" onClick={() => void createDirect(p)} style={{ display: 'flex', width: '100%', gap: 8, alignItems: 'center', border: 0, background: 'transparent', padding: 7, textAlign: 'left' }}>{p.avatar_url ? <img src={p.avatar_url} alt="" width={34} height={34} style={{ borderRadius: '50%', objectFit: 'cover' }} /> : <span>👤</span>}<span>{nameOf(p)}<small style={{ display: 'block' }}>@{p.username ?? ''}</small></span></button>)}</div>}
        {loading && <p>Loading chats…</p>}{error && <p role="alert">{error}</p>}{!loading && !conversations.length && <p>No conversations yet. Search for someone to start a chat.</p>}
        {conversations.map(c => { const member = members.find(m => m.conversation_id === c.id && m.profile_id !== profileId); const title = c.kind === 'group' ? c.title ?? 'Group' : nameOf(member?.profile); const avatar = c.kind === 'group' ? c.avatar_url : member?.profile?.avatar_url; const last = messages.filter(m => m.conversation_id === c.id && !m.deleted_at).at(-1); const count = unread(c.id); return <button key={c.id} type="button" onClick={() => void open(c.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: 8, marginTop: 5, border: '1px solid rgba(0,0,0,.07)', borderRadius: 9, background: selectedId === c.id ? 'rgba(0,0,0,.06)' : '#fff', textAlign: 'left', minWidth: 0 }}>{avatar ? <img src={avatar} alt="" width={36} height={36} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} /> : <span>👤</span>}<span style={{ flex: 1, minWidth: 0 }}><strong>{title}</strong><small style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{last?.content ?? 'No messages yet'}</small></span>{count > 0 && <b>{count > 8 ? '9+' : count}</b>}</button>; })}
      </aside>
      <section style={{ display: chatVisible ? 'grid' : 'none', gridTemplateRows: 'auto minmax(0,1fr) auto', minWidth: 0, minHeight: 0, height: '100%' }}>
        {selected ? <>
          <header style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,.1)', minWidth: 0 }}><button type="button" onClick={back} style={{ display: mobile ? 'inline-flex' : 'none', border: 0, background: 'transparent', fontSize: 22 }}>←</button>{other?.avatar_url ? <img src={other.avatar_url} alt="" width={40} height={40} style={{ borderRadius: '50%', objectFit: 'cover' }} /> : <span>👤</span>}<div style={{ minWidth: 0 }}><strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.kind === 'group' ? selected.title ?? 'Group' : nameOf(other)}</strong><small>{selected.kind === 'group' ? `${selectedMembers.length} members` : other?.username ? `@${other.username}` : ''}</small></div></header>
          <div style={{ overflowY: 'auto', minWidth: 0, padding: 10 }}>
            {!selectedMessages.length && <div style={{ height: '100%', display: 'grid', placeItems: 'center', opacity: .6 }}>No messages yet</div>}
            {selectedMessages.map(m => { const mine = m.sender_id === profileId; const sender = members.find(x => x.conversation_id === selected.id && x.profile_id === m.sender_id)?.profile; const reply = byId(m.reply_to_message_id); const avatar = sender?.avatar_url; return <div key={m.id} onMouseDown={() => startPress(m.id)} onMouseUp={endPress} onMouseLeave={endPress} onTouchStart={() => startPress(m.id)} onTouchEnd={endPress} onContextMenu={e => { e.preventDefault(); setActionId(m.id); }} style={{ display: 'flex', alignItems: 'flex-end', justifyContent: mine ? 'flex-end' : 'flex-start', gap: 6, marginBottom: 9 }}>
              {!mine && (avatar ? <img src={avatar} alt="" width={26} height={26} style={{ borderRadius: '50%', objectFit: 'cover' }} /> : <span>👤</span>)}
              <div style={{ maxWidth: '78%', minWidth: 0 }}>{selected.kind === 'group' && !mine && <small>{nameOf(sender)}</small>}{reply && <div style={{ fontSize: 11, opacity: .7, borderLeft: '3px solid currentColor', padding: '3px 6px', marginBottom: 3 }}>{nameOf(members.find(x => x.profile_id === reply.sender_id)?.profile)}: {reply.deleted_at ? 'Deleted message' : reply.content}</div>}<div style={{ padding: '8px 10px', borderRadius: 13, background: m.deleted_at ? '#eee' : mine ? '#17202a' : '#eef1f4', color: m.deleted_at ? '#777' : mine ? '#fff' : '#17202a', overflowWrap: 'anywhere' }}>{m.deleted_at ? 'Message deleted' : m.content}</div>{m.edited_at && !m.deleted_at && <small>edited</small>}{reactionRows(m.id).length > 0 && <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>{reactionRows(m.id).map(([r, info]) => <button key={r} type="button" onClick={() => void toggleReaction(m.id, r)} style={{ border: '1px solid rgba(0,0,0,.12)', borderRadius: 10, background: info.mine ? '#e8f0ff' : '#fff' }}>{r} {info.count}</button>)}</div>}
              {actionId === m.id && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, padding: 5, background: '#fff', border: '1px solid rgba(0,0,0,.15)', borderRadius: 9, boxShadow: '0 5px 18px rgba(0,0,0,.12)' }}>{REACTIONS.map(r => <button key={r} type="button" onClick={() => void toggleReaction(m.id, r)}>{r}</button>)}<button type="button" onClick={() => { setReplyId(m.id); setActionId(null); }}>Reply</button>{mine && !m.deleted_at && <button type="button" onClick={() => { setEditingId(m.id); setDraft(m.content); setActionId(null); }}>Edit</button>}{mine && !m.deleted_at && <button type="button" onClick={() => { setDeleteId(m.id); setActionId(null); }}>Delete</button>}{deleteId === m.id && <><button type="button" onClick={() => void deleteMe(m.id)}>Delete for me</button><button type="button" onClick={() => void deleteEveryone(m.id)}>Delete for everyone</button></>}</div>}</div>
              {mine && (me?.avatar_url ? <img src={me.avatar_url} alt="" width={26} height={26} style={{ borderRadius: '50%', objectFit: 'cover' }} /> : <span>👤</span>)}
            </div>; })}
          </div>
          <footer style={{ display: 'flex', gap: 7, padding: 8, borderTop: '1px solid rgba(0,0,0,.1)', background: '#fff', minWidth: 0 }}>{replyId && <small style={{ position: 'absolute', marginTop: -30 }}>Replying to: {byId(replyId)?.content}</small>}<input value={draft} onChange={e => setDraft(e.target.value)} placeholder={editingId ? 'Edit message...' : 'Write a message...'} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} style={{ flex: 1, minWidth: 0, padding: 9, borderRadius: 9, border: '1px solid rgba(0,0,0,.15)' }} /><button type="button" onClick={() => void send()} disabled={!draft.trim()}>{editingId ? 'Save' : 'Send'}</button></footer>
        </> : <div style={{ display: 'grid', placeItems: 'center', padding: 24 }}><div style={{ textAlign: 'center' }}><h2>Select a conversation</h2><p>Choose a chat or search for a person to start one.</p></div></div>}
      </section>
    </div>
  </main>;
}
