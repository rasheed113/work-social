export type WorkContext = 'my_work';

/** Exact decimal values from PostgreSQL numeric columns stay as strings. */
export type WorkDecimal = string;

export type WorkEntrySizes = string[] | null;

export interface WorkEntry {
  id: string;
  worker_profile_id: string;
  work_context: WorkContext;
  item_name: string;
  size: WorkEntrySizes;
  quantity: WorkDecimal;
  rate: WorkDecimal;
  total: WorkDecimal;
  special_note: string | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
}

export interface WorkEntryInput {
  id?: string;
  worker_profile_id: string;
  item_name: string;
  size: WorkEntrySizes;
  quantity: WorkDecimal;
  rate: WorkDecimal;
  special_note?: string | null;
}

export interface WorkEntryUpdateInput {
  item_name: string;
  size: WorkEntrySizes;
  quantity: WorkDecimal;
  rate: WorkDecimal;
  special_note?: string | null;
}

export interface WorkEntryVersion {
  id: string;
  work_entry_id: string;
  revision_no: number;
  item_name: string;
  size: WorkEntrySizes;
  quantity: WorkDecimal;
  rate: WorkDecimal;
  total: WorkDecimal;
  special_note: string | null;
  recorded_at: string;
  changed_by: string | null;
}

export interface WorkerWorkTotals {
  daily_total: WorkDecimal;
  weekly_total: WorkDecimal;
  monthly_total: WorkDecimal;
  lifetime_total: WorkDecimal;
}
