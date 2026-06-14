"use client";

/**
 * OverviewSection — DetailSection 'Overview' for /workflows/[id].
 *
 * Workbench ladder: description, variables list, sharing detail summary,
 * created/updated relative times. Honest summary copy — no lies about what
 * RBAC actually applies. Body identical to the panel's overview-section (the
 * source the list owner deletes); only the wrapper differs (anchored
 * <section> for useScrollSpy + SectionNav scroll-into-view + focus).
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { DetailSection } from "@/components/primitives/detail-section";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Badge } from "@/components/ui/badge";

import { ROUTINES_RBAC_TEAMS_SUPPORTED } from "../../schema-flags";
import type { Routine } from "../../types";

type SharingT = (k: string, vars?: Record<string, unknown>) => string;

function sharingSummary(routine: Routine, t: SharingT): string {
  switch (routine.rights_mode) {
    case "private":
      return t("overview.sharing.private");
    case "public":
      return t("overview.sharing.public");
    case "users":
      return t("overview.sharing.users", { count: routine.RBAC.users?.length ?? 0 });
    case "roles":
      return t("overview.sharing.roles", { count: routine.RBAC.roles?.length ?? 0 });
    case "teams":
      if (!ROUTINES_RBAC_TEAMS_SUPPORTED) {
        return t("overview.sharing.teamsDegraded");
      }
      return t("overview.sharing.teams", { count: routine.RBAC.teams?.length ?? 0 });
    default:
      return t("overview.sharing.private");
  }
}

export interface OverviewSectionProps {
  routine: Routine;
}

export function OverviewSection({ routine }: OverviewSectionProps) {
  const t = useTranslations("routines");
  const variables = routine.variables ?? [];

  return (
    <section id="overview" className="scroll-mt-20" tabIndex={-1}>
      <DetailSection title={t("overview.title")} defaultOpen={true}>
        <div className="space-y-4">
          {routine.description ? (
            <p className="text-sm text-foreground">{routine.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("overview.noDescription")}
            </p>
          )}

          <div className="space-y-1.5">
            <h4 className="text-xs font-medium text-muted-foreground">
              {t("overview.variables")}
            </h4>
            {variables.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {variables.map((variable) => (
                  <Badge
                    key={variable}
                    variant="secondary"
                    className="font-mono text-xs"
                  >
                    {variable}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("overview.noVariables")}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <h4 className="text-xs font-medium text-muted-foreground">
              {t("overview.sharing.heading")}
            </h4>
            <p className="text-sm">
              {sharingSummary(routine, t as unknown as SharingT)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              {t("overview.created")} <RelativeTime date={routine.createdAt} />
            </span>
            <span>
              {t("overview.updated")} <RelativeTime date={routine.updatedAt} />
            </span>
          </div>
        </div>
      </DetailSection>
    </section>
  );
}
