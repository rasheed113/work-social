-- Private per-user WebRTC signaling channel authorization.
-- Topic format: work-social-user:<recipient_profile_uuid>

create policy "users can read their private call signaling broadcasts"
on "realtime"."messages"
for select
to authenticated
using (
  extension = 'broadcast'
  and realtime.topic() like 'work-social-user:%'
  and substring(realtime.topic() from length('work-social-user:') + 1) = (select auth.uid())::text
);

create policy "callers can send signaling to the recipient private channel"
on "realtime"."messages"
for insert
to authenticated
with check (
  extension = 'broadcast'
  and realtime.topic() like 'work-social-user:%'
  and jsonb_extract_path_text(payload, 'from') = (select auth.uid())::text
  and jsonb_extract_path_text(payload, 'to') = substring(realtime.topic() from length('work-social-user:') + 1)
);