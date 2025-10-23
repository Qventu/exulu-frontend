export type JobStatus = "completed" | "failed" | "delayed" | "active" | "waiting" | "paused" | "stuck";

export interface JobResult {
  id: string;
  job_id: string;
  state: JobStatus;
  error?: any;
  label: string;
  result?: any;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}
