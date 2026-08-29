-- Work Social B1: isolated Work Social-wide authority foundation.
-- This migration intentionally does NOT create Team ownership, Team membership,
-- invitations, Team roles, or any Worker/Social authorization coupling.

create schema if not exists private;

create table private.work_social_authority_subjects (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table private.work_social_authority_grants (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references private.work_social_authority_subjects(id) on delete cascade,
  authority_key text not null
    check (authority_key = 'team_ownership_eligibility'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz null,
  issued_by_user_id uuid null references auth.users(id) on delete set null,
  revoked_by_user_id uuid null references auth.users(id) on delete set null
);

create unique index work_social_authority_grants_one_active_idx
  on private.work_social_authority_grants (subject_id, authority_key)
  where revoked_at is null;

-- B1 grant lifecycle is monotonic: an active grant may be revoked once,
-- and a revoked grant can never be reactivated or otherwise rewritten.
create or replace function private.guard_work_social_authority_grant_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if old.revoked_at is not null then
    raise exception 'revoked B1 authority grants are immutable';
  end if;

  if new.id is distinct from old.id
     or new.subject_id is distinct from old.subject_id
     or new.authority_key is distinct from old.authority_key
     or new.created_at is distinct from old.created_at
     or new.issued_by_user_id is distinct from old.issued_by_user_id then
    raise exception 'B1 authority grant identity and issuance fields are immutable';
  end if;

  if new.revoked_at is null then
    if new.revoked_by_user_id is distinct from old.revoked_by_user_id then
      raise exception 'B1 revocation provenance cannot change before revocation';
    end if;
  else
    if new.revoked_at is not distinct from old.revoked_at then
      raise exception 'B1 authority grant is already revoked';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_work_social_authority_grant_lifecycle() from public, anon, authenticated;

create trigger work_social_authority_grant_lifecycle_guard
  before update on private.work_social_authority_grants
  for each row
  execute function private.guard_work_social_authority_grant_lifecycle();

alter table private.work_social_authority_subjects enable row level security;
alter table private.work_social_authority_grants enable row level security;

-- B1 authority records are not ordinary client Data API resources.
-- Do not grant anon/authenticated CRUD access. Trusted server-side provisioning
-- and database administration retain the necessary privileged access.
revoke all on table private.work_social_authority_subjects from public, anon, authenticated;
revoke all on table private.work_social_authority_grants from public, anon, authenticated;

-- There are intentionally no authenticated-client policies. Future Team RLS
-- authorization must consume B1 through a separately reviewed authorization
-- helper rather than exposing raw authority records.
