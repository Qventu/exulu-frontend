import { describe, expect, it } from "vitest";

import type { AgentTool } from "@/types/models/agent";

import { defaultTools } from "../hooks";
import { CREATE_PROJECT_TOOL_ID, isCreateProjectEnabled, withCreateProject } from "./create-project-switch";

const other: AgentTool = { id: "agentic_context_search", type: "function", name: "x", config: [{ name: "a", variable: "b", type: "string" }] };

describe("create_project switch", () => {
  it("is off when the entry is absent", () => {
    expect(isCreateProjectEnabled([])).toBe(false);
    expect(isCreateProjectEnabled([other])).toBe(false);
  });

  it("stores the opt-in entry the backend looks for, and keeps other tools", () => {
    const on = withCreateProject([other], true);
    expect(on).toHaveLength(2);
    expect(on[0]).toBe(other);
    expect(on[1]).toMatchObject({ id: CREATE_PROJECT_TOOL_ID, type: "function", config: [] });
    expect(CREATE_PROJECT_TOOL_ID).toBe("create_project");
    expect(isCreateProjectEnabled(on)).toBe(true);
  });

  it("is idempotent and removable", () => {
    const on = withCreateProject(withCreateProject([], true), true);
    expect(on.filter((t) => t.id === "create_project")).toHaveLength(1);
    expect(withCreateProject(on, false)).toEqual([]);
  });

  it("survives save and reload through the editor's real serialisation", () => {
    const saved = JSON.stringify(withCreateProject([other], true)); // what save() sends
    const reloaded = defaultTools({ tools: saved } as any); // what the editor reads back
    expect(isCreateProjectEnabled(reloaded)).toBe(true);
    expect(reloaded.find((t) => t.id === "create_project")).toMatchObject({ type: "function", config: [] });
    expect(reloaded.find((t) => t.id === "agentic_context_search")).toEqual(other);
  });
});
