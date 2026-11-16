// @vitest-environment jsdom
//
// WorkStatusesSection — the per-routine editor for work statuses (backend
// spec 2026-11-16-routine-work-status-design).
import { MockedProvider } from "@apollo/client/testing";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import de from "@/messages/de.json";
import { parseWorkStatusConfig, type WorkStatusConfig } from "@/lib/routine-runs/work-status";

import { UPDATE_WORKFLOW_TEMPLATE } from "../../queries";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { WorkStatusesSection } from "./work-statuses";

afterEach(cleanup);

const SAVED = parseWorkStatusConfig({
  statuses: [
    { key: "neu", label: "Neu", color: "gray" },
    { key: "erledigt", label: "Erledigt", color: "green", done: true },
  ],
  default: "neu",
});
const EMPTY: WorkStatusConfig = { statuses: [], default: null };

/** Captures the variables of the save and answers with a minimal item. */
function saveMock() {
  const calls: Record<string, unknown>[] = [];
  const mock = {
    request: { query: UPDATE_WORKFLOW_TEMPLATE },
    variableMatcher: () => true,
    result: (vars: Record<string, unknown>) => {
      calls.push(vars);
      return { data: { workflow_templatesUpdateOneById: { __typename: "X", item: null } } };
    },
  };
  return { mock, calls };
}

function show(saved: WorkStatusConfig, opts: { mocks?: unknown[]; canWrite?: boolean; onSaved?: (c: WorkStatusConfig) => void } = {}) {
  return render(
    <NextIntlClientProvider locale="de" messages={de as never}>
      <MockedProvider mocks={(opts.mocks ?? []) as never}>
        <WorkStatusesSection routineId="wf-1" saved={saved} canWrite={opts.canWrite ?? true} onSaved={opts.onSaved ?? (() => {})} />
      </MockedProvider>
    </NextIntlClientProvider>,
  );
}

const rows = () => screen.getAllByRole("listitem");
const labelOf = (row: HTMLElement) => within(row).getByPlaceholderText("Bezeichnung") as HTMLInputElement;
const keyOf = (row: HTMLElement) => within(row).getByTestId("status-key").textContent;
const add = (label: string) => {
  fireEvent.click(screen.getByRole("button", { name: "Status hinzufügen" }));
  const row = rows().at(-1)!;
  fireEvent.change(labelOf(row), { target: { value: label } });
  return rows().at(-1)!;
};
const saveButton = () => screen.getByRole("button", { name: "Speichern" }) as HTMLButtonElement;

describe("WorkStatusesSection", () => {
  it("derives the key of a new status from its label and freezes the key of a saved one", () => {
    show(SAVED);
    expect(keyOf(add("Rückfrage vorbereitet"))).toBe("rueckfrage_vorbereitet");

    fireEvent.change(labelOf(rows()[0]), { target: { value: "Eingegangen" } });
    expect(keyOf(rows()[0])).toBe("neu");
  });

  it("gives two statuses with the same label different keys", () => {
    show(EMPTY);
    add("Erledigt");
    add("Erledigt");
    expect(rows().map(keyOf)).toEqual(["erledigt", "erledigt_2"]);
  });

  it("moves the default away when the default status is marked done", () => {
    show(parseWorkStatusConfig({ statuses: [{ key: "neu", label: "Neu" }, { key: "offen", label: "Offen" }], default: "neu" }));
    fireEvent.click(within(rows()[0]).getByRole("checkbox", { name: "Erledigt" }));
    expect((within(rows()[0]).getByRole("radio", { name: "Standard" }) as HTMLInputElement).checked).toBe(false);
    expect((within(rows()[1]).getByRole("radio", { name: "Standard" }) as HTMLInputElement).checked).toBe(true);
  });

  it("saves the exact list and default, and reports the saved config", async () => {
    const save = saveMock();
    const onSaved = vi.fn();
    show(SAVED, { mocks: [save.mock], onSaved });
    add("Rückfrage");
    fireEvent.click(saveButton());

    await waitFor(() => expect(save.calls).toHaveLength(1));
    expect(save.calls[0]).toEqual({
      id: "wf-1",
      work_statuses: {
        statuses: [
          { key: "neu", label: "Neu", color: "gray", done: false },
          { key: "erledigt", label: "Erledigt", color: "green", done: true },
          { key: "rueckfrage", label: "Rückfrage", color: "gray", done: false },
        ],
        default: "neu",
      },
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ default: "neu" })));
  });

  it("saves null when the last status is removed", async () => {
    const save = saveMock();
    show(parseWorkStatusConfig({ statuses: [{ key: "neu", label: "Neu" }], default: "neu" }), { mocks: [save.mock] });
    fireEvent.click(screen.getByRole("button", { name: "Status entfernen" }));
    fireEvent.click(saveButton());
    await waitFor(() => expect(save.calls).toHaveLength(1));
    expect(save.calls[0]).toEqual({ id: "wf-1", work_statuses: null });
  });

  it("blocks the save without a default status and says why", () => {
    show(parseWorkStatusConfig({ statuses: [{ key: "neu", label: "Neu" }, { key: "erledigt", label: "Erledigt", done: true }], default: "neu" }));
    // The only open status becomes done: nothing is left to be the default.
    fireEvent.click(within(rows()[0]).getByRole("checkbox", { name: "Erledigt" }));
    expect(screen.getByText("Bitte einen Standardstatus wählen.")).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });

  it("warns when no status is marked done but still allows the save", () => {
    show(EMPTY);
    add("Neu");
    expect(screen.getByText(/Kein Status ist als erledigt markiert/)).toBeTruthy();
    expect(saveButton().disabled).toBe(false);
  });

  it("is read-only without write access", () => {
    show(SAVED, { canWrite: false });
    expect(labelOf(rows()[0]).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Status hinzufügen" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Speichern" })).toBeNull();
  });
});
