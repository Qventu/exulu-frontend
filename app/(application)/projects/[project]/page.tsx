"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { ProjectDetails } from "@/components/project-details";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQuery } from "@apollo/client";
import { GET_PROJECT_BY_ID } from "@/queries/queries";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";

export default function ProjectPage() {
    const params = useParams();
    const projectId = params?.project as string;

    const { data, loading, error } = useQuery(GET_PROJECT_BY_ID, {
        variables: { id: projectId }
    });


    if (loading) {
        return <div>
            <Skeleton className="w-full h-full" />
        </div>
    }

    if (error) {
        return <Alert variant="destructive">
            <ExclamationTriangleIcon className="size-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
                Error loading project.
            </AlertDescription>
        </Alert>
    }

    if (!data?.projectById) {
        return <Alert variant="destructive">
            <ExclamationTriangleIcon className="size-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
                Project not found.
            </AlertDescription>
        </Alert>
    }

    return <ProjectDetails project={data.projectById} />;
}