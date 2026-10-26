import { describe, expect, it } from "vitest";

import {
  expandUngroupableUnits,
  GROUPING_EXCLUDED_TOOL_TYPES,
  groupRenderUnits,
  traceRenderUnits,
  type RenderUnit,
} from "./message-renderer-tool-groups";

const tool = (type: string, overrides: Record<string, unknown> = {}) =>
  ({
    type,
    toolCallId: `call-${Math.random().toString(36).slice(2, 8)}`,
    state: "output-available",
    input: {},
    ...overrides,
  }) as any;

const stepStart = () => ({ type: "step-start" }) as any;
const text = (value: string) => ({ type: "text", text: value }) as any;

/** Shorthand for asserting the shape of a unit list. */
const shape = (units: RenderUnit[]) =>
  units.map((u) =>
    u.kind === "part"
      ? `part:${(u.part as any).type}`
      : u.kind === "tool-group"
        ? `group:${u.type}x${u.parts.length}`
        : `trace:${u.parts.length}`,
  );

describe("groupRenderUnits", () => {
  it("returns single parts untouched", () => {
    const parts = [stepStart(), text("hi"), tool("tool-jira_get_issue")];
    expect(shape(groupRenderUnits(parts))).toEqual([
      "part:step-start",
      "part:text",
      "part:tool-jira_get_issue",
    ]);
  });

  it("preserves the original part index so renderer keys stay stable", () => {
    const parts = [stepStart(), text("hi"), tool("tool-a")];
    const units = groupRenderUnits(parts);
    expect(units.map((u) => (u.kind === "part" ? u.index : u.startIndex))).toEqual([0, 1, 2]);
  });

  it("collapses a run of identical consecutive tool parts", () => {
    const parts = [
      stepStart(),
      tool("tool-jira_get_issue"),
      tool("tool-jira_get_issue"),
      tool("tool-jira_get_issue"),
    ];
    expect(shape(groupRenderUnits(parts))).toEqual([
      "part:step-start",
      "group:tool-jira_get_issuex3",
    ]);
  });

  it("carries every part of the run, in order, into the group", () => {
    const a = tool("tool-jira_get_issue", { input: { issueKey: "A-1" } });
    const b = tool("tool-jira_get_issue", { input: { issueKey: "A-2" } });
    const units = groupRenderUnits([a, b]);
    expect(units).toHaveLength(1);
    const group = units[0];
    if (group.kind !== "tool-group") throw new Error("expected a group");
    expect(group.parts).toEqual([a, b]);
    expect(group.startIndex).toBe(0);
  });

  it("does not group a run of two different tool types", () => {
    const parts = [tool("tool-jira_get_issue"), tool("tool-jira_search_issues")];
    expect(shape(groupRenderUnits(parts))).toEqual([
      "part:tool-jira_get_issue",
      "part:tool-jira_search_issues",
    ]);
  });

  it("does not group across a step boundary", () => {
    const parts = [
      stepStart(),
      tool("tool-bash"),
      stepStart(),
      tool("tool-bash"),
    ];
    expect(shape(groupRenderUnits(parts))).toEqual([
      "part:step-start",
      "part:tool-bash",
      "part:step-start",
      "part:tool-bash",
    ]);
  });

  it("does not group across an interleaved text part", () => {
    const parts = [tool("tool-bash"), text("thinking"), tool("tool-bash")];
    expect(shape(groupRenderUnits(parts))).toEqual([
      "part:tool-bash",
      "part:text",
      "part:tool-bash",
    ]);
  });

  it("groups two separate runs of the same tool independently", () => {
    const parts = [
      tool("tool-a"),
      tool("tool-a"),
      text("between"),
      tool("tool-a"),
      tool("tool-a"),
      tool("tool-a"),
    ];
    expect(shape(groupRenderUnits(parts))).toEqual([
      "group:tool-ax2",
      "part:text",
      "group:tool-ax3",
    ]);
  });

  it.each(GROUPING_EXCLUDED_TOOL_TYPES)(
    "never groups %s (it has a bespoke renderer)",
    (excluded) => {
      const parts = [tool(excluded), tool(excluded), tool(excluded)];
      expect(shape(groupRenderUnits(parts))).toEqual([
        `part:${excluded}`,
        `part:${excluded}`,
        `part:${excluded}`,
      ]);
    },
  );

  // The it.each above is driven BY the list, so it cannot notice an entry
  // that is missing from it. These three are named outright because losing
  // them is silent and costly: tool-memory_* parts render as MemoryCard,
  // which replaces the generic approval card on purpose — the card is the
  // consent, with no "Allow for this chat". Grouped, a memory write would get
  // that button back, and consecutive pending `memory_remember` parts would
  // also lose their shared "Save all" stack.
  it.each(["tool-memory_remember", "tool-memory_update", "tool-memory_forget"])(
    "keeps %s out of grouping, so MemoryCard stays the consent surface",
    (type) => {
      expect(GROUPING_EXCLUDED_TOOL_TYPES).toContain(type);
      expect(shape(groupRenderUnits([tool(type), tool(type)]))).toEqual([
        `part:${type}`,
        `part:${type}`,
      ]);
    },
  );

  it("never groups context_search tools regardless of prefix", () => {
    const parts = [
      tool("tool-agentic_context_search"),
      tool("tool-agentic_context_search"),
    ];
    expect(shape(groupRenderUnits(parts))).toEqual([
      "part:tool-agentic_context_search",
      "part:tool-agentic_context_search",
    ]);
  });

  it("matches excluded types case-insensitively", () => {
    const parts = [tool("tool-TODO_WRITE"), tool("tool-TODO_WRITE")];
    expect(shape(groupRenderUnits(parts))).toEqual([
      "part:tool-TODO_WRITE",
      "part:tool-TODO_WRITE",
    ]);
  });

  it("never groups non-tool parts of the same type", () => {
    const parts = [text("one"), text("two"), text("three")];
    expect(shape(groupRenderUnits(parts))).toEqual([
      "part:text",
      "part:text",
      "part:text",
    ]);
  });

  it("does not group dynamic-tool parts, whose type says nothing about the tool", () => {
    const parts = [tool("dynamic-tool"), tool("dynamic-tool")];
    expect(shape(groupRenderUnits(parts))).toEqual([
      "part:dynamic-tool",
      "part:dynamic-tool",
    ]);
  });

  it("groups regardless of the members' states (approval and terminal alike)", () => {
    const parts = [
      tool("tool-a", { state: "approval-requested" }),
      tool("tool-a", { state: "approval-requested" }),
    ];
    const units = groupRenderUnits(parts);
    expect(units).toHaveLength(1);
    expect(units[0].kind).toBe("tool-group");
  });

  it("handles an empty or nullish part list", () => {
    expect(groupRenderUnits([])).toEqual([]);
    expect(groupRenderUnits(undefined)).toEqual([]);
  });

  it("returns a stable result for the 20-call jira fan-out (session 131113e2)", () => {
    const parts = [
      stepStart(),
      ...Array.from({ length: 20 }, (_, n) =>
        tool("tool-jira_get_issue", { input: { issueKey: `MEVAKIPI-${n + 1}` } }),
      ),
      stepStart(),
      tool("tool-writeFile"),
      stepStart(),
      tool("tool-bash"),
      stepStart(),
      tool("tool-bash"),
      stepStart(),
      text("Ich habe alle 20 Jira-Tickets …"),
    ];
    expect(shape(groupRenderUnits(parts))).toEqual([
      "part:step-start",
      "group:tool-jira_get_issuex20",
      "part:step-start",
      "part:tool-writeFile",
      "part:step-start",
      "part:tool-bash",
      "part:step-start",
      "part:tool-bash",
      "part:step-start",
      "part:text",
    ]);
  });
});

describe("expandUngroupableUnits", () => {
  const groupOf = (n: number, type = "tool-a"): RenderUnit[] =>
    groupRenderUnits(Array.from({ length: n }, () => tool(type)));

  it("keeps a group whose every member is groupable", () => {
    const units = expandUngroupableUnits(groupOf(3), () => true);
    expect(shape(units)).toEqual(["group:tool-ax3"]);
  });

  it("expands a group back to individual parts when one member is not", () => {
    const units = expandUngroupableUnits(groupOf(3), (_part, index) => index !== 1);
    expect(shape(units)).toEqual(["part:tool-a", "part:tool-a", "part:tool-a"]);
  });

  it("restores each expanded part's original index", () => {
    const parts = [stepStart(), tool("tool-a"), tool("tool-a"), text("end")];
    const units = expandUngroupableUnits(groupRenderUnits(parts), () => false);
    expect(units.map((u) => (u.kind === "part" ? u.index : u.startIndex))).toEqual([
      0, 1, 2, 3,
    ]);
  });

  it("passes the part's absolute index to the predicate, not its offset", () => {
    const parts = [stepStart(), stepStart(), tool("tool-a"), tool("tool-a")];
    const seen: number[] = [];
    expandUngroupableUnits(groupRenderUnits(parts), (_part, index) => {
      seen.push(index);
      return true;
    });
    expect(seen).toEqual([2, 3]);
  });

  it("leaves non-group units alone without consulting the predicate", () => {
    const parts = [stepStart(), text("hi"), tool("tool-a")];
    const units = expandUngroupableUnits(groupRenderUnits(parts), () => {
      throw new Error("predicate must not run for single parts");
    });
    expect(shape(units)).toEqual(["part:step-start", "part:text", "part:tool-a"]);
  });

  it("short-circuits: stops asking once a member fails", () => {
    let calls = 0;
    expandUngroupableUnits(groupOf(10), () => {
      calls += 1;
      return false;
    });
    expect(calls).toBe(1);
  });

  it("expands every group independently", () => {
    const parts = [
      tool("tool-a"),
      tool("tool-a"),
      text("between"),
      tool("tool-b"),
      tool("tool-b"),
    ];
    const units = expandUngroupableUnits(
      groupRenderUnits(parts),
      (part) => (part as any).type !== "tool-b",
    );
    expect(shape(units)).toEqual([
      "group:tool-ax2",
      "part:text",
      "part:tool-b",
      "part:tool-b",
    ]);
  });
});

/**
 * The sequential case: an agent loop calls one tool per step — Bash, then a
 * Hubspot list, then Bash again, then four Hubspot reads — and every call is
 * its own step, so the same-type grouping above never fires and the user
 * scrolls past eight stacked "Completed" cards before the answer.
 */
describe("traceRenderUnits", () => {
  const anyPart = () => true;
  const trace = (parts: any[], isGroupable: (part: any, index: number) => boolean = anyPart) =>
    traceRenderUnits(groupRenderUnits(parts), isGroupable);

  it("merges consecutive calls of different tools across step boundaries into one trace", () => {
    const parts = [
      stepStart(),
      tool("tool-bash"),
      stepStart(),
      tool("tool-hubspot_list_tools"),
      stepStart(),
      tool("tool-hubspot_read"),
      stepStart(),
      tool("tool-hubspot_read"),
    ];
    const units = trace(parts);
    expect(shape(units)).toEqual(["trace:4"]);
    const unit = units[0] as Extract<RenderUnit, { kind: "tool-trace" }>;
    expect(unit.parts.map((p: any) => p.type)).toEqual([
      "tool-bash",
      "tool-hubspot_list_tools",
      "tool-hubspot_read",
      "tool-hubspot_read",
    ]);
    expect(unit.startIndex).toBe(0);
    expect(unit.endIndex).toBe(7);
  });

  it("leaves a lone tool call exactly as it was", () => {
    const parts = [stepStart(), tool("tool-bash"), text("done")];
    expect(shape(trace(parts))).toEqual(["part:step-start", "part:tool-bash", "part:text"]);
  });

  it("ends the run at a text part and starts a new one after it", () => {
    const parts = [tool("tool-a"), tool("tool-b"), text("so far"), tool("tool-c"), tool("tool-d")];
    expect(shape(trace(parts))).toEqual(["trace:2", "part:text", "trace:2"]);
  });

  it("ends the run at a reasoning part so the reasoning stays visible in place", () => {
    const reasoning = { type: "reasoning", text: "thinking" } as any;
    const parts = [tool("tool-a"), reasoning, tool("tool-b"), tool("tool-c")];
    expect(shape(trace(parts))).toEqual(["part:tool-a", "part:reasoning", "trace:2"]);
  });

  it("flattens a same-type parallel group into the trace's calls", () => {
    const parts = [tool("tool-a"), tool("tool-a"), tool("tool-a"), stepStart(), tool("tool-b")];
    const units = trace(parts);
    expect(shape(units)).toEqual(["trace:4"]);
  });

  it("keeps a pending approval out of the trace and splits around it", () => {
    const parts = [
      tool("tool-a"),
      tool("tool-b", { state: "approval-requested", approval: { id: "ap-1" } }),
      tool("tool-c"),
      tool("tool-d"),
    ];
    expect(shape(trace(parts))).toEqual(["part:tool-a", "part:tool-b", "trace:2"]);
  });

  it("never absorbs a tool with a bespoke renderer", () => {
    const parts = [tool("tool-a"), tool("tool-memory_remember"), tool("tool-b")];
    expect(shape(trace(parts))).toEqual(["part:tool-a", "part:tool-memory_remember", "part:tool-b"]);
  });

  it("respects the caller's output-shape check, splitting around the member that fails it", () => {
    const image = tool("tool-image_generation");
    const parts = [tool("tool-a"), tool("tool-b"), image, tool("tool-c")];
    const units = trace(parts, (part) => part !== image);
    expect(shape(units)).toEqual(["trace:2", "part:tool-image_generation", "part:tool-c"]);
  });

  it("includes dynamic-tool parts, which the same-type grouping cannot", () => {
    const parts = [tool("dynamic-tool", { toolName: "bash" }), tool("tool-a")];
    expect(shape(trace(parts))).toEqual(["trace:2"]);
  });

  it("passes non-tool units through untouched", () => {
    const parts = [text("hi"), stepStart(), { type: "file", url: "x" } as any];
    expect(shape(trace(parts))).toEqual(["part:text", "part:step-start", "part:file"]);
  });
});
