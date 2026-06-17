"use client";

/**
 * Brand — the sidebar's brand header content (navigation.md §2 "Brand header").
 *
 * Product decision 2026-06-11: the platform presents itself generically — a
 * plain "AI Studio" wordmark (`text-sm font-semibold tracking-tight`), no
 * customer logo and no backend-served product name (the earlier
 * logo-plus-config-name concept is retired; navigation.md updated).
 *
 * Rail mode (`group-data-[collapsible=icon]` on the shadcn Sidebar wrapper):
 * the wordmark unmounts and a compact monogram tile ("AI") shows, centered,
 * so the header never reads as empty at 3rem.
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { cn } from "@/lib/utils";

export interface BrandProps {
  className?: string;
}

const Brand = React.forwardRef<HTMLDivElement, BrandProps>(
  ({ className }, ref) => {
    const t = useTranslations();

    return (
      <div
        ref={ref}
        data-shell="brand"
        className={cn(
          "flex min-w-0 items-center gap-2 px-1",
          "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
          className,
        )}
      >
        {/* Expanded: the generic wordmark. */}
        <span className="truncate text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
          {t("navigation.brand.productName")}
        </span>

        {/* Rail: compact monogram tile, centered (navigation.md §2). */}
        <span
          aria-hidden="true"
          className="hidden size-6 shrink-0 select-none items-center justify-center rounded-md bg-sidebar-accent text-[10px] font-semibold tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:flex"
        >
          {t("navigation.brand.mark")}
        </span>
      </div>
    );
  },
);
Brand.displayName = "Brand";

export { Brand };
