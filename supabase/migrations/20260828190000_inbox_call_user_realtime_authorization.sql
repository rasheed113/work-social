-- Authorize private per-user WebRTC signaling channels used for incoming calls.
-- Topic format: work-social-user:<profile_uuid>

create policy "users can read their private call signaling broadcasts"
on "realtime"."messages"
for select
to authenticated
using (
  extension = 'broadcast'
  and realtime.topic() like 'work-social-user:%'
  and substring(realtime.topic() from length('work-social-user:') + 1) = (select auth.uid())::text
);

create policy "users can send their private call signaling broadcasts"
on "realtime"."messages"
for insert
to authenticated
with check (
  extension = 'broadcast'
  and realtime.topic() like 'work-social-user:%'
  and substring(realtime.topic() from length('work-social-user:') + 1) = (select auth.uid())::text
);
