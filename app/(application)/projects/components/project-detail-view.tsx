"use client";

/**
 * Project detail — "a project is a place you work, not a record you
 * administer" (projects.md §3). L1 = the Sessions tab plus ONE purple
 * "New session"; Files and Settings (details · access · danger zone) sit in
 * URL-backed tabs (?tab=, fixes UX 6 fully: sections are linkable,
 * refresh-safe AND back-button-steppable — tab switches push history
 * entries; only sub-state like the ?edit=1 toggle replaces). The double
 * sidebar and the `mt-20` magic offset are gone (UX 2/6); PageShell/
 * PageHeader own the layout.
 *
 * Header (ladder rows 4, 16, 35): breadcrumb "Projects /", avatar + name,
 * truncated description, visibility badge (L1 trust scope — links to
 * Settings → Access), ghost star, ⋯ menu (Edit details / Delete project…),
 * purple "New session". `meta` carries the quiet "Instructions active ·
 * View" line (philosophy §8) when custom instructions are set.
 *
 * Project deletion (ladder rows 40-41): the shared ConfirmDialog with
 * cascade checkboxes — counts use the LIVE item list and the sessions
 * pageInfo.itemCount (not just loaded rows); the cascade iterates all
 * session pages (hooks.useDeleteProjectCascade).
 */

import { useMutation } from "@apollo/client";
import { FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { EmptyState } from "@/components/primitives/empty-state";
import { FavoriteToggle } from "@/components/primitives/favorite-toggle";
import { OverflowMenu } from "@/components/primitives/overflow-menu";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { MobileTopbarAction } from "@/components/shell/mobile-topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  MAX_PROJECT_ITEMS,
  useDeleteProjectCascade,
  useFavoriteProjects,
  useProject,
  useProjectAgents,
  useProjectSessions,
} from "../hooks";
import { UPDATE_PROJECT } from "../queries";
import { type AddItemsOptions, FilesTab } from "./files-tab";
import { NewSessionDialog } from "./new-session-dialog";
import { ProjectAvatar } from "./project-avatar";
import { SessionsTab } from "./sessions-tab";
import { SettingsTab } from "./settings-tab";
import { ProjectDetailSkeleton } from "./skeletons";
import { VisibilityBadge } from "./visibility-badge";

type TabValue = "sessions" | "files" | "settings";

const TAB_CONTENT_MOTION =
  "mt-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-150";

export function ProjectDetailView({ projectId }: { projectId: string }) {
  const t = useTranslations("projects");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { project, loading, error, refetch } = useProject(projectId);
  const sessionsApi = useProjectSessions(projectId);
  const { agents, agentName, loading: agentsLoading } = useProjectAgents();
  const { favoriteIds, toggleFavorite } = useFavoriteProjects();
  const deleteProjectCascade = useDeleteProjectCascade();

  /* ------------------------- URL-backed tab state ------------------------- */

  const tabParam = searchParams.get("tab");
  const tab: TabValue =
    tabParam === "files" || tabParam === "settings" ? tabParam : "sessions";
  const editParam = searchParams.get("edit") === "1";

  const setTab = React.useCallback(
    (next: string, options?: { edit?: boolean; replace?: boolean }) => {
      const nextTab: TabValue =
        next === "files" || next === "settings" ? next : "sessions";
      const nextEdit = options?.edit === true;
      // Identical target = no-op (no duplicate history entries).
      if (nextTab === tab && nextEdit === editParam) return;
      const params = new URLSearchParams();
      if (nextTab !== "sessions") params.set("tab", nextTab);
      if (nextEdit) params.set("edit", "1");
      const query = params.toString();
      const url = query ? `${pathname}?${query}` : pathname;
      // Section changes PUSH so the browser back button steps back through
      // tabs instead of exiting the project (the second half of UX 6);
      // sub-state changes (the ?edit=1 toggle) replace.
      if (options?.replace) {
        router.replace(url, { scroll: false });
      } else {
        router.push(url, { scroll: false });
      }
    },
    [pathname, router, tab, editParam],
  );

  /* --------------------- project_items state + cap rules ------------------ */

  const [projectItems, setProjectItems] = React.useState<string[]>([]);
  React.useEffect(() => {
    setProjectItems(project?.project_items ?? []);
  }, [project]);

  const [updateItems] = useMutation(UPDATE_PROJECT);

  const persistItems = React.useCallback(
    async (next: string[], previous: string[]) => {
      setProjectItems(next);
      try {
        await updateItems({
          variables: { id: projectId, input: { project_items: next } },
        });
      } catch (mutationError) {
        setProjectItems(previous);
        throw mutationError;
      }
    },
    [projectId, updateItems],
  );

  // Atomic against the 15-cap on EVERY add path (ladder row 23).
  const handleAddItems = React.useCallback(
    async (gids: string[], options?: AddItemsOptions) => {
      const current = projectItems;
      const next = Array.from(new Set([...current, ...gids]));
      const added = next.length - current.length;
      if (next.length > MAX_PROJECT_ITEMS) {
        const remaining = Math.max(0, MAX_PROJECT_ITEMS - current.length);
        const message = t("files.limitToast", { remaining });
        if (options?.throwOnLimit) throw new Error(message);
        toast.error(message);
        return;
      }
      if (added === 0) {
        if (!options?.silent) toast.message(t("files.addedToast", { count: 0 }));
        return;
      }
      try {
        await persistItems(next, current);
        if (!options?.silent) {
          toast.success(t("files.addedToast", { count: added }));
        }
      } catch (mutationError) {
        console.error("Error adding project items:", mutationError);
        if (options?.throwOnLimit) throw mutationError;
        toast.error(t("files.addError"));
      }
    },
    [persistItems, projectItems, t],
  );

  const handleRemoveItem = React.useCallback(
    (gid: string) => {
      const current = projectItems;
      const next = current.filter((entry) => entry !== gid);
      void persistItems(next, current).catch((mutationError) => {
        console.error("Error removing project item:", mutationError);
        toast.error(t("files.removeError"));
      });
    },
    [persistItems, projectItems, t],
  );

  /* ------------------------------ overlays -------------------------------- */

  const [newSessionOpen, setNewSessionOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  /* ---------------------- load / error / not-found ------------------------ */

  if (loading && !project) {
    return (
      <PageShell variant="content" className="max-w-4xl">
        <ProjectDetailSkeleton />
      </PageShell>
    );
  }

  if (error && !project) {
    return (
      <PageShell variant="content" className="max-w-4xl">
        <EmptyState
          variant="error"
          title={t("detail.errorTitle")}
          description={error.message}
          action={{ label: t("detail.backToProjects"), href: "/projects" }}
        />
      </PageShell>
    );
  }

  if (!project) {
    return (
      <PageShell variant="content" className="max-w-4xl">
        <EmptyState
          icon={FolderOpen}
          title={t("detail.notFoundTitle")}
          description={t("detail.notFoundDescription")}
          action={{ label: t("detail.backToProjects"), href: "/projects" }}
        />
      </PageShell>
    );
  }

  const isFavorite = favoriteIds.includes(project.id);

  return (
    <PageShell variant="content" className="max-w-4xl">
      <MobileTopbarAction>
        <Button size="sm" onClick={() => setNewSessionOpen(true)}>
          <Plus aria-hidden="true" className="mr-1 size-4" />
          {t("detail.newSession")}
        </Button>
      </MobileTopbarAction>

      <PageHeader
        breadcrumb={{ label: t("title"), href: "/projects" }}
        leading={
          <ProjectAvatar
            name={project.name}
            image={project.image}
            className="size-10"
          />
        }
        title={project.name}
        description={project.description || undefined}
        // One-line purpose; the full text lives in the Settings tab
        // (projects.md §3 detail header spec).
        truncateDescription
        meta={
          project.custom_instructions ? (
            // Quiet trust line (philosophy §8): chats here inherit
            // instructions — one click shows them.
            <button
              type="button"
              onClick={() => setTab("settings")}
              // min-h-11 = 44px touch target below md (responsive.md DoD).
              className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:min-h-0"
            >
              <span>{t("detail.instructionsActive")}</span>
              <span aria-hidden="true">·</span>
              <span className="underline underline-offset-2">
                {t("detail.viewInstructions")}
              </span>
            </button>
          ) : undefined
        }
        action={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <VisibilityBadge
              project={project}
              onOpenAccess={() => setTab("settings")}
            />
            <FavoriteToggle
              pressed={isFavorite}
              label={isFavorite ? t("favoriteRemove") : t("favoriteAdd")}
              onToggle={() => {
                void toggleFavorite(project.id).catch(() => {
                  toast.error(t("favoriteError"));
                });
              }}
            />
            <OverflowMenu
              label={t("detail.actions")}
              // ≥44px touch target below md (responsive.md DoD).
              className="size-11 md:size-8"
              items={[
                {
                  label: t("detail.editDetails"),
                  icon: Pencil,
                  onSelect: () => setTab("settings", { edit: true }),
                },
                {
                  label: t("detail.deleteProject"),
                  icon: Trash2,
                  destructive: true,
                  onSelect: () => setDeleteOpen(true),
                },
              ]}
            />
            <Button
              onClick={() => setNewSessionOpen(true)}
              className="flex-1 sm:flex-initial"
            >
              <Plus aria-hidden="true" className="mr-2 size-4" />
              {t("detail.newSession")}
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value)}>
        {/* ≤3 tabs → full-width segmented control on phones (S1). */}
        <TabsList className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto">
          <TabsTrigger value="sessions">{t("tabs.sessions")}</TabsTrigger>
          <TabsTrigger value="files" className="gap-1.5">
            {t("tabs.files")}
            {projectItems.length > 0 && (
              <Badge variant="secondary" className="px-1.5 text-xs">
                {projectItems.length}/{MAX_PROJECT_ITEMS}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings">{t("tabs.settings")}</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className={TAB_CONTENT_MOTION}>
          <SessionsTab
            projectId={project.id}
            sessions={sessionsApi.sessions}
            loading={sessionsApi.loading}
            canLoadMore={sessionsApi.canLoadMore}
            loadMore={sessionsApi.loadMore}
            refetch={sessionsApi.refetch}
            agentName={agentName}
            onNewSession={() => setNewSessionOpen(true)}
          />
        </TabsContent>

        <TabsContent value="files" className={TAB_CONTENT_MOTION}>
          <FilesTab
            projectItems={projectItems}
            onAddItems={handleAddItems}
            onRemoveItem={handleRemoveItem}
          />
        </TabsContent>

        <TabsContent value="settings" className={TAB_CONTENT_MOTION}>
          <SettingsTab
            project={project}
            // Edit mode is URL-backed (?edit=1): the header ⋯ "Edit details"
            // deep-link always applies, and Cancel/Save clear the param so a
            // refresh never silently re-opens edit mode.
            editing={editParam}
            onEditingChange={(next) =>
              setTab("settings", { edit: next, replace: true })
            }
            onUpdated={refetch}
            onRequestDelete={() => setDeleteOpen(true)}
          />
        </TabsContent>
      </Tabs>

      <NewSessionDialog
        open={newSessionOpen}
        onOpenChange={setNewSessionOpen}
        projectId={project.id}
        agents={agents}
        agentsLoading={agentsLoading}
      />

      {/* Cascade delete via the shared ConfirmDialog (ladder rows 40-41). */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("danger.dialogTitle")}
        description={t("danger.dialogDescription", { name: project.name })}
        confirmLabel={t("danger.deleteProject")}
        options={[
          {
            id: "items",
            label: t("danger.optionItems"),
            count: projectItems.length,
          },
          {
            id: "sessions",
            label: t("danger.optionSessions"),
            count: sessionsApi.totalCount,
          },
        ]}
        // Contextual amber warning reacting to the chosen blast radius
        // (ladder row 40; legacy project-details.tsx:631).
        warning={(selectedIds) => {
          const cascadeItems = selectedIds.includes("items");
          const cascadeSessions = selectedIds.includes("sessions");
          if (cascadeItems && cascadeSessions) {
            return t("danger.warningBoth", {
              items: projectItems.length,
              sessions: sessionsApi.totalCount,
            });
          }
          if (cascadeItems) {
            return t("danger.warningItems", { count: projectItems.length });
          }
          if (cascadeSessions) {
            return t("danger.warningSessions", {
              count: sessionsApi.totalCount,
            });
          }
          return null;
        }}
        onConfirm={async (optionIds) => {
          try {
            await deleteProjectCascade({
              project,
              projectItems,
              deleteItems: optionIds?.includes("items") ?? false,
              deleteSessions: optionIds?.includes("sessions") ?? false,
            });
            toast.success(t("danger.deleted", { name: project.name }));
            router.push("/projects");
          } catch (cascadeError) {
            console.error("Error deleting project:", cascadeError);
            toast.error(
              cascadeError instanceof Error && cascadeError.message
                ? cascadeError.message
                : t("danger.deleteError"),
            );
            throw cascadeError;
          }
        }}
      />
    </PageShell>
  );
}
