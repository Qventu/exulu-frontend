// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/components/lottie", () => ({ default: () => null }));

import { DocumentReading } from "./document-reading";
import { MessageRenderer } from "@/components/message-renderer";
import de from "@/messages/de.json";

afterEach(cleanup);

const wrap = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="de" messages={de as never}>
    {ui}
  </NextIntlClientProvider>
);

const running = (output: Record<string, unknown>) => ({
  type: "tool-parse_document",
  toolCallId: "c1",
  state: "output-available",
  preliminary: true,
  input: { filename: "handbuch.pdf" },
  output: { status: "reading", filename: "handbuch.pdf", phase: "ocr", pagesDone: 75, pagesTotal: 120, ...output },
});

describe("DocumentReading running", () => {
  it("shows file name, page progress and phase label with a determinate bar", () => {
    render(wrap(<DocumentReading part={running({})} streaming />));
    expect(screen.getByText("handbuch.pdf")).toBeDefined();
    expect(screen.getByText("Seite 75 von 120")).toBeDefined();
    expect(screen.getByText("Text wird erkannt")).toBeDefined();
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("63");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
  });

  it.each([
    ["vision", "Abbildungen und Tabellen werden geprüft"],
    ["storing", "Ergebnis wird gespeichert"],
    ["text", "Text wird gelesen"],
    ["cached", "Gespeicherter Text wird geladen"],
  ])("labels phase %s", (phase, label) => {
    render(wrap(<DocumentReading part={running({ phase })} streaming />));
    expect(screen.getByText(label)).toBeDefined();
  });

  it("is indeterminate before the first update and when pagesTotal is 0", () => {
    const { rerender } = render(
      wrap(
        <DocumentReading
          part={{ type: "tool-parse_document", state: "input-available", input: { filename: "a.pdf" } }}
          streaming
        />,
      ),
    );
    expect(screen.getByText("a.pdf")).toBeDefined();
    expect(screen.getByRole("progressbar").hasAttribute("aria-valuenow")).toBe(false);
    rerender(wrap(<DocumentReading part={running({ pagesTotal: 0, pagesDone: 0 })} streaming />));
    expect(screen.getByRole("progressbar").hasAttribute("aria-valuenow")).toBe(false);
    expect(screen.queryByText(/Seite \d+ von/)).toBeNull();
  });

  it("hints at storage for long documents only", () => {
    const { rerender } = render(wrap(<DocumentReading part={running({ pagesTotal: 50 })} streaming />));
    expect(screen.getByText("Das Ergebnis wird gespeichert, der nächste Zugriff ist sofort da.")).toBeDefined();
    rerender(wrap(<DocumentReading part={running({ pagesTotal: 49 })} streaming />));
    expect(screen.queryByText(/nächste Zugriff/)).toBeNull();
  });

  it("suppresses the long-document hint for the cached phase and sets aria-valuetext", () => {
    render(wrap(<DocumentReading part={running({ phase: "cached", pagesTotal: 120 })} streaming />));
    expect(screen.queryByText(/nächste Zugriff/)).toBeNull();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe("Seite 75 von 120");
  });

  it("shows an interrupted line instead of a bar once streaming has ended", () => {
    render(wrap(<DocumentReading part={running({})} streaming={false} />));
    expect(screen.getByText("Lesen abgebrochen")).toBeDefined();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});

describe("DocumentReading done", () => {
  const done = (output: unknown) => ({
    type: "tool-parse_document",
    state: "output-available",
    input: { filename: "handbuch.pdf" },
    output,
  });

  it("shows one line with name and pages, with the badge only when fromStore is true", () => {
    const { rerender } = render(wrap(<DocumentReading part={done({ content: "x", totalPages: 120, fromStore: true })} streaming={false} />));
    expect(screen.getByText("handbuch.pdf · 120 Seiten")).toBeDefined();
    expect(screen.getByText("bereits gelesen")).toBeDefined();
    expect(screen.queryByRole("progressbar")).toBeNull();
    rerender(wrap(<DocumentReading part={done({ content: "x", totalPages: 120 })} streaming={false} />));
    expect(screen.queryByText("bereits gelesen")).toBeNull();
  });

  it("shows the badge for a reloaded history part carrying fromStore", () => {
    render(wrap(<DocumentReading part={done({ result: { content: "x", fromStore: true } })} streaming={false} />));
    expect(screen.getByText("bereits gelesen")).toBeDefined();
  });

  it("uses the singular and omits unknown pages", () => {
    const { rerender } = render(wrap(<DocumentReading part={done({ content: "x", totalPages: 1 })} streaming={false} />));
    expect(screen.getByText("handbuch.pdf · 1 Seite")).toBeDefined();
    rerender(wrap(<DocumentReading part={done({ content: "x" })} streaming={false} />));
    expect(screen.getByText("handbuch.pdf")).toBeDefined();
  });

  it("unwraps a nested result payload", () => {
    render(wrap(<DocumentReading part={done({ result: { content: "x", totalPages: 3 } })} streaming={false} />));
    expect(screen.getByText("handbuch.pdf · 3 Seiten")).toBeDefined();
  });

  it.each([
    ["a plain string", "Datei nicht gefunden"],
    ["a result string", { result: "Datei nicht gefunden" }],
    ["an object without content", { message: "Datei nicht gefunden" }],
  ])("treats %s as an error and shows its text", (_n, output) => {
    render(wrap(<DocumentReading part={done(output)} streaming={false} />));
    expect(screen.getByText(/Datei nicht gefunden/)).toBeDefined();
    expect(screen.queryByText("bereits gelesen")).toBeNull();
  });

  it("shows output-error with its text, and without a dangling colon when empty", () => {
    const { rerender } = render(
      wrap(<DocumentReading part={{ ...done(undefined), state: "output-error", errorText: "kaputt" }} streaming={false} />),
    );
    expect(screen.getByText(/kaputt/)).toBeDefined();
    rerender(wrap(<DocumentReading part={{ ...done(undefined), state: "output-error", errorText: "" }} streaming={false} />));
    expect(screen.getByText("Dokument konnte nicht gelesen werden.")).toBeDefined();
  });

  it("falls back to the title for an empty filename", () => {
    render(wrap(<DocumentReading part={{ type: "tool-parse_document", state: "output-available", input: {}, output: { content: "x" } }} streaming={false} />));
    expect(screen.getByText("Dokument lesen")).toBeDefined();
  });

  it("shows the error text", () => {
    render(wrap(<DocumentReading part={done({ error: "Datei beschädigt" })} streaming={false} />));
    expect(screen.getByText(/Datei beschädigt/)).toBeDefined();
  });
});

describe("through the real MessageRenderer", () => {
  const msgs = (pagesDone: number) =>
    [
      { id: "u1", role: "user", parts: [{ type: "text", text: "lies das" }] },
      { id: "m1", role: "assistant", parts: [running({ pagesDone })], metadata: {} },
    ] as never[];
  const tree = (pagesDone: number, status: "streaming" | "ready") =>
    wrap(<MessageRenderer messages={msgs(pagesDone)} agent={{ id: "a", name: "A" } as never} status={status} />);

  it("re-renders when a preliminary update changes pagesDone, and shows interrupted after the stream", () => {
    const { rerender } = render(tree(25, "streaming"));
    expect(screen.getByText("Seite 25 von 120")).toBeDefined();
    rerender(tree(50, "streaming"));
    expect(screen.getByText("Seite 50 von 120")).toBeDefined();
    expect(screen.queryByText("Seite 25 von 120")).toBeNull();
    rerender(tree(50, "ready"));
    expect(screen.getByText("Lesen abgebrochen")).toBeDefined();
  });

  it("shows a finished read in an earlier message as done while the last message streams", () => {
    const finished = {
      type: "tool-parse_document", toolCallId: "c0", state: "output-available",
      input: { filename: "alt.pdf" }, output: { content: "x", totalPages: 4 },
    };
    const ms = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "a" }] },
      { id: "m0", role: "assistant", parts: [finished], metadata: {} },
      { id: "u2", role: "user", parts: [{ type: "text", text: "b" }] },
      { id: "m1", role: "assistant", parts: [{ type: "text", text: "..." }], metadata: {} },
    ] as never[];
    render(wrap(<MessageRenderer messages={ms} agent={{ id: "a", name: "A" } as never} status="streaming" />));
    expect(screen.getByText("alt.pdf · 4 Seiten")).toBeDefined();
  });

  it("falls through to the generic card while approval is requested", () => {
    const ms = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "a" }] },
      {
        id: "m1", role: "assistant", metadata: {},
        parts: [{ type: "tool-parse_document", toolCallId: "c1", state: "approval-requested", input: { filename: "x.pdf" }, approval: { id: "ap1" } }],
      },
    ] as never[];
    render(wrap(<MessageRenderer messages={ms} agent={{ id: "a", name: "A" } as never} status="streaming" />));
    expect(screen.queryByTestId("document-reading")).toBeNull();
  });
});
