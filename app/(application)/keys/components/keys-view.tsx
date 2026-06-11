"use client";

/**
 * /keys L1 surface — keys-token.md §3 "Default view".
 *
 * The table IS the page: four quiet columns (Name · Scope · Last used ·
 * Created) + a chevron affordance; clicking a row opens the L2 detail via
 * ListDetail (full-height right Sheet at md+, bottom Sheet on phones — T2;
 * detailPresentation="sheet" because a docked aside cannot reach the edges
 * of this centered content page, 2026-06-11 QA decision; selection is
 * URL-synced for deep links). The masked-asterisks
 * column is gone (it conveyed nothing) — the mask lives in the panel where it
 * has context. Creation moved into the L3 dialog behind the page's single
 * purple action. Pagination is wired to pageInfo (fixes U2), search filters
 * the loaded page client-side, loading renders skeleton rows and errors
 * render the shared error state with Retry (fixes U5).
 *
 * Below `md` (T1): rows become tappable cards (line 1 name + scope badge,
 * line 2 "Last used · Created") — revoke is open card → Danger zone →
 * confirm: three taps, one-handed.
 *
 * Palette convention: arriving with ?new=1 opens the create dialog.
 */

import type { ColumnDef } from "@tanstack/react-table";
import { ChevronRight, Key, Plus, SearchX } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { DataTable } from "@/components/primitives/data-table";
import { ListDetail } from "@/components/primitives/list-detail";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Toolbar } from "@/components/primitives/toolbar";
import { MobileTopbarAction } from "@/components/shell/mobile-topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  type ApiKeyRow,
  keyDisplayName,
  useAgentNames,
  useApiKeys,
} from "../hooks";
import { KeyCreateDialog } from "./key-create-dialog";
import { KeyDetailPanel } from "./key-detail-panel";
import { ScopeBadge } from "./scope-badge";

export function KeysView() {
  const t = useTranslations("keys");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    keys,
    pageInfo,
    loading,
    error,
    refetch,
    setPage,
    createKey,
    updateRole,
    deleteKey,
  } = useApiKeys();
  const { agents } = useAgentNames();

  const [query, setQuery] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // Palette deep-link: /keys?new=1 opens the create dialog (navigation.md §4).
  React.useEffect(() => {
    if (searchParams.get("new") === "1") {
      setCreateOpen(true);
      router.replace("/keys", { scroll: false });
    }
  }, [searchParams, router]);

  // Selection derives from the live list so the panel reflects poll updates;
  // a deleted / paged-away row closes the panel.
  const selected = React.useMemo(
    () => keys?.find((key) => key.id === selectedId) ?? null,
    [keys, selectedId],
  );

  const searching = query.trim().length > 0;
  const filteredKeys = React.useMemo(() => {
    if (!keys) return undefined;
    if (!searching) return keys;
    const needle = query.trim().toLowerCase();
    return keys.filter((key) =>
      keyDisplayName(key).toLowerCase().includes(needle),
    );
  }, [keys, query, searching]);

  const createdFormatter = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale],
  );

  const columns = React.useMemo<ColumnDef<ApiKeyRow>[]>(
    () => [
      {
        id: "name",
        header: t("columns.name"),
        cell: ({ row }) => (
          <span className="font-medium">{keyDisplayName(row.original)}</span>
        ),
      },
      {
        id: "scope",
        header: t("columns.scope"),
        cell: ({ row }) => <ScopeBadge apiKey={row.original} />,
      },
      {
        id: "lastUsed",
        header: t("columns.lastUsed"),
        cell: ({ row }) =>
          row.original.last_used ? (
            <RelativeTime
              date={row.original.last_used}
              className="text-sm text-muted-foreground"
            />
          ) : (
            // An unused credential is an audit signal — the badge stays.
            <Badge variant="outline" className="text-xs">
              {t("neverUsed")}
            </Badge>
          ),
      },
      {
        id: "created",
        header: t("columns.created"),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {createdFormatter.format(new Date(row.original.createdAt))}
          </span>
        ),
      },
      {
        id: "open",
        header: () => null,
        cell: () => (
          <ChevronRight
            aria-hidden="true"
            className="ml-auto size-4 text-muted-foreground"
          />
        ),
      },
    ],
    [t, createdFormatter],
  );

  const openCreate = React.useCallback(() => setCreateOpen(true), []);

  const emptyState = searching
    ? {
        icon: SearchX,
        title: t("searchEmptyTitle"),
        description: t("searchEmptyDescription"),
      }
    : {
        icon: Key,
        title: t("emptyTitle"),
        description: t("emptyDescription"),
        action: { label: t("createKey"), onClick: openCreate },
      };

  return (
    // DEVIATION (recorded): keys-token.md §3 sketches /keys at `max-w-5xl`,
    // but PageShell allows exactly three named widths and forbids per-page
    // values (codebase-structure §2.2 / design-system R2-R3) — the primitive's
    // rule wins, so /keys uses the standard `content` width (max-w-7xl).
    <PageShell variant="content">
      <MobileTopbarAction>
        <Button size="sm" onClick={openCreate}>
          <Plus aria-hidden="true" className="mr-1 size-4" />
          {t("createKey")}
        </Button>
      </MobileTopbarAction>

      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          <Button onClick={openCreate}>
            <Plus aria-hidden="true" className="mr-2 size-4" />
            {t("createKey")}
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        <Toolbar
          search={{
            value: query,
            onChange: setQuery,
            placeholder: t("searchPlaceholder"),
          }}
        />

        <ListDetail<ApiKeyRow>
          detailPresentation="sheet"
          items={filteredKeys}
          selected={selected}
          onSelect={(item) => setSelectedId(item ? item.id : null)}
          detailTitle={(item) => keyDisplayName(item)}
          detail={(item) => (
            <KeyDetailPanel
              apiKey={item}
              onChangeRole={updateRole}
              onDelete={deleteKey}
              onDeleted={() => setSelectedId(null)}
            />
          )}
          list={
            <DataTable<ApiKeyRow>
              columns={columns}
              data={filteredKeys}
              loading={loading}
              error={
                // Only replace the table when there is nothing to show — a
                // failed background poll must not blank a populated list.
                error && !keys
                  ? { message: error.message, onRetry: () => refetch() }
                  : null
              }
              pagination={
                pageInfo ? { pageInfo, onPageChange: setPage } : undefined
              }
              onRowClick={(row) => setSelectedId(row.id)}
              empty={emptyState}
              mobileCard={(row) => (
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-medium">
                      {keyDisplayName(row)}
                    </span>
                    <ScopeBadge apiKey={row} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("columns.lastUsed")}{" "}
                    {row.last_used ? (
                      <RelativeTime date={row.last_used} />
                    ) : (
                      t("neverUsed").toLowerCase()
                    )}
                    {" · "}
                    {t("columns.created")}{" "}
                    {createdFormatter.format(new Date(row.createdAt))}
                  </p>
                </div>
              )}
            />
          }
        />

        {/* Quiet cross-link — each credential page points at the other. */}
        <p className="text-xs text-muted-foreground">
          {t("tokenCrossLink")}{" "}
          <Link
            href="/token"
            className="underline underline-offset-2 transition-colors duration-150 hover:text-foreground"
          >
            {t("tokenCrossLinkAction")}
          </Link>
        </p>
      </div>

      <KeyCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        agents={agents}
        onCreate={createKey}
      />
    </PageShell>
  );
}
