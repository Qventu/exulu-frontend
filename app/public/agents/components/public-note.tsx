"use client";

/**
 * Client wrapper for the public pages' terminal states. Server pages in this
 * codebase MUST NOT call getTranslations — i18n/config.ts intentionally has
 * no next-intl server pathway (the repeatedly-bitten trap documented across
 * app/(application) pages). All copy therefore resolves here, client-side,
 * under the public layout's LanguageProvider.
 */

import { useTranslations } from "next-intl";

import { CenteredNote } from "./centered-note";

export function PublicNote({
  kind,
}: {
  kind: "empty" | "notFound" | "misconfigured";
}) {
  const t = useTranslations("publicAgents");
  return (
    <CenteredNote
      title={t(`${kind}.title`)}
      description={t(`${kind}.description`)}
    />
  );
}
