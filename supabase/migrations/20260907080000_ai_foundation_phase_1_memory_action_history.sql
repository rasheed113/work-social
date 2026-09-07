create table if not exists public.ai_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_key text not null check (char_length(btrim(memory_key)) between 1 and 200),
  memory_value text not null check (char_length(btrim(memory_value)) between 1 and 1000),
  memory_type text not null default 'preference' check (memory_type in ('preference','alias','workflow','instruction')),
  source text not null default 'explicit' check (source in ('explicit','stable_preference')),
  confidence numeric not null default 1 check (confidence >= 0 and confidence <= 1),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, memory_key),
  constraint ai_memories_no_secrets check (
    lower(memory_value) !~ '(password|passwd|passcode|secret|api[ _-]?key|access[ _-]?token|refresh[ _-]?token|bearer[ _-]?token|private[ _-]?key|cvv|cvc|pin[ _-]?code)'
  )
);

alter table public.ai_pending_actions drop constraint if exists ai_pending_actions_status_check;
alter table public.ai_pending_actions add constraint ai_pending_actions_status_check check (status in ('pending','confirmed','executing','succeeded','failed','cancelled','expired'));

alter table public.ai_tool_calls drop constraint if exists ai_tool_calls_status_check;
alter table public.ai_tool_calls add constraint ai_tool_calls_status_check check (status in ('requested','prepared','awaiting_confirmation','confirmed','executing','succeeded','failed','cancelled','verified','executed'));
alter table public.ai_tool_calls add column if not exists pending_action_id uuid references public.ai_pending_actions(id) on delete set null;
alter table public.ai_tool_calls add column if not exists confirmation_state text check (confirmation_state in ('not_required','awaiting_confirmation','confirmed','cancelled'));
alter table public.ai_tool_calls add column if not exists execution_state text check (execution_state in ('not_started','executing','succeeded','failed'));
alter table public.ai_tool_calls add column if not exists verification_state text check (verification_state in ('not_checked','verified','failed'));
alter table public.ai_tool_calls add column if not exists record_ids jsonb not null default '[]'::jsonb;
alter table public.ai_tool_calls add column if not exists verification_result jsonb;
alter table public.ai_tool_calls add column if not exists confirmed_at timestamptz;
alter table public.ai_tool_calls add column if not exists executing_at timestamptz;
alter table public.ai_tool_calls add column if not exists verified_at timestamptz;

create index if not exists ai_memories_user_updated_idx on public.ai_memories(user_id, updated_at desc);
create index if not exists ai_tool_calls_user_created_idx on public.ai_tool_calls(user_id, created_at desc);
create index if not exists ai_tool_calls_pending_action_idx on public.ai_tool_calls(pending_action_id);

alter table public.ai_memories enable row level security;
create policy ai_memories_select_own on public.ai_memories for select to authenticated using ((select auth.uid()) = user_id);
create policy ai_memories_insert_own on public.ai_memories for insert to authenticated with check ((select auth.uid()) = user_id);
create policy ai_memories_update_own on public.ai_memories for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy ai_memories_delete_own on public.ai_memories for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.ai_memories to authenticated;

drop policy if exists ai_tool_calls_delete_own on public.ai_tool_calls;
create policy ai_tool_calls_delete_own on public.ai_tool_calls for delete to authenticated using ((select auth.uid()) = user_id);
grant delete on public.ai_tool_calls to authenticated;

create or replace function public.ai_memories_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists ai_memories_updated_at on public.ai_memories;
create trigger ai_memories_updated_at before update on public.ai_memories for each row execute function public.ai_memories_set_updated_at();
