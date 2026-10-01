"use client";

/**
 * Knowledge base and agents section data — which agents can read and/or
 * write the `transcriptions` knowledge base (settings design doc §5; fix
 * round 1, critical — this was the spec's sixth section, missing from the
 * original five).
 *
 * Deliberately does NOT import the parse helpers from `app/(application)/
 * agents/` (`parseWizardConfig`, `parseKbEditingConfig`, the `defaultTools`
 * tolerant-JSON helper) — that folder is a different feature, and the
 * tier-boundary `no-restricted-imports` rule forbids reaching into it (same
 * reasoning as `settings/embedder.ts`, and `eslint.tier-exemptions.mjs` may
 * only shrink). `agent.tools` is a bare JSON scalar on the wire
 * (`agents/edit/[id]/queries.ts`'s `agentById` query selects it with no
 * subfields, and `types/models/agent.ts`'s `AgentTool.config[].variable` is
 * the actual runtime shape — NOT `types/models/tool.ts`'s `ExuluTool`, which
 * lacks `variable`), so this is a minimal, tolerant, LOCAL re-parse of just
 * the two entries this section needs, mirroring the parsing *contracts* of:
 *  - `agents/edit/[id]/components/knowledge-search/config-schema.ts` — the
 *    `agentic_context_search` tool's `knowledge_bases` entry, a map of
 *    context id → `{ enabled, kind, instructions, overrides }`.
 *  - `agents/edit/[id]/components/kb-editing/config-schema.ts` — the
 *    `knowledge_base_editor` tool's `knowledge_bases` entry, a map of
 *    context id → `{ create, update }`; a both-false entry "grants nothing"
 *    per that file's own comment, so it never counts as write access here.
 *
 * Fix round 2, critical correction: a MISSING per-context entry is ENABLED,
 * not excluded — this mirrors the actual retrieval pipeline exactly
 * (backend `ee/agentic-retrieval/pipeline/index.ts:257`:
 * `cfg.knowledgeBases[ctx.id]?.enabled !== false`, and its own test at
 * `ee/agentic-retrieval/pipeline/config.test.ts:78`, "defaults a missing
 * profile to enabled documents"; `defaultWizardConfig()` ships
 * `knowledgeBases: {}`). An agent that has never customised its per-context
 * toggles reads every context, `transcriptions` included, TODAY. Do not
 * "tighten" this back to requiring the key's presence — that was round 1's
 * bug, and it inverted the section's one job (telling an admin the truth).
 * The retrieval TOOL itself is still required: an agent with no
 * `agentic_context_search` tool at all genuinely retrieves nothing,
 * regardless of what any `knowledge_bases` map would say.
 *
 * Read and write are independent axes (fix round 2): an agent can have
 * either, both, or neither — `knowledge_base_editor` grants write without
 * `agentic_context_search` granting read, and vice versa. An agent is only
 * dropped from the list when it has neither.
 */
import { gql, useQuery } from "@apollo/client";

const KNOWLEDGE_SEARCH_TOOL_ID = "agentic_context_search";
const KB_EDITOR_TOOL_ID = "knowledge_base_editor";
const TRANSCRIPTIONS_CONTEXT_ID = "transcriptions";

export const GET_TRANSCRIPTS_KNOWLEDGE_AGENTS = gql`
  query TranscriptsSettingsKnowledgeAgents($page: Int = 1, $limit: Int = 200) {
    agentsPagination(
      page: $page
      limit: $limit
      sort: { field: "name", direction: ASC }
    ) {
      items {
        id
        name
        tools
      }
    }
  }
`;

export interface AgentKnowledgeRow {
  id: string;
  name: string;
  canRead: boolean;
  canWrite: boolean;
}

type RawToolConfigEntry = { name?: unknown; variable?: unknown };
type RawTool = { id?: unknown; config?: unknown };

/** Tolerant of the legacy string-encoded shape — mirrors the tolerance
 *  `agents/edit/[id]/hooks.ts`'s `defaultTools` applies to the same field,
 *  without importing it. */
function parseTools(raw: unknown): RawTool[] {
  if (Array.isArray(raw)) return raw as RawTool[];
  if (typeof raw === "string" && raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as RawTool[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function findToolConfig(tools: RawTool[], toolId: string): RawToolConfigEntry[] | null {
  const tool = tools.find((candidate) => candidate?.id === toolId);
  return tool && Array.isArray(tool.config) ? (tool.config as RawToolConfigEntry[]) : null;
}

/** Parses one JSON-typed config entry's `variable`, tolerant of a raw string
 *  or an already-parsed object — never throws. Returns `null` for absent or
 *  unparseable input; the caller treats that exactly like an empty map
 *  (`{}`), which is what `defaultWizardConfig()` actually ships. */
function parseJsonEntry(
  config: RawToolConfigEntry[],
  entryName: string,
): Record<string, unknown> | null {
  const entry = config.find((candidate) => candidate?.name === entryName);
  let value: unknown = entry?.variable;
  if (typeof value === "string" && value) {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Whether this agent can read and/or write the `transcriptions` knowledge
 * base, derived straight from its raw `tools` field. `null` means neither —
 * the caller drops those agents from the list entirely rather than showing
 * a "none" row.
 */
export function transcriptsAgentAccess(
  tools: unknown,
): { canRead: boolean; canWrite: boolean } | null {
  const list = parseTools(tools);

  // Read: requires the retrieval tool to be present at all, but NOT a
  // present knowledge_bases entry — see the file header. A missing or
  // unparseable `knowledge_bases` map, or a missing `transcriptions` key
  // within it, both resolve to "enabled" (ee/agentic-retrieval/pipeline/
  // index.ts:257's `?.enabled !== false`); only an explicit `enabled: false`
  // excludes it.
  const searchConfig = findToolConfig(list, KNOWLEDGE_SEARCH_TOOL_ID);
  let canRead = false;
  if (searchConfig) {
    const knowledgeBases = parseJsonEntry(searchConfig, "knowledge_bases");
    const profile = knowledgeBases?.[TRANSCRIPTIONS_CONTEXT_ID];
    const explicitlyDisabled =
      !!profile && typeof profile === "object" && (profile as { enabled?: unknown }).enabled === false;
    canRead = !explicitlyDisabled;
  }

  const editorConfig = findToolConfig(list, KB_EDITOR_TOOL_ID);
  const editorKbs = editorConfig ? parseJsonEntry(editorConfig, "knowledge_bases") : null;
  const permission = editorKbs?.[TRANSCRIPTIONS_CONTEXT_ID] as
    | { create?: unknown; update?: unknown }
    | undefined;
  const canWrite = !!permission && (permission.create === true || permission.update === true);

  if (!canRead && !canWrite) return null;
  return { canRead, canWrite };
}

export interface TranscriptsKnowledgeAgents {
  agents: AgentKnowledgeRow[];
  readCount: number;
  writeCount: number;
  loading: boolean;
  error?: Error;
}

/** `skip` lets the settings page avoid firing this for a non-admin. */
export function useTranscriptsKnowledgeAgents(skip = false): TranscriptsKnowledgeAgents {
  const { data, loading, error } = useQuery<{
    agentsPagination: { items: { id: string; name: string; tools: unknown }[] };
  }>(GET_TRANSCRIPTS_KNOWLEDGE_AGENTS, { fetchPolicy: "cache-and-network", skip });

  const items = data?.agentsPagination?.items ?? [];
  const agents: AgentKnowledgeRow[] = [];
  for (const agent of items) {
    const access = transcriptsAgentAccess(agent.tools);
    if (access) {
      agents.push({ id: agent.id, name: agent.name, canRead: access.canRead, canWrite: access.canWrite });
    }
  }

  return {
    agents,
    readCount: agents.filter((agent) => agent.canRead).length,
    writeCount: agents.filter((agent) => agent.canWrite).length,
    loading: loading && !data,
    error: error as Error | undefined,
  };
}
