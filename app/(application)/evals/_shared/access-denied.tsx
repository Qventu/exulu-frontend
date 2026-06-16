"use client";

/**
 * AccessDenied wrapper for the /evals area — keyed to the shared
 * `evals.common.accessDenied.*` copy so the RBAC-denied UI is consistent
 * across /evals, /evals/cases, /evals/[id]. Builds on the primitive
 * AccessDenied (components/primitives/access-denied.tsx) which itself
 * uses the EmptyState surface.
 */

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/primitives/empty-state";
import { cn } from "@/lib/utils";

export interface EvalsAccessDeniedProps {
  className?: string;
}

export function EvalsAccessDenied({ className }: EvalsAccessDeniedProps) {
  const t = useTranslations("evals.common.accessDenied");
  return (
    <div
      className={cn(
        "flex min-h-[60dvh] w-full flex-col items-center justify-center gap-4 p-4",
        className,
      )}
    >
      <EmptyState
        icon={Lock}
        title={t("title")}
        description={t("description")}
      />
    </div>
  );
}
