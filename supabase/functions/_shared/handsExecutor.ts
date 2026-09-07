export type HandsOperation = 'create' | 'update' | 'trash';

export type HandsAction = {
  action_id: string;
  user_id: string;
  module: 'work';
  operation: HandsOperation;
  target: { record_id?: string };
  input: Record<string, unknown>;
};

export class HandsExecutorError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = 'HandsExecutorError';
  }
}

const WORK_ENTRY_COLUMNS = 'id,worker_profile_id,work_context,lifecycle_state,item_name,size,quantity,rate,total,special_note,occurred_at,created_at,updated_at';

function fail(code: string, message: string, status = 400): never {
  throw new HandsExecutorError(code, message, status);
}

function stringInput(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string') fail('INVALID_ACTION_INPUT', `${field} must be a string.`);
  const text = value.trim();
  if (!text || text.length > max) fail('INVALID_ACTION_INPUT', `${field} is invalid.`);
  return text;
}

function optionalString(value: unknown, field: string, max: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') fail('INVALID_ACTION_INPUT', `${field} must be a string or null.`);
  const text = value.trim();
  if (text.length > max) fail('INVALID_ACTION_INPUT', `${field} is invalid.`);
  return text || null;
}

function numberInput(value: unknown, field: string, positive: boolean): string {
  if (typeof value !== 'string' && typeof value !== 'number') fail('INVALID_ACTION_INPUT', `${field} must be numeric.`);
  const text = String(value).trim();
  const number = Number(text);
  if (!Number.isFinite(number) || (positive ? number <= 0 : number < 0)) fail('INVALID_ACTION_INPUT', `${field} is invalid.`);
  return text;
}

function sizeInput(value: unknown): string[] | null {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) fail('INVALID_ACTION_INPUT', 'size must be an array or null.');
  const sizes = value.map((item) => {
    if (typeof item !== 'string') fail('INVALID_ACTION_INPUT', 'size values must be strings.');
    const text = item.trim();
    if (!text || text.length > 100) fail('INVALID_ACTION_INPUT', 'size contains an invalid value.');
    return text;
  });
  if (!sizes.length || new Set(sizes).size !== sizes.length) fail('INVALID_ACTION_INPUT', 'size must contain unique values.');
  return sizes;
}

function occurredAtInput(value: unknown): string {
  if (typeof value !== 'string') fail('INVALID_ACTION_INPUT', 'occurred_at_iso must be a string.');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) fail('INVALID_ACTION_INPUT', 'occurred_at_iso is invalid.');
  return date.toISOString();
}

export function validateHandsAction(action: unknown, authenticatedUserId: string): asserts action is HandsAction {
  if (!action || typeof action !== 'object') fail('INVALID_ACTION', 'Hands action must be an object.');
  const candidate = action as Partial<HandsAction>;
  if (!authenticatedUserId.trim()) fail('AUTHENTICATION_REQUIRED', 'Authenticated user id is required.', 401);
  if (candidate.user_id !== authenticatedUserId) fail('ACTION_USER_MISMATCH', 'The action does not belong to the authenticated user.', 403);
  if (candidate.module !== 'work') fail('UNSUPPORTED_MODULE', 'Hands currently supports Work Entry actions only.');
  if (!candidate.action_id || typeof candidate.action_id !== 'string') fail('INVALID_ACTION', 'action_id is required.');
  if (!['create', 'update', 'trash'].includes(candidate.operation as string)) fail('UNSUPPORTED_OPERATION', 'Unsupported Work Entry operation.');
  if (!candidate.target || typeof candidate.target !== 'object') fail('INVALID_ACTION', 'target is required.');
  if (!candidate.input || typeof candidate.input !== 'object' || Array.isArray(candidate.input)) fail('INVALID_ACTION', 'input is required.');
  if (candidate.operation !== 'create' && !candidate.target.record_id) fail('INVALID_TARGET', 'record_id is required for this operation.');
}

export function buildWorkEntryHandsAction(userId: string, actionId: string, toolName: string, rawArguments: unknown): HandsAction {
  if (!userId.trim()) fail('AUTHENTICATION_REQUIRED', 'Authenticated user id is required.', 401);
  if (!rawArguments || typeof rawArguments !== 'object' || Array.isArray(rawArguments)) fail('INVALID_ACTION_INPUT', 'Pending action arguments are invalid.');
  const args = rawArguments as Record<string, unknown>;

  if (toolName === 'create_work_entry') {
    return {
      action_id: actionId,
      user_id: userId,
      module: 'work',
      operation: 'create',
      target: {},
      input: {
        item_name: args.item_name,
        size: args.size ?? null,
        quantity: args.quantity,
        rate: args.rate,
        special_note: args.special_note ?? null,
        occurred_at_iso: args.occurred_at_iso,
      },
    };
  }

  if (toolName === 'update_work_entry') {
    return {
      action_id: actionId,
      user_id: userId,
      module: 'work',
      operation: 'update',
      target: { record_id: args.entry_id as string },
      input: {
        item_name: args.item_name,
        size: args.size ?? null,
        quantity: args.quantity,
        rate: args.rate,
        special_note: args.special_note ?? null,
      },
    };
  }

  if (toolName === 'delete_work_entry') {
    return {
      action_id: actionId,
      user_id: userId,
      module: 'work',
      operation: 'trash',
      target: { record_id: args.entry_id as string },
      input: {},
    };
  }

  fail('UNSUPPORTED_PENDING_ACTION', 'Unsupported pending Work action.');
}

async function workerProfileId(client: any, authenticatedUserId: string): Promise<string> {
  const { data, error } = await client
    .from('worker_profiles')
    .select('id')
    .eq('profile_id', authenticatedUserId)
    .maybeSingle();
  if (error) fail('DATABASE_ERROR', error.message, 500);
  if (!data?.id) fail('WORK_IDENTITY_UNAVAILABLE', 'Your Work Identity is not set up.', 404);
  return data.id;
}

async function ownedWorkEntry(client: any, workerId: string, recordId: string, lifecycle?: 'active' | 'trashed') {
  let query = client
    .from('work_entries')
    .select(WORK_ENTRY_COLUMNS)
    .eq('id', recordId)
    .eq('worker_profile_id', workerId);
  if (lifecycle) query = query.eq('lifecycle_state', lifecycle);
  const { data, error } = await query.maybeSingle();
  if (error) fail('DATABASE_ERROR', error.message, 500);
  return data ?? null;
}

function verifyFields(row: any, input: Record<string, unknown>, includeOccurredAt: boolean) {
  if (
    row.item_name !== input.item_name ||
    Number(row.quantity) !== Number(input.quantity) ||
    Number(row.rate) !== Number(input.rate) ||
    (row.special_note ?? null) !== (input.special_note ?? null)
  ) {
    fail('VERIFICATION_FAILED', 'The persisted Work Entry does not match the requested mutation.', 502);
  }

  if (JSON.stringify(row.size ?? null) !== JSON.stringify(input.size ?? null)) {
    fail('VERIFICATION_FAILED', 'The persisted Work Entry size does not match the requested mutation.', 502);
  }

  if (includeOccurredAt && new Date(row.occurred_at).toISOString() !== input.occurred_at_iso) {
    fail('VERIFICATION_FAILED', 'The persisted Work Entry date does not match the requested mutation.', 502);
  }
}

async function recordHistory(client: any, payload: Record<string, unknown>) {
  const { error } = await client.rpc('record_ai_action_history', { p_history: payload });
  if (error) fail('HISTORY_PERSISTENCE_FAILED', error.message, 502);
}

async function finish(
  client: any,
  action: HandsAction,
  result: Record<string, unknown>,
  previousState: any,
  newState: any,
  verificationResult: Record<string, unknown>,
  reversible: boolean,
  workerId: string,
) {
  const recordIds = [String(result.record_id)];
  const executedAt = new Date().toISOString();

  await recordHistory(client, {
    action_id: action.action_id,
    user_id: action.user_id,
    action_type: action.operation,
    module: action.module,
    operation: action.operation,
    status: 'succeeded',
    affected_record_ids: recordIds,
    previous_state: previousState,
    new_state: newState,
    verification_state: 'verified',
    verification_result: verificationResult,
    executed_at: executedAt,
    reversible,
  });

  const { error: pendingError } = await client
    .from('ai_pending_actions')
    .update({ status: 'succeeded' })
    .eq('id', action.action_id)
    .eq('user_id', action.user_id)
    .eq('status', 'pending');
  if (pendingError) fail('DATABASE_ERROR', pendingError.message, 500);

  const { error: toolError } = await client
    .from('ai_tool_calls')
    .update({
      status: 'verified',
      execution_state: 'succeeded',
      verification_state: 'verified',
      record_ids: recordIds,
      verification_result: verificationResult,
      verified_at: executedAt,
      completed_at: executedAt,
      result,
    })
    .eq('pending_action_id', action.action_id)
    .eq('user_id', action.user_id);
  if (toolError) fail('DATABASE_ERROR', toolError.message, 500);

  return {
    ...result,
    verified: true,
    verification_result: verificationResult,
    record_ids: recordIds,
    worker_profile_id: workerId,
  };
}

async function executeCreate(client: any, action: HandsAction, workerId: string) {
  const input = action.input;
  const itemName = stringInput(input.item_name, 'item_name', 200);
  const quantity = numberInput(input.quantity, 'quantity', true);
  const rate = numberInput(input.rate, 'rate', false);
  const size = sizeInput(input.size);
  const specialNote = optionalString(input.special_note, 'special_note', 2000);
  const occurredAt = occurredAtInput(input.occurred_at_iso);
  const rowInput = {
    id: action.action_id,
    worker_profile_id: workerId,
    work_context: 'my_work',
    item_name: itemName,
    size,
    quantity,
    rate,
    special_note: specialNote,
    occurred_at: occurredAt,
  };

  const { data, error } = await client.from('work_entries').insert(rowInput).select(WORK_ENTRY_COLUMNS).single();
  let idempotentReplay = false;
  if (error) {
    const existing = await ownedWorkEntry(client, workerId, action.action_id);
    if (!existing) fail('DATABASE_ERROR', error.message, 500);
    idempotentReplay = true;
  }

  const verifiedRow = await ownedWorkEntry(client, workerId, action.action_id);
  if (!verifiedRow) fail('VERIFICATION_FAILED', 'The created Work Entry could not be re-read.', 502);
  verifyFields(
    verifiedRow,
    {
      item_name: itemName,
      size,
      quantity,
      rate,
      special_note: specialNote,
      occurred_at_iso: new Date(occurredAt).toISOString(),
    },
    true,
  );

  return finish(
    client,
    action,
    { success: true, record_id: verifiedRow.id, idempotent_replay: idempotentReplay, work_entry: verifiedRow },
    null,
    verifiedRow,
    { exists: true, ownership_verified: verifiedRow.worker_profile_id === workerId, fields_verified: true },
    true,
    workerId,
  );
}

async function executeUpdate(client: any, action: HandsAction, workerId: string) {
  const recordId = String(action.target.record_id);
  const before = await ownedWorkEntry(client, workerId, recordId, 'active');
  if (!before) fail('WORK_ENTRY_NOT_FOUND', 'That Work Entry was not found.', 404);

  const input = action.input;
  const itemName = stringInput(input.item_name, 'item_name', 200);
  const quantity = numberInput(input.quantity, 'quantity', true);
  const rate = numberInput(input.rate, 'rate', false);
  const size = sizeInput(input.size);
  const specialNote = optionalString(input.special_note, 'special_note', 2000);

  const { data, error } = await client
    .from('work_entries')
    .update({ item_name: itemName, size, quantity, rate, special_note: specialNote })
    .eq('id', recordId)
    .eq('worker_profile_id', workerId)
    .eq('lifecycle_state', 'active')
    .select(WORK_ENTRY_COLUMNS)
    .single();
  if (error || !data) fail('DATABASE_ERROR', error?.message ?? 'Work Entry could not be updated.', 500);

  const after = await ownedWorkEntry(client, workerId, recordId, 'active');
  if (!after) fail('VERIFICATION_FAILED', 'The updated Work Entry could not be re-read.', 502);
  verifyFields(after, { item_name: itemName, size, quantity, rate, special_note: specialNote }, false);

  return finish(
    client,
    action,
    { success: true, record_id: after.id, work_entry: after },
    before,
    after,
    { exists: true, ownership_verified: after.worker_profile_id === workerId, fields_verified: true },
    false,
    workerId,
  );
}

async function executeTrash(client: any, action: HandsAction, workerId: string) {
  const recordId = String(action.target.record_id);
  const before = await ownedWorkEntry(client, workerId, recordId, 'active');
  if (!before) fail('WORK_ENTRY_NOT_FOUND', 'That Work Entry was not found.', 404);

  const { data, error } = await client.rpc('trash_worker_work_entry', { p_entry_id: recordId });
  if (error || !data) fail('DATABASE_ERROR', error?.message ?? 'Work Entry could not be moved to trash.', 500);

  const after = await ownedWorkEntry(client, workerId, recordId, 'trashed');
  if (!after || after.lifecycle_state !== 'trashed') fail('VERIFICATION_FAILED', 'The Work Entry was not verified as trashed.', 502);

  return finish(
    client,
    action,
    { success: true, record_id: recordId, work_entry_id: recordId, trash_result: data },
    before,
    after,
    { exists: true, ownership_verified: after.worker_profile_id === workerId, lifecycle_state: after.lifecycle_state },
    true,
    workerId,
  );
}

export async function executeHandsAction(client: any, authenticatedUserId: string, action: HandsAction) {
  validateHandsAction(action, authenticatedUserId);
  const workerId = await workerProfileId(client, authenticatedUserId);
  if (action.operation === 'create') return executeCreate(client, action, workerId);
  if (action.operation === 'update') return executeUpdate(client, action, workerId);
  return executeTrash(client, action, workerId);
}

export async function rollbackHandsAction(client: any, authenticatedUserId: string, actionId: string) {
  if (!authenticatedUserId.trim()) fail('AUTHENTICATION_REQUIRED', 'Authenticated user id is required.', 401);

  const { data: history, error } = await client
    .from('ai_action_history')
    .select('*')
    .eq('action_id', actionId)
    .eq('user_id', authenticatedUserId)
    .maybeSingle();
  if (error) fail('DATABASE_ERROR', error.message, 500);
  if (!history) fail('ACTION_HISTORY_NOT_FOUND', 'The original action history was not found.', 404);
  if (!history.reversible) fail('ACTION_NOT_REVERSIBLE', 'This action is not reversible.', 409);
  if (history.reverted_at) fail('ACTION_ALREADY_REVERTED', 'This action has already been reverted.', 409);
  if (history.module !== 'work' || !['create', 'trash'].includes(history.operation)) {
    fail('ROLLBACK_NOT_SUPPORTED', 'Rollback is currently supported only for Work Entry create/trash actions.', 409);
  }

  const recordId = Array.isArray(history.affected_record_ids) ? String(history.affected_record_ids[0] ?? '') : '';
  if (!recordId) fail('ROLLBACK_TARGET_MISSING', 'The original Work Entry target is missing.', 409);

  const workerId = await workerProfileId(client, authenticatedUserId);

  if (history.operation === 'trash') {
    const trashed = await ownedWorkEntry(client, workerId, recordId, 'trashed');
    if (!trashed) fail('WORK_ENTRY_NOT_TRASHED', 'The original Work Entry is not currently trashed.', 409);
    const { data, error: restoreError } = await client.rpc('restore_worker_work_entry', { p_entry_id: recordId });
    if (restoreError || !data) fail('DATABASE_ERROR', restoreError?.message ?? 'Work Entry could not be restored.', 500);
    const restored = await ownedWorkEntry(client, workerId, recordId, 'active');
    if (!restored || restored.lifecycle_state !== 'active') fail('VERIFICATION_FAILED', 'The Work Entry restore could not be verified.', 502);
    const { error: markError } = await client.rpc('mark_ai_action_reverted', { p_action_id: actionId });
    if (markError) fail('HISTORY_PERSISTENCE_FAILED', markError.message, 502);
    return { success: true, reverted: true, record_id: recordId, work_entry: restored, verified: true };
  }

  const active = await ownedWorkEntry(client, workerId, recordId, 'active');
  if (!active) fail('WORK_ENTRY_NOT_ACTIVE', 'The created Work Entry is no longer active.', 409);
  const { data, error: trashError } = await client.rpc('trash_worker_work_entry', { p_entry_id: recordId });
  if (trashError || !data) fail('DATABASE_ERROR', trashError?.message ?? 'Work Entry could not be moved to trash.', 500);
  const trashed = await ownedWorkEntry(client, workerId, recordId, 'trashed');
  if (!trashed || trashed.lifecycle_state !== 'trashed') fail('VERIFICATION_FAILED', 'The Work Entry create rollback could not be verified.', 502);
  const { error: markError } = await client.rpc('mark_ai_action_reverted', { p_action_id: actionId });
  if (markError) fail('HISTORY_PERSISTENCE_FAILED', markError.message, 502);
  return { success: true, reverted: true, record_id: recordId, work_entry: trashed, verified: true };
}
