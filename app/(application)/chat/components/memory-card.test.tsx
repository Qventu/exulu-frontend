// @vitest-environment jsdom
import { MockedProvider } from "@apollo/client/testing";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";
import type { Agent } from "@/types/models/agent";

// The sharing control runs its own queries and is not what is under test.
vi.mock("@/components/rbac", () => ({ RBACControl: () => null }));

import { MemoryCard } from "./memory-card";

/**
 * "Merke dir: …" produced a card with an EMPTY wording field, so Save was dead
 * and nothing could be remembered (Newlift, 2026-11-19).
 *
 * The card seeds its form from the tool call's input exactly once. A tool call
 * arrives in stages: the part exists while the model is still writing its
 * arguments, and only later does it carry the full input and ask for approval.
 * The seed ran at the first of those moments — an input of `{}` — and never
 * again, so the wording the model then finished writing was thrown away.
 *
 * It only showed for some people because the seed also waits for the memory
 * context query. Cold, that query outlasts the streaming and hides the bug;
 * once cached (any earlier card in the session) the seed is immediate.
 */
const WORDING =
  "Bei diversen Busproblemen die zwei Busanschlüsse HHT auf der Steuerung X2 und auf dem FSM X23 kontrollieren.";

const agent = { id: "a1", name: "Newton" } as unknown as Agent; // no memory context: seeds immediately

const part = (state: string, input: Record<string, unknown>, approval?: { id: string }) =>
  ({
    type: "tool-memory_remember",
    toolCallId: "call-1",
    state,
    input,
    ...(approval ? { approval } : {}),
  }) as never;

const view = (p: never) => (
  <MockedProvider mocks={[]}>
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <MemoryCard part={p} agent={agent} addToolApprovalResponse={vi.fn() as never} />
    </NextIntlClientProvider>
  </MockedProvider>
);

const wording = () => screen.queryByRole("textbox") as HTMLTextAreaElement | null;

describe("MemoryCard wording", () => {
  afterEach(cleanup);

  it("is prefilled when the call arrives complete", async () => {
    render(
      view(
        part("approval-requested", { title: "Busprobleme", information: WORDING, type: "FACT" }, { id: "ap-1" }),
      ),
    );
    expect((await screen.findByRole("textbox") as HTMLTextAreaElement).value).toBe(WORDING);
  });

  it("is prefilled when the call was first seen while its input was still streaming", async () => {
    const { rerender } = render(view(part("input-streaming", {})));
    rerender(view(part("input-streaming", { title: "Busprobleme" })));
    rerender(
      view(
        part("approval-requested", { title: "Busprobleme", information: WORDING, type: "FACT" }, { id: "ap-1" }),
      ),
    );
    expect((await screen.findByRole("textbox") as HTMLTextAreaElement).value).toBe(WORDING);
  });

  it("shows no form before the call asks for approval", () => {
    render(view(part("input-streaming", { title: "Busprobleme" })));
    expect(wording()).toBeNull();
  });
});

/**
 * Usability pass on the same card. The person who reported the empty field
 * also had no way to tell what the card wanted from them: "Wording", a type in
 * capitals, and Private/Public with no word on what either means for a memory.
 */
describe("MemoryCard — what it tells the reader", () => {
  afterEach(cleanup);

  const complete = (input: Record<string, unknown> = {}) =>
    part(
      "approval-requested",
      { title: "Busprobleme", information: WORDING, type: "FACT", ...input },
      { id: "ap-1" },
    );

  it("says what is happening and that nothing is saved yet, above the form", async () => {
    render(view(complete()));
    const intro = await screen.findByText(/Newton would like to keep this/);
    expect(intro.textContent).toContain("Nothing is saved until you choose Save");
    const box = screen.getByRole("textbox");
    // Above, not below: DOCUMENT_POSITION_FOLLOWING means the textbox comes after.
    expect(intro.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("labels the text by what it is for, naming the agent", async () => {
    render(view(complete()));
    expect(await screen.findByLabelText("What Newton will remember")).toBe(screen.getByRole("textbox"));
  });

  it("explains what the chosen visibility means for a memory", async () => {
    render(view(complete()));
    const meaning = await screen.findByTestId("memory-visibility-meaning");
    expect(meaning.textContent).toMatch(/Only you/);
  });

  it("explains a public memory in terms of other people's answers", async () => {
    render(view(complete({ visibility: "public" })));
    const meaning = await screen.findByTestId("memory-visibility-meaning");
    expect(meaning.textContent).toMatch(/Everyone who uses Newton/);
    expect(meaning.textContent).toMatch(/colleagues/);
  });

  it("says why Save is unavailable when there is no text", async () => {
    render(view(complete({ information: "" })));
    await screen.findByRole("textbox");
    expect(screen.getByText("Enter what should be remembered to save.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("gives no such reason once there is text", async () => {
    render(view(complete()));
    await screen.findByRole("textbox");
    expect(screen.queryByText("Enter what should be remembered to save.")).toBeNull();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

