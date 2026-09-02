-- Work Social B1 Authority Physical Schema
--
-- This migration establishes only the authorized B1 authority boundary.
-- It does not create Team, membership, invitation, ownership, or UI objects.

create schema if not exists private;

create table private.work_social_authority_subjects (
  id uuid primary key
    references auth.users(id)
    on delete cascade,
  created_at timestamptz not null default now()
);

create table private.work_social_authority_grants (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null
    references private.work_social_authority_subjects(id)
    on delete cascade,
  authority_key text not null
    check (authority_key = 'team_ownership_eligibility'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  issued_by_user_id uuid
    references auth.users(id)
    on delete set null,
  revoked_by_user_id uuid
    references auth.users(id)
    on delete set null
);

create index work_social_authority_grants_subject_id_idx
  on private.work_social_authority_grants(subject_id);

create unique index work_social_authority_grants_active_unique_idx
  on private.work_social_authority_grants(subject_id, authority_key)
  where revoked_at is null;

alter table private.work_social_authority_subjects enable row level security;
alter table private.work_social_authority_grants enable row level security;

-- B1 is trusted-backend authorization infrastructure, not a browser CRUD surface.
-- Keep the existing private-schema USAGE boundary intact; restrict these tables only.
revoke all privileges on table
  private.work_social_authority_subjects,
  private.work_social_authority_grants
from public, anon, authenticated;

grant usage on schema private to service_role;

grant select, insert, update, delete
on table
  private.work_social_authority_subjects,
  private.work_social_authority_grants
to service_role;
