// @vitest-environment jsdom
/**
 * StepRunServer — the wizard's `run` step: it polls one job_result row and
 * renders `toImportJobView` over it. Covered here: the pre-job phases
 * (uploading / start error), a running job's progress and actions, the
 * confirm in front of Cancel, and the terminal job's error report + retry.
 *
 * `pollIntervalMs` is raised far past the test's lifetime so each case needs
 * exactly one mocked response — the 2 s production cadence would otherwise
 * exhaust the mocks mid-assertion.
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

import { GET_IMPORT_JOBS, importJobByIdFilters } from "@/lib/api/imports";
import enMessages from "@/messages/en.json";

const files = vi.hoisted(() => ({
  download: vi.fn(async () => ({
    json: async () => ({ url: "https://signed.example/report.csv" }),
  })),
}));

vi.mock("@/lib/api/files", () => ({ filesApi: { download: files.download } }));

// Imported after the mock (vi.mock is hoisted).
import { StepRunServer, type StepRunServerProps } from "./step-run-server";

const JOB_ID = "job-1";
const REPORT_KEY = "bucket/imports/ctx_1/job-1-errors.csv";

type Row = Record<string, unknown>;

function jobMock(row: Row, id: string = JOB_ID): MockedResponse {
  return {
    request: {
      query: GET_IMPORT_JOBS,
      variables: { filters: importJobByIdFilters(id), limit: 1 },
    },
    result: { data: { job_resultsPagination: { items: [row] } } },
    maxUsageCount: Number.POSITIVE_INFINITY,
  };
}

const baseRow: Row = {
  id: JOB_ID,
  label: "big.csv",
  state: "active",
  type: "import",
  context: "ctx_1",
  trigger: "ui",
  trigger_metadata: JSON.stringify({ fileName: "big.csv", user: { id: 7 } }),
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

const handlers = {
  onCancel: vi.fn(),
  onRetry: vi.fn(),
  onClose: vi.fn(),
  onBack: vi.fn(),
  onFinished: vi.fn(),
};

function renderStep(
  props: Partial<StepRunServerProps>,
  mocks: MockedResponse[] = [],
) {
  const all: StepRunServerProps = {
    jobResultId: JOB_ID,
    fileName: "big.csv",
    phase: "running",
    error: null,
    errorCode: null,
    cancelling: false,
    pollIntervalMs: 600_000,
    ...handlers,
    ...props,
  };
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <MockedProvider mocks={mocks}>
        <StepRunServer {...all} />
      </MockedProvider>
    </NextIntlClientProvider>,
  );
}

/** jsdom has no window.open; the download hands the signed URL to it. */
const opened = vi.fn();

/** Swaps the followed job id the way a retry does, in place. */
function Harness() {
  const [id, setId] = React.useState<string>(JOB_ID);
  return (
    <>
      <button type="button" onClick={() => setId("job-2")}>
        swap job
      </button>
      <StepRunServer
        {...handlers}
        jobResultId={id}
        fileName="big.csv"
        phase="running"
        error={null}
        errorCode={null}
        cancelling={false}
        pollIntervalMs={20}
      />
    </>
  );
}

beforeEach(() => {
  files.download.mockClear();
  opened.mockClear();
  vi.spyOn(window, "open").mockImplementation(
    opened as unknown as typeof window.open,
  );
  for (const fn of Object.values(handlers)) fn.mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("StepRunServer", () => {
  it("shows the upload line while the file is still going up", () => {
    renderStep({ phase: "uploading", jobResultId: null });

    expect(screen.getByText(/Uploading big\.csv/)).toBeTruthy();
    // Nothing exists server-side yet, so there is nothing to cancel.
    expect(screen.queryByRole("button", { name: "Cancel import" })).toBeNull();
  });

  it("maps a backend error code to its own copy", () => {
    renderStep({
      phase: "error",
      jobResultId: null,
      errorCode: "IMPORT_ALREADY_RUNNING",
      error: "IMPORT_ALREADY_RUNNING",
    });

    expect(screen.getByText(/An import is already running/)).toBeTruthy();
  });

  it("falls back to the raw message for an unknown error", () => {
    renderStep({
      phase: "error",
      jobResultId: null,
      errorCode: null,
      error: "socket hang up",
    });

    expect(screen.getByText(/socket hang up/)).toBeTruthy();
  });

  it("renders a running job's state, progress and counters", async () => {
    renderStep({}, [jobMock(baseRow)]);

    expect(await screen.findByText("Running")).toBeTruthy();
    // The locale may or may not group the thousand — both read the same.
    expect(screen.getByText(/250 of 1,?000 rows processed/)).toBeTruthy();
    expect(
      screen.getByText(/200 created, 50 updated, 0 failed, 0 invalid/),
    ).toBeTruthy();
    // Closing the wizard leaves the job alone — say so (Review Focus 4).
    expect(
      screen.getByText("The import keeps running in the background."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  });

  it("asks for confirmation before cancelling", async () => {
    renderStep({}, [jobMock(baseRow)]);

    fireEvent.click(
      await screen.findByRole("button", { name: "Cancel import" }),
    );
    expect(handlers.onCancel).not.toHaveBeenCalled();

    const confirm = await screen.findByText("Cancel this import?");
    expect(confirm).toBeTruthy();
    const actions = screen.getAllByRole("button", { name: "Cancel import" });
    fireEvent.click(actions[actions.length - 1]);

    await waitFor(() => expect(handlers.onCancel).toHaveBeenCalledTimes(1));
  });

  it("offers the error report and the retry once the job is done", async () => {
    const done: Row = {
      ...baseRow,
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
    renderStep({}, [jobMock(done)]);

    expect(await screen.findByText("Completed")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancel import" })).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Download error report" }),
    );
    // The key is passed exactly as stored (bucket/key), like item file fields.
    await waitFor(() =>
      expect(files.download).toHaveBeenCalledWith(REPORT_KEY),
    );
    await waitFor(() =>
      expect(opened).toHaveBeenCalledWith(
        "https://signed.example/report.csv",
        "_blank",
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry failed rows" }));
    expect(handlers.onRetry).toHaveBeenCalledWith({
      s3Key: REPORT_KEY,
      fileName: "big-errors.csv",
    });
  });

  it("shows a failed job's backend error verbatim", async () => {
    const failed: Row = {
      ...baseRow,
      state: "failed",
      error: "IMPORT_RESTARTED_AFTER_STALL: redelivered after a worker stall",
    };
    renderStep({}, [jobMock(failed)]);

    expect(await screen.findByText("Failed")).toBeTruthy();
    expect(
      screen.getByText(
        /IMPORT_RESTARTED_AFTER_STALL: redelivered after a worker stall/,
      ),
    ).toBeTruthy();
  });

  it("keeps polling the new job after a retry, instead of the finished one", async () => {
    // The step stays mounted across a retry. A "this step is done" flag
    // would leave the second job's progress frozen at its first result, so
    // the mocks below answer job-2 twice and the test waits for the second.
    const done: Row = {
      ...baseRow,
      state: "completed",
      metadata: null,
      result: JSON.stringify({
        total: 10,
        processed: 10,
        created: 9,
        updated: 0,
        failed: 1,
        invalid: 0,
        errorReportKey: REPORT_KEY,
      }),
    };
    const retryBase: Row = {
      ...baseRow,
      id: "job-2",
      label: "big-errors.csv",
      trigger_metadata: JSON.stringify({ fileName: "big-errors.csv" }),
      metadata: JSON.stringify({ total: 1, processed: 0 }),
      result: null,
    };
    const retryActive: Row = { ...retryBase, state: "active" };
    const retryFailed: Row = {
      ...retryBase,
      state: "failed",
      error: "EMPTY_FILE",
    };

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MockedProvider
          mocks={[
            jobMock(done),
            // First poll of job-2, then every later one.
            { ...jobMock(retryActive, "job-2"), maxUsageCount: 1 },
            jobMock(retryFailed, "job-2"),
          ]}
        >
          <Harness />
        </MockedProvider>
      </NextIntlClientProvider>,
    );

    expect(await screen.findByText("Completed")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Retry failed rows" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "swap job" }));

    // The finished job's actions go with it, and the new job keeps updating.
    expect(await screen.findByText("big-errors.csv")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Retry failed rows" }),
    ).toBeNull();
    expect(await screen.findByText("EMPTY_FILE")).toBeTruthy();
  });

  it("reports a finished job once, with its view", async () => {
    const done: Row = {
      ...baseRow,
      state: "completed",
      result: JSON.stringify({
        total: 10,
        processed: 10,
        created: 10,
        updated: 0,
        failed: 0,
        invalid: 0,
      }),
    };
    renderStep({}, [jobMock(done)]);

    await waitFor(() => expect(handlers.onFinished).toHaveBeenCalledTimes(1));
    expect(handlers.onFinished.mock.calls[0][0]).toMatchObject({
      id: JOB_ID,
      state: "completed",
    });
  });
});
