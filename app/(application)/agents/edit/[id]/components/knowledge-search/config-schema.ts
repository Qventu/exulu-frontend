/**
 * config-schema.ts — single source of truth for the knowledge-search wizard
 * config: types, zod schemas, parse / serialize / digest helpers.
 *
 * Shapes mirror the backend pipeline exactly (11-entry serialisation contract).
 * Never throws — all parse paths fall back to schema defaults on failure.
 */

import { z } from "zod";
import type { ToolConfigEntry } from "../tool-config-fields";

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type KbKind = "documents" | "conversations" | "records";

export type WizardKbProfile = {
  enabled: boolean;
  kind: KbKind;
  instructions: string;
  overrides: { limit?: number; expand?: number; multiQuery?: boolean; hyde?: boolean };
};

export type RoutingRule = {
  id: string;
  label: string;
  description: string;
  main: string[];
  fallback: string[];
};

export type IdentifierSet = {
  name: string;
  description: string;
  examples: string[];
  strategy: "fuzzy" | "exact";
  contexts: string[];
};

export type WizardConfig = {
  instructions: string;
  reranker: string;
  utilityModel: string;
  managedContext: boolean;
  requirePreselectedContexts: boolean;
  logging: boolean;
  knowledgeBases: Record<string, WizardKbProfile>;
  routing: { rules: RoutingRule[] };
  vocabulary: {
    glossary: { term: string; meaning: string }[];
    identifiers: IdentifierSet[];
    rewrites: { find: string; replace: string }[];
    styleHint: string;
  };
  memory: { enabled: boolean; override: boolean; filePrioritization: boolean; queryAugmentation: boolean };
  tuning: {
    topK: number;
    fallbackThreshold: number;
    pinBoost: number;
    identifierBoost: number;
    pageWindow: number;
    maxQueriesPerContext: number;
  };
};

// ---------------------------------------------------------------------------
// Defaults & presets (exported constants)
// ---------------------------------------------------------------------------

export const TUNING_DEFAULTS: WizardConfig["tuning"] = {
  topK: 5,
  fallbackThreshold: 0.95,
  pinBoost: 0.15,
  identifierBoost: 0.15,
  pageWindow: 1,
  maxQueriesPerContext: 5,
};

export const MEMORY_DEFAULTS: WizardConfig["memory"] = {
  enabled: true,
  override: false,
  filePrioritization: false,
  queryAugmentation: true,
};

export const KIND_PRESETS: Record<KbKind, { limit: number; expand: number }> = {
  documents: { limit: 20, expand: 2 },
  conversations: { limit: 30, expand: 1 },
  records: { limit: 10, expand: 0 },
};

// ---------------------------------------------------------------------------
// Zod schemas (mirror backend shapes; every field has .default())
// ---------------------------------------------------------------------------

const kbOverridesSchema = z
  .object({
    limit: z.number().optional(),
    expand: z.number().optional(),
    multiQuery: z.boolean().optional(),
    hyde: z.boolean().optional(),
  })
  .default({});

const kbProfileSchema = z
  .object({
    enabled: z.boolean().default(true),
    kind: z.enum(["documents", "conversations", "records"]).default("documents"),
    instructions: z.string().default(""),
    overrides: kbOverridesSchema,
  })
  .default({ enabled: true, kind: "documents", instructions: "", overrides: {} });

const routingRuleSchema = z.object({
  id: z.string().default(""),
  label: z.string().default(""),
  description: z.string().default(""),
  main: z.array(z.string()).default([]),
  fallback: z.array(z.string()).default([]),
});

const routingSchema = z
  .object({
    rules: z.array(routingRuleSchema).default([]),
  })
  .default({ rules: [] });

const glossaryEntrySchema = z.object({
  term: z.string().default(""),
  meaning: z.string().default(""),
});

const identifierSetSchema = z.object({
  name: z.string().default(""),
  description: z.string().default(""),
  examples: z.array(z.string()).default([]),
  strategy: z.enum(["fuzzy", "exact"]).default("fuzzy"),
  contexts: z.array(z.string()).default([]),
});

const rewriteSchema = z.object({
  find: z.string().default(""),
  replace: z.string().default(""),
});

const vocabularySchema = z
  .object({
    glossary: z.array(glossaryEntrySchema).default([]),
    identifiers: z.array(identifierSetSchema).default([]),
    rewrites: z.array(rewriteSchema).default([]),
    styleHint: z.string().default(""),
  })
  .default({ glossary: [], identifiers: [], rewrites: [], styleHint: "" });

const memorySchema = z
  .object({
    enabled: z.boolean().default(MEMORY_DEFAULTS.enabled),
    override: z.boolean().default(MEMORY_DEFAULTS.override),
    filePrioritization: z.boolean().default(MEMORY_DEFAULTS.filePrioritization),
    queryAugmentation: z.boolean().default(MEMORY_DEFAULTS.queryAugmentation),
  })
  .default(MEMORY_DEFAULTS);

const tuningSchema = z
  .object({
    topK: z.number().default(TUNING_DEFAULTS.topK),
    fallbackThreshold: z.number().default(TUNING_DEFAULTS.fallbackThreshold),
    pinBoost: z.number().default(TUNING_DEFAULTS.pinBoost),
    identifierBoost: z.number().default(TUNING_DEFAULTS.identifierBoost),
    pageWindow: z.number().default(TUNING_DEFAULTS.pageWindow),
    maxQueriesPerContext: z.number().default(TUNING_DEFAULTS.maxQueriesPerContext),
  })
  .default(TUNING_DEFAULTS);

const knowledgeBasesSchema = z
  .record(z.string(), kbProfileSchema)
  .default({});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Coerce any value to boolean per platform conventions (true/"true"/1 → true). */
function boolVal(v: unknown): boolean {
  return v === true || v === "true" || v === 1;
}

/** Coerce any value to string. */
function strVal(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Parse a JSON field value: accepts already-parsed object OR JSON string.
 * Falls back to `undefined` (callers then apply schema defaults).
 */
function parseJsonField(v: unknown): unknown {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "object") return v;
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Apply a zod schema with `.default()`, falling back on parse failure. Never throws. */
function safeZodParse<T>(schema: z.ZodType<T>, value: unknown): T {
  try {
    const result = schema.safeParse(value);
    if (result.success) return result.data;
    // Fall through to the schema's default by parsing `undefined`
    const fallback = schema.safeParse(undefined);
    if (fallback.success) return fallback.data;
    // Should never reach here given all schemas have defaults
    console.warn(
      "[knowledge-search] safeZodParse: failed to parse value and schema has no default. " +
      "Returning empty object as fallback.",
    );
    return {} as T;
  } catch (e) {
    console.warn(
      "[knowledge-search] safeZodParse: unexpected error during parsing: " +
      (e instanceof Error ? e.message : String(e)),
    );
    return {} as T;
  }
}

/** Lookup an entry by name from a flat array. */
function findEntry(
  entries: ToolConfigEntry[],
  name: string,
): ToolConfigEntry | undefined {
  return entries.find((e) => e.name === name);
}

// ---------------------------------------------------------------------------
// defaultWizardConfig
// ---------------------------------------------------------------------------

export function defaultWizardConfig(): WizardConfig {
  return {
    instructions: "",
    reranker: "none",
    utilityModel: "",
    managedContext: false,
    requirePreselectedContexts: false,
    logging: false,
    knowledgeBases: {},
    routing: { rules: [] },
    vocabulary: { glossary: [], identifiers: [], rewrites: [], styleHint: "" },
    memory: { ...MEMORY_DEFAULTS },
    tuning: { ...TUNING_DEFAULTS },
  };
}

// ---------------------------------------------------------------------------
// parseWizardConfig — never throws
// ---------------------------------------------------------------------------

export function parseWizardConfig(
  entries: ToolConfigEntry[] | undefined | null,
): WizardConfig {
  const list = entries ?? [];

  // --- flat string fields ---
  const instructions = strVal(findEntry(list, "instructions")?.variable);
  // "" and "none" are the same sentinel; parse normalizes empty string to "none"
  const reranker =
    strVal(findEntry(list, "reranker")?.variable) || "none";
  const utilityModel = strVal(findEntry(list, "utility_model")?.variable);

  // --- boolean fields ---
  const managedContext = boolVal(findEntry(list, "managed_context")?.variable);
  const requirePreselectedContexts = boolVal(
    findEntry(list, "require_preselected_contexts")?.variable,
  );
  const logging = boolVal(findEntry(list, "logging")?.variable);

  // --- json fields ---
  const knowledgeBases = safeZodParse(
    knowledgeBasesSchema,
    parseJsonField(findEntry(list, "knowledge_bases")?.variable),
  );

  const routing = safeZodParse(
    routingSchema,
    parseJsonField(findEntry(list, "routing")?.variable),
  );

  const vocabulary = safeZodParse(
    vocabularySchema,
    parseJsonField(findEntry(list, "vocabulary")?.variable),
  );

  const memory = safeZodParse(
    memorySchema,
    parseJsonField(findEntry(list, "memory")?.variable),
  );

  const tuning = safeZodParse(
    tuningSchema,
    parseJsonField(findEntry(list, "tuning")?.variable),
  );

  // The zod schemas have `.default()` everywhere, so the runtime shape is
  // always fully-populated — the `as` cast bridges the inferred optional types.
  return {
    instructions,
    reranker,
    utilityModel,
    managedContext,
    requirePreselectedContexts,
    logging,
    knowledgeBases,
    routing,
    vocabulary,
    memory,
    tuning,
  } as WizardConfig;
}

// ---------------------------------------------------------------------------
// serializeWizardConfig — exactly 11 entries in declaration order
// ---------------------------------------------------------------------------

export function serializeWizardConfig(cfg: WizardConfig): ToolConfigEntry[] {
  return [
    // string entries (raw value)
    { name: "instructions", variable: cfg.instructions, type: "string" },
    { name: "reranker", variable: cfg.reranker, type: "string" },
    { name: "utility_model", variable: cfg.utilityModel, type: "string" },
    // boolean entries ("true"/"false" strings)
    { name: "managed_context", variable: cfg.managedContext ? "true" : "false", type: "boolean" },
    { name: "require_preselected_contexts", variable: cfg.requirePreselectedContexts ? "true" : "false", type: "boolean" },
    { name: "logging", variable: cfg.logging ? "true" : "false", type: "boolean" },
    // json entries (JSON.stringify'd)
    { name: "knowledge_bases", variable: JSON.stringify(cfg.knowledgeBases), type: "json" },
    { name: "routing", variable: JSON.stringify(cfg.routing), type: "json" },
    { name: "vocabulary", variable: JSON.stringify(cfg.vocabulary), type: "json" },
    { name: "memory", variable: JSON.stringify(cfg.memory), type: "json" },
    { name: "tuning", variable: JSON.stringify(cfg.tuning), type: "json" },
  ];
}

// ---------------------------------------------------------------------------
// KB selection helpers (backend semantics: missing profile = enabled)
// ---------------------------------------------------------------------------

/** Returns ids where cfg.knowledgeBases[id]?.enabled !== false (missing = enabled). */
export function selectedKbIds(cfg: WizardConfig, allContextIds: string[]): string[] {
  return allContextIds.filter((id) => cfg.knowledgeBases[id]?.enabled !== false);
}

/**
 * Returns a NEW cfg: selected ids get existing profile (or fresh default with enabled:true);
 * deselected ids get existing profile with enabled:false (preserving kind/instructions).
 */
export function setKbSelection(
  cfg: WizardConfig,
  allContextIds: string[],
  selected: string[],
): WizardConfig {
  const selectedSet = new Set(selected);
  const knowledgeBases: Record<string, WizardKbProfile> = { ...cfg.knowledgeBases };

  for (const id of allContextIds) {
    if (selectedSet.has(id)) {
      const existing = knowledgeBases[id];
      knowledgeBases[id] = existing
        ? { ...existing, enabled: true }
        : { enabled: true, kind: "documents", instructions: "", overrides: {} };
    } else {
      const existing = knowledgeBases[id];
      const base: WizardKbProfile = existing ?? {
        enabled: false,
        kind: "documents",
        instructions: "",
        overrides: {},
      };
      knowledgeBases[id] = { ...base, enabled: false };
    }
  }

  return { ...cfg, knowledgeBases };
}

// ---------------------------------------------------------------------------
// buildSummary
// ---------------------------------------------------------------------------

export function buildSummary(
  cfg: WizardConfig,
  allContextIds: string[],
): {
  kbCount: number;
  ruleCount: number;
  memoryOn: boolean;
  rerankerLabel: string;
  glossaryCount: number;
} {
  return {
    kbCount: selectedKbIds(cfg, allContextIds).length,
    ruleCount: cfg.routing.rules.length,
    memoryOn: cfg.memory.enabled,
    rerankerLabel: cfg.reranker === "none" || !cfg.reranker ? "" : cfg.reranker,
    glossaryCount: cfg.vocabulary.glossary.length,
  };
}

// ---------------------------------------------------------------------------
// ruleIdFromLabel — slug + de-dupe
// ---------------------------------------------------------------------------

export function ruleIdFromLabel(label: string, existingIds: string[]): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // Fall back to "rule" if slug is empty (e.g., all-special-character label)
  const baseId = slug || "rule";

  if (!existingIds.includes(baseId)) return baseId;

  let n = 2;
  while (existingIds.includes(`${baseId}-${n}`)) n++;
  return `${baseId}-${n}`;
}
