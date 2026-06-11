"use client";

/**
 * Brand — the sidebar's brand header content (navigation.md §2 "Brand header").
 *
 * Backend-served logo (components/logo.tsx, theme-correct via `resolvedTheme`
 * — shell audit H5) at h-6, beside the product name at
 * `text-sm font-semibold tracking-tight`. The hardcoded "AI Studio" string
 * (old main-nav.tsx) dies here: the name comes from the /config-derived
 * ConfigContext (`config.name`, optional until the backend ships it) with an
 * i18n'd fallback.
 *
 * Rail mode (`group-data-[collapsible=icon]` on the shadcn Sidebar wrapper):
 * the wordmark and product name unmount and only the logo mark — the
 * backend-served square icon — shows, centered.
 */

import { useTranslations } from "next-intl";
import * as React from "react";
import { useContext } from "react";

import Logo from "@/components/logo";
import {
  ConfigContext,
  type ConfigContextType,
} from "@/components/shell/config-context";
import { cn } from "@/lib/utils";

export interface BrandProps {
  className?: string;
}

/**
 * The backend /config payload carries no product-name field yet; when it
 * ships one (`name`), it wins over the i18n fallback without a code change
 * here beyond this optional field.
 */
type BrandConfig = (ConfigContextType & { name?: string }) | null;

const Brand = React.forwardRef<HTMLDivElement, BrandProps>(
  ({ className }, ref) => {
    const t = useTranslations();
    const config = useContext(ConfigContext) as BrandConfig;

    const productName = config?.name?.trim() || t("navigation.brand.productName");

    return (
      <div
        ref={ref}
        data-shell="brand"
        className={cn(
          "flex min-w-0 items-center gap-2",
          "group-data-[collapsible=icon]:justify-center",
          className,
        )}
      >
        {/* Expanded: full wordmark logo + product name. */}
        <Logo
          width={64}
          height={24}
          alt={productName}
          className="h-6 w-auto shrink-0 object-contain group-data-[collapsible=icon]:hidden"
        />
        <span className="truncate text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
          {productName}
        </span>

        {/* Rail: logo mark only, centered (navigation.md §2). */}
        {/* eslint-disable-next-line @next/next/no-img-element -- backend-served asset, same pattern as components/logo.tsx */}
        <img
          src={`${config?.backend ?? ""}/icon_32x32.png`}
          alt={productName}
          width={24}
          height={24}
          className="hidden size-6 shrink-0 object-contain group-data-[collapsible=icon]:block"
        />
      </div>
    );
  },
);
Brand.displayName = "Brand";

export { Brand };
