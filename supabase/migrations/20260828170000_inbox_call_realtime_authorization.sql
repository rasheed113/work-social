-- Secure WebRTC signaling topics so only conversation members can publish/read call signals.
-- Topic format: work-social-call:<conversation_uuid>

create policy "conversation members can read call broadcasts"
on "realtime"."messages"
for select
to authenticated
using (
  extension = 'broadcast'
  and realtime.topic() like 'work-social-call:%'
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id::text = substring(realtime.topic() from length('work-social-call:') + 1)
      and cm.profile_id = (select auth.uid())
  )
);

create policy "conversation members can send call broadcasts"
on "realtime"."messages"
for insert
to authenticated
with check (
  extension = 'broadcast'
  and realtime.topic() like 'work-social-call:%'
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id::text = substring(realtime.topic() from length('work-social-call:') + 1)
      and cm.profile_id = (select auth.uid())
  )
);
