"use client";

/**
 * LibraryEmpty — empty state for /data when no contexts exist
 * (work item 2.11, owner "library"; knowledge.md §3 ladder row 13).
 *
 * Replaces today's misleading two-step empty card that instructs the
 * user to "click the '+' button" though contexts are CODE-DEFINED and
 * no `+` exists. Honest copy: "Contexts are defined in code — see
 * docs", with a single primary action linking to the docs.
 *
 * Composed from the shared EmptyState primitive (philosophy §5 / one
 * empty state per page). No phantom CTA.
 */

import { Database } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { EmptyState } from "@/components/primitives/empty-state";

export interface LibraryEmptyProps {
  /** Docs URL — defaults to /explorer (the in-app developer console). */
  docsHref?: string;
}

export function LibraryEmpty({ docsHref = "/explorer" }: LibraryEmptyProps) {
  const t = useTranslations("knowledge");

  return (
    <EmptyState
      icon={Database}
      title={t("library.empty.title")}
      description={t("library.empty.description")}
      action={{
        label: t("library.empty.viewDocs"),
        href: docsHref,
      }}
    />
  );
}
