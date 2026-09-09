create or replace function public.search_workers_for_contractor(p_query text)
returns table (
  profile_id uuid,
  work_id uuid,
  display_name text,
  username text,
  avatar_url text,
  worker_type text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    wp.profile_id,
    wp.work_id,
    p.display_name,
    p.username,
    p.avatar_url,
    wp.worker_type
  from public.worker_profiles wp
  join public.profiles p on p.id = wp.profile_id
  where exists (
    select 1
    from public.contractor_accounts ca
    where ca.profile_id = (select auth.uid())
  )
    and char_length(btrim(coalesce(p_query, ''))) >= 2
    and (
      p.display_name ilike '%' || btrim(p_query) || '%'
      or p.username ilike '%' || btrim(p_query) || '%'
      or wp.work_id::text ilike '%' || btrim(p_query) || '%'
    )
  order by
    case when lower(p.display_name) = lower(btrim(p_query)) then 0 else 1 end,
    p.display_name nulls last,
    wp.work_id
  limit 20;
$$;

revoke all on function public.search_workers_for_contractor(text) from public;
grant execute on function public.search_workers_for_contractor(text) to authenticated;

comment on function public.search_workers_for_contractor(text) is
  'Contractor-only worker directory lookup for Team Members search. Searches worker name, username, or public Worker ID and returns only safe identity fields.';
