"use client";

import { DataDisplay } from "@/app/(application)/data/components/data-display";
import * as React from "react";
import ContextsDashboard from "../components/contexts-dashboard";
import { ContextSettings } from "../components/context-settings";
import { useQuery } from "@apollo/client";
import { GET_CONTEXT_BY_ID } from "@/queries/queries";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";

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
  const settings = params.query[1] === "settings" || false;

  if (settings) {
    return <ContextSettings expand={true} actions={true} context={context} />;
  }

  let item = null;
  if (archived) {
    item = params.query[2] || null;
  } else if (!settings) {
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
