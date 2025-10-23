import { BullMqJobData } from "./bullmq";

export type QueueJob = {
  name: string;
  id: string;
  returnvalue?: any;
  stacktrace?: string[];
  failedReason?: string;
  state: string;
  data?: BullMqJobData;
  timestamp: number;
};