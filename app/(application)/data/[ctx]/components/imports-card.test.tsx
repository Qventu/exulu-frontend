// @vitest-environment jsdom
/**
 * ImportsCard — the Pipeline tab's list of a context's server-side import
 * jobs (GET_IMPORT_JOBS, limit 20). Covered here: rendering `toImportJobView`
 * rows, Cancel's running+starter/admin gate, Retry's error-report+not-running
 * gate, the 5s poll running only while a row is running, a successful cancel
 * refetching the list, `onRetryImport` receiving the view, and the two empty
 * combinations (unavailable vs. available).
 *
 * Polling is asserted the way step-run-server.test.tsx already does it: a
 * short real `pollIntervalMs` override plus sequenced/counting mocks, not
 * fake timers (jsdom + MockedProvider + RTL's `waitFor` under fake timers is
 * the fragile combination the existing suite avoids).
 */
import { MockedProvider, type MockedResponse } from "@apollo/client/testing";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UserContext } from "@/app/(application)/authenticated";
import {
  ConfigContext,
  type ConfigContextType,
} from "@/components/shell/config-context";
import {
  CANCEL_IMPORT,
  GET_IMPORT_JOBS,
  importJobFilters,
} from "@/lib/api/imports";
import enMessages from "@/messages/en.json";
import type { Context } from "@/types/models/context";

const files = vi.hoisted(() => ({
  download: vi.fn(async () => ({
    json: async () => ({ url: "https://signed.example/report.csv" }),
  })),
}));

vi.mock("@/lib/api/files", () => ({ filesApi: { download: files.download } }));

// Imported after the mock (vi.mock is hoisted).
import { ImportsCard, type ImportsCardProps } from "./imports-card";

const CONTEXT_ID = "ctx_1";
const context: Context = { id: CONTEXT_ID } as unknown as Context;

const QUEUES = {
  entitlements: { queues: true },
  workers: { enabled: true, redisHost: "redis" },
} as unknown as ConfigContextType;

const NO_QUEUES = {
  entitlements: { queues: false },
  workers: { enabled: true, redisHost: "redis" },
} as unknown as ConfigContextType;

type Row = Record<string, unknown>;

const RUNNING_ROW: Row = {
  id: "job-1",
  label: "big.csv",
  state: "active",
  type: "import",
  context: CONTEXT_ID,
  trigger: "ui",
  trigger_metadata: JSON.stringify({
    fileName: "big.csv",
    user: { id: 7 },
    access: {
      rights_mode: "roles",
      users: [],
      roles: [{ id: "role-1", rights: "read" }],
      teams: [],
    },
  }),
  metadata: JSON.stringify({
    total: 1000,
    processed: 250,
    created: 200,
    updated: 50,
    failed: 0,
    invalid: 0,
  }),
  result: null,
  error: null,
  createdAt: "2026-10-21T10:00:00.000Z",
  updatedAt: "2026-10-21T10:01:00.000Z",
};

const REPORT_KEY = "bucket/imports/ctx_1/job-1-errors.csv";

const FINISHED_ROW: Row = {
  ...RUNNING_ROW,
  state: "completed",
  metadata: null,
  result: JSON.stringify({
    total: 1000,
    processed: 1000,
    created: 900,
    updated: 0,
    failed: 100,
    invalid: 0,
    durationMs: 42000,
    errorReportKey: REPORT_KEY,
  }),
};

const FINISHED_NO_REPORT_ROW: Row = {
  ...RUNNING_ROW,
  id: "job-2",
  label: "clean.csv",
  trigger_metadata: JSON.stringify({ fileName: "clean.csv", user: { id: 7 } }),
  state: "completed",
  metadata: null,
  result: JSON.stringify({
    total: 10,
    processed: 10,
    created: 10,
    updated: 0,
    failed: 0,
    invalid: 0,
    durationMs: 1200,
  }),
};

function jobsMock(
  items: Row[],
  extra: Partial<MockedResponse> = {},
): MockedResponse {
  return {
    request: {
      query: GET_IMPORT_JOBS,
      variables: { filters: importJobFilters(CONTEXT_ID), limit: 20 },
    },
    result: { data: { job_resultsPagination: { items } } },
    maxUsageCount: Number.POSITIVE_INFINITY,
    ...extra,
  };
}

function renderCard(
  mocks: MockedResponse[],
  {
    config = QUEUES,
    viewer,
    props = {},
  }: {
    config?: ConfigContextType | null;
    viewer?: { id: number; super_admin?: boolean } | null;
    props?: Partial<ImportsCardProps>;
  } = {},
) {
  const all: ImportsCardProps = { context, ...props };
  const card = (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ConfigContext.Provider value={config}>
        <MockedProvider mocks={mocks}>
          <ImportsCard {...all} />
        </MockedProvider>
      </ConfigContext.Provider>
    </NextIntlClientProvider>
  );
  return render(
    viewer !== undefined ? (
      <UserContext.Provider value={{ user: viewer }}>
        {card}
      </UserContext.Provider>
    ) : (
      card
    ),
  );
}

beforeEach(() => {
  files.download.mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ImportsCard", () => {
  it("renders a row's file name, badge, progress, started-by and duration", async () => {
    renderCard([jobsMock([RUNNING_ROW])]);

    expect(await screen.findByText("big.csv")).toBeTruthy();
    expect(screen.getByText("Running")).toBeTruthy();
    expect(screen.getByText(/250 of 1,?000 rows processed/)).toBeTruthy();
    expect(
      screen.getByText(/200 created, 50 updated, 0 failed, 0 invalid/),
    ).toBeTruthy();
    expect(screen.getByText(/Started by user 7/)).toBeTruthy();
  });

  it("shows counters and duration for a finished job", async () => {
    renderCard([jobsMock([FINISHED_ROW])]);

    expect(await screen.findByText("Completed")).toBeTruthy();
    expect(
      screen.getByText(/900 created, 0 updated, 100 failed, 0 invalid/),
    ).toBeTruthy();
    expect(screen.getByText(/Took 42s/)).toBeTruthy();
  });

  it("shows Cancel only while a row is running", async () => {
    renderCard([jobsMock([FINISHED_ROW])], { viewer: { id: 7 } });

    await screen.findByText("Completed");
    expect(screen.queryByRole("button", { name: "Cancel import" })).toBeNull();
  });

  it("hides Cancel from a viewer who neither started the job nor is an admin", async () => {
    renderCard([jobsMock([RUNNING_ROW])], { viewer: { id: 2 } });

    await screen.findByText("Running");
    expect(screen.queryByRole("button", { name: "Cancel import" })).toBeNull();
  });

  it("keeps Cancel for the starter and for a super admin", async () => {
    const { unmount } = renderCard([jobsMock([RUNNING_ROW])], {
      viewer: { id: 7 },
    });
    await screen.findByText("Running");
    expect(screen.getByRole("button", { name: "Cancel import" })).toBeTruthy();
    unmount();

    renderCard([jobsMock([RUNNING_ROW])], {
      viewer: { id: 2, super_admin: true },
    });
    await screen.findByText("Running");
    expect(screen.getByRole("button", { name: "Cancel import" })).toBeTruthy();
  });

  it("offers Retry only with an error report and only once the job is done", async () => {
    renderCard([jobsMock([RUNNING_ROW])]);
    await screen.findByText("Running");
    expect(
      screen.queryByRole("button", { name: "Retry failed rows" }),
    ).toBeNull();
    cleanup();

    renderCard([jobsMock([FINISHED_NO_REPORT_ROW])]);
    await screen.findByText("Completed");
    expect(
      screen.queryByRole("button", { name: "Retry failed rows" }),
    ).toBeNull();
    cleanup();

    renderCard([jobsMock([FINISHED_ROW])]);
    await screen.findByText("Completed");
    expect(
      screen.getByRole("button", { name: "Retry failed rows" }),
    ).toBeTruthy();
  });

  it("calls onRetryImport with the job's view, not with raw retry args", async () => {
    const onRetryImport = vi.fn();
    renderCard([jobsMock([FINISHED_ROW])], { props: { onRetryImport } });

    fireEvent.click(
      await screen.findByRole("button", { name: "Retry failed rows" }),
    );

    expect(onRetryImport).toHaveBeenCalledTimes(1);
    expect(onRetryImport.mock.calls[0][0]).toMatchObject({
      id: "job-1",
      fileName: "big.csv",
      errorReportKey: REPORT_KEY,
      canRetry: true,
    });
  });

  it("downloads the error report through filesApi", async () => {
    const opened = vi.fn();
    vi.spyOn(window, "open").mockImplementation(
      opened as unknown as typeof window.open,
    );
    renderCard([jobsMock([FINISHED_ROW])]);

    fireEvent.click(
      await screen.findByRole("button", { name: "Download error report" }),
    );
    await waitFor(() =>
      expect(files.download).toHaveBeenCalledWith(REPORT_KEY),
    );
    await waitFor(() =>
      expect(opened).toHaveBeenCalledWith(
        "https://signed.example/report.csv",
        "_blank",
      ),
    );
  });

  it("asks for confirmation, then cancels and refetches the list", async () => {
    const cancelMock: MockedResponse = {
      request: {
        query: CANCEL_IMPORT(CONTEXT_ID),
        variables: { jobResultId: "job-1" },
      },
      result: { data: { [`${CONTEXT_ID}_itemsCancelImport`]: { ok: true } } },
    };
    const cancelledRow: Row = { ...RUNNING_ROW, state: "cancelled" };

    renderCard(
      [
        // Exhausts after the initial fetch, so the refetch below falls
        // through to the third mock instead of matching this one again.
        jobsMock([RUNNING_ROW], { maxUsageCount: 1 }),
        cancelMock,
        jobsMock([cancelledRow]),
      ],
      { viewer: { id: 7 } },
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Cancel import" }),
    );
    expect(screen.getByText("Cancel this import?")).toBeTruthy();

    const actions = screen.getAllByRole("button", { name: "Cancel import" });
    fireEvent.click(actions[actions.length - 1]);

    expect(await screen.findByText("Cancelled")).toBeTruthy();
  });

  it("toasts and keeps the row running when the backend refuses the cancel", async () => {
    const toastMod = await import("sonner");
    const errorSpy = vi.spyOn(toastMod.toast, "error");
    const refusal: MockedResponse = {
      request: {
        query: CANCEL_IMPORT(CONTEXT_ID),
        variables: { jobResultId: "job-1" },
      },
      error: new Error("NOT_AUTHORIZED"),
    };

    renderCard([jobsMock([RUNNING_ROW]), refusal], { viewer: { id: 7 } });

    fireEvent.click(
      await screen.findByRole("button", { name: "Cancel import" }),
    );
    const actions = screen.getAllByRole("button", { name: "Cancel import" });
    fireEvent.click(actions[actions.length - 1]);

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        "Only the person who started the import, or an admin, can cancel it.",
      ),
    );
    // Still running — the refusal did not flip local state.
    expect(screen.getByText("Running")).toBeTruthy();
  });

  it("polls while a row is running", async () => {
    renderCard(
      [
        jobsMock([RUNNING_ROW], { maxUsageCount: 1 }),
        jobsMock([
          {
            ...RUNNING_ROW,
            state: "completed",
            metadata: null,
            result: JSON.stringify({
              total: 1000,
              processed: 1000,
              created: 1000,
              updated: 0,
              failed: 0,
              invalid: 0,
            }),
          },
        ]),
      ],
      { props: { pollIntervalMs: 20 } },
    );

    await screen.findByText("Running");
    expect(await screen.findByText("Completed")).toBeTruthy();
  });

  it("stops polling once no row is running", async () => {
    const counter = { n: 0 };
    renderCard(
      [
        {
          request: {
            query: GET_IMPORT_JOBS,
            variables: { filters: importJobFilters(CONTEXT_ID), limit: 20 },
          },
          result: () => {
            counter.n += 1;
            return {
              data: { job_resultsPagination: { items: [FINISHED_ROW] } },
            };
          },
          maxUsageCount: Number.POSITIVE_INFINITY,
        },
      ],
      { props: { pollIntervalMs: 20 } },
    );

    await screen.findByText("Completed");
    const firstCount = counter.n;
    await new Promise((r) => setTimeout(r, 120));
    expect(counter.n).toBe(firstCount);
  });

  it("renders nothing when server import is unavailable and there are no jobs", async () => {
    let resolved = false;
    const mock: MockedResponse = {
      request: {
        query: GET_IMPORT_JOBS,
        variables: { filters: importJobFilters(CONTEXT_ID), limit: 20 },
      },
      result: () => {
        resolved = true;
        return { data: { job_resultsPagination: { items: [] } } };
      },
      maxUsageCount: Number.POSITIVE_INFINITY,
    };
    const { container } = renderCard([mock], { config: NO_QUEUES });

    // Prove the query actually resolved before asserting the card stayed
    // hidden — otherwise "nothing rendered" would be indistinguishable from
    // "still loading".
    await waitFor(() => expect(resolved).toBe(true));
    await waitFor(() => expect(container.textContent).toBe(""));
  });

  it("shows the empty-state copy when available and there are no jobs", async () => {
    renderCard([jobsMock([])], { config: QUEUES });

    expect(await screen.findByText("No imports yet.")).toBeTruthy();
  });

  // F1 (fix round 1): a failed list fetch gets the run step's own status
  // copy, not a skeleton that never resolves into anything.
  it("shows the run step's status-unavailable copy instead of a skeleton when the list fetch fails", async () => {
    const failing: MockedResponse = {
      request: {
        query: GET_IMPORT_JOBS,
        variables: { filters: importJobFilters(CONTEXT_ID), limit: 20 },
      },
      error: new Error("Network request failed"),
    };
    const { container } = renderCard([failing]);

    expect(
      await screen.findByText(
        "Couldn't read the import's status: Network request failed",
      ),
    ).toBeTruthy();
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(0);
  });

  // F2 (fix round 1): a refetch failure after a SUCCESSFUL cancel must not
  // read as a failed cancel — the cancel already worked.
  it("does not toast a cancel failure when only the post-cancel refetch fails", async () => {
    const toastMod = await import("sonner");
    const errorSpy = vi.spyOn(toastMod.toast, "error");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cancelMock: MockedResponse = {
      request: {
        query: CANCEL_IMPORT(CONTEXT_ID),
        variables: { jobResultId: "job-1" },
      },
      result: { data: { [`${CONTEXT_ID}_itemsCancelImport`]: { ok: true } } },
    };
    const refetchFailure: MockedResponse = {
      request: {
        query: GET_IMPORT_JOBS,
        variables: { filters: importJobFilters(CONTEXT_ID), limit: 20 },
      },
      error: new Error("Network request failed"),
    };

    renderCard(
      [
        jobsMock([RUNNING_ROW], { maxUsageCount: 1 }),
        cancelMock,
        refetchFailure,
      ],
      { viewer: { id: 7 } },
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Cancel import" }),
    );
    const actions = screen.getAllByRole("button", { name: "Cancel import" });
    fireEvent.click(actions[actions.length - 1]);

    await waitFor(() =>
      expect(
        warnSpy.mock.calls.some(
          (call) =>
            typeof call[0] === "string" &&
            call[0].includes("refetch after a successful cancel failed"),
        ),
      ).toBe(true),
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
