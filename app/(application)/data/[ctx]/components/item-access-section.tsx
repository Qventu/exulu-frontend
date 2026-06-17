"use client";

/**
 * ItemAccessSection — collapsed DetailSection "Access" hosting the
 * existing RBACControl. Mode badge (Private / Users / Roles / Teams /
 * Public) is rendered as meta in the header so the user can see the
 * effective sharing mode without expanding.
 *
 * Fallback (work item #84): context.configuration.defaultRightsMode is
 * applied silently on create (the create dialog never blocks). On the
 * detail panel the badge always reflects the persisted value.
 *
 * Inventory item: 46 (Access section with mode badge).
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { DetailSection } from "@/components/primitives/detail-section";
import { RBACControl } from "@/components/rbac";
import { Badge } from "@/components/ui/badge";
import type { Item } from "@EXULU_SHARED/models/item";
import type { Context } from "@/types/models/context";

export interface ItemAccessSectionProps {
  context: Context;
  item: Item;
  editing: boolean;
  onChange: (
    rights_mode: "private" | "users" | "roles" | "teams" | "public",
    users: { id: number; rights: "read" | "write" }[],
    roles: { id: string; rights: "read" | "write" }[],
    teams: { id: string; rights: "read" | "write" }[],
  ) => void;
}

const MODE_LABEL_KEY: Record<string, string> = {
  private: "workspace.access.modePrivate",
  users: "workspace.access.modeUsers",
  roles: "workspace.access.modeRoles",
  teams: "workspace.access.modeTeams",
  public: "workspace.access.modePublic",
};

export function ItemAccessSection({
  context,
  item,
  editing: _editing,
  onChange,
}: ItemAccessSectionProps) {
  const t = useTranslations("knowledge");
  const mode =
    item.rights_mode ?? context.configuration?.defaultRightsMode ?? "private";

  return (
    <DetailSection
      title={t("workspace.sections.access")}
      defaultOpen={false}
      meta={
        <Badge variant="outline" className="text-xs">
          {t(MODE_LABEL_KEY[mode as string] ?? "workspace.access.modePrivate")}
        </Badge>
      }
    >
      <RBACControl
        subjectLabel={t("workspace.access.subjectLabel")}
        initialRightsMode={mode}
        initialUsers={item.RBAC?.users}
        initialRoles={item.RBAC?.roles}
        onChange={(rights_mode, users, roles, teams) =>
          onChange(rights_mode, users, roles, teams ?? [])
        }
      />
    </DetailSection>
  );
}
