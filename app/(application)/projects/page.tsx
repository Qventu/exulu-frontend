"use client";

/**
 * /projects index — the standard list page (projects.md §3 "Default view"):
 * PageHeader (ONE purple "New project", fixes the cryptic icon-plus, UX 13) →
 * Toolbar (server-side name search, inventory 2) → ListDetail-pattern row
 * list with a pinned Favorites group (shown once — fixes the duplicate
 * listing in inventory 3) and a "Load more" affordance past 200 (UX 11).
 *
 * The permanent ProjectNav sidebar and projects/layout.tsx are gone; project
 * switching happens here or via the ⌘K palette, like every other collection.
 * Palette convention: arriving with ?new=1 opens the create dialog
 * (navigation.md §4).
 */

import { FolderOpen, Plus, SearchX } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/primitives/empty-state";
import { FavoriteToggle } from "@/components/primitives/favorite-toggle";
import { ListDetail } from "@/components/primitives/list-detail";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Toolbar } from "@/components/primitives/toolbar";
import { MobileTopbarAction } from "@/components/shell/mobile-topbar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { CreateProjectDialog } from "./components/create-project-dialog";
import { ProjectAvatar } from "./components/project-avatar";
import { ProjectListSkeleton } from "./components/skeletons";
import {
  type ProjectRow,
  useFavoriteProjects,
  useProjectsIndex,
} from "./hooks";

export default function ProjectsPage() {
  // useSearchParams needs a Suspense boundary for prerendering.
  return (
    <React.Suspense fallback={null}>
      <ProjectsPageInner />
    </React.Suspense>
  );
}

function ProjectsPageInner() {
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const searching = query.trim().length > 0;
  const {
    projects,
    loading,
    error,
    refetch,
    canLoadMore,
    loadMore,
  } = useProjectsIndex(query.trim());
  const { favoriteIds, favorites, toggleFavorite } = useFavoriteProjects();

  // Palette deep-link: /projects?new=1 opens the create dialog
  // (navigation.md §4 — Create entries deep-link with ?new=1).
  React.useEffect(() => {
    if (searchParams.get("new") === "1") {
      setCreateOpen(true);
      router.replace("/projects", { scroll: false });
    }
  }, [searchParams, router]);

  const openCreate = React.useCallback(() => setCreateOpen(true), []);

  const handleToggleFavorite = React.useCallback(
    (projectId: string) => {
      void toggleFavorite(projectId).catch(() => {
        toast.error(t("favoriteError"));
      });
    },
    [toggleFavorite, t],
  );

  // Favorites pin on top and appear ONCE (fixes inventory 3's duplicate
  // listing); the group hides while searching (inventory 2). Rows come from
  // the by-ids query, with already-loaded index rows filling in while it
  // resolves — starring never makes a row transiently vanish from the list
  // (the star animation must confirm the tap, projects.md motion 2).
  const favoriteRows = React.useMemo(() => {
    if (searching) return [];
    const fromQuery = new Map(favorites.map((row) => [row.id, row] as const));
    const fromIndex = new Map(
      (projects ?? []).map((row) => [row.id, row] as const),
    );
    return favoriteIds
      .map((id) => fromQuery.get(id) ?? fromIndex.get(id))
      .filter((row): row is ProjectRow => row !== undefined);
  }, [searching, favorites, favoriteIds, projects]);
  const otherRows = React.useMemo(() => {
    if (!projects) return undefined;
    if (searching) return projects;
    return projects.filter((project) => !favoriteIds.includes(project.id));
  }, [projects, searching, favoriteIds]);

  // Flat order backing ListDetail's keyboard navigation.
  const flatRows = React.useMemo(
    () => [...favoriteRows, ...(otherRows ?? [])],
    [favoriteRows, otherRows],
  );

  const initialLoading = loading && projects === undefined;
  const isEmpty = !initialLoading && flatRows.length === 0;

  const renderRow = (project: ProjectRow, index: number) => (
    <li key={project.id}>
      <div
        className={cn(
          "group relative flex min-h-[44px] items-center gap-3 rounded-md p-3 transition-colors duration-150 hover:bg-muted/50",
          "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200",
          selectedId === project.id && "bg-muted/50",
        )}
        style={{
          // List entrance: 20ms stagger capped at 8 rows (projects.md motion 3).
          animationDelay: `${Math.min(index, 8) * 20}ms`,
          animationFillMode: "backwards",
        }}
      >
        <ProjectAvatar name={project.name} image={project.image} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/projects/${project.id}`}
            onFocus={() => setSelectedId(project.id)}
            className="text-sm font-medium after:absolute after:inset-0 after:rounded-md focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2"
          >
            <span className="block truncate">{project.name}</span>
          </Link>
          {/* Phones: metadata drops to line 2 (T1) — never hidden. */}
          {project.updatedAt && (
            <p className="mt-0.5 text-xs text-muted-foreground sm:hidden">
              {t("updatedLabel")} <RelativeTime date={project.updatedAt} />
            </p>
          )}
        </div>
        {project.updatedAt && (
          <span className="ml-auto hidden shrink-0 text-xs text-muted-foreground sm:block">
            {t("updatedLabel")} <RelativeTime date={project.updatedAt} />
          </span>
        )}
        <FavoriteToggle
          className="relative z-10"
          pressed={favoriteIds.includes(project.id)}
          label={
            favoriteIds.includes(project.id)
              ? t("favoriteRemove")
              : t("favoriteAdd")
          }
          onToggle={() => handleToggleFavorite(project.id)}
        />
      </div>
    </li>
  );

  const list = (
    <div className="flex flex-col gap-6">
      {favoriteRows.length > 0 && (
        <section aria-label={t("favorites")}>
          <h2 className="px-3 pb-1 text-xs font-medium text-muted-foreground">
            {t("favorites")}
          </h2>
          <ul className="flex flex-col gap-1">
            {favoriteRows.map((project, index) => renderRow(project, index))}
          </ul>
        </section>
      )}
      <section aria-label={t("allProjects")}>
        {favoriteRows.length > 0 && (
          <h2 className="px-3 pb-1 text-xs font-medium text-muted-foreground">
            {t("allProjects")}
          </h2>
        )}
        <ul className="flex flex-col gap-1">
          {(otherRows ?? []).map((project, index) =>
            renderRow(project, favoriteRows.length + index),
          )}
        </ul>
      </section>
      {canLoadMore && (
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          disabled={loading}
          onClick={loadMore}
        >
          {t("loadMore")}
        </Button>
      )}
    </div>
  );

  return (
    <PageShell variant="content" className="max-w-4xl">
      <MobileTopbarAction>
        <Button size="sm" onClick={openCreate}>
          <Plus aria-hidden="true" className="mr-1 size-4" />
          {t("newProject")}
        </Button>
      </MobileTopbarAction>

      <PageHeader
        title={t("title")}
        description={t("pageDescription")}
        action={
          <Button onClick={openCreate}>
            <Plus aria-hidden="true" className="mr-2 size-4" />
            {t("newProject")}
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

        {initialLoading ? (
          <ProjectListSkeleton />
        ) : error && flatRows.length === 0 ? (
          <EmptyState
            variant="error"
            title={t("loadErrorTitle")}
            description={error.message}
            action={{
              label: tCommon("retry"),
              onClick: () => void refetch(),
            }}
          />
        ) : isEmpty ? (
          searching ? (
            <EmptyState
              icon={SearchX}
              title={t("searchEmptyTitle")}
              description={t("searchEmptyDescription")}
            />
          ) : (
            <EmptyState
              icon={FolderOpen}
              title={t("emptyTitle")}
              description={t("emptyDescription")}
              action={{ label: t("newProject"), onClick: openCreate }}
            />
          )
        ) : (
          <ListDetail<ProjectRow>
            detailMode="page"
            items={flatRows}
            selected={flatRows.find((row) => row.id === selectedId) ?? null}
            onSelect={(item) => setSelectedId(item ? item.id : null)}
            detailHref={(item) => `/projects/${item.id}`}
            list={list}
          />
        )}
      </div>

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => void refetch()}
      />
    </PageShell>
  );
}
