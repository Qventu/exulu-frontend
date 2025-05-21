"use client";

import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons";
import { ArrowLeft, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Loading } from "@/components/ui/loading";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useContexts } from "@/hooks/contexts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Item } from "@EXULU_SHARED/models/item";
import { items } from "@/util/api";
import { Context } from "@EXULU_SHARED/models/context";

export function ItemSelector({
  navigate,
  onSelect,
  params,
  ...props
}: any) {

  const [open, setOpen] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState<Item | undefined>();
  const [selectedContext, setSelectedContext] = React.useState<Context | undefined>();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-label="Select a item..."
          aria-expanded={open}
          className="flex-1 justify-between md:max-w-[200px] lg:max-w-[300px]"
        >
          <span className="pr-3 w-100 truncate">{selectedItem ? selectedItem.name : "Select a item..."}</span>
          <CaretSortIcon className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          {
            !selectedContext ? (
              <ContextsList onSelect={(context: any) => {
                setSelectedContext(context);
              }} />
            ) : (
              <ItemsList onSelect={(item: Item) => {
                setSelectedItem(item);
                setOpen(false);
              }} onBack={() => {
                setSelectedContext(undefined);
              }} context={selectedContext} navigate={navigate} />
            )
          }

        </Command>
      </PopoverContent>
    </Popover>
  );
}

const ContextsList = ({ onSelect }: { onSelect: (context: Context) => void }) => {


  const contextsQuery = useContexts();

  return (
    <CommandList className="h-[var(--cmdk-list-height)] max-h-[400px]">
      {contextsQuery.isLoading ? (
        <CommandItem key={"loading"}>
          <Loading />
        </CommandItem>
      ) : (
        <CommandGroup>
          {contextsQuery.data?.map((item: any) => (
            <CommandItem
              key={item.id}
              onSelect={() => {
                onSelect(item);
              }}
            >
              {item.name ? item.name : item.id}
            </CommandItem>
          ))}
          <CommandEmpty>No items found.</CommandEmpty>
        </CommandGroup>
      )}
    </CommandList>
  )
}

const ItemsList = ({ context, navigate, onSelect, onBack }: { context: Context, navigate: boolean, onSelect: (item: Item) => void, onBack: () => void }) => {

  let [search, setSearch]: any = useState<string | undefined>();
  const router = useRouter();
  const pathname = usePathname();

  const fetchItems = async () => {
    const response = await items.list({
      context: context.id,
      archived: false,
      ...(search ? { name: search } : {}),
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
    queryKey: ["GetItems", search],
    staleTime: 0,
    placeholderData: keepPreviousData,
    queryFn: () => fetchItems(),
  });

  const searchParams = useSearchParams();

  // Get a new searchParams string by merging the current
  // searchParams with a provided key/value pair
  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(name, value);

      return params.toString();
    },
    [searchParams],
  );

  useEffect(() => {
    itemsData.refetch();
  }, [search]);

  return (<CommandList className="h-[var(--cmdk-list-height)] max-h-[400px]">
    <div
      className="flex items-center border-b pl-1 pr-3 mb-2"
      cmdk-input-wrapper=""
    >
      <Button variant="ghost" size="icon" onClick={() => {
        if (onBack) {
          onBack();
        }
      }}>
        <ArrowLeft className="mx-2 size-4" />
      </Button>
      <Search className="mx-2 size-4 shrink-0 opacity-50" />
      {/* Note: we use a custom input instead of the CommandInput because the CommandInput has a bug when retrieving data via useQuery */}
      <Input
        onKeyUp={(e) => {
          const searchString = e.currentTarget.value;
          setSearch(searchString);
        }}
        placeholder="Search items..."
        className={cn(
          "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-0 focus-visible:ring-offset-0 border-0",
        )}
      />
    </div>
    {itemsData.isLoading ? (
      <CommandItem key={"loading"}>
        <Loading />
      </CommandItem>
    ) : (
      <CommandGroup>
        <CommandItem disabled={true} key={context.id}>
          <span>
            {context.name}
          </span>
        </CommandItem>
        {itemsData.data?.items?.map((item: Item) => (
          <CommandItem
            key={item.id}
            onSelect={() => {
              if (!item.id) return;
              if (navigate) {
                router.push(
                  pathname + "?" + createQueryString("item", item.id) + createQueryString("context", context.id),
                );
              }
              if (onSelect) {
                onSelect(item);
              }
            }}
          >
            {item.name ? item.name : item.id}
          </CommandItem>
        ))}
        <CommandEmpty>No items found.</CommandEmpty>
      </CommandGroup>
    )}
  </CommandList>)
};
