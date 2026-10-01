"use client";

/**
 * Knowledge base and agents section data — which agents can read (and
 * optionally write to) the `transcriptions` knowledge base (settings design
 * doc §5; fix round 1, critical — this was the spec's sixth section, missing
 * from the original five).
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
 *    per that file's own comment, so it reads as read-only here too.
 *
 * "Has a transcriptions key that is not disabled" is a narrower question than
 * `config-schema.ts`'s `selectedKbIds` ("missing profile = enabled against
 * the full context universe," used to pre-check a multi-select) — here the
 * key must actually be present in the stored map.
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

export type AgentAccess = "read" | "write";

export interface AgentKnowledgeRow {
  id: string;
  name: string;
  access: AgentAccess;
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
 *  or an already-parsed object — never throws. */
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
 * Whether this agent can read (and/or write) the `transcriptions` knowledge
 * base, derived straight from its raw `tools` field. `null` means no access
 * at all — the caller drops those agents from the list entirely rather than
 * showing a "none" row.
 */
export function transcriptsAgentAccess(tools: unknown): AgentAccess | null {
  const list = parseTools(tools);

  const searchConfig = findToolConfig(list, KNOWLEDGE_SEARCH_TOOL_ID);
  const knowledgeBases = searchConfig ? parseJsonEntry(searchConfig, "knowledge_bases") : null;
  const readProfile = knowledgeBases?.[TRANSCRIPTIONS_CONTEXT_ID];
  const explicitlyDisabled =
    !!readProfile &&
    typeof readProfile === "object" &&
    (readProfile as { enabled?: unknown }).enabled === false;
  const canRead = readProfile !== undefined && !explicitlyDisabled;
  if (!canRead) return null;

  const editorConfig = findToolConfig(list, KB_EDITOR_TOOL_ID);
  const editorKbs = editorConfig ? parseJsonEntry(editorConfig, "knowledge_bases") : null;
  const permission = editorKbs?.[TRANSCRIPTIONS_CONTEXT_ID] as
    | { create?: unknown; update?: unknown }
    | undefined;
  const canWrite = !!permission && (permission.create === true || permission.update === true);

  return canWrite ? "write" : "read";
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
    if (access) agents.push({ id: agent.id, name: agent.name, access });
  }

  return {
    agents,
    readCount: agents.length,
    writeCount: agents.filter((agent) => agent.access === "write").length,
    loading: loading && !data,
    error: error as Error | undefined,
  };
}
