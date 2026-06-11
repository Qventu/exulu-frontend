// OWNERSHIP (Phase 0, codebase-structure D6): hand-maintained GraphQL model types.
// This directory is the explicit type source until GraphQL codegen lands
// (lib/graphql/__generated__/, see codegen.ts); then features migrate to generated
// types per-feature and this file is deleted. Keep in sync with the backend schema.

import { BullMqJobData } from "./bullmq";

export type QueueJob = {
  name: string;
  id: string;
  returnvalue?: any;
  stacktrace?: string[];
  finishedOn?: number;
  processedOn?: number;
  attemptsMade?: number;
  failedReason?: string;
  state: string;
  data?: BullMqJobData;
  timestamp: number;
};