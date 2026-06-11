import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PromptPreview } from "../components/prompt-preview";
import { fetchGraphQLServerSide } from "@/lib/graphql/server";
import { GET_PROMPT_BY_ID } from "@/queries/queries";

export default async function PromptDetailPage({ params }: { params: Promise<{ id: string }> }) {

  const { id } = await params;
  const data = await fetchGraphQLServerSide(GET_PROMPT_BY_ID.loc?.source.body || "", { id });

  const prompt = data?.prompt_library_itemById;

  if (!data?.prompt_library_itemById) {
    return (
      <div className="h-full flex-1 flex flex-col items-center justify-center p-8">
        <div className="max-w-md text-center space-y-4">
          <h2 className="text-2xl font-bold">Prompt not found</h2>
          <p className="text-muted-foreground">
            The prompt you're looking for doesn't exist or you don't have permission to view it.
          </p>
          <Button asChild variant="outline">
            <a href="/prompts">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Prompts
            </a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex-1 flex flex-col p-4 sm:p-6 lg:p-8">
      {/* Back button */}
      <div className="mb-6">
        <Button
          size="sm"
          asChild
          variant="outline"
          className="hover:bg-accent"
        >
          <a href="/prompts">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Prompts
          </a>
        </Button>
      </div>

      {/* Prompt preview - full width */}
      <div className="flex-1 min-h-0">
        <PromptPreview
          prompt={prompt}
        />
      </div>
    </div>
  );
}
