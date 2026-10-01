import { describe, expect, it } from "vitest";

import { transcriptsAgentAccess } from "./knowledge";

const searchTool = (knowledgeBases?: Record<string, unknown>) => ({
  id: "agentic_context_search",
  config:
    knowledgeBases === undefined
      ? []
      : [{ name: "knowledge_bases", variable: JSON.stringify(knowledgeBases) }],
});

const editorTool = (knowledgeBases: Record<string, unknown>) => ({
  id: "knowledge_base_editor",
  config: [{ name: "knowledge_bases", variable: JSON.stringify(knowledgeBases) }],
});

// Fix round 2, critical correction: a missing per-context entry is ENABLED,
// not excluded — mirrors ee/agentic-retrieval/pipeline/index.ts:257's
// `cfg.knowledgeBases[ctx.id]?.enabled !== false` exactly. Round 1's "no
// transcriptions key → null" case pinned the inverted (wrong) behaviour and
// has been flipped below, not worked around.
describe("transcriptsAgentAccess", () => {
  it("returns null for an agent with no tools at all", () => {
    expect(transcriptsAgentAccess(undefined)).toBeNull();
    expect(transcriptsAgentAccess([])).toBeNull();
  });

  it("returns null when the agent has no retrieval tool — it genuinely retrieves nothing", () => {
    const tools = [editorTool({})]; // some other tool, no agentic_context_search
    expect(transcriptsAgentAccess(tools)).toBeNull();
  });

  it("reads when the knowledge_bases config entry is absent entirely", () => {
    const tools = [searchTool(undefined)];
    expect(transcriptsAgentAccess(tools)).toEqual({ canRead: true, canWrite: false });
  });

  it("reads when knowledge_bases is present but has no transcriptions key", () => {
    const tools = [searchTool({ other_context: { enabled: false } })];
    expect(transcriptsAgentAccess(tools)).toEqual({ canRead: true, canWrite: false });
  });

  it("reads when transcriptions is explicitly enabled", () => {
    const tools = [searchTool({ transcriptions: { enabled: true } })];
    expect(transcriptsAgentAccess(tools)).toEqual({ canRead: true, canWrite: false });
  });

  it("does NOT read when transcriptions is explicitly disabled", () => {
    const tools = [searchTool({ transcriptions: { enabled: false } })];
    expect(transcriptsAgentAccess(tools)).toBeNull();
  });

  it("reads when the knowledge_bases JSON is unparseable — degrades to the default (enabled)", () => {
    const tools = [
      { id: "agentic_context_search", config: [{ name: "knowledge_bases", variable: "{not json" }] },
    ];
    expect(transcriptsAgentAccess(tools)).toEqual({ canRead: true, canWrite: false });
  });

  it("parses the legacy string-encoded tools array", () => {
    const tools = JSON.stringify([searchTool({ transcriptions: { enabled: true } })]);
    expect(transcriptsAgentAccess(tools)).toEqual({ canRead: true, canWrite: false });
  });

  it("never throws on malformed top-level JSON", () => {
    expect(transcriptsAgentAccess("{not json")).toBeNull();
  });

  it("grants write when the kb editor allows create or update on transcriptions", () => {
    const tools = [
      searchTool({ transcriptions: { enabled: true } }),
      editorTool({ transcriptions: { create: true, update: false } }),
    ];
    expect(transcriptsAgentAccess(tools)).toEqual({ canRead: true, canWrite: true });
  });

  it("does not grant write when the kb editor's transcriptions row grants nothing", () => {
    // A both-false row is kept in storage (kb-editing/config-schema.ts's
    // comment) but the backend parser treats it as no permission at all.
    const tools = [
      searchTool({ transcriptions: { enabled: true } }),
      editorTool({ transcriptions: { create: false, update: false } }),
    ];
    expect(transcriptsAgentAccess(tools)).toEqual({ canRead: true, canWrite: false });
  });

  it("ignores a kb editor entry for a different context", () => {
    const tools = [
      searchTool({ transcriptions: { enabled: true } }),
      editorTool({ other_context: { create: true, update: true } }),
    ];
    expect(transcriptsAgentAccess(tools)).toEqual({ canRead: true, canWrite: false });
  });

  it("is write-only when the agent can write but has no retrieval tool at all", () => {
    // Read and write are independent axes — an agent with no
    // agentic_context_search tool can still be granted write via
    // knowledge_base_editor alone.
    const tools = [editorTool({ transcriptions: { create: true, update: false } })];
    expect(transcriptsAgentAccess(tools)).toEqual({ canRead: false, canWrite: true });
  });

  it("is write-only when the retrieval tool exists but transcriptions is explicitly disabled for it", () => {
    const tools = [
      searchTool({ transcriptions: { enabled: false } }),
      editorTool({ transcriptions: { create: true, update: false } }),
    ];
    expect(transcriptsAgentAccess(tools)).toEqual({ canRead: false, canWrite: true });
  });

  // Final fix wave, Fix 5 — restore-all (ee/agentic-retrieval/pipeline/
  // index.ts:259): `if (enabledContexts.length === 0) enabledContexts =
  // contexts;`. An agent that disabled every context it knows about,
  // transcriptions included, reads it anyway because the pipeline falls back
  // to "search everything" rather than "search nothing".
  it("reads when every known context is disabled (pipeline's restore-all)", () => {
    const tools = [
      searchTool({
        transcriptions: { enabled: false },
        other_context: { enabled: false },
      }),
    ];
    expect(transcriptsAgentAccess(tools)).toEqual({ canRead: true, canWrite: false });
  });

  it("still excludes transcriptions when at least one other known context remains enabled", () => {
    const tools = [
      searchTool({
        transcriptions: { enabled: false },
        other_context: { enabled: true },
      }),
    ];
    expect(transcriptsAgentAccess(tools)).toBeNull();
  });
});
