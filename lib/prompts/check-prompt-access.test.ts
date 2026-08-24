// Regression tests for the RBAC id-type defect (see lib/same-entity-id.ts).
//
// Every membership case is run twice — once with string ids and once with
// numbers — because which type the API returns depends on the query, and the
// predicate must not care.

import { describe, expect, it } from "vitest";

import {
  checkPromptReadAccess,
  checkPromptWriteAccess,
} from "@/lib/prompts/check-prompt-access";
import type { PromptLibrary } from "@/types/models/prompt-library";
import type { UserWithRole } from "@/types/models/user";

const ROLE_ID = "11111111-1111-1111-1111-111111111111";

function user(id: number, opts: { superAdmin?: boolean; roleId?: string } = {}) {
  return {
    id,
    email: `user-${id}@open.de`,
    super_admin: opts.superAdmin ?? false,
    role: { id: opts.roleId ?? ROLE_ID, name: "member" },
  } as unknown as UserWithRole;
}

function prompt(overrides: Record<string, unknown> = {}) {
  return {
    id: "prompt-1",
    created_by: 22,
    rights_mode: "private",
    RBAC: { users: [], roles: [] },
    ...overrides,
  } as unknown as PromptLibrary;
}

/** The same id expressed both ways — the API may hand back either. */
const BOTH_ID_TYPES: Array<[string, string | number]> = [
  ["string ids", "29"],
  ["number ids", 29],
];

describe("checkPromptWriteAccess", () => {
  describe.each(BOTH_ID_TYPES)("with %s", (_label, id) => {
    it("grants a user shared with write", () => {
      const p = prompt({
        created_by: 999,
        rights_mode: "users",
        RBAC: { users: [{ id, rights: "write" }] },
      });

      expect(checkPromptWriteAccess(p, user(29))).toBe(true);
    });

    it("denies a user shared with read only", () => {
      const p = prompt({
        created_by: 999,
        rights_mode: "users",
        RBAC: { users: [{ id, rights: "read" }] },
      });

      expect(checkPromptWriteAccess(p, user(29))).toBe(false);
    });
  });

  it("grants the creator when created_by is a number", () => {
    const p = prompt({ created_by: 22, rights_mode: "private" });
    expect(checkPromptWriteAccess(p, user(22))).toBe(true);
  });

  it("grants the creator when created_by is a string", () => {
    const p = prompt({ created_by: "22", rights_mode: "private" });
    expect(checkPromptWriteAccess(p, user(22))).toBe(true);
  });

  it("keeps the creator's write access after sharing with users", () => {
    // The regression: the users branch used to overwrite the creator's grant.
    const p = prompt({
      created_by: 22,
      rights_mode: "users",
      RBAC: { users: [{ id: "100", rights: "read" }] },
    });

    expect(checkPromptWriteAccess(p, user(22))).toBe(true);
  });

  it("denies a stranger in users mode", () => {
    const p = prompt({
      created_by: 999,
      rights_mode: "users",
      RBAC: { users: [{ id: "29", rights: "write" }] },
    });

    expect(checkPromptWriteAccess(p, user(77))).toBe(false);
  });

  it("denies a non-creator on a private prompt", () => {
    expect(checkPromptWriteAccess(prompt({ created_by: 999 }), user(29))).toBe(false);
  });

  it("grants everyone on a public prompt", () => {
    const p = prompt({ created_by: 999, rights_mode: "public" });
    expect(checkPromptWriteAccess(p, user(29))).toBe(true);
  });

  it("grants super admins", () => {
    const p = prompt({ created_by: 999, rights_mode: "users", RBAC: { users: [] } });
    expect(checkPromptWriteAccess(p, user(29, { superAdmin: true }))).toBe(true);
  });

  it("grants a role holding write, denies one holding read", () => {
    const write = prompt({
      created_by: 999,
      rights_mode: "roles",
      RBAC: { roles: [{ id: ROLE_ID, rights: "write" }] },
    });
    const read = prompt({
      created_by: 999,
      rights_mode: "roles",
      RBAC: { roles: [{ id: ROLE_ID, rights: "read" }] },
    });

    expect(checkPromptWriteAccess(write, user(29))).toBe(true);
    expect(checkPromptWriteAccess(read, user(29))).toBe(false);
  });

  it("does not confuse id 2 with id 22", () => {
    const p = prompt({
      created_by: 999,
      rights_mode: "users",
      RBAC: { users: [{ id: "22", rights: "write" }] },
    });

    expect(checkPromptWriteAccess(p, user(2))).toBe(false);
  });
});

describe("checkPromptReadAccess", () => {
  describe.each(BOTH_ID_TYPES)("with %s", (_label, id) => {
    it("grants a user shared with read", () => {
      const p = prompt({
        created_by: 999,
        rights_mode: "users",
        RBAC: { users: [{ id, rights: "read" }] },
      });

      expect(checkPromptReadAccess(p, user(29))).toBe(true);
    });

    it("grants a user shared with write", () => {
      const p = prompt({
        created_by: 999,
        rights_mode: "users",
        RBAC: { users: [{ id, rights: "write" }] },
      });

      expect(checkPromptReadAccess(p, user(29))).toBe(true);
    });
  });

  it("denies a stranger in users mode", () => {
    const p = prompt({
      created_by: 999,
      rights_mode: "users",
      RBAC: { users: [{ id: "29", rights: "read" }] },
    });

    expect(checkPromptReadAccess(p, user(77))).toBe(false);
  });

  it("grants the creator on a private prompt, denies everyone else", () => {
    const p = prompt({ created_by: 22, rights_mode: "private" });
    expect(checkPromptReadAccess(p, user(22))).toBe(true);
    expect(checkPromptReadAccess(p, user(29))).toBe(false);
  });

  it("grants a matching role", () => {
    const p = prompt({
      created_by: 999,
      rights_mode: "roles",
      RBAC: { roles: [{ id: ROLE_ID, rights: "read" }] },
    });

    expect(checkPromptReadAccess(p, user(29))).toBe(true);
    expect(checkPromptReadAccess(p, user(29, { roleId: "other-role" }))).toBe(false);
  });
});
