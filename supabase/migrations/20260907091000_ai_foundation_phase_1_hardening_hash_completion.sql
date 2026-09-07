-- Ensure the repository migration chain matches the production hardening state.
-- This is intentionally idempotent for safe migration replay.

alter table public.ai_action_claims add column if not exists arguments_hash text;
update public.ai_action_claims set arguments_hash=md5(arguments::text) where arguments_hash is null;
alter table public.ai_action_claims alter column arguments_hash set not null;
create index if not exists ai_action_claims_arguments_hash_idx on public.ai_action_claims(user_id,tool_name,arguments_hash,consumed_at,failed_at);
