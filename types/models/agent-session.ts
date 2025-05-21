export interface AgentSession {
    createdAt: string;
    updatedAt: string;
    id: string;
    metadata: any;
    agentId: string;
    resourceId: string;
    title: string;
}
export interface AgentMessage {
    id: string;
    thread_id: string;
    content: string;
    role: "function" | "data" | "user" | "system" | "assistant" | "tool";
    type: string;
    createdAt: Date;
}