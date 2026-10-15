import { describe, expect, it } from "vitest";

import { GET_AGENT_LITELLM_CATALOG } from "@/app/(application)/agents/queries";
// The chat feature's document is byte-for-byte the models page's
// (queries/queries.ts GetLiteLLMCatalog): same operation, same selection.
// lib/ may not import the legacy monolith (eslint no-restricted-imports).
import { GET_LITELLM_CATALOG } from "@/app/(application)/chat/queries";

import { getWorld } from "./fixtures";
import { runDemoQueryThroughCache as run } from "./test-support";
import { CHAPTERS } from "./tour";

type Row = {
  model_name: string;
  region: string;
  tags: string[];
  input_cost_per_million_tokens: number | null;
  output_cost_per_million_tokens: number | null;
};

const AT = { chapter: "kosten", step: 1 } as const;

describe("the model catalogue (chapter 11, models step)", () => {
  it("lists four EU-hosted models with prices, every field the table selects", async () => {
    const data = await run(GET_LITELLM_CATALOG, {}, AT);
    const rows = data.litellmCatalog as Row[];
    expect(rows.map((r) => r.model_name)).toEqual([
      "gemini-3.1-pro",
      "gemini-3.1-flash",
      "mistral-medium-3",
      "claude-sonnet-4-6",
    ]);
    for (const row of rows) {
      expect(row.region, row.model_name).toBe("eu");
      expect(row.tags, row.model_name).toContain("europe-west3");
      expect(typeof row.input_cost_per_million_tokens, row.model_name).toBe("number");
      expect(typeof row.output_cost_per_million_tokens, row.model_name).toBe("number");
    }
  });

  it("is the same list the agent editor's selector sees, and the agent's model is in it", async () => {
    const editor = await run(GET_AGENT_LITELLM_CATALOG, {}, { chapter: "config", step: 0 });
    const names = (editor.litellmCatalog as Row[]).map((r) => r.model_name);
    const agentModel = getWorld({ chapter: "config", step: 0 }).agents[0].model;
    expect(names).toContain(agentModel);
    expect(names).toHaveLength(4);
  });

  it("is chapter 11's second step, between attribution and the budget", () => {
    const steps = CHAPTERS.find((c) => c.id === "kosten")!.steps;
    expect(steps.map((s) => s.route.split("?")[0])).toEqual(["/analytics", "/models", "/budgets", "/budgets"]);
    expect(steps[1].id).toBe("kosten-modelle");
    expect(steps[1].anchor).toBe("models-catalog");
  });
});
