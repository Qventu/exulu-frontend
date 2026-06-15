"use client";

/**
 * VariablesDataTable — list-plus-detail-panel surface for /variables
 * (Phase 4.5 redesign, variables.md §3).
 *
 * What changed vs. the legacy table:
 *  - GET_VARIABLES_LIST replaces GET_VARIABLES (no `value` in the selection
 *    set).
 *  - 30s poll removed; refetches on window focus + after every mutation
 *    (refetchQueries on the row-actions / detail panel mutations).
 *  - Search is debounced 300ms (Toolbar built-in) and resets to page 1 on
 *    every change (fixes U11).
 *  - Server-side sort wired (fixes U12). Column id → field map below.
 *  - Type filter renders as a 3-state segmented control (All | Secrets |
 *    Plain text) and writes `{ encrypted: { eq: true|false } }`.
 *  - Bulk delete gated behind ConfirmDialog with typeToConfirm friction.
 *  - First-load skeleton vs. error vs. empty are now distinct branches
 *    (fixes U19); pageCount renders 1 while -1 is in flight (fixes U17).
 *  - Card list under md (T1).
 *  - ListDetail (panel mode) drives `?selected=<id>` deep links.
 */

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
  flexRender,
  getCoreRowModel,
  type Row as TableRow,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { AlertTriangle, Lock, Plus, Trash2, Unlock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { EmptyState } from "@/components/primitives/empty-state";
import { ListDetail } from "@/components/primitives/list-detail";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Toolbar } from "@/components/primitives/toolbar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow as UITableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  GET_VARIABLES_LIST,
  REMOVE_VARIABLE_BY_ID,
} from "@/queries/queries";

import { Variable } from "./columns";
import { DataTableViewOptions } from "./data-table-view-options";
import { VariableDetailPanel } from "./variable-detail-panel";

const PAGE_SIZE = 10;

/** Column id → backend sort field map (fixes U12). */
const SORT_FIELD_MAP: Record<string, string> = {
  name: "name",
  updatedAt: "updatedAt",
  createdAt: "createdAt",
  encrypted: "encrypted",
};

type TypeFilter = "all" | "secrets" | "plain";

interface VariableFilter {
  name?: { contains?: string };
  encrypted?: { eq?: boolean };
}

interface VariablesDataTableProps<TValue> {
  columns: ColumnDef<Variable, TValue>[];
  readOnly?: boolean;
}

function useFocusRefetch(refetch: () => void) {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => refetch();
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [refetch]);
}

function MobileRowCard({
  variable,
  onSelect,
}: {
  variable: Variable;
  onSelect: () => void;
}) {
  const t = useTranslations();
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-sm font-medium truncate min-w-0">
          {variable.name}
        </span>
        {variable.encrypted ? (
          <Lock
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
            strokeWidth={1}
          />
        ) : (
          <Unlock
            aria-hidden="true"
            className="size-4 shrink-0 text-amber-700 dark:text-amber-400"
            strokeWidth={1}
          />
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {variable.encrypted
            ? t("variables.type.secret")
            : t("variables.type.plain")}
        </span>
        <RelativeTime date={variable.updatedAt} />
      </div>
    </button>
  );
}

export function VariablesDataTable<TValue>({
  columns,
  readOnly = false,
}: VariablesDataTableProps<TValue>) {
  const t = useTranslations();
  const router = useRouter();

  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({ createdAt: false });
  const [rowSelection, setRowSelection] = React.useState({});
  const [selected, setSelected] = React.useState<Variable | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = React.useState(false);

  // Build the server-side filters from the toolbar state.
  const filters = React.useMemo<VariableFilter[]>(() => {
    const list: VariableFilter[] = [];
    if (search.trim()) list.push({ name: { contains: search.trim() } });
    if (typeFilter === "secrets") list.push({ encrypted: { eq: true } });
    if (typeFilter === "plain") list.push({ encrypted: { eq: false } });
    return list;
  }, [search, typeFilter]);

  const sortVariable = React.useMemo(() => {
    const head = sorting[0];
    if (!head) return undefined;
    const field = SORT_FIELD_MAP[head.id];
    if (!field) return undefined;
    return { field, direction: head.desc ? "DESC" : "ASC" };
  }, [sorting]);

  const { loading, error, data, previousData, refetch } = useQuery(
    GET_VARIABLES_LIST,
    {
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-first",
      variables: {
        page,
        limit: PAGE_SIZE,
        filters,
        ...(sortVariable ? { sort: sortVariable } : {}),
      },
      notifyOnNetworkStatusChange: true,
    },
  );

  useFocusRefetch(refetch);

  const [removeVariable, removeVariableResult] = useMutation(
    REMOVE_VARIABLE_BY_ID,
    {
      refetchQueries: [GET_VARIABLES_LIST, "GetVariablesList"],
    },
  );

  // Reset to page 1 when search or filter changes (fixes U11).
  const filterSignature = `${search}::${typeFilter}`;
  const previousSignature = React.useRef(filterSignature);
  React.useEffect(() => {
    if (previousSignature.current !== filterSignature) {
      previousSignature.current = filterSignature;
      setPage(1);
    }
  }, [filterSignature]);

  // Stale-while-loading: keep previous data visible during a refetch.
  const items: Variable[] =
    (data?.variablesPagination?.items as Variable[] | undefined) ??
    (previousData?.variablesPagination?.items as Variable[] | undefined) ??
    [];
  const pageInfo =
    data?.variablesPagination?.pageInfo ??
    previousData?.variablesPagination?.pageInfo;
  const safePageCount =
    pageInfo?.pageCount !== undefined && pageInfo.pageCount > 0
      ? pageInfo.pageCount
      : 1;

  const firstLoad = loading && !data && !previousData;
  const showError = !!error && !data && !previousData;
  const isEmpty = !firstLoad && !showError && items.length === 0;

  const table = useReactTable({
    data: items,
    columns,
    pageCount: safePageCount,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
    },
    enableRowSelection: !readOnly,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  });

  const selectedRowCount = Object.keys(rowSelection).length;

  const handleResetFilters = () => {
    setSearch("");
    setTypeFilter("all");
  };

  const handleBulkDelete = async () => {
    const ids = table
      .getSelectedRowModel()
      .rows.map((row: TableRow<Variable>) => row.original.id);
    try {
      await Promise.all(
        ids.map((id) => removeVariable({ variables: { id } })),
      );
      table.resetRowSelection();
      toast.success(
        t("variables.bulkDelete.success", { count: ids.length }),
      );
    } catch (err) {
      toast.error(t("variables.bulkDelete.partialError"));
      throw err;
    }
  };

  const selectedNames = table
    .getSelectedRowModel()
    .rows.slice(0, 5)
    .map((row: TableRow<Variable>) => row.original.name);
  const selectedOverflow = Math.max(0, selectedRowCount - selectedNames.length);

  const tableBody = (
    <>
      {/* md+: real table */}
      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <UITableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </UITableRow>
            ))}
          </TableHeader>
          <TableBody>
            {firstLoad ? (
              Array.from({ length: 5 }).map((_, i) => (
                <UITableRow key={`skeleton-${i}`}>
                  {table.getVisibleFlatColumns().map((col) => (
                    <TableCell key={col.id}>
                      <Skeleton className="h-5 w-full max-w-[200px]" />
                    </TableCell>
                  ))}
                </UITableRow>
              ))
            ) : showError ? (
              <UITableRow>
                <TableCell
                  colSpan={table.getVisibleFlatColumns().length}
                  className="py-12"
                >
                  <div className="flex flex-col items-center justify-center gap-3 text-center">
                    <AlertTriangle
                      className="size-10 text-destructive"
                      strokeWidth={1}
                      aria-hidden="true"
                    />
                    <div className="space-y-1">
                      <p className="text-base font-semibold">
                        {t("variables.list.error.title")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t("variables.list.error.body")}
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => refetch()}>
                      {t("variables.actions.retry")}
                    </Button>
                    {error?.message ? (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer">
                          {t("variables.list.error.details")}
                        </summary>
                        <pre className="mt-2 whitespace-pre-wrap text-left">
                          {error.message}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                </TableCell>
              </UITableRow>
            ) : isEmpty ? (
              <UITableRow>
                <TableCell
                  colSpan={table.getVisibleFlatColumns().length}
                  className="py-12"
                >
                  <EmptyState
                    icon={Lock}
                    title={t("variables.list.empty.title")}
                    description={t("variables.list.empty.body")}
                    action={
                      readOnly
                        ? undefined
                        : {
                            label: t("variables.actions.add"),
                            href: "/variables/create",
                          }
                    }
                  />
                </TableCell>
              </UITableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <UITableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer"
                  onClick={() => setSelected(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </UITableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* <md: card list (T1 — no columns on phones). */}
      <div className="flex flex-col gap-2 md:hidden">
        {firstLoad ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={`mob-skeleton-${i}`} className="h-20 w-full" />
          ))
        ) : showError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle
                className="size-5 text-destructive"
                strokeWidth={1}
                aria-hidden="true"
              />
              <div className="space-y-1">
                <p className="font-semibold">
                  {t("variables.list.error.title")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("variables.list.error.body")}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => refetch()}
                >
                  {t("variables.actions.retry")}
                </Button>
              </div>
            </div>
          </div>
        ) : isEmpty ? (
          <EmptyState
            icon={Lock}
            title={t("variables.list.empty.title")}
            description={t("variables.list.empty.body")}
            action={
              readOnly
                ? undefined
                : {
                    label: t("variables.actions.add"),
                    href: "/variables/create",
                  }
            }
          />
        ) : (
          items.map((item) => (
            <MobileRowCard
              key={item.id}
              variable={item}
              onSelect={() => setSelected(item)}
            />
          ))
        )}
      </div>
    </>
  );

  const list = (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <Toolbar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: t("variables.toolbar.searchPlaceholder"),
          debounceMs: 300,
        }}
        activeFilterCount={typeFilter !== "all" ? 1 : 0}
        onResetFilters={
          typeFilter !== "all" || search ? handleResetFilters : undefined
        }
        filters={
          <div className="flex items-center gap-2">
            <Select
              value={typeFilter}
              onValueChange={(value) => setTypeFilter(value as TypeFilter)}
            >
              <SelectTrigger className="h-9 w-[160px]" aria-label={t("variables.toolbar.filterType")}>
                <SelectValue placeholder={t("variables.toolbar.filterType")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("variables.toolbar.typeAll")}
                </SelectItem>
                <SelectItem value="secrets">
                  {t("variables.toolbar.typeSecrets")}
                </SelectItem>
                <SelectItem value="plain">
                  {t("variables.toolbar.typePlain")}
                </SelectItem>
              </SelectContent>
            </Select>
            {(typeFilter !== "all" || search) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
              >
                <Cross2Icon className="mr-1 size-3.5" />
                {t("variables.toolbar.reset")}
              </Button>
            )}
          </div>
        }
        view={<DataTableViewOptions table={table} />}
        selection={
          !readOnly && selectedRowCount > 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2 text-sm">
              <span className="text-muted-foreground">
                {t("variables.list.bulkSelected", { count: selectedRowCount })}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => table.resetRowSelection()}
              >
                {t("variables.list.clearSelection")}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setBulkConfirmOpen(true)}
                disabled={removeVariableResult.loading}
              >
                <Trash2 className="mr-1 size-3.5" strokeWidth={1} />
                {t("variables.actions.delete")}
              </Button>
            </div>
          ) : null
        }
      />

      {tableBody}

      {/* Pagination footer */}
      {!firstLoad && !showError && !isEmpty && pageInfo ? (
        <div className="flex items-center justify-between gap-2 px-2">
          <div className="text-sm text-muted-foreground">
            {selectedRowCount > 0
              ? t("variables.list.bulkSelected", { count: selectedRowCount })
              : null}
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden w-[100px] items-center justify-center text-sm font-medium sm:flex">
              {t("common.pageOf", { page, count: safePageCount })}
            </div>
            <Button
              variant="outline"
              className="hidden size-8 p-0 lg:flex"
              onClick={() => setPage(1)}
              disabled={!pageInfo.hasPreviousPage}
              aria-label={t("common.goToFirstPage")}
            >
              <DoubleArrowLeftIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="size-8 p-0"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!pageInfo.hasPreviousPage}
              aria-label={t("common.goToPreviousPage")}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="size-8 p-0"
              onClick={() => setPage((p) => p + 1)}
              disabled={!pageInfo.hasNextPage}
              aria-label={t("common.goToNextPage")}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden size-8 p-0 lg:flex"
              onClick={() => setPage(safePageCount)}
              disabled={!pageInfo.hasNextPage}
              aria-label={t("common.goToLastPage")}
            >
              <DoubleArrowRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <ListDetail<Variable>
        list={list}
        detail={(item) => (
          <VariableDetailPanel
            variable={item}
            readOnly={readOnly}
            onDeleted={() => setSelected(null)}
          />
        )}
        selected={selected}
        onSelect={(item) => setSelected(item)}
        detailMode="panel"
        detailPresentation="sheet"
        items={items}
        getItemId={(item) => item.id}
        detailTitle={(item) => item.name}
      />

      <ConfirmDialog
        open={bulkConfirmOpen}
        onOpenChange={setBulkConfirmOpen}
        title={t("variables.bulkDelete.title", { count: selectedRowCount })}
        description={
          <span>
            <span className="block">{t("variables.bulkDelete.body")}</span>
            {selectedNames.length > 0 ? (
              <span className="mt-2 block font-mono text-xs">
                {selectedNames.join(", ")}
                {selectedOverflow > 0 ? ` (+${selectedOverflow})` : ""}
              </span>
            ) : null}
          </span>
        }
        confirmLabel={t("variables.delete.confirm")}
        typeToConfirm={selectedRowCount > 1 ? "delete" : undefined}
        onConfirm={handleBulkDelete}
      />
    </>
  );
}

// Legacy export name kept so other surfaces importing `DataTable` continue
// to compile during the transition.
export { VariablesDataTable as DataTable };
