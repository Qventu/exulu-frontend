"use client";

/**
 * DataTable — THE generic TanStack table wrapper.
 *
 * Spec: design/codebase-structure.md §2.2 (`data-table.tsx`) — the single wrapper that
 * replaces the seven page-local copies (audit H2, design-system R2/H7).
 * Built-in per spec: skeleton rows mirroring columns (R10), inline error + Retry (never
 * the empty row), EmptyState gated on a successful response, server-side sorting and
 * pagination, row-selection wiring for BulkActionBar, and the T1 responsive transform
 * (design/responsive.md §3.T1): table → card list below `md` via the `mobileCard`
 * render prop. Without `mobileCard` the table falls back to its `overflow-x-auto`
 * wrapper at all widths (interim per design-system R3 — never a blank page).
 */

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type Row,
  type RowSelectionState,
  type SortingState,
  type Updater,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
} from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { EmptyState, type EmptyStateProps } from "./empty-state";

/** Server-side pagination shape (matches the GraphQL `pageInfo` used across the app). */
export interface PageInfo {
  pageCount: number;
  itemCount?: number;
  currentPage: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[] | undefined;
  /** Skeleton rows (cards below `md`) mirroring the columns while there is no data yet. */
  loading?: boolean;
  /** Inline error + Retry — never rendered as the empty row. */
  error?: { message: string; onRetry: () => void } | null;
  /** Server-side pagination; pages are 1-based. */
  pagination?: { pageInfo: PageInfo; onPageChange: (page: number) => void };
  /** Server-side sorting; omit to disable sortable headers entirely. */
  sorting?: { state: SortingState; onChange: (s: SortingState) => void };
  /** Row-selection wiring for BulkActionBar (ids resolved via `getRowId`). */
  selection?: {
    selected: string[];
    onChange: (ids: string[]) => void;
    /**
     * T1: below `md` checkboxes are not shown by default (long-press is not
     * discoverable) — a toolbar "Select" action enters selection mode. Checkboxes also
     * appear automatically while anything is selected.
     */
    mobileSelectionMode?: boolean;
  };
  onRowClick?: (row: T) => void;
  /** Built-in EmptyState — only shown after a successful, empty response. */
  empty: EmptyStateProps;
  /**
   * T1 transform: renders each row as the content of a tappable card below `md`
   * (mandatory for redesigned pages — no horizontal scroll). DataTable owns the card
   * chrome (border, padding, ≥44px tap target); render line 1 (primary identifier +
   * status) and line 2 (muted meta) here.
   */
  mobileCard?: (row: T) => React.ReactNode;
  /** Stable row id used for selection wiring; defaults to `row.id`, then the row index. */
  getRowId?: (row: T, index: number) => string;
  className?: string;
}

const SKELETON_ROWS = 5;

export function DataTable<T>({
  columns,
  data,
  loading = false,
  error = null,
  pagination,
  sorting,
  selection,
  onRowClick,
  empty,
  mobileCard,
  getRowId,
  className,
}: DataTableProps<T>) {
  const t = useTranslations();

  const resolveRowId = React.useCallback(
    (row: T, index: number): string => {
      if (getRowId) return getRowId(row, index);
      const candidate = (row as { id?: string | number }).id;
      return candidate != null ? String(candidate) : String(index);
    },
    [getRowId],
  );

  const rowSelectionState = React.useMemo<RowSelectionState>(() => {
    const state: RowSelectionState = {};
    for (const id of selection?.selected ?? []) state[id] = true;
    return state;
  }, [selection?.selected]);

  const handleRowSelectionChange = React.useCallback(
    (updater: Updater<RowSelectionState>) => {
      if (!selection) return;
      const next =
        typeof updater === "function" ? updater(rowSelectionState) : updater;
      selection.onChange(Object.keys(next).filter((id) => next[id]));
    },
    [selection, rowSelectionState],
  );

  const handleSortingChange = React.useCallback(
    (updater: Updater<SortingState>) => {
      if (!sorting) return;
      const next =
        typeof updater === "function" ? updater(sorting.state) : updater;
      sorting.onChange(next);
    },
    [sorting],
  );

  const effectiveColumns = React.useMemo<ColumnDef<T>[]>(() => {
    if (!selection) return columns;
    const selectColumn: ColumnDef<T> = {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label={t("common.selectAll")}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          onClick={(event) => event.stopPropagation()}
          aria-label={t("common.selectRow")}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    };
    return [selectColumn, ...columns];
  }, [selection, columns, t]);

  const table = useReactTable({
    data: data ?? [],
    columns: effectiveColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: resolveRowId,
    manualPagination: true,
    pageCount: pagination?.pageInfo.pageCount ?? -1,
    manualSorting: true,
    enableSorting: !!sorting,
    onSortingChange: sorting ? handleSortingChange : undefined,
    enableRowSelection: !!selection,
    onRowSelectionChange: selection ? handleRowSelectionChange : undefined,
    state: {
      sorting: sorting?.state ?? [],
      rowSelection: rowSelectionState,
    },
  });

  const rows = table.getRowModel().rows;
  // Skeleton until the first successful response; EmptyState only after one (spec §2.2).
  const showSkeleton = !error && rows.length === 0 && (loading || data === undefined);
  const showEmpty = !error && !showSkeleton && rows.length === 0;
  const showMobileCheckboxes =
    !!selection &&
    (selection.mobileSelectionMode || selection.selected.length > 0);

  const handleRowKeyDown = (
    event: React.KeyboardEvent,
    row: Row<T>,
  ) => {
    if (!onRowClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowClick(row.original);
    }
  };

  const errorState = error ? (
    <EmptyState
      variant="error"
      title={t("common.somethingWentWrong")}
      description={error.message}
      action={{ label: t("common.retry"), onClick: error.onRetry }}
    />
  ) : null;

  const renderTable = () => (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = !!sorting && header.column.getCanSort();
                const sortDirection = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    aria-sort={
                      canSort
                        ? sortDirection === "asc"
                          ? "ascending"
                          : sortDirection === "desc"
                            ? "descending"
                            : "none"
                        : undefined
                    }
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {sortDirection === "asc" ? (
                          <ArrowUp className="ml-2 size-4" />
                        ) : sortDirection === "desc" ? (
                          <ArrowDown className="ml-2 size-4" />
                        ) : (
                          <ChevronsUpDown className="ml-2 size-4 opacity-50" />
                        )}
                      </Button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {error ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={effectiveColumns.length}>
                {errorState}
              </TableCell>
            </TableRow>
          ) : showSkeleton ? (
            Array.from({ length: SKELETON_ROWS }).map((_, rowIndex) => (
              <TableRow
                key={rowIndex}
                className="hover:bg-transparent"
              >
                {effectiveColumns.map((column, columnIndex) => (
                  <TableCell key={column.id ?? columnIndex}>
                    {selection && columnIndex === 0 ? (
                      <Skeleton className="size-4 rounded-sm" />
                    ) : (
                      <Skeleton className="h-4 w-3/4" />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : showEmpty ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={effectiveColumns.length}>
                <EmptyState {...empty} />
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                onKeyDown={
                  onRowClick ? (event) => handleRowKeyDown(event, row) : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(
                  onRowClick &&
                    "cursor-pointer focus-visible:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  // T1 — card list below `md` (responsive.md §3.T1): one border level, ≥44px tap target,
  // skeleton *cards* mirroring the card anatomy, shared EmptyState.
  const renderCards = () => {
    if (error) return errorState;
    if (showSkeleton) {
      return (
        <div className="space-y-2">
          {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
            <div key={index} className="space-y-2 rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      );
    }
    if (showEmpty) return <EmptyState {...empty} />;
    return (
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id}>
            <div
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              onKeyDown={
                onRowClick ? (event) => handleRowKeyDown(event, row) : undefined
              }
              className={cn(
                "flex min-h-11 items-start gap-2 rounded-lg border bg-card p-4 text-card-foreground transition-colors",
                row.getIsSelected() && "bg-muted",
                onRowClick &&
                  "cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              )}
            >
              {showMobileCheckboxes ? (
                // 44px padded hit area around the visual checkbox (responsive.md touch targets)
                <span
                  className="-my-3 -ml-3 flex size-11 shrink-0 items-center justify-center"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label={t("common.selectRow")}
                    className="size-5"
                  />
                </span>
              ) : null}
              <div className="min-w-0 flex-1">{mobileCard?.(row.original)}</div>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  const renderPagination = () => {
    if (!pagination) return null;
    const { pageInfo, onPageChange } = pagination;
    const pageCount = Math.max(pageInfo.pageCount, 1);
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1 text-sm text-muted-foreground">
          {selection && selection.selected.length > 0
            ? t("common.selectedCount", { count: selection.selected.length })
            : null}
        </div>
        <div className="flex items-center gap-4">
          <span className="whitespace-nowrap text-sm font-medium" aria-live="polite">
            {t("common.pageOf", { page: pageInfo.currentPage, count: pageCount })}
          </span>
          {/* T1: prev/next + "Page x of y" below `lg`; first/last return at `lg` */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="hidden lg:inline-flex"
              onClick={() => onPageChange(1)}
              disabled={!pageInfo.hasPreviousPage}
            >
              <span className="sr-only">{t("common.goToFirstPage")}</span>
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(pageInfo.currentPage - 1)}
              disabled={!pageInfo.hasPreviousPage}
            >
              <span className="sr-only">{t("common.goToPreviousPage")}</span>
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(pageInfo.currentPage + 1)}
              disabled={!pageInfo.hasNextPage}
            >
              <span className="sr-only">{t("common.goToNextPage")}</span>
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="hidden lg:inline-flex"
              onClick={() => onPageChange(pageCount)}
              disabled={!pageInfo.hasNextPage}
            >
              <span className="sr-only">{t("common.goToLastPage")}</span>
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn("space-y-4", className)}
      aria-busy={loading || undefined}
    >
      {mobileCard ? (
        <>
          <div className="md:hidden">{renderCards()}</div>
          <div className="hidden md:block">{renderTable()}</div>
        </>
      ) : (
        // Interim fallback per design-system R3: the ui/table wrapper provides
        // overflow-x scroll inside the bordered container — never a blank page.
        renderTable()
      )}
      {renderPagination()}
    </div>
  );
}
