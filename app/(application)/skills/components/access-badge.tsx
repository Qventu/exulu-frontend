"use client";

/**
 * AccessBadge — visibility/RBAC label for a skill.
 *
 * LOCAL STUB to the shape codebase-structure.md §2.3 will ship as
 * `components/primitives/access-badge.tsx` (the primitive isn't promoted in
 * this work item — only the second consumer triggers the graduation rule,
 * §1.1; brief rule 6). When the primitive lands, this file's call sites swap
 * the import and the file is deleted. Mirrors the prompts/components/access-
 * badge.tsx stub.
 *
 * Fixes skills.md H7 (the legacy renderer silently fell back to "Public" for
 * unknown rights modes — including "teams" — confusing access semantics). The
 * stub renders "Restricted" for unknown/teams modes until backend support
 * lands. Token-only colors, monochrome icons (skills.md M8).
 */

import {
  Building2,
  Globe,
  Lock,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { cn } from "@/lib/utils";

import type { SkillRightsMode } from "../types";

interface IconMap {
  icon: LucideIcon;
  /** i18n key under `skills.access.*`. */
  labelKey: string;
}

const MAP: Record<SkillRightsMode, IconMap> = {
  private: { icon: Lock, labelKey: "private" },
  users: { icon: Users, labelKey: "users" },
  roles: { icon: Shield, labelKey: "roles" },
  teams: { icon: Building2, labelKey: "teams" },
  public: { icon: Globe, labelKey: "public" },
};

export interface AccessBadgeProps {
  mode: SkillRightsMode | string | undefined | null;
  /** "row" => compact muted single line; "panel" => with optional count summary. */
  variant?: "row" | "panel";
  counts?: { users?: number; roles?: number };
  className?: string;
}

function isKnownMode(value: unknown): value is SkillRightsMode {
  return (
    value === "private" ||
    value === "users" ||
    value === "roles" ||
    value === "teams" ||
    value === "public"
  );
}

export function AccessBadge({
  mode,
  variant = "row",
  counts,
  className,
}: AccessBadgeProps) {
  const t = useTranslations("skills");

  const known = isKnownMode(mode) ? MAP[mode] : undefined;
  const Icon = known?.icon ?? Lock;
  const label = known
    ? t(`access.${known.labelKey}`)
    : t("access.unknown");

  if (variant === "row") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs text-muted-foreground",
          className,
        )}
      >
        <Icon aria-hidden="true" className="size-3" />
        <span>{label}</span>
      </span>
    );
  }

  // panel variant — slightly larger, with optional count summary for users/roles modes.
  const countParts: string[] = [];
  if (mode === "users" && counts?.users !== undefined) {
    countParts.push(t("access.usersCount", { count: counts.users }));
  }
  if (mode === "roles" && counts?.roles !== undefined) {
    countParts.push(t("access.rolesCount", { count: counts.roles }));
  }

  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      <span>{label}</span>
      {countParts.length > 0 ? (
        <span className="text-xs text-muted-foreground/80">
          {"· "}
          {countParts.join(" · ")}
        </span>
      ) : null}
    </span>
  );
}
