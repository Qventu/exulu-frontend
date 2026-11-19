import { describe, expect, it } from "vitest";

import {
  TRANSLATION_LOCALES,
  readWelcomeTranslations,
  resolveWelcomeMessage,
  writeWelcomeTranslations,
} from "./welcome-message";

const agent = {
  welcomemessage: "Hello, I am Newton.",
  welcomemessage_translations: { de: "Hallo, ich bin Newton." },
};

describe("resolveWelcomeMessage", () => {
  it("shows the default to an English reader", () => {
    expect(resolveWelcomeMessage(agent, "en")).toBe("Hello, I am Newton.");
  });

  it("shows the reader's own language when a version was written", () => {
    expect(resolveWelcomeMessage(agent, "de")).toBe("Hallo, ich bin Newton.");
    expect(resolveWelcomeMessage(agent, "DE")).toBe("Hallo, ich bin Newton.");
  });

  it("falls back to the default when there is no version", () => {
    const plain = { welcomemessage: "Hello" };
    expect(resolveWelcomeMessage(plain, "de")).toBe("Hello");
    expect(resolveWelcomeMessage({ ...plain, welcomemessage_translations: null }, "de")).toBe("Hello");
    expect(resolveWelcomeMessage({ ...plain, welcomemessage_translations: { de: "  " } }, "de")).toBe("Hello");
  });

  it("leaves an agent without versions exactly as it was, in every language", () => {
    const legacy = { welcomemessage: "## Hallo 👋\n\nWie kann ich helfen?" };
    for (const locale of ["en", "de", "fr", null, undefined]) {
      expect(resolveWelcomeMessage(legacy, locale)).toBe(legacy.welcomemessage);
    }
  });

  it("reads versions that arrive as a JSON string", () => {
    expect(
      resolveWelcomeMessage(
        { welcomemessage: "Hello", welcomemessage_translations: '{"de":"Hallo"}' },
        "de",
      ),
    ).toBe("Hallo");
  });

  it("never lets a stored version override the default language", () => {
    // The default IS the English text; an "en" entry in the column is ignored
    // so there is exactly one place to edit it.
    expect(
      resolveWelcomeMessage(
        { welcomemessage: "Hello", welcomemessage_translations: { en: "Other" } },
        "en",
      ),
    ).toBe("Hello");
  });

  it("uses the default for an unknown locale and survives broken data", () => {
    expect(resolveWelcomeMessage(agent, "klingon")).toBe("Hello, I am Newton.");
    for (const broken of ["not json", 7, ["de"], "[1]"]) {
      expect(
        resolveWelcomeMessage({ welcomemessage: "Hello", welcomemessage_translations: broken }, "de"),
      ).toBe("Hello");
    }
  });

  it("is empty for a missing agent or message", () => {
    expect(resolveWelcomeMessage(null, "en")).toBe("");
    expect(resolveWelcomeMessage({}, "de")).toBe("");
  });
});

describe("read / write", () => {
  it("offers a version for every interface language except the default", () => {
    expect(TRANSLATION_LOCALES).toEqual(["de"]);
  });

  it("stores trimmed text and drops empty versions", () => {
    expect(writeWelcomeTranslations({ de: "  Hallo  " })).toEqual({ de: "Hallo" });
  });

  it("stores null rather than an empty object when nothing is written", () => {
    expect(writeWelcomeTranslations({ de: "   " })).toBeNull();
    expect(writeWelcomeTranslations({})).toBeNull();
    expect(writeWelcomeTranslations(null)).toBeNull();
  });

  it("round-trips", () => {
    const stored = writeWelcomeTranslations({ de: "Hallo" });
    expect(readWelcomeTranslations(stored)).toEqual({ de: "Hallo" });
    expect(readWelcomeTranslations(JSON.stringify(stored))).toEqual({ de: "Hallo" });
  });

  it("ignores languages the interface does not offer", () => {
    expect(readWelcomeTranslations({ de: "Hallo", fr: "Bonjour", en: "Hi" })).toEqual({ de: "Hallo" });
  });
});
