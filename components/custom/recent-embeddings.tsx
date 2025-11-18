import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { useQuery } from "@apollo/client";
import { useRef } from "react";
import Link from "next/link";
import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
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
          <Badge variant="outline" className="gap-1.5">
            <span className="text-xs">{data?.items?.length || 0}</span>
            <span className="text-xs text-muted-foreground">items</span>
          </Badge>
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
                        <TruncatedText text={item.name || item.id || ""} length={50} />
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
    </Card>
  );
}
