import { describe, expect, it } from "vitest";

import { DEMO_AGENT_ID, getWorld } from "@/lib/demo/fixtures";
import { runDemoOperation as run } from "@/lib/demo/test-support";
import {
  GET_EVAL_RUNS,
  GET_EVAL_SETS,
  GET_EVAL_SET_BY_ID,
  GET_JOB_RESULTS,
  GET_TEST_CASES,
} from "@/queries/queries";

/**
 * Coverage for the demo tour's evals chapter, asserted against the evals
 * feature's OWN query documents.
 *
 * Why this sits here and not beside the other demo coverage in lib/demo: the
 * evals operations have not been extracted from queries/queries.ts yet, and
 * lib/** is barred from importing that monolith (codebase-structure §1.2).
 * Duplicating the gql in the test would defeat the point — the test exists so
 * that a renamed or reshaped PRODUCT query fails here instead of silently
 * emptying a demo chapter nobody looks at until a prospect does.
 *
 * When evals gets its Wave-2 extraction, move this file back next to
 * apollo-link.operations.test.ts and import the colocated documents.
 */

const world = () => getWorld({ chapter: "ingestion", step: 0 });

describe("demo resolvers answer the evals pages", () => {
  it("answers all three eval queries under their pagination wrappers", async () => {
    const vars = { page: 1, limit: 50 };
    const sets = await run(GET_EVAL_SETS, vars);
    const cases = await run(GET_TEST_CASES, vars);
    const runs = await run(GET_EVAL_RUNS, vars);

    for (const [label, wrapper] of [
      ["eval_setsPagination", sets.eval_setsPagination],
      ["test_casesPagination", cases.test_casesPagination],
      ["eval_runsPagination", runs.eval_runsPagination],
    ] as const) {
      const w = wrapper as { pageInfo: unknown; items: unknown[] };
      expect(w, `${label} missing`).toBeTruthy();
      // pageInfo is in the selection set; without it the tables cannot render.
      expect(w.pageInfo, `${label}.pageInfo missing`).toBeTruthy();
      expect(w.items.length, `${label} empty`).toBeGreaterThan(0);
    }
  });

  it("filters test cases by eval set rather than showing every suite's cases", async () => {
    const all = await run(GET_TEST_CASES, { page: 1, limit: 50 });
    const filtered = await run(GET_TEST_CASES, {
      page: 1,
      limit: 50,
      filters: [{ eval_set_id: "evalset-regulatory" }],
    });
    const allItems = (all.test_casesPagination as { items: unknown[] }).items;
    const someItems = (
      filtered.test_casesPagination as { items: { eval_set_id: string }[] }
    ).items;

    expect(someItems.length).toBeLessThan(allItems.length);
    expect(someItems.every((c) => c.eval_set_id === "evalset-regulatory")).toBe(
      true,
    );
  });

  it("only references agents and knowledge sources the demo world contains", async () => {
    const runsData = await run(GET_EVAL_RUNS, { page: 1, limit: 50 });
    const casesData = await run(GET_TEST_CASES, { page: 1, limit: 50 });

    // Same list the retrieval wizard's Sources step renders — a case expecting
    // a context that is not in the world shows as an unknown source on screen.
    const knownContexts = new Set(world().contexts.map((c) => c.id));
    const agentIds = new Set([DEMO_AGENT_ID]);

    for (const r of (
      runsData.eval_runsPagination as { items: { agent_id: string }[] }
    ).items) {
      expect(
        agentIds.has(r.agent_id),
        `run targets unknown agent: ${r.agent_id}`,
      ).toBe(true);
    }
    for (const c of (
      casesData.test_casesPagination as {
        items: { expected_knowledge_sources: string[] }[];
      }
    ).items) {
      for (const src of c.expected_knowledge_sources ?? []) {
        expect(
          knownContexts.has(src),
          `case expects unknown context: ${src}`,
        ).toBe(true);
      }
    }
  });
});

/**
 * The results matrix on /evals/[id]. Both of these were found by opening the
 * page rather than by any test: the set detail query was unmapped, so the page
 * rendered loading skeletons indefinitely with nothing in the console, and the
 * per-case scores did not exist at all, so every cell read "Not started".
 */
describe("the results matrix has data to draw", () => {
  it("resolves the set the detail page opens", async () => {
    const data = await run(GET_EVAL_SET_BY_ID, {
      id: "evalset-techdoc-regression",
    });
    expect((data.eval_setById as { id: string })?.id).toBe(
      "evalset-techdoc-regression",
    );
  });

  it("scopes job results to the run that asked for them", async () => {
    // Load-bearing, and silently so. Each run column averages EVERY row it is
    // handed, so a resolver that ignored the label filter would hand both runs
    // all six results and print the same average under each — while the
    // per-case cells still looked correct, because those match on the label a
    // second time. The averages are the number a prospect actually reads.
    const forNightly = await run(GET_JOB_RESULTS, {
      page: 1,
      limit: 500,
      filters: [{ label: { contains: "eval-run-evalrun-2026-08-27" } }],
    });
    const items = (
      forNightly.job_resultsPagination as {
        items: { label: string; result: number; state: string }[];
      }
    ).items;

    expect(items).toHaveLength(3);
    expect(items.every((r) => r.label.includes("evalrun-2026-08-27"))).toBe(true);
    expect(items.some((r) => r.label.includes("evalrun-2026-08-20"))).toBe(false);

    // `result` must be a NUMBER: eval-run-column.tsx averages only over
    // `typeof result === "number"`, so numeric strings would render per-case
    // scores and then a blank average row.
    expect(items.every((r) => typeof r.result === "number")).toBe(true);
    expect(items.every((r) => r.state === "completed")).toBe(true);
  });

  it("gives the two runs different averages, which is the chapter's point", async () => {
    const avg = async (runId: string) => {
      const data = await run(GET_JOB_RESULTS, {
        page: 1,
        limit: 500,
        filters: [{ label: { contains: `eval-run-${runId}` } }],
      });
      const rows = (
        data.job_resultsPagination as { items: { result: number }[] }
      ).items;
      return rows.reduce((sum, r) => sum + r.result, 0) / rows.length;
    };

    const baseline = await avg("evalrun-2026-08-20");
    const nightly = await avg("evalrun-2026-08-27");

    // The earlier run sits below the suite's 80 pass threshold and the later
    // one above it, so the matrix shows a red cell becoming green. These
    // numbers are illustrative — see the fixture header — but the RELATIONSHIP
    // is what the chapter narrates, so it is pinned here.
    expect(baseline).toBeLessThan(80);
    expect(nightly).toBeGreaterThan(80);
  });
});
