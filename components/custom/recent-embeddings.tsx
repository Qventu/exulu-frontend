import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { useQuery, useMutation } from "@apollo/client";
import { useRef } from "react";
import Link from "next/link";
import * as React from "react";
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
import { toast } from "sonner";
import { GENERATE_CHUNKS, DELETE_CHUNKS } from "@/queries/queries";
import { TruncatedText } from "@/components/truncated-text";
import { Item } from "@/types/models/item";
import { GET_ITEMS, PAGINATION_POSTFIX } from "@/queries/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";

export type FilterOperator = {
  eq?: string,
  ne?: string,
  in?: string[],
  contains?: string,
}

export type ItemsFilters = {
  context?: FilterOperator,
}

export function RecentEmbeddings({ contextId }: { contextId: string }) {
  const [confirmationModal, setConfirmationModal] = useState<"generate" | "delete" | null>(null);
  const [embeddingsOpen, setEmbeddingsOpen] = useState(true);
  // Make stable ref of date
  const twentyOneDaysAgoRef = useRef(new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString());
  let { loading, data: raw, refetch, previousData: prev, error } = useQuery<{
    [key: string]: {
      pageInfo: {
        pageCount: number;
        itemCount: number;
        currentPage: number;
        hasPreviousPage: boolean;
        hasNextPage: boolean;
      };
      items: Item[];
    }
  }>(GET_ITEMS(contextId, []), {
    fetchPolicy: "no-cache",
    nextFetchPolicy: "network-only",
    variables: {
      context: contextId,
      page: 1,
      limit: 5,
      filters: [{
        embeddings_updated_at: {
          // 21 days ago
          gte: twentyOneDaysAgoRef.current,
        },
      }],
      sort: {
        field: "embeddings_updated_at",
        direction: "DESC",
      }
    },
  });

  const [generateChunksMutation, generateChunksMutationResult] = useMutation<{
    [key: string]: {
      jobs: string[];
      items: number;
    }
  }>(GENERATE_CHUNKS(contextId), {
    onCompleted: (output) => {
      const data = output[contextId + "_itemsGenerateChunks"];
      if (data.jobs?.length > 0) {
        toast.success("Chunks generation started", {
          description: "Jobs have been started in the background, depending on the size of the item this may take a while.",
        })
        return;
      }
      toast.success("Chunks generated", {
        description: "Chunks generated successfully.",
      })
    },
  });

  const [deleteChunksMutation, deleteChunksMutationResult] = useMutation<{
    [key: string]: {
      jobs: string[];
      items: number;
    }
  }>(DELETE_CHUNKS(contextId), {
    onCompleted: (output) => {
      const data = output[contextId + "_itemsDeleteChunks"];
      if (data.jobs?.length > 0) {
        toast.success("Chunks deletion started", {
          description: "Jobs have been started in the background, depending on the size of the item this may take a while.",
        })
        return;
      }
      toast.success("Chunks deleted", {
        description: "Chunks deleted successfully.",
      })
    },
  });

  const data = raw?.[contextId + PAGINATION_POSTFIX] as any;

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 rounded-none">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <CardTitle>Recent Embeddings</CardTitle>
              <CardDescription>Items with embeddings updated in the last 21 days</CardDescription>
            </div>

            {loading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <div>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex size-8 p-0 data-[state=open]:bg-muted"
                >
                  <DotsHorizontalIcon className="size-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setConfirmationModal("generate")}>
                  Generate all embeddings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setConfirmationModal("delete");
                  }}
                >
                  Delete all embeddings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg">
          {data?.items?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No recent embeddings
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items?.map((item: Item, index: number) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      <Link
                        className="hover:text-blue-500 hover:underline"
                        href={`/data/${contextId}/${item.id}`}
                      >
                        <TruncatedText text={item.name || item.id || ""} length={100} />
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {item.embeddings_updated_at
                        ? formatDistanceToNow(new Date(item.embeddings_updated_at), {
                          addSuffix: true,
                        })
                        : "never"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>

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
                toast.info("Generating embeddings...", {
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
                toast.success("Embeddings deleted", {
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

    </Card>
  );
}
