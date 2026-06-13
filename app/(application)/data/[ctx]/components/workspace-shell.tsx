"use client";

/**
 * WorkspaceShell — client shell for /data/[ctx]. Owns the PageHeader,
 * Items|Pipeline tabs, the New item dialog, and the URL-driven search
 * params. Pipeline polling is gated on tab visibility (page-doc rule:
 * "poll only the visible tab").
 *
 * Inventory items handled here: 1 (per-ctx route), 6 (Items|Pipeline tab
 * switch), 7 (breadcrumb), 22 (Create-item dialog entry — junk-record
 * path KILLED), 52 (workspace PageHeader with name/description shown
 * once), 58 (breadcrumb fixes /context dead link), 80 (inline NewItem
 * dialog reused).
 */

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Context } from "@/types/models/context";

import { ItemsTab } from "./items-tab";
import { NewItemDialog } from "./new-item-dialog";
import { PipelineTab } from "./pipeline-tab";

export interface WorkspaceShellProps {
  context: Context;
  searchParams: {
    tab?: "items" | "pipeline";
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

  // Tab — Items default. Pipeline only renders (and polls) when active.
  const tab: "items" | "pipeline" =
    searchParams.tab === "pipeline" ? "pipeline" : "items";

  const [newItemOpen, setNewItemOpen] = React.useState(false);

  const setTab = (next: "items" | "pipeline") => {
    const url = new URLSearchParams(params?.toString() ?? "");
    if (next === "items") url.delete("tab");
    else url.set("tab", next);
    // switching tabs drops item-panel + page state to avoid stale params
    url.delete("item");
    const q = url.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  const onCreated = (newItemId: string) => {
    setNewItemOpen(false);
    const url = new URLSearchParams(params?.toString() ?? "");
    url.delete("tab");
    url.set("item", newItemId);
    router.push(`${pathname}?${url.toString()}`, { scroll: false });
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
            <Button onClick={() => setNewItemOpen(true)}>
              <Plus aria-hidden="true" className="mr-2 size-4" />
              {t("workspace.newItem")}
            </Button>
          }
        />

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "items" | "pipeline")}
        >
          <TabsList>
            <TabsTrigger value="items">
              {t("workspace.tabs.items")}
            </TabsTrigger>
            <TabsTrigger value="pipeline">
              {t("workspace.tabs.pipeline")}
            </TabsTrigger>
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
          />
        ) : (
          <PipelineTab context={context} />
        )}
      </div>

      <NewItemDialog
        open={newItemOpen}
        onOpenChange={setNewItemOpen}
        context={context}
        onCreated={onCreated}
      />
    </PageShell>
  );
}
