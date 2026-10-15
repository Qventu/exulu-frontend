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
  type: string;
  region: string;
  tags: string[];
  input_cost_per_million_tokens: number | null;
  output_cost_per_million_tokens: number | null;
};

const AT = { chapter: "kosten", step: 1 } as const;
const PROVIDER_TAGS = ["vertex", "bedrock", "azure", "self-hosted", "auto-router"];

describe("the model catalogue (chapter 11, models step)", () => {
  it("shows the platform's breadth: sixteen EU rows across providers, utilities and a router", async () => {
    const rows = (await run(GET_LITELLM_CATALOG, {}, AT)).litellmCatalog as Row[];
    expect(rows).toHaveLength(16);
    for (const row of rows) {
      expect(row.region, row.model_name).toBe("eu");
      expect(row.tags.some((t) => PROVIDER_TAGS.includes(t)), row.model_name).toBe(true);
    }
    const tags = new Set(rows.flatMap((r) => r.tags));
    for (const t of PROVIDER_TAGS) expect(tags.has(t), t).toBe(true);
    expect(new Set(rows.map((r) => r.type))).toEqual(new Set(["chat", "embedding", "ocr", "rerank"]));
  });

  it("prices every hosted chat model; the router and the self-hosted model carry no price", async () => {
    const rows = (await run(GET_LITELLM_CATALOG, {}, AT)).litellmCatalog as Row[];
    for (const row of rows.filter((r) => r.type === "chat")) {
      const unpriced = row.tags.includes("auto-router") || row.tags.includes("self-hosted");
      expect(typeof row.input_cost_per_million_tokens === "number", row.model_name).toBe(!unpriced);
    }
  });

  it("offers the agent editor the chat rows only, the agent's model and the eval judge among them", async () => {
    const all = (await run(GET_LITELLM_CATALOG, {}, AT)).litellmCatalog as Row[];
    const editor = (await run(GET_AGENT_LITELLM_CATALOG, {}, { chapter: "config", step: 0 })).litellmCatalog as Row[];
    expect(editor.map((r) => r.model_name)).toEqual(all.filter((r) => r.type === "chat").map((r) => r.model_name));
    expect(editor.map((r) => r.model_name)).toContain(getWorld({ chapter: "config", step: 0 }).agents[0].model);
    expect(editor.map((r) => r.model_name)).toContain("claude-sonnet-4-6");
  });

  it("is chapter 11's middle step: attribution, models, control", () => {
    const steps = CHAPTERS.find((c) => c.id === "kosten")!.steps;
    expect(steps.map((s) => s.route.split("?")[0])).toEqual(["/analytics", "/models", "/budgets"]);
    expect(steps[2].title).toBe("Ihr behaltet die Kontrolle über die Kosten");
  });
});
