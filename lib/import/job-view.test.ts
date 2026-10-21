import { describe, expect, it } from "vitest";

import {
  STATE_BADGE,
  errorReportFileName,
  toImportJobView,
} from "@/lib/import/job-view";
import type { ImportJobRow, ImportJobState } from "@/lib/import/job-view";

const baseRow: ImportJobRow = {
  id: "job-1",
  label: "orders.csv",
  state: "waiting",
  createdAt: "2026-10-21T10:00:00.000Z",
};

describe("toImportJobView", () => {
  it("normalises metadata given as a JSON string the same as an object", () => {
    const counters = {
      total: 200,
      processed: 50,
      created: 40,
      updated: 10,
      failed: 0,
      invalid: 0,
    };
    const asString = toImportJobView({
      ...baseRow,
      state: "active",
      metadata: JSON.stringify(counters),
    });
    const asObject = toImportJobView({
      ...baseRow,
      state: "active",
      metadata: counters,
    });
    expect(asString).toEqual(asObject);
    expect(asObject.counters).toEqual(counters);
  });

  it("normalises result and trigger_metadata given as JSON strings", () => {
    const result = { errorReportKey: "bucket/key.csv", durationMs: 1234 };
    const triggerMetadata = { fileName: "parsed-from-string.csv" };
    const view = toImportJobView({
      ...baseRow,
      state: "completed",
      result: JSON.stringify(result),
      trigger_metadata: JSON.stringify(triggerMetadata),
    });
    expect(view.errorReportKey).toBe("bucket/key.csv");
    expect(view.durationMs).toBe(1234);
    expect(view.fileName).toBe("parsed-from-string.csv");
  });

  it("computes progress as a rounded percentage while active", () => {
    const view = toImportJobView({
      ...baseRow,
      state: "active",
      metadata: { processed: 50, total: 200 },
    });
    expect(view.progress).toBe(25);
    expect(view.isRunning).toBe(true);
    expect(view.state).toBe("active");
  });

  it("progress is null when total is absent or zero", () => {
    expect(
      toImportJobView({ ...baseRow, state: "waiting" }).progress,
    ).toBeNull();
    expect(
      toImportJobView({
        ...baseRow,
        state: "active",
        metadata: { processed: 0, total: 0 },
      }).progress,
    ).toBeNull();
  });

  it("isRunning is true for waiting and active, false otherwise", () => {
    expect(toImportJobView({ ...baseRow, state: "waiting" }).isRunning).toBe(
      true,
    );
    expect(toImportJobView({ ...baseRow, state: "active" }).isRunning).toBe(
      true,
    );
    for (const state of ["completed", "failed", "cancelled", "bogus"]) {
      expect(toImportJobView({ ...baseRow, state }).isRunning).toBe(false);
    }
  });

  it("maps unknown backend states to 'other'", () => {
    const view = toImportJobView({ ...baseRow, state: "some-future-state" });
    expect(view.state).toBe("other");
  });

  it("can retry a completed job with an error report key", () => {
    const view = toImportJobView({
      ...baseRow,
      state: "completed",
      result: { errorReportKey: "bucket/errors.csv" },
    });
    expect(view.errorReportKey).toBe("bucket/errors.csv");
    expect(view.canRetry).toBe(true);
  });

  it("cannot retry a cancelled job with no error report key", () => {
    const view = toImportJobView({ ...baseRow, state: "cancelled" });
    expect(view.errorReportKey).toBeNull();
    expect(view.canRetry).toBe(false);
  });

  it("cannot retry while still running even if an error report key is already set", () => {
    const view = toImportJobView({
      ...baseRow,
      state: "active",
      metadata: { errorReportKey: "bucket/partial.csv" },
    });
    expect(view.canRetry).toBe(false);
  });

  it("fileName reads trigger_metadata.fileName, falling back to label", () => {
    const withFileName = toImportJobView({
      ...baseRow,
      trigger_metadata: { fileName: "upload.csv" },
    });
    expect(withFileName.fileName).toBe("upload.csv");

    const withoutFileName = toImportJobView({ ...baseRow });
    expect(withoutFileName.fileName).toBe(baseRow.label);
  });

  it("startedBy reads trigger_metadata.user.id from a user snapshot object", () => {
    const view = toImportJobView({
      ...baseRow,
      trigger_metadata: {
        user: { id: 42, super_admin: false, role: "editor", team: "ops" },
      },
    });
    expect(view.startedBy).toBe(42);
  });

  it("startedBy tolerates a bare number instead of a user snapshot object", () => {
    const view = toImportJobView({
      ...baseRow,
      trigger_metadata: { user: 7 },
    });
    expect(view.startedBy).toBe(7);
  });

  it("startedBy is null when no user is present", () => {
    expect(toImportJobView({ ...baseRow }).startedBy).toBeNull();
  });

  it("errorReportKey falls back from result to metadata", () => {
    const fromResult = toImportJobView({
      ...baseRow,
      state: "completed",
      result: { errorReportKey: "bucket/from-result.csv" },
      metadata: { errorReportKey: "bucket/from-metadata.csv" },
    });
    expect(fromResult.errorReportKey).toBe("bucket/from-result.csv");

    const fromMetadata = toImportJobView({
      ...baseRow,
      state: "completed",
      metadata: { errorReportKey: "bucket/from-metadata.csv" },
    });
    expect(fromMetadata.errorReportKey).toBe("bucket/from-metadata.csv");

    const neither = toImportJobView({ ...baseRow, state: "completed" });
    expect(neither.errorReportKey).toBeNull();
  });

  it("durationMs reads result.durationMs", () => {
    const view = toImportJobView({
      ...baseRow,
      state: "completed",
      result: { durationMs: 98765 },
    });
    expect(view.durationMs).toBe(98765);
    expect(toImportJobView({ ...baseRow }).durationMs).toBeNull();
  });

  it("counters default to zero and total to null when nothing is reported", () => {
    const view = toImportJobView({ ...baseRow });
    expect(view.counters).toEqual({
      total: null,
      processed: 0,
      created: 0,
      updated: 0,
      failed: 0,
      invalid: 0,
    });
  });

  it("counters prefer result over metadata per field", () => {
    const view = toImportJobView({
      ...baseRow,
      state: "completed",
      metadata: { processed: 50, total: 200, created: 40 },
      result: { processed: 200, created: 180, updated: 10, failed: 5, invalid: 5 },
    });
    expect(view.counters).toEqual({
      total: 200,
      processed: 200,
      created: 180,
      updated: 10,
      failed: 5,
      invalid: 5,
    });
  });

  it("error surfaces the message of a JSON-serialised error object", () => {
    const view = toImportJobView({
      ...baseRow,
      state: "failed",
      error: JSON.stringify({
        message: "NO_MAPPABLE_COLUMNS",
        stack: "...",
      }),
    });
    expect(view.error).toBe("NO_MAPPABLE_COLUMNS");
  });

  it("error passes through a raw non-JSON string as-is", () => {
    const view = toImportJobView({
      ...baseRow,
      state: "failed",
      error: "IMPORT_RESTARTED_AFTER_STALL",
    });
    expect(view.error).toBe("IMPORT_RESTARTED_AFTER_STALL");
  });

  it("error is null when the row carries none", () => {
    expect(toImportJobView({ ...baseRow }).error).toBeNull();
  });

  it("maps trigger_metadata.access to the access the run was started with", () => {
    // A retry must re-import with THIS access, not whatever the wizard
    // happens to default to after being reopened.
    const view = toImportJobView({
      ...baseRow,
      state: "completed",
      trigger_metadata: JSON.stringify({
        fileName: "orders.csv",
        access: {
          rights_mode: "roles",
          users: [],
          roles: [{ id: "role-1", rights: "read" }],
          teams: [],
        },
      }),
    });
    expect(view.access).toEqual({
      rights_mode: "roles",
      users: [],
      roles: [{ id: "role-1", rights: "read" }],
      teams: [],
    });
  });

  it("defaults the access grant lists to arrays and tolerates an object column", () => {
    const view = toImportJobView({
      ...baseRow,
      trigger_metadata: { access: { rights_mode: "public", users: null } },
    });
    expect(view.access).toEqual({
      rights_mode: "public",
      users: [],
      roles: [],
      teams: [],
    });
  });

  it("has no access when the row carries none, or an unknown rights mode", () => {
    expect(toImportJobView({ ...baseRow }).access).toBeNull();
    expect(
      toImportJobView({
        ...baseRow,
        trigger_metadata: { access: { rights_mode: "everyone" } },
      }).access,
    ).toBeNull();
  });
});

describe("errorReportFileName", () => {
  it("names the report after the imported file", () => {
    expect(errorReportFileName("orders.csv")).toBe("orders-errors.csv");
    expect(errorReportFileName("ORDERS.CSV")).toBe("ORDERS-errors.csv");
    expect(errorReportFileName("orders")).toBe("orders-errors.csv");
  });
});

describe("STATE_BADGE", () => {
  it("has a badge variant for every job state", () => {
    const states: ImportJobState[] = [
      "waiting",
      "active",
      "completed",
      "failed",
      "cancelled",
      "other",
    ];
    for (const state of states) {
      expect(STATE_BADGE[state]).toBeTruthy();
    }
  });
});
