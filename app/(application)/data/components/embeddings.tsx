"use client"

import { useQuery, useMutation } from "@apollo/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RecentEmbeddings } from "@/components/custom/recent-embeddings";
import { CREATE_EMBEDDER_CONFIG, GET_CONTEXT_BY_ID, GET_EMBEDDER_CONFIGS, GET_VARIABLES, UPDATE_EMBEDDER_CONFIG } from "@/queries/queries";
import { Context } from "@/types/models/context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { useToast } from "@/components/ui/use-toast";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Variable } from "@/types/models/variable";
import { VariableSelectionElement } from "../../agents/edit/[id]/form";
import {
    ArrowLeft,
    ChevronDown,
} from "lucide-react";
import { QueueManagement } from "../../evals/[id]/runs/components/queue-management";
import { QueueJob } from "@/types/models/job";

interface DataDisplayProps {
    expand: boolean;
    actions: boolean;
    context: string
}

export function ContextEmbeddings(props: DataDisplayProps) {


    const [sourcesOpen, setSourcesOpen] = useState(true);
    const { toast } = useToast();
    const { data, loading, error } = useQuery<
        { contextById: Context }>(GET_CONTEXT_BY_ID, {
            variables: {
                id: props.context
            }
        });

    const context = data?.contextById;
    const router = useRouter();

    const [updateEmbedderConfigs, updateEmbedderConfigsResult] = useMutation<{
        embedder_settingsUpdateOneById: {
            item: {
                id: string;
            }
        }
    }>(UPDATE_EMBEDDER_CONFIG, {
        onCompleted: (output) => {
            refetchEmbedderConfigs();
            toast({
                title: "Embedder configs updated",
                description: "Embedder configs updated successfully.",
            })
        },
        onError: (error) => {
            refetchEmbedderConfigs();
            toast({
                title: "Error updating embedder configs",
                description: error.message,
            })
        }
    });

    const [createEmbedderConfig, createEmbedderConfigResult] = useMutation<{
        embedder_settingsCreateOne: {
            item: {
                id: string;
            }
        }
    }>(CREATE_EMBEDDER_CONFIG, {
        onCompleted: (output) => {
            refetchEmbedderConfigs();
            toast({
                title: "Embedder configs created",
                description: "Embedder configs created successfully.",
            })
        },
        onError: (error) => {
            refetchEmbedderConfigs();
            toast({
                title: "Error creating embedder configs",
                description: error.message,
            })
        }
    });

    const { data: embedderConfigsData, loading: loadingEmbedderConfigsData, refetch: refetchEmbedderConfigs } = useQuery<{
        embedder_settingsPagination: {
            items: {
                id: string;
                name: string;
                value: string;
                updatedAt: string;
                createdAt: string;
            }[]
        }
    }>(GET_EMBEDDER_CONFIGS, {
        skip: !context?.embedder?.id,
        variables: {
            context: props.context,
            embedder: context?.embedder?.id
        }
    });

    const embedderConfigs = embedderConfigsData?.embedder_settingsPagination?.items || [];

    const { data: variablesData } = useQuery<{
        variablesPagination: {
            items: Variable[]
        }
    }>(GET_VARIABLES, {
        variables: { page: 1, limit: 100 },
    });

    const variables = variablesData?.variablesPagination?.items || [];

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
                                            <Badge variant="outline">{context.embedder?.name || "None"} ({context.embedder?.id})</Badge>
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
                                    <div>
                                        <span className="text-sm font-medium mr-2">Embedder Configs:</span>
                                        <div className="mt-2 text-xs text-muted-foreground">
                                            {variables?.length && context?.embedder?.config?.map((config) => {

                                                const currentValue = embedderConfigs?.find(x => x.name === config.name);
                                                console.log("currentValue", currentValue);
                                                console.log("embedderConfigs", embedderConfigs);
                                                console.log("config", config);
                                                return (<div key={config.name} className="space-y-2">
                                                    <VariableSelectionElement
                                                        configItem={config}
                                                        currentValue={currentValue?.value || ""}
                                                        variables={variables}
                                                        onVariableSelect={(variableName) => {
                                                            console.log("variableName", variableName);
                                                            if (currentValue) {
                                                                updateEmbedderConfigs({
                                                                    variables: {
                                                                        id: currentValue.id,
                                                                        name: config.name,
                                                                        value: variableName,
                                                                    }
                                                                });
                                                            } else {
                                                                createEmbedderConfig({
                                                                    variables: {
                                                                        name: config.name,
                                                                        value: variableName,
                                                                        context: props.context,
                                                                        embedder: context?.embedder?.id
                                                                    }
                                                                });
                                                            }

                                                        }} />
                                                    <span>
                                                        {config.description}
                                                    </span>
                                                </div>)
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    <RecentEmbeddings contextId={context.id} />

                    <Collapsible open={sourcesOpen} onOpenChange={setSourcesOpen}>
                        <Card className="bg-none border-0 rounded-none">
                            <CardHeader>
                                <CollapsibleTrigger asChild>
                                    <div className="flex items-center justify-between cursor-pointer">
                                        <CardTitle>Queues</CardTitle>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                            <ChevronDown className={`h-4 w-4 transition-transform ${sourcesOpen ? "" : "-rotate-90"}`} />
                                            <span className="sr-only">Toggle sources</span>
                                        </Button>
                                    </div>
                                </CollapsibleTrigger>
                            </CardHeader>
                            <CollapsibleContent>
                                <CardContent>
                                    {
                                        context.embedder?.queue ? (
                                            <div className="space-y-4">
                                                <div key={context.embedder?.queue}>
                                                    <QueueManagement
                                                        queueName={context.embedder?.queue}
                                                        nameGenerator={(job) => {
                                                            return `Source update`;
                                                        }}
                                                        retryJob={(job: QueueJob) => {
                                                            if (!job.data?.source || !job.data?.context) {
                                                                return;
                                                            }
                                                            // todo trigger job
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ) : <div className="text-center text-muted-foreground p-5 border rounded-md">No queues found.</div>
                                    }
                                </CardContent>
                            </CollapsibleContent>
                        </Card>
                    </Collapsible>
                </div>
            ) : (
                <div className="p-8 text-center text-muted-foreground">
                    Context not found.
                </div>
            )}


        </div>
    );
}