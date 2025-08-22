"use client"

import {
    ChevronLeftIcon,
    ChevronRightIcon,
    DoubleArrowLeftIcon, ExclamationTriangleIcon,
} from "@radix-ui/react-icons";
import { keepPreviousData, useQuery, useMutation } from "@tanstack/react-query";
import {
    ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    SortingState,
    useReactTable,
    VisibilityState,
} from "@tanstack/react-table";
import {
    Archive,
    Download,
    PackageOpen,
    Plus,
    Trash2,
} from "lucide-react";
import {
    usePathname,
    useRouter,
    useSearchParams,
} from "next/navigation";
import * as React from "react";
import { useContext, useState } from "react";
import { UserContext } from "@/app/(application)/authenticated";
import { items } from "@/util/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loading } from "@/components/ui/loading";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { columns } from "./columns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Tooltip,
    TooltipContent, TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { SearchBar } from "./search-bar";
import { Item } from "@EXULU_SHARED/models/item";

function usePagination() {
    const [pagination, setPagination] = useState({
        pageSize: 5,
        pageIndex: 0,
    });
    const { pageSize, pageIndex } = pagination;

    return {
        limit: pageSize,
        onPaginationChange: setPagination,
        pagination,
        skip: pageSize * pageIndex,
    };
}

export function DataList({
    activeFolder,
    activeItem,
    archived,
}: {
    activeFolder: "archived" | "csv" | "api" | "files" | "all";
    activeItem?: string;
    archived: boolean;
}) {

    const path = usePathname();
    const params = useSearchParams();
    const page = params.get("page") ? parseInt(params.get("page")!) : 1;
    const search = params.get("search");
    const { user } = useContext(UserContext);
    const { toast } = useToast();
    const [company, setCompany] = useState<any>({ ...user.company });
    const [exporting, setExporting] = React.useState(false);

    const router = useRouter();

    const csv = async () => {

        setExporting(true);
        try {
            if (table.getSelectedRowModel().rows?.length) {
                const ids = table.getSelectedRowModel().rows.map((row) => row.original.id);
                // todo allow export of specific ids
            }
            // todo get query from query params
            const response: any = await items.export({ context: activeFolder });
            const csvData = await response.text();
            const blob = new Blob([csvData], { type: "text/csv" });
            const link = document.createElement("a");
            link.href = window.URL.createObjectURL(blob);
            link.download = new Date().toISOString() + "_items_export.csv";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error(e);
            // todo: show error message toast
        }
        setExporting(false);
    };

    const [rowSelection, setRowSelection] = React.useState({});

    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({});

    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
        [],
    );
    const [sorting, setSorting] = React.useState<SortingState>([]);

    const fetchItems = async () => {
    
        console.log("[EXULU] fetchItems", page, search);
        // todo get query from query params
        const response = await items.list({
            context: activeFolder,
            archived,
            ...(search ? { name: search } : {}),
        }, page ?? 1, 10);

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
        queryKey: ["GetItems", page, search],
        staleTime: 0,
        placeholderData: keepPreviousData,
        queryFn: () => fetchItems(),
    });

    const updateItemMutation = useMutation<any, Error, {
        context: string;
        id: string;
        item: {
            name?: string;
            archived?: boolean;
            description?: string;
            tags?: string[];
            external_id?: string;
            [key: string]: any;
        }
    }>({
        mutationFn: async (parameters) => {
            const response = await items.update({
                context: parameters.context,
                id: parameters.id,
                item: parameters.item,
            });
            return await response.json();
        },
        onSuccess: () => {
            itemsData.refetch();
        }
    });

    const deleteItemMutation = useMutation<any, Error, {
        context: string,
        id: string,
    }>({
        mutationFn: async (parameters) => {
            const response = await items.delete({ context: parameters.context, id: parameters.id });
            return await response.json();
        },
        onSuccess: () => {
            itemsData.refetch();
        }
    });
    const defaultData = React.useMemo(() => [], []);
    const { limit, onPaginationChange, skip, pagination } = usePagination();

    const table = useReactTable({
        data: itemsData.data?.items ?? defaultData,
        pageCount: itemsData?.data?.pagination?.pageCount ?? -1,
        columns,
        state: {
            sorting,
            columnVisibility,
            rowSelection,
            columnFilters,
        },
        enableRowSelection: true,
        onRowSelectionChange: setRowSelection,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues(),
        manualPagination: true,
        onPaginationChange,
    });

    const createItemMutation = useMutation<any, Error, {
        context: string
        item: {
            name?: string
            description?: string
            tags?: string[]
            external_id?: string
            [key: string]: any
        }
    }>({
        mutationFn: async (parameters) => {
            const response = await items.create({ context: parameters.context, item: parameters.item });
            return await response.json();
        },
        onSuccess: (data) => {
            itemsData.refetch();
            toast({
                title: "Item created",
                description: "Item created successfully.",
            })
            selectItem(data.id);
        }
    });

    const setParams = ({
        page,
        search,
    }: {
        page?: number;
        search?: string;
    }) => {
        const params = new URLSearchParams();
        if (page) {
            params.set("page", page.toString());
        }
        if (search) {
            params.set("search", search);
        }
        router.push(`${path}?${params.toString()}`);
    }

    const selectItem = (id: string) => {
        if (archived) {
            router.push(`/data/${activeFolder}/archived/${id}?${params.toString()}`)
        } else {
            router.push(`/data/${activeFolder}/${id}?${params.toString()}`)
        }
    }

    if (itemsData.error) return <Alert className="p-4" variant="destructive">
        <ExclamationTriangleIcon className="size-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
            {itemsData.error?.message || ": unknown"}
        </AlertDescription>
    </Alert>;

    return (
        <>
            <div
                className="grid grid-flow-col grid-cols-[auto_minmax(0,1fr)] grid-rows-1 bg-background/95 p-4 backdrop-blur gap-2 supports-[backdrop-filter]:bg-background/60">
                <Checkbox
                    checked={
                        table.getIsAllPageRowsSelected() ||
                        (table.getIsSomePageRowsSelected() && "indeterminate")
                    }
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                    className="my-auto mr-3 translate-y-[2px]"
                />
                <div className="relative">
                    <SearchBar onSearch={(query) => {
                        setParams({
                            page: 1,
                            search: query,
                        })
                    }} />
                </div>
                <Button
                    onClick={() => {
                        createItemMutation.mutate({
                            context: activeFolder,
                            item: {
                                name: "New item",
                                source: "manual",
                                textLength: 0,
                                company: company.id,
                            },
                        });
                    }}
                    disabled={createItemMutation.isPending || archived}
                    className="ml-2 ml-auto lg:flex">
                    {createItemMutation.isPending ? <Loading /> : <Plus size={18} />}
                </Button>
            </div>
            {table.getIsSomeRowsSelected() || table.getIsAllRowsSelected() ? (
                <div className="flex px-4 pb-4">

                    <TooltipProvider>
                        <Tooltip delayDuration={100}>
                            <TooltipTrigger asChild>
                                <Button onClick={csv} variant="secondary" disabled={exporting}>
                                    {exporting ? <Loading /> : <Download className="size-4" />}
                                    <span className="ml-2">Export</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Max. 10.000</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {archived ? (
                        <>
                            <Button
                                className="ml-2"
                                onClick={() => {
                                    const promises: any[] = [];
                                    table.getSelectedRowModel().rows.forEach((row) => {
                                        promises.push(
                                            updateItemMutation.mutate({
                                                context: activeFolder,
                                                id: row.original.id,
                                                item: { archived: false },
                                            }),
                                        );
                                    });
                                    Promise.all(promises).then(() => {
                                        table.resetRowSelection();
                                        toast({
                                            title: "Unarchived items",
                                            description:
                                                "We unarchived " + promises.length + " items.",
                                        });
                                    });
                                }}
                                variant="secondary"
                                disabled={updateItemMutation.isPending}
                            >
                                {updateItemMutation.isPending ? (
                                    <Loading />
                                ) : (
                                    <PackageOpen className="size-4" />
                                )}
                                <span className="ml-2">Unarchive selected</span>
                            </Button>
                            <Button
                                className="ml-2"
                                onClick={() => {
                                    const promises: any[] = [];
                                    table.getSelectedRowModel().rows.forEach((row) => {
                                        promises.push(
                                            deleteItemMutation.mutate({
                                                context: activeFolder,
                                                id: row.original.id,
                                            }),
                                        );
                                    });
                                    Promise.all(promises).then(() => {
                                        table.resetRowSelection();
                                        toast({
                                            title: "Deleted items",
                                            description: "We deleted " + promises.length + " items.",
                                        });
                                    });
                                }}
                                variant="secondary"
                                disabled={deleteItemMutation.isPending}
                            >
                                {deleteItemMutation.isPending ? (
                                    <Loading />
                                ) : (
                                    <Trash2 className="size-4" />
                                )}
                                <span className="ml-2">Delete selected</span>
                            </Button>
                        </>
                    ) : (
                        <Button
                            className="ml-2"
                            onClick={() => {
                                const promises: any[] = [];
                                table.getSelectedRowModel().rows.forEach((row) => {
                                    promises.push(
                                        updateItemMutation.mutate({
                                            context: activeFolder,
                                            id: row.original?.id,
                                            item: { archived: true },
                                        }),
                                    );
                                });
                                Promise.all(promises).then(() => {
                                    table.resetRowSelection();
                                    toast({
                                        title: "Archived items",
                                        description: "We archived " + promises.length + " items.",
                                    });
                                });
                            }}
                            variant="secondary"
                            disabled={updateItemMutation.isPending}
                        >
                            {updateItemMutation.isPending ? (
                                <Loading />
                            ) : (
                                <Archive className="size-4" />
                            )}
                            <span className="ml-2">Archive selected</span>
                        </Button>
                    )}
                </div>
            ) : null}
            {itemsData.isLoading ? (
                <ScrollArea className="h-screen">
                    <div className="flex flex-col gap-2 p-4 pt-0">
                        <Skeleton className="mb-2 h-[100px] w-full rounded-lg" />
                        <Skeleton className="mb-2 h-[100px] w-full rounded-lg" />
                        <Skeleton className="mb-2 h-[100px] w-full rounded-lg" />
                        <Skeleton className="mb-2 h-[100px] w-full rounded-lg" />
                        <Skeleton className="mb-2 h-[100px] w-full rounded-lg" />
                        <Skeleton className="h-[100px] w-full rounded-lg" />
                    </div>
                </ScrollArea>
            ) : (
                <div className="flex max-h-[75vh] flex-col">
                    <ScrollArea className="h-screen grow">
                        <div className="space-y-4">
                            <div className="border-y">
                                <Table>
                                    <TableBody>
                                        {itemsData.isLoading ? (
                                            <tr>
                                                <td>Loading</td>
                                            </tr>
                                        ) : table.getRowModel().rows?.length ? (
                                            table.getRowModel().rows.map((row) => (
                                                <TableRow
                                                    key={row.id}
                                                    className={cn(
                                                        activeItem === row.original.id
                                                            ? "bg-secondary dark:text-white"
                                                            : "",
                                                    )}
                                                    data-state={row.getIsSelected() && "selected"}>
                                                    {row.getVisibleCells().map((cell, index) => {
                                                        if (index > 0) {
                                                            return (<TableCell className="cursor-pointer" onClick={() => {
                                                               selectItem(row.original.id)
                                                            }} key={cell.id}>
                                                                {flexRender(
                                                                    cell.column.columnDef.cell,
                                                                    cell.getContext(),
                                                                )}
                                                            </TableCell>)
                                                        } else {
                                                            return (<TableCell key={cell.id}>
                                                                {flexRender(
                                                                    cell.column.columnDef.cell,
                                                                    cell.getContext(),
                                                                )}
                                                            </TableCell>)
                                                        }
                                                    })}
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={columns.length}
                                                    className="h-24 text-center"
                                                >
                                                    {"No results."}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </ScrollArea>
                    <div className="flex items-center justify-between px-2 pb-2">
                        <div className="flex-1 text-sm text-muted-foreground">
                            {table.getFilteredSelectedRowModel().rows.length} of{" "}
                            {table.getFilteredRowModel().rows.length} row(s) selected (total{" "}
                            {itemsData.data?.pagination.totalCount} items).
                        </div>
                        {/*todo pagination*/}
                        <div className="flex items-center space-x-6 lg:space-x-8">
                            <div className="flex items-center space-x-2">
                                <Button
                                    variant="outline"
                                    className="hidden size-8 p-0 lg:flex"
                                    onClick={() => {
                                        setParams({
                                            page: 1,
                                            search: search ?? undefined,
                                        });
                                    }}
                                    disabled={!itemsData.data?.pagination.previousPage}
                                >
                                    <span className="sr-only">Go to first page</span>
                                    <DoubleArrowLeftIcon className="size-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    className="size-8 p-0"
                                    onClick={() => {
                                        console.log(
                                            "itemsData.data?.pageInfo.hasPreviousPage",
                                            itemsData.data?.pagination.previousPage,
                                        );
                                        setParams({
                                            page: itemsData.data?.pagination.previousPage ?? undefined,
                                            search: search ?? undefined,
                                        });
                                    }}
                                    disabled={
                                        !itemsData.data?.pagination.previousPage ||
                                        itemsData.isRefetching ||
                                        itemsData.isFetching
                                    }
                                >
                                    <span className="sr-only">Go to previous page</span>
                                    <ChevronLeftIcon className="size-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    className="size-8 p-0"
                                    onClick={() => {
                                        setParams({
                                            page: itemsData.data?.pagination.nextPage ?? undefined,
                                            search: search ?? undefined,
                                        });
                                    }}
                                    disabled={
                                        !itemsData.data?.pagination.nextPage ||
                                        itemsData.isRefetching ||
                                        itemsData.isFetching
                                    }>
                                    <span className="sr-only">Go to next page</span>
                                    <ChevronRightIcon className="size-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
