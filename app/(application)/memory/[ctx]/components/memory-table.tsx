"use client";

import { useApolloClient, useMutation } from "@apollo/client";
import type { ColumnDef } from "@tanstack/react-table";
import { Bookmark, Globe, Lock, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { BulkActionBar } from "@/components/primitives/bulk-action-bar";
import { ConfirmDialog, type ConfirmDialogError } from "@/components/primitives/confirm-dialog";
import { DataTable } from "@/components/primitives/data-table";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Toolbar } from "@/components/primitives/toolbar";
import { BulkAccessDialog } from "@/components/widgets/bulk-access-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { BULK_UPDATE_MEMORY_RBAC, DELETE_MEMORY_ITEM, UPDATE_MEMORY_ITEM } from "../../queries";
import {
  type MemoryContext, type MemoryContributor, type MemoryItem, type MemoryListFilters,
  activeFilterCount, creatorName, hasSourceSession, memoryTypeOptions, visibilityKey,
} from "./memory-list-data";
import { type UsageSummary, usageLabel } from "./usage-data";
import { useMemoryItems } from "./use-memory-items";

/** Radix Select rejects "" as an item value; this reserved value means "no filter". */
const ANY_FILTER_VALUE = "__any";

const VISIBILITY_ICON = { public: Globe, private: Lock, users: Users, roles: Users, teams: Users } as const;

export function VisibilityLabel({ mode }: { mode: string | null | undefined }) {
  const t = useTranslations("memory");
  const key = visibilityKey(mode);
  const Icon = VISIBILITY_ICON[key];
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <Icon className="size-3.5 text-muted-foreground" aria-hidden />
      {t(`visibility.${key}`)}
    </span>
  );
}

function MemoryCell({ item, contributors, usage }: { item: MemoryItem; contributors: MemoryContributor[]; usage?: UsageSummary }) {
  const t = useTranslations("memory");
  const creator = creatorName(contributors, item.created_by) ?? t("detail.unknownUser");
  const parts = [item.type, creator];
  const used = usageLabel(usage);
  if (used.kind === "used") parts.push(t("usage.usedTimes", { count: used.count }));
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm line-clamp-2">{item.information ?? item.name}</span>
      <span className="text-xs text-muted-foreground">{parts.filter(Boolean).join(" · ")}</span>
    </div>
  );
}

/** Shared Promise.allSettled loop for the bulk actions below — Delete and
 * Archive both need per-item failure reporting (ConfirmDialogError[]) and the
 * failed-ids-stay-selected contract, so only the mutation itself differs. */
async function runBulk(
  ids: string[],
  fn: (id: string) => Promise<unknown>,
): Promise<{ failedIds: string[]; failures: ConfirmDialogError[]; succeededCount: number }> {
  const results = await Promise.allSettled(ids.map((id) => fn(id)));
  const failedIds: string[] = [];
  const failures: ConfirmDialogError[] = [];
  let succeededCount = 0;
  results.forEach((result, index) => {
    const id = ids[index];
    if (result.status === "rejected") {
      failedIds.push(id);
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
      failures.push({ item: id, message });
    } else {
      succeededCount += 1;
    }
  });
  return { failedIds, failures, succeededCount };
}

export function MemoryTable({
  context, initialMine, initialPage, initialUsage, onChanged,
}: {
  context: MemoryContext; initialMine: boolean; initialPage: number; initialUsage?: "never" | "stale"; onChanged: () => void;
}) {
  const t = useTranslations("memory");
  const router = useRouter();
  const client = useApolloClient();
  const [search, setSearch] = React.useState("");
  const [mine, setMine] = React.useState(initialMine);
  const [page, setPage] = React.useState(initialPage);
  const [filters, setFilters] = React.useState<MemoryListFilters>(initialUsage ? { usage: initialUsage } : {});
  const [selected, setSelected] = React.useState<string[]>([]);
  const [accessOpen, setAccessOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteErrors, setDeleteErrors] = React.useState<ConfirmDialogError[]>([]);
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [archiveErrors, setArchiveErrors] = React.useState<ConfirmDialogError[]>([]);

  const withSourceSession = hasSourceSession(context);
  const list = useMemoryItems({ contextId: context.id, withSourceSession, page, search, mine, filters });
  const [deleteItem] = useMutation(DELETE_MEMORY_ITEM(context.id));
  const [updateItem] = useMutation(UPDATE_MEMORY_ITEM(context.id));

  // Back to page 1 whenever the query changes — but not on mount, where the
  // page comes from the URL. Compared against the previous values rather than a
  // mounted flag: React strict mode runs effects twice, which a flag reads as a
  // change and which would throw away the URL's page on the second pass.
  const prev = React.useRef({ search, mine, filters });
  React.useEffect(() => {
    const p = prev.current;
    if (p.search === search && p.mine === mine && p.filters === filters) return;
    prev.current = { search, mine, filters };
    setPage(1);
    setSelected([]);
  }, [search, mine, filters]);

  // Inline filter selects: the Toolbar renders its `filters` slot inline on
  // desktop and inside its own bottom sheet on mobile, so each control applies
  // immediately (same pattern as the agents and prompts pages).
  const fields = React.useMemo<{ id: keyof MemoryListFilters & string; label: string; placeholder: string; options: { value: string; label: string }[] }[]>(() => [
    {
      id: "visibility", label: t("filter.visibility"), placeholder: t("filter.any"),
      options: (["public", "private", "users", "roles", "teams"] as const).map((v) => ({ value: v, label: t(`visibility.${v}`) })),
    },
    {
      id: "type", label: t("filter.type"), placeholder: t("filter.any"),
      options: memoryTypeOptions(context).map((v) => ({ value: v, label: v })),
    },
    {
      id: "creator", label: t("filter.creator"), placeholder: t("filter.creatorPlaceholder"),
      options: list.contributors.map((c) => ({ value: String(c.id), label: c.name })),
    },
    {
      id: "usage", label: t("usage.label"), placeholder: t("usage.any"),
      options: [
        { value: "never", label: t("usage.never") },
        { value: "stale", label: t("usage.stale", { days: 90 }) },
      ],
    },
  ], [t, context, list.contributors]);

  const columns = React.useMemo<ColumnDef<MemoryItem>[]>(() => [
    {
      id: "memory", header: t("columns.memory"),
      cell: ({ row }) => <MemoryCell item={row.original} contributors={list.contributors} usage={list.usage.get(row.original.id)} />,
    },
    { id: "visibility", header: t("columns.visibility"), cell: ({ row }) => <VisibilityLabel mode={row.original.rights_mode} /> },
    { id: "saved", header: t("columns.saved"), cell: ({ row }) => (row.original.createdAt ? <RelativeTime date={row.original.createdAt} /> : "—") },
    {
      id: "lastUsed", header: t("usage.lastUsed"),
      cell: ({ row }) => {
        const u = usageLabel(list.usage.get(row.original.id));
        return u.kind === "used" && u.lastUsedAt
          ? <RelativeTime date={u.lastUsedAt} />
          : <span className="text-muted-foreground">{list.usageError ? "—" : t("usage.neverShort")}</span>;
      },
    },
  ], [t, list.contributors, list.usage, list.usageError]);

  const handleBulkDelete = async () => {
    const targets = selected;
    const { failedIds, failures, succeededCount } = await runBulk(targets, (id) => deleteItem({ variables: { id } }));

    // Refetch and notify the shell regardless of outcome — some items may
    // already have been removed even if others failed.
    list.refetch();
    client.cache.gc();
    onChanged();

    if (failures.length > 0) {
      setDeleteErrors(failures);
      setSelected(failedIds);
      if (succeededCount > 0) toast.success(t("bulk.deleted", { count: succeededCount }));
      toast.error(t("bulk.deleteFailed", { count: failures.length }));
      // Reject so ConfirmDialog keeps the dialog open for a retry with the
      // remaining (failed) selection — see components/primitives/confirm-dialog.tsx.
      throw new Error("Bulk delete had failures");
    }

    setSelected([]);
    toast.success(t("bulk.deleted", { count: succeededCount }));
  };

  const handleBulkArchive = async () => {
    const targets = selected;
    const { failedIds, failures, succeededCount } = await runBulk(targets, (id) => updateItem({ variables: { id, input: { archived: true } } }));

    // Mirrors handleBulkDelete: refetch and notify the shell regardless of
    // outcome, keep failed ids selected for a retry.
    list.refetch();
    client.cache.gc();
    onChanged();

    if (failures.length > 0) {
      setArchiveErrors(failures);
      setSelected(failedIds);
      if (succeededCount > 0) toast.success(t("bulk.archived", { count: succeededCount }));
      toast.error(t("bulk.archiveFailed", { count: failures.length }));
      throw new Error("Bulk archive had failures");
    }

    setSelected([]);
    toast.success(t("bulk.archived", { count: succeededCount }));
  };

  return (
    <div className="flex flex-col gap-4">
      <Toolbar
        search={{ value: search, onChange: setSearch, placeholder: t("filter.searchMemories") }}
        activeFilterCount={activeFilterCount(filters)}
        onResetFilters={() => setFilters({})}
        filters={
          <>
            {fields.map((f) => (
              <Select
                key={f.id}
                value={filters[f.id] ? String(filters[f.id]) : ANY_FILTER_VALUE}
                onValueChange={(v) =>
                  setFilters((current) => {
                    const next = { ...current };
                    if (v === ANY_FILTER_VALUE) delete next[f.id];
                    else next[f.id] = v;
                    return next;
                  })
                }
              >
                <SelectTrigger aria-label={f.label} className="w-full md:w-44">
                  <SelectValue placeholder={f.placeholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_FILTER_VALUE}>{f.placeholder}</SelectItem>
                  {f.options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
          </>
        }
        view={
          <Tabs value={mine ? "mine" : "all"} onValueChange={(v) => setMine(v === "mine")}>
            <TabsList>
              <TabsTrigger value="all">{t("filter.all")}</TabsTrigger>
              <TabsTrigger value="mine">{t("filter.mine")}</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      {selected.length > 0 && (
        <BulkActionBar
          count={selected.length}
          onClear={() => setSelected([])}
          actions={[
            { label: t("bulk.setAccess"), onClick: () => setAccessOpen(true) },
            { label: t("bulk.archive"), onClick: () => { setArchiveErrors([]); setArchiveOpen(true); } },
            {
              label: t("bulk.delete"),
              onClick: () => { setDeleteErrors([]); setDeleteOpen(true); },
              destructive: true,
            },
          ]}
        />
      )}
      <DataTable<MemoryItem>
        columns={columns}
        data={list.items}
        loading={list.loading || list.unusedLoading}
        error={list.error ? { message: list.error.message, onRetry: list.refetch } : null}
        pagination={{ pageInfo: list.pageInfo, onPageChange: setPage }}
        selection={{ selected, onChange: setSelected }}
        onRowClick={(row) => router.push(`/memory/${context.id}/${row.id}`)}
        getRowId={(row) => row.id}
        empty={{ icon: Bookmark, title: t("empty.memoriesTitle"), description: t("empty.memoriesDescription") }}
        mobileCard={(row) => {
          const rowUsage = usageLabel(list.usage.get(row.id));
          return (
            <div className="flex flex-col gap-1">
              <MemoryCell item={row} contributors={list.contributors} usage={list.usage.get(row.id)} />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <VisibilityLabel mode={row.rights_mode} />
                {row.createdAt && <RelativeTime date={row.createdAt} />}
              </div>
              <div className="text-xs text-muted-foreground">
                {t("usage.lastUsed")}:{" "}
                {rowUsage.kind === "used" && rowUsage.lastUsedAt
                  ? <RelativeTime date={rowUsage.lastUsedAt} />
                  : (list.usageError ? "—" : t("usage.neverShort"))}
              </div>
            </div>
          );
        }}
      />
      <BulkAccessDialog
        open={accessOpen}
        onOpenChange={setAccessOpen}
        mutation={BULK_UPDATE_MEMORY_RBAC(context.id)}
        ids={selected}
        onApplied={() => { setSelected([]); list.refetch(); onChanged(); }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        variant="destructive"
        title={t("bulk.deleteTitle", { count: selected.length })}
        description={t("bulk.deleteDescription")}
        confirmLabel={t("bulk.delete")}
        errors={deleteErrors}
        onConfirm={handleBulkDelete}
      />
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        variant="default"
        title={t("bulk.archiveTitle", { count: selected.length })}
        description={t("bulk.archiveDescription")}
        confirmLabel={t("bulk.archive")}
        errors={archiveErrors}
        onConfirm={handleBulkArchive}
      />
    </div>
  );
}
