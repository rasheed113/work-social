export type WorkerDiaryEntryType = 'note' | 'todo' | 'idea' | 'journal' | 'anything';

export interface WorkerDiaryEntry {
  id: string;
  worker_profile_id: string;
  entry_type: WorkerDiaryEntryType;
  title: string | null;
  content: string;
  completed: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface WorkerDiaryEntryInput {
  entry_type: WorkerDiaryEntryType;
  title?: string | null;
  content: string;
  completed?: boolean | null;
}

export interface WorkerDiaryCursor {
  created_at: string;
  id: string;
}
