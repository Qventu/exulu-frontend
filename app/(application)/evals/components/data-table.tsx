"use client";

import { useQuery } from "@apollo/client";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
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
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useState } from "react";

import { GET_EVAL_SETS } from "@/queries/queries";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/primitives/empty-state";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Toolbar } from "@/components/primitives/toolbar";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { FilterOperator } from "@/types/models/filter";

import { DataTableViewOptions } from "./data-table-view-options";

export type EvalSetFilters = {
  name?: FilterOperator;
  createdAt?: FilterOperator;
  updatedAt?: FilterOperator;
};

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  /** Bumped by the parent to force a refetch (e.g. after creation). */
  refreshNonce?: number;
  /**
   * Optional ref the table writes its `refetch` callback into so row-level
   * actions (e.g. delete) can request a refresh through the parent without
   * prop-drilling refs through tanstack rows.
   */
  refetchRef?: React.MutableRefObject<() => void>;
}

export function DataTable<TData, TValue>({
  columns,
  refreshNonce,
  refetchRef,
}: DataTableProps<TData, TValue>) {
  const router = useRouter();
  const t = useTranslations("evals.list");
  const tCommon = useTranslations("evals.common");

  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );

  const [page, setPage] = useState(1);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [name, setName] = useState("");

  const { loading, error, data, refetch } = useQuery(GET_EVAL_SETS, {
    fetchPolicy: "no-cache",
    nextFetchPolicy: "network-only",
    variables: {
      page: page,
      limit: 10,
      filters: name ? [{ name: { contains: name } }] : [],
    },
    pollInterval: 30000,
  });

  const pageInfo = data?.eval_setsPagination?.pageInfo;
  const evalSets = data?.eval_setsPagination?.items || [];

  const table = useReactTable({
    data: evalSets as TData[],
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
  });

  React.useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, refreshNonce]);

  React.useEffect(() => {
    if (refetchRef) {
      refetchRef.current = () => {
        refetch();
      };
    }
  }, [refetchRef, refetch]);

  const rows = table.getRowModel().rows;
  const hasResults = rows.length > 0;
  const pageCount = pageInfo?.pageCount ?? 1;

  return (
    <div className="space-y-4">
      <Toolbar
        search={{
          value: name,
          onChange: setName,
          placeholder: t("toolbar.searchPlaceholder"),
          debounceMs: 200,
        }}
        view={
          <>
            <DataTableViewOptions table={table} />
            <Button asChild variant="ghost" size="sm">
              <Link href="/evals/cases">{t("toolbar.testCaseLibrary")}</Link>
            </Button>
          </>
        }
      />

      {/* Inline error surface — previously the dropped `error` left the table
         silently empty. Now we render the failure explicitly with Retry. */}
      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{tCommon("errors.loadTitle")}</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{error.message}</span>
            <div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetch()}
                disabled={loading}
              >
                {tCommon("errors.retry")}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Mobile (<md): card list. Bypasses table rendering — responsive.md T1. */}
      <div className="md:hidden">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : hasResults ? (
          <ul className="divide-y rounded-md border">
            {rows.map((row) => {
              const evalSet = row.original as any;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/evals/${evalSet.id}`)}
                    className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="font-medium">{evalSet.name}</span>
                    {evalSet.description ? (
                      <span className="truncate text-sm text-muted-foreground">
                        {evalSet.description}
                      </span>
                    ) : null}
                    {evalSet.updatedAt ? (
                      <RelativeTime
                        date={evalSet.updatedAt}
                        className="text-xs text-muted-foreground"
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : !error ? (
          <EmptyState
            title={name ? t("empty.noResults") : t("empty.title")}
            description={name ? undefined : t("empty.description")}
          />
        ) : null}
      </div>

      {/* md+ : the existing TanStack table. */}
      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : hasResults ? (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer"
                  onClick={() => {
                    const evalSet = row.original as any;
                    router.push(`/evals/${evalSet.id}`);
                  }}
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
                <TableCell colSpan={columns.length} className="h-24">
                  <EmptyState
                    variant="quiet"
                    title={name ? t("empty.noResults") : t("empty.title")}
                    description={name ? undefined : t("empty.description")}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-between px-2">
          <div className="flex-1 text-sm text-muted-foreground">
            {pageInfo && (
              <>
                {tCommon("pagination.summary", {
                  currentPage: pageInfo.currentPage,
                  pageCount: pageInfo.pageCount,
                  itemCount: pageInfo.itemCount,
                })}
              </>
            )}
          </div>
          <div className="flex items-center space-x-6 lg:space-x-8">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => setPage(1)}
                disabled={!pageInfo?.hasPreviousPage}
              >
                <span className="sr-only">{tCommon("pagination.first")}</span>
                <DoubleArrowLeftIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setPage(page - 1)}
                disabled={!pageInfo?.hasPreviousPage}
              >
                <span className="sr-only">
                  {tCommon("pagination.previous")}
                </span>
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setPage(page + 1)}
                disabled={!pageInfo?.hasNextPage}
              >
                <span className="sr-only">{tCommon("pagination.next")}</span>
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => setPage(pageInfo?.pageCount || 1)}
                disabled={!pageInfo?.hasNextPage}
              >
                <span className="sr-only">{tCommon("pagination.last")}</span>
                <DoubleArrowRightIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
