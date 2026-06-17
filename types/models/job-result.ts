// OWNERSHIP (Phase 0, codebase-structure D6): hand-maintained GraphQL model types.
// This directory is the explicit type source until GraphQL codegen lands
// (lib/graphql/__generated__/, see codegen.ts); then features migrate to generated
// types per-feature and this file is deleted. Keep in sync with the backend schema.

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
