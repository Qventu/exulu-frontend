"use client";

import { useMutation, useQuery } from "@apollo/client";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Cross2Icon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
} from "@radix-ui/react-icons";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  Row,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as React from "react";
import {
  GET_VARIABLES,
  REMOVE_VARIABLE_BY_ID,
} from "@/queries/queries";
import { DataTableViewOptions } from "./data-table-view-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loading } from "@/components/ui/loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { FilterOperator } from "@/components/custom/recent-jobs";

export type VariableFilters = {
  name?: FilterOperator,
  encrypted?: FilterOperator,
  createdAt?: FilterOperator,
  updatedAt?: FilterOperator,
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
}

export function usePagination() {
  const [pagination, setPagination] = useState({
    pageSize: 10,
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

export function DataTable<TData, TValue>({
  columns,
}: DataTableProps<TData, TValue>) {
  const { toast } = useToast();
  const router = useRouter();
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );

  const [filters, setFilters] = useState<VariableFilters[]>([]);

  let [page, setPage] = useState(1);
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const { loading, error, data, refetch, previousData } = useQuery(GET_VARIABLES, {
    fetchPolicy: "no-cache",
    nextFetchPolicy: "network-only",
    variables: {
      page: page,
      limit: 10,
      filters: filters,
    },
    pollInterval: 30000,
  });

  const defaultData = React.useMemo(() => [], []);
  const { limit, onPaginationChange, skip, pagination } = usePagination();

  const [removeVariable, removeVariableResult] = useMutation(REMOVE_VARIABLE_BY_ID, {
    refetchQueries: [
      GET_VARIABLES,
      "GetVariables",
    ],
  });

  let items;
  let pageCount;
  if (loading && previousData?.variablesPagination?.items) {
    items = previousData?.variablesPagination?.items;
    pageCount = previousData?.variablesPagination?.pageInfo?.pageCount;
  } else if (data?.variablesPagination?.items) {
    items = data?.variablesPagination?.items;
    pageCount = data?.variablesPagination?.pageInfo?.pageCount;
  } else if (previousData?.variablesPagination?.items) {
    items = previousData?.variablesPagination?.items;
    pageCount = previousData?.variablesPagination?.pageInfo?.pageCount;
  }

  const table = useReactTable({
    data: items ?? defaultData,
    pageCount: pageCount ?? -1,
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

  const search = (value: string) => {
    const copy = [...filters];
    const exists = copy.find((filter) => filter.name);
    if (exists?.name) {
      exists.name.contains = value;
    } else {
      copy.push({
        name: {
          contains: value,
        },
      });
    }
    setFilters(copy);
    refetch();
  };

  const isFiltered = filters.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Input
            placeholder="Filter variables..."
            value={filters?.find((filter) => filter.name)?.name?.contains ?? ""}
            onChange={(event) => {
              search(event.target.value);
            }}
            className="w-[150px] lg:w-[250px]"
          />

          <Button
            onClick={() => {
              router.push("/variables/create");
            }}
          >
            <Plus className="mr-2 size-4" />
            Add Variable
          </Button>

          {table.getIsSomeRowsSelected() || table.getIsAllRowsSelected() ? (
            <div className="flex gap-x-2">
              <Button
                onClick={() => {
                  const promises: any[] = [];
                  table.getSelectedRowModel().rows.forEach((row: Row<any>) => {
                    promises.push(
                      removeVariable({
                        variables: {
                          id: row.original.id,
                        },
                      }),
                    );
                  });
                  Promise.all(promises).then(() => {
                    table.resetRowSelection();
                    toast({
                      title: "Variables deleted",
                      description: "Successfully deleted " + promises.length + " variable(s).",
                    });
                  }).catch(() => {
                    toast({
                      title: "Error",
                      description: "Failed to delete some variables. Please try again.",
                      variant: "destructive",
                    });
                  });
                }}
                variant="secondary"
                disabled={removeVariableResult.loading}
              >
                {removeVariableResult.loading ? (
                  <Loading />
                ) : (
                  <Trash2 className="size-4" />
                )}
                <span className="ml-2">Delete selected</span>
              </Button>
            </div>
          ) : null}

          {isFiltered && (
            <Button
              variant="ghost"
              onClick={() => {
                const copy = [...filters];
                const nameFilter = copy.find((filter) => filter.name);
                if (nameFilter) {
                  copy.splice(copy.indexOf(nameFilter), 1);
                }
                setFilters(copy);
                refetch();
              }}
            >
              Reset
              <Cross2Icon className="ml-2 size-4" />
            </Button>
          )}
        </div>
        <DataTableViewOptions table={table} />
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No variables found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between px-2">
        <div className="text-muted-foreground flex-1 text-sm">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            Page {page} of {table.getPageCount()}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="hidden size-8 p-0 lg:flex"
              onClick={() => {
                table.setPageIndex(0);
                setPage(1);
                refetch();
              }}
              disabled={!data?.variablesPagination?.pageInfo.hasPreviousPage}
            >
              <span className="sr-only">Go to first page</span>
              <DoubleArrowLeftIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="size-8 p-0"
              onClick={() => {
                table.previousPage();
                setPage(page - 1);
                refetch();
              }}
              disabled={!data?.variablesPagination?.pageInfo.hasPreviousPage}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="size-8 p-0"
              onClick={() => {
                table.nextPage();
                setPage(page + 1);
                refetch();
              }}
              disabled={!data?.variablesPagination?.pageInfo.hasNextPage}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRightIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden size-8 p-0 lg:flex"
              onClick={() => {
                table.setPageIndex(table.getPageCount() - 1);
                setPage(table.getPageCount());
                refetch();
              }}
              disabled={!data?.variablesPagination?.pageInfo.hasNextPage}
            >
              <span className="sr-only">Go to last page</span>
              <DoubleArrowRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}