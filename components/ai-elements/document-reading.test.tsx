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

  it("shows one line with name and pages, plus 'bereits gelesen' without prior progress", () => {
    render(wrap(<DocumentReading part={done({ content: "x", totalPages: 120, totalLines: 1, offset: 0, linesReturned: 1 })} streaming={false} />));
    expect(screen.getByText("handbuch.pdf · 120 Seiten")).toBeDefined();
    expect(screen.getByText("bereits gelesen")).toBeDefined();
    expect(screen.queryByRole("progressbar")).toBeNull();
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

  it("omits the badge when progress was shown before finishing", () => {
    const { rerender } = render(wrap(<DocumentReading part={running({})} streaming />));
    rerender(wrap(<DocumentReading part={done({ content: "x", totalPages: 120 })} streaming />));
    expect(screen.getByText("handbuch.pdf · 120 Seiten")).toBeDefined();
    expect(screen.queryByText("bereits gelesen")).toBeNull();
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
});
