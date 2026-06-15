/**
 * Row payload schema for the Users tab (access.md inventory #27, ladder #27).
 *
 * Colocated here (not under the legacy `users/data/` scaffolding the redesign
 * deleted — Phase 0.2 cleanup; the route owns its own colocated files per
 * codebase-structure §3.2). Kept in the redesign because the page-doc
 * explicitly lists zod validation as a defense-in-depth gate before
 * destructive row actions render — a malformed Apollo payload must not crash
 * the row OverflowMenu.
 *
 * Schema fixes per U20 (ladder #27):
 *  - `id` is now `z.string()` — GraphQL `ID` serializes as a string in
 *    Apollo (the legacy `z.number()` was a latent bug; same correction sibling
 *    models adopted in Phase 0). Coerced from number to keep accepting legacy
 *    callers without forcing a refactor at every call site.
 *  - The unused `roles` array (never displayed; never consumed) is dropped.
 *
 * The schema is intentionally PERMISSIVE on non-load-bearing fields; the
 * strict gate is only "id + email are present and look right". Failing rows
 * disable destructive actions instead of throwing.
 */

import { z } from "zod";

export const userRowSchema = z.object({
  // GraphQL `ID` is a string; Apollo serializes it as such (U20 fix).
  id: z.union([z.string(), z.number()]).transform((value) => String(value)),
  email: z.string().email(),
  emailVerified: z
    .union([z.string(), z.date(), z.boolean(), z.null()])
    .optional(),
});

export type UserRow = z.infer<typeof userRowSchema>;

/**
 * Best-effort parse: returns the validated row or `null`. Callers should
 * disable destructive actions when the row fails to parse rather than
 * throwing — defense-in-depth, not an availability gate.
 */
export function safeParseUserRow(input: unknown): UserRow | null {
  const result = userRowSchema.safeParse(input);
  return result.success ? result.data : null;
}
