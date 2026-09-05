export interface WorkerProfile {
  id: string;
  profile_id: string;
  work_id: string;
  work_role: 'worker';
  worker_type: 'salary_person' | 'contract';
  work_description: string | null;
  skills: string[];
  created_at: string;
  updated_at: string;
}

export interface WorkerProfileUpdateInput {
  work_description: string;
  skills: string[];
}
