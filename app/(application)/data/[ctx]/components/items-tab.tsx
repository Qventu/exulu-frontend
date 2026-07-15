"use client";

/**
 * ItemsTab — body of the Items tab. Hosts the items table (search, Filters,
 * Active|Archived segmented control, selection, bulk actions, pagination)
 * and the BulkFilterDialog.
 *
 * Selecting a row NAVIGATES to the dedicated item detail page
 * `/data/[ctx]/items/[itemId]` (knowledge V2 Phase F1) — the wide Sheet/
 * ListDetail it used to open is retired. A legacy `?item=` deep link is
 * redirected to the new route here so old bookmarks keep working.
 *
 * Inventory items handled here: 6 (segmented control), 23 (Filters
 * entry), 24 (URL-driven search/page), 26 (list error / keep-prev data,
 * delegated to ItemsTable), 35 (Clear filters on toolbar badge).
 */

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { usePathname, useSearchParams } from "next/navigation";
import * as React from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Context } from "@/types/models/context";

import { BulkFilterDialog } from "./bulk-filter-dialog";
import { ItemsTable } from "./items-table";

export interface ItemsTabProps {
  context: Context;
  view: "active" | "archived";
  page: number;
  search: string;
  selectedItemId: string | null;
  onOpenCreate: () => void;
  onOpenImport: () => void;
}

export function ItemsTab({
  context,
  view,
  page,
  search,
  selectedItemId,
  onOpenCreate,
  onOpenImport,
}: ItemsTabProps) {
  const t = useTranslations("knowledge");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [advancedFilters, setAdvancedFilters] = React.useState<unknown[]>([]);

  // Legacy deep link: `/data/[ctx]?item=<id>` opened the old Sheet. Redirect
  // it to the dedicated detail page so bookmarks/toasts keep resolving.
  React.useEffect(() => {
    if (selectedItemId) {
      router.replace(`/data/${context.id}/items/${selectedItemId}`);
    }
  }, [selectedItemId, context.id, router]);

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

  const setPage = (next: number) => {
    setParam((url) => {
      if (next <= 1) url.delete("page");
      else url.set("page", String(next));
    });
  };

  const openItem = (id: string | null) => {
    if (id) router.push(`/data/${context.id}/items/${id}`);
  };

  return (
    <>
      <ItemsTable
        context={context}
        archived={view === "archived"}
        page={page}
        search={search}
        advancedFilters={advancedFilters}
        selectedItemId={null}
        activeFiltersCount={advancedFilters.length}
        onSelect={openItem}
        onPageChange={setPage}
        onOpenFilters={() => setFiltersOpen(true)}
        onClearFilters={() => setAdvancedFilters([])}
        onOpenCreate={onOpenCreate}
        onOpenImport={onOpenImport}
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

      <BulkFilterDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        context={context}
        mode="filter-list"
        initialFilters={advancedFilters}
        onApply={(next) => {
          setAdvancedFilters(next);
          setFiltersOpen(false);
          setPage(1);
        }}
      />
    </>
  );
}
