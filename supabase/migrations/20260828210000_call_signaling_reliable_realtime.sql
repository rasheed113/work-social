create table if not exists public.call_signals (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('audio','video')),
  signal_type text not null check (signal_type in ('offer','answer','ice','hangup','reject')),
  sdp jsonb,
  candidate jsonb,
  created_at timestamptz not null default now(),
  constraint call_signals_distinct_users check (sender_id <> recipient_id)
);

create index if not exists call_signals_recipient_created_idx on public.call_signals(recipient_id, created_at desc);
create index if not exists call_signals_call_created_idx on public.call_signals(call_id, created_at asc);

alter table public.call_signals enable row level security;

create policy "call participants can read call signals"
on public.call_signals
for select
to authenticated
using (
  (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()))
  and exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = call_signals.conversation_id
      and cm.profile_id = (select auth.uid())
  )
);

create policy "conversation members can create their own call signals"
on public.call_signals
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and sender_id <> recipient_id
  and exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = call_signals.conversation_id
      and cm.profile_id = (select auth.uid())
  )
  and exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = call_signals.conversation_id
      and cm.profile_id = call_signals.recipient_id
  )
);

create policy "call participants can delete call signals"
on public.call_signals
for delete
to authenticated
using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

alter publication supabase_realtime add table public.call_signals;
