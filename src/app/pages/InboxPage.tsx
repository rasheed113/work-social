import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

type Profile = { id: string; display_name: string | null; username: string | null; avatar_url: string | null };
type Conversation = { id: string; kind: 'direct' | 'group'; title: string | null; avatar_url: string | null; created_by: string; updated_at: string };
type Message = { id: string; conversation_id: string; sender_id: string; content: string; created_at: string; read_at: string | null; reply_to_message_id: string | null; edited_at: string | null; deleted_at: string | null; deleted_for_everyone: boolean };
type Member = { conversation_id: string; profile_id: string; last_read_at: string | null; profile?: Profile };
type Reaction = { message_id: string; profile_id: string; reaction: string };

function nameOf(profile?: Profile) { return profile?.display_name ?? profile?.username ?? 'User'; }
function formatTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(); }

export function InboxPage({ profileId }: { profileId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('conversation'));
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [groupMode, setGroupMode] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedPeople, setSelectedPeople] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessageId, setActionMessageId] = useState<string | null>(null);
  const [deleteMenuId, setDeleteMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const longPressTimer = useRef<number | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    const { data: mine, error: mineError } = await supabase.from('conversation_members').select('conversation_id, profile_id, last_read_at').eq('profile_id', profileId);
    if (mineError) { setError(mineError.message); setLoading(false); return; }
    const ids = (mine ?? []).map((m: any) => m.conversation_id);
    if (!ids.length) { setConversations([]); setMembers([]); setMessages([]); setProfiles([]); setReactions([]); setLoading(false); return; }
    const [{ data: convs, error: ce }, { data: allMembers, error: me }, { data: allMessages, error: mse }] = await Promise.all([
      supabase.from('conversations').select('id, kind, title, avatar_url, created_by, updated_at').in('id', ids).order('updated_at', { ascending: false }),
      supabase.from('conversation_members').select('conversation_id, profile_id, last_read_at').in('conversation_id', ids),
      supabase.from('messages').select('id, conversation_id, sender_id, content, created_at, read_at, reply_to_message_id, edited_at, deleted_at, deleted_for_everyone').in('conversation_id', ids).order('created_at', { ascending: true }),
    ]);
    const firstError = ce ?? me ?? mse;
    if (firstError) { setError(firstError.message); setLoading(false); return; }
    const messageRows = (allMessages ?? []) as Message[];
    const memberRows = (allMembers ?? []) as Member[];
    const profileIds = [...new Set(memberRows.map((m) => m.profile_id).concat(messageRows.map((m) => m.sender_id)))];
    const { data: people, error: pe } = profileIds.length ? await supabase.from('profiles').select('id, display_name, username, avatar_url').in('id', profileIds) : { data: [], error: null };
    if (pe) { setError(pe.message); setLoading(false); return; }
    const { data: reactionRows, error: re } = messageRows.length ? await supabase.from('message_reactions').select('message_id, profile_id, reaction').in('message_id', messageRows.map((m) => m.id)) : { data: [], error: null };
    if (re) { setError(re.message); setLoading(false); return; }
    const profileMap = new Map((people ?? []).map((p: any) => [p.id, p as Profile]));
    setConversations((convs ?? []) as Conversation[]);
    setMembers(memberRows.map((m) => ({ ...m, profile: profileMap.get(m.profile_id) })));
    setMessages(messageRows);
    setProfiles((people ?? []).filter((p: any) => p.id !== profileId) as Profile[]);
    setReactions((reactionRows ?? []) as Reaction[]);
    setLoading(false);
    const requested = new URLSearchParams(window.location.search).get('conversation');
    if (requested && convs?.some((c: any) => c.id === requested)) setSelectedId(requested);
    else if (!selectedId && convs?.length) setSelectedId(convs[0].id);
  };

  useEffect(() => {
    void load();
    return () => { if (longPressTimer.current) window.clearTimeout(longPressTimer.current); };
  }, [profileId]);

  useEffect(() => {
    const channel = supabase.channel(`work-social-chat:${profileId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [profileId]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const selectedMessages = useMemo(() => messages.filter((m) => m.conversation_id === selectedId), [messages, selectedId]);
  const selectedMembers = members.filter((m) => m.conversation_id === selectedId);
  const other = selected?.kind === 'direct' ? selectedMembers.find((m) => m.profile_id !== profileId)?.profile : undefined;
  const peopleSearch = profiles.filter((p) => `${p.display_name ?? ''} ${p.username ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const messageById = (id: string | null) => id ? messages.find((m) => m.id === id) : undefined;

  const unreadFor = (conversationId: string) => {
    const mine = members.find((m) => m.conversation_id === conversationId && m.profile_id === profileId);
    const cutoff = mine?.last_read_at ? new Date(mine.last_read_at).getTime() : 0;
    return messages.filter((m) => m.conversation_id === conversationId && m.sender_id !== profileId && !m.deleted_at && new Date(m.created_at).getTime() > cutoff).length;
  };

  const reactionFor = (messageId: string) => {
    const map = new Map<string, { count: number; mine: boolean }>();
    reactions.filter((r) => r.message_id === messageId).forEach((r) => {
      const current = map.get(r.reaction) ?? { count: 0, mine: false };
      current.count += 1;
      if (r.profile_id === profileId) current.mine = true;
      map.set(r.reaction, current);
    });
    return [...map.entries()];
  };

  const openConversation = async (id: string) => {
    setSelectedId(id);
    const now = new Date().toISOString();
    const { error: e } = await supabase.from('conversation_members').update({ last_read_at: now }).eq('conversation_id', id).eq('profile_id', profileId);
    if (e) { setError(e.message); return; }
    setMembers((current) => current.map((m) => m.conversation_id === id && m.profile_id === profileId ? { ...m, last_read_at: now } : m));
    window.history.replaceState({}, '', `/inbox?conversation=${encodeURIComponent(id)}`);
  };

  const createDirect = async (person: Profile) => {
    setError(null);
    const { data, error: e } = await supabase.rpc('create_direct_conversation', { target_profile: person.id });
    if (e || !data) { setError(e?.message ?? 'Could not open chat.'); return; }
    setSearch(''); await load(); setSelectedId(data as string);
    window.history.replaceState({}, '', `/inbox?conversation=${encodeURIComponent(data as string)}`);
  };

  const send = async () => {
    const content = draft.trim();
    if (!content || !selectedId) return;
    if (editingId) {
      const { error: e } = await supabase.rpc('edit_message', { p_message_id: editingId, p_content: content });
      if (e) setError(e.message); else { setDraft(''); setEditingId(null); }
      return;
    }
    const payload: { conversation_id: string; sender_id: string; content: string; reply_to_message_id?: string } = { conversation_id: selectedId, sender_id: profileId, content };
    if (replyToId) payload.reply_to_message_id = replyToId;
    const { error: e } = await supabase.from('messages').insert(payload);
    if (e) setError(e.message); else { setDraft(''); setReplyToId(null); }
  };

  const toggleReaction = async (messageId: string, reaction: string) => {
    const mine = reactions.find((r) => r.message_id === messageId && r.profile_id === profileId);
    const result = mine?.reaction === reaction
      ? await supabase.rpc('remove_message_reaction', { p_message_id: messageId })
      : await supabase.rpc('set_message_reaction', { p_message_id: messageId, p_reaction: reaction });
    if (result.error) setError(result.error.message);
    setActionMessageId(null);
  };

  const deleteForMe = async (id: string) => {
    const { error: e } = await supabase.rpc('delete_message_for_me', { p_message_id: id });
    if (e) setError(e.message);
    setDeleteMenuId(null); setActionMessageId(null);
  };

  const deleteForEveryone = async (id: string) => {
    const message = messageById(id);
    if (!message || message.sender_id !== profileId) return;
    const { error: e } = await supabase.rpc('delete_message_for_everyone', { p_message_id: id });
    if (e) setError(e.message);
    setDeleteMenuId(null); setActionMessageId(null);
  };

  const beginLongPress = (id: string) => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => setActionMessageId(id), 500);
  };
  const endLongPress = () => {
    if (longPressTimer.current) { window.clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };
  const handleContextMenu = (event: React.MouseEvent, id: string) => { event.preventDefault(); setActionMessageId(id); };

  return (
    <main style={{ width: '100%', height: 'calc(100vh - 150px)', minHeight: 420, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 300px) minmax(0, 1fr)', height: '100%', width: '100%', overflow: 'hidden', border: '1px solid rgba(0,0,0,.12)', borderRadius: 14, background: 'white' }}>
        <aside style={{ borderRight: '1px solid rgba(0,0,0,.1)', padding: 10, overflowY: 'auto', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ margin: 0, fontSize: 22 }}>Inbox</h1>
            <button type="button" onClick={() => setGroupMode((v) => !v)}>＋ Group</button>
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people..." style={{ width: '100%', marginTop: 9, padding: 9, boxSizing: 'border-box' }} />
          {groupMode && <div style={{ marginTop: 8, padding: 8, border: '1px solid rgba(0,0,0,.1)', borderRadius: 9 }}><input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name" style={{ width: '100%', padding: 7, boxSizing: 'border-box' }} /><small>Select people from search results to create a group.</small></div>}
          {search.trim() && <div style={{ marginTop: 8 }}>{peopleSearch.map((p) => <button key={p.id} type="button" onClick={() => void createDirect(p)} style={{ display: 'flex', width: '100%', gap: 8, alignItems: 'center', border: 0, background: 'transparent', padding: 7, textAlign: 'left' }}>{p.avatar_url ? <img src={p.avatar_url} alt="" width={34} height={34} style={{ borderRadius: '50%', objectFit: 'cover' }} /> : <span>👤</span>}<span>{nameOf(p)}<small style={{ display: 'block' }}>@{p.username ?? ''}</small></span></button>)}</div>}
          {loading && <p>Loading chats…</p>}
          {error && <p role="alert">{error}</p>}
          {!loading && !conversations.length && <p>No conversations yet. Search for someone to start a chat.</p>}
          {conversations.map((c) => {
            const title = c.kind === 'group' ? (c.title ?? 'Group') : nameOf(members.find((m) => m.conversation_id === c.id && m.profile_id !== profileId)?.profile);
            const last = messages.filter((m) => m.conversation_id === c.id && !m.deleted_at).at(-1);
            const count = unreadFor(c.id);
            const avatar = c.kind === 'direct' ? members.find((m) => m.conversation_id === c.id && m.profile_id !== profileId)?.profile?.avatar_url : c.avatar_url;
            return <button key={c.id} type="button" onClick={() => void openConversation(c.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: 8, marginTop: 5, border: '1px solid rgba(0,0,0,.07)', borderRadius: 9, background: selectedId === c.id ? 'rgba(0,0,0,.06)' : 'white', textAlign: 'left', minWidth: 0 }}>{avatar ? <img src={avatar} alt="" width={36} height={36} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} /> : <span>👤</span>}<div style={{ flex: 1, minWidth: 0 }}><strong>{title}</strong><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><small>{last?.content ?? 'No messages yet'}</small></div></div>{count > 0 && <b>{count > 8 ? '9+' : count}</b>}</button>;
          })}
        </aside>
        <section style={{ display: selected ? 'grid' : 'none', gridTemplateRows: 'auto minmax(0, 1fr) auto', minWidth: 0, minHeight: 0, height: '100%' }}>
          {selected && <>
            <header style={{ padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,.1)', display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
              {other?.avatar_url ? <img src={other.avatar_url} alt="" width={40} height={40} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} /> : <span>👤</span>}
              <div style={{ minWidth: 0 }}><h2 style={{ margin: 0, fontSize: 17, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.kind === 'group' ? (selected.title ?? 'Group') : nameOf(other)}</h2><small>{selected.kind === 'group' ? `${selectedMembers.length} members` : other?.username ? `@${other.username}` : ''}</small></div>
            </header>
            <div style={{ padding: 10, overflowY: 'auto', minWidth: 0 }}>
              {selectedMessages.length === 0 && <div style={{ height: '100%', display: 'grid', placeItems: 'center', opacity: .65 }}>No messages yet</div>}
              {selectedMessages.map((m) => {
                const mine = m.sender_id === profileId;
                const sender = members.find((x) => x.conversation_id === selected.id && x.profile_id === m.sender_id)?.profile;
                const reply = messageById(m.reply_to_message_id);
                return <div key={m.id} onMouseDown={() => beginLongPress(m.id)} onMouseUp={endLongPress} onMouseLeave={endLongPress} onTouchStart={() => beginLongPress(m.id)} onTouchEnd={endLongPress} onContextMenu={(e) => handleContextMenu(e, m.id)} style={{ display: 'flex', alignItems: 'flex-end', gap: 6, justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 8, position: 'relative' }}>
                  {!mine && (sender?.avatar_url ? <img src={sender.avatar_url} alt="" width={26} height={26} style={{ borderRadius: '50%', objectFit: 'cover' }} /> : <span>👤</span>)}
                  <div style={{ maxWidth: '78%', minWidth: 0 }}>
                    {selected.kind === 'group' && !mine && <small style={{ display: 'block' }}>{nameOf(sender)}</small>}
                    {reply && <div style={{ fontSize: 11, opacity: .7, padding: '4px 7px', borderLeft: '3px solid currentColor', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis' }}>{nameOf(members.find((x) => x.profile_id === reply.sender_id)?.profile)}: {reply.deleted_at ? 'Deleted message' : reply.content}</div>}
                    <div style={{ padding: '8px 10px', borderRadius: 13, background: m.deleted_at ? '#eee' : mine ? '#17202a' : '#eef1f4', color: m.deleted_at ? '#777' : mine ? 'white' : '#17202a', overflowWrap: 'anywhere' }}>{m.deleted_at ? 'Message deleted' : m.content}</div>
                    {m.edited_at && !m.deleted_at && <small>edited</small>}
                    {reactionFor(m.id).length > 0 && <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>{reactionFor(m.id).map(([r, info]) => <button key={r} type="button" onClick={() => void toggleReaction(m.id, r)} style={{ border: '1px solid rgba(0,0,0,.12)', borderRadius: 10, background: 'white', fontSize: 12 }}>{r} {info.count}</button>)}</div>}
                    {actionMessageId === m.id && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 5, marginTop: 4, background: 'white', border: '1px solid rgba(0,0,0,.15)', borderRadius: 9, boxShadow: '0 5px 18px rgba(0,0,0,.12)' }}>{['😂','❤️','👍','😢','😡','😮'].map((r) => <button key={r} type="button" onClick={() => void toggleReaction(m.id, r)}>{r}</button>)}<button type="button" onClick={() => { setReplyToId(m.id); setDraft(''); setActionMessageId(null); }}>Reply</button>{mine && !m.deleted_at && <button type="button" onClick={() => { setEditingId(m.id); setDraft(m.content); setActionMessageId(null); }}>Edit</button>}{mine && !m.deleted_at && <button type="button" onClick={() => { setDeleteMenuId(m.id); setActionMessageId(null); }}>Delete</button>}{deleteMenuId === m.id && <><button type="button" onClick={() => void deleteForMe(m.id)}>Delete for me</button><button type="button" onClick={() => void deleteForEveryone(m.id)}>Delete for everyone</button></>}</div>}
                  </div>
                  {mine && (profiles.find((p) => p.id === profileId)?.avatar_url ? <img src={profiles.find((p) => p.id === profileId)?.avatar_url} alt="" width={26} height={26} style={{ borderRadius: '50%', objectFit: 'cover' }} /> : <span>👤</span>)}
                </div>;
              })}
            </div>
            <footer style={{ display: 'flex', gap: 7, padding: 8, borderTop: '1px solid rgba(0,0,0,.1)', background: 'white', minWidth: 0 }}>
              {replyToId && <div style={{ position: 'absolute', marginTop: -34, fontSize: 11, opacity: .7 }}>Replying to: {messageById(replyToId)?.content}</div>}
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={editingId ? 'Edit message...' : 'Write a message...'} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} style={{ flex: 1, minWidth: 0, padding: 9, borderRadius: 9, border: '1px solid rgba(0,0,0,.15)' }} />
              <button type="button" onClick={() => void send()} disabled={!draft.trim()}>{editingId ? 'Save' : 'Send'}</button>
            </footer>
          </>}
        </section>
        {!selected && <div style={{ display: 'grid', placeItems: 'center', padding: 24 }}><div style={{ textAlign: 'center' }}><h2>Select a conversation</h2><p>Choose a chat or search for a person to start one.</p></div></div>}
      </div>
    </main>
  );
}
