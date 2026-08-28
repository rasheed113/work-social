-- Keep the client message contract safe while allowing omitted sender_id to be
-- filled from the authenticated session. RLS still enforces sender_id = auth.uid().
alter table public.messages
  alter column sender_id set default auth.uid();

-- chat-media is private and is served through signed URLs. Keep the existing
-- 25 MiB bucket limit and allow the audio formats produced by MediaRecorder.
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg','image/png','image/webp','image/gif',
  'video/mp4','video/webm','video/quicktime',
  'audio/webm','audio/mp4','audio/ogg'
]::text[]
where id = 'chat-media';
