"use client";

/**
 * AccessBadge — visibility/RBAC label for a prompt.
 *
 * LOCAL STUB to the shape codebase-structure.md §2.3 will ship as
 * `components/primitives/access-badge.tsx` (the primitive isn't promoted in
 * this work item — only the second consumer triggers the graduation rule,
 * §1.1). When the primitive lands, this file's call sites swap the import
 * and the file is deleted.
 *
 * Fixes prompts.md H4 (the legacy `prompt-list-item.tsx` had no `teams`
 * branch, so team-shared prompts fell through to a "Public/Globe" fallback)
 * and M1 (no rainbow icons — muted foreground, semantic tokens only).
 * Unknown rights modes render the agents-style "Restricted" label per the
 * primitive contract (codebase-structure §2.1 D9).
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

export type AccessMode =
  | "private"
  | "users"
  | "roles"
  | "teams"
  | "public"
  | undefined;

interface IconMap {
  icon: LucideIcon;
  /** i18n key under `prompts.access.*`. */
  labelKey: string;
}

const MAP: Record<NonNullable<AccessMode>, IconMap> = {
  private: { icon: Lock, labelKey: "private" },
  users: { icon: Users, labelKey: "users" },
  roles: { icon: Shield, labelKey: "roles" },
  teams: { icon: Building2, labelKey: "teams" },
  public: { icon: Globe, labelKey: "public" },
};

export interface AccessBadgeProps {
  mode: AccessMode;
  /** Compact variant for list rows (icon + word, single line, no chrome). */
  compact?: boolean;
  className?: string;
}

export function AccessBadge({
  mode,
  compact = false,
  className,
}: AccessBadgeProps) {
  const t = useTranslations("prompts");

  const entry = mode ? MAP[mode] : undefined;
  const Icon = entry?.icon ?? Lock;
  const label = entry
    ? t(`access.${entry.labelKey}`)
    : t("access.unknown");

  if (compact) {
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

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm text-muted-foreground",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      <span>{label}</span>
    </span>
  );
}
