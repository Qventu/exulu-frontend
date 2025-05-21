"use client";

import { useQuery } from "@apollo/client";
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
import { PackageOpen, RotateCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as React from "react";
import { ItemSelector } from "@/app/(application)/jobs/components/item-selector";
import { DataTableFacetedFilter } from "@/app/(application)/jobs/components/data-table-faceted-filter";
import { DataTableViewOptions } from "@/app/(application)/jobs/components/data-table-view-options";
import { statuses } from "@/app/(application)/jobs/data/data";
import {useMutation} from "@tanstack/react-query";
import {
  GET_JOBS
} from "@/queries/queries";
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
import {JOB_STATUS} from "@/util/enums/job-status";

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

  /* todo: get rid of own page state and use the table.currentPage() instead */
  let [page, setPage] = useState(1);
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const { loading, error, data, refetch, previousData } = useQuery(GET_JOBS, {
    fetchPolicy: "network-only",
    nextFetchPolicy: "network-only",
    variables: {
      limit: 10,
    },
    pollInterval: 5000, // polls every 5 seconds for updates on jobs
  });

  const defaultData = React.useMemo(() => [], []);
  const { limit, onPaginationChange, skip, pagination } = usePagination();

  let items;
  let pageCount;
  if (loading && previousData?.jobPagination?.items) {
    items = previousData?.jobPagination?.items;
    pageCount = previousData?.jobPagination?.pageInfo?.pageCount;
  } else if (data?.jobPagination?.items) {
    items = data?.jobPagination?.items;
    pageCount = data?.jobPagination?.pageInfo?.pageCount;
  } else if (previousData?.jobPagination?.items) {
    items = previousData?.jobPagination?.items;
    pageCount = previousData?.jobPagination?.pageInfo?.pageCount;
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

  const cancelJob = useMutation({
    mutationFn: async (args: any) => {
      // todo
    }
  })

  const retryJob = useMutation({
    mutationFn: async (args: any) => {
      // todo
    }
  })

  const removeJob = useMutation({
    mutationFn: async (args: any) => {
      // todo
    }
  })

  const isFiltered =
    filters.OR ||
    filters.nameSearch ||
    filters.chain ||
    filters.item ||
    filters.context ||
    filters.status;

  /*todo: useEffect if jobs data array changes to add recurring job checks for those that have status running, and remove all the preious recurring checks*/
  /* todo: useQuery has a pollInterval option for this!*/

  /*todo allow filtering by batches (drop down selector with search for batch names and select)*/
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Input
            placeholder="Filter jobs..."
            value={filters?.nameSearch ?? ""}
            onChange={(event) => {
              const copy = { ...filters };
              copy.nameSearch = event.target.value;
              setFilters(copy);
            }}
            className="w-[150px] lg:w-[250px]"
          />
          <ItemSelector
            navigate={false}
            onSelect={(item) => {
              const copy = { ...filters };
              copy.item = item.id;
              setFilters(copy);
            }}
          />
          {table.getColumn("status") && (
            <DataTableFacetedFilter
              onSelect={(values) => {
                const copy = { ...filters };
                if (!values && copy?.OR) {
                  delete copy.OR;
                  setFilters(copy);
                  return;
                }
                copy.OR = values.map((value) => ({ status: value }));
                setFilters(copy);
              }}
              column={table.getColumn("status")}
              title="Status"
              filters={filters}
              options={statuses}
            />
          )}

          {table.getIsSomeRowsSelected() || table.getIsAllRowsSelected() ? (
            <div className="flex">
              <Button
                onClick={() => {
                  const promises: any[] = [];
                  table.getSelectedRowModel().rows.forEach((row: Row<any>) => {
                    if (
                      row.original.status !== JOB_STATUS.active
                    ) {
                      return;
                    }
                    promises.push(
                      cancelJob.mutate({
                        id: row.original.id
                      }),
                    );
                  });
                  Promise.all(promises).then(async () => {
                    await refetch();
                    table.resetRowSelection();
                    toast({
                      title: "Cancelled jobs",
                      description:
                        "We cancelled " +
                        promises.length +
                        " jobs, note that we can only cancel jobs with status 'pending', 'running' or 'waiting'.",
                    });
                  });
                }}
                variant="secondary"
                disabled={cancelJob.isPending}
              >
                {cancelJob.isPending ? (
                  <Loading />
                ) : (
                  <PackageOpen className="size-4" />
                )}
                <span className="ml-2">Cancel selected</span>
              </Button>

              <Button
                className="ml-2"
                onClick={() => {
                  const promises: any[] = [];
                  table.getSelectedRowModel().rows.forEach((row: Row<any>) => {
                    if (
                      row.original.status === "cancelled" ||
                      row.original.status === "completed" ||
                      row.original.status === "error"
                    ) {
                      promises.push(
                        retryJob.mutate({
                          id: row.original.id,
                        }),
                      );
                    }
                  });
                  Promise.all(promises).then(async () => {
                    await refetch();
                    table.resetRowSelection();
                    toast({
                      title: "Scheduled jobs",
                      description:
                        "We scheduled " +
                        promises.length +
                        " jobs, note that we can only retry jobs that do not have status 'pending', 'running' or 'waiting'.",
                    });
                  });
                }}
                variant="secondary"
                disabled={retryJob.isPending}
              >
                {retryJob.isPending ? (
                  <Loading />
                ) : (
                  <RotateCw className="size-4" />
                )}
                <span className="ml-2">Retry selected</span>
              </Button>

              <Button
                className="ml-2"
                onClick={() => {
                  const promises: any[] = [];
                  table.getSelectedRowModel().rows.forEach((row: Row<any>) => {
                    if (
                      row.original.status === JOB_STATUS.paused ||
                      row.original.status === JOB_STATUS.completed ||
                      row.original.status === JOB_STATUS.failed
                    ) {
                      promises.push(
                          removeJob.mutate({
                          variables: {
                            id: row.original.id,
                          },
                        }),
                      );
                    }
                  });
                  Promise.all(promises).then(async () => {
                    await refetch();
                    table.resetRowSelection();
                    toast({
                      title: "Removed jobs",
                      description:
                        "We removed " +
                        promises.length +
                        " jobs, note that we can only remove jobs that have the status 'cancelled', 'completed' or 'error'.",
                    });
                  });
                }}
                variant="secondary"
                disabled={removeJob.isPending}
              >
                {removeJob.isPending ? (
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
      {/*<div className="flex items-center justify-between px-2">
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
              disabled={!data?.jobPagination?.pageInfo.hasPreviousPage}
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
              disabled={!data?.jobPagination?.pageInfo.hasPreviousPage}
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
              disabled={!data?.jobPagination?.pageInfo.hasNextPage}
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
              disabled={!data?.jobPagination?.pageInfo.hasNextPage}
            >
              <span className="sr-only">Go to last page</span>
              <DoubleArrowRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      </div>*/}
    </div>
  );
}
