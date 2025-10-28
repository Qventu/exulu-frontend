"use client";

import * as React from "react";
import AgentForm from "@/app/(application)/agents/edit/[id]/form";
import { useQuery } from "@apollo/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { GET_AGENT_BY_ID } from "@/queries/queries";
import { Agent } from "@/types/models/agent";
export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {

  const { data, loading, error, refetch } = useQuery<{
    agentById: Agent
  }>(GET_AGENT_BY_ID, {
    variables: {
      id: params.id,
    },
  });

  if (loading) {
    return <div>
      <Skeleton className="w-full h-full" />
    </div>
  }

  if (error) {
    return <Alert variant="destructive">
      <ExclamationTriangleIcon className="size-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        Error loading agent.
      </AlertDescription>
    </Alert>
  }

  if (!data?.agentById) {
    return <Alert variant="destructive">
      <ExclamationTriangleIcon className="size-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        Agent not found.
      </AlertDescription>
    </Alert>
  }

  return (
    <AgentForm
      agent={data.agentById}
      refetch={refetch}
    />
  );
}
