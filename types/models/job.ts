import { EXULU_JOB_STATUS } from "@/util/enums/job-status";

export type Job = {
  id: string
  name: string
  agent: string
  status: EXULU_JOB_STATUS,
  result?: string
  type: "workflow" | "embedder"
  finished_at?: Date
  updatedAt: Date
  createdAt?: Date
};