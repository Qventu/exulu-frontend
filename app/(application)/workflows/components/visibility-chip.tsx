"use client";

/**
 * VisibilityChip — revived from the legacy `VisibilityIndicator`
 * (`columns.tsx:620-684`) per workflows.md inventory item 48.
 *
 * Tokens only — no `bg-blue-100`/`text-blue-800` palette pulls. Shown only
 * when the routine isn't private (Name cell). Teams case appears only when
 * ROUTINES_RBAC_TEAMS_SUPPORTED — otherwise team assignments don't reach the
 * frontend and the chip would lie about the count.
 */

import { Globe, Lock, Shield, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { ROUTINES_RBAC_TEAMS_SUPPORTED } from "../schema-flags";
import type { Routine } from "../types";

export function VisibilityChip({ routine }: { routine: Routine }) {
  const t = useTranslations("routines");
  const mode = routine.rights_mode ?? "private";

  if (mode === "private") return null;

  let Icon = Lock;
  let label = "";

  switch (mode) {
    case "public":
      Icon = Globe;
      label = t("visibility.public");
      break;
    case "users":
      Icon = Users;
      label = t("visibility.users", { count: routine.RBAC.users?.length ?? 0 });
      break;
    case "roles":
      Icon = Shield;
      label = t("visibility.roles", { count: routine.RBAC.roles?.length ?? 0 });
      break;
    case "teams":
      if (!ROUTINES_RBAC_TEAMS_SUPPORTED) return null;
      Icon = Users;
      label = t("visibility.teams", { count: routine.RBAC.teams?.length ?? 0 });
      break;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1 font-normal">
            <Icon aria-hidden="true" className="size-3 text-muted-foreground" />
            <span className="text-xs">{label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{t("visibility.tooltip", { label })}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
