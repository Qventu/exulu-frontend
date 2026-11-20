// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { WelcomeTranslations } from "@/lib/welcome-message";
import enMessages from "@/messages/en.json";

import { WelcomeMessageField } from "./welcome-message-field";

function Harness({
  seen,
}: {
  seen: { message: string[]; translations: WelcomeTranslations[] };
}) {
  const [message, setMessage] = React.useState("Hello");
  const [translations, setTranslations] = React.useState<WelcomeTranslations>({ de: "Hallo" });
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <WelcomeMessageField
        value={message}
        onChange={(next) => {
          seen.message.push(next);
          setMessage(next);
        }}
        translations={translations}
        onTranslationsChange={(next) => {
          seen.translations.push(next);
          setTranslations(next);
        }}
      />
    </NextIntlClientProvider>
  );
}

const box = (id: string) => document.getElementById(id) as HTMLTextAreaElement | null;
const fresh = () => ({ message: [] as string[], translations: [] as WelcomeTranslations[] });

describe("WelcomeMessageField", () => {
  afterEach(cleanup);

  it("shows the default and a field for each further language", () => {
    render(<Harness seen={fresh()} />);
    expect(box("agent-welcome-message")!.value).toBe("Hello");
    expect(box("agent-welcome-message-de")!.value).toBe("Hallo");
  });

  it("offers no field for the default language: the first field is that text", () => {
    render(<Harness seen={fresh()} />);
    expect(box("agent-welcome-message-en")).toBeNull();
  });

  it("edits the default and a version independently", () => {
    const seen = fresh();
    render(<Harness seen={seen} />);
    fireEvent.change(box("agent-welcome-message-de")!, { target: { value: "Hallo zusammen" } });
    expect(seen.translations.at(-1)).toEqual({ de: "Hallo zusammen" });
    expect(seen.message).toEqual([]);
    fireEvent.change(box("agent-welcome-message")!, { target: { value: "Hello there" } });
    expect(seen.message.at(-1)).toBe("Hello there");
  });

  it("keeps a trailing space or line break while someone is typing", () => {
    // Trimming belongs to the save, not to the keystroke.
    render(<Harness seen={fresh()} />);
    fireEvent.change(box("agent-welcome-message-de")!, { target: { value: "Hallo \n" } });
    expect(box("agent-welcome-message-de")!.value).toBe("Hallo \n");
  });
});
