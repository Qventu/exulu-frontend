"use client"

import * as React from "react";
import { ChatLayout } from "@/app/(application)/chat/[agent]/chat/[session]/chat";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { Agent } from "@EXULU_SHARED/models/agent";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@apollo/client";
import { GET_AGENT_BY_ID } from "@/queries/queries";

export const dynamic = "force-dynamic";

export default function SessionsPage({
  params,
}: {
  params: { session: string, agent: string };
}) {

  const { data, loading, error, refetch } = useQuery<{
    agentById: Agent
  }>(GET_AGENT_BY_ID, {
    variables: {
      id: params.agent,
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
        Error loading agent {error?.message}.
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

  return <ChatLayout session={params.session} agent={data.agentById} />;
}
