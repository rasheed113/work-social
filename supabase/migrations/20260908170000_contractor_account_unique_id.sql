-- Give every Contractor Account its own permanent, copyable identity ID.
-- This is a Contractor capability identifier, not a second login identity.
alter table public.contractor_accounts
  add column if not exists contractor_id uuid not null default gen_random_uuid();

create unique index if not exists contractor_accounts_contractor_id_key
  on public.contractor_accounts (contractor_id);

comment on column public.contractor_accounts.contractor_id is
  'System-generated unique Contractor Account ID; immutable and safe to display/copy.';
