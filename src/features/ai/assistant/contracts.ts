export type OfflineAssistantCapability =
  | 'CREATE_WORK_ENTRY'
  | 'READ_WORK_HISTORY'
  | 'FINANCE_CONTROL'
  | 'VOICE_INPUT'
  | 'TEXT_INPUT';

export type OfflineCapabilityStatus = 'SUPPORTED' | 'UNAVAILABLE' | 'NOT_SUPPORTED';

export interface OfflineCapabilityReport {
  capability: OfflineAssistantCapability;
  status: OfflineCapabilityStatus;
  reason?: string;
}

export type AssistantLanguage = 'en' | 'ur' | 'roman-ur' | 'mixed' | 'unknown' | (string & {});

export interface AssistantLanguageMetadata {
  inputLanguage: AssistantLanguage;
  responseLanguage: AssistantLanguage;
}

export interface AssistantContext {
  language: AssistantLanguageMetadata;
  signal?: AbortSignal;
}

export interface CreateWorkEntryIntent {
  readonly intent: 'create_work_entry';
  readonly itemName: string;
  readonly size?: string[] | null;
  readonly quantity: string;
  readonly rate: string;
  readonly specialNote?: string | null;
}

export type WorkHistoryPeriod = 'lifetime' | 'day' | 'week' | 'month' | 'custom';

export interface GetWorkHistoryIntent {
  readonly intent: 'get_work_history';
  readonly query?: string;
  readonly period: WorkHistoryPeriod;
  readonly start?: string;
  readonly end?: string;
}

export type FinanceAssistantOperation =
  | 'GET_FINANCE_SUMMARY'
  | 'GET_FINANCE_HISTORY'
  | 'CREATE_FINANCE_RECEIVED'
  | 'UPDATE_FINANCE_RECEIVED'
  | 'DELETE_FINANCE_RECEIVED'
  | 'RESTORE_FINANCE_RECEIVED';

export type FinanceHistoryFilter = 'all' | 'earnings' | 'payments' | 'advances' | 'received';
export type FinanceReceivedType = 'payment' | 'advance';

export interface FinanceIntent {
  readonly intent: 'finance';
  readonly operation: FinanceAssistantOperation;
  readonly filter?: FinanceHistoryFilter;
  readonly entryType?: FinanceReceivedType;
  readonly amount?: string;
  readonly id?: string;
}

export type AssistantCommand = CreateWorkEntryIntent | GetWorkHistoryIntent | FinanceIntent;

export interface AssistantToolResult<T = unknown> {
  readonly ok: boolean;
  readonly data?: T;
  readonly errorCode?: string;
  readonly message?: string;
}
