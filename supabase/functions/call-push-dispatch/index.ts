import { createClient } from 'npm:@supabase/supabase-js@2';
import { SignJWT, importPKCS8 } from 'npm:jose@6.1.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const firebaseServiceAccountRaw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');

if (!supabaseUrl || !serviceKey) throw new Error('Supabase server configuration is unavailable.');

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

type CallRow = {
  id: string;
  call_id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  kind: 'audio' | 'video';
  signal_type: string;
};

async function getAccessToken(account: ServiceAccount): Promise<string> {
  const privateKey = await importPKCS8(account.private_key, 'RS256');
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(account.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) throw new Error(`Google OAuth token exchange failed (${response.status}).`);
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new Error('Google OAuth response did not contain an access token.');
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!firebaseServiceAccountRaw) return json({ error: 'FCM server configuration is unavailable.' }, 503);

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized.' }, 401);
  const token = authHeader.slice('Bearer '.length);
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: 'Unauthorized.' }, 401);

  let body: { call_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  if (!body.call_id) return json({ error: 'call_id is required.' }, 400);

  const { data: offer, error: offerError } = await admin
    .from('call_signals')
    .select('id,call_id,conversation_id,sender_id,recipient_id,kind,signal_type')
    .eq('call_id', body.call_id)
    .eq('signal_type', 'offer')
    .eq('sender_id', authData.user.id)
    .maybeSingle<CallRow>();

  if (offerError) return json({ error: offerError.message }, 500);
  if (!offer) return json({ error: 'Authorized call offer was not found.' }, 404);

  const { data: membership } = await admin
    .from('conversation_members')
    .select('profile_id')
    .eq('conversation_id', offer.conversation_id)
    .eq('profile_id', authData.user.id)
    .maybeSingle();
  if (!membership) return json({ error: 'Caller is not a conversation member.' }, 403);

  const { data: tokens, error: tokenError } = await admin
    .from('device_push_tokens')
    .select('id,token')
    .eq('profile_id', offer.recipient_id)
    .eq('provider', 'fcm')
    .eq('platform', 'android')
    .is('revoked_at', null);
  if (tokenError) return json({ error: tokenError.message }, 500);
  if (!tokens?.length) return json({ ok: true, delivered: 0, reason: 'no_active_device' });

  let account: ServiceAccount;
  try {
    account = JSON.parse(firebaseServiceAccountRaw) as ServiceAccount;
  } catch {
    return json({ error: 'FCM service account configuration is invalid.' }, 503);
  }
  if (!account.project_id || !account.client_email || !account.private_key) {
    return json({ error: 'FCM service account configuration is incomplete.' }, 503);
  }

  const accessToken = await getAccessToken(account);
  let delivered = 0;
  let failed = 0;
  for (const device of tokens) {
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: device.token,
          data: {
            type: 'incoming_call',
            call_id: offer.call_id,
            conversation_id: offer.conversation_id,
            caller_id: offer.sender_id,
            kind: offer.kind,
          },
          android: { priority: 'high' },
        },
      }),
    });
    if (response.ok) delivered += 1;
    else {
      failed += 1;
      const text = await response.text();
      if (response.status === 404 || response.status === 410 || text.includes('UNREGISTERED')) {
        await admin.from('device_push_tokens').update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', device.id);
      }
    }
  }

  return json({ ok: failed === 0, delivered, failed });
});
