alter table public.worker_diary_entries
  add column if not exists event_start_at timestamptz null,
  add column if not exists event_end_at timestamptz null,
  add column if not exists event_timezone text null;

alter table public.worker_diary_entries
  drop constraint if exists worker_diary_entry_type_shape;

alter table public.worker_diary_entries
  add constraint worker_diary_entry_type_shape check (
    (entry_type = 'event' and event_start_at is not null and event_timezone is not null and completed is null and title is not null)
    or (entry_type <> 'event' and event_start_at is null and event_end_at is null and event_timezone is null)
  );

alter table public.worker_diary_entries
  drop constraint if exists worker_diary_event_end_shape;

alter table public.worker_diary_entries
  add constraint worker_diary_event_end_shape check (
    event_end_at is null or (event_start_at is not null and event_end_at >= event_start_at)
  );

create index if not exists worker_diary_entries_event_start_idx
  on public.worker_diary_entries (worker_profile_id, event_start_at)
  where entry_type = 'event';

create table public.worker_diary_preferences (
  worker_profile_id uuid primary key references public.worker_profiles(id) on delete cascade,
  calendar_system text not null default 'gregory' check (calendar_system in (
    'gregory', 'islamic', 'islamic-umalqura', 'islamic-civil', 'islamic-tbla',
    'persian', 'hebrew', 'buddhist', 'indian', 'japanese', 'chinese', 'coptic',
    'ethiopic', 'ethiopic-amete-alem', 'roc', 'dangi'
  )),
  timezone text not null default 'UTC',
  notifications_enabled boolean not null default true,
  todo_reminders_enabled boolean not null default true,
  event_reminders_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.worker_diary_preferences enable row level security;
revoke all on table public.worker_diary_preferences from anon, authenticated;
grant select, insert, update, delete on table public.worker_diary_preferences to authenticated;

create policy "Workers can view own diary preferences"
  on public.worker_diary_preferences for select to authenticated
  using (worker_profile_id in (
    select wp.id from public.worker_profiles wp where wp.profile_id = (select auth.uid())
  ));

create policy "Workers can create own diary preferences"
  on public.worker_diary_preferences for insert to authenticated
  with check (worker_profile_id in (
    select wp.id from public.worker_profiles wp where wp.profile_id = (select auth.uid())
  ));

create policy "Workers can update own diary preferences"
  on public.worker_diary_preferences for update to authenticated
  using (worker_profile_id in (
    select wp.id from public.worker_profiles wp where wp.profile_id = (select auth.uid())
  ))
  with check (worker_profile_id in (
    select wp.id from public.worker_profiles wp where wp.profile_id = (select auth.uid())
  ));

create policy "Workers can delete own diary preferences"
  on public.worker_diary_preferences for delete to authenticated
  using (worker_profile_id in (
    select wp.id from public.worker_profiles wp where wp.profile_id = (select auth.uid())
  ));

create or replace function private.guard_worker_diary_preferences_update()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.worker_profile_id is distinct from old.worker_profile_id or new.created_at is distinct from old.created_at then
    raise exception 'immutable diary preference ownership fields cannot be changed';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.guard_worker_diary_preferences_update() from public;
grant usage on schema private to authenticated;
grant execute on function private.guard_worker_diary_preferences_update() to authenticated;
drop trigger if exists worker_diary_preferences_guard_update on public.worker_diary_preferences;
create trigger worker_diary_preferences_guard_update
  before update on public.worker_diary_preferences
  for each row execute function private.guard_worker_diary_preferences_update();

create table public.worker_diary_reminders (
  id uuid primary key default gen_random_uuid(),
  diary_entry_id uuid not null unique references public.worker_diary_entries(id) on delete cascade,
  worker_profile_id uuid not null references public.worker_profiles(id) on delete restrict,
  reminder_kind text not null check (reminder_kind in ('todo', 'event')),
  enabled boolean not null default true,
  scheduled_at timestamptz not null,
  timezone text not null,
  reminder_mode text not null check (reminder_mode in ('at_time', 'before_event', 'custom')),
  offset_minutes integer null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'cancelled', 'failed')),
  claimed_at timestamptz null,
  sent_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint worker_diary_reminder_offset_shape check (
    (reminder_mode = 'before_event' and offset_minutes is not null and offset_minutes > 0)
    or (reminder_mode <> 'before_event' and offset_minutes is null)
  )
);

create index worker_diary_reminders_due_idx
  on public.worker_diary_reminders (scheduled_at, status, enabled);
create index worker_diary_reminders_worker_idx
  on public.worker_diary_reminders (worker_profile_id, scheduled_at desc);

alter table public.worker_diary_reminders enable row level security;
revoke all on table public.worker_diary_reminders from anon, authenticated;
grant select, insert, update, delete on table public.worker_diary_reminders to authenticated;

create policy "Workers can view own diary reminders"
  on public.worker_diary_reminders for select to authenticated
  using (worker_profile_id in (
    select wp.id from public.worker_profiles wp where wp.profile_id = (select auth.uid())
  ));

create policy "Workers can create own diary reminders"
  on public.worker_diary_reminders for insert to authenticated
  with check (
    worker_profile_id in (select wp.id from public.worker_profiles wp where wp.profile_id = (select auth.uid()))
    and worker_profile_id = (select e.worker_profile_id from public.worker_diary_entries e where e.id = diary_entry_id)
  );

create policy "Workers can update own diary reminders"
  on public.worker_diary_reminders for update to authenticated
  using (worker_profile_id in (
    select wp.id from public.worker_profiles wp where wp.profile_id = (select auth.uid())
  ))
  with check (
    worker_profile_id in (select wp.id from public.worker_profiles wp where wp.profile_id = (select auth.uid()))
    and worker_profile_id = (select e.worker_profile_id from public.worker_diary_entries e where e.id = diary_entry_id)
  );

create policy "Workers can delete own diary reminders"
  on public.worker_diary_reminders for delete to authenticated
  using (worker_profile_id in (
    select wp.id from public.worker_profiles wp where wp.profile_id = (select auth.uid())
  ));

create or replace function private.guard_worker_diary_reminder_ownership()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare entry_owner uuid; entry_type text; begin
  select worker_profile_id, entry_type into entry_owner, entry_type
  from public.worker_diary_entries where id = new.diary_entry_id;
  if entry_owner is null or new.worker_profile_id is distinct from entry_owner then
    raise exception 'reminder ownership does not match diary entry owner';
  end if;
  if (new.reminder_kind = 'event' and entry_type <> 'event') or (new.reminder_kind = 'todo' and entry_type <> 'todo') then
    raise exception 'reminder kind does not match diary entry type';
  end if;
  if new.id is distinct from old.id or new.diary_entry_id is distinct from old.diary_entry_id or new.worker_profile_id is distinct from old.worker_profile_id or new.created_at is distinct from old.created_at then
    raise exception 'immutable reminder ownership fields cannot be changed';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.guard_worker_diary_reminder_ownership() from public;
grant usage on schema private to authenticated;
grant execute on function private.guard_worker_diary_reminder_ownership() to authenticated;
drop trigger if exists worker_diary_reminders_guard_update on public.worker_diary_reminders;
create trigger worker_diary_reminders_guard_update
  before update on public.worker_diary_reminders
  for each row execute function private.guard_worker_diary_reminder_ownership();

create or replace function private.guard_worker_diary_reminder_insert()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare entry_owner uuid; entry_type text; begin
  select worker_profile_id, entry_type into entry_owner, entry_type
  from public.worker_diary_entries where id = new.diary_entry_id;
  if entry_owner is null or new.worker_profile_id is distinct from entry_owner then
    raise exception 'reminder ownership does not match diary entry owner';
  end if;
  if (new.reminder_kind = 'event' and entry_type <> 'event') or (new.reminder_kind = 'todo' and entry_type <> 'todo') then
    raise exception 'reminder kind does not match diary entry type';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_worker_diary_reminder_insert() from public;
grant execute on function private.guard_worker_diary_reminder_insert() to authenticated;
drop trigger if exists worker_diary_reminders_guard_insert on public.worker_diary_reminders;
create trigger worker_diary_reminders_guard_insert
  before insert on public.worker_diary_reminders
  for each row execute function private.guard_worker_diary_reminder_insert();

create table public.worker_diary_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  worker_profile_id uuid not null references public.worker_profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index worker_diary_push_subscriptions_worker_idx
  on public.worker_diary_push_subscriptions (worker_profile_id, updated_at desc);

alter table public.worker_diary_push_subscriptions enable row level security;
revoke all on table public.worker_diary_push_subscriptions from anon, authenticated;
grant select, insert, update, delete on table public.worker_diary_push_subscriptions to authenticated;

create policy "Workers can view own diary push subscriptions"
  on public.worker_diary_push_subscriptions for select to authenticated
  using (worker_profile_id in (
    select wp.id from public.worker_profiles wp where wp.profile_id = (select auth.uid())
  ));

create policy "Workers can create own diary push subscriptions"
  on public.worker_diary_push_subscriptions for insert to authenticated
  with check (worker_profile_id in (
    select wp.id from public.worker_profiles wp where wp.profile_id = (select auth.uid())
  ));

create policy "Workers can update own diary push subscriptions"
  on public.worker_diary_push_subscriptions for update to authenticated
  using (worker_profile_id in (
    select wp.id from public.worker_profiles wp where wp.profile_id = (select auth.uid())
  ))
  with check (worker_profile_id in (
    select wp.id from public.worker_profiles wp where wp.profile_id = (select auth.uid())
  ));

create policy "Workers can delete own diary push subscriptions"
  on public.worker_diary_push_subscriptions for delete to authenticated
  using (worker_profile_id in (
    select wp.id from public.worker_profiles wp where wp.profile_id = (select auth.uid())
  ));

create or replace function private.guard_worker_diary_push_subscription_update()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.worker_profile_id is distinct from old.worker_profile_id or new.created_at is distinct from old.created_at then
    raise exception 'immutable push subscription ownership fields cannot be changed';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.guard_worker_diary_push_subscription_update() from public;
grant execute on function private.guard_worker_diary_push_subscription_update() to authenticated;
drop trigger if exists worker_diary_push_subscriptions_guard_update on public.worker_diary_push_subscriptions;
create trigger worker_diary_push_subscriptions_guard_update
  before update on public.worker_diary_push_subscriptions
  for each row execute function private.guard_worker_diary_push_subscription_update();

create or replace function private.cancel_diary_reminder_on_todo_completion()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.entry_type = 'todo' and new.completed is true and old.completed is distinct from true then
    update public.worker_diary_reminders
      set enabled = false, status = 'cancelled', updated_at = now()
      where diary_entry_id = new.id and reminder_kind = 'todo' and status in ('pending','processing');
  elsif new.entry_type = 'todo' and new.completed is false and old.completed is true then
    update public.worker_diary_reminders
      set enabled = true, status = case when scheduled_at > now() then 'pending' else status end, updated_at = now()
      where diary_entry_id = new.id and reminder_kind = 'todo' and scheduled_at > now() and status = 'cancelled';
  end if;
  return new;
end;
$$;
revoke all on function private.cancel_diary_reminder_on_todo_completion() from public;
grant execute on function private.cancel_diary_reminder_on_todo_completion() to authenticated;
drop trigger if exists worker_diary_entries_todo_reminder_lifecycle on public.worker_diary_entries;
create trigger worker_diary_entries_todo_reminder_lifecycle
  after update of completed on public.worker_diary_entries
  for each row execute function private.cancel_diary_reminder_on_todo_completion();
