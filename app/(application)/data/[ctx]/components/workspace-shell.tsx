"use client";

/**
 * WorkspaceShell — client shell for /data/[ctx]. Owns the PageHeader,
 * Items|Pipeline|Entities|Map tabs, the New item dialog, and the URL-driven
 * search params. Pipeline polling is gated on tab visibility (page-doc rule:
 * "poll only the visible tab"), and the map's renderer is a dynamic import
 * inside the card, so three.js never reaches another tab.
 *
 * Inventory items handled here: 1 (per-ctx route), 6 (Items|Pipeline tab
 * switch), 7 (breadcrumb), 22 (Create-item dialog entry — junk-record
 * path KILLED), 52 (workspace PageHeader with name/description shown
 * once), 58 (breadcrumb fixes /context dead link), 80 (inline NewItem
 * dialog reused).
 */

import { Plus, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContextMapCard } from "@/components/widgets/context-map/context-map-card";
import type { Context } from "@/types/models/context";

import { ContextEntityTypes } from "../../components/entity-types";
import { ImportWizardDialog } from "./import/import-wizard-dialog";
import { ItemsTab } from "./items-tab";
import { NewItemDialog } from "./new-item-dialog";
import { PipelineTab } from "./pipeline-tab";

type WorkspaceTab = "items" | "pipeline" | "entities" | "map";

export interface WorkspaceShellProps {
  context: Context;
  searchParams: {
    tab?: WorkspaceTab;
    view?: "active" | "archived";
    item?: string;
    page?: string;
    search?: string;
    new?: string;
    filters?: string;
  };
}

export function WorkspaceShell({ context, searchParams }: WorkspaceShellProps) {
  const t = useTranslations("knowledge");
  const tNav = useTranslations("navigation");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Tab — Items default. The others only render (and poll) when active.
  const tab: WorkspaceTab =
    searchParams.tab === "pipeline"
      ? "pipeline"
      : searchParams.tab === "entities"
        ? "entities"
        : searchParams.tab === "map"
          ? "map"
          : "items";

  const [newItemOpen, setNewItemOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);

  const setTab = (next: WorkspaceTab) => {
    const url = new URLSearchParams(params?.toString() ?? "");
    if (next === "items") url.delete("tab");
    else url.set("tab", next);
    // switching tabs drops item-panel + map state to avoid stale params:
    // both survive a reload, so a stale one gets reapplied to another view
    url.delete("item");
    url.delete("selected");
    url.delete("topic");
    const q = url.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  /**
   * What the map colours by. A knowledge base has no memory type, so it is the
   * FIRST declared field whose type is an enumeration — declaration order, not
   * the name — and no legend at all when the base declares none.
   *
   * Memoised on the field list: the renderer rebuilds its colour buffer
   * whenever this array's identity changes, and the card re-renders on every
   * pointer move over its neighbour list.
   */
  const fields = context.fields;
  const groupEnum = React.useMemo(
    () => fields?.find((field) => field.type === "enum") ?? null,
    [fields],
  );
  const groups = React.useMemo(
    () => [...(groupEnum?.enumValues ?? [])],
    [groupEnum],
  );
  const groupField = groupEnum?.name ?? null;
  const itemHref = React.useCallback(
    (itemId: string) => `/data/${context.id}/items/${itemId}`,
    [context.id],
  );

  const onCreated = (newItemId: string) => {
    setNewItemOpen(false);
    // New items open in edit mode on the dedicated detail page (V2 Phase F1).
    router.push(`/data/${context.id}/items/${newItemId}`);
  };

  // Imported rows sort to page 1 (updatedAt DESC). A stale ?page= param would
  // keep the refreshed table on a page that can't show them — and it survives
  // browser reloads, so it reads as "the import didn't work". Drop it.
  const onImported = () => {
    const url = new URLSearchParams(params?.toString() ?? "");
    if (!url.has("page")) return;
    url.delete("page");
    const q = url.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  return (
    <PageShell variant="full-bleed">
      <div className="flex flex-col gap-6 p-4 md:p-8">
        <PageHeader
          title={context.name}
          description={context.description ?? undefined}
          breadcrumb={{ label: tNav("knowledge"), href: "/data" }}
          truncateDescription
          action={
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload aria-hidden="true" className="mr-2 size-4" />
                {t("workspace.import.trigger")}
              </Button>
              <Button onClick={() => setNewItemOpen(true)}>
                <Plus aria-hidden="true" className="mr-2 size-4" />
                {t("workspace.newItem")}
              </Button>
            </div>
          }
        />

        <Tabs value={tab} onValueChange={(v) => setTab(v as WorkspaceTab)}>
          <TabsList>
            <TabsTrigger value="items">
              {t("workspace.tabs.items")}
            </TabsTrigger>
            <TabsTrigger value="pipeline">
              {t("workspace.tabs.pipeline")}
            </TabsTrigger>
            <TabsTrigger value="entities">
              {t("workspace.tabs.entities")}
            </TabsTrigger>
            <TabsTrigger value="map">{t("workspace.tabs.map")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 md:px-8 md:pb-8">
        {tab === "items" ? (
          <ItemsTab
            context={context}
            view={searchParams.view === "archived" ? "archived" : "active"}
            page={
              searchParams.page && !Number.isNaN(parseInt(searchParams.page, 10))
                ? parseInt(searchParams.page, 10)
                : 1
            }
            search={searchParams.search ?? ""}
            selectedItemId={searchParams.item ?? null}
            onOpenCreate={() => setNewItemOpen(true)}
            onOpenImport={() => setImportOpen(true)}
          />
        ) : tab === "pipeline" ? (
          <PipelineTab context={context} />
        ) : tab === "map" ? (
          <ContextMapCard
            contextId={context.id}
            groups={groups}
            groupField={groupField}
            itemHref={itemHref}
            titleKey="knowledge"
          />
        ) : (
          <ContextEntityTypes context={context.id} />
        )}
      </div>

      <NewItemDialog
        open={newItemOpen}
        onOpenChange={setNewItemOpen}
        context={context}
        onCreated={onCreated}
      />
      <ImportWizardDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        context={context}
        onImported={onImported}
      />
    </PageShell>
  );
}
