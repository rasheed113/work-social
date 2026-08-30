import type { WorkDecimal } from './workEntry';

export type WorkerFinanceTransactionType = 'PAYMENT' | 'ADVANCE';
export type WorkerFinanceSourceKind = 'WORK_ENTRY' | 'FINANCE';

export interface WorkerFinanceSummary {
  earnings: WorkDecimal;
  payments: WorkDecimal;
  advances: WorkDecimal;
  current_balance: WorkDecimal;
}

export interface WorkerFinanceHistoryRow {
  id: string;
  source_kind: WorkerFinanceSourceKind;
  transaction_type: WorkerFinanceTransactionType | null;
  occurred_at: string;
  amount: WorkDecimal;
  item_name: string | null;
  size: string[] | null;
  quantity: WorkDecimal | null;
  rate: WorkDecimal | null;
  note: string | null;
  has_more: boolean;
}

export interface WorkerFinanceCursor {
  occurred_at: string;
  id: string;
  source_kind: WorkerFinanceSourceKind;
}
