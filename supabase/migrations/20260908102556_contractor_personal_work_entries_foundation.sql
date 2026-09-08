create table public.contractor_work_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  item_name text not null check (char_length(btrim(item_name)) between 1 and 200),
  size text not null check (char_length(btrim(size)) between 1 and 100),
  pieces numeric(18,4) not null check (pieces > 0),
  rate_per_piece numeric(18,4) not null check (rate_per_piece >= 0),
  commission_type text null check (commission_type is null or commission_type in ('percentage','per_piece')),
  commission_value numeric(18,4) null check (commission_value is null or commission_value >= 0),
  commission_mode text null check (commission_mode is null or commission_mode in ('included','separate')),
  commission_per_piece numeric(18,4) not null default 0 check (commission_per_piece >= 0),
  actual_rate_per_piece numeric(18,4) not null check (actual_rate_per_piece >= 0),
  total numeric(24,4) not null check (total >= 0),
  special_note text null check (special_note is null or char_length(special_note) <= 2000),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index contractor_work_entries_profile_occurred_idx on public.contractor_work_entries(profile_id, occurred_at desc, id desc);
alter table public.contractor_work_entries enable row level security;
revoke all on table public.contractor_work_entries from anon, authenticated;
grant select, insert on table public.contractor_work_entries to authenticated;
create policy contractor_work_entries_select_own on public.contractor_work_entries for select to authenticated using (profile_id = (select auth.uid()));
create policy contractor_work_entries_insert_own on public.contractor_work_entries for insert to authenticated with check (profile_id = (select auth.uid()));
create or replace function public.get_contractor_work_totals(p_day_start timestamptz,p_day_end timestamptz,p_week_start timestamptz,p_week_end timestamptz,p_month_start timestamptz,p_month_end timestamptz)
returns table(daily_total numeric(24,4),weekly_total numeric(24,4),monthly_total numeric(24,4),lifetime_total numeric(24,4),commission_total numeric(24,4))
language sql security invoker stable set search_path = '' as $$
select coalesce(sum(case when e.occurred_at>=p_day_start and e.occurred_at<p_day_end then e.total else 0 end),0)::numeric(24,4),coalesce(sum(case when e.occurred_at>=p_week_start and e.occurred_at<p_week_end then e.total else 0 end),0)::numeric(24,4),coalesce(sum(case when e.occurred_at>=p_month_start and e.occurred_at<p_month_end then e.total else 0 end),0)::numeric(24,4),coalesce(sum(e.total),0)::numeric(24,4),coalesce(sum(e.pieces*e.commission_per_piece),0)::numeric(24,4) from public.contractor_work_entries e where e.profile_id=(select auth.uid());
$$;
revoke all on function public.get_contractor_work_totals(timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz) from public, anon;
grant execute on function public.get_contractor_work_totals(timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz) to authenticated;
