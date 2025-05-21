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
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as React from "react";
import {
  CREATE_USER_ROLE,
  GET_USER_ROLES,
  REMOVE_USER_ROLE_BY_ID,
  UPDATE_USER_ROLE_BY_ID,
} from "@/queries/queries";
import { DataTableViewOptions } from "@/app/(application)/users/components/data-table-view-options";
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

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
}

export function usePagination() {
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

  const [filters, setFilters] = useState<any>({});
  const [newRoleName, setNewRoleName] = useState<string | null>(null);

  /* todo: get rid of own page state and use the table.currentPage() instead */
  let [page, setPage] = useState(1);
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const { loading, error, data, refetch, previousData } = useQuery(
    GET_USER_ROLES,
    {
      fetchPolicy: "cache-first",
      nextFetchPolicy: "network-only",
      variables: {
        page: page,
        limit: 10,
        filters: filters,
      },
      pollInterval: 30000, // polls every 30 seconds for updates on users
    },
  );

  const defaultData = React.useMemo(() => [], []);
  const { limit, onPaginationChange, skip, pagination } = usePagination();

  const [updateUserRole, updateUserRoleResult] = useMutation(
    UPDATE_USER_ROLE_BY_ID,
    {
      refetchQueries: [
        GET_USER_ROLES, // DocumentNode object parsed with gql
        "GetUserRoles", // Query name
      ],
    },
  );

  const [createUserRole, createUserRoleResult] = useMutation(CREATE_USER_ROLE, {
    refetchQueries: [
      GET_USER_ROLES, // DocumentNode object parsed with gql
      "GetUserRoles", // Query name
    ],
    onCompleted: (data) => {
      router.push(`/roles/${data?.userRoleCreateOne?.record.id}`);
    },
  });

  const [removeUserRole, removeUserRoleResult] = useMutation(
    REMOVE_USER_ROLE_BY_ID,
    {
      refetchQueries: [
        GET_USER_ROLES, // DocumentNode object parsed with gql
        "GetUserRoles", // Query name
      ],
    },
  );

  let items;
  let pageCount;
  if (loading && previousData?.rolesPagination?.items) {
    items = previousData?.rolesPagination?.items;
    pageCount = previousData?.rolesPagination?.pageInfo?.pageCount;
  } else if (data?.rolesPagination?.items) {
    items = data?.rolesPagination?.items;
    pageCount = data?.rolesPagination?.pageInfo?.pageCount;
  } else if (previousData?.rolesPagination?.items) {
    items = previousData?.rolesPagination?.items;
    pageCount = previousData?.rolesPagination?.pageInfo?.pageCount;
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

  const isFiltered =
    filters.OR ||
    filters.emailSearch ||
    filters.item ||
    filters.status;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <div className="flex">
            <Input
              placeholder={"New role"}
              onChange={(e) => {
                setNewRoleName(e.target.value);
              }}
              id="name"
              autoFocus
            />
            <Button
              disabled={createUserRoleResult.loading}
              className="ml-2"
              onClick={() => {
                if (!newRoleName) {
                  return;
                }
                createUserRole({
                  variables: {
                    name: newRoleName,
                  },
                });
              }}
            >
              Add role
            </Button>
          </div>

          {table.getIsSomeRowsSelected() || table.getIsAllRowsSelected() ? (
            <div className="flex gap-x-2">
              <Button
                onClick={() => {
                  const promises: any[] = [];
                  table.getSelectedRowModel().rows.forEach((row: Row<any>) => {
                    // don't allow removing default roles
                    if (
                      row.original.name !== "admin" &&
                      row.original.name !== "developer"
                    ) {
                      promises.push(
                        removeUserRole({
                          variables: {
                            id: row.original.id,
                          },
                        }),
                      );
                    }
                  });
                  Promise.all(promises).then(() => {
                    table.resetRowSelection();
                    toast({
                      title: "Removed user roles",
                      description:
                        "We removed " +
                        promises.length +
                        " user roles (note you can't remove the 'admin' or 'developer' roles.",
                    });
                  });
                }}
                variant="secondary"
                disabled={removeUserRoleResult.loading}
              >
                {removeUserRoleResult.loading ? (
                  <Loading />
                ) : (
                  <Trash2 className="size-4" />
                )}
                <span className="ml-2">Remove selected</span>
              </Button>
            </div>
          ) : null}

          {isFiltered && (
            <Button
              variant="ghost"
              onClick={() => {
                router.refresh();
              }}
            >
              Reset
              <Cross2Icon className="size-4" />
            </Button>
          )}
        </div>
        <DataTableViewOptions table={table} />
        <Button
          onClick={() => {
            router.push("/users");
          }}
          variant="outline"
          size="sm"
          className="ml-2 hidden h-8 lg:flex"
        >
          Back
        </Button>
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
            ) : loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
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
          {/*<div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Rows per page</p>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value));
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue
                  placeholder={table.getState().pagination.pageSize}
                />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>*/}
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
              disabled={!data?.rolesPagination?.pageInfo.hasPreviousPage}
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
              disabled={!data?.rolesPagination?.pageInfo.hasPreviousPage}
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
              disabled={!data?.rolesPagination?.pageInfo.hasNextPage}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRightIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden size-8 p-0 lg:flex"
              onClick={() => {
                () => {
                  table.setPageIndex(table.getPageCount() - 1);
                };
                setPage(table.getPageCount());
                refetch();
              }}
              disabled={!data?.rolesPagination?.pageInfo.hasNextPage}
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
