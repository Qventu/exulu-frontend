import { describe, expect, it } from "vitest";

import { RETRIEVAL_STEPS, TECHDOC_TURNS } from "./techdoc-turns";

describe("the retrieval trace", () => {
  it("speaks German to the visitor and keeps the original line for the record", () => {
    expect(RETRIEVAL_STEPS).toHaveLength(7);
    for (const step of RETRIEVAL_STEPS) {
      expect(step.text).not.toMatch(/Classified|Detected|Reranking|Rerank_score|Using fallback|pinning|Main contexts/);
      expect(step.text).not.toMatch(/_context\b/);
      expect(step.source).toBeTruthy();
    }
  });

  it("is what the tool output carries", () => {
    const result = JSON.parse(TECHDOC_TURNS[0].toolCalls[0].output.result as string);
    expect(result.reasoning.map((r: { text: string }) => r.text)).toEqual(RETRIEVAL_STEPS.map((s) => s.text));
  });
});
