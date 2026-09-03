import { describe, expect, it } from "vitest";

import { DEMO_RESOLVERS } from "./resolvers";
import type { DemoWorld } from "./types";

/**
 * GetAgentById and AgentEditorById used to return `world.agents[0]` whatever
 * they were asked for. With one agent in every world that was invisible; with
 * a gallery of them, every card in the list would open the same agent — and
 * chapter 5's five wizard steps run on exactly that route.
 */
const world = {
  agents: [
    { id: "demo-agent-newton", name: "Newton" },
    { id: "demo-agent-kundendienst", name: "Kundendienst" },
    { id: "demo-agent-seo", name: "SEO" },
  ],
  contexts: [],
  items: [],
  sessions: [],
} as unknown as DemoWorld;

describe("agent lookup by id", () => {
  it("GetAgentById returns the agent that was asked for", () => {
    const data = DEMO_RESOLVERS.GetAgentById(world, { id: "demo-agent-seo" }) as {
      agentById: { id: string };
    };
    expect(data.agentById.id).toBe("demo-agent-seo");
  });

  it("AgentEditorById returns the agent that was asked for", () => {
    const data = DEMO_RESOLVERS.AgentEditorById(world, {
      id: "demo-agent-kundendienst",
    }) as { agentById: { id: string; tools: unknown[] } };
    expect(data.agentById.id).toBe("demo-agent-kundendienst");
    // The editor's own additions must survive the change.
    expect(Array.isArray(data.agentById.tools)).toBe(true);
  });

  it("falls back to the first agent for an unknown id", () => {
    const data = DEMO_RESOLVERS.GetAgentById(world, { id: "nope" }) as {
      agentById: { id: string };
    };
    expect(data.agentById.id).toBe("demo-agent-newton");
  });

  it("falls back to the first agent when no id is passed", () => {
    const data = DEMO_RESOLVERS.GetAgentById(world, {}) as {
      agentById: { id: string };
    };
    expect(data.agentById.id).toBe("demo-agent-newton");
  });
});
