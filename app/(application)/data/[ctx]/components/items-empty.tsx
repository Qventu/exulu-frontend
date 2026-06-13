"use client";

/**
 * Two empty states for the items table:
 * - #14 — no items at all (no filters, no search) → "Add your first item"
 * - #26a — current search/filters match nothing → "Clear filters"
 */

import { Database, FilterX } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/primitives/empty-state";

export interface ItemsEmptyProps {
  /** True when at least one filter or a search query is active. */
  hasFilters: boolean;
  onClearFilters: () => void;
  /** When undefined, the "Add your first item" CTA is suppressed (archived view). */
  onCreate?: () => void;
}

export function ItemsEmpty({
  hasFilters,
  onClearFilters,
  onCreate,
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

  return (
    <EmptyState
      icon={Database}
      title={t("workspace.items.noItemsTitle")}
      description={t("workspace.items.noItemsDescription")}
      action={
        onCreate
          ? { label: t("workspace.items.addFirst"), onClick: onCreate }
          : undefined
      }
    />
  );
}
