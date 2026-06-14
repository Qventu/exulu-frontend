"use client";

/**
 * EmptyState wrapper for /workflows (Routines) — work item 2.12.
 *
 * Replaces the permanent blue alert (`workflows/page.tsx:97-106`, inventory
 * #3). Per workflows.md §3 "EmptyState" — Workflow icon, single value
 * sentence, primary action "Open chat" linking to /chat (since routines are
 * created exclusively from chat).
 */

import { Workflow } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { EmptyState as EmptyStatePrimitive } from "@/components/primitives/empty-state";

export interface RoutinesEmptyStateProps {
  /** When true, render the "no results match your search" copy. */
  filtered?: boolean;
  /** Clear the search filter (only used when filtered=true). */
  onClearFilter?: () => void;
}

export function RoutinesEmptyState({
  filtered,
  onClearFilter,
}: RoutinesEmptyStateProps) {
  const t = useTranslations("routines");

  if (filtered) {
    return (
      <EmptyStatePrimitive
        icon={Workflow}
        title={t("emptyFilteredTitle")}
        description={t("emptyFilteredDescription")}
        action={
          onClearFilter
            ? { label: t("clearSearch"), onClick: onClearFilter }
            : undefined
        }
      />
    );
  }

  return (
    <EmptyStatePrimitive
      icon={Workflow}
      title={t("emptyTitle")}
      description={t("emptyDescription")}
      action={{ label: t("openChat"), href: "/chat" }}
    />
  );
}
