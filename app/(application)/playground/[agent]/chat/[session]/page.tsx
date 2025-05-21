"use client"

import * as React from "react";
import { ChatLayout } from "@/app/(application)/playground/[agent]/chat/[session]/chat";
import { agents, auth } from "@/util/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { Agent } from "@EXULU_SHARED/models/agent";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

export default function SessionsPage({
  params,
}: {
  params: { session: string, agent: string };
}) {

  const query = useQuery({
    queryKey: ["agent", params.agent],
    queryFn: async () => {
      const response = await agents.get({id: params.agent});
      const agent: Agent = await response.json();
      console.log("[EXULU] agent", agent)
      
      const authentication = await auth.token()
      const { token } = await authentication.json()
  
      console.log("token", token)
  
      if (!token) {
        throw new Error("No valid session token available.")
      }

      return {
        ...agent,
        token: token
      };
    }
  })

  if (query.isLoading) {
    return <div>
      <Skeleton className="w-full h-full" />
    </div>
  }

  if (query.error) {
    return <Alert variant="destructive">
    <ExclamationTriangleIcon className="size-4" />
    <AlertTitle>Error</AlertTitle>
    <AlertDescription>
      Error loading agent.
    </AlertDescription>
  </Alert>
  } 

  if (!query.data) {
    return  <Alert variant="destructive">
    <ExclamationTriangleIcon className="size-4" />
    <AlertTitle>Error</AlertTitle>
    <AlertDescription>
      Agent not found.
    </AlertDescription>
  </Alert>
  }

  if (!query.data.token) {
    return  <Alert variant="destructive">
    <ExclamationTriangleIcon className="size-4" />
    <AlertTitle>Error</AlertTitle>
    <AlertDescription>
      No valid session token available, please try logging in again.
    </AlertDescription>
  </Alert>
  }

  return  <ChatLayout session={params.session} type={"chat"} agent={query.data} token={query.data.token} />;
}
