/**
 * Route-local domain types for the redesigned /skills surface (work item 2.10).
 *
 * Re-exports the canonical `Skill` shape (mirrors `@/types/models/skill`) so
 * route-local code never reaches into legacy `types/`. Both owners (library +
 * ide) import from this file. The legacy module stays in place because
 * `hooks/use-skills.tsx` still consumes it (parallel-protocol rule 3 — back-
 * compat surface for any out-of-tree consumer).
 *
 * `hasSkillWriteAccess` is the single canonical owner/super-admin check for
 * read-only degradation (skills.md inventory item #67). It matches the legacy
 * `hasWriteAccess` predicate (skills/page.tsx:556-558) so the redesign does not
 * change who-can-write semantics. Users granted write via `RBAC.users` /
 * `RBAC.roles` are still surfaced read-only — that gap is documented in
 * skills.md "Risks" as a backend-enforced trust point.
 */

export type SkillRightsMode = "private" | "users" | "roles" | "teams" | "public";

export interface SkillRBACEntry {
  id: string | number;
  rights: "read" | "write";
}

export interface SkillRBAC {
  type?: string;
  users?: SkillRBACEntry[];
  roles?: SkillRBACEntry[];
  teams?: SkillRBACEntry[];
}

export interface SkillHistoryEntry {
  version: number;
  label?: string;
  created_at: string;
}

export interface Skill {
  id: string;
  name: string;
  description?: string | null;
  s3folder?: string | null;
  tags?: string[] | null;
  usage_count?: number | null;
  favorite_count?: number | null;
  current_version?: number | null;
  history?: SkillHistoryEntry[] | null;
  rights_mode?: SkillRightsMode | null;
  created_by?: string | null;
  createdAt: string;
  updatedAt: string;
  RBAC?: SkillRBAC | null;
}

export interface SkillFileNode {
  type: "file" | "folder";
  name: string;
  path: string;
  key: string;
  children?: SkillFileNode[];
}

export interface SkillFilesResponse {
  tree: SkillFileNode;
  fileCount: number;
  version: number;
}

export interface CurrentUserLike {
  id?: number | string | null;
  super_admin?: boolean | null;
}

/**
 * Owner-or-super-admin write predicate. Matches the legacy check so the
 * redesign does not change who-can-write semantics (see file JSDoc).
 */
export function hasSkillWriteAccess(
  skill: Pick<Skill, "created_by"> | null | undefined,
  user: CurrentUserLike | null | undefined,
): boolean {
  if (!user) return false;
  if (user.super_admin === true) return true;
  if (!skill?.created_by) return false;
  const uid = user.id;
  if (uid === null || uid === undefined) return false;
  return skill.created_by === String(uid);
}
