// @vitest-environment jsdom
//
// WorkStatusBadge — the work status of a routine run with an inline menu to
// change it (backend spec 2026-11-16-routine-work-status-design).
import { MockedProvider } from "@apollo/client/testing";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import de from "@/messages/de.json";
import { SET_ROUTINE_RUN_WORK_STATUS } from "@/lib/routine-runs/queries";
import { parseWorkStatusConfig } from "@/lib/routine-runs/work-status";

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...args: unknown[]) => toastError(...args), success: vi.fn() } }));

import { WorkStatusBadge } from "./work-status-badge";

beforeAll(() => {
  // Radix menus measure and capture pointers; jsdom implements neither.
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
});
afterEach(() => {
  cleanup();
  toastError.mockReset();
});

const CONFIG = parseWorkStatusConfig({
  statuses: [
    { key: "neu", label: "Neu", color: "gray" },
    { key: "angebot_im_erp", label: "Angebot im ERP angelegt", color: "blue" },
    { key: "erledigt", label: "Erledigt", color: "green", done: true },
  ],
  default: "neu",
});
const RUN = { id: "jr-1", state: "completed", workflow: "wf-1", work_status: "neu", work_status_updated_at: null, work_status_updated_by: { kind: "default" as const } };

const resultRun = (status: string | null) => ({
  id: "jr-1", job_id: null, state: "completed", trigger: "email", trigger_metadata: null, session: null, workflow: "wf-1",
  workflowName: "R", agent: null, error: null, tries: 1, createdAt: null, updatedAt: null, inputTokens: null, outputTokens: null, costUsd: null,
  work_status: status, work_status_updated_at: "2026-11-16T09:12:00.000Z", work_status_updated_by: { kind: "user", id: 14 },
});

function show(props: { run?: Record<string, unknown>; config?: typeof CONFIG; mocks?: unknown[]; onChanged?: (run: unknown) => void }) {
  return render(
    <NextIntlClientProvider locale="de" messages={de as never}>
      <MockedProvider mocks={(props.mocks ?? []) as never}>
        <WorkStatusBadge run={(props.run ?? RUN) as never} config={props.config ?? CONFIG} onChanged={props.onChanged as never} />
      </MockedProvider>
    </NextIntlClientProvider>,
  );
}

const openMenu = () => {
  const trigger = screen.getByRole("button", { name: /Arbeitsstatus/ });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "Enter" });
};

describe("WorkStatusBadge", () => {
  it("renders nothing when the routine has no statuses", () => {
    const { container } = show({ config: parseWorkStatusConfig(null) });
    expect(container.firstChild).toBeNull();
  });

  it("shows the label of the run's status, and 'Kein Status' without one", () => {
    show({});
    expect(screen.getByRole("button", { name: /Arbeitsstatus/ }).textContent).toContain("Neu");
    cleanup();
    show({ run: { ...RUN, work_status: null } });
    expect(screen.getByRole("button", { name: /Arbeitsstatus/ }).textContent).toContain("Kein Status");
  });

  it("shows a removed status by its raw key with a hint", () => {
    show({ run: { ...RUN, work_status: "alt_geloescht" } });
    const button = screen.getByRole("button", { name: /Arbeitsstatus/ });
    expect(button.textContent).toContain("alt_geloescht");
    expect(button.getAttribute("title")).toContain("aus der Routine entfernt");
  });

  it("sets the chosen status and reports the updated run", async () => {
    const onChanged = vi.fn();
    show({
      onChanged,
      mocks: [{ request: { query: SET_ROUTINE_RUN_WORK_STATUS, variables: { id: "jr-1", status: "erledigt" } }, result: { data: { setRoutineRunWorkStatus: resultRun("erledigt") } } }],
    });
    openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: /Erledigt/ }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ id: "jr-1", work_status: "erledigt" })));
  });

  it("clears the status with 'Kein Status'", async () => {
    const onChanged = vi.fn();
    show({
      onChanged,
      mocks: [{ request: { query: SET_ROUTINE_RUN_WORK_STATUS, variables: { id: "jr-1", status: null } }, result: { data: { setRoutineRunWorkStatus: resultRun(null) } } }],
    });
    openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: /Kein Status/ }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ work_status: null })));
  });

  it("keeps the old status and shows the server message when the change fails", async () => {
    show({
      mocks: [{ request: { query: SET_ROUTINE_RUN_WORK_STATUS, variables: { id: "jr-1", status: "erledigt" } }, error: new Error('Unknown work status "erledigt"') }],
    });
    openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: /Erledigt/ }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][0]).toBe("Status konnte nicht gesetzt werden");
    expect(JSON.stringify(toastError.mock.calls[0][1])).toContain("Unknown work status");
    expect(screen.getByRole("button", { name: /Arbeitsstatus/ }).textContent).toContain("Neu");
  });
});
