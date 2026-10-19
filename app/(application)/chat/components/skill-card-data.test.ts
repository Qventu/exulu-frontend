import { describe, expect, it } from "vitest";

import { agentSkillRefs, canEditAgent, encodeSkillDecision, isSkillToolPart, skillProposalFromPart, skillResolvedState } from "./skill-card-data";

describe("skillProposalFromPart", () => {
  it("reads a create proposal with file sizes", () => {
    const p = skillProposalFromPart({ type: "tool-skill_create", input: { name: "n", description: "d", files: [{ path: "SKILL.md", content: "abcd" }] } });
    expect(p).toEqual({ kind: "create", name: "n", description: "d", files: [{ path: "SKILL.md", bytes: 4 }], deletePaths: [], label: "" });
  });
  it("reads an update proposal: the referenced skill, removals and label", () => {
    const p = skillProposalFromPart({ type: "tool-skill_update", input: { skill: "report", files: [], deletePaths: ["a.md", 3], label: "v2" } });
    expect(p?.name).toBe("report");
    expect(p?.deletePaths).toEqual(["a.md"]);
    expect(p?.label).toBe("v2");
  });
  it("ignores other tools", () => {
    expect(skillProposalFromPart({ type: "tool-skill_list", input: {} })).toBeNull();
    expect(isSkillToolPart({ type: "tool-memory_remember" })).toBe(false);
  });
});

describe("skillResolvedState", () => {
  it("maps the part's lifecycle", () => {
    expect(skillResolvedState({ state: "approval-requested" })).toEqual({ status: "pending" });
    expect(skillResolvedState({ state: "approval-responded", approval: { approved: true } })).toEqual({ status: "working" });
    expect(skillResolvedState({ state: "approval-responded", approval: { approved: false } })).toEqual({ status: "declined" });
    expect(skillResolvedState({ state: "output-available", output: { type: "skill_created", skillId: "s1", name: "N", version: 1, rights_mode: "users", enableOnAgent: true } })).toEqual({
      status: "created",
      skillId: "s1",
      name: "N",
      version: 1,
      rights_mode: "users",
      enableOnAgent: true,
    });
    expect(skillResolvedState({ state: "output-available", output: { type: "skill_no_access", skill: "x" } })).toEqual({ status: "no_access", skill: "x" });
    expect(skillResolvedState({ state: "output-available", output: { type: "skill_error", result: "boom" } })).toEqual({ status: "error", message: "boom" });
  });
});

describe("agentSkillRefs / canEditAgent / encodeSkillDecision", () => {
  it("parses a stringified skills column and drops entries without an id", () => {
    expect(agentSkillRefs({ skills: JSON.stringify([{ id: "a", name: "A" }, { name: "no id" }]) } as any)).toEqual([{ id: "a", name: "A" }]);
    expect(agentSkillRefs({ skills: "{bad" } as any)).toEqual([]);
  });
  it("grants edit to admins, creators, public agents and write grants only", () => {
    const user = { id: 7, super_admin: false, role: { id: "r1" }, team: { id: "t1" } };
    expect(canEditAgent({ rights_mode: "private" }, { ...user, super_admin: true })).toBe(true);
    expect(canEditAgent({ rights_mode: "private", created_by: 7 }, user)).toBe(true);
    expect(canEditAgent({ rights_mode: "public" }, user)).toBe(true);
    expect(canEditAgent({ rights_mode: "users", RBAC: { users: [{ id: 7, rights: "read" }] } }, user)).toBe(false);
    expect(canEditAgent({ rights_mode: "roles", RBAC: { roles: [{ id: "r1", rights: "write" }] } }, user)).toBe(true);
    expect(canEditAgent({ rights_mode: "teams", RBAC: { teams: [{ id: "t2", rights: "write" }] } }, user)).toBe(false);
    expect(canEditAgent({ rights_mode: "private", created_by: 8 }, user)).toBe(false);
    expect(canEditAgent({ rights_mode: "public" }, null)).toBe(false);
  });
  it("encodes a decision as JSON the backend parser accepts", () => {
    expect(JSON.parse(encodeSkillDecision({ v: 1, kind: "create", name: "n", description: "d", rights_mode: "private", enableOnAgent: true }))).toMatchObject({ v: 1, kind: "create", rights_mode: "private" });
  });
});
