"use client";

/**
 * LocaleSwitcher — minimal EN/DE toggle writing the `NEXT_LOCALE` cookie
 * (design/pages/auth.md §3 "Default view": the one new control on the login
 * surface, required to make i18n real pre-auth — fixes U6).
 *
 * Delegates cookie write + message reload to the shared LanguageProvider so
 * the pre-auth and in-app locale machinery can never diverge. Labels are the
 * locale codes themselves ("EN"/"DE") — like the ⌘K glyph, codes are not
 * translated copy; the accessible names come from the existing `language.*`
 * namespace and the group label from `auth.footer.languageLabel`. Touch
 * targets ≥44 px below `md` (size-11 md:size-8 pattern).
 *
 * The active locale stays a focusable, non-disabled `aria-pressed="true"`
 * button (clicking it is a no-op): disabled buttons leave the tab order, so
 * keyboard/SR users could never perceive which language is active.
 *
 * MIGRATION-STUB: codebase-structure.md §2.5 homes this in
 * `components/shell/locale-switcher.tsx` (variants "footer" | "menu");
 * built route-locally per the parallel protocol with the same prop API.
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { useLanguage } from "@/components/shell/language-provider";
import { Button } from "@/components/ui/button";
import { type Locale, locales } from "@/i18n/config";
import { cn } from "@/lib/utils";

/** language.* label key per locale code (existing namespace). */
const LANGUAGE_LABEL_KEY: Record<Locale, string> = {
  en: "english",
  de: "german",
};

export interface LocaleSwitcherProps {
  /** §2.5 API parity; only the footer presentation exists pre-auth. */
  variant?: "footer" | "menu";
  className?: string;
}

export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const { locale, setLocale } = useLanguage();
  const t = useTranslations("language");
  const tAuth = useTranslations("auth");

  return (
    <div
      className={cn("flex items-center", className)}
      role="group"
      aria-label={tAuth("footer.languageLabel")}
    >
      {locales.map((code) => {
        const active = code === locale;
        return (
          <Button
            key={code}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={active}
            aria-label={t("switchTo", {
              language: t(LANGUAGE_LABEL_KEY[code]),
            })}
            onClick={() => {
              // No-op when already active — the button stays in the tab
              // order so the aria-pressed state is perceivable.
              if (!active) setLocale(code);
            }}
            className={cn(
              "h-11 min-w-11 px-2 text-xs uppercase tracking-wide md:h-8 md:min-w-8",
              active
                ? "font-semibold text-foreground"
                : "font-normal text-muted-foreground",
            )}
          >
            {code}
          </Button>
        );
      })}
    </div>
  );
}
