// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

// Markdown rendering is not under test and drags in streamdown.
vi.mock("@/components/ai-elements/response", () => ({
  Response: ({ children }: { children: React.ReactNode }) => (
    <pre>{children}</pre>
  ),
}));

import { ToolTrace } from "./tool-trace";

const call = (type: string, overrides: Record<string, unknown> = {}) =>
  ({
    type,
    toolCallId: `call-${Math.random().toString(36).slice(2, 8)}`,
    state: "output-available",
    input: { command: "ls" },
    output: { result: "ok" },
    ...overrides,
  }) as any;

const PARTS = [
  call("tool-bash"),
  call("tool-hubspot_list_tools"),
  call("tool-hubspot_read"),
  call("tool-hubspot_read"),
];

function renderTrace(parts = PARTS) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ToolTrace parts={parts} />
    </NextIntlClientProvider>,
  );
}

describe("ToolTrace", () => {
  afterEach(cleanup);

  it("renders one card with the call count and the aggregate state", () => {
    renderTrace();
    expect(screen.getByText(enMessages.chat.toolTrace.title)).toBeDefined();
    expect(screen.getByText("· 4")).toBeDefined();
    expect(screen.getByText("Completed")).toBeDefined();
  });

  it("shows the sequence with consecutive same-tool calls collapsed", () => {
    renderTrace();
    const sequence = screen.getByRole("list", {
      name: enMessages.chat.toolTrace.sequence,
    });
    const steps = within(sequence)
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(steps).toEqual(["Bash", "Hubspot list tools", "Hubspot read ×2"]);
  });

  it("opens to one row per call, named by its tool", () => {
    renderTrace();
    fireEvent.click(screen.getByText(enMessages.chat.toolTrace.title));
    const rows = screen.getAllByRole("button", { name: /Bash|Hubspot/ });
    // The header is named "Tool calls", so only the four rows match; each
    // row's text starts with its tool + input preview (the status badge
    // follows).
    const titles = [
      "Bash · ls",
      "Hubspot list tools · ls",
      "Hubspot read · ls",
      "Hubspot read · ls",
    ];
    expect(rows.length).toBe(titles.length);
    rows.forEach((row, index) => {
      expect(row.textContent?.startsWith(titles[index])).toBe(true);
    });
  });
});
