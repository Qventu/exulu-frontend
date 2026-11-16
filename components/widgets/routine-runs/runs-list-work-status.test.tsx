// @vitest-environment jsdom
//
// RoutineRunsList with work statuses: the list of one routine splits into
// an open and a done area (backend spec 2026-11-16-routine-work-status-design).
import { MockedProvider } from "@apollo/client/testing";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import de from "@/messages/de.json";
import { ROUTINE_RUNS, SET_ROUTINE_RUN_WORK_STATUS } from "@/lib/routine-runs/queries";
import { parseWorkStatusConfig } from "@/lib/routine-runs/work-status";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { RoutineRunsList } from "./runs-list";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
});
afterEach(cleanup);

const CONFIG = parseWorkStatusConfig({
  statuses: [
    { key: "neu", label: "Neu" },
    { key: "erledigt", label: "Erledigt", color: "green", done: true },
  ],
  default: "neu",
});

const run = (id: string, subject: string, status: string | null) => ({
  __typename: "RoutineRun",
  id, job_id: null, state: "completed", trigger: "email", trigger_metadata: { subject }, session: null, workflow: "wf-1",
  workflowName: "Ersatzteil Angebot", agent: null, error: null, tries: 1, createdAt: null, updatedAt: null,
  inputTokens: null, outputTokens: null, costUsd: null,
  work_status: status, work_status_updated_at: null, work_status_updated_by: null,
});
const page = (items: unknown[]) => ({ data: { routineRuns: { __typename: "RoutineRunPage", items, total: items.length, page: 1, limit: 20 } } });

/** One reusable mock per area; `calls` records the variables of every request. */
function runsMock(match: (vars: Record<string, unknown>) => boolean, items: unknown[]) {
  const calls: Record<string, unknown>[] = [];
  const mock = {
    request: { query: ROUTINE_RUNS },
    variableMatcher: (vars: Record<string, unknown>) => match(vars),
    maxUsageCount: Number.POSITIVE_INFINITY,
    result: (vars: Record<string, unknown>) => {
      calls.push(vars);
      return page(items);
    },
  };
  return { mock, calls };
}

const show = (mocks: unknown[], workStatuses?: typeof CONFIG) =>
  render(
    <NextIntlClientProvider locale="de" messages={de as never}>
      <MockedProvider mocks={mocks as never}>
        <RoutineRunsList workflow="wf-1" workStatuses={workStatuses} />
      </MockedProvider>
    </NextIntlClientProvider>,
  );

describe("RoutineRunsList with work statuses", () => {
  it("shows an open and a done area with their counts; the done area opens on click", async () => {
    const open = runsMock((v) => v.workStatusOpen === true, [run("a", "Anfrage A", "neu"), run("b", "Anfrage B", null)]);
    const done = runsMock((v) => v.workStatusOpen === false, [run("c", "Anfrage C", "erledigt")]);
    show([open.mock, done.mock], CONFIG);

    expect(await screen.findByRole("button", { name: "Offen (2)" })).toBeTruthy();
    const doneHeading = await screen.findByRole("button", { name: "Erledigt (1)" });
    expect(screen.getByText("Anfrage A")).toBeTruthy();
    expect(screen.queryByText("Anfrage C")).toBeNull();

    fireEvent.click(doneHeading);
    expect(await screen.findByText("Anfrage C")).toBeTruthy();
  });

  it("keeps the single list and sends no workStatusOpen for a routine without statuses", async () => {
    const all = runsMock(() => true, [run("a", "Anfrage A", null)]);
    show([all.mock]);

    expect(await screen.findByText("Anfrage A")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Offen/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Arbeitsstatus/ })).toBeNull();
    expect(all.calls).toHaveLength(1);
    expect("workStatusOpen" in all.calls[0]).toBe(false);
  });

  it("reloads both areas after a status change", async () => {
    const open = runsMock((v) => v.workStatusOpen === true, [run("a", "Anfrage A", "neu")]);
    const done = runsMock((v) => v.workStatusOpen === false, []);
    const set = {
      request: { query: SET_ROUTINE_RUN_WORK_STATUS, variables: { id: "a", status: "erledigt" } },
      result: { data: { setRoutineRunWorkStatus: run("a", "Anfrage A", "erledigt") } },
    };
    show([open.mock, done.mock, set], CONFIG);

    const badge = await screen.findByRole("button", { name: /Arbeitsstatus: Neu/ });
    await waitFor(() => expect(done.calls).toHaveLength(1));
    badge.focus();
    fireEvent.keyDown(badge, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /Erledigt/ }));

    await waitFor(() => {
      expect(open.calls.length).toBeGreaterThanOrEqual(2);
      expect(done.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("narrows both areas to the statuses chosen in the filter", async () => {
    const open = runsMock((v) => v.workStatusOpen === true, [run("a", "Anfrage A", "neu")]);
    const done = runsMock((v) => v.workStatusOpen === false, []);
    show([open.mock, done.mock], CONFIG);
    await screen.findByText("Anfrage A");

    const filter = screen.getByRole("button", { name: "Status" });
    filter.focus();
    fireEvent.keyDown(filter, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: /Neu/ }));

    await waitFor(() => expect(open.calls.at(-1)?.workStatuses).toEqual(["neu"]));
    await waitFor(() => expect(done.calls.at(-1)?.workStatuses).toEqual(["neu"]));
  });

  it("reloads both areas when the routine's statuses change, and drops a removed status from the filter", async () => {
    const open = runsMock((v) => v.workStatusOpen === true, [run("a", "Anfrage A", "neu")]);
    const done = runsMock((v) => v.workStatusOpen === false, []);
    const tree = (config: typeof CONFIG) => (
      <NextIntlClientProvider locale="de" messages={de as never}>
        <MockedProvider mocks={[open.mock, done.mock] as never}>
          <RoutineRunsList workflow="wf-1" workStatuses={config} />
        </MockedProvider>
      </NextIntlClientProvider>
    );
    const view = render(tree(CONFIG));
    await screen.findByText("Anfrage A");
    const filter = screen.getByRole("button", { name: "Status" });
    filter.focus();
    fireEvent.keyDown(filter, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: /Neu/ }));
    await waitFor(() => expect(open.calls.at(-1)?.workStatuses).toEqual(["neu"]));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    const before = { open: open.calls.length, done: done.calls.length };

    // The editor saved: "Neu" is gone, "Offen" now counts as done.
    view.rerender(tree(parseWorkStatusConfig({ statuses: [{ key: "offen", label: "Offen", done: true }, { key: "erledigt", label: "Erledigt", done: true }], default: null })));

    await waitFor(() => {
      expect(open.calls.length).toBeGreaterThan(before.open);
      expect(done.calls.length).toBeGreaterThan(before.done);
    });
    await waitFor(() => expect("workStatuses" in (open.calls.at(-1) ?? {})).toBe(false));
  });

  it("steps back a page when the current page comes back empty", async () => {
    const twenty = Array.from({ length: 20 }, (_, i) => run(`r${i}`, `Anfrage ${i}`, null));
    const calls: Record<string, unknown>[] = [];
    const mock = {
      request: { query: ROUTINE_RUNS },
      variableMatcher: () => true,
      maxUsageCount: Number.POSITIVE_INFINITY,
      result: (vars: Record<string, unknown>) => {
        calls.push(vars);
        // Page 2 held one run that has just left the list.
        const first = calls.filter((c) => c.page === 1).length === 1 && vars.page === 1;
        return { data: { routineRuns: { __typename: "RoutineRunPage", items: vars.page === 1 ? twenty : [], total: first ? 21 : 20, page: vars.page, limit: 20 } } };
      },
    };
    show([mock]);
    await screen.findByText("Anfrage 0");
    fireEvent.click(screen.getByRole("button", { name: "Nächste Seite" }));
    await waitFor(() => expect(calls.some((c) => c.page === 2)).toBe(true));
    await waitFor(() => expect(calls.at(-1)?.page).toBe(1));
    expect(await screen.findByText("Anfrage 0")).toBeTruthy();
  });
});
