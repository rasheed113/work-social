-- Phase 3 Hands 2.0: durable verified mutation history and rollback metadata.
-- Additive only. Existing Phase 1/2 AI persistence remains intact.

alter table public.ai_pending_actions
  drop constraint if exists ai_pending_actions_status_check;

alter table public.ai_pending_actions
  add constraint ai_pending_actions_status_check
  check (status in ('pending','confirmed','succeeded','cancelled','expired','failed'));

alter table public.ai_tool_calls
  add column if not exists pending_action_id uuid references public.ai_pending_actions(id) on delete set null,
  add column if not exists execution_state text,
  add column if not exists verification_state text,
  add column if not exists record_ids jsonb not null default '[]'::jsonb,
  add column if not exists verification_result jsonb,
  add column if not exists rollback_available boolean not null default false,
  add column if not exists rollback_metadata jsonb;

create index if not exists ai_tool_calls_pending_action_idx
  on public.ai_tool_calls(pending_action_id, created_at desc);

create table if not exists public.ai_action_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  pending_action_id uuid references public.ai_pending_actions(id) on delete set null,
  action_kind text not null check (action_kind in ('create','edit','delete','multi_step','undo')),
  module text not null,
  operation text not null,
  record_ids jsonb not null default '[]'::jsonb,
  previous_state jsonb,
  new_state jsonb,
  verification_state text not null check (verification_state in ('verified','failed')),
  rollback_available boolean not null default false,
  rollback_metadata jsonb,
  reverted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ai_action_history_user_created_idx
  on public.ai_action_history(user_id, created_at desc);

create index if not exists ai_action_history_pending_idx
  on public.ai_action_history(pending_action_id);

alter table public.ai_action_history enable row level security;

create policy ai_action_history_select_own
  on public.ai_action_history for select to authenticated
  using ((select auth.uid()) = user_id);

create policy ai_action_history_insert_own
  on public.ai_action_history for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy ai_action_history_update_own
  on public.ai_action_history for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.ai_action_history to authenticated;

-- The Phase 3 executor records server verification explicitly. These columns are
-- intentionally nullable on legacy rows so Phase 1/2 history remains readable.
