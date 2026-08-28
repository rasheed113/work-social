import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type Conversation = {
  id: string;
  kind: 'direct' | 'group';
  title: string | null;
  avatar_url: string | null;
  updated_at: string;
};

type Member = {
  conversation_id: string;
  profile_id: string;
  last_read_at: string | null;
  profile?: Profile;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  deleted_at: string | null;
};

type PresencePayload = {
  profile_id?: string;
  user_id?: string;
  userId?: string;
};

const displayName = (profile?: Profile) => profile?.display_name?.trim() || 'User';
const PRESENCE_CHANNEL = 'work-social-presence';

export function InboxPagePremiumActions({ profileId }: { profileId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('conversation'));
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [marked, setMarked] = useState(false);
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  const [peerOnline, setPeerOnline] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);

    const { data: mine, error: memberError } = await supabase
      .from('conversation_members')
      .select('conversation_id, profile_id, last_read_at')
      .eq('profile_id', profileId);

    if (memberError) {
      setError(memberError.message);
      setLoading(false);
      return;
    }

    const ids = (mine ?? []).map((row: Member) => row.conversation_id);
    if (!ids.length) {
      setConversations([]);
      setMembers([]);
      setMessages([]);
      setProfiles([]);
      setMarked(false);
      setLoading(false);
      return;
    }

    const [conversationResult, memberResult, messageResult, markResult] = await Promise.all([
      supabase
        .from('conversations')
        .select('id, kind, title, avatar_url, updated_at')
        .in('id', ids)
        .order('updated_at', { ascending: false }),
      supabase
        .from('conversation_members')
        .select('conversation_id, profile_id, last_read_at')
        .in('conversation_id', ids),
      supabase
        .from('messages')
        .select('id, conversation_id, sender_id, content, created_at, deleted_at')
        .in('conversation_id', ids)
        .order('created_at', { ascending: true }),
      supabase
        .from('conversation_delete_marks')
        .select('conversation_id')
        .eq('profile_id', profileId)
        .in('conversation_id', ids),
    ]);

    const queryError = conversationResult.error ?? memberResult.error ?? messageResult.error ?? markResult.error;
    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const memberRows = (memberResult.data ?? []) as Member[];
    const messageRows = (messageResult.data ?? []) as Message[];
    const profileIds = [...new Set(memberRows.map((row) => row.profile_id).concat(messageRows.map((row) => row.sender_id)))];

    const profileResult = profileIds.length
      ? await supabase.from('profiles').select('id, display_name, username, avatar_url').in('id', profileIds)
      : { data: [], error: null };

    if (profileResult.error) {
      setError(profileResult.error.message);
      setLoading(false);
      return;
    }

    const profileMap = new Map((profileResult.data ?? []).map((profile) => [profile.id, profile as Profile]));
    const hydratedMembers = memberRows.map((member) => ({ ...member, profile: profileMap.get(member.profile_id) }));

    setConversations((conversationResult.data ?? []) as Conversation[]);
    setMembers(hydratedMembers);
    setMessages(messageRows);
    setProfiles((profileResult.data ?? []) as Profile[]);
    setMarked(Boolean((markResult.data ?? []).some((row: { conversation_id: string }) => row.conversation_id === selectedId)));
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [profileId]);

  useEffect(() => {
    const resize = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-inbox-popover]')) setMoreOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`work-social-chat:${profileId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, () => void load())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profileId]);

  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null;
  const selectedMembers = members.filter((member) => member.conversation_id === selectedId);
  const selectedMessages = useMemo(
    () => messages.filter((message) => message.conversation_id === selectedId),
    [messages, selectedId],
  );
  const other = selected?.kind === 'direct'
    ? selectedMembers.find((member) => member.profile_id !== profileId)?.profile
    : undefined;

  useEffect(() => {
    setPeerOnline(false);
    if (!profileId || !other?.id) return;

    let disposed = false;
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: profileId } },
    });

    const isPeerOnline = () => {
      if (disposed) return;
      try {
        const state = channel.presenceState<PresencePayload>();
        const peerId = other.id;
        const online = Object.entries(state).some(([key, entries]) =>
          key === peerId || entries.some((entry) =>
            entry.profile_id === peerId || entry.user_id === peerId || entry.userId === peerId,
          ),
        );
        setPeerOnline(online);
      } catch {
        setPeerOnline(false);
      }
    };

    channel
      .on('presence', { event: 'sync' }, isPeerOnline)
      .on('presence', { event: 'join' }, isPeerOnline)
      .on('presence', { event: 'leave' }, isPeerOnline)
      .subscribe((status) => {
        if (disposed) return;
        if (status !== 'SUBSCRIBED') {
          setPeerOnline(false);
          return;
        }
        void channel.track({
          profile_id: profileId,
          user_id: profileId,
          userId: profileId,
        }).then(isPeerOnline).catch(() => setPeerOnline(false));
      });

    return () => {
      disposed = true;
      setPeerOnline(false);
      void supabase.removeChannel(channel);
    };
  }, [profileId, other?.id]);

  const searchPeople = profiles.filter((profile) =>
    profile.id !== profileId && displayName(profile).toLowerCase().includes(search.trim().toLowerCase()),
  );

  const openConversation = async (conversationId: string) => {
    setSelectedId(conversationId);
    setMoreOpen(false);
    window.history.replaceState({}, '', `/inbox?conversation=${encodeURIComponent(conversationId)}`);
    await supabase
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('profile_id', profileId);
    await load();
  };

  const back = () => {
    setSelectedId(null);
    setMoreOpen(false);
    window.history.replaceState({}, '', '/inbox');
  };

  const createDirect = async (person: Profile) => {
    const { data, error: rpcError } = await supabase.rpc('create_direct_conversation', { target_profile: person.id });
    if (rpcError || !data) {
      setError(rpcError?.message ?? 'Could not open chat.');
      return;
    }
    setSearch('');
    await load();
    await openConversation(data as string);
  };

  const sendText = async () => {
    const text = draft.trim();
    if (!text || !selectedId) return;
    const { error: sendError } = await supabase.from('messages').insert({
      conversation_id: selectedId,
      sender_id: profileId,
      content: text,
    });
    if (sendError) setError(sendError.message);
    else setDraft('');
  };

  const clearChat = async () => {
    if (!selectedId) return;
    const { error: rpcError } = await supabase.rpc('clear_conversation_for_me', { p_conversation_id: selectedId });
    if (rpcError) setError(rpcError.message);
    else await load();
    setMoreOpen(false);
  };

  const toggleMarkDelete = async () => {
    if (!selectedId) return;
    const rpcName = marked ? 'unmark_conversation_for_delete' : 'mark_conversation_for_delete';
    const { error: rpcError } = await supabase.rpc(rpcName, { p_conversation_id: selectedId });
    if (rpcError) setError(rpcError.message);
    else {
      setMarked((value) => !value);
      setMoreOpen(false);
    }
  };

  const deleteChat = async () => {
    if (!selectedId) return;
    const { error: rpcError } = await supabase.rpc('delete_conversation_for_me', { p_conversation_id: selectedId });
    if (rpcError) setError(rpcError.message);
    else back();
  };

  return (
    <main className="premium-chat-page" style={{ height: 'calc(100vh - 150px)', minHeight: 420, width: '100%', overflow: 'hidden' }}>
      <style>{`
        .premium-chat-page{color:#17202a}
        .premium-chat-shell{height:100%;display:grid;border:1px solid rgba(99,102,241,.16);border-radius:22px;overflow:hidden;background:#fff;box-shadow:0 18px 50px rgba(15,23,42,.12)}
        .premium-chat-sidebar{background:linear-gradient(180deg,#f8faff,#fff);padding:12px;overflow-y:auto;border-right:1px solid rgba(99,102,241,.1)}
        .premium-chat-header{position:relative;display:flex;align-items:center;gap:10px;min-height:72px;padding:10px 14px;background:linear-gradient(135deg,#fff,#f5f7ff 55%,#effcff);border-bottom:1px solid rgba(99,102,241,.13);box-shadow:0 8px 24px rgba(15,23,42,.07)}
        .premium-chat-header:before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(180deg,#6d5dfc,#22c1dc,#ff5ca8)}
        .premium-chat-avatar{position:relative;z-index:1;width:46px;height:46px;flex:0 0 46px;border-radius:50%;object-fit:cover;border:2px solid #fff;box-shadow:0 6px 16px rgba(79,70,229,.16)}
        .premium-chat-title{min-width:0;flex:1}
        .premium-chat-title strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:15px;font-weight:900}
        .premium-chat-title small{display:block;margin-top:3px;color:#667085;font-size:11px;font-weight:700}
        .premium-chat-button{border:1px solid rgba(99,102,241,.14);border-radius:13px;background:rgba(255,255,255,.9);color:#4f46e5;cursor:pointer;box-shadow:0 5px 14px rgba(79,70,229,.08)}
        .premium-chat-more{position:relative;z-index:20;width:42px;height:42px;font-size:22px}
        .premium-chat-popover{position:absolute;right:10px;top:62px;z-index:100;width:250px;padding:7px;border:1px solid rgba(99,102,241,.14);border-radius:18px;background:rgba(255,255,255,.97);backdrop-filter:blur(18px);box-shadow:0 18px 50px rgba(15,23,42,.18)}
        .premium-chat-popover button{width:100%;padding:11px 12px;border:0;border-radius:12px;background:transparent;text-align:left;font-weight:800;cursor:pointer}
        .premium-chat-popover button:hover{background:#f3f4ff}
        .premium-chat-popover .danger{color:#dc2626}
        .premium-chat-list-button{display:flex;align-items:center;gap:9px;width:100%;padding:9px;margin-top:6px;border:1px solid rgba(99,102,241,.08);border-radius:13px;background:#fff;text-align:left;cursor:pointer}
        .premium-chat-list-button img{width:38px;height:38px;border-radius:50%;object-fit:cover}
        .premium-chat-body{min-width:0;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;position:relative}
        .premium-chat-messages{overflow-y:auto;padding:12px;background:linear-gradient(180deg,#fafbff,#fff)}
        .premium-chat-compose{display:flex;gap:7px;align-items:center;padding:9px;border-top:1px solid rgba(99,102,241,.1);background:#fff}
        .premium-chat-compose input{flex:1;min-width:0;padding:10px 13px;border:1px solid rgba(99,102,241,.16);border-radius:999px;outline:none}
        .premium-chat-bubble{max-width:82%;padding:9px 11px;border-radius:15px;overflow-wrap:anywhere}
        .realtime-presence{display:flex;align-items:center;gap:5px;margin-top:3px;color:#667085;font-size:11px;font-weight:700}
        .realtime-presence-dot{width:7px;height:7px;border-radius:50%;background:#98a2b3;box-shadow:0 0 0 2px rgba(152,162,179,.12)}
        .realtime-presence-dot.online{background:#12b76a;box-shadow:0 0 0 2px rgba(18,183,106,.13)}
        .realtime-presence.online-text{color:#079455}
        @media(max-width:767px){.premium-chat-header{min-height:66px;padding:8px 10px}.premium-chat-avatar{width:40px;height:40px;flex-basis:40px}.premium-chat-popover{width:min(250px,calc(100vw - 32px))}}
      `}</style>

      <div
        className="premium-chat-shell"
        style={{ gridTemplateColumns: mobile ? '1fr' : 'minmax(220px,300px) minmax(0,1fr)' }}
      >
        <aside className="premium-chat-sidebar" style={{ display: !mobile || !selected ? 'block' : 'none' }}>
          <h1 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 900 }}>Inbox</h1>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search people..."
            style={{ width: '100%', boxSizing: 'border-box', padding: 10, border: '1px solid rgba(99,102,241,.16)', borderRadius: 12 }}
          />
          {search.trim() && searchPeople.map((person) => (
            <button key={person.id} className="premium-chat-list-button" type="button" onClick={() => void createDirect(person)}>
              {person.avatar_url ? <img src={person.avatar_url} alt="" /> : <span>👤</span>}
              <strong>{displayName(person)}</strong>
            </button>
          ))}
          {loading && <p>Loading chats…</p>}
          {error && <p role="alert" style={{ overflowWrap: 'anywhere' }}>{error}</p>}
          {!loading && !conversations.length && <p>No conversations yet. Search for someone to start a chat.</p>}
          {conversations.map((conversation) => {
            const member = members.find((item) => item.conversation_id === conversation.id && item.profile_id !== profileId);
            const title = conversation.kind === 'group' ? conversation.title || 'Group' : displayName(member?.profile);
            const avatar = conversation.kind === 'group' ? conversation.avatar_url : member?.profile?.avatar_url;
            const last = messages.filter((message) => message.conversation_id === conversation.id).at(-1);
            return (
              <button
                key={conversation.id}
                className="premium-chat-list-button"
                type="button"
                onClick={() => void openConversation(conversation.id)}
                style={{ background: selectedId === conversation.id ? '#f2f3ff' : '#fff' }}
              >
                {avatar ? <img src={avatar} alt="" /> : <span>👤</span>}
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</strong>
                  <small style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{last?.deleted_at ? 'Message deleted' : last?.content || 'No messages yet'}</small>
                </span>
              </button>
            );
          })}
        </aside>

        <section className="premium-chat-body" style={{ display: !mobile || selected ? 'grid' : 'none' }}>
          {selected ? (
            <>
              <header className="premium-chat-header" data-inbox-popover>
                {mobile && <button className="premium-chat-button" type="button" onClick={back} style={{ width: 40, height: 40, fontSize: 22 }}>←</button>}
                {other?.avatar_url ? <img className="premium-chat-avatar" src={other.avatar_url} alt="" /> : <span className="premium-chat-avatar" style={{ display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#eef2ff,#ecfeff)', fontSize: 22 }}>👤</span>}
                <div className="premium-chat-title">
                  <strong>{selected.kind === 'group' ? selected.title || 'Group' : displayName(other)}</strong>
                  {selected.kind === 'group' ? (
                    <small>{selectedMembers.length} members</small>
                  ) : (
                    <small className={peerOnline ? 'realtime-presence online-text' : 'realtime-presence'}>
                      <span className={`realtime-presence-dot${peerOnline ? ' online' : ''}`} aria-hidden="true" />
                      {peerOnline ? 'Online' : 'Offline'}
                    </small>
                  )}
                </div>
                <button
                  className="premium-chat-button premium-chat-more"
                  type="button"
                  aria-label="More chat options"
                  onClick={(event) => { event.stopPropagation(); setMoreOpen((value) => !value); }}
                >⋮</button>
                {moreOpen && (
                  <div className="premium-chat-popover" data-inbox-popover onPointerDown={(event) => event.stopPropagation()}>
                    <button type="button" onClick={() => void clearChat()}>🧹 &nbsp; Clear chat</button>
                    <button type="button" onClick={() => void toggleMarkDelete()}>✦ &nbsp; {marked ? 'Unmark delete' : 'Mark to delete'}</button>
                    <button className="danger" type="button" onClick={() => void deleteChat()}>🗑 &nbsp; Delete chat</button>
                  </div>
                )}
              </header>

              <div className="premium-chat-messages">
                {!selectedMessages.length && <div style={{ height: '100%', display: 'grid', placeItems: 'center', opacity: .55 }}>No messages yet</div>}
                {selectedMessages.map((message) => {
                  const mine = message.sender_id === profileId;
                  return (
                    <div key={message.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                      <div className="premium-chat-bubble" style={{ background: mine ? 'linear-gradient(135deg,#6d5dfc,#22c1dc)' : '#eef1f4', color: mine ? '#fff' : '#17202a' }}>
                        {message.deleted_at ? 'Message deleted' : message.content}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="premium-chat-compose">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendText(); } }}
                  placeholder="Write a message..."
                />
                <button className="premium-chat-button" type="button" onClick={() => void sendText()} disabled={!draft.trim()}>Send</button>
              </div>
            </>
          ) : (
            <div style={{ display: 'grid', placeItems: 'center', opacity: .55 }}>Select a conversation</div>
          )}
        </section>
      </div>
    </main>
  );
}
