"use client";

/**
 * RoutineList — shared DataTable wrapper for /workflows (Routines).
 *
 * Columns: Name (NameCell), Last run (LastRunCell), Schedule (ScheduleCell),
 * Run (RunCell). Pagination footer comes from DataTable. Skeleton & empty
 * state ride DataTable's built-ins.
 *
 * Per workflows.md UX #9: the Last Run column has no sort affordance until
 * ROUTINES_LAST_RUN_SORT_SUPPORTED — deletes the no-op header button.
 * Updated column is hidden by default and only the Name column is
 * sortable (server-side via the parent's sort state, when wired).
 */

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import * as React from "react";

import { DataTable, type PageInfo } from "@/components/primitives/data-table";

import type { Routine, RoutineAccess } from "../types";
import {
  LastRunCell,
  NameCell,
  RoutineCard,
  RowOverflowMenu,
  RunCell,
  ScheduleCell,
} from "./routine-row";

export interface RoutineListProps {
  items: Routine[];
  loading: boolean;
  error?: { message: string; onRetry: () => void } | null;
  pageInfo?: PageInfo;
  onPageChange: (page: number) => void;
  /** Lookups resolved by page-level hooks. */
  lastRunById: Record<string, { state: string; createdAt: string }>;
  scheduleById: Record<string, { schedule: string; next?: string | null }>;
  accessFor: (routine: Routine) => RoutineAccess;
  onRowClick: (routine: Routine) => void;
  onRun: (routine: Routine) => void;
  onEdit: (routine: Routine) => void;
  onView: (routine: Routine) => void;
  onDelete: (routine: Routine) => void;
  /** Empty-state copy from the page (filtered vs initial). */
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: { label: string; href: string } | { label: string; onClick: () => void };
}

export function RoutineList({
  items,
  loading,
  error,
  pageInfo,
  onPageChange,
  lastRunById,
  scheduleById,
  accessFor,
  onRowClick,
  onRun,
  onEdit,
  onView,
  onDelete,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: RoutineListProps) {
  const t = useTranslations("routines");

  const columns = React.useMemo<ColumnDef<Routine>[]>(
    () => [
      {
        id: "name",
        header: t("columns.name"),
        cell: ({ row }) => <NameCell routine={row.original} />,
      },
      {
        id: "lastRun",
        header: t("columns.lastRun"),
        cell: ({ row }) => (
          <LastRunCell
            lastRun={
              row.original.lastRun ??
              lastRunById[row.original.id] ??
              null
            }
          />
        ),
      },
      {
        id: "schedule",
        header: t("columns.schedule"),
        cell: ({ row }) => (
          <ScheduleCell
            schedule={
              row.original.schedule ??
              scheduleById[row.original.id] ??
              null
            }
          />
        ),
      },
      {
        id: "actions",
        header: () => (
          <span className="sr-only">{t("columns.actions")}</span>
        ),
        cell: ({ row }) => {
          const access = accessFor(row.original);
          return (
            <div
              className="flex items-center justify-end gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <RunCell
                routine={row.original}
                access={access}
                onRun={() => onRun(row.original)}
              />
              <RowOverflowMenu
                access={access}
                onEdit={() => onEdit(row.original)}
                onView={() => onView(row.original)}
                onDelete={() => onDelete(row.original)}
              />
            </div>
          );
        },
      },
    ],
    [
      t,
      lastRunById,
      scheduleById,
      accessFor,
      onRun,
      onEdit,
      onView,
      onDelete,
    ],
  );

  return (
    <DataTable<Routine>
      columns={columns}
      data={items}
      loading={loading}
      error={error}
      pagination={
        pageInfo
          ? {
              pageInfo,
              onPageChange,
            }
          : undefined
      }
      onRowClick={onRowClick}
      empty={{
        title: emptyTitle,
        description: emptyDescription,
        action: emptyAction,
      }}
      mobileCard={(routine) => (
        <RoutineCard
          routine={routine}
          lastRun={
            routine.lastRun ?? lastRunById[routine.id] ?? null
          }
          schedule={
            routine.schedule ?? scheduleById[routine.id] ?? null
          }
          access={accessFor(routine)}
          onRun={() => onRun(routine)}
          onEdit={() => onEdit(routine)}
          onView={() => onView(routine)}
          onDelete={() => onDelete(routine)}
          onOpenPanel={() => onRowClick(routine)}
        />
      )}
    />
  );
}
