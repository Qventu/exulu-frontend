"use client";

/**
 * Access section — RBACControl wired to editor.rbac/setRbac.
 *
 * Mirrors /agents/edit/[id]/sections/access.tsx exactly:
 * - RBACControl rendered OPEN with a plain-language summary above it.
 * - ROUTINES_RBAC_TEAMS_SUPPORTED gates the teams mode (restricts allowedModes
 *   and drops teams entries from the staged state) so the save payload stays
 *   honest when the backend doesn't support teams yet.
 * - Read-only (!access.canWrite): we render the summary only; the control
 *   itself is suppressed because RBACControl has no read-only mode today.
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { RBACControl } from "@/components/rbac";

import { ROUTINES_RBAC_TEAMS_SUPPORTED } from "../../schema-flags";
import type { RoutineSectionProps } from "./types";

const ALLOWED_MODES_NO_TEAMS = ["private", "users", "roles", "public"] as const;

export function AccessSection({ editor, workbench }: RoutineSectionProps) {
  const t = useTranslations("routines");
  const canWrite = workbench.access.canWrite;

  const summary = React.useMemo(() => {
    const mode = editor.rbac.rights_mode;
    if (!mode || mode === "private") return t("editor.access.summaryPrivate");
    if (mode === "public") return t("editor.access.summaryPublic");
    if (mode === "users") {
      return t("editor.access.summaryUsers", {
        count: editor.rbac.users?.length ?? 0,
      });
    }
    if (mode === "roles") {
      return t("editor.access.summaryRoles", {
        count: editor.rbac.roles?.length ?? 0,
      });
    }
    if (mode === "teams") {
      if (!ROUTINES_RBAC_TEAMS_SUPPORTED) {
        return t("editor.access.summaryTeamsDegraded");
      }
      return t("editor.access.summaryTeams", {
        count: editor.rbac.teams?.length ?? 0,
      });
    }
    return "";
  }, [editor.rbac, t]);

  return (
    <section id="access" className="scroll-mt-20 space-y-4" tabIndex={-1}>
      <div className="space-y-1">
        <h2 className="text-lg font-medium">{t("editor.sections.access")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("editor.access.description")}
        </p>
        <p className="text-sm font-medium text-foreground">{summary}</p>
      </div>

      {canWrite ? (
        <div className="space-y-4 rounded-lg border p-4">
          <RBACControl
            subjectLabel={t("editor.access.subjectLabel")}
            allowedModes={
              ROUTINES_RBAC_TEAMS_SUPPORTED
                ? undefined
                : (ALLOWED_MODES_NO_TEAMS as never)
            }
            initialRightsMode={editor.rbac.rights_mode as never}
            initialUsers={editor.rbac.users as never}
            initialRoles={editor.rbac.roles as never}
            initialTeams={editor.rbac.teams as never}
            onChange={(rights_mode, users, roles, teams) => {
              editor.setRbac({
                rights_mode: rights_mode as never,
                users,
                roles,
                teams: ROUTINES_RBAC_TEAMS_SUPPORTED ? teams : [],
              });
            }}
          />
        </div>
      ) : null}
    </section>
  );
}
