"use client";

import {createGraphiQLFetcher} from "@graphiql/toolkit";
import {GraphiQL} from "graphiql";
import React from "react";
import 'graphiql/graphiql.css';
import '../../graphiql.css';
import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/util/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";

export default function GraphiQLComponent() {

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
    
    console.log("token", data)

    const fetcher = createGraphiQLFetcher({
        url: `${process.env.NEXT_PUBLIC_BACKEND}/graphql`, headers: {
            "Authorization": `Bearer ${data}`
        }
    });

    return <GraphiQL fetcher={fetcher}/>
}