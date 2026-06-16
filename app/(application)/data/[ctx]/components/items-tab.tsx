"use client";

/**
 * ItemsTab — body of the Items tab. Hosts the Toolbar (search, Filters
 * button with count, Active|Archived segmented control) and the ListDetail
 * that pairs ItemsTable (list) with ItemPanel (detail).
 *
 * `detailEmphasis="primary"` — items carry substantive content (custom
 * typed fields, description, tags, calculated fields, embeddings section,
 * access section). The earlier "compact" call (knowledge.md 2026-06-13
 * QA: "panel is metadata") capped the pane at 24-28rem and was too
 * narrow to render most items. Override per user feedback 2026-06-16.
 * Below md the panel renders as a bottom Sheet via ListDetail.
 *
 * Inventory items handled here: 6 (segmented control), 23 (Filters
 * entry), 24 (URL-driven search/page), 26 (list error / keep-prev data,
 * delegated to ItemsTable), 35 (Clear filters on toolbar badge).
 */

import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { ListDetail } from "@/components/primitives/list-detail";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Context } from "@/types/models/context";

import { BulkFilterDialog } from "./bulk-filter-dialog";
import { ItemPanel } from "./item-panel";
import { ItemsTable } from "./items-table";

export interface ItemsTabProps {
  context: Context;
  view: "active" | "archived";
  page: number;
  search: string;
  selectedItemId: string | null;
  onOpenCreate: () => void;
}

export function ItemsTab({
  context,
  view,
  page,
  search,
  selectedItemId,
  onOpenCreate,
}: ItemsTabProps) {
  const t = useTranslations("knowledge");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [advancedFilters, setAdvancedFilters] = React.useState<unknown[]>([]);

  const setParam = (mutator: (url: URLSearchParams) => void) => {
    const url = new URLSearchParams(params?.toString() ?? "");
    mutator(url);
    const q = url.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  const setView = (next: "active" | "archived") => {
    setParam((url) => {
      if (next === "active") url.delete("view");
      else url.set("view", next);
      url.delete("page");
      url.delete("item");
    });
  };

  const setSelectedItem = (id: string | null) => {
    setParam((url) => {
      if (id === null) url.delete("item");
      else url.set("item", id);
    });
  };

  const setPage = (next: number) => {
    setParam((url) => {
      if (next <= 1) url.delete("page");
      else url.set("page", String(next));
    });
  };

  // The selected item value passed into ListDetail is a thin {id} object so
  // ListDetail.getItemId() reads it without needing the full item record
  // (which is fetched separately by ItemPanel).
  const selected = selectedItemId ? { id: selectedItemId } : null;

  return (
    <>
      <ListDetail
        list={
          <ItemsTable
            context={context}
            archived={view === "archived"}
            page={page}
            search={search}
            advancedFilters={advancedFilters}
            selectedItemId={selectedItemId}
            activeFiltersCount={advancedFilters.length}
            onSelect={setSelectedItem}
            onPageChange={setPage}
            onOpenFilters={() => setFiltersOpen(true)}
            onClearFilters={() => setAdvancedFilters([])}
            onOpenCreate={onOpenCreate}
            viewSwitch={
              <Tabs value={view} onValueChange={(v) => setView(v as "active" | "archived")}>
                <TabsList>
                  <TabsTrigger value="active">
                    {t("workspace.items.viewActive")}
                  </TabsTrigger>
                  <TabsTrigger value="archived">
                    {t("workspace.items.viewArchived")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            }
          />
        }
        detail={() =>
          selectedItemId ? (
            <ItemPanel
              context={context}
              itemId={selectedItemId}
              onClose={() => setSelectedItem(null)}
            />
          ) : null
        }
        detailMode="panel"
        detailPresentation="docked"
        detailEmphasis="primary"
        selected={selected}
        onSelect={(item) => setSelectedItem(item?.id ?? null)}
        items={selected ? [selected] : []}
        getItemId={(i) => i.id}
        paramName="item"
        syncUrl={false}
        detailTitle={() => t("workspace.itemPanel.title")}
      />

      <BulkFilterDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        context={context}
        mode="filter-list"
        initialFilters={advancedFilters}
        onApply={(next) => {
          setAdvancedFilters(next);
          setFiltersOpen(false);
          // jump to page 1 on filter change
          setPage(1);
        }}
      />

    </>
  );
}
