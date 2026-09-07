import {
  UniversalEyesSecurityError,
  createSupabaseUniversalEyesRepository,
  searchUniversalEyes,
  selectUniversalEyesModules,
} from './universalEyes';

type Row = Record<string, unknown>;

function mockClient(rows: Record<string, Row[]>) {
  const calls: Array<{ table: string; filters: Array<[string, unknown, unknown]>; ranges: Array<[string, unknown]> }> = [];
  const client = {
    from(table: string) {
      const call = { table, filters: [] as Array<[string, unknown, unknown]>, ranges: [] as Array<[string, unknown]> };
      calls.push(call);
      const builder: any = {
        select() { return builder; },
        eq(column: string, value: unknown) { call.filters.push(['eq', column, value]); return builder; },
        is(column: string, value: unknown) { call.filters.push(['is', column, value]); return builder; },
        gte(column: string, value: unknown) { call.ranges.push([column, value]); return builder; },
        lt(column: string, value: unknown) { call.ranges.push([column, value]); return builder; },
        ilike(column: string, value: unknown) { call.filters.push(['ilike', column, value]); return builder; },
        or(value: unknown) { call.filters.push(['or', value, undefined]); return builder; },
        order() { return builder; },
        limit() { return builder; },
        maybeSingle() { return Promise.resolve({ data: rows[table]?.[0] ?? null, error: null }); },
        then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve); },
      };
      return builder;
    },
  };
  return { client, calls };
}

const repository = {
  searchSocial: async () => [{ module: 'social' as const, record_id: 's1', title: 'Post', snippet: 'launch', occurred_at: '2026-09-07T08:00:00Z', metadata: {} }],
  searchWork: async () => [{ module: 'work' as const, record_id: 'w1', title: 'Work Entry', snippet: '10 × 50', occurred_at: '2026-09-06T08:00:00Z', metadata: { quantity: 10, rate: 50 } }],
  searchWorkFinance: async () => [{ module: 'work_finance' as const, record_id: 'wf1', title: 'Payment received', snippet: '500', occurred_at: '2026-09-05T08:00:00Z', metadata: { amount: 500 } }],
  searchDiary: async () => [{ module: 'diary' as const, record_id: 'd1', title: 'Idea', snippet: 'launch', occurred_at: '2026-09-04T08:00:00Z', metadata: {} }],
  searchFinance: async () => [{ module: 'finance' as const, record_id: 'f1', title: 'expense', snippet: '500 · launch', occurred_at: '2026-09-03', metadata: { amount: 500 } }],
};

async function main() {
  const all = await searchUniversalEyes(repository, 'user-a', 'launch', { limit: 10 });
  if (all.results.length !== 5) throw new Error(`expected five normalized results, got ${all.results.length}`);
  if (!all.results.every((result) => result.module && result.record_id && result.title && 'metadata' in result)) throw new Error('normalized result shape is incomplete');

  const multi = await searchUniversalEyes(repository, 'user-a', 'work payment diary', { limit: 10 });
  if (!multi.modules.includes('work') || !multi.modules.includes('work_finance') || !multi.modules.includes('diary')) throw new Error('multi-module selection failed');
  if (!multi.ambiguous) throw new Error('multi-module search should be marked ambiguous');

  const filtered = await searchUniversalEyes(repository, 'user-a', 'launch', { modules: ['finance'], from: '2026-09-01', to: '2026-09-08', limit: 5 });
  if (filtered.modules.length !== 1 || filtered.modules[0] !== 'finance') throw new Error('explicit module selection failed');

  if (!selectUniversalEyesModules('payment received').includes('work_finance')) throw new Error('work finance routing failed');
  if (!selectUniversalEyesModules('expense account balance').includes('finance')) throw new Error('finance routing failed');
  if (!selectUniversalEyesModules('diary idea').includes('diary')) throw new Error('diary routing failed');
  if (!selectUniversalEyesModules('post notification').includes('social')) throw new Error('social routing failed');
  if (!selectUniversalEyesModules('pieces rate item').includes('work')) throw new Error('work routing failed');

  let rejected = false;
  try { selectUniversalEyesModules('api_key=super-secret'); } catch (error) { rejected = error instanceof UniversalEyesSecurityError; }
  if (!rejected) throw new Error('credential-like search text was not rejected');

  const { client, calls } = mockClient({
    worker_profiles: [{ id: 'worker-a' }],
    posts: [{ id: 's1', content: 'hello', created_at: '2026-09-07T08:00:00Z', privacy: 'public', location_name: null }],
    work_entries: [{ id: 'w1', item_name: 'shirt', quantity: 2, rate: 100, total: 200, occurred_at: '2026-09-07T07:00:00Z' }],
    worker_finance_received: [{ id: 'wf1', entry_type: 'payment', amount: 500, received_at: '2026-09-07T06:00:00Z' }],
    worker_diary_entries: [{ id: 'd1', entry_type: 'note', title: 'Idea', content: 'hello', updated_at: '2026-09-07T05:00:00Z' }],
    expense_transactions: [{ id: 'f1', type: 'expense', amount: 50, date: '2026-09-07', note: 'tea' }],
  });
  const adapter = createSupabaseUniversalEyesRepository(client);
  await adapter.searchSocial('user-a', 'hello', { from: '2026-09-01', to: '2026-09-08' });
  await adapter.searchWork('user-a', 'shirt', { from: '2026-09-01', to: '2026-09-08' });
  await adapter.searchWorkFinance('user-a', 'payment', { from: '2026-09-01', to: '2026-09-08' });
  await adapter.searchDiary('user-a', 'hello', { from: '2026-09-01', to: '2026-09-08' });
  await adapter.searchFinance('user-a', 'tea', { from: '2026-09-01', to: '2026-09-08' });

  const userScopedTables = calls.filter((call) => ['posts', 'expense_transactions'].includes(call.table));
  for (const call of userScopedTables) {
    if (!call.filters.some(([op, column, value]) => op === 'eq' && column === 'profile_id' && value === 'user-a') && call.table === 'posts') throw new Error('social adapter lost user ownership filter');
    if (!call.filters.some(([op, column, value]) => op === 'eq' && column === 'user_id' && value === 'user-a') && call.table === 'expense_transactions') throw new Error('finance adapter lost user ownership filter');
  }
  const workerCalls = calls.filter((call) => ['work_entries', 'worker_finance_received', 'worker_diary_entries'].includes(call.table));
  for (const call of workerCalls) {
    if (!call.filters.some(([op, column, value]) => op === 'eq' && column === 'worker_profile_id' && value === 'worker-a')) throw new Error(`${call.table} lost worker ownership filter`);
    if (!call.ranges.some(([column, value]) => column && value)) throw new Error(`${call.table} lost date range filtering`);
  }
  if (!calls.find((call) => call.table === 'posts')?.ranges.length) throw new Error('social date filtering missing');
  if (!calls.find((call) => call.table === 'expense_transactions')?.ranges.length) throw new Error('finance date filtering missing');

  console.log('Universal Eyes tests passed');
}

main().catch((error) => { console.error(error); process.exit(1); });
