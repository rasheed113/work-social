import type { AssistantCommand, FinanceAssistantOperation, FinanceHistoryFilter, FinanceIntent, GetWorkHistoryIntent, WorkHistoryPeriod } from './contracts';

const FINANCE_OPERATIONS: readonly FinanceAssistantOperation[] = [
  'GET_FINANCE_SUMMARY',
  'GET_FINANCE_HISTORY',
  'CREATE_FINANCE_RECEIVED',
  'UPDATE_FINANCE_RECEIVED',
  'DELETE_FINANCE_RECEIVED',
  'RESTORE_FINANCE_RECEIVED',
];
const FINANCE_FILTERS: readonly FinanceHistoryFilter[] = ['all', 'earnings', 'payments', 'advances', 'received'];
const HISTORY_PERIODS: readonly WorkHistoryPeriod[] = ['lifetime', 'day', 'week', 'month', 'custom'];
const RECEIVED_TYPES = ['payment', 'advance'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

export function validateAssistantCommand(value: unknown): AssistantCommand {
  if (!isRecord(value) || typeof value.intent !== 'string') throw new Error('ASSISTANT_COMMAND_INVALID');

  if (value.intent === 'create_work_entry') {
    if (!hasOnlyKeys(value, ['intent', 'itemName', 'size', 'quantity', 'rate', 'specialNote'])) throw new Error('ASSISTANT_COMMAND_INVALID_FIELDS');
    if (typeof value.itemName !== 'string' || !value.itemName.trim()) throw new Error('WORK_ENTRY_ITEM_REQUIRED');
    if (typeof value.quantity !== 'string' || typeof value.rate !== 'string') throw new Error('WORK_ENTRY_NUMERIC_FIELDS_REQUIRED');
    if (value.size !== undefined && value.size !== null && (!Array.isArray(value.size) || value.size.some((item) => typeof item !== 'string'))) throw new Error('WORK_ENTRY_SIZE_INVALID');
    if (value.specialNote !== undefined && value.specialNote !== null && typeof value.specialNote !== 'string') throw new Error('WORK_ENTRY_NOTE_INVALID');
    return value as unknown as AssistantCommand;
  }

  if (value.intent === 'get_work_history') {
    if (!hasOnlyKeys(value, ['intent', 'query', 'period', 'start', 'end'])) throw new Error('ASSISTANT_COMMAND_INVALID_FIELDS');
    if (!HISTORY_PERIODS.includes(value.period as WorkHistoryPeriod)) throw new Error('WORK_HISTORY_PERIOD_INVALID');
    if (value.query !== undefined && typeof value.query !== 'string') throw new Error('WORK_HISTORY_QUERY_INVALID');
    if (value.period === 'custom' && (typeof value.start !== 'string' || typeof value.end !== 'string')) throw new Error('WORK_HISTORY_CUSTOM_RANGE_REQUIRED');
    if (value.period !== 'custom' && (value.start !== undefined || value.end !== undefined)) throw new Error('WORK_HISTORY_RANGE_NOT_ALLOWED');
    return value as unknown as GetWorkHistoryIntent;
  }

  if (value.intent === 'finance') {
    if (typeof value.operation !== 'string' || !FINANCE_OPERATIONS.includes(value.operation as FinanceAssistantOperation)) throw new Error('FINANCE_OPERATION_NOT_ALLOWED');
    const operation = value.operation as FinanceAssistantOperation;
    const allowedByOperation: Record<FinanceAssistantOperation, readonly string[]> = {
      GET_FINANCE_SUMMARY: ['intent', 'operation'],
      GET_FINANCE_HISTORY: ['intent', 'operation', 'filter'],
      CREATE_FINANCE_RECEIVED: ['intent', 'operation', 'entryType', 'amount'],
      UPDATE_FINANCE_RECEIVED: ['intent', 'operation', 'entryType', 'amount', 'id'],
      DELETE_FINANCE_RECEIVED: ['intent', 'operation', 'id'],
      RESTORE_FINANCE_RECEIVED: ['intent', 'operation', 'id'],
    };
    if (!hasOnlyKeys(value, allowedByOperation[operation])) throw new Error('ASSISTANT_COMMAND_INVALID_FIELDS');
    if (value.filter !== undefined && !FINANCE_FILTERS.includes(value.filter as FinanceHistoryFilter)) throw new Error('FINANCE_FILTER_INVALID');
    if (value.entryType !== undefined && !RECEIVED_TYPES.includes(value.entryType as typeof RECEIVED_TYPES[number])) throw new Error('FINANCE_ENTRY_TYPE_INVALID');
    const requiresAmount = operation === 'CREATE_FINANCE_RECEIVED' || operation === 'UPDATE_FINANCE_RECEIVED';
    const requiresId = operation === 'UPDATE_FINANCE_RECEIVED' || operation === 'DELETE_FINANCE_RECEIVED' || operation === 'RESTORE_FINANCE_RECEIVED';
    if (requiresAmount && typeof value.amount !== 'string') throw new Error('FINANCE_AMOUNT_REQUIRED');
    if (requiresAmount && typeof value.entryType !== 'string') throw new Error('FINANCE_ENTRY_TYPE_REQUIRED');
    if (requiresId && typeof value.id !== 'string') throw new Error('FINANCE_ID_REQUIRED');
    return value as unknown as FinanceIntent;
  }

  throw new Error('ASSISTANT_INTENT_NOT_SUPPORTED');
}

export function isOfflineImageInputSupported(): false {
  return false;
}
