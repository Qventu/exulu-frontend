"use client";

/**
 * Live theme preview (settings-config.md §3, right pane — fixes U2: theme
 * editing is no longer blind). A sample composition — button variants, a card
 * with badges, an input, a mini chat exchange, the chart color ramp — renders
 * inside a scoped wrapper whose CSS custom properties are the DRAFT values:
 * every keystroke in the editor previews instantly, before anything is
 * published.
 *
 * - The full resolved variable set is applied inline on the wrapper
 *   (settings-config.md risk 2), so shadcn components reading tokens at
 *   runtime render faithfully in both preview modes regardless of the
 *   admin's own app theme.
 * - The Light/Dark sub-toggle previews the other mode WITHOUT touching
 *   next-themes (the admin's app theme never changes).
 * - The sampler is `inert`: decorative, never focusable, never actionable.
 * - 150 ms color transitions on sampler elements so a token edit visibly
 *   flows into the preview (motion budget; reduced motion gets instant).
 */

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

import {
  resolveTheme,
  type ThemeMode,
  type ThemeOverrides,
} from "../theme-defaults";

export interface ThemePreviewProps {
  /** The previewed mode — independent of the admin's own app theme. */
  mode: ThemeMode;
  onModeChange: (mode: ThemeMode) => void;
  overrides: { light: ThemeOverrides; dark: ThemeOverrides };
  className?: string;
}

const CHART_TOKENS = Array.from(
  { length: 10 },
  (_, index) => `--chart-${index + 1}`,
);

const TRANSITION = "transition-colors duration-150 motion-reduce:transition-none";

export function ThemePreview({
  mode,
  onModeChange,
  overrides,
  className,
}: ThemePreviewProps) {
  const t = useTranslations("configuration");
  const tNav = useTranslations("navigation");
  const tCommon = useTranslations("common");

  const resolved = React.useMemo(
    () => resolveTheme(mode, overrides[mode]),
    [mode, overrides],
  );

  // The scoped draft variables — React passes custom properties through.
  const scopedVars = React.useMemo(() => {
    return Object.fromEntries(
      Object.entries(resolved).map(([name, value]) => [name, value]),
    ) as React.CSSProperties;
  }, [resolved]);

  return (
    // The page's ONLY Card (settings-config.md §3 layout note).
    <Card className={className}>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <CardTitle className="text-lg">{t("preview")}</CardTitle>
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(next) => {
            if (next) onModeChange(next as ThemeMode);
          }}
          aria-label={t("preview")}
          className="rounded-md bg-muted p-0.5"
        >
          <ToggleGroupItem
            value="light"
            aria-label={tNav("userMenu.themeLight")}
            className="size-11 rounded-sm p-0 data-[state=on]:bg-background data-[state=on]:shadow-sm md:size-8"
          >
            <Sun aria-hidden="true" className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="dark"
            aria-label={tNav("userMenu.themeDark")}
            className="size-11 rounded-sm p-0 data-[state=on]:bg-background data-[state=on]:shadow-sm md:size-8"
          >
            <Moon aria-hidden="true" className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent>
        {/* The scoped sampler — decorative and inert. */}
        <div
          inert
          aria-hidden="true"
          style={scopedVars}
          className={cn(
            "flex select-none flex-col gap-4 rounded-lg border bg-background p-4 text-foreground",
            TRANSITION,
          )}
        >
          {/* Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className={TRANSITION}>
              {t("sampler.primary")}
            </Button>
            <Button size="sm" variant="secondary" className={TRANSITION}>
              {t("sampler.secondary")}
            </Button>
            <Button size="sm" variant="outline" className={TRANSITION}>
              {t("sampler.outline")}
            </Button>
            <Button size="sm" variant="destructive" className={TRANSITION}>
              {tCommon("delete")}
            </Button>
          </div>

          {/* Card + badges */}
          <div className={cn("rounded-md border bg-card p-3 text-card-foreground", TRANSITION)}>
            <p className="text-sm font-medium">{t("sampler.cardTitle")}</p>
            <p className={cn("mt-0.5 text-xs text-muted-foreground", TRANSITION)}>
              {t("sampler.cardDescription")}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge className={TRANSITION}>{tCommon("active")}</Badge>
              <Badge variant="secondary" className={TRANSITION}>
                {t("sampler.secondary")}
              </Badge>
              <Badge variant="outline" className={TRANSITION}>
                {t("sampler.outline")}
              </Badge>
            </div>
          </div>

          {/* Input */}
          <Input
            readOnly
            tabIndex={-1}
            placeholder={tCommon("search")}
            className={cn("h-9", TRANSITION)}
          />

          {/* Mini chat exchange */}
          <div className="flex flex-col gap-2">
            <div
              className={cn(
                "ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground",
                TRANSITION,
              )}
            >
              {t("sampler.userBubble")}
            </div>
            <div
              className={cn(
                "mr-auto max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-foreground",
                TRANSITION,
              )}
            >
              {t("sampler.agentBubble")}
            </div>
          </div>

          {/* Chart color ramp */}
          <div className="flex flex-col gap-1.5">
            <p className={cn("text-xs text-muted-foreground", TRANSITION)}>
              {t("sampler.charts")}
            </p>
            <div className="flex gap-1">
              {CHART_TOKENS.map((token) => (
                <span
                  key={token}
                  className={cn("h-6 min-w-0 flex-1 rounded-sm", TRANSITION)}
                  style={{ backgroundColor: `hsl(var(${token}))` }}
                />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
