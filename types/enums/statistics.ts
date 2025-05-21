export type STATISTICS_TYPE = "context.retrieve" | "source.update" | "embedder.upsert" | "embedder.delete" | "workflow.run" | "context.upsert" | "tool.call" | "agent.run";

export const STATISTICS_TYPE_ENUM = {
    CONTEXT_RETRIEVE: "context.retrieve",
    SOURCE_UPDATE: "source.update",
    EMBEDDER_UPSERT: "embedder.upsert",
    EMBEDDER_GENERATE: "embedder.generate",
    EMBEDDER_DELETE: "embedder.delete",
    WORKFLOW_RUN: "workflow.run",
    CONTEXT_UPSERT: "context.upsert",
    TOOL_CALL: "tool.call",
    AGENT_RUN: "agent.run"
};
