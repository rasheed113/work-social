-- Work Social private Messenger-style conversations.
-- One persistent conversation per direct pair; groups use the same conversation/message model.
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct' check (kind in ('direct', 'group')),
  title text,
  avatar_url text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  direct_user_a uuid references public.profiles(id) on delete cascade,
  direct_user_b uuid references public.profiles(id) on delete cascade,
  direct_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'direct' and direct_user_a is not null and direct_user_b is not null and direct_user_a <> direct_user_b) or (kind = 'group' and direct_user_a is null and direct_user_b is null))
);

alter table public.conversations add column if not exists direct_key text;
create unique index if not exists conversations_direct_key_idx on public.conversations(direct_key) where kind = 'direct';
create index if not exists conversations_updated_idx on public.conversations(updated_at desc);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, profile_id)
);
alter table public.conversation_members add column if not exists last_read_at timestamptz;
create index if not exists conversation_members_profile_idx on public.conversation_members(profile_id, conversation_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (length(btrim(content)) > 0 and length(content) <= 10000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index if not exists messages_unread_idx on public.messages(conversation_id, sender_id, created_at);

create or replace function public.touch_conversation_updated_at() returns trigger
language plpgsql set search_path = pg_catalog, public
as $$
begin
  update public.conversations set updated_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;
drop trigger if exists trg_touch_conversation_updated_at on public.messages;
create trigger trg_touch_conversation_updated_at after insert on public.messages for each row execute function public.touch_conversation_updated_at();

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

drop policy if exists conversations_member_select on public.conversations;
create policy conversations_member_select on public.conversations for select to authenticated
  using (exists (select 1 from public.conversation_members cm where cm.conversation_id = id and cm.profile_id = auth.uid()));
drop policy if exists conversations_create_own on public.conversations;
create policy conversations_create_own on public.conversations for insert to authenticated with check (created_by = auth.uid());
drop policy if exists conversations_creator_update on public.conversations;
create policy conversations_creator_update on public.conversations for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists conversation_members_select_own on public.conversation_members;
create policy conversation_members_select_own on public.conversation_members for select to authenticated
  using (profile_id = auth.uid() or exists (select 1 from public.conversation_members mine where mine.conversation_id = conversation_id and mine.profile_id = auth.uid()));
drop policy if exists conversation_members_insert_authorized on public.conversation_members;
create policy conversation_members_insert_authorized on public.conversation_members for insert to authenticated
  with check (profile_id = auth.uid() or exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = auth.uid()));
drop policy if exists conversation_members_delete_authorized on public.conversation_members;
create policy conversation_members_delete_authorized on public.conversation_members for delete to authenticated
  using (profile_id = auth.uid() or exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = auth.uid()));
drop policy if exists conversation_members_update_read on public.conversation_members;
create policy conversation_members_update_read on public.conversation_members for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists messages_member_select on public.messages;
create policy messages_member_select on public.messages for select to authenticated
  using (exists (select 1 from public.conversation_members cm where cm.conversation_id = conversation_id and cm.profile_id = auth.uid()));
drop policy if exists messages_member_insert on public.messages;
create policy messages_member_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and exists (select 1 from public.conversation_members cm where cm.conversation_id = conversation_id and cm.profile_id = auth.uid()));
drop policy if exists messages_member_update on public.messages;
create policy messages_member_update on public.messages for update to authenticated
  using (sender_id = auth.uid() or exists (select 1 from public.conversation_members cm where cm.conversation_id = conversation_id and cm.profile_id = auth.uid()))
  with check (sender_id = (select m.sender_id from public.messages m where m.id = id));

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;
