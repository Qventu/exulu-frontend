"use client"

import { useQuery, useMutation } from "@apollo/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RecentEmbeddings } from "@/components/custom/recent-embeddings";
import { CREATE_EMBEDDER_CONFIG, DELETE_CHUNKS, GENERATE_CHUNKS, GET_CONTEXT_BY_ID, GET_EMBEDDER_CONFIGS, GET_VARIABLES, UPDATE_EMBEDDER_CONFIG } from "@/queries/queries";
import { Context } from "@/types/models/context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { DotsHorizontalIcon, ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { useToast } from "@/components/ui/use-toast";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Variable } from "@/types/models/variable";
import { VariableSelectionElement } from "../../agents/edit/[id]/form";
import {
    ChevronDown,
} from "lucide-react";
import { QueueManagement } from "../../evals/[id]/runs/components/queue-management";
import { QueueJob } from "@/types/models/job";
import {
    TooltipProvider,
} from "@/components/ui/tooltip";
import { ItemsFilter } from "./items-filter";

interface DataDisplayProps {
    expand: boolean;
    actions: boolean;
    context: string
}

export function ContextEmbeddings(props: DataDisplayProps) {

    const [embeddersOpen, setEmbeddersOpen] = useState(true);
    const [dialogRunEmbedderOpen, setDialogRunEmbedderOpen] = useState(false);
    const [dialogDeleteEmbeddingsOpen, setDialogDeleteEmbeddingsOpen] = useState(false);
    const { toast } = useToast();
    const { data, loading, error } = useQuery<
        { contextById: Context }>(GET_CONTEXT_BY_ID, {
            variables: {
                id: props.context
            }
        });

    const context = data?.contextById;

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

    const [generateChunksMutation, generateChunksMutationResult] = useMutation<{
        [key: string]: {
            jobs: string[];
            items: number;
        }
    }>(GENERATE_CHUNKS(props.context), {
        onCompleted: (output) => {
            const data = output[props.context + "_itemsGenerateChunks"];
            if (data.jobs?.length > 0) {
                toast({
                    title: "Chunks generation started",
                    description: "Jobs have been started in the background, depending on the size of the item this may take a while.",
                })
                return;
            }
            toast({
                title: "Chunks generated",
                description: "Chunks generated successfully.",
            })
        },
    });

    const [deleteChunksMutation, deleteChunksMutationResult] = useMutation<{
        [key: string]: {
            jobs: string[];
            items: number;
        }
    }>(DELETE_CHUNKS(props.context), {
        onCompleted: (output) => {
            const data = output[props.context + "_itemsDeleteChunks"];
            if (data.jobs?.length > 0) {
                toast({
                    title: "Chunks deletion started",
                    description: "Jobs have been started in the background, depending on the size of the item this may take a while.",
                })
                return;
            }
            toast({
                title: "Chunks deleted",
                description: "Chunks deleted successfully.",
            })
        },
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
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium mr-2">Embedder Configs:</span>
                                        <div className="mt-2 text-xs text-muted-foreground">
                                            {variables?.length && context?.embedder?.config?.map((config) => {
                                                const currentValue = embedderConfigs?.find(x => x.name === config.name);
                                                return (<div key={config.name} className="space-y-2">
                                                    <VariableSelectionElement
                                                        configItem={config}
                                                        disabled={false}
                                                        currentValue={currentValue?.value || ""}
                                                        variables={variables}
                                                        onVariableSelect={(variableName) => {
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
                                                </div>)
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                    <Card className="border-0 rounded-none">
                        <CardHeader>
                            <CardTitle>Embedders</CardTitle>
                            <CardDescription>
                                Embedders are used to generate embeddings for items.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {context.embedder ? (
                                <TooltipProvider>
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead>Trigger</TableHead>
                                                    <TableHead>Queue</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                <TableRow key={context.embedder?.name}>
                                                    <TableCell className="font-medium">{context.embedder?.name}</TableCell>
                                                    <TableCell className="max-w-[300px]">
                                                        {context.configuration.calculateVectors ? (
                                                            <Badge variant="outline">
                                                                {context.configuration.calculateVectors}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {context.embedder?.queue ? (
                                                            <div className="cursor-help">
                                                                <Badge variant="outline" className="cursor-help">
                                                                    {context.embedder?.queue}
                                                                </Badge>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <DropdownMenu modal={false}>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    className="flex size-8 p-0 data-[state=open]:bg-muted ml-auto">
                                                                    <DotsHorizontalIcon className="size-4" />
                                                                    <span className="sr-only">Open menu</span>
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={
                                                                    () => setDialogRunEmbedderOpen(true)
                                                                }>
                                                                    Generate embeddings
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={() => {
                                                                        setDialogDeleteEmbeddingsOpen(true);
                                                                    }}>
                                                                    Delete embeddings
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </div>
                                </TooltipProvider>
                            ) : (
                                <div className="text-center text-muted-foreground p-5 border rounded-md">
                                    No embedders found.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    <RecentEmbeddings contextId={context.id} />
                    <Collapsible open={embeddersOpen} onOpenChange={setEmbeddersOpen}>
                        <Card className="bg-none border-0 rounded-none">
                            <CardHeader>
                                <CollapsibleTrigger asChild>
                                    <div className="flex items-center justify-between cursor-pointer">
                                        <CardTitle>Queues</CardTitle>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                            <ChevronDown className={`h-4 w-4 transition-transform ${embeddersOpen ? "" : "-rotate-90"}`} />
                                            <span className="sr-only">Toggle sources queues</span>
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
                                                            if (!job.data?.item || !job.data?.context) {
                                                                toast({
                                                                    title: "Error retrying job",
                                                                    description: "Job data is missing.",
                                                                })
                                                                return;
                                                            }

                                                            generateChunksMutation({
                                                                variables: {
                                                                    where: [{
                                                                        id: {
                                                                            eq: job.data?.item,
                                                                        }
                                                                    }]
                                                                }
                                                            });

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

            <Dialog key="delete-embeddings" modal={true} open={dialogDeleteEmbeddingsOpen} onOpenChange={(open) => {
                setDialogDeleteEmbeddingsOpen(open);
            }}>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Delete Embeddings</DialogTitle>
                        <DialogDescription>
                            You can filter what items you want to delete embeddings for below.
                        </DialogDescription>
                    </DialogHeader>
                    <ItemsFilter ctaLabel="Confirm filters and delete embeddings"
                        context={props.context}
                        showPreview={true}
                        cancelLabel="Cancel"
                        onCancel={() => setDialogDeleteEmbeddingsOpen(false)}
                        onConfirm={async (filters, rawFilters, limit) => {
                            await deleteChunksMutation({
                                variables: {
                                    limit: limit,
                                    where: filters.length > 0 ? filters : undefined
                                }
                            });
                            return;
                        }} />
                </DialogContent>
            </Dialog>

            <Dialog key="run-embedder" modal={true} open={dialogRunEmbedderOpen} onOpenChange={(open) => {
                setDialogRunEmbedderOpen(open);
            }}>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Trigger Embedder</DialogTitle>
                        <DialogDescription>
                            {context?.embedder?.queue ? (
                                <>
                                    Configure filters to select which items to generate embeddings for. Jobs will be scheduled in the <span className="font-semibold">{context.embedder.queue}</span> queue.
                                </>
                            ) : (
                                <>
                                    Configure filters to select which items to generate embeddings for. The embedder will execute immediately.
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <ItemsFilter ctaLabel="Confirm filters and start processing"
                        showPreview={true}
                        context={props.context}
                        cancelLabel="Cancel"
                        onCancel={() => setDialogRunEmbedderOpen(false)}
                        onConfirm={async (filters, rawFilters, limit) => {
                            await generateChunksMutation({
                                variables: {
                                    limit: limit,
                                    where: filters.length > 0 ? filters : undefined,
                                }
                            });
                            return;
                        }} />
                </DialogContent>
            </Dialog>


        </div>
    );
}