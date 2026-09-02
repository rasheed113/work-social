create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','tool','system')),
  content text not null,
  tool_name text,
  tool_call_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_pending_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  tool_name text not null,
  arguments jsonb not null default '{}'::jsonb,
  display_summary text not null,
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled','expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_tool_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  message_id uuid references public.ai_messages(id) on delete set null,
  tool_name text not null,
  arguments jsonb not null default '{}'::jsonb,
  result jsonb,
  status text not null check (status in ('requested','awaiting_confirmation','executed','failed','cancelled')),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  request_id text,
  created_at timestamptz not null default now()
);

create index if not exists ai_conversations_user_updated_idx on public.ai_conversations(user_id, updated_at desc);
create index if not exists ai_messages_conversation_created_idx on public.ai_messages(conversation_id, created_at);
create index if not exists ai_pending_actions_user_status_idx on public.ai_pending_actions(user_id, status, expires_at);
create index if not exists ai_tool_calls_conversation_created_idx on public.ai_tool_calls(conversation_id, created_at);
create index if not exists ai_usage_user_created_idx on public.ai_usage(user_id, created_at desc);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_pending_actions enable row level security;
alter table public.ai_tool_calls enable row level security;
alter table public.ai_usage enable row level security;

create policy ai_conversations_select_own on public.ai_conversations for select to authenticated using ((select auth.uid()) = user_id);
create policy ai_conversations_insert_own on public.ai_conversations for insert to authenticated with check ((select auth.uid()) = user_id);
create policy ai_conversations_update_own on public.ai_conversations for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy ai_conversations_delete_own on public.ai_conversations for delete to authenticated using ((select auth.uid()) = user_id);

create policy ai_messages_select_own on public.ai_messages for select to authenticated using ((select auth.uid()) = user_id);
create policy ai_messages_insert_own on public.ai_messages for insert to authenticated with check ((select auth.uid()) = user_id);

create policy ai_pending_actions_select_own on public.ai_pending_actions for select to authenticated using ((select auth.uid()) = user_id);
create policy ai_pending_actions_insert_own on public.ai_pending_actions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy ai_pending_actions_update_own on public.ai_pending_actions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy ai_tool_calls_select_own on public.ai_tool_calls for select to authenticated using ((select auth.uid()) = user_id);
create policy ai_tool_calls_insert_own on public.ai_tool_calls for insert to authenticated with check ((select auth.uid()) = user_id);
create policy ai_tool_calls_update_own on public.ai_tool_calls for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy ai_usage_select_own on public.ai_usage for select to authenticated using ((select auth.uid()) = user_id);
create policy ai_usage_insert_own on public.ai_usage for insert to authenticated with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.ai_conversations to authenticated;
grant select, insert on public.ai_messages to authenticated;
grant select, insert, update on public.ai_pending_actions to authenticated;
grant select, insert, update on public.ai_tool_calls to authenticated;
grant select, insert on public.ai_usage to authenticated;
