create or replace function public.enforce_work_social_ai_rate_limit()
returns trigger
language plpgsql
as $$
declare
  recent_count integer;
  daily_count integer;
begin
  if new.role <> 'user' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  select count(*) into recent_count
  from public.ai_messages
  where user_id = new.user_id
    and role = 'user'
    and created_at >= now() - interval '1 hour';

  if recent_count >= 20 then
    raise exception using errcode = 'P0001', message = 'AI rate limit reached. Please try again later.';
  end if;

  select count(*) into daily_count
  from public.ai_messages
  where user_id = new.user_id
    and role = 'user'
    and created_at >= date_trunc('day', now());

  if daily_count >= 100 then
    raise exception using errcode = 'P0001', message = 'Daily AI limit reached. Please try again tomorrow.';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_work_social_ai_rate_limit() from public, anon, authenticated;

drop trigger if exists ai_messages_rate_limit on public.ai_messages;
create trigger ai_messages_rate_limit
before insert on public.ai_messages
for each row
execute function public.enforce_work_social_ai_rate_limit();
