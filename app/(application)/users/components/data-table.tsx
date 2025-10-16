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
  GET_USERS,
  REMOVE_USER_BY_ID,
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
import { FilterOperator } from "@/components/custom/recent-jobs";
import { AddUserModal } from "@/app/(application)/users/components/add-user-modal";
import { UserContext } from "@/app/(application)/authenticated";
import { Plus } from "lucide-react";
export type UserFilters = {
  firstname?: FilterOperator,
  lastname?: FilterOperator,
  email?: FilterOperator,
  type?: FilterOperator,
  status?: FilterOperator,
  createdAt?: FilterOperator,
  updatedAt?: FilterOperator,
}
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
  const { user } = React.useContext(UserContext);
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [isAddUserModalOpen, setIsAddUserModalOpen] = React.useState(false);
  const [filters, setFilters] = useState<UserFilters[]>([]);

  /* todo: get rid of own page state and use the table.currentPage() instead */
  let [page, setPage] = useState(1);
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const { loading, error, data, refetch, previousData } = useQuery(GET_USERS, {
    fetchPolicy: "no-cache",
    nextFetchPolicy: "network-only",
    variables: {
      page: page,
      limit: 10,
      sort: {
        field: "createdAt",
        direction: "DESC",
      },
      filters: [
        ...filters,
        {
          type: {
            ne: "api"
          }
        }
      ],
    },
    pollInterval: 30000, // polls every 30 seconds for updates on users
  });

  const defaultData = React.useMemo(() => [], []);
  const { limit, onPaginationChange, skip, pagination } = usePagination();

  const [removeUser, removeUserResult] = useMutation(REMOVE_USER_BY_ID, {
    refetchQueries: [
      GET_USERS, // DocumentNode object parsed with gql
      "GetUsers", // Query name
    ],
  });

  let items;
  let pageCount;
  if (loading && previousData?.usersPagination?.items) {
    items = previousData?.usersPagination?.items;
    pageCount = previousData?.usersPagination?.pageInfo?.pageCount;
  } else if (data?.usersPagination?.items) {
    items = data?.usersPagination?.items;
    pageCount = data?.usersPagination?.pageInfo?.pageCount;
  } else if (previousData?.usersPagination?.items) {
    items = previousData?.usersPagination?.items;
    pageCount = previousData?.usersPagination?.pageInfo?.pageCount;
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
    const exists = copy.find((filter) => filter.email);
    if (exists?.email) {
      exists.email.contains = value;
    } else {
      copy.push({
        email: {
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
            placeholder="Filter users..."
            value={filters?.find((filter) => filter.email)?.email?.contains ?? ""}
            onChange={(event) => {
              search(event.target.value);
            }}
            className="w-[150px] lg:w-[250px]"
          />

          <Button
            variant="outline"
            onClick={() => {
              router.push("/roles");
            }}
          >
            Manage roles
          </Button>

          {user?.super_admin && (
            <Button
              onClick={() => setIsAddUserModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="size-4" />
              Add User
            </Button>
          )}

          {table.getIsSomeRowsSelected() || table.getIsAllRowsSelected() ? (
            <div className="flex gap-x-2">
              <Button
                onClick={() => {
                  // confirm modal
                  const confirm = window.confirm("Are you sure you want to remove the selected users?");
                  if (!confirm) {
                    return;
                  }
                  const promises: any[] = [];
                  table.getSelectedRowModel().rows.forEach((row: Row<any>) => {
                    promises.push(
                      removeUser({
                        variables: {
                          id: row.original.id,
                        },
                      }),
                    );
                  });
                  Promise.all(promises).then(() => {
                    table.resetRowSelection();
                    toast({
                      title: "Removed users",
                      description: "We removed " + promises.length + " users.",
                    });
                  });
                }}
                variant="secondary"
                disabled={removeUserResult.loading}
              >
                {removeUserResult.loading ? (
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
                const copy = [...filters];
                const emailFilter = copy.find((filter) => filter.email);
                if (emailFilter) {
                  copy.splice(copy.indexOf(emailFilter), 1);
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
              disabled={!data?.usersPagination?.pageInfo.hasPreviousPage}
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
              disabled={!data?.usersPagination?.pageInfo.hasPreviousPage}
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
              disabled={!data?.usersPagination?.pageInfo.hasNextPage}
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
              disabled={!data?.usersPagination?.pageInfo.hasNextPage}
            >
              <span className="sr-only">Go to last page</span>
              <DoubleArrowRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      </div>
      
      <AddUserModal 
        isOpen={isAddUserModalOpen} 
        onClose={() => setIsAddUserModalOpen(false)} 
      />
    </div>
  );
}
