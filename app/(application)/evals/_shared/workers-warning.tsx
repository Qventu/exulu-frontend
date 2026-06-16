"use client";

/**
 * WorkersWarning — single source for the workers-disabled banner shown
 * across the /evals area (list, detail, runs). Returns null when workers
 * are configured. Uses `variant="warning"` (orange) — eval sets remain
 * viewable, only runs can't execute, so this is a warning, not a failure.
 *
 * The "Configuration →" link is rendered only for super_admin users, who
 * are the only ones who can act on it (route is guarded). Wired to
 * design/pages/evals.md §3 — workers-disabled affordance.
 */

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useContext } from "react";
import { useTranslations } from "next-intl";

import { UserContext } from "@/app/(application)/authenticated";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConfigContext } from "@/components/shell/config-context";
import { cn } from "@/lib/utils";

export interface WorkersWarningProps {
  className?: string;
}

export function WorkersWarning({ className }: WorkersWarningProps) {
  const config = useContext(ConfigContext);
  const { user } = useContext(UserContext);
  const t = useTranslations("evals.common.workersWarning");

  const workersConfigured = Boolean(
    config?.workers?.enabled && config?.workers?.redisHost,
  );
  if (workersConfigured) return null;

  return (
    <Alert variant="warning" className={cn(className)}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription>
        <span>{t("description")}</span>
        {user.super_admin ? (
          <>
            {" "}
            <Link
              href="/configuration"
              className="font-medium underline-offset-2 hover:underline"
            >
              {t("configureLink")}
            </Link>
          </>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
