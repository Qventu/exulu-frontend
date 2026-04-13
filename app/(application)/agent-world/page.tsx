"use client";

import { AgentWorldCanvas } from "@/components/agent-world/AgentWorldCanvas";
import { useQuery } from "@apollo/client";
import { AGENT_WORLD_AGENTS } from "@/queries/queries";

function ActiveCount() {
  const { data } = useQuery(AGENT_WORLD_AGENTS, {
    pollInterval: 5000,
    fetchPolicy: "no-cache",
  });
  const count = data?.agentWorldAgents?.length ?? 0;
  return (
    <span className="text-sm text-muted-foreground">
      {count} active agent{count !== 1 ? "s" : ""}
    </span>
  );
}

export default function AgentWorldPage() {
  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Agent World</h1>
          <p className="text-xs text-muted-foreground">Live view of active AI agents</p>
        </div>
        <ActiveCount />
      </div>
      <div className="flex-1 relative overflow-hidden">
        <AgentWorldCanvas />
      </div>
    </div>
  );
}
