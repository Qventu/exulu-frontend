"use client";

/**
 * ContextLibrary — /data L1 surface (work item 2.11, owner "library";
 * knowledge.md §3 "Default view (L1)"; primary persona P2, secondary P3
 * for the SA Usage panel).
 *
 * Replaces ContextsDashboard (split: SA-only Usage moved to UsagePanel;
 * the legacy non-admin "Recent Items" N+1 view is folded into per-row
 * meta — when the backend ships KNOWLEDGE_CONTEXT_AGGREGATES_SUPPORTED;
 * until then rows carry no per-row meta column, per page-doc 4).
 *
 * Composition (knowledge.md §3 "Layout & components → /data"):
 *   PageShell(content) →
 *     PageHeader(title="Knowledge", quiet "Contexts are defined in your
 *               backend" hint, no primary action) →
 *     UsagePanel (super_admin only) →
 *     Toolbar(search) →
 *     Bordered row list / LibraryEmpty
 *
 * Inventory items resolved here:
 *   1 (route resolution — landing), 3 (error state — handled by
 *   route-level Suspense + error.tsx the integrator owns; we surface
 *   an inline Alert), 4 (full context list — 20-cap removed via
 *   route-local hooks.ts), 5 (loading skeleton — route-level
 *   loading.tsx), 7 (breadcrumb header — PageHeader at L1), 8 (SA
 *   usage header — UsagePanel), 9/10 (charts in UsagePanel), 11/12
 *   (recent-item metadata folded into row meta), 13 (honest empty
 *   state via LibraryEmpty), 15 (loading skeletons), 83 (RBAC gate via
 *   guardRoute("knowledge") in page.tsx), 84 (SA-only Usage gate).
 *
 * All i18n lives here (next-intl client-side hook); the server page
 * does not call getTranslations (i18n trap, rule 6 of the work item).
 */

import { isDemoMode } from "@/lib/demo/flag";
import { KNOWLEDGE_LIBRARY } from "@/lib/demo/overlays";
import { CircleAlert, FolderCog, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { Toolbar } from "@/components/primitives/toolbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  groupContexts,
  readCollapsed,
  writeCollapsed,
} from "@/lib/knowledge/folders";

import { UserContext } from "@/app/(application)/authenticated";

import {
  useContextFolders,
  useContextIcons,
  useContextLibrary,
} from "../hooks";
import { ContextItemFavourites } from "./context-item-favourites";
import { FolderSection } from "./folder-section";
import { LibraryEmpty } from "./library-empty";
import { LibraryRow } from "./library-row";
import { ManageFoldersDialog } from "./manage-folders-dialog";

/**
 * Collapse key for the Ungrouped section — it has no folder id, and a real
 * folder id (a uuid) can never collide with it.
 */
const UNGROUPED_COLLAPSE_KEY = "ungrouped";

export function ContextLibrary() {
  const t = useTranslations("knowledge");
  const tCommon = useTranslations("common");

  const [search, setSearch] = React.useState("");
  const { rows, loading, error } = useContextLibrary({ search });

  // contextId → name for the favourites/recents card badges. With no search
  // `rows` is the full context list, which is the only time the pins render.
  const contextNames = React.useMemo(
    () => Object.fromEntries(rows.map((row) => [row.id, row.name])),
    [rows],
  );

  // Shared, admin-managed glyphs (platform_configurations). All users see the
  // icons; only super admins get the picker affordance.
  const { icons, setIcon } = useContextIcons();
  const userCtx = React.useContext(UserContext);
  // Icons and folders are both platform-wide, admin-managed organisation:
  // everyone sees them, super admins change them.
  const isSuperAdmin = userCtx?.user?.super_admin === true;

  const handleSetIcon = React.useCallback(
    async (contextId: string, name: string | null) => {
      try {
        await setIcon(contextId, name);
      } catch {
        toast.error(t("library.iconPicker.saveError"));
      }
    },
    [setIcon, t],
  );

  // Admin-managed folders (see lib/knowledge/folders.ts for the grouping).
  const { folders, createFolder, updateFolder, deleteFolder, moveContext } =
    useContextFolders();
  const [manageOpen, setManageOpen] = React.useState(false);

  const [collapsed, setCollapsed] = React.useState<Set<string>>(
    () => new Set(),
  );

  // Read the stored collapse state after mount (SSR-safe: the server renders
  // every section expanded and the preference applies on hydration — the
  // pattern the chat history rail uses).
  React.useEffect(() => {
    const stored = readCollapsed(window.localStorage);
    if (stored.size > 0) setCollapsed(stored);
  }, []);

  const toggleSection = React.useCallback((folderId: string | null) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      const key = folderId ?? UNGROUPED_COLLAPSE_KEY;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      // Persisting here (rather than in an effect) keeps the write to the one
      // place the state actually changes.
      writeCollapsed(window.localStorage, next);
      return next;
    });
  }, []);

  const handleMoveToFolder = React.useCallback(
    async (contextId: string, folderId: string | null) => {
      try {
        await moveContext(contextId, folderId);
      } catch {
        toast.error(t("library.folders.moveError"));
      }
    },
    [moveContext, t],
  );

  // Folders are a browsing aid: the list groups only when it IS the browsing
  // list — a search term keeps it flat, and so does an installation without
  // folders (a single "Ungrouped" header over every context is pure noise).
  const grouped = search === "" && folders.length > 0;

  // Each section carries where its first row sits in the whole list, so the
  // demo's row entrance keeps staggering across section boundaries.
  const sections = React.useMemo(() => {
    if (!grouped) return [];
    let startIndex = 0;
    return groupContexts(rows, folders, t("library.folders.ungrouped")).map(
      (section) => {
        const entry = { section, startIndex };
        startIndex += section.rows.length;
        return entry;
      },
    );
  }, [grouped, rows, folders, t]);

  return (
    <PageShell variant="content">
      <PageHeader
        title={t("library.title")}
        // The product addresses the developer who defines contexts in code
        // (du-form, "Backend"); the tour addresses a buyer.
        description={isDemoMode() ? KNOWLEDGE_LIBRARY.description : t("library.description")}
        meta={
          <span className="inline-flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <span>{isDemoMode() ? KNOWLEDGE_LIBRARY.hint : t("library.backendHint")}</span>
          </span>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <Toolbar
            className="md:flex-1"
            search={{
              value: search,
              onChange: setSearch,
              placeholder: t("library.searchPlaceholder"),
              debounceMs: 0, // local filter — instant
            }}
          />
          {isSuperAdmin && (
            <Button
              type="button"
              variant="outline"
              className="self-start md:self-auto"
              onClick={() => setManageOpen(true)}
            >
              <FolderCog aria-hidden="true" className="mr-2 size-4" />
              {t("library.folders.manage")}
            </Button>
          )}
        </div>

        {/* Favourites + Recently Viewed — hidden while filtering contexts. */}
        {search === "" && <ContextItemFavourites contextNames={contextNames} />}

        {error && (
          <Alert variant="destructive" role="alert">
            <CircleAlert className="size-4" aria-hidden="true" />
            <AlertTitle>{tCommon("error")}</AlertTitle>
            <AlertDescription>
              {error.message || tCommon("somethingWentWrong")}
            </AlertDescription>
          </Alert>
        )}

        {!error && loading && rows.length === 0 && (
          <div className="rounded-md border">
            <ul className="divide-y divide-border" aria-busy="true">
              {Array.from({ length: 6 }).map((_, index) => (
                <li
                  key={index}
                  className="flex items-center gap-3 px-3 py-4 md:gap-4 md:px-4"
                >
                  <Skeleton className="size-9 shrink-0 rounded-md" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-48 max-w-full" />
                    <Skeleton className="hidden h-3 w-64 max-w-full md:block" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!error && !loading && rows.length === 0 && search === "" && (
          <LibraryEmpty />
        )}

        {!error && !loading && rows.length === 0 && search !== "" && (
          <div className="rounded-md border px-6 py-12 text-center">
            <Search
              className="mx-auto size-8 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm font-medium text-foreground">
              {t("library.noMatches.title")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("library.noMatches.description")}
            </p>
          </div>
        )}

        {rows.length > 0 && (
          <div className="rounded-md border" data-demo-id="knowledge-contexts">
            {grouped ? (
              <div className="divide-y divide-border">
                {sections.map(({ section, startIndex }) => {
                  const key = section.id ?? UNGROUPED_COLLAPSE_KEY;
                  return (
                    <FolderSection
                      key={key}
                      section={section}
                      collapsed={collapsed.has(key)}
                      onToggle={toggleSection}
                      startIndex={startIndex}
                      icons={icons}
                      canEdit={isSuperAdmin}
                      onSetIcon={handleSetIcon}
                      folders={isSuperAdmin ? folders : undefined}
                      onMoveToFolder={
                        isSuperAdmin ? handleMoveToFolder : undefined
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((row, index) => (
                  <LibraryRow
                    key={row.id}
                    index={index}
                    row={row}
                    icon={icons[row.id]}
                    canEdit={isSuperAdmin}
                    onSetIcon={handleSetIcon}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {isSuperAdmin && (
        <ManageFoldersDialog
          open={manageOpen}
          onOpenChange={setManageOpen}
          folders={folders}
          onCreate={createFolder}
          onUpdate={updateFolder}
          onDelete={deleteFolder}
        />
      )}
    </PageShell>
  );
}

// Provide a default export too — keeps parity with the other Phase-2
// client wrappers (agents-view, prompts-view) so the Suspense compose
// in page.tsx works with either named or default import shape.
export default ContextLibrary;
