"use client";

import { Globe, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type ProviderLogoProps = {
  brand?: string | null;
  region?: string | null;
  size?: number;
  showRegion?: boolean;
  className?: string;
};

/**
 * Renders a model provider logo with light/dark variants and an optional
 * region indicator (EU pill or Globe icon). Falls back to a Sparkles icon
 * when no brand is set.
 *
 * Logos are served from /public/ai/logos/{light,dark}/<brand>.png — light
 * variant is shown in light mode, dark variant in dark mode (via Tailwind's
 * `dark:` selector, so no SSR/CSR hydration mismatch).
 */
export function ProviderLogo({
  brand,
  region,
  size = 16,
  showRegion = true,
  className,
}: ProviderLogoProps) {
  const regionLabel = region === "eu" ? "EU region" : "Global region";

  return (
    <span className={cn("inline-flex items-center gap-1.5 shrink-0", className)}>
      {brand ? (
        <>
          <img
            src={`/ai/logos/light/${brand}.png`}
            alt={brand}
            width={size}
            height={size}
            className="block dark:hidden object-contain"
            style={{ width: size, height: size }}
          />
          <img
            src={`/ai/logos/dark/${brand}.png`}
            alt={brand}
            width={size}
            height={size}
            className="hidden dark:block object-contain"
            style={{ width: size, height: size }}
          />
        </>
      ) : (
        <Sparkles
          aria-label="Unknown provider"
          className="text-muted-foreground"
          style={{ width: size, height: size }}
        />
      )}
      {showRegion ? (
        region === "eu" ? (
          <span
            aria-label={regionLabel}
            title={regionLabel}
            className="text-[9px] font-semibold leading-none px-1 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
          >
            EU
          </span>
        ) : (
          <Globe
            aria-label={regionLabel}
            className="text-muted-foreground"
            style={{ width: Math.round(size * 0.75), height: Math.round(size * 0.75) }}
          />
        )
      ) : null}
    </span>
  );
}
