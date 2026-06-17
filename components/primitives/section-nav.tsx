"use client";

/**
 * SectionNav — sticky anchored section navigation for long editor pages.
 *
 * Spec: design/codebase-structure.md §2.3 (SectionNav). Presentational; scroll
 * spy lives in the CONSUMER (e.g. agents editor's useScrollSpy hook); this
 * primitive is purely controlled. Renders REAL `<a href="#id">` anchors so
 * middle-click / native anchor semantics work, while `onSelect` lets the
 * consumer hijack same-tab clicks for smooth scrolling + focus moves.
 *
 * Responsive contract (design/responsive.md T6, agents.md §3 mobile):
 * - `≥lg`: sticky vertical rail (text-sm; active item `text-primary` — with
 *   Save, the only purple on the editor screen).
 * - `<lg`: horizontally scrollable chip row pinned under the header, no page
 *   horizontal scroll, ≥44px touch targets (`size-11 md:size-8` pattern).
 *
 * i18n: no built-in strings — `aria-label` defaults to `common.sections`;
 * consumers translate item labels themselves (primitives contract, codebase-
 * structure §3.5).
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { cn } from "@/lib/utils";

export interface SectionNavSection {
  /** DOM anchor id of the target section, e.g. "basics". */
  id: string;
  /** Already-translated label (consumer owns the page namespace). */
  label: string;
}

export interface SectionNavProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "onSelect"> {
  sections: SectionNavSection[];
  /** Controlled active anchor (consumer's scroll-spy output). */
  activeId?: string;
  /** Consumer scrolls the section into view and moves focus. */
  onSelect: (id: string) => void;
  /** Defaults to common.sections. */
  "aria-label"?: string;
}

const SectionNav = React.forwardRef<HTMLElement, SectionNavProps>(
  ({ sections, activeId, onSelect, className, ...props }, ref) => {
    const t = useTranslations("common");
    const label = props["aria-label"] ?? t("sections");

    const handleClick = (
      event: React.MouseEvent<HTMLAnchorElement>,
      id: string,
    ) => {
      // Let modifier-clicks (cmd/ctrl/shift) and middle-click follow native
      // anchor semantics — only hijack a plain primary click.
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      ) {
        return;
      }
      event.preventDefault();
      onSelect(id);
    };

    return (
      <nav
        ref={ref}
        aria-label={label}
        className={cn(
          // Sticky on every viewport (chip-row stays pinned under the header
          // on phones too); z-10 + bg so scrolling content can't show
          // through. self-scrolling max-h keeps runaway navs reachable on
          // short viewports without blowing out of the sticky frame.
          "sticky top-2 z-10 self-start bg-background py-1",
          "lg:top-6 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pr-2 scrollbar-subtle",
          className,
        )}
        {...props}
      >
        <ul
          className={cn(
            // Below lg: chip row. ≥lg: vertical rail.
            "-mx-4 flex gap-1 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0",
          )}
        >
          {sections.map((section) => {
            const active = section.id === activeId;
            return (
              <li key={section.id} className="shrink-0 lg:shrink">
                <a
                  href={`#${section.id}`}
                  onClick={(event) => handleClick(event, section.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-md px-3 text-sm transition-colors duration-150 ease-in-out motion-reduce:transition-none",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "md:min-h-8",
                    "lg:w-full",
                    active
                      ? "font-medium text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {section.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  },
);
SectionNav.displayName = "SectionNav";

export { SectionNav };
