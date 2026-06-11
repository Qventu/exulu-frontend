"use client";

import {createGraphiQLFetcher} from "@graphiql/toolkit";
import { GraphiQL } from 'graphiql';
import React from "react";
import 'graphiql/setup-workers/webpack';
import 'graphiql/style.css';
import '../../graphiql.css';
import { getToken } from "@/lib/api/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { ConfigContext } from "@/components/config-context";

export default function GraphiQLComponent() {

    const configContext = React.useContext(ConfigContext);

    const [data, setData] = React.useState<string | undefined>(undefined);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<Error | null>(null);

    React.useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setError(null);
        getToken()
            .then((token) => {
                if (cancelled) return;
                setData(token);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err instanceof Error ? err : new Error(String(err)));
            })
            .finally(() => {
                if (cancelled) return;
                setIsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

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
