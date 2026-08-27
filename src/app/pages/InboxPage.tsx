import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

interface InboxPageProps { profileId: string; }
type Profile = { id: string; display_name: string | null; username: string | null; avatar_url: string | null };
type Conversation = { id: string; kind: 'direct' | 'group'; title: string | null; avatar_url: string | null; created_by: string; updated_at: string };
type Message = { id: string; conversation_id: string; sender_id: string; content: string; created_at: string; read_at: string | null };
type Member = { conversation_id: string; profile_id: string; profile?: Profile };

function displayName(profile?: Profile) { return profile?.display_name ?? profile?.username ?? 'User'; }
function time(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(); }

export function InboxPage({ profileId }: InboxPageProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [groupMode, setGroupMode] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedPeople, setSelectedPeople] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unread, setUnread] = useState<Record<string, number>>({});

  const load = async () => {
    setLoading(true); setError(null);
    const { data: mine, error: memberError } = await supabase.from('conversation_members').select('conversation_id, profile_id').eq('profile_id', profileId);
    if (memberError) { setError(memberError.message); setLoading(false); return; }
    const ids = (mine ?? []).map((row: any) => row.conversation_id);
    if (!ids.length) { setConversations([]); setMembers([]); setMessages([]); setUnread({}); setLoading(false); return; }
    const [{ data: convs, error: convError }, { data: allMembers, error: allMemberError }, { data: allMessages, error: messageError }] = await Promise.all([
      supabase.from('conversations').select('id, kind, title, avatar_url, created_by, updated_at').in('id', ids).order('updated_at', { ascending: false }),
      supabase.from('conversation_members').select('conversation_id, profile_id').in('conversation_id', ids),
      supabase.from('messages').select('id, conversation_id, sender_id, content, created_at, read_at').in('conversation_id', ids).order('created_at', { ascending: true }),
    ]);
    const firstError = convError ?? allMemberError ?? messageError;
    if (firstError) { setError(firstError.message); setLoading(false); return; }
    const memberRows = (allMembers ?? []) as Member[];
    const profileIds = [...new Set(memberRows.map((m) => m.profile_id).concat((allMessages ?? []).map((m: any) => m.sender_id)))];
    const { data: people, error: profileError } = await supabase.from('profiles').select('id, display_name, username, avatar_url').in('id', profileIds);
    if (profileError) { setError(profileError.message); setLoading(false); return; }
    const profileMap = new Map((people ?? []).map((p: any) => [p.id, p as Profile]));
    setConversations((convs ?? []) as Conversation[]);
    setMembers(memberRows.map((m) => ({ ...m, profile: profileMap.get(m.profile_id) })));
    setMessages((allMessages ?? []) as Message[]);
    setProfiles((people ?? []).filter((p: any) => p.id !== profileId) as Profile[]);
    const counts: Record<string, number> = {};
    (allMessages ?? []).forEach((m: any) => { if (m.sender_id !== profileId && !m.read_at) counts[m.conversation_id] = (counts[m.conversation_id] ?? 0) + 1; });
    setUnread(counts);
    if (!selectedId && convs?.length) setSelectedId(convs[0].id);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [profileId]);
  useEffect(() => {
    const channel = supabase.channel(`chat:${profileId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const row = payload.new as Message;
        if (row.sender_id === profileId || members.some((m) => m.conversation_id === row.conversation_id && m.profile_id === profileId)) void load();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [profileId, members]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const selectedMessages = useMemo(() => messages.filter((m) => m.conversation_id === selectedId), [messages, selectedId]);
  const selectedMembers = members.filter((m) => m.conversation_id === selectedId);
  const selectedOther = selected?.kind === 'direct' ? selectedMembers.find((m) => m.profile_id !== profileId)?.profile : undefined;
  const peopleForGroup = profiles.filter((p) => `${p.display_name ?? ''} ${p.username ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));

  const openConversation = async (id: string) => {
    setSelectedId(id);
    const unreadIds = messages.filter((m) => m.conversation_id === id && m.sender_id !== profileId && !m.read_at).map((m) => m.id);
    if (unreadIds.length) {
      const { error: readError } = await supabase.from('messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds).eq('sender_id', profileId === '' ? profileId : messages.find((m) => unreadIds.includes(m.id))?.sender_id ?? '');
      if (readError) { setError(readError.message); return; }
      setUnread((current) => ({ ...current, [id]: 0 }));
      setMessages((current) => current.map((m) => unreadIds.includes(m.id) ? { ...m, read_at: new Date().toISOString() } : m));
    }
  };

  const createDirect = async (person: Profile) => {
    const [a, b] = [profileId, person.id].sort();
    const directKey = `${a}:${b}`;
    let { data: existing } = await supabase.from('conversations').select('id').eq('kind', 'direct').eq('direct_key', directKey).maybeSingle();
    if (!existing) {
      const { data: created, error: createError } = await supabase.from('conversations').insert({ kind: 'direct', created_by: profileId, direct_user_a: a, direct_user_b: b, direct_key: directKey }).select('id').single();
      if (createError) { setError(createError.message); return; }
      existing = created;
      const { error: memberError } = await supabase.from('conversation_members').insert([{ conversation_id: created.id, profile_id: profileId }, { conversation_id: created.id, profile_id: person.id }]);
      if (memberError) { setError(memberError.message); return; }
    }
    setGroupMode(false); setSearch(''); await load(); setSelectedId(existing.id);
  };

  const createGroup = async () => {
    const ids = [...selectedPeople].filter((id) => id !== profileId);
    if (!groupName.trim() || !ids.length) return;
    const { data: created, error: createError } = await supabase.from('conversations').insert({ kind: 'group', title: groupName.trim(), created_by: profileId }).select('id').single();
    if (createError) { setError(createError.message); return; }
    const rows = [profileId, ...ids].map((id) => ({ conversation_id: created.id, profile_id: id }));
    const { error: memberError } = await supabase.from('conversation_members').insert(rows);
    if (memberError) { setError(memberError.message); return; }
    setGroupName(''); setSelectedPeople(new Set()); setGroupMode(false); setSearch(''); await load(); setSelectedId(created.id);
  };

  const send = async () => {
    const content = draft.trim(); if (!content || !selectedId) return;
    const { error: sendError } = await supabase.from('messages').insert({ conversation_id: selectedId, sender_id: profileId, content });
    if (sendError) { setError(sendError.message); return; }
    setDraft('');
    await load();
  };

  return <main style={{ width: '100%' }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) 1fr', minHeight: '70vh', border: '1px solid rgba(0,0,0,.12)', borderRadius: 16, overflow: 'hidden', background: 'white' }}>
      <aside style={{ borderRight: '1px solid rgba(0,0,0,.1)', padding: 14, overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><h1 style={{ margin: 0 }}>Inbox</h1><button type="button" onClick={() => setGroupMode((v) => !v)}>＋ Group</button></div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people..." aria-label="Search people" style={{ width: '100%', marginTop: 12, padding: 10 }} />
        {groupMode && <section style={{ marginTop: 12, padding: 10, border: '1px solid rgba(0,0,0,.1)', borderRadius: 10 }}><input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name" style={{ width: '100%', padding: 8 }} />{peopleForGroup.map((p) => <label key={p.id} style={{ display: 'flex', gap: 8, padding: 8, alignItems: 'center' }}><input type="checkbox" checked={selectedPeople.has(p.id)} onChange={() => setSelectedPeople((current) => { const next = new Set(current); if (next.has(p.id)) next.delete(p.id); else next.add(p.id); return next; })} />{displayName(p)}</label>)}<button type="button" disabled={!groupName.trim() || !selectedPeople.size} onClick={() => void createGroup()}>Create group</button></section>}
        {search.trim() && !groupMode && <section style={{ marginTop: 12 }}><strong>Start a chat</strong>{peopleForGroup.map((p) => <button key={p.id} type="button" onClick={() => void createDirect(p)} style={{ display: 'flex', width: '100%', gap: 8, alignItems: 'center', border: 0, background: 'transparent', padding: 9, textAlign: 'left' }}>{p.avatar_url ? <img src={p.avatar_url} alt="" width={36} height={36} style={{ borderRadius: '50%', objectFit: 'cover' }} /> : <span>👤</span>}<span>{displayName(p)}<small style={{ display: 'block' }}>@{p.username ?? ''}</small></span></button>)}</section>}
        {loading && <p>Loading chats…</p>}{error && <p role="alert">{error}</p>}
        {!loading && !conversations.length && <p>No conversations yet. Search for someone to start a chat.</p>}
        <div>{conversations.map((conversation) => { const title = conversation.kind === 'group' ? (conversation.title ?? 'Group') : displayName(members.find((m) => m.conversation_id === conversation.id && m.profile_id !== profileId)?.profile); const last = messages.filter((m) => m.conversation_id === conversation.id).at(-1); return <button key={conversation.id} type="button" onClick={() => void openConversation(conversation.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: 11, marginTop: 6, border: '1px solid rgba(0,0,0,.08)', borderRadius: 10, background: selectedId === conversation.id ? 'rgba(0,0,0,.06)' : 'white', textAlign: 'left' }}><div style={{ flex: 1 }}><strong>{conversation.kind === 'group' ? '👥 ' : ''}{title}</strong><div><small>{last?.content ?? 'No messages yet'}</small></div></div>{unread[conversation.id] ? <b>{unread[conversation.id] > 8 ? '9+' : unread[conversation.id]}</b> : null}</button>; })}</div>
      </aside>
      <section style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto', minWidth: 0 }}>
        {selected ? <><header style={{ padding: 14, borderBottom: '1px solid rgba(0,0,0,.1)' }}><h2 style={{ margin: 0 }}>{selected.kind === 'group' ? `👥 ${selected.title ?? 'Group'}` : displayName(selectedOther)}</h2><small>{selected.kind === 'group' ? `${selectedMembers.length} members` : selectedOther?.username ? `@${selectedOther.username}` : 'Direct conversation'}</small></header><div style={{ padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>{selectedMessages.map((message) => { const mine = message.sender_id === profileId; const sender = members.find((m) => m.conversation_id === selected.id && m.profile_id === message.sender_id)?.profile; return <div key={message.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%' }}><small style={{ display: 'block', marginBottom: 2 }}>{selected.kind === 'group' && !mine ? displayName(sender) : ''}</small><div style={{ padding: '9px 12px', borderRadius: 14, background: mine ? '#17202a' : '#eef1f4', color: mine ? 'white' : '#17202a' }}>{message.content}</div><small style={{ display: 'block', marginTop: 2, textAlign: mine ? 'right' : 'left' }}>{time(message.created_at)}</small></div>; })}</div><footer style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid rgba(0,0,0,.1)' }}><input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="Write a message..." style={{ flex: 1, padding: 11 }} /><button type="button" onClick={() => void send()} disabled={!draft.trim()}>Send</button></footer></> : <div style={{ display: 'grid', placeItems: 'center', padding: 24 }}><h2>Select a conversation</h2><p>Choose a chat or search for a person to start one.</p></div>}
      </section>
    </div>
  </main>;
}
