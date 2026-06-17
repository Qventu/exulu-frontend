"use client";

/**
 * VisibilityBadge — the L1 trust indicator in the detail PageHeader
 * (projects.md §3 / ladder row 35; philosophy §8: scope is never hidden
 * below L2). "Private" when `rights_mode = private`, "Shared" otherwise;
 * the tooltip names the share target and counts, clicking jumps to
 * Settings → Access. Tap-friendly: the trigger is a real button (no
 * hover-only datum — the same text is its accessible description).
 */

import { Lock, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Project } from "@/types/models/project";
import { cn } from "@/lib/utils";

export function VisibilityBadge({
  project,
  onOpenAccess,
  className,
}: {
  project: Project;
  /** Jump to Settings → Access (ladder row 35: the badge links there). */
  onOpenAccess: () => void;
  className?: string;
}) {
  const t = useTranslations("projects");

  const mode = project.rights_mode ?? "private";
  const isPrivate = mode === "private";
  const userCount = project.RBAC?.users?.length ?? 0;
  const roleCount = project.RBAC?.roles?.length ?? 0;

  const detail = isPrivate
    ? t("visibility.privateTooltip")
    : mode === "users"
      ? t("visibility.sharedWithUsers", { count: userCount })
      : mode === "roles"
        ? t("visibility.sharedWithRoles", { count: roleCount })
        : t("visibility.sharedGeneric");

  const Icon = isPrivate ? Lock : Users;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onOpenAccess}
            aria-label={`${t("visibility.label")}: ${detail}`}
            className={cn(
              // min-h-11 = 44px touch target below md (responsive.md DoD).
              "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:min-h-7",
              className,
            )}
          >
            <Icon aria-hidden="true" className="size-3" />
            {isPrivate ? t("visibility.private") : t("visibility.shared")}
          </button>
        </TooltipTrigger>
        <TooltipContent>{detail}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
