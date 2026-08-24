// Unit tests for the preset RBAC write predicate, mirroring the semantics of
// lib/prompts/check-prompt-access.ts (creator/admin always; public → write;
// users/roles → explicit "write" entry; teams unresolvable client-side → false).

import { describe, expect, it } from "vitest";

import {
  checkPresetWriteAccess,
  type PresetAccessUser,
} from "@/lib/presets/check-preset-access";
import type { ContextPreset } from "@/types/models/context-preset";

const owner: PresetAccessUser = { id: 1, super_admin: false, role: { id: "role-a" } };
const admin: PresetAccessUser = { id: 2, super_admin: true, role: null };
const other: PresetAccessUser = { id: 3, super_admin: false, role: { id: "role-b" } };

function preset(
  overrides: Partial<Pick<ContextPreset, "created_by" | "rights_mode" | "RBAC">>,
): Pick<ContextPreset, "created_by" | "rights_mode" | "RBAC"> {
  return { created_by: 1, rights_mode: "private", ...overrides };
}

describe("checkPresetWriteAccess", () => {
  it("creator always has write access", () => {
    expect(checkPresetWriteAccess(preset({}), owner)).toBe(true);
  });

  it("super_admin always has write access", () => {
    expect(checkPresetWriteAccess(preset({}), admin)).toBe(true);
  });

  it("private: non-creator non-admin has no write access", () => {
    expect(checkPresetWriteAccess(preset({}), other)).toBe(false);
  });

  it("public: everyone has write access", () => {
    expect(checkPresetWriteAccess(preset({ rights_mode: "public" }), other)).toBe(true);
  });

  it("users: write entry grants access, read entry does not", () => {
    const withWrite = preset({
      rights_mode: "users",
      RBAC: { users: [{ id: 3, rights: "write" }] },
    });
    const withRead = preset({
      rights_mode: "users",
      RBAC: { users: [{ id: 3, rights: "read" }] },
    });
    expect(checkPresetWriteAccess(withWrite, other)).toBe(true);
    expect(checkPresetWriteAccess(withRead, other)).toBe(false);
  });

  it("users: no entry for the user means no write access", () => {
    const p = preset({
      rights_mode: "users",
      RBAC: { users: [{ id: 99, rights: "write" }] },
    });
    expect(checkPresetWriteAccess(p, other)).toBe(false);
  });

  it("roles: write entry for the user's role grants access, read does not", () => {
    const withWrite = preset({
      rights_mode: "roles",
      RBAC: { roles: [{ id: "role-b", rights: "write" }] },
    });
    const withRead = preset({
      rights_mode: "roles",
      RBAC: { roles: [{ id: "role-b", rights: "read" }] },
    });
    expect(checkPresetWriteAccess(withWrite, other)).toBe(true);
    expect(checkPresetWriteAccess(withRead, other)).toBe(false);
  });

  it("roles: user without a role has no write access", () => {
    const p = preset({
      rights_mode: "roles",
      RBAC: { roles: [{ id: "role-b", rights: "write" }] },
    });
    expect(checkPresetWriteAccess(p, { id: 3, super_admin: false, role: null })).toBe(false);
  });

  it("teams: not resolvable client-side, no write access", () => {
    const p = preset({
      rights_mode: "teams",
      RBAC: { teams: [{ id: "team-1", rights: "write" }] },
    });
    expect(checkPresetWriteAccess(p, other)).toBe(false);
  });

  it("missing rights_mode: no write access for non-creator", () => {
    expect(checkPresetWriteAccess(preset({ rights_mode: undefined }), other)).toBe(false);
  });
});

// The cases above all use numeric ids, which is the assumption that hid the
// 2026-08-24 lockout: RBAC subject ids are `ID!` in the SDL and deserialise to
// strings, while user.id is a number. Which type arrives depends on the query,
// so the predicate has to tolerate both. See lib/same-entity-id.ts.
describe("checkPresetWriteAccess — id type tolerance", () => {
  it("users: a string id in the RBAC list matches a numeric user.id", () => {
    const p = preset({
      rights_mode: "users",
      RBAC: { users: [{ id: "3" as unknown as number, rights: "write" }] },
    });
    expect(checkPresetWriteAccess(p, other)).toBe(true);
  });

  it("users: a string read entry is still read-only", () => {
    const p = preset({
      rights_mode: "users",
      RBAC: { users: [{ id: "3" as unknown as number, rights: "read" }] },
    });
    expect(checkPresetWriteAccess(p, other)).toBe(false);
  });

  it("users: a string id for a different user still denies", () => {
    const p = preset({
      rights_mode: "users",
      RBAC: { users: [{ id: "99" as unknown as number, rights: "write" }] },
    });
    expect(checkPresetWriteAccess(p, other)).toBe(false);
  });

  it("creator: a string created_by matches a numeric user.id", () => {
    const p = preset({ created_by: "1" as unknown as number });
    expect(checkPresetWriteAccess(p, owner)).toBe(true);
  });

  it("does not confuse id 3 with id 33", () => {
    const p = preset({
      created_by: 999,
      rights_mode: "users",
      RBAC: { users: [{ id: "33" as unknown as number, rights: "write" }] },
    });
    expect(checkPresetWriteAccess(p, other)).toBe(false);
  });
});
