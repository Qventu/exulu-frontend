"use client"

import {
    ChevronLeftIcon,
    ChevronRightIcon,
    DoubleArrowLeftIcon, ExclamationTriangleIcon,
} from "@radix-ui/react-icons";
import { useQuery, useMutation } from "@apollo/client";
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
import { SearchBar } from "./search-bar";
import { Item } from "@EXULU_SHARED/models/item";
import { CREATE_ITEM, CREATE_ONE_POSTFIX, DELETE_ITEM, GET_ITEMS, PAGINATION_POSTFIX, UPDATE_ITEM } from "@/queries/queries";

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
    const [page, setPage] = useState(params.get("page") ? parseInt(params.get("page")!) : 1);
    const search = params.get("search");
    const { user } = useContext(UserContext);
    const { toast } = useToast();
    const [company, setCompany] = useState<any>({ ...user.company });

    const router = useRouter();

    const [rowSelection, setRowSelection] = React.useState({});

    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({});

    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
        [],
    );
    const [sorting, setSorting] = React.useState<SortingState>([]);

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
    }>(GET_ITEMS(activeFolder, []), {
        fetchPolicy: "no-cache",
        nextFetchPolicy: "network-only",
        variables: {
            context: activeFolder,
            page: page ?? 1,
            limit: 10,
            sort: {
                field: "updatedAt",
                direction: "DESC",
            },
            filters: {
                archived: {
                    eq: archived
                },
                ...(search ? { name: { contains: `${search}` } } : {}),
            },
        },
    });

    const data = raw?.[activeFolder + PAGINATION_POSTFIX] as any;
    const previousData = prev?.[activeFolder + PAGINATION_POSTFIX] as any;

    const [updateItemMutation, updateItemMutationResult] = useMutation<{
        [key: string]: {
            job: string;
            item: {
                name?: string;
                archived?: boolean;
                description?: string;
                tags?: string[];
                external_id?: string;
                [key: string]: any;
            }
        }
    }>(UPDATE_ITEM(activeFolder), {
        onCompleted: () => {
            refetch();
        }
    });

    const [deleteItemMutation, deleteItemMutationResult] = useMutation<{
        id: string;
    }>(DELETE_ITEM(activeFolder, []), {
        onCompleted: () => {
            refetch();
        }
    });

    const defaultData = React.useMemo(() => [], []);
    const { limit, onPaginationChange, skip, pagination } = usePagination();

    const table = useReactTable({
        data: loading && previousData?.items ? previousData.items : data?.items ?? defaultData,
        pageCount: data?.pageInfo?.pageCount ?? -1,
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

    const [createItemMutation, createItemMutationResult] = useMutation<{
        [key: string]: {
            item: {
                id: string;
            }
            job: string;
        }
    }>(CREATE_ITEM(activeFolder), {
        onCompleted: (data) => {
            console.log("data", data);
            const id = data ? data[activeFolder + CREATE_ONE_POSTFIX]?.item?.id : undefined;
            if (id) {
                router.push(`/data/${activeFolder}/${id}`);
            }
            refetch();
        }
    });

    const setParams = ({
        page,
        search,
    }: {
        page?: number;
        search?: string;
    }) => {
        setPage(page ?? 1);
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

    if (error) return <Alert className="p-4" variant="destructive">
        <ExclamationTriangleIcon className="size-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
            {error?.message || ": unknown"}
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
                        createItemMutation({
                            variables: {
                                input: {
                                    name: "New item",
                                    source: "manual",
                                    textlength: 0,
                                    company: company.id,
                                },
                            }
                        });
                    }}
                    disabled={createItemMutationResult.loading || archived}
                    className="ml-2 ml-auto lg:flex">
                    {createItemMutationResult.loading ? <Loading /> : <Plus size={18} />}
                </Button>
            </div>
            {table.getIsSomeRowsSelected() || table.getIsAllRowsSelected() ? (
                <div className="flex px-4 pb-4">
                    {archived ? (
                        <>
                            <Button
                                className="ml-2"
                                onClick={() => {
                                    const promises: any[] = [];
                                    table.getSelectedRowModel().rows.forEach((row) => {
                                        promises.push(
                                            updateItemMutation({
                                                variables: {
                                                    id: row.original.id,
                                                    input: { archived: false },
                                                }
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
                                disabled={updateItemMutationResult.loading}>
                                {updateItemMutationResult.loading ? (
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
                                            deleteItemMutation({
                                                variables: {
                                                    context: activeFolder,
                                                    id: row.original.id,
                                                }
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
                                disabled={deleteItemMutationResult.loading}>
                                {deleteItemMutationResult.loading ? (
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
                                        updateItemMutation({
                                            variables: {
                                                id: row.original?.id,
                                                input: { archived: true },
                                            }
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
                            disabled={updateItemMutationResult.loading}
                        >
                            {updateItemMutationResult.loading ? (
                                <Loading />
                            ) : (
                                <Archive className="size-4" />
                            )}
                            <span className="ml-2">Archive selected</span>
                        </Button>
                    )}
                </div>
            ) : null}
            {loading ? (
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
                                        {table.getRowModel().rows?.length ? (
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
                            {data?.pageInfo.itemCount} items).
                        </div>
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
                                    disabled={!data?.pageInfo.hasPreviousPage}
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
                                            data?.pageInfo.hasPreviousPage,
                                        );
                                        setParams({
                                            page: data?.pageInfo.hasPreviousPage ? page - 1 : undefined,
                                            search: search ?? undefined,
                                        });
                                    }}
                                    disabled={
                                        !data?.pageInfo.hasPreviousPage ||
                                        loading
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
                                            page: data?.pageInfo.hasNextPage ? page + 1 : undefined,
                                            search: search ?? undefined,
                                        });
                                    }}
                                    disabled={
                                        !data?.pageInfo.hasNextPage ||
                                        loading
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
