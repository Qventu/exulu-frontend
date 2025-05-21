import { z } from "zod";

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  emailVerified: z.string().nullable().optional(),
  roles: z
    .array(
      z.object({
        id: z.string(),
        role: z.string(),
      }),
    )
    .nullable()
    .optional(),
});

export type User = z.infer<typeof userSchema>;
