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
import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import * as React from "react";

import { GET_TEST_CASES } from "@/queries/queries";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { TestCase } from "@/types/models/test-case";
import { FilterOperator } from "@/types/models/filter";

import { DataTableViewOptions } from "./data-table-view-options";
import { TestCaseModal } from "./test-case-modal";

export type TestCaseFilters = {
  name?: FilterOperator;
  createdAt?: FilterOperator;
  updatedAt?: FilterOperator;
};

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  testCase?: TestCase;
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
  refreshNonce?: number;
  refetchRef?: React.MutableRefObject<() => void>;
  onSuccess?: () => void;
  onEditingChange?: (testCase: TestCase | null) => void;
}

export function DataTable<TData, TValue>({
  columns,
  testCase,
  createOpen,
  onCreateOpenChange,
  refreshNonce,
  refetchRef,
  onSuccess,
  onEditingChange,
}: DataTableProps<TData, TValue>) {
  const t = useTranslations("evals.cases.list");
  const tCases = useTranslations("evals.cases");
  const tCommon = useTranslations("evals.common");

  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );

  const [filters, setFilters] = useState<TestCaseFilters[]>([]);
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [name, setName] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(
    testCase || null,
  );

  React.useEffect(() => {
    if (testCase) {
      setEditingTestCase(testCase);
      setShowModal(true);
    }
  }, [testCase]);

  React.useEffect(() => {
    if (createOpen) {
      setEditingTestCase(null);
      setShowModal(true);
    }
  }, [createOpen]);

  const { loading, error, data, refetch } = useQuery(GET_TEST_CASES, {
    fetchPolicy: "no-cache",
    nextFetchPolicy: "network-only",
    variables: {
      page: page,
      limit: 10,
      filters: filters,
    },
    pollInterval: 30000,
  });

  React.useEffect(() => {
    setFilters(name ? [{ name: { contains: name } }] : []);
  }, [name]);

  React.useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshNonce, filters]);

  React.useEffect(() => {
    if (refetchRef) {
      refetchRef.current = () => {
        refetch();
      };
    }
  }, [refetchRef, refetch]);

  const pageInfo = data?.test_casesPagination?.pageInfo;
  const testCases = data?.test_casesPagination?.items || [];

  const table = useReactTable({
    data: testCases as TData[],
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

  const handleEdit = (tc: TestCase) => {
    setEditingTestCase(tc);
    setShowModal(true);
    onEditingChange?.(tc);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTestCase(null);
    onEditingChange?.(null);
    onCreateOpenChange?.(false);
  };

  const rows = table.getRowModel().rows;
  const hasResults = rows.length > 0;
  const pageCount = pageInfo?.pageCount ?? 1;

  return (
    <div className="space-y-4">
      <Toolbar
        search={{
          value: name,
          onChange: setName,
          placeholder: t("searchPlaceholder"),
          debounceMs: 200,
        }}
        view={<DataTableViewOptions table={table} />}
      />

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

      {/* Mobile (<md): card list. */}
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
              const tc = row.original as TestCase;
              const userMessageCount =
                tc.inputs?.filter((m) => m.role === "user").length ?? 0;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => handleEdit(tc)}
                    className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{tc.name}</span>
                      <Badge variant="secondary" className="shrink-0">
                        {tCases("columns.messagesCount", {
                          count: userMessageCount,
                        })}
                      </Badge>
                    </div>
                    {tc.description ? (
                      <span className="truncate text-sm text-muted-foreground">
                        {tc.description}
                      </span>
                    ) : null}
                    {tc.updatedAt ? (
                      <RelativeTime
                        date={tc.updatedAt}
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
            title={name ? tCases("empty.noResults") : tCases("empty.title")}
            description={name ? undefined : tCases("empty.description")}
          />
        ) : null}
      </div>

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
                  onClick={() => handleEdit(row.original as TestCase)}
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
                    title={name ? tCases("empty.noResults") : tCases("empty.title")}
                    description={name ? undefined : tCases("empty.description")}
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

      <TestCaseModal
        open={showModal}
        onClose={handleCloseModal}
        onSuccess={() => {
          refetch();
          onSuccess?.();
          handleCloseModal();
        }}
        testCase={editingTestCase}
      />
    </div>
  );
}
