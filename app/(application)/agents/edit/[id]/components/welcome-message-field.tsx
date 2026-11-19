"use client";

/**
 * The welcome message, plus one optional version per further interface language.
 *
 * The first field is the default: written in English, shown to English readers
 * and to anyone whose language has no version below. The versions are stored in
 * `welcomemessage_translations` (lib/welcome-message.ts).
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/i18n/config";
import {
  TRANSLATION_LOCALES,
  type WelcomeTranslations,
} from "@/lib/welcome-message";

/** Each language in its own name, so the label reads the same in any interface language. */
const LANGUAGE_NAMES: Record<Locale, string> = { en: "English", de: "Deutsch" };

export function WelcomeMessageField({
  value,
  onChange,
  translations,
  onTranslationsChange,
}: {
  value: string | null | undefined;
  onChange: (value: string) => void;
  translations: WelcomeTranslations | undefined;
  onTranslationsChange: (value: WelcomeTranslations) => void;
}) {
  const t = useTranslations("agents");

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <div className="space-y-0.5">
          <label
            htmlFor="agent-welcome-message"
            className="text-sm font-medium"
          >
            {t("editor.chatExperience.welcomeLabel")}
          </label>
          <p className="text-sm text-muted-foreground">
            {t("editor.chatExperience.welcomeDescription")}
          </p>
        </div>
        <Textarea
          id="agent-welcome-message"
          rows={3}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">
            {t("editor.chatExperience.welcomeTranslationsLabel")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("editor.chatExperience.welcomeTranslationsDescription")}
          </p>
        </div>
        {TRANSLATION_LOCALES.map((locale) => (
          <div key={locale} className="space-y-1.5">
            <label
              htmlFor={`agent-welcome-message-${locale}`}
              className="text-sm text-muted-foreground"
            >
              {LANGUAGE_NAMES[locale]}
            </label>
            <Textarea
              id={`agent-welcome-message-${locale}`}
              rows={3}
              value={translations?.[locale] ?? ""}
              onChange={(e) =>
                onTranslationsChange({
                  ...translations,
                  [locale]: e.target.value,
                })
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
