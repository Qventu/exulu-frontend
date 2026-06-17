"use client";

/**
 * RoleSelector pre-wired with this feature's i18n copy — the shared widget
 * stays feature-agnostic and receives all localized strings via props
 * (codebase-structure §3.5: widgets carry no feature namespace). Fixes the
 * hardcoded English the legacy widget shipped inside the keys L2/L3 flows
 * (keys-token.md U14 / adversarial-review issue 5), including the derived
 * permission summaries on each role row.
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { RoleSelector } from "@/components/widgets/role-selector";

export type KeysRoleSelectorProps = Omit<
  React.ComponentProps<typeof RoleSelector>,
  "loadingText" | "searchPlaceholder" | "emptyText" | "permissionCopy"
>;

export function KeysRoleSelector(props: KeysRoleSelectorProps) {
  const t = useTranslations("keys");
  return (
    <RoleSelector
      {...props}
      loadingText={t("roles.loading")}
      searchPlaceholder={t("roles.searchPlaceholder")}
      emptyText={t("roles.empty")}
      permissionCopy={{
        agents: t("roles.areaAgents"),
        workflows: t("roles.areaWorkflows"),
        variables: t("roles.areaVariables"),
        users: t("roles.areaUsers"),
        readWrite: t("roles.readWrite"),
        read: t("roles.read"),
        none: t("roles.noPermissions"),
      }}
    />
  );
}
