import { Context } from "@/types/models/context";
import { useContexts } from "@/hooks/contexts";
import { useState } from "react"
import { PlusSquareIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useQuery } from "@apollo/client";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Item } from "@/types/models/item";
import { GET_ITEMS, PAGINATION_POSTFIX } from "@/queries/queries";
import { Loading } from "./ui/loading";

export const ItemsSelectionModal = ({ onConfirm }: {
    onConfirm: (data: {
        item: Item,
        context: Context
    }[]) => void
}) => {
    // Shows a modal that first shows a list of all contexts

    const { data, loading, error } = useContexts();
    const [context, setContext] = useState<Context | undefined>(undefined);
    const [open, setOpen] = useState(false);

    return (<Dialog open={open} onOpenChange={(value) => {
        setOpen(value)
        setContext(undefined)
    }}>
        <DialogTrigger asChild>
            <Button className="w-full" variant="outline">
                <PlusSquareIcon className="h-4 w-4 mr-2" />
                Select items from knowledge sources
                to add to the project, or upload files.
            </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[900px]">
            <DialogHeader>
                <DialogTitle>Item selection</DialogTitle>
                <DialogDescription>Browse through contexts and select items.</DialogDescription>
            </DialogHeader>
            {
                !context && (
                    <Command className="rounded-lg border shadow-md md:min-w-[450px]">
                        <CommandInput placeholder="Type a command or search..." />
                        <CommandList>
                            <CommandEmpty>No results found.</CommandEmpty>

                            <CommandGroup heading="Contexts">
                                {
                                    data?.contexts?.items.map((context: Context) => (
                                        <CommandItem key={context.id} onSelect={() => {
                                            setContext(context)
                                        }}>
                                            {context.name}
                                        </CommandItem>
                                    ))
                                }
                            </CommandGroup>

                        </CommandList>
                    </Command>
                )
            }
            {
                context && (
                    <ItemsList context={context} onConfirm={(item) => {
                        console.log("item", item)
                        onConfirm([{
                            item,
                            context
                        }])
                        setOpen(false)
                    }} />
                )
            }
        </DialogContent>
    </Dialog>)
}

const ItemsList = ({ context, onConfirm }: { context: Context, onConfirm: (item: Item) => void }) => {
    const [search, setSearch] = useState<string | undefined>(undefined)
    let { loading, data, refetch, previousData: prev, error } = useQuery<{
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
    }>(GET_ITEMS(context.id, []), {
        fetchPolicy: "no-cache",
        nextFetchPolicy: "network-only",
        skip: !context.id,
        variables: {
            context: context.id,
            page: 1,
            limit: 10,
            sort: {
                field: "updatedAt",
                direction: "DESC",
            },
            filters: {
                archived: {
                    ne: true
                },
                ...(search ? { name: { contains: `${search}` } } : {}),
            },
        },
    });

    return (
        <Command className="rounded-lg border shadow-md md:min-w-[450px]">
            <CommandInput onValueChange={(data) => setSearch(data)} placeholder="Type a command or search..." />
            <CommandList>
                <CommandGroup heading="Items">
                    {
                        !prev && loading && (
                            <CommandItem key={"loading"}>
                                <Loading />
                            </CommandItem>
                        )
                    }
                    {
                        !loading && !data?.[context.id + PAGINATION_POSTFIX]?.items?.length && (
                            <CommandEmpty>No items found.</CommandEmpty>
                        )
                    }
                    {(data || prev)?.[context.id + PAGINATION_POSTFIX]?.items?.map((item: Item) => (
                        <CommandItem key={item.id} onSelect={() => {
                            onConfirm(item)
                        }}>{item.name}</CommandItem>
                    ))}
                </CommandGroup>
            </CommandList>
        </Command>
    )
}