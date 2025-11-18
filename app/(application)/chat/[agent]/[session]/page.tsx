"use client"

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { ChatLayout } from "@/app/(application)/chat/[agent]/[session]/chat";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { Agent } from "@EXULU_SHARED/models/agent";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@apollo/client";
import { GET_AGENT_BY_ID, GET_AGENT_SESSION_BY_ID } from "@/queries/queries";
import { AgentSession } from "@/types/models/agent-session";

export const dynamic = "force-dynamic";

export default function SessionsPage({
  params,
}: {
  params: { session: string, agent: string };
}) {
  const searchParams = useSearchParams();
  const promptId = searchParams.get("promptId");

  const { data: agentData, loading: agentLoading, error: agentError } = useQuery<{
    agentById: Agent
  }>(GET_AGENT_BY_ID, {
    variables: {
      id: params.agent,
    },
  });

  const { data: sessionData, loading: sessionLoading, error: sessionError } = useQuery<{
    agent_sessionById: AgentSession;
  }>(GET_AGENT_SESSION_BY_ID, {
    returnPartialData: true,
    fetchPolicy: "network-only",
    nextFetchPolicy: "network-only",
    variables: {
      id: params.session
    },
  });

  if (sessionLoading || agentLoading) {
    return <div>
      <Skeleton className="w-full h-full" />
    </div>
  }

  if (sessionError || agentError) {
    return <Alert variant="destructive">
      <ExclamationTriangleIcon className="size-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        Error loading agent {agentError?.message || sessionError?.message}.
      </AlertDescription>
    </Alert>
  }

  if (!agentData?.agentById || !sessionData?.agent_sessionById) {
    return <Alert variant="destructive">
      <ExclamationTriangleIcon className="size-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        Agent or session not found.
      </AlertDescription>
    </Alert>
  }

  return <ChatLayout
    session={sessionData?.agent_sessionById}
    agent={agentData.agentById}
    initialPromptId={promptId || undefined}
  />;
}
