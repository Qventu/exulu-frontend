"use client"

import { useQuery, useMutation } from "@apollo/client";
import {
    ArrowLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RecentEmbeddings } from "@/components/custom/recent-embeddings";
import { DELETE_CHUNKS, GENERATE_CHUNKS, GET_CONTEXT_BY_ID } from "@/queries/queries";
import { Context } from "@/types/models/context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";

interface DataDisplayProps {
    expand: boolean;
    actions: boolean;
    context: string
}

export function ContextEmbeddings(props: DataDisplayProps) {

    const [confirmationModal, setConfirmationModal] = useState<"generate" | "delete" | null>(null);
    const [sourcesOpen, setSourcesOpen] = useState(true);
    const [embeddingsOpen, setEmbeddingsOpen] = useState(true);
    const { toast } = useToast();
    const { data, loading, error } = useQuery<
        { contextById: Context }>(GET_CONTEXT_BY_ID, {
            variables: {
                id: props.context
            }
        });

    const context = data?.contextById;
    const router = useRouter();


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
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                    <RecentEmbeddings contextId={context.id} />
                </div>
            ) : (
                <div className="p-8 text-center text-muted-foreground">
                    Context not found.
                </div>
            )}

            <AlertDialog open={confirmationModal === "generate"} onOpenChange={(open) => !open && setConfirmationModal(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Generate Embeddings</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to generate embeddings for this context? This
                            will create new embedding vectors for every item in the context, this
                            can take a long time, might cost money if you are using a paid service
                            as your embedder, or require a lot of computational resources if your
                            embedder is self hosted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={generateChunksMutationResult.loading}
                            onClick={() => {
                                // TODO: Add API call to generate embeddings
                                setConfirmationModal(null);
                                generateChunksMutation();
                                toast({
                                    title: "Generating embeddings...",
                                    description: "Embeddings are being generated in the background, depending on the size of the item this may take a while.",
                                });
                            }}
                        >
                            Generate
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={confirmationModal === "delete"} onOpenChange={(open) => !open && setConfirmationModal(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Embeddings</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete all embeddings for this context? This action cannot be undone.
                            Embeddings are used to search and filter items, deleting them will remove
                            this functionality from the context, regenerating embeddings might take a
                            long time, might cost money if you are using a paid service as your embedder,
                            or require a lot of computational resources if your embedder is self hosted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={deleteChunksMutationResult.loading}
                            onClick={async () => {
                                setConfirmationModal(null);
                                deleteChunksMutation();
                                toast({
                                    title: "Embeddings deleted",
                                    description: "All embeddings for this item have been deleted.",
                                });
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}