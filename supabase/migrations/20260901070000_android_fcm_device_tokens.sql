create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('android')),
  provider text not null check (provider in ('fcm')),
  token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint device_push_tokens_token_unique unique (token)
);

create index if not exists device_push_tokens_profile_active_idx
  on public.device_push_tokens(profile_id, updated_at desc)
  where revoked_at is null;

alter table public.device_push_tokens enable row level security;

drop policy if exists "users can manage own push tokens" on public.device_push_tokens;
create policy "users can manage own push tokens"
on public.device_push_tokens
for all
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

revoke all on public.device_push_tokens from anon;
grant select, insert, update, delete on public.device_push_tokens to authenticated;
