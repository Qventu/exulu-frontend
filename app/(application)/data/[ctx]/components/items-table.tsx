"use client";

/**
 * ItemsTable — full-width items table for the workspace Items tab.
 * Columns: checkbox, Name, Tags, Updated, Embeddings, Processed.
 *
 * Inventory items handled here: 16 (paginated query), 17 (row content +
 * selection navigates to ?item=), 18 (select-all / per-row selection),
 * 24 (URL-driven search), 25 (pagination controls), 26 (loading / error /
 * keep-previous-data), 26a (no-matches state with Clear filters), 14
 * (no-items empty state with "Add your first item").
 *
 * Below md the table renders as a card list (responsive.md T1).
 */

import { useApolloClient, useMutation } from "@apollo/client";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DoubleArrowLeftIcon,
} from "@radix-ui/react-icons";
import { Database, FilterIcon, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { FavoriteToggle } from "@/components/primitives/favorite-toggle";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import type { Item } from "@EXULU_SHARED/models/item";
import type { Context } from "@/types/models/context";

import {
  itemGlobalId,
  useContextItems,
  useContextItemFavourites,
} from "../../hooks";

import { ItemsActionBar } from "./items-action-bar";
import { ItemsEmpty } from "./items-empty";
import { DELETE_ITEM, UPDATE_ITEM } from "../../queries";

export interface ItemsTableProps {
  context: Context;
  archived: boolean;
  page: number;
  search: string;
  advancedFilters: unknown[];
  selectedItemId: string | null;
  activeFiltersCount: number;
  onSelect: (id: string | null) => void;
  onPageChange: (page: number) => void;
  onOpenFilters: () => void;
  onClearFilters: () => void;
  onOpenCreate: () => void;
  onOpenImport: () => void;
  viewSwitch: React.ReactNode;
}

export function ItemsTable({
  context,
  archived,
  page,
  search,
  advancedFilters,
  selectedItemId,
  activeFiltersCount,
  onSelect,
  onPageChange,
  onOpenFilters,
  onClearFilters,
  onOpenCreate,
  onOpenImport,
  viewSwitch,
}: ItemsTableProps) {
  const t = useTranslations("knowledge");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const client = useApolloClient();

  const [selection, setSelection] = React.useState<Set<string>>(new Set());

  // local search state echoed to URL on debounce
  const [searchInput, setSearchInput] = React.useState(search);
  React.useEffect(() => setSearchInput(search), [search]);

  const debouncedSearch = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearchChange = (value: string) => {
    setSearchInput(value);
    if (debouncedSearch.current) clearTimeout(debouncedSearch.current);
    debouncedSearch.current = setTimeout(() => {
      const url = new URLSearchParams(params?.toString() ?? "");
      if (value.length > 0) url.set("search", value);
      else url.delete("search");
      url.delete("page");
      const q = url.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    }, 300);
  };

  const { items, pageInfo, loading, error, refetch } = useContextItems({
    context: context.id,
    page,
    search,
    archived,
    advancedFilters,
  });

  // Favourite star per row — shared store, so the detail-header star and the
  // /data favourites grid stay in sync with toggles made here.
  const { isFavorite, toggleFavorite } = useContextItemFavourites();
  const handleToggleFavorite = React.useCallback(
    (globalId: string) => {
      void toggleFavorite(globalId).catch(() => {
        // Optimistic state already reverted in the hook.
      });
    },
    [toggleFavorite],
  );

  // Wipe selection when the result set fundamentally changes (page/view).
  React.useEffect(() => {
    setSelection(new Set());
  }, [archived, page, search, advancedFilters]);

  const toggleAll = (checked: boolean) => {
    if (checked)
      setSelection(new Set(items.map((i) => i.id).filter((id): id is string => !!id)));
    else setSelection(new Set());
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const [updateItem, updateItemResult] = useMutation(UPDATE_ITEM(context.id));
  const [deleteItem, deleteItemResult] = useMutation(
    DELETE_ITEM(context.id, []),
  );

  const handleBulkArchive = async () => {
    await Promise.all(
      Array.from(selection).map((id) =>
        updateItem({ variables: { id, input: { archived: true } } }),
      ),
    );
    setSelection(new Set());
    refetch();
  };
  const handleBulkUnarchive = async () => {
    await Promise.all(
      Array.from(selection).map((id) =>
        updateItem({ variables: { id, input: { archived: false } } }),
      ),
    );
    setSelection(new Set());
    refetch();
  };
  const handleBulkDelete = async () => {
    await Promise.all(
      Array.from(selection).map((id) => deleteItem({ variables: { id } })),
    );
    setSelection(new Set());
    refetch();
    // Apollo cache reconcile — eviction is generic since queries are dynamic.
    client.cache.gc();
  };

  // ---- Render branches -------------------------------------------------

  if (error) {
    return (
      <Alert variant="destructive">
        <ExclamationTriangleIcon className="size-4" />
        <AlertTitle>{t("workspace.items.errorTitle")}</AlertTitle>
        <AlertDescription>
          {error.message ?? t("workspace.items.errorDescription")}
        </AlertDescription>
      </Alert>
    );
  }

  const hasFilters = activeFiltersCount > 0 || search.length > 0;
  const showSkeleton = loading && items.length === 0;
  const showEmpty = !loading && items.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Toolbar: search, Filters, view switch */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative w-full md:max-w-sm">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("workspace.items.searchPlaceholder")}
            aria-label={t("workspace.items.searchPlaceholder")}
            className="pl-9 text-base md:text-sm"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onOpenFilters}
          aria-label={t("workspace.items.filters")}
        >
          <FilterIcon aria-hidden="true" className="mr-2 size-4" />
          {t("workspace.items.filters")}
          {activeFiltersCount > 0 && (
            <span className="ml-2 inline-flex size-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              {activeFiltersCount}
            </span>
          )}
        </Button>
        {activeFiltersCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
          >
            {t("workspace.items.clearFilters")}
          </Button>
        )}
        <div className="md:ml-auto">{viewSwitch}</div>
      </div>

      {/* Selection action bar (sticky) */}
      {selection.size > 0 && (
        <ItemsActionBar
          archived={archived}
          count={selection.size}
          onArchive={handleBulkArchive}
          onUnarchive={handleBulkUnarchive}
          onDelete={handleBulkDelete}
          pending={updateItemResult.loading || deleteItemResult.loading}
          onClear={() => setSelection(new Set())}
        />
      )}

      {/* Skeleton / Empty / Table */}
      {showSkeleton ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : showEmpty ? (
        <ItemsEmpty
          hasFilters={hasFilters}
          onClearFilters={onClearFilters}
          onCreate={archived ? undefined : onOpenCreate}
          onImport={archived ? undefined : onOpenImport}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-md border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        items.length > 0 && selection.size === items.length
                          ? true
                          : selection.size > 0
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={(v) => toggleAll(v === true)}
                      aria-label={t("workspace.items.selectAll")}
                    />
                  </TableHead>
                  <TableHead>{t("workspace.items.columns.name")}</TableHead>
                  <TableHead>{t("workspace.items.columns.tags")}</TableHead>
                  <TableHead>{t("workspace.items.columns.updated")}</TableHead>
                  <TableHead>
                    {t("workspace.items.columns.embeddings")}
                  </TableHead>
                  <TableHead>
                    {t("workspace.items.columns.processed")}
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const id = item.id ?? "";
                  const globalId = itemGlobalId(context.id, id);
                  return (
                    <ItemRow
                      key={id}
                      item={item}
                      selected={selection.has(id)}
                      active={selectedItemId === id}
                      onToggle={(v) => toggleOne(id, v)}
                      onOpen={() => onSelect(id)}
                      favorited={isFavorite(globalId)}
                      onToggleFavorite={() => handleToggleFavorite(globalId)}
                    />
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile card list (T1) */}
          <ul className="flex flex-col gap-2 md:hidden">
            {items.map((item) => {
              const id = item.id ?? "";
              const globalId = itemGlobalId(context.id, id);
              return (
                <li key={id}>
                  <ItemCard
                    item={item}
                    selected={selection.has(id)}
                    active={selectedItemId === id}
                    onToggle={(v) => toggleOne(id, v)}
                    onOpen={() => onSelect(id)}
                    favorited={isFavorite(globalId)}
                    onToggleFavorite={() => handleToggleFavorite(globalId)}
                  />
                </li>
              );
            })}
          </ul>

          {/* Footer pagination */}
          <div className="flex flex-col items-center justify-between gap-2 px-1 py-2 text-sm sm:flex-row">
            <div className="text-muted-foreground">
              {t("workspace.items.footer.summary", {
                selected: selection.size,
                shown: items.length,
                total: pageInfo.itemCount,
              })}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="size-11 md:size-8"
                onClick={() => onPageChange(1)}
                disabled={!pageInfo.hasPreviousPage || loading}
                aria-label={t("workspace.items.firstPage")}
              >
                <DoubleArrowLeftIcon className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-11 md:size-8"
                onClick={() => onPageChange(Math.max(1, page - 1))}
                disabled={!pageInfo.hasPreviousPage || loading}
                aria-label={t("workspace.items.previousPage")}
              >
                <ChevronLeftIcon className="size-4" />
              </Button>
              <span className="px-2 text-muted-foreground">
                {t("workspace.items.pageOf", {
                  current: pageInfo.currentPage || page,
                  total: pageInfo.pageCount || 1,
                })}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-11 md:size-8"
                onClick={() => onPageChange(page + 1)}
                disabled={!pageInfo.hasNextPage || loading}
                aria-label={t("workspace.items.nextPage")}
              >
                <ChevronRightIcon className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

interface RowProps {
  item: Item;
  selected: boolean;
  active: boolean;
  onToggle: (checked: boolean) => void;
  onOpen: () => void;
  favorited: boolean;
  onToggleFavorite: () => void;
}

function ItemRow({
  item,
  selected,
  active,
  onToggle,
  onOpen,
  favorited,
  onToggleFavorite,
}: RowProps) {
  const t = useTranslations("knowledge");
  const rawTags: unknown = item.tags;
  const tags: string[] = Array.isArray(rawTags)
    ? (rawTags as string[])
    : typeof rawTags === "string" && rawTags.length > 0
      ? rawTags.split(",")
      : [];
  const chunkCount =
    typeof item.chunks_count === "number" ? item.chunks_count : 0;

  return (
    <TableRow
      data-state={selected ? "selected" : undefined}
      className={cn(
        "cursor-pointer transition-colors",
        active && "bg-accent/50",
      )}
    >
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={selected}
          onCheckedChange={(v) => onToggle(v === true)}
          aria-label={t("workspace.items.selectRow")}
        />
      </TableCell>
      <TableCell onClick={onOpen} className="font-medium">
        {item.name ?? item.external_id ?? t("workspace.items.untitled")}
      </TableCell>
      <TableCell onClick={onOpen}>
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map((tag, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {tags.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{tags.length - 3}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell onClick={onOpen}>
        {item.updatedAt ? <RelativeTime date={item.updatedAt} /> : null}
      </TableCell>
      <TableCell onClick={onOpen} className="text-sm text-muted-foreground">
        {chunkCount > 0
          ? t("workspace.items.chunks", { count: chunkCount })
          : t("workspace.items.notEmbedded")}
      </TableCell>
      <TableCell onClick={onOpen} className="text-sm text-muted-foreground">
        {item.last_processed_at ? (
          <RelativeTime date={item.last_processed_at} />
        ) : (
          t("workspace.items.never")
        )}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
        <FavoriteToggle
          pressed={favorited}
          onToggle={onToggleFavorite}
          label={
            favorited
              ? t("pins.unfavourite")
              : t("pins.favourite")
          }
        />
      </TableCell>
    </TableRow>
  );
}

function ItemCard({
  item,
  selected,
  active,
  onToggle,
  onOpen,
  favorited,
  onToggleFavorite,
}: RowProps) {
  const t = useTranslations("knowledge");
  const chunkCount =
    typeof item.chunks_count === "number" ? item.chunks_count : 0;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border p-3 transition-colors",
        active ? "border-primary bg-accent/30" : "hover:bg-accent/40",
      )}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={(v) => onToggle(v === true)}
        aria-label={t("workspace.items.selectRow")}
        className="mt-1"
      />
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 flex-col gap-1 text-left"
      >
        <span className="truncate text-sm font-medium">
          {item.name ?? item.external_id ?? t("workspace.items.untitled")}
        </span>
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {item.updatedAt && <RelativeTime date={item.updatedAt} />}
          <Database aria-hidden="true" className="size-3" />
          {chunkCount > 0
            ? t("workspace.items.chunks", { count: chunkCount })
            : t("workspace.items.notEmbedded")}
        </span>
      </button>
      <FavoriteToggle
        pressed={favorited}
        onToggle={onToggleFavorite}
        label={favorited ? t("pins.unfavourite") : t("pins.favourite")}
        className="-mt-1"
      />
    </div>
  );
}
