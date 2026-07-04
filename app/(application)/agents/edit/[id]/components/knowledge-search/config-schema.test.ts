// app/(application)/agents/edit/[id]/components/knowledge-search/config-schema.test.ts
import { describe, test, expect } from "vitest";
import {
  defaultWizardConfig, parseWizardConfig, serializeWizardConfig,
  selectedKbIds, setKbSelection, buildSummary, ruleIdFromLabel,
} from "./config-schema";
import type { ToolConfigEntry } from "../tool-config-fields";

const entry = (name: string, variable: any, type: any): ToolConfigEntry => ({ name, variable, type });

describe("parseWizardConfig", () => {
  test("returns full defaults for empty/missing entries", () => {
    const cfg = parseWizardConfig(undefined);
    expect(cfg.tuning).toEqual({ topK: 5, fallbackThreshold: 0.95, pinBoost: 0.15,
      identifierBoost: 0.15, pageWindow: 1, maxQueriesPerContext: 5 });
    expect(cfg.memory).toEqual({ enabled: true, override: false, filePrioritization: false, queryAugmentation: true });
    expect(cfg.routing.rules).toEqual([]);
    expect(cfg.knowledgeBases).toEqual({});
    expect(cfg.reranker).toBe("none");
    expect(cfg.managedContext).toBe(false);
  });

  test("parses saved entries: booleans as strings, json as strings or objects", () => {
    const cfg = parseWizardConfig([
      entry("managed_context", "true", "boolean"),
      entry("instructions", "be careful", "string"),
      entry("tuning", '{"topK":8}', "json"),
      entry("knowledge_bases", { docs: { enabled: false } }, "json"),
    ]);
    expect(cfg.managedContext).toBe(true);
    expect(cfg.instructions).toBe("be careful");
    expect(cfg.tuning.topK).toBe(8);
    expect(cfg.tuning.fallbackThreshold).toBe(0.95); // partial json keeps defaults
    expect(cfg.knowledgeBases.docs.enabled).toBe(false);
    expect(cfg.knowledgeBases.docs.kind).toBe("documents"); // schema default fills in
  });

  test("never throws on garbage values", () => {
    const cfg = parseWizardConfig([
      entry("routing", "{oops", "json"),
      entry("vocabulary", 42, "json"),
      entry("memory", null as any, "json"),
      entry("logging", "banana", "boolean"),
    ]);
    expect(cfg.routing.rules).toEqual([]);
    expect(cfg.vocabulary.glossary).toEqual([]);
    expect(cfg.memory.enabled).toBe(true);
    expect(cfg.logging).toBe(false);
  });
});

describe("serializeWizardConfig", () => {
  test("emits exactly 11 entries with the platform value conventions", () => {
    const cfg = defaultWizardConfig();
    cfg.managedContext = true;
    cfg.tuning.topK = 7;
    const entries = serializeWizardConfig(cfg);
    expect(entries).toHaveLength(11);
    const byName = Object.fromEntries(entries.map((e) => [e.name, e]));
    expect(byName["managed_context"]).toEqual({ name: "managed_context", variable: "true", type: "boolean" });
    expect(byName["logging"].variable).toBe("false");
    expect(byName["tuning"].type).toBe("json");
    expect(JSON.parse(byName["tuning"].variable as string).topK).toBe(7);
    expect(byName["knowledge_bases"].variable).toBe("{}");
  });

  test("round-trips: parse(serialize(cfg)) === cfg", () => {
    const cfg = defaultWizardConfig();
    cfg.knowledgeBases = { docs: { enabled: true, kind: "conversations", instructions: "tickets", overrides: { limit: 30 } } };
    cfg.routing.rules = [{ id: "tech", label: "Tech", description: "d", main: ["docs"], fallback: [] }];
    cfg.vocabulary.glossary = [{ term: "FST", meaning: "controller" }];
    cfg.reranker = "rerank-v4";
    expect(parseWizardConfig(serializeWizardConfig(cfg))).toEqual(cfg);
  });
});

describe("KB selection semantics (backend parity: missing = enabled)", () => {
  const all = ["a", "b", "c"];
  test("selectedKbIds treats missing profiles as enabled", () => {
    const cfg = defaultWizardConfig();
    cfg.knowledgeBases = { b: { enabled: false, kind: "documents", instructions: "", overrides: {} } };
    expect(selectedKbIds(cfg, all)).toEqual(["a", "c"]);
  });
  test("setKbSelection writes explicit enabled:false and preserves profiles on re-select", () => {
    let cfg = defaultWizardConfig();
    cfg.knowledgeBases = { a: { enabled: true, kind: "records", instructions: "x", overrides: {} } };
    cfg = setKbSelection(cfg, all, ["b"]);
    expect(cfg.knowledgeBases.a.enabled).toBe(false);
    expect(cfg.knowledgeBases.a.kind).toBe("records"); // preserved for re-selection
    expect(cfg.knowledgeBases.b.enabled).toBe(true);
    cfg = setKbSelection(cfg, all, ["a", "b"]);
    expect(cfg.knowledgeBases.a).toMatchObject({ enabled: true, kind: "records", instructions: "x" });
  });
});

describe("helpers", () => {
  test("ruleIdFromLabel slugs and de-dupes", () => {
    expect(ruleIdFromLabel("Technical questions!", [])).toBe("technical-questions");
    expect(ruleIdFromLabel("Tech", ["tech"])).toBe("tech-2");
    expect(ruleIdFromLabel("Tech", ["tech", "tech-2"])).toBe("tech-3");
  });
  test("buildSummary digests the config", () => {
    const cfg = defaultWizardConfig();
    cfg.knowledgeBases = { b: { enabled: false, kind: "documents", instructions: "", overrides: {} } };
    cfg.routing.rules = [{ id: "r", label: "R", description: "", main: [], fallback: [] }];
    cfg.reranker = "none";
    const s = buildSummary(cfg, ["a", "b"]);
    expect(s).toEqual({ kbCount: 1, ruleCount: 1, memoryOn: true, rerankerLabel: "", glossaryCount: 0 });
  });
});
