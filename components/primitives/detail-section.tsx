"use client";

/**
 * DetailSection — collapsible titled section primitive for detail panels.
 *
 * Spec: design/codebase-structure.md §2.3/§2.4 / design/pages/knowledge.md §3
 * "Layout & components" — the one collapsible pattern for detail panels
 * everywhere (knowledge item-panel's Fields / Embeddings / Access / Calculated
 * sections; reusable by any other detail surface).
 *
 * - `title`: section heading.
 * - `meta`: quiet meta badge in the header (e.g. "12 chunks · updated 2h ago").
 * - `actions`: trailing affordance — typically an OverflowMenu or icon button.
 * - `collapsible`: when false the section renders as a plain titled block.
 * - `defaultOpen`: open-by-default — defaults to false (closed) for L3 sections.
 *
 * Built on `ui/collapsible.tsx` (Radix Collapsible). Motion budget: native
 * Radix accordion animation (~200ms, respects prefers-reduced-motion).
 *
 * i18n: primitives may only use `common.*` (codebase-structure §3.5). The
 * sr-only toggle label uses `common.expand` / `common.collapse`.
 */

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface DetailSectionProps {
  title: string;
  /** Quiet meta badge in the header — e.g. "12 chunks · updated 2h ago". */
  meta?: React.ReactNode;
  /** Default-open behavior. Defaults to false (closed) for L3 sections. */
  defaultOpen?: boolean;
  /** When false the section is a plain titled block, no toggle. */
  collapsible?: boolean;
  /** Trailing affordance shown in the header (e.g. overflow menu). */
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function DetailSection({
  title,
  meta,
  defaultOpen = false,
  collapsible = true,
  actions,
  children,
  className,
}: DetailSectionProps) {
  const t = useTranslations("common");
  const [open, setOpen] = React.useState(defaultOpen);

  // Plain titled block (no toggle).
  if (!collapsible) {
    return (
      <section
        className={cn("flex flex-col gap-3", className)}
        aria-label={title}
      >
        <header className="flex min-h-9 items-center gap-2">
          <h3 className="text-sm font-medium">{title}</h3>
          {meta ? (
            <span className="text-xs text-muted-foreground">{meta}</span>
          ) : null}
          {actions ? (
            <div className="ml-auto flex items-center gap-1">{actions}</div>
          ) : null}
        </header>
        <div>{children}</div>
      </section>
    );
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn("flex flex-col", className)}
    >
      <div className="flex min-h-11 items-center gap-2 md:min-h-9">
        <CollapsibleTrigger
          className={cn(
            "group flex flex-1 items-center gap-2 rounded-md py-2 text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "min-h-11 md:min-h-9",
          )}
          aria-label={open ? t("collapse") : t("expand")}
        >
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-in-out motion-reduce:transition-none",
              open && "rotate-0",
              !open && "-rotate-90",
            )}
          />
          <h3 className="text-sm font-medium">{title}</h3>
          {meta ? (
            <span className="text-xs text-muted-foreground">{meta}</span>
          ) : null}
        </CollapsibleTrigger>
        {actions ? (
          <div className="flex items-center gap-1">{actions}</div>
        ) : null}
      </div>
      <CollapsibleContent
        className={cn(
          "overflow-hidden",
          "data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down",
        )}
      >
        <div className="pb-2 pt-1">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
