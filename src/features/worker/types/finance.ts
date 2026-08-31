import type { WorkDecimal, WorkEntry } from './workEntry';

export type FinanceReceivedType = 'payment' | 'advance';

export interface FinanceReceivedRecord {
  id: string;
  worker_profile_id: string;
  entry_type: FinanceReceivedType;
  amount: WorkDecimal;
  received_at: string;
  created_at: string;
  deleted_at: string | null;
}

export interface WorkerFinanceSummary {
  total_earnings: WorkDecimal;
  received: WorkDecimal;
  remaining: WorkDecimal;
}

export type FinanceListEntry =
  | { kind: 'earning'; id: string; amount: WorkDecimal; occurred_at: string; workEntry: WorkEntry }
  | { kind: FinanceReceivedType; id: string; amount: WorkDecimal; occurred_at: string; record: FinanceReceivedRecord };
