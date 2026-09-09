import { createClient, type Session } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ejpcgcaoqyqjionvtsdi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_C0Bp6jRBkpzRtnBqL6UfOA_NHZrCmam';
const STORAGE_KEY = 'work-social:account-session-registry:v1';

export type RegisteredAccount = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  session: Session;
};

function read(): RegisteredAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is RegisteredAccount => Boolean(item?.id && item?.email && item?.session?.access_token && item?.session?.refresh_token));
  } catch {
    return [];
  }
}

function write(accounts: RegisteredAccount[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

export function getRegisteredAccounts(): RegisteredAccount[] {
  return read();
}

export function registerAccount(account: RegisteredAccount) {
  const accounts = read().filter((item) => item.id !== account.id);
  write([account, ...accounts]);
}

export function removeRegisteredAccount(id: string) {
  write(read().filter((item) => item.id !== id));
}

function createInspectionClient(accountId: string) {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `work-social:account-inspection:${accountId}`,
    },
  });
}

export type AccountRole = 'contract' | 'salary_person' | 'contractor';

export async function getAccountRoles(account: RegisteredAccount): Promise<AccountRole[]> {
  const client = createInspectionClient(account.id);
  const { error: sessionError } = await client.auth.setSession({
    access_token: account.session.access_token,
    refresh_token: account.session.refresh_token,
  });
  if (sessionError) return [];

  const [workerResult, contractorResult] = await Promise.all([
    client.from('worker_profiles').select('worker_type').eq('profile_id', account.id).maybeSingle<{ worker_type: 'salary_person' | 'contract' }>(),
    client.from('contractor_accounts').select('profile_id').eq('profile_id', account.id).maybeSingle<{ profile_id: string }>(),
  ]);

  const roles: AccountRole[] = [];
  if (workerResult.data?.worker_type === 'contract') roles.push('contract');
  if (workerResult.data?.worker_type === 'salary_person') roles.push('salary_person');
  if (contractorResult.data) roles.push('contractor');
  return roles;
}

export async function getProfileIdentity(account: RegisteredAccount) {
  const client = createInspectionClient(account.id);
  const { error: sessionError } = await client.auth.setSession({
    access_token: account.session.access_token,
    refresh_token: account.session.refresh_token,
  });
  if (sessionError) return null;
  const { data } = await client.from('profiles').select('display_name, avatar_url').eq('id', account.id).maybeSingle<{ display_name: string | null; avatar_url: string | null }>();
  return data ?? null;
}
