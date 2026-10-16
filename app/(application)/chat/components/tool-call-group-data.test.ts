import type { DynamicToolUIPart } from "ai";
import { describe, expect, it } from "vitest";

import { getInputSummary, summarizeToolGroup } from "./tool-call-group-data";

const part = (overrides: Record<string, unknown>): DynamicToolUIPart =>
  ({
    type: "tool-jira_get_issue",
    toolCallId: "c1",
    state: "output-available",
    input: {},
    ...overrides,
  }) as unknown as DynamicToolUIPart;

const pending = (id: string, input: unknown = {}) =>
  part({ state: "approval-requested", approval: { id }, input, toolCallId: id });

const responded = (approved: boolean, state = "output-available") =>
  part({ state, approval: { id: "a", approved } });

describe("getInputSummary", () => {
  it("prefers well-known string keys over other fields", () => {
    expect(getInputSummary({ maxComments: 20, query: "project = X" })).toBe(
      "project = X",
    );
  });

  it("falls back to the first short string value", () => {
    expect(getInputSummary({ issueKey: "MEVAKIPI-1", includeComments: true })).toBe(
      "MEVAKIPI-1",
    );
  });

  it("ignores long strings in the fallback path", () => {
    expect(getInputSummary({ blob: "x".repeat(400) })).toBeNull();
  });

  it("returns null for non-objects and empty input", () => {
    expect(getInputSummary(null)).toBeNull();
    expect(getInputSummary("text")).toBeNull();
    expect(getInputSummary({})).toBeNull();
  });
});

describe("summarizeToolGroup", () => {
  it("collects pending approval ids in call order", () => {
    const s = summarizeToolGroup([pending("a1"), pending("a2"), pending("a3")]);
    expect(s.pendingApprovalIds).toEqual(["a1", "a2", "a3"]);
    expect(s.allPending).toBe(true);
    expect(s.state).toBe("approval-requested");
  });

  it("skips approval-requested members with no approval id", () => {
    const s = summarizeToolGroup([
      pending("a1"),
      part({ state: "approval-requested" }),
    ]);
    expect(s.pendingApprovalIds).toEqual(["a1"]);
    // Still "all pending" for the header: nothing has run.
    expect(s.allPending).toBe(true);
  });

  it("reports awaiting-approval while any member still needs a response", () => {
    const s = summarizeToolGroup([responded(true), pending("a2")]);
    expect(s.state).toBe("approval-requested");
    expect(s.allPending).toBe(false);
    expect(s.pendingApprovalIds).toEqual(["a2"]);
  });

  it("reports running when a member is mid-flight and none awaits approval", () => {
    const s = summarizeToolGroup([
      responded(true),
      part({ state: "input-available" }),
    ]);
    expect(s.state).toBe("input-available");
  });

  it("treats an approval-responded member as still running", () => {
    const s = summarizeToolGroup([part({ state: "approval-responded" })]);
    expect(s.state).toBe("input-available");
  });

  it("surfaces an error even when most members completed", () => {
    const s = summarizeToolGroup([
      part({ state: "output-available" }),
      part({ state: "output-error", errorText: "boom" }),
      part({ state: "output-available" }),
    ]);
    expect(s.state).toBe("output-error");
    expect(s.errorCount).toBe(1);
  });

  it("prefers error over denied in the aggregate state", () => {
    const s = summarizeToolGroup([
      part({ state: "output-denied" }),
      part({ state: "output-error" }),
    ]);
    expect(s.state).toBe("output-error");
    expect(s.deniedCount).toBe(1);
    expect(s.errorCount).toBe(1);
  });

  it("reports denied when every member was refused", () => {
    const s = summarizeToolGroup([
      part({ state: "output-denied" }),
      part({ state: "output-denied" }),
    ]);
    expect(s.state).toBe("output-denied");
    expect(s.deniedCount).toBe(2);
  });

  it("reports completed when every member succeeded", () => {
    const s = summarizeToolGroup([part({}), part({}), part({})]);
    expect(s.state).toBe("output-available");
    expect(s.errorCount).toBe(0);
    expect(s.deniedCount).toBe(0);
  });

  it("counts approved and denied approval responses", () => {
    const s = summarizeToolGroup([
      responded(true),
      responded(true),
      responded(false, "output-denied"),
    ]);
    expect(s.approvedCount).toBe(2);
    expect(s.deniedCount).toBe(1);
  });

  it("flags a member carrying an auth short-circuit payload", () => {
    const s = summarizeToolGroup([
      part({}),
      part({ output: { credentialRequest: { provider: "jira" } } }),
    ]);
    expect(s.hasAuthShortCircuit).toBe(true);
  });

  it("flags an oauth short-circuit payload", () => {
    const s = summarizeToolGroup([
      part({ output: { oauth: { authorizationUrl: "https://x" } } }),
    ]);
    expect(s.hasAuthShortCircuit).toBe(true);
  });

  it("does not flag auth for ordinary outputs", () => {
    expect(summarizeToolGroup([part({ output: { result: 1 } })]).hasAuthShortCircuit).toBe(
      false,
    );
  });

  it("summarizes the 20-call jira fan-out", () => {
    const parts = Array.from({ length: 20 }, (_, n) =>
      pending(`a${n}`, { issueKey: `MEVAKIPI-${n + 1}`, includeComments: true }),
    );
    const s = summarizeToolGroup(parts);
    expect(s.pendingApprovalIds).toHaveLength(20);
    expect(s.allPending).toBe(true);
    expect(s.inputSummaries.slice(0, 2)).toEqual(["MEVAKIPI-1", "MEVAKIPI-2"]);
    expect(s.inputSummaries).toHaveLength(20);
  });
});
