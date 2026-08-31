export type WorkerDiaryEntryType = 'note' | 'todo' | 'idea' | 'journal' | 'anything' | 'event';
export type WorkerDiaryCalendarSystem =
  | 'gregory' | 'islamic' | 'islamic-umalqura' | 'islamic-civil' | 'islamic-tbla'
  | 'persian' | 'hebrew' | 'buddhist' | 'indian' | 'japanese' | 'chinese'
  | 'coptic' | 'ethiopic' | 'ethiopic-amete-alem' | 'roc' | 'dangi';
export type WorkerDiaryReminderMode = 'at_time' | 'before_event' | 'custom';
export type WorkerDiaryReminderStatus = 'pending' | 'processing' | 'sent' | 'cancelled' | 'failed';

export interface WorkerDiaryEntry {
  id: string;
  worker_profile_id: string;
  entry_type: WorkerDiaryEntryType;
  title: string | null;
  content: string;
  completed: boolean | null;
  event_start_at: string | null;
  event_end_at: string | null;
  event_timezone: string | null;
  created_at: string;
  updated_at: string;
  reminder: WorkerDiaryReminder | null;
}

export interface WorkerDiaryEntryInput {
  entry_type: WorkerDiaryEntryType;
  title?: string | null;
  content: string;
  completed?: boolean | null;
  event_start_at?: string | null;
  event_end_at?: string | null;
  event_timezone?: string | null;
  reminder?: WorkerDiaryReminderInput | null;
}

export interface WorkerDiaryReminder {
  id: string;
  diary_entry_id: string;
  worker_profile_id: string;
  reminder_kind: 'todo' | 'event';
  enabled: boolean;
  scheduled_at: string;
  timezone: string;
  reminder_mode: WorkerDiaryReminderMode;
  offset_minutes: number | null;
  status: WorkerDiaryReminderStatus;
  sent_at: string | null;
}

export interface WorkerDiaryReminderInput {
  enabled: boolean;
  scheduled_at: string;
  timezone: string;
  reminder_mode: WorkerDiaryReminderMode;
  offset_minutes?: number | null;
}

export interface WorkerDiaryPreferences {
  worker_profile_id: string;
  calendar_system: WorkerDiaryCalendarSystem;
  timezone: string;
  notifications_enabled: boolean;
  todo_reminders_enabled: boolean;
  event_reminders_enabled: boolean;
}

export interface WorkerDiaryPushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  expiration_time?: string | null;
}

export interface WorkerDiaryCursor {
  created_at: string;
  id: string;
}
