-- Inbox chat actions: clear messages for me, remove a chat from my inbox, and persist a delete mark.
create table if not exists public.conversation_delete_marks (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  marked_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);

alter table public.conversation_delete_marks enable row level security;

drop policy if exists conversation_delete_marks_select_own on public.conversation_delete_marks;
create policy conversation_delete_marks_select_own on public.conversation_delete_marks for select to authenticated using (profile_id = auth.uid());
drop policy if exists conversation_delete_marks_insert_own on public.conversation_delete_marks;
create policy conversation_delete_marks_insert_own on public.conversation_delete_marks for insert to authenticated with check (profile_id = auth.uid() and public.is_conversation_member(conversation_id));
drop policy if exists conversation_delete_marks_delete_own on public.conversation_delete_marks;
create policy conversation_delete_marks_delete_own on public.conversation_delete_marks for delete to authenticated using (profile_id = auth.uid());
grant select, insert, delete on public.conversation_delete_marks to authenticated;

drop function if exists public.clear_conversation_for_me(uuid);
create or replace function public.clear_conversation_for_me(p_conversation_id uuid) returns integer language plpgsql security definer set search_path = public as $$
declare affected integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_conversation_member(p_conversation_id) then raise exception 'Conversation not found'; end if;
  insert into public.message_hidden_for(message_id, profile_id)
  select m.id, auth.uid() from public.messages m where m.conversation_id = p_conversation_id
  on conflict (message_id, profile_id) do nothing;
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function public.clear_conversation_for_me(uuid) from public;
grant execute on function public.clear_conversation_for_me(uuid) to authenticated;

drop function if exists public.delete_conversation_for_me(uuid);
create or replace function public.delete_conversation_for_me(p_conversation_id uuid) returns boolean language plpgsql security definer set search_path = public as $$
declare affected integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.conversation_members where conversation_id = p_conversation_id and profile_id = auth.uid();
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;
revoke all on function public.delete_conversation_for_me(uuid) from public;
grant execute on function public.delete_conversation_for_me(uuid) to authenticated;

drop function if exists public.mark_conversation_for_delete(uuid);
create or replace function public.mark_conversation_for_delete(p_conversation_id uuid) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_conversation_member(p_conversation_id) then raise exception 'Conversation not found'; end if;
  insert into public.conversation_delete_marks(conversation_id, profile_id) values (p_conversation_id, auth.uid())
  on conflict (conversation_id, profile_id) do update set marked_at = now();
  return true;
end;
$$;
revoke all on function public.mark_conversation_for_delete(uuid) from public;
grant execute on function public.mark_conversation_for_delete(uuid) to authenticated;

drop function if exists public.unmark_conversation_for_delete(uuid);
create or replace function public.unmark_conversation_for_delete(p_conversation_id uuid) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.conversation_delete_marks where conversation_id = p_conversation_id and profile_id = auth.uid();
  return true;
end;
$$;
revoke all on function public.unmark_conversation_for_delete(uuid) from public;
grant execute on function public.unmark_conversation_for_delete(uuid) to authenticated;
