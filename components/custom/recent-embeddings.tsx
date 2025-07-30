import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import Link from "next/link";
import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { items } from "@/util/api";
import { TruncatedText } from "@/components/truncated-text";
import { Item } from "@/types/models/item";

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

  const fetchItems = async () => {
    const response = await items.list({
      context: contextId,
      sort: "embeddings_updated_at",
      order: "desc",
    }, 1, 10);
    const data = await response.json();
    console.log("[EXULU] items", data);
    return data;
  };

  const itemsData = useQuery<{
    pagination: {
      pageCount: number;
      totalCount: number;
      currentPage: number | null;
      previousPage: number | null;
      nextPage: number | null;
    };
    items: Item[];
  }>({
    queryKey: ["GetItems", contextId, 1],
    staleTime: 0,
    placeholderData: keepPreviousData,
    queryFn: () => fetchItems(),
  });

  return itemsData.isLoading ? (
    <div className="flex flex-col gap-2 pt-0">
      <Skeleton className="w-full h-[50px] rounded-lg mb-2" />
      <Skeleton className="w-full h-[50px] rounded-lg mb-2" />
      <Skeleton className="w-full h-[50px] rounded-lg" />
    </div>
  ) : (
    <div className="space-y-8">
      {itemsData.data?.items.length ? (
        itemsData.data?.items?.map(
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
