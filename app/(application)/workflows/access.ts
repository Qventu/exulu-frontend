/**
 * Routine access derivation — work item 2.12.
 *
 * Centralizes the write-access logic that legacy `columns.tsx:805-817`
 * inlined in an IIFE. Fixes (workflows.md UX #10):
 * - `users` mode compared `u.id === user.id.toString()` (number-vs-string,
 *   likely always false). The new helper coerces both sides to strings.
 * - `teams` mode was never handled (read-only fallthrough). Now honored
 *   ONLY when ROUTINES_RBAC_TEAMS_SUPPORTED — otherwise teams entries are
 *   ignored (since the GraphQL selection never returned them).
 *
 * No mutations, no Apollo calls — pure function. Consumed by routine-row,
 * routine-panel, and the editor's read-only gate.
 */

import { ROUTINES_RBAC_TEAMS_SUPPORTED } from "./schema-flags";
import type { Routine, RoutineAccess } from "./types";

interface MinimalUser {
  id: number | string;
  role?: string | null;
  team?: string | null;
  super_admin?: boolean | null;
}

function stringEq(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

export function routineAccess(
  routine: Routine,
  user: MinimalUser | null | undefined,
): RoutineAccess {
  if (!user) {
    return { canRead: false, canWrite: false, canDelete: false, canRun: false };
  }

  // Super admins always have write.
  if (user.super_admin) {
    return { canRead: true, canWrite: true, canDelete: true, canRun: true };
  }

  // Owner always has write.
  if (stringEq(routine.created_by, user.id)) {
    return { canRead: true, canWrite: true, canDelete: true, canRun: true };
  }

  const mode = routine.rights_mode;
  let canRead = false;
  let canWrite = false;

  switch (mode) {
    case "private":
      canRead = false;
      canWrite = false;
      break;
    case "public":
      // Public = read for everyone; only the owner edits.
      canRead = true;
      canWrite = false;
      break;
    case "users": {
      const entry = routine.RBAC.users.find((u) => stringEq(u.id, user.id));
      canRead = !!entry;
      canWrite = entry?.rights === "write";
      break;
    }
    case "roles": {
      const entry = routine.RBAC.roles.find((r) => stringEq(r.id, user.role));
      canRead = !!entry;
      canWrite = entry?.rights === "write";
      break;
    }
    case "teams": {
      if (!ROUTINES_RBAC_TEAMS_SUPPORTED) {
        // Flag off: the GraphQL selection didn't return teams entries, so we
        // can't honor them. Read-only fallthrough (explicit, not silent).
        canRead = false;
        canWrite = false;
        break;
      }
      const entry = routine.RBAC.teams.find((t) => stringEq(t.id, user.team));
      canRead = !!entry;
      canWrite = entry?.rights === "write";
      break;
    }
    default:
      canRead = false;
      canWrite = false;
  }

  return {
    canRead,
    canWrite,
    canDelete: canWrite,
    canRun: canWrite,
  };
}
