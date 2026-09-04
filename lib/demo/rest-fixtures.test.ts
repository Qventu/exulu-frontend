import { describe, expect, it } from "vitest";
import { demoRestResponse } from "./rest-fixtures";
import type { TagActivityResponse } from "@/lib/litellm-activity";

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => ymd(new Date(Date.now() - n * 86_400_000));

const activity = (start: string, end: string, prefix = "user_id_") =>
  demoRestResponse(
    `/admin/litellm/tag-activity?start_date=${start}&end_date=${end}&tag_prefix=${prefix}`,
    "GET",
  ) as TagActivityResponse;

describe("demoRestResponse — routing", () => {
  it("answers the tag-activity path", () => {
    expect(activity(daysAgo(14), daysAgo(0))).not.toBeNull();
  });

  // Every other REST call in the demo returns null on purpose: session files
  // and follow-up suggestions are optional enrichments, and a thrown error
  // would put a failure state on screen for something a visitor was never
  // meant to notice. Adding one fixture must not disturb that.
  it("leaves every other path silent", () => {
    for (const path of ["/session-files", "/suggestions", "/admin/litellm/other"]) {
      expect(demoRestResponse(path, "GET"), path).toBeNull();
    }
  });

  it("does not answer a near-miss path", () => {
    expect(demoRestResponse("/admin/litellm/tag-activity-summary", "GET")).toBeNull();
  });
});

describe("demoRestResponse — time relativity", () => {
  // THE defect this fixture exists to avoid: hardcoded dates fall outside the
  // window the UI asks for, so the chart renders empty and nothing fails.
  it("puts every daily row inside the requested window", () => {
    const start = daysAgo(14);
    const end = daysAgo(0);
    const res = activity(start, end);
    expect(res.daily.length).toBeGreaterThan(0);
    for (const row of res.daily) {
      expect(row.date >= start, `${row.date} < ${start}`).toBe(true);
      expect(row.date <= end, `${row.date} > ${end}`).toBe(true);
    }
    expect(res.window).toEqual({ start_date: start, end_date: end });
  });

  it("still fills a window a year from now", () => {
    const start = ymd(new Date(Date.now() + 364 * 86_400_000));
    const end = ymd(new Date(Date.now() + 371 * 86_400_000));
    const res = activity(start, end);
    expect(res.daily.length).toBe(8);
    for (const row of res.daily) {
      expect(row.date >= start && row.date <= end).toBe(true);
    }
  });

  it("is deterministic — the same window twice yields identical data", () => {
    const start = daysAgo(14);
    const end = daysAgo(0);
    expect(JSON.stringify(activity(start, end))).toBe(JSON.stringify(activity(start, end)));
  });
});

describe("demoRestResponse — shape and scale", () => {
  it("totals equal the sum of the daily rows", () => {
    const res = activity(daysAgo(29), daysAgo(0));
    const summed = res.daily.reduce((s, r) => s + r.spend, 0);
    expect(res.totals.spend).toBeCloseTo(summed, 6);
  });

  // The spec fixes the scale at roughly EUR 400/month so a reader's attention
  // stays on where the money goes rather than on the total.
  it("lands near the specified monthly scale", () => {
    const res = activity(daysAgo(29), daysAgo(0));
    expect(res.totals.spend).toBeGreaterThan(250);
    expect(res.totals.spend).toBeLessThan(600);
  });

  it("attributes spend to the tags the caller asked for", () => {
    const res = activity(daysAgo(14), daysAgo(0), "team_id_");
    expect(res.byTag.length).toBeGreaterThan(0);
    for (const row of res.byTag) expect(row.tag.startsWith("team_id_")).toBe(true);
  });

  it("returns an empty breakdown for a prefix it has no roster for", () => {
    const res = activity(daysAgo(14), daysAgo(0), "nonsense_");
    expect(res.byTag).toEqual([]);
    // Totals still hold, so the chart renders even on an unknown dimension.
    expect(res.totals.spend).toBeGreaterThan(0);
  });
});
