import { AgentSelectionModalContentWrapper } from "@/components/agent-selection-dialog";
import { GET_AGENTS } from "@/queries/queries";
import { fetchGraphQLServerSide } from "@/util/fetch-graphql-server-side";
import { redirect } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { Agent } from "@/types/models/agent";

export default async function ChatEmptyPage() {

    try {
        const agents = await fetchGraphQLServerSide(
            GET_AGENTS.loc?.source.body || "",
            {
                page: 1,
                limit: 200,
                filters: [{
                    active: {
                        eq: true
                    }
                }]
            }
        );

        if (!agents?.agentsPagination?.items?.length) {
            return <div className="flex h-full p-5">
                <Alert variant="info">
                    <ExclamationTriangleIcon className="size-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>No agents found</AlertDescription>
                    <AlertDescription>
                        You don't have permission to access any agents. Please contact your administrator.
                    </AlertDescription>
                </Alert>
            </div>;
        }

        // If only one agent available redirect to chat with that agent
        if (agents?.agentsPagination?.items?.length === 1) {
            redirect(`/chat/${agents?.agentsPagination?.items?.[0]?.id}`);
        }

        // find default agent where defaultagent is true
        const defaultAgent = agents?.agentsPagination?.items?.find((agent: Agent) => agent.defaultagent);
        if (defaultAgent) {
            redirect(`/chat/${defaultAgent?.id}`);
        }

        return <div className="h-full p-10">
            <h1 className="text-2xl font-bold mb-4">Select an agent</h1>
            <AgentSelectionModalContentWrapper />
        </div>
    } catch (error: any) {
        // Important: if you dont throw the redirect
        // error here it wont work and will just output
        // NEXT_REDIRECT as an error message.
        if (isRedirectError(error)) {
            throw error;
        }
        return <div className="flex h-full p-5">
            <Alert variant="destructive">
                <ExclamationTriangleIcon className="size-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                    {error instanceof Error ? error.message : "An unknown error occurred"}
                </AlertDescription>
            </Alert>
        </div>
    }
}