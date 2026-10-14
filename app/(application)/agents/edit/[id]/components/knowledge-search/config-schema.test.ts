// app/(application)/agents/edit/[id]/components/knowledge-search/config-schema.test.ts
import { describe, test, it, expect } from "vitest";
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

describe("unknown keys in json blobs survive a load/save roundtrip", () => {
  // engine/v2 were added straight into the DB during v2-engine development and
  // were never fields the wizard knows. Zod strips unknown keys, and
  // serializeWizardConfig writes the parsed subset back, so an unrelated save
  // silently deleted `engine: "v2"` from NEWLIFT's production agent on
  // 2026-10-06 and reverted retrieval to the slow v1 orchestration.
  const withUnknown: ToolConfigEntry[] = [
    {
      name: "tuning",
      type: "json",
      variable: JSON.stringify({
        topK: 10,
        fallbackThreshold: 0.7,
        pinBoost: 0.15,
        identifierBoost: 0.15,
        pageWindow: 1,
        maxQueriesPerContext: 3,
        engine: "v2",
      }),
    },
  ];

  test("keeps tuning.engine through parse and serialize", () => {
    const cfg = parseWizardConfig(withUnknown);
    const out = serializeWizardConfig(cfg);
    const tuning = JSON.parse(
      out.find((e) => e.name === "tuning")!.variable as string,
    );
    expect(tuning.engine).toBe("v2");
    // the known fields must still round-trip unchanged
    expect(tuning.topK).toBe(10);
    expect(tuning.maxQueriesPerContext).toBe(3);
  });

  test("keeps an unknown key on the memory blob too", () => {
    const memoryEntries: ToolConfigEntry[] = [
      {
        name: "memory",
        type: "json",
        variable: JSON.stringify({ enabled: true, somethingOperational: 7 }),
      },
    ];
    const cfg = parseWizardConfig(memoryEntries);
    const memory = JSON.parse(
      serializeWizardConfig(cfg).find((e) => e.name === "memory")!.variable as string,
    );
    expect(memory.somethingOperational).toBe(7);
  });
});

describe("serializeWizardConfig", () => {
  test("emits exactly 15 entries with the platform value conventions", () => {
    const cfg = defaultWizardConfig();
    cfg.managedContext = true;
    cfg.tuning.topK = 7;
    const entries = serializeWizardConfig(cfg);
    expect(entries).toHaveLength(15);
    const byName = Object.fromEntries(entries.map((e) => [e.name, e]));
    expect(byName["max_steps"]).toEqual({ name: "max_steps", variable: "0", type: "number" });
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

describe("projectSearch", () => {
  test("defaults to true when the entry is absent or staged empty", () => {
    expect(parseWizardConfig([]).projectSearch).toBe(true);
    expect(
      parseWizardConfig([{ name: "project_search", variable: "", type: "boolean" }]).projectSearch,
    ).toBe(true);
  });

  test("parses explicit false and round-trips", () => {
    const cfg = { ...defaultWizardConfig(), projectSearch: false };
    const entries = serializeWizardConfig(cfg);
    expect(entries.find((e) => e.name === "project_search")?.variable).toBe("false");
    expect(parseWizardConfig(entries).projectSearch).toBe(false);
  });
});

describe("showSources", () => {
  test("defaults to true when the entry is absent or staged empty", () => {
    expect(parseWizardConfig([]).showSources).toBe(true);
    expect(
      parseWizardConfig([{ name: "show_sources_to_external_users", variable: "", type: "boolean" }])
        .showSources,
    ).toBe(true);
  });

  test("parses explicit false and round-trips", () => {
    const cfg = { ...defaultWizardConfig(), showSources: false };
    const entries = serializeWizardConfig(cfg);
    expect(entries.find((e) => e.name === "show_sources_to_external_users")?.variable).toBe("false");
    expect(parseWizardConfig(entries).showSources).toBe(false);
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
  test("ruleIdFromLabel falls back to 'rule' for all-special-character labels", () => {
    expect(ruleIdFromLabel("!!!", [])).toBe("rule");
    expect(ruleIdFromLabel("!!!", ["rule"])).toBe("rule-2");
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

describe("claim_check", () => {
  it("defaults to disabled when the key is absent", () => {
    const cfg = parseWizardConfig([]);
    expect(cfg.claimCheck).toEqual({
      enabled: false,
      model: "",
      fidelity: "fast",
      completions: 1,
      reRetrieve: true,
      thresholds: { warn: 0.1, alert: 0.3 },
      showToExternalUsers: false,
      caps: { maxSentences: 120, maxClaims: 200, maxReRetrievals: 10 },
    });
  });

  it("round-trips a configured value through serialize and parse", () => {
    const cfg = parseWizardConfig([
      { name: "claim_check", variable: '{"enabled":true,"model":"vertex-gemini-3.5-flash","thresholds":{"warn":0.2,"alert":0.5}}', type: "json" },
    ]);
    expect(cfg.claimCheck.enabled).toBe(true);
    expect(cfg.claimCheck.model).toBe("vertex-gemini-3.5-flash");
    expect(cfg.claimCheck.thresholds).toEqual({ warn: 0.2, alert: 0.5 });

    const entries = serializeWizardConfig(cfg);
    expect(parseWizardConfig(entries).claimCheck).toEqual(cfg.claimCheck);
  });

  // Review Focus 5
  it("serialises exactly 15 entries, with claim_check among them", () => {
    const entries = serializeWizardConfig(parseWizardConfig([]));
    expect(entries).toHaveLength(15);
    expect(entries.map((e) => e.name)).toContain("claim_check");
  });

  // Review Focus 5
  it("leaves an agent that never had the key with the default, not undefined", () => {
    const entries = serializeWizardConfig(parseWizardConfig([{ name: "instructions", variable: "x", type: "string" }]));
    const claim = entries.find((e) => e.name === "claim_check");
    expect(claim).toBeDefined();
    expect(JSON.parse(String(claim!.variable)).enabled).toBe(false);
  });

  // The UI edits six of the eight keys; a save must not drop the other two.
  it("preserves completions and caps set outside the wizard across a save", () => {
    const cfg = parseWizardConfig([
      {
        name: "claim_check",
        variable: '{"enabled":true,"completions":3,"caps":{"maxSentences":40,"maxClaims":60,"maxReRetrievals":0}}',
        type: "json",
      },
    ]);
    const saved = parseWizardConfig(serializeWizardConfig(cfg)).claimCheck;
    expect(saved.completions).toBe(3);
    expect(saved.caps).toEqual({ maxSentences: 40, maxClaims: 60, maxReRetrievals: 0 });
  });

  it("falls back to the default on a malformed blob instead of throwing", () => {
    expect(parseWizardConfig([{ name: "claim_check", variable: "{not json", type: "json" }]).claimCheck.enabled).toBe(false);
  });

  // The backend declares thresholds.warn/alert as z.number().min(0).max(1)
  // and its jsonVal falls back to the ENTIRE schema default — enabled: false
  // included — on any validation failure. An admin reading "Warnschwelle"
  // as a percentage and typing 20 therefore saved a blob the backend threw
  // away wholesale: no check ever ran, and the wizard still showed 20 and
  // "active". Declaring the same bounds here makes the wizard show what the
  // backend will actually do with the blob, and keeps the wizard from
  // authoring one the backend rejects.
  it("mirrors the backend and rejects an out-of-range threshold blob wholesale", () => {
    const cfg = parseWizardConfig([
      { name: "claim_check", variable: '{"enabled":true,"thresholds":{"warn":20,"alert":40}}', type: "json" },
    ]);
    expect(cfg.claimCheck.thresholds).toEqual({ warn: 0.1, alert: 0.3 });
    expect(cfg.claimCheck.enabled).toBe(false);
  });

  it("accepts the in-range boundaries 0 and 1", () => {
    const cfg = parseWizardConfig([
      { name: "claim_check", variable: '{"enabled":true,"thresholds":{"warn":0,"alert":1}}', type: "json" },
    ]);
    expect(cfg.claimCheck.thresholds).toEqual({ warn: 0, alert: 1 });
    expect(cfg.claimCheck.enabled).toBe(true);
  });
});
