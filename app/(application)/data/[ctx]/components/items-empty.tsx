"use client";

/**
 * Two empty states for the items table:
 * - #14 — no items at all (no filters, no search) → "Add your first item"
 * - #26a — current search/filters match nothing → "Clear filters"
 */

import { isDemoMode } from "@/lib/demo/flag";
import { EMPTY_STATES } from "@/lib/demo/overlays";
import { Database, FilterX, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/primitives/empty-state";
import { Button } from "@/components/ui/button";

export interface ItemsEmptyProps {
  /** True when at least one filter or a search query is active. */
  hasFilters: boolean;
  onClearFilters: () => void;
  /** When undefined, the "Add your first item" CTA is suppressed (archived view). */
  onCreate?: () => void;
  /** When undefined, the secondary Import CTA is suppressed (archived view). */
  onImport?: () => void;
}

export function ItemsEmpty({
  hasFilters,
  onClearFilters,
  onCreate,
  onImport,
}: ItemsEmptyProps) {
  const t = useTranslations("knowledge");

  if (hasFilters) {
    return (
      <EmptyState
        icon={FilterX}
        title={t("workspace.items.noMatchesTitle")}
        description={t("workspace.items.noMatchesDescription")}
        action={{ label: t("workspace.items.clearFilters"), onClick: onClearFilters }}
      />
    );
  }

  // aufnahme.0 opens on this screen under "Niemand lädt das von Hand hoch".
  // The product invites the visitor to add or import a document; in the
  // tour both buttons are inert and the next step fills the list, so the
  // demo says what is about to happen and offers nothing to click.
  const demo = isDemoMode();
  const copy = demo
    ? EMPTY_STATES.knowledgeItems
    : { title: t("workspace.items.noItemsTitle"), description: t("workspace.items.noItemsDescription") };
  return (
    <div className="flex flex-col items-center">
      <EmptyState
        icon={Database}
        title={copy.title}
        description={copy.description}
        action={
          !demo && onCreate
            ? { label: t("workspace.items.addFirst"), onClick: onCreate }
            : undefined
        }
      />
      {!demo && onImport && (
        <Button type="button" variant="outline" onClick={onImport} className="-mt-6 mb-6">
          <Upload aria-hidden="true" className="mr-2 size-4" />
          {t("workspace.import.trigger")}
        </Button>
      )}
    </div>
  );
}
