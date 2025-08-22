"use client";

import { useMutation } from "@apollo/client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useContext, useState, useMemo } from "react";
import { UserContext } from "@/app/(application)/authenticated";
import { AgentCard } from "@/app/(application)/agents/components/agent-card";
import { CreateNewAgentCard } from "@/app/(application)/agents/components/create-new-agent-card";
import { CREATE_AGENT } from "@/queries/queries";
import { Agent } from "@EXULU_SHARED//models/agent";
import { agents } from "@/util/api";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AgentsPage() {
  const router = useRouter();
  const { user } = useContext(UserContext);
  const company = user.company;
  const [searchQuery, setSearchQuery] = useState("");

  const { isLoading, error, data } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const response = await agents.get({});
      const results: Agent[] = await response.json();
      console.log("[EXULU] agents", results);
      return results;
    }
  });

  // Filter agents based on search query
  const filteredAgents = useMemo(() => {
    if (!data) return [];
    if (!searchQuery.trim()) return data;
    
    return data.filter(agent =>
      agent.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data, searchQuery]);

  const [createAgent, createAgentResult] = useMutation(
    CREATE_AGENT,
    {
      onCompleted: (data: {
        agentsCreateOne: { id: string, type: "chat" };
      }) => {
        console.log(data);
        router.push(`/agents/edit/${data?.agentsCreateOne?.id}`, {
          scroll: false,
        });
      },
    },
  );

  const handleAgentSelect = (agent: Agent) => {
    router.push(`/agents/edit/${agent.id}`, { scroll: false });
  };


  if (error) {
    return (
      <div className="container mx-auto py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Error loading agents</h1>
        <p className="text-muted-foreground">
          There was an error loading your agents. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Agents</h1>
        <p className="text-muted-foreground mb-6">
          Manage your AI agents and create new ones.
        </p>
        
        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Loading skeleton cards */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-80 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Create new agent card */}
          <CreateNewAgentCard 
            createAgent={createAgent}
            createAgentResult={createAgentResult}
            company={company}
          />
          
          {/* Agent cards */}
          {filteredAgents.map((agent: Agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onSelect={handleAgentSelect}
            />
          ))}
        </div>
      )}

      {/* No agents at all */}
      {!isLoading && (!data || data.length === 0) && (
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-4">No agents found</h2>
          <p className="text-muted-foreground mb-6">
            Get started by creating your first AI agent
          </p>
          <div className="flex justify-center">
            <CreateNewAgentCard 
              createAgent={createAgent}
              createAgentResult={createAgentResult}
              company={company}
            />
          </div>
        </div>
      )}

      {/* No agents match search */}
      {!isLoading && data && data.length > 0 && filteredAgents.length === 0 && (
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-4">No agents match your search</h2>
          <p className="text-muted-foreground mb-6">
            Try adjusting your search query or create a new agent
          </p>
          <div className="flex justify-center">
            <CreateNewAgentCard 
              createAgent={createAgent}
              createAgentResult={createAgentResult}
              company={company}
            />
          </div>
        </div>
      )}
    </div>
  );
}
