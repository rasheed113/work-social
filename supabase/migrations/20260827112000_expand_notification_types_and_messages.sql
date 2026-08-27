alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'like','comment','comment_reply','mention_post','mention_comment','follow','message','friend_request','friend_accept'
]));

create or replace function public.notify_friend_request() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'pending' then
    perform public.create_notification(new.receiver_id, new.sender_id, 'friend_request', null, null, jsonb_build_object('request_id', new.id));
  elsif new.status = 'accepted' and old.status is distinct from 'accepted' then
    perform public.create_notification(new.sender_id, new.receiver_id, 'friend_accept', null, null, jsonb_build_object('request_id', new.id));
  end if;
  return new;
end;
$$;

create or replace function public.notify_message() returns trigger
language plpgsql security definer set search_path = public
as $$
declare recipient uuid;
begin
  for recipient in
    select cm.profile_id from public.conversation_members cm
    where cm.conversation_id = new.conversation_id and cm.profile_id <> new.sender_id
  loop
    perform public.create_notification(recipient, new.sender_id, 'message', null, null, jsonb_build_object('conversation_id', new.conversation_id, 'message_id', new.id));
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_message on public.messages;
create trigger trg_notify_message after insert on public.messages
for each row execute function public.notify_message();
