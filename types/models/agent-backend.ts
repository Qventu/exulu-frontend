// Represents an agent backend
// which is created and run in
// the agents service. Agents
// registered in Exulu must have
// a connected backend agent that
// does the actual work.
export interface AgentBackend {
    id: string
    name: string
    description: string
    enable_batch: boolean
    inputSchema: any;
    slug: string
    type: string
}