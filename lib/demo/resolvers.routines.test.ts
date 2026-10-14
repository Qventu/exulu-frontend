import { describe, expect, it } from "vitest";

import { GET_JOB_RESULTS } from "@/app/(application)/workflows/queries";
import { demoDateOffsetMs, shiftTimestamp } from "./date-shift";
import { ALGI_ROUTINE, ALGI_RUNS } from "./fixtures/chapter-email";
import { runDemoOperation } from "./test-support";

describe("the routine row's last run", () => {
  // useLastRunForPage asks job_results for the newest row whose label
  // contains the routine id. The row read "Noch nie ausgeführt" above 25
  // runs because the resolver only knew the evals' labels.
  it("is the newest ALGI run", async () => {
    const data = await runDemoOperation(
      GET_JOB_RESULTS,
      { page: 1, limit: 1, filters: [{ label: { contains: ALGI_ROUTINE.id } }], sort: { field: "createdAt", direction: "DESC" } },
      { chapter: "email", step: 0 },
    );
    const items = (data.job_resultsPagination as { items: { state: string; createdAt: string }[] }).items;
    const newest = [...ALGI_RUNS].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    expect(items).toHaveLength(1);
    expect(items[0].state).toBe(newest.state);
    // The link shifts every timestamp to stay recent (date-shift.ts), so the
    // row's createdAt is the run's createdAt plus today's offset.
    const expected = Date.parse(shiftTimestamp(newest.createdAt, 0)) + demoDateOffsetMs();
    expect(Math.abs(Date.parse(items[0].createdAt) - expected)).toBeLessThan(5_000);
  });
});
