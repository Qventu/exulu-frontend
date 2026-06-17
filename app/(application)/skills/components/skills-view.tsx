"use client";

/**
 * /skills L1 surface (work item 2.10; skills.md §3 "Default view").
 *
 * Composition: PageShell content → PageHeader ("Skills" + "New Skill") →
 * Toolbar (search + pager + count) → ListDetail (detailMode="panel",
 * detailPresentation="docked", detailEmphasis="primary" — the skill detail
 * IS the page, the list is the slim picker, per brief rule 6).
 *
 * Restores real pagination via pageInfo from useSkillsIndex (fixes H1).
 * Releases ⌘K to the global palette and rebinds the create shortcut to
 * single-key "N" (fixes H8; the chat redesign already released the chord).
 * Palette deep-link via `?new=1` opens the create dialog (mirrors prompts).
 *
 * Below lg the detail panel is lifted into a Sheet by ListDetail — there is
 * no docked side panel on phones.
 *
 * Hosts the single ConfirmDialog for delete (philosophy §5: one
 * destructive-confirmation surface). Row kebabs call onRequestDelete which
 * routes here.
 */

import { ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { UserContext } from "@/app/(application)/authenticated";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { EmptyState } from "@/components/primitives/empty-state";
import { ListDetail } from "@/components/primitives/list-detail";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { Toolbar } from "@/components/primitives/toolbar";
import { MobileTopbarAction } from "@/components/shell/mobile-topbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import {
  SKILLS_PAGE_SIZE,
  useDeleteSkillLocal,
  useSkillsIndex,
} from "../hooks";
import { hasSkillWriteAccess, type Skill } from "../types";
import { CreateSkillDialog } from "./create-skill-dialog";
import { SkillDetailPanel } from "./skill-detail-panel";
import { SkillListItem } from "./skill-list-item";

const SKELETON_ROWS = 8;

export function SkillsView() {
  const t = useTranslations("skills");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = React.useContext(UserContext);

  const {
    items,
    pageInfo,
    loading,
    error,
    refetch,
    page,
    setPage,
    search,
    setSearch,
  } = useSkillsIndex();

  const [deleteSkill, { loading: deleting }] = useDeleteSkillLocal();

  // ----- Selection (URL-synced via ListDetail) -----------------------------
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selected = React.useMemo(
    () => items.find((s) => s.id === selectedId) ?? null,
    [items, selectedId],
  );

  // Auto-select first skill on lg+ only (responsive.md T2 — phones never
  // auto-open a sheet, mirroring the prompts pattern).
  React.useEffect(() => {
    if (selectedId) return;
    if (items.length === 0) return;
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    setSelectedId(items[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length === 0 ? "" : items[0]?.id, selectedId]);

  // Keep selection valid after refetch (skill may have been deleted elsewhere).
  React.useEffect(() => {
    if (!selectedId) return;
    if (items.find((s) => s.id === selectedId)) return;
    if (items.length === 0) {
      setSelectedId(null);
      return;
    }
    // Skill was removed — clear; the lg+ auto-select effect will re-pick.
    setSelectedId(null);
  }, [items, selectedId]);

  // ----- Create dialog: ?new=1 deep-link + keyboard "N" --------------------
  const [createOpen, setCreateOpen] = React.useState(false);

  React.useEffect(() => {
    if (searchParams.get("new") === "1") {
      setCreateOpen(true);
      router.replace("/skills", { scroll: false });
    }
  }, [searchParams, router]);

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      )
        return;

      if (event.key === "n" && !event.shiftKey) {
        event.preventDefault();
        setCreateOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ----- Delete (single ConfirmDialog hosted here, opened by row kebab) ----
  const [skillPendingDelete, setSkillPendingDelete] =
    React.useState<Skill | null>(null);

  const handleConfirmDelete = React.useCallback(async () => {
    if (!skillPendingDelete) return;
    try {
      await deleteSkill(skillPendingDelete.id);
      toast.success(t("delete.success", { name: skillPendingDelete.name }));
      if (selectedId === skillPendingDelete.id) setSelectedId(null);
      setSkillPendingDelete(null);
      await refetch();
    } catch (err) {
      toast.error(t("delete.failed"), {
        description: (err as Error).message,
      });
      throw err; // keep ConfirmDialog open per its contract
    }
  }, [deleteSkill, refetch, selectedId, skillPendingDelete, t]);

  // ----- Copy ID helper passed to rows -------------------------------------
  const handleCopyId = React.useCallback(
    async (id: string) => {
      try {
        await navigator.clipboard.writeText(id);
        toast.success(tCommon("copied"));
      } catch {
        toast.error(tCommon("copyFailed"));
      }
    },
    [tCommon],
  );

  // ----- Render branches ---------------------------------------------------
  const showSkeleton = loading && items.length === 0;
  const showError = !!error && items.length === 0;
  const showEmpty = !loading && !showError && items.length === 0;
  const isFiltered = search.trim().length > 0;

  const emptyState = isFiltered ? (
    <EmptyState
      icon={Sparkles}
      title={t("emptySearchTitle")}
      description={t("emptySearchDescription")}
      action={{ label: t("clearSearch"), onClick: () => setSearch("") }}
    />
  ) : (
    <EmptyState
      icon={Sparkles}
      title={t("emptyTitle")}
      description={t("emptyDescription")}
      action={{ label: t("newSkill"), onClick: () => setCreateOpen(true) }}
    />
  );

  const list = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {showError ? (
          <div className="p-4">
            <EmptyState
              variant="error"
              title={t("errorTitle")}
              description={t("errorDescription")}
              action={{ label: tCommon("retry"), onClick: () => refetch() }}
            />
          </div>
        ) : showSkeleton ? (
          <ul aria-busy="true" className="divide-y divide-border">
            {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
              <li key={index} className="space-y-1.5 px-3 py-2.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </li>
            ))}
          </ul>
        ) : showEmpty ? (
          <div className="p-4">{emptyState}</div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((skill) => {
              const canWrite = hasSkillWriteAccess(skill, user);
              return (
                <SkillListItem
                  key={skill.id}
                  skill={skill}
                  isSelected={selectedId === skill.id}
                  canWrite={canWrite}
                  onSelect={() => setSelectedId(skill.id)}
                  onOpenEditor={() => router.push(`/skills/${skill.id}`)}
                  onRequestDelete={() => setSkillPendingDelete(skill)}
                  onCopyId={() => void handleCopyId(skill.id)}
                />
              );
            })}
          </ul>
        )}
      </div>

      {/* Pagination footer (fixes H1) — visible only when pageInfo.pageCount > 1. */}
      {pageInfo && pageInfo.pageCount > 1 ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-3 py-2">
          <span
            className="text-xs text-muted-foreground"
            aria-live="polite"
          >
            {t("rangeOfTotal", {
              from: Math.min(
                (page - 1) * SKILLS_PAGE_SIZE + 1,
                pageInfo.itemCount,
              ),
              to: Math.min(page * SKILLS_PAGE_SIZE, pageInfo.itemCount),
              total: pageInfo.itemCount,
            })}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-11 md:size-8"
              onClick={() => setPage(page - 1)}
              disabled={!pageInfo.hasPreviousPage}
            >
              <span className="sr-only">{tCommon("goToPreviousPage")}</span>
              <ChevronLeft aria-hidden="true" className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 md:size-8"
              onClick={() => setPage(page + 1)}
              disabled={!pageInfo.hasNextPage}
            >
              <span className="sr-only">{tCommon("goToNextPage")}</span>
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );

  // Skill count goes in the Toolbar right cluster (item #5).
  const countSlot =
    !loading && pageInfo ? (
      <span className="hidden text-sm text-muted-foreground md:inline">
        {t("countLabel", { count: pageInfo.itemCount })}
      </span>
    ) : null;

  return (
    <PageShell variant="content">
      <MobileTopbarAction>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus aria-hidden="true" className="mr-1 size-4" />
          {t("newSkill")}
        </Button>
      </MobileTopbarAction>

      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" className="mr-2 size-4" />
            {t("newSkill")}
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        <Toolbar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: t("searchPlaceholder"),
            debounceMs: 0, // debounce lives in useSkillsIndex
          }}
          view={countSlot}
        />

        <div className="flex min-h-[60vh] overflow-hidden rounded-md border bg-card lg:min-h-[calc(100dvh-18rem)]">
          <ListDetail<Skill>
            detailMode="panel"
            detailPresentation="docked"
            detailEmphasis="primary"
            items={items}
            selected={selected}
            onSelect={(item) => setSelectedId(item ? item.id : null)}
            detailTitle={(item) => item.name}
            detail={(item) => (
              <SkillDetailPanel
                skill={item}
                canWrite={hasSkillWriteAccess(item, user)}
                onOpenEditor={() => router.push(`/skills/${item.id}`)}
                onRefetch={() => refetch()}
              />
            )}
            emptyDetail={
              <EmptyState
                variant="quiet"
                icon={Sparkles}
                title={t("detailEmptyTitle")}
              />
            }
            list={list}
            className="w-full"
          />
        </div>
      </div>

      <CreateSkillDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(skill) => router.push(`/skills/${skill.id}`)}
      />

      <ConfirmDialog
        open={skillPendingDelete !== null}
        onOpenChange={(next) => {
          if (!next) setSkillPendingDelete(null);
        }}
        title={t("delete.title", {
          name: skillPendingDelete?.name ?? "",
        })}
        description={t("delete.description")}
        variant="destructive"
        onConfirm={handleConfirmDelete}
        confirmLabel={deleting ? t("delete.deleting") : tCommon("delete")}
      />
    </PageShell>
  );
}
