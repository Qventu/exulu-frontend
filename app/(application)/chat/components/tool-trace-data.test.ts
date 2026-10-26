import { describe, expect, it } from "vitest";

import { formatToolName, summarizeToolTrace } from "./tool-trace-data";

const call = (type: string, overrides: Record<string, unknown> = {}) =>
  ({
    type,
    toolCallId: `call-${Math.random().toString(36).slice(2, 8)}`,
    state: "output-available",
    input: {},
    ...overrides,
  }) as any;

describe("formatToolName", () => {
  it("strips the tool- prefix, spaces underscores and capitalizes", () => {
    expect(formatToolName(call("tool-hubspot_list_tools"))).toBe(
      "Hubspot list tools",
    );
  });

  it("names a dynamic-tool part by its toolName", () => {
    expect(formatToolName(call("dynamic-tool", { toolName: "bash_run" }))).toBe(
      "Bash run",
    );
  });
});

describe("summarizeToolTrace", () => {
  it("collapses consecutive calls of the same tool into one step with a count", () => {
    const summary = summarizeToolTrace([
      call("tool-bash"),
      call("tool-hubspot_list_tools"),
      call("tool-bash"),
      call("tool-hubspot_list_tools"),
      call("tool-hubspot_read"),
      call("tool-hubspot_read"),
      call("tool-hubspot_read"),
      call("tool-hubspot_read"),
    ]);
    expect(summary.sequence.map((s) => s.name)).toEqual([
      "Bash",
      "Hubspot list tools",
      "Bash",
      "Hubspot list tools",
      "Hubspot read",
    ]);
    expect(summary.sequence.map((s) => s.count)).toEqual([1, 1, 1, 1, 4]);
    expect(summary.state).toBe("output-available");
    expect(summary.errorCount).toBe(0);
  });

  it("gives a step the worst state of its calls and counts the failures", () => {
    const summary = summarizeToolTrace([
      call("tool-hubspot_read"),
      call("tool-hubspot_read", { state: "output-error", errorText: "429" }),
    ]);
    expect(summary.sequence).toHaveLength(1);
    expect(summary.sequence[0].state).toBe("output-error");
    expect(summary.errorCount).toBe(1);
    expect(summary.state).toBe("output-error");
  });

  it("reports a running trace while the last call has no output yet", () => {
    const summary = summarizeToolTrace([
      call("tool-bash"),
      call("tool-hubspot_read", { state: "input-available" }),
    ]);
    expect(summary.state).toBe("input-available");
    expect(summary.sequence[1].state).toBe("input-available");
  });
});
