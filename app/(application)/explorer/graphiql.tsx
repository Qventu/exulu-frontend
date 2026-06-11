"use client";

import {createGraphiQLFetcher} from "@graphiql/toolkit";
import { GraphiQL } from 'graphiql';
import React from "react";
import 'graphiql/setup-workers/webpack';
import 'graphiql/style.css';
import '../../graphiql.css';
import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/api/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { ConfigContext } from "@/components/config-context";

export default function GraphiQLComponent() {

    const configContext = React.useContext(ConfigContext);

    const { data, isLoading, error } = useQuery({
        queryKey: ["user"],
        queryFn: () => getToken()
    });

    if (isLoading) {
        return <Skeleton className="h-10 w-20" /> 
    }

    if (error) {
        return   <Alert variant="destructive">
        <ExclamationTriangleIcon className="size-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
            {error.message}
        </AlertDescription>
      </Alert>
    }
    
    const fetcher = createGraphiQLFetcher({
        url: `${configContext?.backend}/graphql`, headers: {
            "Authorization": `Bearer ${data}`
        }
    });

    return <GraphiQL fetcher={fetcher}/>
}