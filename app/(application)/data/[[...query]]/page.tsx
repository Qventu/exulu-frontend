"use client";

import { DataDisplay } from "@/app/(application)/data/components/data-display";
import * as React from "react";
import ContextsDashboard from "../components/contexts-dashboard";
import { ContextEmbeddings } from "../components/embeddings";
import { useQuery } from "@apollo/client";
import { GET_CONTEXT_BY_ID } from "@/queries/queries";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { ContextSources } from "../components/sources";
import { ContextProcessors } from "../components/processors";

export default function DataPage({
  params,
}: { params: { query }; }) {

  const { data, loading, error } = useQuery(GET_CONTEXT_BY_ID, {
    skip: !params?.query?.[0],
    variables: {
      id: params?.query?.[0]
    }
  })

  if (!params.query) {
    return <div className="grow flex flex-col">
      <ContextsDashboard />
    </div>;
  }

  const context = params.query[0] || null;
  const archived = params.query[1] === "archived" || false;
  const sources = params.query[1] === "sources" || false;
  const embeddings = params.query[1] === "embeddings" || false;
  const processors = params.query[1] === "processors" || false;

  if (sources) {
    return <ContextSources expand={true} actions={true} context={context} />;
  }
  if (embeddings) {
    return <ContextEmbeddings expand={true} actions={true} context={context} />;
  }
  if (processors) {
    return <ContextProcessors expand={true} actions={true} context={context} />;
  }

  let item = null;
  if (archived) {
    item = params.query[2] || null;
  } else if (!sources && !embeddings) {
    item = params.query[1] || null;
  }

  if (loading || !data?.contextById) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Skeleton className="w-full h-[80px] rounded-md" />
        <Skeleton className="w-full h-[50px] rounded-md mt-3" />
        <Skeleton className="w-full h-[80px] rounded-md mt-3" />
        <Skeleton className="w-full h-[80px] rounded-md mt-3" />
        <Skeleton className="w-full h-[80px] rounded-md mt-3" />
        <Skeleton className="w-full h-[80px] rounded-md mt-3" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <ExclamationTriangleIcon className="size-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          {error?.message || "Error loading item."}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <DataDisplay
      actions={true}
      context={data?.contextById}
      itemId={item}
    />
  );
}
