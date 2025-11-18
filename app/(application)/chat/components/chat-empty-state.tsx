"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Sparkles, Eye, ThumbsUp } from "lucide-react";
import { usePrompts } from "@/hooks/use-prompts";
import { useMutation, useQuery } from "@apollo/client";
import { CREATE_AGENT_SESSION, GET_AGENTS_BY_IDS } from "@/queries/queries";
import { PromptLibrary } from "@/types/models/prompt-library";
import { Agent } from "@/types/models/agent";
import { extractVariables } from "@/lib/prompts/extract-variables";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserContext } from "@/app/(application)/authenticated";
import { useContext } from "react";

export function ChatEmptyState() {

  const router = useRouter();
  const { user } = useContext(UserContext);

  const [createAgentSession] = useMutation(
    CREATE_AGENT_SESSION,
  );

  // Fetch prompts (limit to top 6 most popular)
  const { data: promptsData, loading: promptsLoading } = usePrompts({
    page: 1,
    limit: 6,
    sort: { field: "favorite_count", direction: "DESC" },
  });

  const prompts = promptsData?.prompt_libraryPagination?.items || [];

  // Get all unique agent IDs from prompts
  const allAgentIds = Array.from(
    new Set(
      prompts.flatMap((prompt) => prompt.assigned_agents || [])
    )
  );

  // Fetch agents for those IDs
  const { data: agentsData, loading: agentsLoading } = useQuery(GET_AGENTS_BY_IDS, {
    variables: { ids: allAgentIds },
    skip: allAgentIds.length === 0,
  });

  const agents: Agent[] = agentsData?.agentByIds || [];

  // Create a map of agent ID to agent for quick lookup
  const agentMap = new Map(agents.map((agent) => [agent.id, agent]));

  const handleAgentSelect = async (agentId: string, promptId: string) => {

    const result = await createAgentSession({
      variables: {
        title: "New session",
        user: user.id,
        agent: agentId,
      }
    })
    console.log("result", result)
    const sessionId = result?.data?.agent_sessionsCreateOne?.item?.id

    // Navigate to chat with agent and pass prompt template info via query params
    router.push(`/chat/${agentId}/${sessionId}?promptId=${promptId}`);
  };

  if (promptsLoading) {
    return (
      <div className="m-auto max-w-4xl w-full px-4">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-4 mb-8">
            <Bot className="h-20 w-20 text-muted-foreground" />
            <h2 className="text-2xl font-semibold text-center">Select an agent</h2>
            <p className="text-muted-foreground text-center">
              Choose a prompt template below to get started
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!prompts.length) {
    return (
      <div className="m-auto">
        <div className="flex flex-col">
          <div className="mx-auto">
            <Bot className="h-20 w-20" />
          </div>
          <h2 className="text-center">Select an agent.</h2>
          <small className="text-center">Bleep bleep bloop...</small>
        </div>
      </div>
    );
  }

  return (
    <div className="m-auto max-w-4xl w-full px-4 py-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-4 mb-4">
          <div className="relative">
            <Bot className="h-16 w-16 text-muted-foreground" />
            <Sparkles className="h-6 w-6 text-primary absolute -top-1 -right-1" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2">Get started with a prompt</h2>
            <p className="text-muted-foreground">
              Select a prompt template and choose which agent to chat with
            </p>
          </div>
        </div>

        {/* Prompt Templates Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {prompts.map((prompt) => {
            const variables = extractVariables(prompt.content);
            const assignedAgentIds = prompt.assigned_agents || [];
            const assignedAgents = assignedAgentIds
              .map((id) => agentMap.get(id))
              .filter((agent): agent is Agent => agent !== undefined);

            return (
              <Card key={prompt.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <CardTitle className="text-lg">{prompt.name}</CardTitle>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3" />
                        <span>{prompt.favorite_count || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        <span>{prompt.usage_count || 0}</span>
                      </div>
                    </div>
                  </div>
                  {prompt.description && (
                    <CardDescription className="line-clamp-2">
                      {prompt.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="flex-1 flex flex-col gap-4">
                  {/* Tags and Variables */}
                  <div className="flex flex-wrap gap-1.5">
                    {variables.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {variables.length} variable{variables.length !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    {prompt.tags?.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {prompt.tags && prompt.tags.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{prompt.tags.length - 3}
                      </Badge>
                    )}
                  </div>

                  {/* Agent Selection CTAs */}
                  {assignedAgents.length > 0 ? (
                    <div className="mt-auto">
                      <p className="text-xs text-muted-foreground mb-2">
                        Start chat with:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {assignedAgents.map((agent) => (
                          <Button
                            key={agent.id}
                            variant="default"
                            size="sm"
                            onClick={() => handleAgentSelect(agent.id, prompt.id)}
                            className="flex items-center gap-2"
                          >
                            {agent.image && (
                              <img
                                src={agent.image}
                                alt={agent.name}
                                className="h-4 w-4 rounded-full object-cover"
                              />
                            )}
                            <span>{agent.name}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-auto">
                      <p className="text-xs text-muted-foreground italic">
                        No agents assigned to this prompt
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="text-center text-sm text-muted-foreground mt-4">
          You can also select an agent from the sidebar to start chatting
        </div>
      </div>
    </div>
  );
}
