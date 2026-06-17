"use client";

/**
 * AccessDenied — the shared RBAC-denied state.
 *
 * Spec: design/codebase-structure.md §2.3 (AccessDenied) —
 * `{ requiredRight?: string; backHref?: string }`, an EmptyState composition.
 * Rendered by page-level RBAC guards (codebase-structure §3.2) for
 * evals, explorer, keys, feedback, configuration, variables.
 *
 * Philosophy §9 "calm, not theatrical": a quiet lock, a plain explanation of
 * what happened and who to ask — no scary iconography, no blame. The missing
 * permission is named explicitly (trust through transparency) so users can
 * make an actionable request to their administrator.
 */

import { Lock } from "lucide-react";
import * as React from "react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/primitives/empty-state";
import { cn } from "@/lib/utils";

export interface AccessDeniedProps {
  /** The permission that would unlock the page, e.g. "evals". Shown verbatim. */
  requiredRight?: string;
  /** Where "Go back" leads; omit to hide the action. */
  backHref?: string;
  className?: string;
}

const AccessDenied = React.forwardRef<HTMLDivElement, AccessDeniedProps>(
  ({ requiredRight, backHref, className }, ref) => {
    const t = useTranslations("common");

    return (
      <div
        ref={ref}
        className={cn(
          "flex min-h-[60dvh] w-full flex-col items-center justify-center gap-4 p-4",
          className,
        )}
      >
        <EmptyState
          icon={Lock}
          title={t("accessDenied.title")}
          description={t("accessDenied.description")}
          action={
            backHref
              ? { label: t("accessDenied.back"), href: backHref }
              : undefined
          }
        />
        {requiredRight ? (
          <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
            {t("accessDenied.requiredRight", { right: requiredRight })}
          </code>
        ) : null}
      </div>
    );
  },
);
AccessDenied.displayName = "AccessDenied";

export { AccessDenied };
