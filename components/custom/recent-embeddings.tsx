import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { useQuery } from "@apollo/client";
import { useRef } from "react";
import Link from "next/link";
import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TruncatedText } from "@/components/truncated-text";
import { Item } from "@/types/models/item";
import { GET_ITEMS, PAGINATION_POSTFIX } from "@/queries/queries";

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

  return loading ? (
    <div className="flex flex-col gap-2 pt-0">
      <Skeleton className="w-full h-[50px] rounded-lg mb-2" />
      <Skeleton className="w-full h-[50px] rounded-lg mb-2" />
      <Skeleton className="w-full h-[50px] rounded-lg" />
    </div>
  ) : (
    <div className="space-y-8">
      {data?.items?.length ? (
        data?.items?.map(
          (
            item: Item,
            index: number,
          ) => {
            return (
              <div key={index} className="flex items-center">
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">
                    <Link
                      className="hover:dark:text-blue-500 hover:underline"
                      href={"/data/" + contextId + "/" + item.id}
                    >
                      <TruncatedText text={item.name ?? ""} length={50} />
                      <p className="text-sm text-muted-foreground">
                        created at: {item.embeddings_updated_at ? formatDistanceToNow(new Date(item.embeddings_updated_at), {
                          addSuffix: true,
                        }) : "never"}.
                      </p>
                    </Link>
                  </p>
                </div>
              </div>
            );
          },
        )
      ) : (
        <div className="flex flex-col gap-2 pt-0">
          <p className="text-sm font-medium leading-none">No recent embeddings.</p>
        </div>
      )}
    </div>
  );
}
