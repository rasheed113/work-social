import { createClient, type Session } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ejpcgcaoqyqjionvtsdi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_C0Bp6jRBkpzRtnqBLcUfOA_NHZrCmam';
const STORAGE_KEY = 'work-social:account-session-registry:v1';

export type RegisteredAccount = { id: string; email: string; displayName: string; avatarUrl: string | null; session: Session };

function normalizeSession(item: any): Session | null {
  const raw = item?.session ?? item;
  const accessToken = raw?.access_token ?? raw?.accessToken;
  const refreshToken = raw?.refresh_token ?? raw?.refreshToken;
  if (!accessToken || !refreshToken) return null;
  return {
    ...raw,
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: raw?.token_type ?? 'bearer',
    expires_in: Number(raw?.expires_in ?? 3600),
    expires_at: raw?.expires_at ?? undefined,
    user: raw?.user ?? item?.user,
  } as Session;
}

function read(): RegisteredAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(value)) return [];
    const normalized = value.flatMap((item) => {
      const session = normalizeSession(item);
      const id = item?.id ?? item?.user?.id ?? session?.user?.id;
      const email = item?.email ?? item?.user?.email ?? session?.user?.email;
      if (!id || !email || !session?.access_token || !session?.refresh_token) return [];
      return [{
        id,
        email,
        displayName: String(item?.displayName ?? item?.display_name ?? session.user?.user_metadata?.display_name ?? email.split('@')[0] ?? 'Work Social account'),
        avatarUrl: item?.avatarUrl ?? item?.avatar_url ?? null,
        session,
      } satisfies RegisteredAccount];
    });
    return normalized;
  } catch {
    return [];
  }
}

function write(accounts: RegisteredAccount[]) { if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts)); }
export function getRegisteredAccounts() { return read(); }
export function registerAccount(account: RegisteredAccount) { write([account, ...read().filter((item) => item.id !== account.id)]); }

function inspectionClient(accountId: string) {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `work-social:inspect:${accountId}` } });
}

/** Refresh a registered account in an isolated Supabase client before replacing the active session. */
export async function refreshRegisteredAccount(account: RegisteredAccount): Promise<Session | null> {
  const client = inspectionClient(account.id);
  const { data, error } = await client.auth.setSession({ access_token: account.session.access_token, refresh_token: account.session.refresh_token });
  if (error || !data.session) return null;
  return data.session;
}

export type AccountRole = 'contract' | 'salary_person' | 'contractor';
export async function getAccountRoles(account: RegisteredAccount): Promise<AccountRole[]> {
  const client = inspectionClient(account.id);
  const { error } = await client.auth.setSession({ access_token: account.session.access_token, refresh_token: account.session.refresh_token });
  if (error) return [];
  const [worker, contractor] = await Promise.all([
    client.from('worker_profiles').select('worker_type').eq('profile_id', account.id).maybeSingle<{ worker_type: 'salary_person' | 'contract' }>(),
    client.from('contractor_accounts').select('profile_id').eq('profile_id', account.id).maybeSingle<{ profile_id: string }>(),
  ]);
  const roles: AccountRole[] = [];
  if (worker.data?.worker_type === 'contract') roles.push('contract');
  if (worker.data?.worker_type === 'salary_person') roles.push('salary_person');
  if (contractor.data) roles.push('contractor');
  return roles;
}
