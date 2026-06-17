"use client";

/**
 * L2 entity-config table — desktop ≥md uses `<DataTable>` with the columns
 * [select?, Entity (font-medium + muted email second line for users),
 * BudgetBar full-mode, Resets (hidden <lg), row Set/Edit ghost button].
 * Mobile <md transforms into a card list via DataTable's `mobileCard`.
 *
 * Replaces page.tsx 435–531 (loading spinner → skeleton, hand-rolled
 * pagination → primitive footer w/ aria-labels, plain text empty → shared
 * `<EmptyState>`).
 */

import { Pencil, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";

import { BudgetBar } from "@/components/budget-bar";
import { DataTable, type PageInfo } from "@/components/primitives/data-table";
import { Button } from "@/components/ui/button";
import type { BudgetEntityType } from "@/lib/budget";

import type { EntityRow } from "../hooks";
import { BudgetBarWithDetails } from "./budget-bar-with-details";

export interface EntityBudgetTableProps {
  entityType: BudgetEntityType;
  rows: EntityRow[];
  pageInfo: PageInfo;
  loading: boolean;
  error: Error | null;
  page: number;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  search: string;
  canWrite: boolean;
  selected: string[];
  onSelectedChange: (ids: string[]) => void;
  onEdit: (row: EntityRow) => void;
  /** Optional callback to clear the active search from the toolbar above. */
  onClearSearch?: () => void;
}

export function EntityBudgetTable({
  entityType,
  rows,
  pageInfo,
  loading,
  error,
  page,
  onPageChange,
  onRetry,
  search,
  canWrite,
  selected,
  onSelectedChange,
  onEdit,
  onClearSearch,
}: EntityBudgetTableProps) {
  const t = useTranslations("budgets");

  const columns = React.useMemo<ColumnDef<EntityRow>[]>(() => {
    return [
      {
        id: "entity",
        header: () => <span>{t(`entityType.${entityType}`)}</span>,
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate font-medium">{row.original.label}</div>
            {row.original.secondaryLabel ? (
              <div
                className="truncate text-xs text-muted-foreground"
                title={row.original.secondaryLabel}
              >
                {row.original.secondaryLabel}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        id: "budget",
        header: () => <span>{t("table.budgetHeader")}</span>,
        cell: ({ row }) => (
          <BudgetBarWithDetails
            budget={row.original.budget}
            triggerLabel={row.original.label}
          />
        ),
      },
      {
        id: "resets",
        header: () => (
          <span className="hidden lg:inline">{t("table.resetsHeader")}</span>
        ),
        cell: ({ row }) => {
          const reset = row.original.budget?.budget_reset_at;
          return (
            <span className="hidden text-sm text-muted-foreground lg:inline">
              {reset ? new Date(reset).toLocaleDateString() : "—"}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => (
          <span className="sr-only">{t("table.actionsHeader")}</span>
        ),
        cell: ({ row }) =>
          canWrite ? (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(row.original);
                }}
                className="size-11 md:h-8 md:w-auto md:px-3"
                aria-label={
                  row.original.budget
                    ? t("table.rowEditAria", { name: row.original.label })
                    : t("table.rowSetAria", { name: row.original.label })
                }
              >
                <Pencil className="size-4" />
                <span className="hidden md:ml-2 md:inline">
                  {row.original.budget ? t("table.rowEdit") : t("table.rowSet")}
                </span>
              </Button>
            </div>
          ) : null,
      },
    ];
  }, [t, entityType, canWrite, onEdit]);

  const mobileCard = React.useCallback(
    (row: EntityRow) => (
      <button
        type="button"
        onClick={() => onEdit(row)}
        className="flex w-full flex-col gap-2 text-left"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 truncate font-medium">{row.label}</span>
          {row.budget?.budget_reset_at ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              {new Date(row.budget.budget_reset_at).toLocaleDateString()}
            </span>
          ) : null}
        </div>
        {row.secondaryLabel ? (
          <span className="truncate text-xs text-muted-foreground">
            {row.secondaryLabel}
          </span>
        ) : null}
        <BudgetBar budget={row.budget} compact />
      </button>
    ),
    [onEdit],
  );

  const emptyTitle = search.trim()
    ? t("empty.noMatchTitle")
    : t("empty.noneTitle");
  const emptyDescription = search.trim()
    ? t("empty.noMatchDescription", { term: search.trim() })
    : t("empty.noneDescription");

  return (
    <DataTable<EntityRow>
      columns={columns}
      data={loading && rows.length === 0 ? undefined : rows}
      loading={loading}
      error={
        error
          ? {
              message: error.message || t("table.loadError"),
              onRetry,
            }
          : null
      }
      pagination={{
        pageInfo: {
          pageCount: Math.max(1, pageInfo.pageCount),
          itemCount: pageInfo.itemCount,
          currentPage: pageInfo.currentPage || page,
          hasPreviousPage: pageInfo.hasPreviousPage,
          hasNextPage: pageInfo.hasNextPage,
        },
        onPageChange,
      }}
      selection={
        canWrite
          ? {
              selected,
              onChange: onSelectedChange,
            }
          : undefined
      }
      empty={{
        icon: Wallet,
        title: emptyTitle,
        description: emptyDescription,
        // Search-empty offers a direct path back to the full list; the
        // genuine "no entities" empty state has nothing actionable here
        // (entities are created in their own admin areas).
        action:
          search.trim() && onClearSearch
            ? { label: t("empty.clearSearch"), onClick: onClearSearch }
            : undefined,
      }}
      mobileCard={mobileCard}
      getRowId={(row) => row.id}
    />
  );
}
