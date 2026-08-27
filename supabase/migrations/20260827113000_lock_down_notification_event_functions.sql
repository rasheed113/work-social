revoke execute on function public.create_notification(uuid, uuid, text, uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.notify_friend_request() from public, anon, authenticated;
revoke execute on function public.notify_post_like() from public, anon, authenticated;
revoke execute on function public.notify_post_comment() from public, anon, authenticated;
revoke execute on function public.notify_post_mention() from public, anon, authenticated;
revoke execute on function public.notify_follow() from public, anon, authenticated;
revoke execute on function public.notify_message() from public, anon, authenticated;

alter function public.create_notification(uuid, uuid, text, uuid, uuid, jsonb) set search_path = pg_catalog, public;
alter function public.notify_friend_request() set search_path = pg_catalog, public;
alter function public.notify_post_like() set search_path = pg_catalog, public;
alter function public.notify_post_comment() set search_path = pg_catalog, public;
alter function public.notify_post_mention() set search_path = pg_catalog, public;
alter function public.notify_follow() set search_path = pg_catalog, public;
alter function public.notify_message() set search_path = pg_catalog, public;
