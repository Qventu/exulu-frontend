import { ChatLayout } from "@/app/(application)/chat/[agent]/[session]/chat";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { GET_AGENT_BY_ID, GET_AGENT_MESSAGES, GET_AGENT_SESSION_BY_ID } from "@/queries/queries";
import { fetchGraphQLServerSide } from "@/util/fetch-graphql-server-side";

export const dynamic = "force-dynamic";

export default async function SessionsPage({
  params,
}: {
  params: Promise<{ session: string, agent: string }>;
}) {
  const { session, agent } = await params;

  try {

    if (session === "new") {

      // Fetch agent data with project context if available
      const agentData = await fetchGraphQLServerSide(
        GET_AGENT_BY_ID.loc?.source.body || "",
        {
          id: agent,
        }
      );

      if (!agentData?.agentById) {
        return <Alert variant="destructive">
          <ExclamationTriangleIcon className="size-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Agent not found.
          </AlertDescription>
        </Alert>
      }

      return <ChatLayout
        session={null}
        agent={agentData.agentById}
        initialMessages={[]}
      />;
    }

    // Fetch session data first
    const sessionData = await fetchGraphQLServerSide(
      GET_AGENT_SESSION_BY_ID.loc?.source.body || "",
      { id: session }
    );

    const messageHistory = await fetchGraphQLServerSide(
      GET_AGENT_MESSAGES.loc?.source.body || "",
      {
        page: 1,
        limit: 50,
        filters: {
          session: {
            eq: session
          }
        },
      }
    );

    let initialMessages = [];

    if (messageHistory?.agent_messagesPagination) {
      initialMessages = messageHistory?.agent_messagesPagination?.items?.map((item) => (JSON.parse(item.content)));
    }

    if (!sessionData?.agent_sessionById) {
      return <Alert variant="destructive">
        <ExclamationTriangleIcon className="size-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Session not found.
        </AlertDescription>
      </Alert>
    }

    // Fetch agent data with project context if available
    const agentData = await fetchGraphQLServerSide(
      GET_AGENT_BY_ID.loc?.source.body || "",
      {
        id: agent,
        project: sessionData.agent_sessionById.project || undefined
      }
    );

    if (!agentData?.agentById) {
      return <Alert variant="destructive">
        <ExclamationTriangleIcon className="size-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Agent not found.
        </AlertDescription>
      </Alert>
    }

    return <ChatLayout
      session={sessionData.agent_sessionById}
      agent={agentData.agentById}
      initialMessages={initialMessages}
    />;




  } catch (error) {
    return <Alert variant="destructive">
      <ExclamationTriangleIcon className="size-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        {error instanceof Error ? error.message : "Error loading agent or session"}
      </AlertDescription>
    </Alert>
  }
}
