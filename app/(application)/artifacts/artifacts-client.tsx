"use client";

/**
 * /artifacts — the Artifacts page: every shared artifact the viewer may
 * open, as a searchable, filterable table with a type badge, the access mode,
 * who published it (mine / shared), when, a favourite star, an Open button
 * and a row menu (open in new tab, copy link, download; for the creator or a
 * super admin also rename, sharing and delete). Opening navigates to the
 * in-shell viewer under /artifacts/open/<name>; the published
 * /artifacts/<name> links stay as they are for people outside the IMP.
 *
 * A fixed-layout table, not a flex row: badges and dates differ in width
 * from row to row, and only real columns keep them aligned. Below md the
 * table keeps the star, the name and the actions; the badge columns are
 * folded into the name cell.
 *
 * Favourites (2026-10-27): with no search and the "All" filter, the starred
 * artifacts come first as preview cards (components/favourite-cards.tsx —
 * HTML apps scaled down in a sandbox, images as thumbnails, the rest as
 * their kind) in star order; the table below still lists everything under
 * an "All artifacts" heading, the /agents precedent.
 */

import { Globe, LayoutGrid, Lock, Plus, Search, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/primitives/empty-state";
import { FavoriteToggle } from "@/components/primitives/favorite-toggle";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { CreateArtifactDialog } from "./components/create-dialog";
import { DeleteArtifactDialog } from "./components/delete-dialog";
import { FavouriteArtifactCards } from "./components/favourite-cards";
import { RenameArtifactDialog } from "./components/rename-dialog";
import { ReplaceFileDialog } from "./components/replace-file-dialog";
import { ArtifactRowMenu } from "./components/row-menu";
import { SharingDialog } from "./components/sharing-dialog";
import { orderFavouriteArtifacts } from "./favourites";
import { useFavoriteArtifacts, useSharedArtifacts, type ArtifactListItem } from "./hooks";
import { KIND_ICON } from "./kind-icon";

type Filter = "all" | "favorites" | "mine" | "shared";
type DialogState = { kind: "rename" | "replace" | "sharing" | "delete"; name: string } | null;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function ArtifactsClient() {
  const t = useTranslations("artifacts");
  const router = useRouter();
  const { items, loading, error, refetch } = useSharedArtifacts();
  const { favoriteNames, isFavorite, toggle, replaceFavorite, canFavorite } = useFavoriteArtifacts();
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [dialog, setDialog] = React.useState<DialogState>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  const visible = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "favorites" && !isFavorite(item.name)) return false;
      if (filter === "mine" && !item.mine) return false;
      if (filter === "shared" && item.mine) return false;
      if (q && !`${item.name} ${item.filename}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, filter, isFavorite]);

  // Starred artifacts as cards, only in the unfiltered view — a search or a
  // filter means the user is looking for something specific.
  const favouriteCards = React.useMemo(
    () => (filter === "all" && !search.trim() ? orderFavouriteArtifacts(favoriteNames, items) : []),
    [filter, search, favoriteNames, items],
  );

  const copyLink = React.useCallback(
    async (item: ArtifactListItem) => {
      try {
        await navigator.clipboard.writeText(`${window.location.origin}${item.shareUrl}`);
        toast.success(t("linkCopied"));
      } catch {
        // the clipboard is unavailable in some embedded contexts; the link is still visible in the row
      }
    },
    [t],
  );
  const openInNewTab = (item: ArtifactListItem) => window.open(item.shareUrl, "_blank", "noopener,noreferrer");
  const download = (item: ArtifactListItem) => window.open(`${item.shareUrl}/content`, "_blank", "noopener,noreferrer");
  const closeDialog = (open: boolean) => {
    if (!open) setDialog(null);
  };

  const filters: Array<{ id: Filter; label: string }> = [
    { id: "all", label: t("filterAll") },
    { id: "favorites", label: t("filterFavorites") },
    { id: "mine", label: t("filterMine") },
    { id: "shared", label: t("filterShared") },
  ];

  const accessIcon = (mode: ArtifactListItem["authMode"]) =>
    mode === "public" ? <Globe aria-hidden="true" className="size-3" /> : mode === "password" ? <Lock aria-hidden="true" className="size-3" /> : <Users aria-hidden="true" className="size-3" />;
  const accessLabel = (mode: ArtifactListItem["authMode"]) => (mode === "public" ? t("accessPublic") : mode === "password" ? t("accessPassword") : t("accessLogin"));

  return (
    <PageShell>
      <PageHeader
        title={t("title")}
        description={t("description")}
        meta={items.length > 0 ? <span className="text-sm text-muted-foreground">{t("countOf", { shown: visible.length, total: items.length })}</span> : undefined}
        action={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" className="mr-2 size-4" />
            {t("newArtifact")}
          </Button>
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <Button key={f.id} type="button" size="sm" variant={filter === f.id ? "default" : "outline"} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id}>
              {f.label}
            </Button>
          ))}
        </div>
        <div className="relative md:w-80">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} className="pl-9" aria-label={t("searchPlaceholder")} />
        </div>
      </div>

      {error ? (
        <EmptyState icon={LayoutGrid} title={t("errorTitle")} description={error.message} action={{ label: t("retry"), onClick: () => void refetch() }} />
      ) : loading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={LayoutGrid} title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : visible.length === 0 ? (
        <EmptyState icon={Search} title={t("emptyFilteredTitle")} description={t("emptyFilteredDescription")} />
      ) : (
        <div className="flex flex-col gap-6">
          <FavouriteArtifactCards items={favouriteCards} canFavorite={canFavorite} onUnfavorite={(name) => void toggle(name)} />
          {favouriteCards.length > 0 ? <h2 className="text-sm font-medium text-muted-foreground">{t("allArtifacts")}</h2> : null}
        <div className="overflow-hidden rounded-lg border">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12">
                  <span className="sr-only">{t("favorite")}</span>
                </TableHead>
                <TableHead>{t("columnName")}</TableHead>
                <TableHead className="hidden w-32 md:table-cell">{t("columnType")}</TableHead>
                <TableHead className="hidden w-40 md:table-cell">{t("columnAccess")}</TableHead>
                <TableHead className="hidden w-28 md:table-cell">{t("columnOwner")}</TableHead>
                <TableHead className="hidden w-32 md:table-cell">{t("columnCreated")}</TableHead>
                <TableHead className="w-14 text-right md:w-36">
                  <span className="sr-only">{t("columnActions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((item) => {
                const Icon = KIND_ICON[item.type.kind];
                const favorite = isFavorite(item.name);
                return (
                  <TableRow key={item.id} className={cn("group", item.expired && "text-muted-foreground")}>
                    <TableCell className="py-2">
                      {canFavorite && <FavoriteToggle pressed={favorite} onToggle={() => void toggle(item.name)} label={favorite ? t("unfavorite") : t("favorite")} />}
                    </TableCell>
                    <TableCell className="py-2">
                      <Link href={item.href} className="flex min-w-0 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${t("open")}: ${item.name}`}>
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <Icon aria-hidden="true" className="size-4" />
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className={cn("truncate font-medium", !item.expired && "text-foreground")}>{item.name}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {item.filename}
                            <span className="md:hidden">
                              {" · "}
                              {t(item.type.labelKey)}
                              {" · "}
                              {accessLabel(item.authMode)}
                            </span>
                          </span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden py-2 md:table-cell">
                      <Badge variant="secondary">{t(item.type.labelKey)}</Badge>
                    </TableCell>
                    <TableCell className="hidden py-2 md:table-cell">
                      <Badge variant="outline" className="gap-1 whitespace-nowrap">
                        {accessIcon(item.authMode)}
                        {accessLabel(item.authMode)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden py-2 md:table-cell">
                      <Badge variant="outline">{item.mine ? t("mine") : t("shared")}</Badge>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap py-2 text-sm tabular-nums text-muted-foreground md:table-cell">{item.expired ? t("expired") : formatDate(item.createdAt)}</TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button type="button" size="sm" variant="outline" className="hidden md:inline-flex" onClick={() => router.push(item.href)}>
                          {t("open")}
                        </Button>
                        <ArtifactRowMenu
                          item={item}
                          onOpenInNewTab={() => openInNewTab(item)}
                          onCopyLink={() => void copyLink(item)}
                          onDownload={() => download(item)}
                          onRename={() => setDialog({ kind: "rename", name: item.name })}
                          onReplace={() => setDialog({ kind: "replace", name: item.name })}
                          onSharing={() => setDialog({ kind: "sharing", name: item.name })}
                          onDelete={() => setDialog({ kind: "delete", name: item.name })}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        </div>
      )}

      <CreateArtifactDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => void refetch()} />
      <RenameArtifactDialog
        name={dialog?.kind === "rename" ? dialog.name : null}
        onOpenChange={closeDialog}
        onRenamed={(from, to) => {
          void replaceFavorite(from, to);
          void refetch();
        }}
      />
      <ReplaceFileDialog
        item={dialog?.kind === "replace" ? (items.find((item) => item.name === dialog.name) ?? null) : null}
        onOpenChange={closeDialog}
        onReplaced={() => void refetch()}
      />
      <SharingDialog name={dialog?.kind === "sharing" ? dialog.name : null} onOpenChange={closeDialog} onSaved={() => void refetch()} />
      <DeleteArtifactDialog
        name={dialog?.kind === "delete" ? dialog.name : null}
        onOpenChange={closeDialog}
        onDeleted={(name) => {
          void replaceFavorite(name, null);
          void refetch();
        }}
      />
    </PageShell>
  );
}
