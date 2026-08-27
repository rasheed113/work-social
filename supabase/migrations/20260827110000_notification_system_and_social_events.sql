-- Notification foundation: durable event records, follow relationships, comment replies and server-side event generation.
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists follows_following_idx on public.follows(following_id);

alter table public.notifications
  add column if not exists comment_id uuid references public.post_comments(id) on delete cascade,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.post_comments
  add column if not exists parent_comment_id uuid references public.post_comments(id) on delete cascade;

create index if not exists post_comments_parent_idx on public.post_comments(parent_comment_id);
create index if not exists notifications_receiver_created_idx on public.notifications(receiver_id, created_at desc);
create index if not exists notifications_receiver_unread_idx on public.notifications(receiver_id) where is_read = false;

alter table public.follows enable row level security;

drop policy if exists follows_select_involved on public.follows;
drop policy if exists follows_insert_own on public.follows;
drop policy if exists follows_delete_own on public.follows;
create policy follows_select_involved on public.follows for select to authenticated
  using (follower_id = auth.uid() or following_id = auth.uid());
create policy follows_insert_own on public.follows for insert to authenticated
  with check (follower_id = auth.uid() and follower_id <> following_id);
create policy follows_delete_own on public.follows for delete to authenticated
  using (follower_id = auth.uid());

create or replace function public.create_notification(
  p_receiver uuid,
  p_sender uuid,
  p_type text,
  p_post uuid default null,
  p_comment uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_receiver is null or p_sender is null or p_receiver = p_sender then return; end if;
  insert into public.notifications(receiver_id, sender_id, type, post_id, comment_id, metadata, is_read)
  values (p_receiver, p_sender, p_type, p_post, p_comment, coalesce(p_metadata, '{}'::jsonb), false);
end;
$$;

create or replace function public.notify_friend_request() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'pending' then
    perform public.create_notification(new.receiver_id, new.sender_id, 'friend_request', null, null, jsonb_build_object('request_id', new.id));
  elsif new.status = 'accepted' and old.status is distinct from 'accepted' then
    perform public.create_notification(new.sender_id, new.receiver_id, 'friend_request_accepted', null, null, jsonb_build_object('request_id', new.id));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_friend_request on public.friend_requests;
create trigger trg_notify_friend_request after insert or update of status on public.friend_requests
for each row execute function public.notify_friend_request();

create or replace function public.notify_post_like() returns trigger
language plpgsql security definer set search_path = public
as $$
declare owner_id uuid;
begin
  select profile_id into owner_id from public.posts where id = new.post_id;
  perform public.create_notification(owner_id, new.profile_id, 'like', new.post_id, null, '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists trg_notify_post_like on public.post_reactions;
create trigger trg_notify_post_like after insert on public.post_reactions
for each row execute function public.notify_post_like();

create or replace function public.notify_post_comment() returns trigger
language plpgsql security definer set search_path = public
as $$
declare owner_id uuid;
parent_author uuid;
mentioned record;
begin
  select profile_id into owner_id from public.posts where id = new.post_id;
  if new.parent_comment_id is not null then
    select profile_id into parent_author from public.post_comments where id = new.parent_comment_id;
    perform public.create_notification(parent_author, new.profile_id, 'comment_reply', new.post_id, new.id, jsonb_build_object('parent_comment_id', new.parent_comment_id));
  elsif owner_id is not null then
    perform public.create_notification(owner_id, new.profile_id, 'comment', new.post_id, new.id, '{}'::jsonb);
  end if;
  for mentioned in
    select distinct p.id from regexp_matches(coalesce(new.content, ''), '@([A-Za-z0-9_]+)', 'g') as m
    join public.profiles p on lower(p.username) = lower(m[1])
  loop
    perform public.create_notification(mentioned.id, new.profile_id, 'mention_comment', new.post_id, new.id, jsonb_build_object('username', (select username from public.profiles where id = mentioned.id)));
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_post_comment on public.post_comments;
create trigger trg_notify_post_comment after insert on public.post_comments
for each row execute function public.notify_post_comment();

create or replace function public.notify_post_mention() returns trigger
language plpgsql security definer set search_path = public
as $$
declare mentioned record;
begin
  for mentioned in
    select distinct p.id from regexp_matches(coalesce(new.content, ''), '@([A-Za-z0-9_]+)', 'g') as m
    join public.profiles p on lower(p.username) = lower(m[1])
  loop
    perform public.create_notification(mentioned.id, new.profile_id, 'mention_post', new.id, null, jsonb_build_object('username', (select username from public.profiles where id = mentioned.id)));
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_post_mention on public.posts;
create trigger trg_notify_post_mention after insert on public.posts
for each row execute function public.notify_post_mention();

create or replace function public.notify_follow() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.create_notification(new.following_id, new.follower_id, 'follow', null, null, '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists trg_notify_follow on public.follows;
create trigger trg_notify_follow after insert on public.follows
for each row execute function public.notify_follow();

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
