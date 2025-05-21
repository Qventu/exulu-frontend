"use client";

import * as React from "react";
import AgentForm from "@/app/(application)/agents/edit/[id]/form";
import { useQuery } from "@tanstack/react-query";
import { agents, auth, tools } from "@/util/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { Agent } from "@EXULU_SHARED/models/agent";
import { Tool } from "@EXULU_SHARED/models/tool";
export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {

  const agentQuery = useQuery({
    queryKey: ["agent", params.id],
    queryFn: async () => {
      const response = await agents.get({id: params.id});
      const agent: Agent = await response.json();
      console.log("[EXULU] agent", agent)
      return agent;
    }
  })

  const toolsQuery = useQuery({
    queryKey: ["tools"],
    queryFn: async () => {
      const response = await tools.get({});
      const json: Tool[] = await response.json();
      return json;
    }
  })

  if (agentQuery.isLoading || toolsQuery.isLoading) {
    return <div>
      <Skeleton className="w-full h-full" />
    </div>
  }

  if (agentQuery.error || toolsQuery.error) {
    return <Alert variant="destructive">
    <ExclamationTriangleIcon className="size-4" />
    <AlertTitle>Error</AlertTitle>
    <AlertDescription>
      Error loading agent.
    </AlertDescription>
  </Alert>
  } 

  if (!agentQuery.data || !toolsQuery.data) {
    return  <Alert variant="destructive">
    <ExclamationTriangleIcon className="size-4" />
    <AlertTitle>Error</AlertTitle>
    <AlertDescription>
      Agent not found.
    </AlertDescription>
  </Alert>
  }
  

  return (
    <AgentForm
      agent={agentQuery.data}
      tools={toolsQuery.data}
      refetch={agentQuery.refetch}
    />
  );
}
