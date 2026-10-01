import { describe, expect, it } from "vitest";

import { transcriptsAgentAccess } from "./knowledge";

const searchTool = (knowledgeBases: Record<string, unknown>) => ({
  id: "agentic_context_search",
  config: [{ name: "knowledge_bases", variable: JSON.stringify(knowledgeBases) }],
});

const editorTool = (knowledgeBases: Record<string, unknown>) => ({
  id: "knowledge_base_editor",
  config: [{ name: "knowledge_bases", variable: JSON.stringify(knowledgeBases) }],
});

describe("transcriptsAgentAccess", () => {
  it("returns null for an agent with no tools", () => {
    expect(transcriptsAgentAccess(undefined)).toBeNull();
    expect(transcriptsAgentAccess([])).toBeNull();
  });

  it("returns null when agentic_context_search has no transcriptions key", () => {
    const tools = [searchTool({ other_context: { enabled: true } })];
    expect(transcriptsAgentAccess(tools)).toBeNull();
  });

  it("returns 'read' when transcriptions is enabled", () => {
    const tools = [searchTool({ transcriptions: { enabled: true } })];
    expect(transcriptsAgentAccess(tools)).toBe("read");
  });

  it("returns null when transcriptions is explicitly disabled", () => {
    const tools = [searchTool({ transcriptions: { enabled: false } })];
    expect(transcriptsAgentAccess(tools)).toBeNull();
  });

  it("parses the legacy string-encoded tools array", () => {
    const tools = JSON.stringify([searchTool({ transcriptions: { enabled: true } })]);
    expect(transcriptsAgentAccess(tools)).toBe("read");
  });

  it("returns 'write' when the kb editor grants create or update on transcriptions", () => {
    const tools = [
      searchTool({ transcriptions: { enabled: true } }),
      editorTool({ transcriptions: { create: true, update: false } }),
    ];
    expect(transcriptsAgentAccess(tools)).toBe("write");
  });

  it("stays 'read' when the kb editor's transcriptions row grants nothing", () => {
    // A both-false row is kept in storage (kb-editing/config-schema.ts's
    // comment) but the backend parser treats it as no permission at all.
    const tools = [
      searchTool({ transcriptions: { enabled: true } }),
      editorTool({ transcriptions: { create: false, update: false } }),
    ];
    expect(transcriptsAgentAccess(tools)).toBe("read");
  });

  it("ignores a kb editor entry for a different context", () => {
    const tools = [
      searchTool({ transcriptions: { enabled: true } }),
      editorTool({ other_context: { create: true, update: true } }),
    ];
    expect(transcriptsAgentAccess(tools)).toBe("read");
  });

  it("never throws on malformed JSON", () => {
    const tools = "{not json";
    expect(transcriptsAgentAccess(tools)).toBeNull();
  });

  it("never throws when knowledge_bases itself is malformed", () => {
    const tools = [
      { id: "agentic_context_search", config: [{ name: "knowledge_bases", variable: "{not json" }] },
    ];
    expect(transcriptsAgentAccess(tools)).toBeNull();
  });
});
