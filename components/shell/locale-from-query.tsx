"use client";

/**
 * Applies a `?lang=` parameter once on load, then takes it out of the URL.
 *
 * Mounted inside LanguageProvider so it can reuse the normal locale machinery
 * — the parameter is a shortcut into the same state the switcher produces, not
 * a separate mode. Guests have no account to carry a preference on, so a link
 * is the only way to hand someone the UI in their language up front.
 *
 * The parameter is removed with history.replaceState rather than a router
 * navigation: this runs during the first paint, and a navigation here would
 * re-render the page under the visitor. The decision itself lives in
 * lib/locale-from-query.ts, where it is unit-tested — including the reason the
 * parameter must always go, which is that setLocale reloads and a surviving
 * parameter would silently undo the switcher.
 */

import { useSearchParams } from "next/navigation";
import * as React from "react";

import { useLanguage } from "@/components/shell/language-provider";
import { localeFromQuery } from "@/lib/locale-from-query";

export const LOCALE_QUERY_PARAM = "lang";

export function LocaleFromQuery() {
  const searchParams = useSearchParams();
  const { locale, setLocale } = useLanguage();
  const param = searchParams?.get(LOCALE_QUERY_PARAM) ?? null;

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const { apply, strip } = localeFromQuery(param, locale);

    // Strip FIRST: setLocale reloads, and the parameter has to be gone from
    // the URL the reload lands on.
    if (strip) {
      const url = new URL(window.location.href);
      url.searchParams.delete(LOCALE_QUERY_PARAM);
      window.history.replaceState(null, "", url.toString());
    }
    if (apply) setLocale(apply);
    // `locale` is deliberately not a dependency: this reacts to the parameter,
    // and re-running it after a switcher change would re-apply a stale value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param]);

  return null;
}
