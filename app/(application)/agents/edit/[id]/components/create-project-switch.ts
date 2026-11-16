/**
 * The agent's opt-in to the create_project tool: on exactly when agent.tools
 * holds an entry with this id (the backend's isCreateProjectEnabledOnAgent).
 */
import type { AgentTool } from "@/types/models/agent";

export const CREATE_PROJECT_TOOL_ID = "create_project";

export const isCreateProjectEnabled = (tools: AgentTool[]): boolean =>
  tools.some((t) => t.id === CREATE_PROJECT_TOOL_ID);

export function withCreateProject(tools: AgentTool[], enabled: boolean): AgentTool[] {
  if (!enabled) return tools.filter((t) => t.id !== CREATE_PROJECT_TOOL_ID);
  if (isCreateProjectEnabled(tools)) return tools;
  return [...tools, { id: CREATE_PROJECT_TOOL_ID, type: "function", name: "create_project", config: [] }];
}
