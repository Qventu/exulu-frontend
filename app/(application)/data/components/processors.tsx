"use client"

import { useQuery } from "@apollo/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RecentEmbeddings } from "@/components/custom/recent-embeddings";
import { GET_CONTEXT_BY_ID } from "@/queries/queries";
import { Context } from "@/types/models/context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
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

export function ContextProcessors(props: DataDisplayProps) {


    const [processorsOpen, setProcessorsOpen] = useState(true);
    const router = useRouter();

    const { data, loading, error } = useQuery<
        { contextById: Context }>(GET_CONTEXT_BY_ID, {
            variables: {
                id: props.context
            }
        });

    const context = data?.contextById;


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
                            <div className="space-y-6 pr-4">
                                <div>
                                    <h2 className="text-xl font-bold">{context.name}</h2>
                                    <p className="text-muted-foreground mt-1">{context.description}</p>
                                    <div className="mt-3 flex items-center">
                                        <span className="text-sm font-medium mr-2">Embedder:</span>
                                        <Badge variant="outline">{context.embedder?.name || "None"} ({context.embedder?.id})</Badge>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Collapsible open={processorsOpen} onOpenChange={setProcessorsOpen}>
                        <Card className="bg-none border-0 rounded-none">
                            <CardHeader>
                                <CollapsibleTrigger asChild>
                                    <div className="flex items-center justify-between cursor-pointer">
                                        <CardTitle>Processors</CardTitle>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                            <ChevronDown className={`h-4 w-4 transition-transform ${processorsOpen ? "" : "-rotate-90"}`} />
                                            <span className="sr-only">Toggle processors</span>
                                        </Button>
                                    </div>
                                </CollapsibleTrigger>
                            </CardHeader>
                            <CollapsibleContent>
                                <CardContent>
                                    {
                                        context.processors?.map(processor => (
                                            <div key={processor.queue} className="space-y-4 mb-6">
                                                <Card className="border-l-4 border-l-primary">
                                                    <CardHeader>
                                                        <CardTitle className="text-base flex items-center justify-between">
                                                            <span>{processor.field}</span>
                                                            <Badge variant="outline">{processor.queue}</Badge>
                                                        </CardTitle>
                                                        {processor.description && (
                                                            <p className="text-sm text-muted-foreground">{processor.description}</p>
                                                        )}
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                                                            <div className="space-y-1">
                                                                <p className="text-xs text-muted-foreground">Trigger</p>
                                                                <Badge variant="secondary" className="font-mono text-xs">
                                                                    {processor.trigger}
                                                                </Badge>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <p className="text-xs text-muted-foreground">Timeout</p>
                                                                <Badge variant="secondary" className="font-mono text-xs">
                                                                    {processor.timeoutInSeconds}s
                                                                </Badge>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <p className="text-xs text-muted-foreground">Embeddings</p>
                                                                <Badge
                                                                    variant={processor.generateEmbeddings ? "default" : "secondary"}
                                                                    className="text-xs"
                                                                >
                                                                    {processor.generateEmbeddings ?
                                                                        "Enabled, this means embeddings will be generated after the processor finishes executing" :
                                                                        "Disabled, this means embeddings will not be generated after the processor finishes executing"
                                                                    }
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                        <Separator className="my-4" />
                                                        <QueueManagement
                                                            queueName={processor.queue}
                                                            nameGenerator={(job) => {
                                                                return `Processor update`;
                                                            }}
                                                            retryJob={(job: QueueJob) => {
                                                                if (!job.data?.source || !job.data?.context) {
                                                                    return;
                                                                }
                                                                // todo trigger job
                                                            }}
                                                        />
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        ))}
                                    {context.processors?.length === 0 && <div className="text-center text-muted-foreground p-5 border rounded-md">No queues found.</div>}
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