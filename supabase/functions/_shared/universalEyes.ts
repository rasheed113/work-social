export type UniversalEyesModule = 'social' | 'work' | 'work_finance' | 'diary' | 'finance';

export interface UniversalEyesResult {
  module: UniversalEyesModule;
  record_id: string;
  title: string;
  snippet: string;
  occurred_at: string | null;
  metadata: Record<string, unknown>;
}

export interface UniversalEyesSearchOptions {
  modules?: UniversalEyesModule[];
  from?: string | null;
  to?: string | null;
  limit?: number;
}

export interface UniversalEyesRepository {
  searchSocial(userId: string, query: string, options: UniversalEyesSearchOptions): Promise<UniversalEyesResult[]>;
  searchWork(userId: string, query: string, options: UniversalEyesSearchOptions): Promise<UniversalEyesResult[]>;
  searchWorkFinance(userId: string, query: string, options: UniversalEyesSearchOptions): Promise<UniversalEyesResult[]>;
  searchDiary(userId: string, query: string, options: UniversalEyesSearchOptions): Promise<UniversalEyesResult[]>;
  searchFinance(userId: string, query: string, options: UniversalEyesSearchOptions): Promise<UniversalEyesResult[]>;
}

const MODULES: UniversalEyesModule[] = ['social', 'work', 'work_finance', 'diary', 'finance'];
const SECRET_PATTERNS = [
  /(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|password|passwd|secret)\s*[:=]/i,
  /\b(?:sk|pk)[-_][a-z0-9]{16,}\b/i,
  /\beyj[a-z0-9_-]{20,}\.[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}\b/i,
];

export class UniversalEyesSecurityError extends Error {
  constructor(message = 'Search text appears to contain a credential or secret.') {
    super(message);
    this.name = 'UniversalEyesSecurityError';
  }
}

export function assertSafeUniversalEyesQuery(query: string): string {
  const normalized = query.trim();
  if (!normalized) return '';
  if (normalized.length > 500) throw new UniversalEyesSecurityError('Search text is too long.');
  if (SECRET_PATTERNS.some((pattern) => pattern.test(normalized))) throw new UniversalEyesSecurityError();
  return normalized;
}

function moduleScore(query: string, module: UniversalEyesModule): number {
  const q = query.toLocaleLowerCase();
  const terms: Record<UniversalEyesModule, string[]> = {
    social: ['post', 'posts', 'profile', 'friend', 'friends', 'message', 'chat', 'notification', 'video', 'social'],
    work: ['work', 'job', 'item', 'piece', 'pieces', 'quantity', 'rate', 'entry', 'entries', 'production'],
    work_finance: ['advance', 'payment', 'payments', 'received', 'earning', 'earnings', 'work finance'],
    diary: ['diary', 'journal', 'todo', 'task', 'idea', 'note', 'notes', 'event', 'reminder'],
    finance: ['expense', 'expenses', 'income', 'account', 'accounts', 'budget', 'transaction', 'transactions', 'transfer', 'balance', 'money'],
  };
  return terms[module].reduce((score, term) => score + (q.includes(term) ? 1 : 0), 0);
}

export function selectUniversalEyesModules(query: string): UniversalEyesModule[] {
  const safe = assertSafeUniversalEyesQuery(query);
  if (!safe) return MODULES;
  const scored = MODULES.map((module) => ({ module, score: moduleScore(safe, module) })).filter((item) => item.score > 0);
  if (!scored.length) return MODULES;
  const max = Math.max(...scored.map((item) => item.score));
  return scored.filter((item) => item.score === max || item.score >= 1).map((item) => item.module);
}

function normalizeOptions(options: UniversalEyesSearchOptions): Required<Pick<UniversalEyesSearchOptions, 'limit'>> & UniversalEyesSearchOptions {
  return { ...options, limit: Math.min(Math.max(options.limit ?? 20, 1), 50) };
}

export async function searchUniversalEyes(
  repository: UniversalEyesRepository,
  userId: string,
  query: string,
  options: UniversalEyesSearchOptions = {},
): Promise<{ modules: UniversalEyesModule[]; results: UniversalEyesResult[]; ambiguous: boolean }> {
  if (!userId.trim()) throw new Error('Authenticated user id is required.');
  const safeQuery = assertSafeUniversalEyesQuery(query);
  const normalizedOptions = normalizeOptions(options);
  const requested = options.modules?.length ? options.modules : selectUniversalEyesModules(safeQuery);
  const modules = MODULES.filter((module) => requested.includes(module));
  const searches: Record<UniversalEyesModule, () => Promise<UniversalEyesResult[]>> = {
    social: () => repository.searchSocial(userId, safeQuery, normalizedOptions),
    work: () => repository.searchWork(userId, safeQuery, normalizedOptions),
    work_finance: () => repository.searchWorkFinance(userId, safeQuery, normalizedOptions),
    diary: () => repository.searchDiary(userId, safeQuery, normalizedOptions),
    finance: () => repository.searchFinance(userId, safeQuery, normalizedOptions),
  };
  const batches = await Promise.all(modules.map((module) => searches[module]()));
  const results = batches.flat().sort((a, b) => (b.occurred_at ?? '').localeCompare(a.occurred_at ?? '')).slice(0, normalizedOptions.limit);
  return { modules, results, ambiguous: modules.length > 1 && !options.modules?.length };
}

/**
 * Production adapter for the authenticated Supabase client used by the AI Edge Function.
 * Every query is scoped to the authenticated user before any search predicate is applied.
 */
export function createSupabaseUniversalEyesRepository(client: any): UniversalEyesRepository {
  const workProfileId = async (userId: string): Promise<string> => {
    const { data, error } = await client.from('worker_profiles').select('id').eq('profile_id', userId).maybeSingle();
    if (error) throw error;
    if (!data?.id) return '';
    return data.id;
  };
  const dateRange = (builder: any, column: string, options: UniversalEyesSearchOptions) => {
    let next = builder;
    if (options.from) next = next.gte(column, options.from);
    if (options.to) next = next.lt(column, options.to);
    return next;
  };
  const safeLimit = (options: UniversalEyesSearchOptions) => Math.min(Math.max(options.limit ?? 20, 1), 50);

  return {
    async searchSocial(userId, query, options) {
      const term = query.replace(/[\\%_]/g, '\\$&');
      let builder = client.from('posts').select('id,content,privacy,created_at,location_name').eq('profile_id', userId).order('created_at', { ascending: false }).limit(safeLimit(options));
      if (term) builder = builder.ilike('content', `%${term}%`);
      builder = dateRange(builder, 'created_at', options);
      const { data, error } = await builder;
      if (error) throw error;
      return (data ?? []).map((row: any) => ({ module: 'social', record_id: row.id, title: 'Post', snippet: String(row.content ?? ''), occurred_at: row.created_at ?? null, metadata: { privacy: row.privacy, location_name: row.location_name } }));
    },
    async searchWork(userId, query, options) {
      const workerId = await workProfileId(userId);
      if (!workerId) return [];
      const term = query.replace(/[\\%_]/g, '\\$&');
      let builder = client.from('work_entries').select('id,item_name,size,quantity,rate,total,special_note,occurred_at').eq('worker_profile_id', workerId).eq('work_context', 'my_work').eq('lifecycle_state', 'active').order('occurred_at', { ascending: false }).limit(safeLimit(options));
      if (term) builder = builder.or(`item_name.ilike.%${term}%,size.ilike.%${term}%,special_note.ilike.%${term}%`);
      builder = dateRange(builder, 'occurred_at', options);
      const { data, error } = await builder;
      if (error) throw error;
      return (data ?? []).map((row: any) => ({ module: 'work', record_id: row.id, title: String(row.item_name ?? 'Work Entry'), snippet: `${row.quantity ?? 0} × ${row.rate ?? 0}${row.size ? ` · size ${row.size}` : ''}${row.special_note ? ` · ${row.special_note}` : ''}`, occurred_at: row.occurred_at ?? null, metadata: { size: row.size, quantity: row.quantity, rate: row.rate, total: row.total } }));
    },
    async searchWorkFinance(userId, query, options) {
      const workerId = await workProfileId(userId);
      if (!workerId) return [];
      let builder = client.from('worker_finance_received').select('id,entry_type,amount,received_at,created_at').eq('worker_profile_id', workerId).is('deleted_at', null).order('received_at', { ascending: false }).limit(safeLimit(options));
      builder = dateRange(builder, 'received_at', options);
      if (query) builder = builder.ilike('entry_type', `%${query.replace(/[\\%_]/g, '\\$&')}%`);
      const { data, error } = await builder;
      if (error) throw error;
      return (data ?? []).map((row: any) => ({ module: 'work_finance', record_id: row.id, title: row.entry_type === 'advance' ? 'Advance received' : 'Payment received', snippet: `${row.amount ?? 0}`, occurred_at: row.received_at ?? row.created_at ?? null, metadata: { entry_type: row.entry_type, amount: row.amount } }));
    },
    async searchDiary(userId, query, options) {
      const workerId = await workProfileId(userId);
      if (!workerId) return [];
      const term = query.replace(/[\\%_]/g, '\\$&');
      let builder = client.from('worker_diary_entries').select('id,entry_type,title,content,completed,created_at,updated_at,event_start_at,event_end_at,event_timezone').eq('worker_profile_id', workerId).order('updated_at', { ascending: false }).limit(safeLimit(options));
      if (term) builder = builder.or(`title.ilike.%${term}%,content.ilike.%${term}%`);
      builder = dateRange(builder, 'created_at', options);
      const { data, error } = await builder;
      if (error) throw error;
      return (data ?? []).map((row: any) => ({ module: 'diary', record_id: row.id, title: String(row.title ?? row.entry_type ?? 'Diary entry'), snippet: String(row.content ?? ''), occurred_at: row.event_start_at ?? row.updated_at ?? row.created_at ?? null, metadata: { entry_type: row.entry_type, completed: row.completed, event_end_at: row.event_end_at, event_timezone: row.event_timezone } }));
    },
    async searchFinance(userId, query, options) {
      const term = query.replace(/[\\%_]/g, '\\$&');
      let builder = client.from('expense_transactions').select('id,type,amount,account_id,category_id,from_account_id,to_account_id,date,note').eq('user_id', userId).order('date', { ascending: false }).limit(safeLimit(options));
      builder = dateRange(builder, 'date', options);
      if (term) builder = builder.ilike('note', `%${term}%`);
      const { data, error } = await builder;
      if (error) throw error;
      return (data ?? []).map((row: any) => ({ module: 'finance', record_id: row.id, title: String(row.type ?? 'Transaction'), snippet: `${row.amount ?? 0}${row.note ? ` · ${row.note}` : ''}`, occurred_at: row.date ?? null, metadata: { type: row.type, amount: row.amount, account_id: row.account_id, category_id: row.category_id, from_account_id: row.from_account_id, to_account_id: row.to_account_id } }));
    },
  };
}
