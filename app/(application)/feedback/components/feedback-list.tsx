"use client";

/**
 * FeedbackList — the list half of the /feedback review console. Renders a
 * data table at `md+` (Checkbox · Type · Preview · Agent · User · Date) and
 * a card list below `md` (T1 table → cards). Row click opens the detail
 * panel via <ListDetail/>; checkbox click does not propagate so toggling
 * selection never accidentally opens the panel.
 *
 * Owns:
 *  - selection state + the bulk-delete ConfirmDialog,
 *  - skeleton-on-first-load (no spinner row),
 *  - <EmptyState> empty + filtered-empty,
 *  - prev/next pagination with first/last hidden below lg.
 *
 * Data comes from useFeedbackQuery — the hook owns Apollo.
 */

import { useMutation } from "@apollo/client";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MessageSquareWarning,
  SearchX,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { BulkActionBar } from "@/components/primitives/bulk-action-bar";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { EmptyState } from "@/components/primitives/empty-state";
import { ListDetail } from "@/components/primitives/list-detail";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Badge } from "@/components/ui/badge";
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
import { DELETE_FEEDBACK, GET_FEEDBACK } from "@/queries/queries";

import { FeedbackDetailPanel } from "./feedback-detail-panel";
import { FeedbackToolbar } from "./feedback-toolbar";
import type {
  FeedbackItem,
  UseFeedbackQueryResult,
} from "./use-feedback-query";

const SKELETON_ROWS = 8;

export interface FeedbackListProps {
  query: UseFeedbackQueryResult;
}

export function FeedbackList({ query }: FeedbackListProps) {
  const t = useTranslations("feedbackReview");
  const tCommon = useTranslations("common");

  const [selectedIds, setSelectedIds] = React.useState<Record<string, boolean>>(
    {},
  );
  const [selectedFeedback, setSelectedFeedback] =
    React.useState<FeedbackItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

  const [deleteFeedback] = useMutation(DELETE_FEEDBACK, {
    refetchQueries: [GET_FEEDBACK, "GetFeedback"],
  });

  const { items, loading, pageCount, page, setPage } = query;

  // Track selection across paginated requests; prune ids that no longer exist
  // on the visible page so the bulk count never counts stale rows.
  const visibleSelected = React.useMemo(
    () => items.filter((item) => selectedIds[item.id]),
    [items, selectedIds],
  );
  const selectionCount = visibleSelected.length;
  const allOnPageSelected =
    items.length > 0 && visibleSelected.length === items.length;
  const someOnPageSelected =
    visibleSelected.length > 0 && !allOnPageSelected;

  const togglePage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = { ...prev };
      for (const item of items) {
        if (checked) next[item.id] = true;
        else delete next[item.id];
      }
      return next;
    });
  };
  const toggleRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = { ...prev };
      if (checked) next[id] = true;
      else delete next[id];
      return next;
    });
  };
  const clearSelection = () => setSelectedIds({});

  const showSkeleton = loading && items.length === 0;
  const filtered =
    query.search.trim().length > 0 ||
    query.type !== "all" ||
    query.agentId !== null ||
    query.userId !== null;

  const isEmpty = !loading && items.length === 0;

  const handleSelect = (item: FeedbackItem | null) => {
    setSelectedFeedback(item);
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(
        visibleSelected.map((row) =>
          deleteFeedback({ variables: { id: row.id } }),
        ),
      );
      toast.success(
        t("toasts.deleteSuccessBulk", { count: visibleSelected.length }),
      );
      clearSelection();
    } catch (err) {
      toast.error(t("toasts.deleteFailure"));
      throw err;
    }
  };

  const emptyView = filtered ? (
    <EmptyState
      icon={SearchX}
      title={t("filteredEmpty.title")}
      description={t("filteredEmpty.description")}
      action={{
        label: t("filteredEmpty.action"),
        onClick: () => query.resetFilters(),
      }}
    />
  ) : (
    <EmptyState
      icon={MessageSquareWarning}
      title={t("emptyState.title")}
      description={t("emptyState.description")}
      action={{ label: t("emptyState.action"), href: "/agents" }}
    />
  );

  // Card list (<md) — no columns at this breakpoint (responsive T1).
  const cardList = (
    <ul className="flex flex-col gap-2 md:hidden">
      {items.map((item) => {
        const positive = item.score === 1;
        const isSelected = selectedFeedback?.id === item.id;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => handleSelect(item)}
              className={cn(
                "flex min-h-[44px] w-full items-start gap-3 rounded-md border border-border bg-background p-3 text-left transition-colors hover:bg-muted/40",
                isSelected && "border-primary/50 bg-muted/40",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                  positive
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive",
                )}
              >
                {positive ? (
                  <ThumbsUp className="size-3" />
                ) : (
                  <ThumbsDown className="size-3" />
                )}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="line-clamp-2 text-sm">
                  {item.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="truncate">{item.agent}</span>
                  <span className="mx-1">·</span>
                  <span>{item.user}</span>
                </p>
              </div>
              <RelativeTime
                date={item.createdAt}
                className="shrink-0 text-xs text-muted-foreground"
              />
            </button>
          </li>
        );
      })}
    </ul>
  );

  // Table (md+).
  const table = (
    <div className="hidden rounded-md border md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={
                  allOnPageSelected
                    ? true
                    : someOnPageSelected
                      ? "indeterminate"
                      : false
                }
                onCheckedChange={(value) => togglePage(value === true)}
                aria-label={tCommon("selectAll")}
              />
            </TableHead>
            <TableHead className="w-10" aria-label={t("columns.type")} />
            <TableHead>{t("columns.feedback")}</TableHead>
            <TableHead>{t("columns.agent")}</TableHead>
            <TableHead>{t("columns.user")}</TableHead>
            <TableHead className="w-32">{t("columns.date")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const positive = item.score === 1;
            const isSelected = selectedFeedback?.id === item.id;
            const preview =
              item.description?.length > 120
                ? `${item.description.substring(0, 120)}…`
                : item.description;
            return (
              <TableRow
                key={item.id}
                data-state={isSelected ? "selected" : undefined}
                className="cursor-pointer"
                onClick={() => handleSelect(item)}
              >
                <TableCell
                  className="align-middle"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Checkbox
                    checked={!!selectedIds[item.id]}
                    onCheckedChange={(value) =>
                      toggleRow(item.id, value === true)
                    }
                    aria-label={tCommon("selectRow")}
                  />
                </TableCell>
                <TableCell className="align-middle">
                  <span
                    aria-label={
                      positive ? t("typePositive") : t("typeNegative")
                    }
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full",
                      positive
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {positive ? (
                      <ThumbsUp aria-hidden="true" className="size-3" />
                    ) : (
                      <ThumbsDown aria-hidden="true" className="size-3" />
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <p className="line-clamp-2 max-w-[480px] text-sm">
                    {preview}
                  </p>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  <span className="truncate">{item.agent}</span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {item.user}
                </TableCell>
                <TableCell>
                  <RelativeTime
                    date={item.createdAt}
                    className="text-sm text-muted-foreground"
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  const skeleton = (
    <div className="rounded-md border" aria-busy="true">
      <ul className="divide-y divide-border">
        {Array.from({ length: SKELETON_ROWS }).map((_, idx) => (
          <li
            key={idx}
            className="flex items-center gap-3 px-4 py-3"
          >
            <Skeleton className="size-4 shrink-0 rounded" />
            <Skeleton className="size-6 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="hidden h-3 w-1/3 md:block" />
            </div>
            <Skeleton className="hidden h-3 w-16 md:block" />
          </li>
        ))}
      </ul>
    </div>
  );

  const listBody = (
    <div className="flex flex-col gap-4">
      <FeedbackToolbar query={query} />

      <BulkActionBar
        count={selectionCount}
        onClear={clearSelection}
        actions={[
          {
            label: t("selectionBar.deleteN", { count: selectionCount }),
            destructive: true,
            onClick: () => setBulkDeleteOpen(true),
          },
        ]}
      />

      {showSkeleton ? (
        skeleton
      ) : isEmpty ? (
        emptyView
      ) : (
        <>
          {table}
          {cardList}
        </>
      )}

      {/* Pagination footer */}
      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {tCommon("pageOf", { page, count: pageCount })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="hidden size-9 lg:flex"
              onClick={() => setPage(1)}
              disabled={page <= 1}
            >
              <span className="sr-only">{tCommon("goToFirstPage")}</span>
              <ChevronsLeft aria-hidden="true" className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-11 md:size-9"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
            >
              <span className="sr-only">{tCommon("goToPreviousPage")}</span>
              <ChevronLeft aria-hidden="true" className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-11 md:size-9"
              onClick={() => setPage(page + 1)}
              disabled={page >= pageCount}
            >
              <span className="sr-only">{tCommon("goToNextPage")}</span>
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="hidden size-9 lg:flex"
              onClick={() => setPage(pageCount)}
              disabled={page >= pageCount}
            >
              <span className="sr-only">{tCommon("goToLastPage")}</span>
              <ChevronsRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        variant="destructive"
        title={t("confirmDelete.bulkTitle", { count: selectionCount })}
        description={t("confirmDelete.bulkDescription", {
          count: selectionCount,
        })}
        onConfirm={handleBulkDelete}
      />
    </div>
  );

  return (
    <ListDetail<FeedbackItem>
      list={listBody}
      items={items}
      selected={selectedFeedback}
      onSelect={handleSelect}
      detailMode="panel"
      detailPresentation="sheet"
      detailEmphasis="primary"
      detail={(item) => (
        <FeedbackDetailPanel
          feedback={item}
          onDeleted={() => setSelectedFeedback(null)}
        />
      )}
    />
  );
}
