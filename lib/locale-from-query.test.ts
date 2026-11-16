import { describe, expect, it } from "vitest";

import { localeFromQuery } from "./locale-from-query";

describe("localeFromQuery", () => {
  it("applies a supported language the visitor is not already in", () => {
    expect(localeFromQuery("de", "en")).toEqual({ apply: "de", strip: true });
  });

  it("strips without applying when it matches the current locale", () => {
    // Nothing to change — but the parameter must still go, see below.
    expect(localeFromQuery("de", "de")).toEqual({ apply: null, strip: true });
  });

  it("always strips, so the switcher cannot be reverted by the reload", () => {
    // setLocale writes the cookie and reloads. A ?lang= left in the URL is
    // read again on the way back: choosing EN on a ?lang=de link would flip
    // straight back to DE, making the switcher useless on any such link.
    for (const current of ["en", "de"] as const) {
      for (const param of ["de", "en", "fr", "DE", " de "]) {
        expect(localeFromQuery(param, current).strip).toBe(true);
      }
    }
  });

  it("ignores an unsupported language rather than defaulting", () => {
    // Showing English to someone who asked for French is worse than leaving
    // them where they are, and a typo should not look like a decision.
    expect(localeFromQuery("fr", "de")).toEqual({ apply: null, strip: true });
    expect(localeFromQuery("klingon", "en")).toEqual({
      apply: null,
      strip: true,
    });
  });

  it("tolerates case and surrounding whitespace", () => {
    expect(localeFromQuery("DE", "en").apply).toBe("de");
    expect(localeFromQuery(" de ", "en").apply).toBe("de");
  });

  it("does nothing at all when there is no parameter", () => {
    // Must not strip either: a replaceState on every load is needless churn.
    expect(localeFromQuery(null, "en")).toEqual({ apply: null, strip: false });
    expect(localeFromQuery(undefined, "en")).toEqual({
      apply: null,
      strip: false,
    });
    expect(localeFromQuery("", "en")).toEqual({ apply: null, strip: false });
  });
});
