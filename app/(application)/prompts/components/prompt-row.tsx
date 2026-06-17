"use client";

/**
 * PromptRow — slim list row for /prompts (work item 2.9; prompts.md §3
 * "List" + inventory items 21/22/23/23a/25; replaces the legacy
 * `prompt-list-item.tsx`).
 *
 * Anatomy (prompts.md §3):
 *   line 1: name (truncated) + small filled star RIGHT when favorited
 *           (quiet amber, philosophy §4).
 *   line 2 (text-xs muted): relative updated time · visibility (icon+word
 *           via <AccessBadge compact />, fixes H4 + M1) · "n vars" when the
 *           prompt has variables · first tag.
 *
 * NO hover-only row actions (fixes prompts.md M2/M5-adjacent; responsive.md
 * T7 / hard rule 4) — share/delete/copy live in the detail panel's overflow
 * menu. Full-row tappable ≥44 px (responsive.md "Touch targets").
 *
 * Selected: 2 px purple left border + muted background (prompts.md §3 "the
 * accent marks the active state, per philosophy §4").
 */

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { extractVariables } from "@/lib/prompts/extract-variables";
import { cn } from "@/lib/utils";
import type { PromptLibrary } from "@/types/models/prompt-library";

import { AccessBadge } from "./access-badge";

interface PromptRowProps {
  prompt: PromptLibrary;
  selected: boolean;
  onSelect: () => void;
  /** Locale-formatted updated-at copy ("2 d ago"); the consumer owns the
   *  formatter so the row stays presentational. */
  updatedLabel: string;
}

export function PromptRow({
  prompt,
  selected,
  onSelect,
  updatedLabel,
}: PromptRowProps) {
  const t = useTranslations("prompts");
  const variables = React.useMemo(
    () => extractVariables(prompt.content),
    [prompt.content],
  );
  const firstTag = prompt.tags?.[0];
  const isFavorited = prompt.is_favorited ?? false;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected || undefined}
        className={cn(
          "group flex min-h-11 w-full items-start gap-3 border-l-2 px-3 py-2.5 text-left transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          selected
            ? "border-l-primary bg-muted/50"
            : "border-l-transparent hover:bg-muted/50",
        )}
      >
        <span className="min-w-0 flex-1 space-y-1">
          {/* Line 1: name + favorite indicator */}
          <span className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {prompt.name}
            </span>
            {isFavorited ? (
              <Star
                aria-label={t("favorited")}
                className="size-3 shrink-0 fill-yellow-400 text-yellow-400 dark:fill-yellow-500 dark:text-yellow-500"
              />
            ) : null}
          </span>

          {/* Line 2: muted metadata row */}
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">{updatedLabel}</span>
            <span aria-hidden="true">·</span>
            <AccessBadge mode={prompt.rights_mode} compact />
            {variables.length > 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="whitespace-nowrap">
                  {t("varsCount", { count: variables.length })}
                </span>
              </>
            ) : null}
            {firstTag ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{firstTag}</span>
                {prompt.tags && prompt.tags.length > 1 ? (
                  <span className="shrink-0 text-muted-foreground/70">
                    +{prompt.tags.length - 1}
                  </span>
                ) : null}
              </>
            ) : null}
          </span>
        </span>
      </button>
    </li>
  );
}
