import { DataDisplay } from "@/app/(application)/data/components/data-display";
import ContextsDashboard from "../components/contexts-dashboard";
import { ContextEmbeddings } from "../components/embeddings";
import { GET_CONTEXT_BY_ID } from "@/queries/queries";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { ContextSources } from "../components/sources";
import { ContextProcessors } from "../components/processors";
import { ContextEntityTypes } from "../components/entity-types";
import { fetchGraphQLServerSide } from "@/util/fetch-graphql-server-side";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function DataPage({
  params,
}: { params: Promise<{ query }>; }) {

  const { query } = await params;

  if (!query || !query[0]) {
    return <div className="grow flex flex-col">
      <ContextsDashboard />
    </div>;
  }

  try {

    const data = await fetchGraphQLServerSide(GET_CONTEXT_BY_ID.loc?.source.body || "", {
      id: query[0]
    });

    const context = query[0] || null;
    const archived = query[1] === "archived" || false;
    const sources = query[1] === "sources" || false;
    const embeddings = query[1] === "embeddings" || false;
    const processors = query[1] === "processors" || false;
    const entityTypes = query[1] === "entity-types" || false;

    if (sources) {
      return <ContextSources expand={true} actions={true} context={context} />;
    }
    if (embeddings) {
      return <ContextEmbeddings expand={true} actions={true} context={context} />;
    }
    if (processors) {
      return <ContextProcessors expand={true} actions={true} context={context} />;
    }
    if (entityTypes) {
      return <ContextEntityTypes expand={true} actions={true} context={context} />;
    }

    let item = null;
    if (archived) {
      item = query[2] || null;
    } else if (!sources && !embeddings && !processors && !entityTypes) {
      item = query[1] || null;
    }

    if (!data?.contextById) {
      return (
        <div className="p-8 text-center text-muted-foreground mr-5">
          {/* Not found */}
          <h1 className="text-2xl font-bold">Context not found</h1>
          <p className="text-sm text-muted-foreground">The context you are looking for does not exist.</p>
          <Button variant="outline" asChild>
            <Link href="/data">
              <ArrowLeft className="size-4" />
              <span className="ml-2">Back to dashboard</span>
            </Link>
          </Button>
        </div>
      )
    }

    return (
      <DataDisplay
        actions={true}
        context={data?.contextById}
        itemId={item}
      />
    );
  } catch (error: any) {
    return <Alert variant="destructive">
      <ExclamationTriangleIcon className="size-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        {error?.message || "Error loading item."}
      </AlertDescription>
    </Alert>
  }

}
