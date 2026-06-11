import * as React from "react";
import { ChatSessionsComponent } from "./chat-sessions";
import { GET_AGENT_BY_ID } from "@/queries/queries";
import { fetchGraphQLServerSide } from "@/lib/graphql/server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";

export default async function ChatLayout({ children, params }: { children: React.ReactNode, params: Promise<{ agent: string }> }) {

  try {
    const { agent } = await params;
    const agentData = await fetchGraphQLServerSide(
      GET_AGENT_BY_ID.loc?.source.body || "",
      { id: agent }
    );

    if (!agentData?.agentById) {
      throw new Error("Agent with id " + agent + " not found");
    }

    return (
      <div className="w-full h-[100vh] flex">
        <ChatSessionsComponent agent={agentData?.agentById} type={"chat"} />
        {children}
      </div>
    );
  } catch (error: any) {
    return <div className="w-full h-[100vh] flex p-5">
      <Alert variant="destructive">
        <ExclamationTriangleIcon className="size-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : "An unknown error occurred"}
        </AlertDescription>
      </Alert>
    </div>;
  }
}