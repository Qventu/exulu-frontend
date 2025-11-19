"use client"

import { useQuery, useMutation } from "@apollo/client";
import {
    ArrowLeft,
    ChevronDown,
    Play,
    Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { GET_CONTEXT_BY_ID, EXECUTE_SOURCE } from "@/queries/queries";
import { Context } from "@/types/models/context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { QueueManagement } from "../../evals/[id]/runs/components/queue-management";
import { QueueJob } from "@/types/models/job";
import { toast } from "sonner";

interface DataDisplayProps {
    expand: boolean;
    actions: boolean;
    context: string
}

export function ContextSources(props: DataDisplayProps) {

    const [sourcesOpen, setSourcesOpen] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedSource, setSelectedSource] = useState<{
        id: string;
        name: string;
        queue?: string;
        params?: { name: string; description: string; default: string }[]
    } | null>(null);
    const [paramValues, setParamValues] = useState<Record<string, string>>({});

    const { data, loading, error } = useQuery<
        { contextById: Context }>(GET_CONTEXT_BY_ID, {
            variables: {
                id: props.context
            }
        });

    const context = data?.contextById;
    const router = useRouter();

    const [executeSource, { loading: executingSource }] = useMutation(
        EXECUTE_SOURCE(props.context),
        {
            onCompleted: (data) => {
                const result = data[`${props.context}_itemsExecuteSource`];
                setDialogOpen(false);
                setSelectedSource(null);
                setParamValues({});

                toast.success(result.message || "Source executed successfully", {
                    description: result.jobs?.length
                        ? `${result.jobs.length} job(s) scheduled`
                        : result.items?.length
                            ? `${result.items.length} item(s) processed`
                            : undefined
                });
            },
            onError: (error) => {
                toast.error("Failed to execute source", {
                    description: error.message
                });
            }
        }
    );

    const handleTriggerSource = (
        sourceId: string,
        sourceName: string,
        queueName?: string,
        params?: { name: string; description: string; default: string }[]
    ) => {
        setSelectedSource({ id: sourceId, name: sourceName, queue: queueName, params });

        // Initialize param values with defaults
        if (params) {
            const initialValues: Record<string, string> = {};
            params.forEach(param => {
                initialValues[param.name] = param.default || '';
            });
            setParamValues(initialValues);
        }

        setDialogOpen(true);
    };

    const confirmTrigger = () => {
        if (!selectedSource) return;

        executeSource({
            variables: {
                source: selectedSource.id,
                inputs: paramValues
            }
        });
    };


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

    let queues: string[] = [];
    if (context) {
        queues = Array.from(
            new Set(
                context.sources
                    .map(source => source.config.queue)
                    .filter((queue): queue is string => Boolean(queue))
            )
        );
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
                                    </div>
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    <Card className="border-0 rounded-none">
                        <CardHeader>
                            <CardTitle>Sources</CardTitle>
                            <CardDescription>
                                Sources are used to fetch external data and ingest them into the context.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {context.sources && context.sources.length > 0 ? (
                                <TooltipProvider>
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead>Description</TableHead>
                                                    <TableHead>Queue Configuration</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {context.sources.map((source) => {
                                                    const hasQueueConfig = source.config.queue ||
                                                        source.config.schedule ||
                                                        source.config.retries !== undefined ||
                                                        source.config.backoff;

                                                    return (
                                                        <TableRow key={source.id}>
                                                            <TableCell className="font-medium">{source.name}</TableCell>
                                                            <TableCell className="max-w-[300px]">
                                                                {source.description || '-'}
                                                            </TableCell>
                                                            <TableCell>
                                                                {hasQueueConfig ? (
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <div className="cursor-help">
                                                                                {source.config.queue ? (
                                                                                    <Badge variant="outline" className="cursor-help">
                                                                                        {source.config.queue}
                                                                                    </Badge>
                                                                                ) : (
                                                                                    <span className="text-muted-foreground">No queue configured</span>
                                                                                )}
                                                                            </div>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent className="max-w-[300px]">
                                                                            <div className="space-y-2">
                                                                                {source.config.queue && (
                                                                                    <div>
                                                                                        <span className="font-semibold text-xs">Queue:</span>
                                                                                        <span className="ml-2 text-xs">{source.config.queue}</span>
                                                                                    </div>
                                                                                )}
                                                                                {source.config.schedule && (
                                                                                    <div>
                                                                                        <span className="font-semibold text-xs">Schedule:</span>
                                                                                        <code className="ml-2 text-xs bg-muted px-1 py-0.5 rounded">
                                                                                            {source.config.schedule}
                                                                                        </code>
                                                                                    </div>
                                                                                )}
                                                                                {source.config.retries !== undefined && (
                                                                                    <div>
                                                                                        <span className="font-semibold text-xs">Retries:</span>
                                                                                        <span className="ml-2 text-xs">{source.config.retries || "Default (3)"}</span>
                                                                                    </div>
                                                                                )}
                                                                                {source.config.backoff && (
                                                                                    <div>
                                                                                        <span className="font-semibold text-xs">Backoff:</span>
                                                                                        <span className="ml-2 text-xs">
                                                                                            {source.config.backoff.type || "Default (exponential)"} ({source.config.backoff.delay || "Default (2000)"}ms)
                                                                                        </span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                ) : (
                                                                    <span className="text-muted-foreground">-</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleTriggerSource(
                                                                        source.id,
                                                                        source.name,
                                                                        source.config.queue,
                                                                        source.config.params
                                                                    )}
                                                                    title="Manually trigger source"
                                                                >
                                                                    <Play className="h-4 w-4" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </TooltipProvider>
                            ) : (
                                <div className="text-center text-muted-foreground p-5 border rounded-md">
                                    No sources found.
                                </div>
                            )}
                        </CardContent>
                    </Card>

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
                                        queues.length > 0 ? (
                                            <div className="space-y-4">
                                                {queues.map(queueName => (
                                                    <div key={queueName}>
                                                        <QueueManagement
                                                            queueName={queueName}
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
                                                ))}
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

            <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) {
                    setParamValues({});
                    setSelectedSource(null);
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Trigger Source</DialogTitle>
                        <DialogDescription>
                            {selectedSource?.queue ? (
                                <>
                                    Are you sure you want to trigger <strong>{selectedSource.name}</strong>?
                                    <br />
                                    <br />
                                    A job will be scheduled and visible in the <Badge variant="outline" className="mx-1">{selectedSource.queue}</Badge> queue.
                                </>
                            ) : (
                                <>
                                    Are you sure you want to trigger <strong>{selectedSource?.name}</strong>?
                                    <br />
                                    <br />
                                    The source will be executed immediately without queuing.
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedSource?.params && selectedSource.params.length > 0 && (
                        <div className="space-y-4 py-4">
                            <div className="text-sm font-medium">Parameters</div>
                            {selectedSource.params.map((param) => (
                                <div key={param.name} className="space-y-2">
                                    <Label htmlFor={param.name}>
                                        {param.name}
                                        {param.description && (
                                            <span className="ml-2 text-xs text-muted-foreground font-normal">
                                                {param.description}
                                            </span>
                                        )}
                                    </Label>
                                    <Input
                                        id={param.name}
                                        value={paramValues[param.name] || ''}
                                        onChange={(e) => {
                                            setParamValues(prev => ({
                                                ...prev,
                                                [param.name]: e.target.value
                                            }));
                                        }}
                                        placeholder={param.default || ''}
                                        disabled={executingSource}
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDialogOpen(false)}
                            disabled={executingSource}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={confirmTrigger}
                            disabled={executingSource}
                        >
                            {executingSource ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Executing...
                                </>
                            ) : (
                                <>
                                    <Play className="mr-2 h-4 w-4" />
                                    Trigger Source
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}