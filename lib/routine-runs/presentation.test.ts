// Unit tests for the pure runs-v2 presentation/query-shaping helpers.
// No React, no Apollo — vitest node environment.

import { describe, expect, it } from "vitest";

import {
  ALL_RUN_STATES,
  buildRoutineRunsVariables,
  canCancelRun,
  canDeleteRun,
  canRetryRun,
  DEFAULT_RUNS_FILTER,
  filteredReason,
  formatCompactTokens,
  formatRunCost,
  formatRunDuration,
  isTerminalRunState,
  KNOWN_FILTERED_REASONS,
  mapRunDot,
  needsAttention,
  NON_FILTERED_STATES,
  partitionSelection,
  RUN_STATE_BADGE,
  RUN_TRIGGERS,
  runTitle,
  triggerBadge,
} from "@/lib/routine-runs/presentation";

describe("state catalogue", () => {
  it("contains the three Plan-1 states on top of the legacy seven", () => {
    expect(ALL_RUN_STATES).toEqual([
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed",
      "paused",
      "stuck",
      "waiting_approval",
      "filtered",
      "cancelled",
    ]);
  });

  it("NON_FILTERED_STATES excludes exactly 'filtered'", () => {
    expect(NON_FILTERED_STATES).toEqual(
      ALL_RUN_STATES.filter((state) => state !== "filtered"),
    );
  });

  it("every state has a badge class", () => {
    for (const state of ALL_RUN_STATES) {
      expect(RUN_STATE_BADGE[state]).toBeTruthy();
    }
  });

  it("RUN_TRIGGERS matches the backend trigger enum", () => {
    expect(RUN_TRIGGERS).toEqual(["email", "schedule", "manual", "api"]);
  });

  it("KNOWN_FILTERED_REASONS matches the Plan-2 FilteredReason union", () => {
    expect(KNOWN_FILTERED_REASONS).toEqual([
      "sender_not_allowed",
      "filter",
      "rate_limited",
      "duplicate",
      "auto_reply",
    ]);
  });
});

describe("mapRunDot", () => {
  it("waiting_approval is a pulsing warning dot", () => {
    expect(mapRunDot("waiting_approval")).toEqual({
      status: "warning",
      pulse: true,
    });
  });
  it("filtered and cancelled are muted", () => {
    expect(mapRunDot("filtered")).toEqual({ status: "muted", pulse: false });
    expect(mapRunDot("cancelled")).toEqual({ status: "muted", pulse: false });
  });
  it("legacy states keep the RunsSection mapping", () => {
    expect(mapRunDot("completed")).toEqual({ status: "success", pulse: false });
    expect(mapRunDot("failed")).toEqual({ status: "error", pulse: false });
    expect(mapRunDot("active")).toEqual({ status: "info", pulse: true });
    expect(mapRunDot("waiting")).toEqual({ status: "info", pulse: false });
    expect(mapRunDot(undefined)).toEqual({ status: "muted", pulse: false });
  });
});

describe("action predicates", () => {
  it("cancel is allowed from waiting/active/waiting_approval only", () => {
    expect(canCancelRun("waiting")).toBe(true);
    expect(canCancelRun("active")).toBe(true);
    expect(canCancelRun("waiting_approval")).toBe(true);
    expect(canCancelRun("completed")).toBe(false);
    expect(canCancelRun("failed")).toBe(false);
    expect(canCancelRun("filtered")).toBe(false);
  });
  it("retry is allowed from failed/cancelled only", () => {
    expect(canRetryRun("failed")).toBe(true);
    expect(canRetryRun("cancelled")).toBe(true);
    expect(canRetryRun("waiting_approval")).toBe(false);
    expect(canRetryRun("completed")).toBe(false);
  });
  it("terminal states mirror TERMINAL_JOB_STATES from Plan 1", () => {
    expect(isTerminalRunState("completed")).toBe(true);
    expect(isTerminalRunState("failed")).toBe(true);
    expect(isTerminalRunState("filtered")).toBe(true);
    expect(isTerminalRunState("cancelled")).toBe(true);
    expect(isTerminalRunState("waiting_approval")).toBe(false);
    expect(isTerminalRunState("active")).toBe(false);
  });
  it("needsAttention is exactly waiting_approval", () => {
    expect(needsAttention("waiting_approval")).toBe(true);
    expect(needsAttention("failed")).toBe(false);
  });
});

describe("row presentation", () => {
  it("runTitle prefers the email subject, falls back to workflowName, then empty", () => {
    expect(
      runTitle({
        trigger_metadata: { subject: "Ersatzteil DX-9" },
        workflowName: "Spare parts",
      }),
    ).toBe("Ersatzteil DX-9");
    expect(
      runTitle({ trigger_metadata: {}, workflowName: "Spare parts" }),
    ).toBe("Spare parts");
    expect(runTitle({ trigger_metadata: { subject: "   " } })).toBe("");
  });

  it("triggerBadge carries the sender for email runs", () => {
    expect(
      triggerBadge({
        trigger: "email",
        trigger_metadata: { from: "service@kone.com" },
      }),
    ).toEqual({ key: "email", detail: "service@kone.com" });
    expect(triggerBadge({ trigger: "email" })).toEqual({ key: "email" });
    expect(triggerBadge({ trigger: "schedule" })).toEqual({ key: "schedule" });
    expect(triggerBadge({ trigger: "manual" })).toEqual({ key: "manual" });
    expect(triggerBadge({ trigger: "api" })).toEqual({ key: "api" });
    // Pre-migration rows: trigger NULL renders "—" (design §7.2).
    expect(triggerBadge({ trigger: null })).toEqual({ key: "none" });
    expect(triggerBadge({})).toEqual({ key: "none" });
  });

  it("filteredReason reads trigger_metadata.filtered_reason", () => {
    expect(
      filteredReason({ trigger_metadata: { filtered_reason: "auto_reply" } }),
    ).toBe("auto_reply");
    expect(filteredReason({ trigger_metadata: {} })).toBeUndefined();
    expect(filteredReason({})).toBeUndefined();
  });

  it("formatRunDuration renders only for terminal runs with sane timestamps", () => {
    const start = "2026-07-15T10:00:00.000Z";
    expect(
      formatRunDuration(start, "2026-07-15T10:00:03.000Z", "completed"),
    ).toBe("3s");
    expect(formatRunDuration(start, "2026-07-15T10:01:05.000Z", "failed")).toBe(
      "1m 5s",
    );
    expect(
      formatRunDuration(start, "2026-07-15T12:03:00.000Z", "cancelled"),
    ).toBe("2h 3m");
    expect(
      formatRunDuration(start, "2026-07-15T10:01:05.000Z", "active"),
    ).toBeNull();
    expect(
      formatRunDuration(undefined, "2026-07-15T10:01:05.000Z", "completed"),
    ).toBeNull();
    expect(
      formatRunDuration(start, "2026-07-15T09:00:00.000Z", "completed"),
    ).toBeNull();
  });
});

describe("buildRoutineRunsVariables", () => {
  it("default filter excludes filtered rows via an explicit states list", () => {
    expect(
      buildRoutineRunsVariables(DEFAULT_RUNS_FILTER, { limit: 20 }),
    ).toEqual({ page: 1, limit: 20, states: NON_FILTERED_STATES });
  });

  it("showFiltered drops the states restriction entirely", () => {
    expect(
      buildRoutineRunsVariables(
        { ...DEFAULT_RUNS_FILTER, showFiltered: true },
        { limit: 20 },
      ),
    ).toEqual({ page: 1, limit: 20 });
  });

  it("an explicit state wins over the showFiltered default", () => {
    expect(
      buildRoutineRunsVariables(
        { ...DEFAULT_RUNS_FILTER, state: "waiting_approval" },
        { limit: 20 },
      ),
    ).toEqual({ page: 1, limit: 20, states: ["waiting_approval"] });
  });

  it("passes workflow scope, trigger, needsAttention, trimmed search and page", () => {
    expect(
      buildRoutineRunsVariables(
        {
          ...DEFAULT_RUNS_FILTER,
          trigger: "email",
          needsAttention: true,
          search: "  kone  ",
          page: 3,
        },
        { workflow: "wf-1", limit: 50 },
      ),
    ).toEqual({
      page: 3,
      limit: 50,
      workflow: "wf-1",
      states: NON_FILTERED_STATES,
      triggers: ["email"],
      needsAttention: true,
      search: "kone",
    });
  });

  it("serializes datetime-local from/to values as ISO strings", () => {
    const vars = buildRoutineRunsVariables(
      {
        ...DEFAULT_RUNS_FILTER,
        from: "2026-07-01T00:00",
        to: "2026-07-15T12:30",
      },
      { limit: 20 },
    );
    // TZ-agnostic: the ISO string must round-trip to the same instant the
    // local datetime-local string denotes on this machine.
    expect(new Date(vars.from as string).getTime()).toBe(
      new Date("2026-07-01T00:00").getTime(),
    );
    expect(new Date(vars.to as string).getTime()).toBe(
      new Date("2026-07-15T12:30").getTime(),
    );
  });
});

describe("canDeleteRun", () => {
  it("is true for terminal states, false for live states", () => {
    for (const s of ["completed", "failed", "filtered", "cancelled"]) {
      expect(canDeleteRun(s)).toBe(true);
    }
    for (const s of ["waiting", "active", "waiting_approval"]) {
      expect(canDeleteRun(s)).toBe(false);
    }
  });
});

describe("partitionSelection", () => {
  const runs = [
    { id: "a", state: "active" },       // cancellable
    { id: "b", state: "completed" },    // deletable
    { id: "c", state: "waiting_approval" }, // cancellable
    { id: "d", state: "cancelled" },    // deletable
    { id: "e", state: "failed" },       // deletable, but not selected below
  ];
  it("splits the selection into cancellable and deletable id lists", () => {
    expect(
      partitionSelection(runs, new Set(["a", "b", "c", "d"])),
    ).toEqual({ cancellable: ["a", "c"], deletable: ["b", "d"] });
  });
  it("ignores ids not present in runs and returns empty lists for an empty selection", () => {
    expect(partitionSelection(runs, new Set(["zzz"]))).toEqual({
      cancellable: [],
      deletable: [],
    });
    expect(partitionSelection(runs, new Set())).toEqual({
      cancellable: [],
      deletable: [],
    });
  });
});

describe("formatCompactTokens", () => {
  it("renders — for null/undefined", () => {
    expect(formatCompactTokens(null)).toBe("—");
    expect(formatCompactTokens(undefined)).toBe("—");
  });
  it("renders raw integers below 1000", () => {
    expect(formatCompactTokens(0)).toBe("0");
    expect(formatCompactTokens(940)).toBe("940");
  });
  it("renders k for thousands, trimming .0", () => {
    expect(formatCompactTokens(5000)).toBe("5k");
    expect(formatCompactTokens(12340)).toBe("12.3k");
  });
  it("renders M for millions, trimming .0", () => {
    expect(formatCompactTokens(1_200_000)).toBe("1.2M");
    expect(formatCompactTokens(3_000_000)).toBe("3M");
  });
});

describe("formatRunCost", () => {
  it("renders — for null/undefined and $0 for zero", () => {
    expect(formatRunCost(null)).toBe("—");
    expect(formatRunCost(undefined)).toBe("—");
    expect(formatRunCost(0)).toBe("$0");
  });
  it("uses 2 decimals at or above $1", () => {
    expect(formatRunCost(1.5)).toBe("$1.50");
  });
  it("uses 3 decimals between 1 cent and $1", () => {
    expect(formatRunCost(0.021)).toBe("$0.021");
  });
  it("uses 4 decimals for sub-cent, flooring the tiniest to <$0.0001", () => {
    expect(formatRunCost(0.0004)).toBe("$0.0004");
    expect(formatRunCost(0.00001)).toBe("<$0.0001");
  });
});
