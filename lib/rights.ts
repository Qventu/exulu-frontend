// Shared RBAC predicates, extracted from the buildNavigation logic in
// components/shell/main-nav.tsx (codebase-structure §4 Wave 0 #7).
//
// This is the single source of truth for "who can see what" — consumed today by
// the sidebar, and in Phase 1 by the shell (nav-config/route guards/command
// palette) and the Home dashboard's RBAC widgets, so nav and Home never disagree
// (navigation.md §3, pages/dashboard.md).
//
// Pure module: no JSX, no React, no framework imports.

import type { UserRole } from "@/types/models/user-role";

/** Role areas that carry a read/write right (the gateable keys of UserRole). */
export type RightArea =
  | "agents"
  | "workflows"
  | "variables"
  | "users"
  | "api"
  | "evals"
  | "budget_management";

export type RightLevel = "read" | "write";

/** The minimal user shape the predicates need (UserContext's user satisfies it). */
export interface RightsUser {
  super_admin: boolean;
  role?: UserRole | null;
}

/**
 * Declarative requirement, matching navigation.md §1.2 notation:
 * - "all"          → every authenticated user
 * - "super_admin"  → SA only
 * - "elevated"     → SA or any non-null role right
 * - { area, level: "write" } → SA || role.area === "write"        (role.x:w)
 * - { area, level: "read" }  → SA || role.area ∈ {read, write}    (role.x:r+)
 */
export type Requirement =
  | "all"
  | "super_admin"
  | "elevated"
  | { area: RightArea; level: RightLevel };

/**
 * The role areas that make an account "elevated" (navigation.md §1.2).
 * Exported for consumers that need to iterate the rights matrix (tests,
 * Home's RBAC widgets).
 */
export const RIGHT_AREAS: readonly RightArea[] = [
  "agents",
  "workflows",
  "variables",
  "users",
  "api",
  "evals",
  "budget_management",
];

/**
 * True when the role grants at least `level` on `area`.
 * "read" is satisfied by read OR write; "write" only by write.
 * No super-admin bypass here — use `can()` for user-level checks.
 */
export function hasRight(
  role: UserRole | null | undefined,
  area: RightArea,
  level: RightLevel
): boolean {
  const granted = role?.[area];
  if (level === "write") return granted === "write";
  return granted === "read" || granted === "write";
}

/** SA or any non-null role right (navigation.md "elevated"). */
export function isElevated(user: RightsUser): boolean {
  if (user.super_admin) return true;
  return RIGHT_AREAS.some((area) => hasRight(user.role, area, "read"));
}

/** The one predicate every surface (nav, guards, palette, Home) consumes. */
export function can(user: RightsUser, requirement: Requirement): boolean {
  if (requirement === "all") return true;
  if (requirement === "super_admin") return user.super_admin;
  if (requirement === "elevated") return isElevated(user);
  return (
    user.super_admin || hasRight(user.role, requirement.area, requirement.level)
  );
}
