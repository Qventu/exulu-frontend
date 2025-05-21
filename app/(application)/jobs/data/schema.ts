import { z } from "zod";

export const jobSchema = z.object({
  id: z.string(),
  metadata: z.any(),
  name: z.string(),
  type: z.string().optional().nullable(),
  context: z.string().optional().nullable(),
  task_args: z.any(),
  createdAt: z.string(),
  date_started: z.string().optional().nullable(),
  status: z.string(),
  item: z.string().optional().nullable(),
  result: z.string().optional().nullable(),
  traceback: z.any(),
  date_done: z.any()
});

export type Job = z.infer<typeof jobSchema>;
