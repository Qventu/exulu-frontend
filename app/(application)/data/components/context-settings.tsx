"use client"

import { useQuery } from "@apollo/client";
import {
    ArrowLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area"
import { RecentEmbeddings } from "@/components/custom/recent-embeddings";
import { GET_CONTEXT_BY_ID } from "@/queries/queries";
import { Context } from "@/types/models/context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";

interface DataDisplayProps {
    expand: boolean;
    actions: boolean;
    context: string
}

export function ContextSettings(props: DataDisplayProps) {

    const { data, loading, error } = useQuery<
        { contextById: Context }>(GET_CONTEXT_BY_ID, {
            variables: {
                id: props.context
            }
        });

    const context = data?.contextById;
    const router = useRouter();

    if (loading) {
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
        <div className="flex h-full flex-col">
            {props.actions ? (
                <>
                    <div className="flex p-2 justify-between">
                        <div className="flex items-center gap-2"></div>
                        <Button
                            onClick={() => {
                                router.push("/context");
                            }}
                            variant="ghost"
                            size="icon">
                            <ArrowLeft className="size-4" />
                            <span className="sr-only">Back</span>
                        </Button>
                    </div>
                    <Separator />
                </>
            ) : null}
            {context ? (
                <div className="flex flex-1 flex-col">
                    <Card className="border-0 rounded-none">
                        <CardHeader>
                            <CardTitle className="text-lg">Settings</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <ScrollArea className="max-h-[600px]">
                                <div className="space-y-6 pr-4">
                                    <div>
                                        <h2 className="text-xl font-bold">{context.name}</h2>
                                        <p className="text-muted-foreground mt-1">{context.description}</p>
                                        <div className="mt-3 flex items-center">
                                            <span className="text-sm font-medium mr-2">Embedder:</span>
                                            <Badge variant="outline">{context.embedder || "None"}</Badge>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium mr-2">Calculate Vectors:</span>
                                        <Badge variant="secondary">
                                            {context.configuration?.calculateVectors
                                                ? context.configuration.calculateVectors.charAt(0).toUpperCase() + context.configuration.calculateVectors.slice(1)
                                                : "Manual"}
                                        </Badge>
                                        <div className="mt-2 text-xs text-muted-foreground">
                                            <span className="block"><b>Manual</b>: Vectors are only calculated when triggered manually.</span>
                                            <span className="block"><b>On Update</b>: Vectors are recalculated whenever an item is updated.</span>
                                            <span className="block"><b>On Insert</b>: Vectors are calculated when a new item is inserted.</span>
                                            <span className="block"><b>Always</b>: Vectors are calculated on both insert and update operations.</span>
                                        </div>
                                    </div>
                                    {/* Default rights mode */}
                                    <div>
                                        <span className="text-sm font-medium mr-2">Default rights mode for new items in this context:</span>
                                        <div className="mt-2 text-xs text-muted-foreground">
                                            <span className="block"><b>Private</b>: Only the user who created the item can view it.</span>
                                            <span className="block"><b>Users</b>: Any user with access to the context can view the item.</span>
                                            <span className="block"><b>Roles</b>: Any user with the role assigned to the context can view the item.</span>
                                            <span className="block"><b>Public</b>: Any user can view the item.</span>
                                        </div>
                                    </div>
                                    <Separator />
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    {/* TODO change to show recently updated or generated embeddings based on the embeddings_updated_at field on the context items */}
                    <Card className="bg-none border-0 rounded-none">
                        <CardHeader>
                            <CardTitle>Recent embedding generations</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <RecentEmbeddings
                                contextId={context.id}
                            />
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <div className="p-8 text-center text-muted-foreground">
                    Context not found.
                </div>
            )}
        </div>
    );
}