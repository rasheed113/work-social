export type WorkContext = 'my_work';

export interface WorkEntry {
  id: string;
  worker_profile_id: string;
  work_context: WorkContext;
  item_name: string;
  size: string;
  quantity: number;
  rate: number;
  total: number;
  special_note: string | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
}

export interface WorkEntryInput {
  worker_profile_id: string;
  item_name: string;
  size: string;
  quantity: number;
  rate: number;
  special_note?: string | null;
}

export interface WorkEntryUpdateInput {
  item_name: string;
  size: string;
  quantity: number;
  rate: number;
  special_note?: string | null;
}

export interface WorkEntryVersion {
  id: string;
  work_entry_id: string;
  revision_no: number;
  item_name: string;
  size: string;
  quantity: number;
  rate: number;
  total: number;
  special_note: string | null;
  recorded_at: string;
  changed_by: string | null;
}

export interface WorkerWorkTotals {
  daily_total: number;
  weekly_total: number;
  monthly_total: number;
  lifetime_total: number;
}
