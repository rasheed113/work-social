import { buildWorkEntryHandsAction, executeHandsAction, HandsExecutorError, rollbackHandsAction } from './handsExecutor.ts';

type Row = Record<string, any>;

function makeMock(initial: Record<string, Row[]>) {
  const rows: Record<string, Row[]> = structuredClone(initial);
  const calls: string[] = [];
  const client: any = {
    from(table: string) {
      const state: any = { filters: [], mode: 'select', payload: null };
      const matches = () => rows[table]?.find((candidate) => state.filters.filter(([op]: any) => op === 'eq').every(([, column, value]: any) => candidate[column] === value)) ?? null;
      const builder: any = {
        select() { return builder; },
        eq(column: string, value: unknown) { state.filters.push(['eq', column, value]); return builder; },
        maybeSingle() { const row = matches(); return Promise.resolve({ data: row ? structuredClone(row) : null, error: null }); },
        single() { const row = state.mode === 'insert' ? state.payload : matches(); if (row && state.mode === 'update') Object.assign(row, state.payload); return Promise.resolve({ data: row, error: row ? null : new Error('not found') }); },
        insert(value: any) { state.mode = 'insert'; state.payload = { ...value, total: Number(value.quantity) * Number(value.rate), lifecycle_state: 'active', created_at: 'now', updated_at: 'now' }; rows[table] = [...(rows[table] ?? []), state.payload]; return builder; },
        update(value: any) { state.mode = 'update'; state.payload = value; return builder; },
      };
      return builder;
    },
    async rpc(name: string, args: any) {
      calls.push(name);
      if (name === 'record_ai_action_history') { rows.ai_action_history ??= []; rows.ai_action_history.push(args.p_history); return { data: null, error: null }; }
      if (name === 'trash_worker_work_entry') { const row = rows.work_entries?.find((r) => r.id === args.p_entry_id); if (row) row.lifecycle_state = 'trashed'; return { data: args.p_entry_id, error: null }; }
      if (name === 'restore_worker_work_entry') { const row = rows.work_entries?.find((r) => r.id === args.p_entry_id); if (row) row.lifecycle_state = 'active'; return { data: args.p_entry_id, error: null }; }
      if (name === 'mark_ai_action_reverted') { const row = rows.ai_action_history?.find((r) => r.action_id === args.p_action_id); if (row) row.reverted_at = 'now'; return { data: null, error: null }; }
      return { data: null, error: new Error('unknown rpc') };
    },
  };
  return { client, rows, calls };
}

function expectError(promise: Promise<unknown>, code: string) {
  return promise.then(() => { throw new Error(`expected ${code}`); }, (error) => {
    if (!(error instanceof HandsExecutorError) || error.code !== code) throw error;
  });
}

async function main() {
  const base = { worker_profiles: [{ id: 'worker-a', profile_id: 'user-a' }], work_entries: [], ai_pending_actions: [], ai_tool_calls: [], ai_action_history: [] };

  const create = makeMock(base);
  const createAction = buildWorkEntryHandsAction('user-a', 'a-create', 'create_work_entry', { item_name: 'Shirt', size: ['M'], quantity: '10', rate: '50', special_note: null, occurred_at_iso: '2026-09-07T08:00:00Z' });
  const created = await executeHandsAction(create.client, 'user-a', createAction);
  if (!(created as any).verified) throw new Error('create not verified');
  if (create.rows.ai_action_history.length !== 1) throw new Error('create history missing');
  if (create.rows.ai_action_history[0].previous_state !== null) throw new Error('create previous state should be null');

  const row = create.rows.work_entries[0];
  const update = makeMock({ worker_profiles: [{ id: 'worker-a', profile_id: 'user-a' }], work_entries: [structuredClone(row)], ai_action_history: [], ai_pending_actions: [], ai_tool_calls: [] });
  const updateAction = buildWorkEntryHandsAction('user-a', 'a-update', 'update_work_entry', { entry_id: row.id, item_name: 'Shirt New', size: ['L'], quantity: '11', rate: '60', special_note: 'updated' });
  const updated = await executeHandsAction(update.client, 'user-a', updateAction);
  if (!(updated as any).verified) throw new Error('update not verified');
  if (update.rows.ai_action_history[0].previous_state.item_name !== 'Shirt') throw new Error('update previous state missing');
  if (update.rows.ai_action_history[0].new_state.item_name !== 'Shirt New') throw new Error('update new state missing');
  if (update.rows.ai_action_history[0].reversible !== false) throw new Error('update should not be reversible');

  const trash = makeMock({ worker_profiles: [{ id: 'worker-a', profile_id: 'user-a' }], work_entries: [structuredClone(row)], ai_action_history: [], ai_pending_actions: [], ai_tool_calls: [] });
  const trashAction = buildWorkEntryHandsAction('user-a', 'a-trash', 'delete_work_entry', { entry_id: row.id });
  await executeHandsAction(trash.client, 'user-a', trashAction);
  if (trash.rows.work_entries[0].lifecycle_state !== 'trashed') throw new Error('trash did not transition lifecycle');
  if (trash.rows.ai_action_history[0].reversible !== true) throw new Error('trash should be reversible');

  const rollback = await rollbackHandsAction(trash.client, 'user-a', 'a-trash');
  if (!(rollback as any).verified || trash.rows.work_entries[0].lifecycle_state !== 'active') throw new Error('rollback failed');
  await expectError(rollbackHandsAction(trash.client, 'user-a', 'a-trash'), 'ACTION_ALREADY_REVERTED');

  const createRollback = makeMock({ worker_profiles: [{ id: 'worker-a', profile_id: 'user-a' }], work_entries: [structuredClone(row)], ai_action_history: [{ action_id: 'a-create', user_id: 'user-a', module: 'work', operation: 'create', reversible: true, reverted_at: null, status: 'succeeded', affected_record_ids: [row.id] }], ai_pending_actions: [], ai_tool_calls: [] });
  const createUndo = await rollbackHandsAction(createRollback.client, 'user-a', 'a-create');
  if (!(createUndo as any).verified || createRollback.rows.work_entries[0].lifecycle_state !== 'trashed') throw new Error('create rollback failed');

  await expectError(executeHandsAction(create.client, 'user-b', createAction), 'ACTION_USER_MISMATCH');
  await expectError(executeHandsAction(create.client, 'user-a', { ...updateAction, target: { record_id: 'missing' } } as any), 'WORK_ENTRY_NOT_FOUND');
  await expectError(executeHandsAction(create.client, 'user-a', { ...createAction, input: { ...createAction.input, quantity: '0' } } as any), 'INVALID_ACTION_INPUT');
  await expectError(executeHandsAction(create.client, 'user-a', { ...createAction, module: 'diary' } as any), 'UNSUPPORTED_MODULE');

  console.log('Hands executor tests passed');
}

main().catch((error) => { console.error(error); process.exit(1); });
