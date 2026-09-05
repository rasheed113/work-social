import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
const serviceKey = secretKeys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!serviceKey) throw new Error('Supabase server secret is unavailable.');

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const TIME_ZONE = 'Asia/Karachi';

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const { data: secrets, error: secretError } = await admin.rpc('get_worker_diary_runtime_secrets');
  if (secretError || !secrets) return json({ error: 'Attendance notification runtime configuration is unavailable.' }, 503);
  const runtime = secrets as Record<string, string>;
  if (req.headers.get('x-worker-diary-cron-secret') !== runtime.worker_diary_cron_secret) return json({ error: 'Unauthorized.' }, 401);
  if (!runtime.worker_diary_vapid_private_key || !runtime.worker_diary_vapid_subject) return json({ error: 'Web Push configuration is unavailable.' }, 503);

  webpush.setVapidDetails(runtime.worker_diary_vapid_subject, 'BOQVmOlZERK3UNbyn11QFWnA0LW3pVbBe9I45iKAp9WqBsCBCsHsDd3oThVhj9D_9blgjsNGmccx3KNeQRqSqPQ', runtime.worker_diary_vapid_private_key);

  const now = new Date();
  const localTime = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const attendanceDate = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

  const { data: policies, error: policyError } = await admin
    .from('salary_policies')
    .select('id,worker_profile_id,attendance_notification_time,salary_start_date,worker_profiles!inner(profile_id,worker_type)')
    .eq('worker_profiles.worker_type', 'salary_person')
    .eq('attendance_notification_time', `${localTime}:00`)
    .lte('salary_start_date', attendanceDate);
  if (policyError) return json({ error: policyError.message }, 500);

  let created = 0, pushed = 0, skipped = 0, failed = 0;
  const results: Array<{ worker_profile_id: string; status: string; notification_id?: string }> = [];

  for (const policy of policies ?? []) {
    const profileId = (policy.worker_profiles as { profile_id?: string }).profile_id;
    if (!profileId) { failed++; continue; }

    const { data: attendance, error: attendanceError } = await admin
      .from('salary_attendance_records')
      .select('id,status')
      .eq('worker_profile_id', policy.worker_profile_id)
      .eq('attendance_date', attendanceDate)
      .maybeSingle();
    if (attendanceError) { failed++; results.push({ worker_profile_id: policy.worker_profile_id, status: 'attendance_lookup_failed' }); continue; }
    if (attendance) { skipped++; results.push({ worker_profile_id: policy.worker_profile_id, status: 'already_marked' }); continue; }

    const metadata = { attendance_date: attendanceDate, worker_profile_id: policy.worker_profile_id, source: 'attendance_notification_time' };
    const { data: notification, error: insertError } = await admin
      .from('notifications')
      .insert({ receiver_id: profileId, sender_id: profileId, type: 'attendance_reminder', metadata, is_read: false })
      .select('id')
      .maybeSingle();

    if (insertError) {
      if (insertError.code === '23505') { skipped++; results.push({ worker_profile_id: policy.worker_profile_id, status: 'already_notified' }); continue; }
      failed++; results.push({ worker_profile_id: policy.worker_profile_id, status: 'notification_insert_failed' }); continue;
    }
    if (!notification?.id) { skipped++; results.push({ worker_profile_id: policy.worker_profile_id, status: 'already_notified' }); continue; }
    created++;

    const { data: subscriptions, error: subscriptionError } = await admin
      .from('worker_diary_push_subscriptions')
      .select('id,endpoint,p256dh,auth')
      .eq('worker_profile_id', policy.worker_profile_id);
    if (subscriptionError || !subscriptions?.length) { results.push({ worker_profile_id: policy.worker_profile_id, status: 'created_no_push_subscription', notification_id: notification.id }); continue; }

    let delivered = false;
    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          JSON.stringify({
            title: 'Attendance Reminder',
            body: "Today's attendance is not marked yet. Tap to mark attendance.",
            tag: `attendance-${profileId}-${attendanceDate}`,
            url: '/work/finance',
            notificationId: notification.id,
            notificationType: 'attendance_reminder'
          }),
          { TTL: 300, urgency: 'high', topic: `attendance-${profileId}-${attendanceDate}`.replace(/-/g, '').slice(0, 32) }
        );
        delivered = true;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) await admin.from('worker_diary_push_subscriptions').delete().eq('id', subscription.id);
      }
    }
    if (delivered) pushed++;
    results.push({ worker_profile_id: policy.worker_profile_id, status: delivered ? 'created_and_pushed' : 'created_push_failed', notification_id: notification.id });
  }

  return json({ ok: true, timezone: TIME_ZONE, localTime, attendanceDate, matchedPolicies: policies?.length ?? 0, created, pushed, skipped, failed, results });
});
