// Unit tests for the shared RBAC predicate (navigation.md §1.2 notation).
// The single-right matrix here is the "cheap insurance" navigation.md §7
// asks for: every Requirement form is exercised against minimal accounts.

import { describe, expect, it } from "vitest";

import {
  can,
  hasRight,
  isElevated,
  RIGHT_AREAS,
  type RightArea,
  type RightsUser,
} from "@/lib/rights";
import type { UserRole } from "@/types/models/user-role";

const emptyRole: UserRole = {
  id: "role-1",
  name: "test-role",
  agents: null,
  workflows: null,
  variables: null,
  users: null,
  api: null,
  evals: null,
  budget_management: null,
};

function roleWith(rights: Partial<Record<RightArea, "read" | "write">>): UserRole {
  return { ...emptyRole, ...rights };
}

function userWith(
  rights: Partial<Record<RightArea, "read" | "write">> = {},
  superAdmin = false,
): RightsUser {
  return { super_admin: superAdmin, role: roleWith(rights) };
}

const superAdmin: RightsUser = { super_admin: true, role: emptyRole };
const p1User: RightsUser = userWith(); // authenticated, zero role rights
const roleless: RightsUser = { super_admin: false, role: null };

describe("hasRight", () => {
  it("grants read for read or write, but write only for write", () => {
    expect(hasRight(roleWith({ agents: "read" }), "agents", "read")).toBe(true);
    expect(hasRight(roleWith({ agents: "write" }), "agents", "read")).toBe(true);
    expect(hasRight(roleWith({ agents: "write" }), "agents", "write")).toBe(true);
    expect(hasRight(roleWith({ agents: "read" }), "agents", "write")).toBe(false);
  });

  it("denies on null rights, missing roles, and other areas", () => {
    expect(hasRight(roleWith({}), "agents", "read")).toBe(false);
    expect(hasRight(null, "agents", "read")).toBe(false);
    expect(hasRight(undefined, "agents", "read")).toBe(false);
    expect(hasRight(roleWith({ workflows: "write" }), "agents", "read")).toBe(false);
  });

  it("has no super-admin bypass (that lives in can())", () => {
    expect(hasRight(emptyRole, "agents", "read")).toBe(false);
  });
});

describe("isElevated", () => {
  it("is true for super admins regardless of role", () => {
    expect(isElevated(superAdmin)).toBe(true);
    expect(isElevated({ super_admin: true, role: null })).toBe(true);
  });

  it("is false for P1-only accounts (no role / all-null role)", () => {
    expect(isElevated(p1User)).toBe(false);
    expect(isElevated(roleless)).toBe(false);
  });

  it.each(RIGHT_AREAS)(
    "is true with a single non-null right: %s",
    (area) => {
      expect(isElevated(userWith({ [area]: "read" }))).toBe(true);
      expect(isElevated(userWith({ [area]: "write" }))).toBe(true);
    },
  );
});

describe("can", () => {
  it('"all" admits every authenticated account', () => {
    expect(can(p1User, "all")).toBe(true);
    expect(can(roleless, "all")).toBe(true);
    expect(can(superAdmin, "all")).toBe(true);
  });

  it('"super_admin" admits only super admins', () => {
    expect(can(superAdmin, "super_admin")).toBe(true);
    expect(can(p1User, "super_admin")).toBe(false);
    expect(can(userWith({ users: "write" }), "super_admin")).toBe(false);
  });

  it('"elevated" mirrors isElevated', () => {
    expect(can(superAdmin, "elevated")).toBe(true);
    expect(can(userWith({ budget_management: "read" }), "elevated")).toBe(true);
    expect(can(p1User, "elevated")).toBe(false);
  });

  it("area requirements: role.x:r+ is satisfied by read or write", () => {
    const req = { area: "evals", level: "read" } as const;
    expect(can(userWith({ evals: "read" }), req)).toBe(true);
    expect(can(userWith({ evals: "write" }), req)).toBe(true);
    expect(can(userWith({ agents: "write" }), req)).toBe(false);
    expect(can(p1User, req)).toBe(false);
  });

  it("area requirements: role.x:w demands write", () => {
    const req = { area: "users", level: "write" } as const;
    expect(can(userWith({ users: "write" }), req)).toBe(true);
    expect(can(userWith({ users: "read" }), req)).toBe(false);
  });

  it("area requirements: SA bypasses the role check (SA || role.x)", () => {
    expect(can(superAdmin, { area: "api", level: "write" })).toBe(true);
    expect(can({ super_admin: true, role: null }, { area: "api", level: "write" })).toBe(true);
  });
});
