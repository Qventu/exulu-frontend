import AgentForm from "@/app/(application)/agents/edit/[id]/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { GET_AGENT_BY_ID } from "@/queries/queries";
import { fetchGraphQLServerSide } from "@/lib/graphql/server";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {

  const { id } = await params;

  try {
    const agentData = await fetchGraphQLServerSide(
      GET_AGENT_BY_ID.loc?.source.body || "",
      {
        id: id,
      }
    );

    if (!agentData?.agentById) {
      return <Alert variant="destructive">
        <ExclamationTriangleIcon className="size-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Error loading agent.
        </AlertDescription>
      </Alert>
    }

    return (
      <AgentForm
        agent={agentData.agentById}
      />
    );

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
