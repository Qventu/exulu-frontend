// Regression tests for the chat read-only lockout reported 2026-08-24.
//
// Two production sessions (both owned by user 22, rights_mode "users") each
// proved a *separate* defect, so both are reproduced verbatim below:
//
//   60487ff9-…  creator absent from his own RBAC list  -> needed creator override
//   37a16085-…  creator present with rights "write"    -> needed id normalisation
//
// The id normalisation matters beyond the creator: RBACUser.id is GraphQL `ID!`
// (string at runtime) while users.id is `Float` (number), so `u.id === user.id`
// was false for *every* shared user, locking out everyone but super-admins.

import { describe, expect, it } from "vitest";

import { checkChatSessionWriteAccess } from "@/lib/check-chat-session-write-access";
import type { AgentSession } from "@/types/models/agent-session";
import type { UserWithRole } from "@/types/models/user";

const ROLE = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "member",
  agents: "read",
  workflows: "read",
  evals: "read",
  variables: "read",
  users: "read",
} as const;

/** users.id is GraphQL Float -> a JS number in the browser. */
function user(id: number, opts: { superAdmin?: boolean; roleId?: string } = {}) {
  return {
    id,
    email: `user-${id}@open.de`,
    super_admin: opts.superAdmin ?? false,
    role: { ...ROLE, id: opts.roleId ?? ROLE.id },
  } as unknown as UserWithRole;
}

/**
 * RBACUser.id is GraphQL `ID!` -> a JS **string** in the browser, even though
 * the hand-written model type claims `number`. Fixtures use strings on purpose:
 * that discrepancy is the bug.
 */
function session(overrides: Partial<AgentSession> = {}) {
  return {
    id: "session-1",
    created_by: 22,
    rights_mode: "private",
    RBAC: { users: [], roles: [] },
    ...overrides,
  } as unknown as AgentSession;
}

describe("checkChatSessionWriteAccess", () => {
  describe("production regressions", () => {
    it("grants the creator write access to a chat he shared with others (session 60487ff9)", () => {
      // Robert (22) owns the session; only tina.stotz (100) holds an RBAC row.
      const s = session({
        created_by: 22,
        rights_mode: "users",
        RBAC: { users: [{ id: "100", rights: "write" }] },
      } as Partial<AgentSession>);

      expect(checkChatSessionWriteAccess(s, user(22))).toBe(true);
    });

    it("grants a creator who also holds an explicit write row (session 37a16085)", () => {
      const s = session({
        created_by: 22,
        rights_mode: "users",
        RBAC: {
          users: [
            { id: "29", rights: "write" },
            { id: "16", rights: "write" },
            { id: "22", rights: "write" },
            { id: "58", rights: "write" },
          ],
        },
      } as Partial<AgentSession>);

      expect(checkChatSessionWriteAccess(s, user(22))).toBe(true);
    });

    it("grants a non-creator shared with write despite the string/number id split", () => {
      // michael.moeckel (29) on session 37a16085 — not the creator, so this
      // passes only once the ids are compared as strings.
      const s = session({
        created_by: 22,
        rights_mode: "users",
        RBAC: { users: [{ id: "29", rights: "write" }] },
      } as Partial<AgentSession>);

      expect(checkChatSessionWriteAccess(s, user(29))).toBe(true);
    });
  });

  describe("users mode", () => {
    it("denies a non-creator shared with read only", () => {
      const s = session({
        rights_mode: "users",
        RBAC: { users: [{ id: "29", rights: "read" }] },
      } as Partial<AgentSession>);

      expect(checkChatSessionWriteAccess(s, user(29))).toBe(false);
    });

    it("denies a non-creator absent from the list", () => {
      const s = session({
        rights_mode: "users",
        RBAC: { users: [{ id: "29", rights: "write" }] },
      } as Partial<AgentSession>);

      expect(checkChatSessionWriteAccess(s, user(77))).toBe(false);
    });

    it("does not confuse id 2 with id 22", () => {
      const s = session({
        created_by: 999,
        rights_mode: "users",
        RBAC: { users: [{ id: "22", rights: "write" }] },
      } as Partial<AgentSession>);

      expect(checkChatSessionWriteAccess(s, user(2))).toBe(false);
    });
  });

  describe("roles mode", () => {
    it("grants a role holding write", () => {
      const s = session({
        created_by: 999,
        rights_mode: "roles",
        RBAC: { roles: [{ id: ROLE.id, rights: "write" }] },
      } as Partial<AgentSession>);

      expect(checkChatSessionWriteAccess(s, user(29))).toBe(true);
    });

    it("denies a role holding read", () => {
      const s = session({
        created_by: 999,
        rights_mode: "roles",
        RBAC: { roles: [{ id: ROLE.id, rights: "read" }] },
      } as Partial<AgentSession>);

      expect(checkChatSessionWriteAccess(s, user(29))).toBe(false);
    });

    it("grants the creator even when their role only holds read", () => {
      // Mirrors the backend: validateWriteAccess returns early for the creator
      // before any rbac lookup (graphql/mutations/index.ts:282-288).
      const s = session({
        created_by: 22,
        rights_mode: "roles",
        RBAC: { roles: [{ id: ROLE.id, rights: "read" }] },
      } as Partial<AgentSession>);

      expect(checkChatSessionWriteAccess(s, user(22))).toBe(true);
    });
  });

  describe("private and public modes", () => {
    it("grants the creator in private mode", () => {
      expect(checkChatSessionWriteAccess(session({ created_by: 22 }), user(22))).toBe(true);
    });

    it("denies a non-creator in private mode", () => {
      expect(checkChatSessionWriteAccess(session({ created_by: 22 }), user(29))).toBe(false);
    });

    it("grants anyone in public mode", () => {
      const s = session({ created_by: 999, rights_mode: "public" } as Partial<AgentSession>);
      expect(checkChatSessionWriteAccess(s, user(29))).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("grants super admins regardless of mode", () => {
      const s = session({
        created_by: 999,
        rights_mode: "users",
        RBAC: { users: [] },
      } as Partial<AgentSession>);

      expect(checkChatSessionWriteAccess(s, user(29, { superAdmin: true }))).toBe(true);
    });

    it("does not treat a null created_by as a creator match", () => {
      const s = session({
        created_by: null,
        rights_mode: "users",
        RBAC: { users: [] },
      } as unknown as Partial<AgentSession>);

      expect(checkChatSessionWriteAccess(s, user(29))).toBe(false);
    });

    it("tolerates a missing RBAC block in users mode", () => {
      const s = session({
        created_by: 999,
        rights_mode: "users",
        RBAC: undefined,
      } as unknown as Partial<AgentSession>);

      expect(checkChatSessionWriteAccess(s, user(29))).toBe(false);
    });
  });
});
