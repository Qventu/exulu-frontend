"use client";

/**
 * Access section — item 45 (RBACControl) rendered OPEN with a plain-language
 * summary. Repairs review #21: passes initialTeams + captures the 4-arg
 * onChange including teams into editor.rbac (so the save payload carries
 * teams and the round-trip works once AGENT_RBAC_TEAMS_SUPPORTED is true).
 * Item 45a "+N more users" dialog preserved inside RBACControl.
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { RBACControl } from "@/components/rbac";

import { AGENT_RBAC_TEAMS_SUPPORTED } from "../queries";
import type { EditorSectionProps } from "./types";

const ALLOWED_MODES_NO_TEAMS = [
  "private",
  "users",
  "roles",
  "public",
] as const;

export function AccessSection({ editor }: EditorSectionProps) {
  const t = useTranslations("agents");

  // Summary line — plain language above the control.
  const summary = React.useMemo(() => {
    const mode = editor.rbac.rights_mode;
    if (!mode || mode === "private") {
      return t("editor.access.summaryPrivate");
    }
    if (mode === "public") {
      return t("editor.access.summaryPublic");
    }
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
      return t("editor.access.summaryTeams", {
        count: editor.rbac.teams?.length ?? 0,
      });
    }
    return "";
  }, [editor.rbac, t]);

  return (
    <section id="access" className="scroll-mt-20 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">{t("editor.sections.access")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("editor.access.description")}
        </p>
        <p className="text-sm font-medium text-foreground">{summary}</p>
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <RBACControl
          subjectLabel={t("editor.access.subjectLabel")}
          allowedModes={
            AGENT_RBAC_TEAMS_SUPPORTED
              ? undefined
              : (ALLOWED_MODES_NO_TEAMS as any)
          }
          initialRightsMode={editor.rbac.rights_mode as any}
          initialUsers={editor.rbac.users as any}
          initialRoles={editor.rbac.roles as any}
          initialTeams={editor.rbac.teams as any}
          onChange={(rights_mode, users, roles, teams) => {
            editor.setRbac({
              rights_mode,
              users,
              roles,
              teams: AGENT_RBAC_TEAMS_SUPPORTED ? teams : [],
            });
          }}
        />
      </div>
    </section>
  );
}
