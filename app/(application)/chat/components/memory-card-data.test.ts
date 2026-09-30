import { describe, expect, it } from "vitest";
import {
  DECLINED_REASON, encodeMemoryDecision, groupRememberParts, isMemoryToolPart, memoryKind,
  memoryProposalFromPart, memoryResolvedState,
} from "./memory-card-data";

const part = (type: string, extra: Record<string, unknown> = {}) => ({ type, toolCallId: "c1", state: "approval-requested", ...extra }) as any;

describe("detection", () => {
  it("recognises the three memory tool part types only", () => {
    expect(isMemoryToolPart(part("tool-memory_remember"))).toBe(true);
    expect(memoryKind(part("tool-memory_update"))).toBe("update");
    expect(memoryKind(part("tool-memory_forget"))).toBe("forget");
    expect(isMemoryToolPart(part("tool-bash"))).toBe(false);
    expect(memoryKind(part("text"))).toBeNull();
  });
});

describe("encodeMemoryDecision", () => {
  it("produces versioned JSON the backend parser accepts, round-tripping special characters", () => {
    const d = { v: 1 as const, kind: "remember" as const, title: 'He said "no"', information: "a}\nb", type: "FACT", rights_mode: "private" as const };
    expect(JSON.parse(encodeMemoryDecision(d))).toEqual(d);
    expect(DECLINED_REASON).toBe("declined");
  });
});

describe("memoryProposalFromPart", () => {
  it("reads the remember proposal from the tool input", () => {
    const p = memoryProposalFromPart(part("tool-memory_remember", { input: { title: "T", information: "I", type: "FACT", whySaved: "why", visibility: "public" } }));
    expect(p).toEqual({ kind: "remember", title: "T", information: "I", type: "FACT", whySaved: "why", visibility: "public", memoryId: null });
  });
  it("reads update/forget proposals with the memory id", () => {
    expect(memoryProposalFromPart(part("tool-memory_update", { input: { memoryId: "m1", information: "new", reason: "r" } }))).toMatchObject({ kind: "update", memoryId: "m1", information: "new" });
    expect(memoryProposalFromPart(part("tool-memory_forget", { input: { memoryId: "m1", reason: "r" } }))).toMatchObject({ kind: "forget", memoryId: "m1" });
  });
  it("returns null for non-memory parts or missing input", () => {
    expect(memoryProposalFromPart(part("tool-bash", { input: {} }))).toBeNull();
    expect(memoryProposalFromPart(part("tool-memory_remember"))).toBeNull();
  });
});

describe("memoryResolvedState", () => {
  it("maps approval and output states to the resolved line", () => {
    expect(memoryResolvedState(part("tool-memory_remember", { state: "approval-requested", approval: { id: "a" } }))).toEqual({ status: "pending" });
    expect(memoryResolvedState(part("tool-memory_remember", { state: "approval-responded", approval: { id: "a", approved: false } }))).toEqual({ status: "declined" });
    expect(memoryResolvedState(part("tool-memory_remember", { state: "approval-responded", approval: { id: "a", approved: true } }))).toEqual({ status: "working" });
    expect(memoryResolvedState(part("tool-memory_remember", { state: "output-available", output: { type: "memory_saved", contextId: "mem", itemId: "m1", title: "T", rights_mode: "users" } })))
      .toEqual({ status: "saved", contextId: "mem", itemId: "m1", title: "T", rights_mode: "users" });
    expect(memoryResolvedState(part("tool-memory_update", { state: "output-available", output: { type: "memory_updated", contextId: "mem", itemId: "m1", title: "T", rights_mode: "private" } }))).toMatchObject({ status: "updated" });
    expect(memoryResolvedState(part("tool-memory_forget", { state: "output-available", output: { type: "memory_forgotten", contextId: "mem", itemId: "m1", title: "T" } }))).toMatchObject({ status: "forgotten" });
    expect(memoryResolvedState(part("tool-memory_update", { state: "output-available", output: { type: "memory_no_access", createdBy: { id: 9, name: "Sara" } } }))).toEqual({ status: "no_access", createdBy: { id: 9, name: "Sara" } });
    expect(memoryResolvedState(part("tool-memory_remember", { state: "output-available", output: { type: "memory_error", message: "boom" } }))).toEqual({ status: "error", message: "boom" });
    expect(memoryResolvedState(part("tool-memory_remember", { state: "output-error", errorText: "x" }))).toEqual({ status: "error", message: "x" });
  });
  it("maps memory_no_access without a creator to createdBy null", () => {
    expect(memoryResolvedState(part("tool-memory_update", { state: "output-available", output: { type: "memory_no_access", createdBy: null } }))).toEqual({ status: "no_access", createdBy: null });
    expect(memoryResolvedState(part("tool-memory_forget", { state: "output-available", output: { type: "memory_no_access" } }))).toEqual({ status: "no_access", createdBy: null });
  });
  it("surfaces memory_saved's optional warning when the RBAC grants failed post-create", () => {
    expect(memoryResolvedState(part("tool-memory_remember", { state: "output-available", output: { type: "memory_saved", contextId: "mem", itemId: "m1", title: "T", rights_mode: "users", warning: "rbac fail" } })))
      .toEqual({ status: "saved", contextId: "mem", itemId: "m1", title: "T", rights_mode: "users", warning: "rbac fail" });
    // No warning in the output → the field stays absent, not an empty string.
    expect(memoryResolvedState(part("tool-memory_remember", { state: "output-available", output: { type: "memory_saved", contextId: "mem", itemId: "m1", title: "T", rights_mode: "private" } })))
      .toEqual({ status: "saved", contextId: "mem", itemId: "m1", title: "T", rights_mode: "private" });
  });
});

describe("groupRememberParts", () => {
  it("stacks consecutive pending remember parts and leaves the rest single", () => {
    const parts = [
      part("text"),
      part("tool-memory_remember", { toolCallId: "a", approval: { id: "1" } }),
      part("tool-memory_remember", { toolCallId: "b", approval: { id: "2" } }),
      part("tool-memory_remember", { toolCallId: "c", state: "output-available", output: { type: "memory_saved" } }),
      part("tool-memory_update", { toolCallId: "d", approval: { id: "3" } }),
      part("tool-memory_remember", { toolCallId: "e", approval: { id: "4" } }),
    ];
    expect(groupRememberParts(parts)).toEqual([
      { kind: "stack", indices: [1, 2] },
      { kind: "single", index: 3 },
      { kind: "single", index: 4 },
      { kind: "single", index: 5 },
    ]);
  });
});
