"use client";

import { useApolloClient, useMutation } from "@apollo/client";
import type { ColumnDef } from "@tanstack/react-table";
import { Bookmark, Globe, Lock, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { BulkActionBar } from "@/components/primitives/bulk-action-bar";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { DataTable } from "@/components/primitives/data-table";
import { FilterPanel, type FilterFieldDef } from "@/components/primitives/filter-panel";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Toolbar } from "@/components/primitives/toolbar";
import { BulkAccessDialog } from "@/components/widgets/bulk-access-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { BULK_UPDATE_MEMORY_RBAC, DELETE_MEMORY_ITEM, SEARCH_USERS, GET_USERS_BY_IDS } from "../../queries";
import {
  type MemoryContext, type MemoryItem, type MemoryListFilters, type UserName,
  activeFilterCount, creatorName, hasSourceSession, memoryTypeOptions, visibilityKey,
} from "./memory-list-data";
import { useMemoryItems } from "./use-memory-items";

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

function MemoryCell({ item, users }: { item: MemoryItem; users: UserName[] }) {
  const t = useTranslations("memory");
  const creator = creatorName(users, item.created_by) ?? t("detail.unknownUser");
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm line-clamp-2">{item.information ?? item.name}</span>
      <span className="text-xs text-muted-foreground">{[item.type, creator].filter(Boolean).join(" · ")}</span>
    </div>
  );
}

export function MemoryTable({
  context, initialMine, initialPage, onChanged,
}: { context: MemoryContext; initialMine: boolean; initialPage: number; onChanged: () => void }) {
  const t = useTranslations("memory");
  const tc = useTranslations("common");
  const router = useRouter();
  const client = useApolloClient();
  const [search, setSearch] = React.useState("");
  const [mine, setMine] = React.useState(initialMine);
  const [page, setPage] = React.useState(initialPage);
  const [draft, setDraft] = React.useState<MemoryListFilters>({});
  const [filters, setFilters] = React.useState<MemoryListFilters>({});
  const [selected, setSelected] = React.useState<string[]>([]);
  const [accessOpen, setAccessOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const withSourceSession = hasSourceSession(context);
  const list = useMemoryItems({ contextId: context.id, withSourceSession, page, search, mine, filters });
  const [deleteItem] = useMutation(DELETE_MEMORY_ITEM(context.id));

  // Back to page 1 whenever the query changes — but not on mount, where the
  // page comes from the URL.
  const mounted = React.useRef(false);
  React.useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    setPage(1);
    setSelected([]);
  }, [search, mine, filters]);

  const fields = React.useMemo<FilterFieldDef[]>(() => [
    {
      id: "visibility", label: t("filter.visibility"), type: "select", placeholder: t("filter.any"),
      options: (["public", "private", "users", "roles", "teams"] as const).map((v) => ({ value: v, label: t(`visibility.${v}`) })),
    },
    {
      id: "type", label: t("filter.type"), type: "select", placeholder: t("filter.any"),
      options: memoryTypeOptions(context).map((v) => ({ value: v, label: v })),
    },
    {
      id: "creator", label: t("filter.creator"), type: "entity",
      placeholder: t("filter.creatorPlaceholder"), searchPlaceholder: t("filter.creatorSearch"), emptyMessage: t("filter.creatorEmpty"),
      fetchOptions: async (q) => {
        if (!q.trim()) return [];
        const res = await client.query<{ usersPagination: { items: UserName[] } }>({ query: SEARCH_USERS, variables: { search: q.trim() } });
        return res.data.usersPagination.items.map((u) => ({ value: String(u.id), label: creatorName([u], Number(u.id)) ?? String(u.id) }));
      },
      resolveLabel: async (id) => {
        const res = await client.query<{ usersPagination: { items: UserName[] } }>({ query: GET_USERS_BY_IDS, variables: { ids: [Number(id)] } });
        return creatorName(res.data.usersPagination.items, Number(id));
      },
    },
  ], [t, context, client]);

  const columns = React.useMemo<ColumnDef<MemoryItem>[]>(() => [
    { id: "memory", header: t("columns.memory"), cell: ({ row }) => <MemoryCell item={row.original} users={list.users} /> },
    { id: "visibility", header: t("columns.visibility"), cell: ({ row }) => <VisibilityLabel mode={row.original.rights_mode} /> },
    { id: "saved", header: t("columns.saved"), cell: ({ row }) => (row.original.createdAt ? <RelativeTime date={row.original.createdAt} /> : "—") },
  ], [t, list.users]);

  const handleBulkDelete = async () => {
    const results = await Promise.allSettled(selected.map((id) => deleteItem({ variables: { id } })));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed) toast.error(t("bulk.deleteFailed", { count: failed }));
    if (failed < selected.length) toast.success(t("bulk.deleted", { count: selected.length - failed }));
    setSelected([]);
    setDeleteOpen(false);
    list.refetch();
    client.cache.gc();
    onChanged();
  };

  return (
    <div className="flex flex-col gap-4">
      <Toolbar
        search={{ value: search, onChange: setSearch, placeholder: t("filter.searchMemories") }}
        activeFilterCount={activeFilterCount(filters)}
        onResetFilters={() => { setFilters({}); setDraft({}); }}
        filters={
          <FilterPanel<MemoryListFilters>
            fields={fields}
            value={draft}
            onChange={setDraft}
            ctaLabel={t("filter.apply")}
            cancelLabel={tc("cancel")}
            onCancel={() => setDraft(filters)}
            onClear={() => { setDraft({}); setFilters({}); }}
            onConfirm={() => setFilters(draft)}
          />
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
            { label: t("bulk.delete"), onClick: () => setDeleteOpen(true), destructive: true },
          ]}
        />
      )}
      <DataTable<MemoryItem>
        columns={columns}
        data={list.items}
        loading={list.loading}
        error={list.error ? { message: list.error.message, onRetry: list.refetch } : null}
        pagination={{ pageInfo: list.pageInfo, onPageChange: setPage }}
        selection={{ selected, onChange: setSelected }}
        onRowClick={(row) => router.push(`/memory/${context.id}/${row.id}`)}
        getRowId={(row) => row.id}
        empty={{ icon: Bookmark, title: t("empty.memoriesTitle"), description: t("empty.memoriesDescription") }}
        mobileCard={(row) => (
          <div className="flex flex-col gap-1">
            <MemoryCell item={row} users={list.users} />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <VisibilityLabel mode={row.rights_mode} />
              {row.createdAt && <RelativeTime date={row.createdAt} />}
            </div>
          </div>
        )}
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
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}
