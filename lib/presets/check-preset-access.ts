// RBAC write predicate for context presets, mirroring
// lib/prompts/check-prompt-access.ts. Pure module: no React, no framework
// imports (same pattern as lib/rights.ts) so it stays unit-testable.

import type { ContextPreset } from "@/types/models/context-preset";
import { sameEntityId } from "@/lib/same-entity-id";

/** Minimal user shape (UserContext's user satisfies it structurally). */
export interface PresetAccessUser {
  id: number;
  super_admin: boolean;
  role?: { id: string } | null;
}

export function checkPresetWriteAccess(
  preset: Pick<ContextPreset, "created_by" | "rights_mode" | "RBAC">,
  user: PresetAccessUser,
): boolean {
  if (user.super_admin) return true;

  // sameEntityId rather than ===: RBAC subject ids are `ID!` in the SDL and
  // deserialise to strings, while users.id is `Float` and arrives as a number.
  // Which side is which depends on the query, so compare tolerantly throughout.
  if (sameEntityId(preset.created_by, user.id)) return true;

  switch (preset.rights_mode) {
    case "public":
      return true;
    case "users":
      return (
        preset.RBAC?.users?.find((u) => sameEntityId(u.id, user.id))?.rights ===
        "write"
      );
    case "roles":
      return (
        preset.RBAC?.roles?.find((r) => sameEntityId(r.id, user.role?.id))
          ?.rights === "write"
      );
    // "teams" membership is not resolvable client-side (CONTEXT_PRESET_FIELDS
    // does not fetch teams); "private"/undefined are creator-only.
    default:
      return false;
  }
}
