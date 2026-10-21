// @vitest-environment jsdom
/**
 * The wizard's mode decision, end to end from a dropped CSV: the add step's
 * banner says where the import will run, and an oversized file on a
 * deployment without the worker queues is refused outright (Review Focus 3).
 * Also: reopening the wizard while a background job runs lands on the run
 * step instead of a blank add step (Review Focus 4, second half).
 *
 * The CSV goes in through the dropzone's real file input, so `countCsvRows`
 * and `peekCsvFile` run for real — jsdom's Blob implements neither `text()`
 * nor `arrayBuffer()`, so the polyfill below bridges them onto FileReader,
 * which jsdom does implement. (`arrayBuffer` is the one the chunk readers
 * actually call: they decode the slices through a single streaming
 * TextDecoder so a multi-byte character on a chunk boundary survives.)
 */
import { ApolloLink, Observable, type FetchResult } from "@apollo/client";
import { MockedProvider, type MockedResponse } from "@apollo/client/testing";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import {
  ConfigContext,
  type ConfigContextType,
} from "@/components/shell/config-context";
import {
  GET_IMPORT_JOBS,
  START_IMPORT,
  importJobByIdFilters,
  importJobFilters,
} from "@/lib/api/imports";
import { toImportJobView } from "@/lib/import/job-view";
import enMessages from "@/messages/en.json";
import type { Context } from "@/types/models/context";

import { ImportWizardDialog } from "./import-wizard-dialog";

if (typeof Blob.prototype.text !== "function") {
  Blob.prototype.text = function (this: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

if (typeof Blob.prototype.arrayBuffer !== "function") {
  Blob.prototype.arrayBuffer = function (this: Blob) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

const CONTEXT_ID = "ctx_1";

const context: Context = {
  id: CONTEXT_ID,
  name: "Product manuals",
  description: "",
  active: true,
  slug: "product-manuals",
  configuration: { defaultRightsMode: "private" },
  sources: [],
  fields: [{ name: "title", type: "text", label: "Title" }],
} as unknown as Context;

const QUEUES = {
  entitlements: { queues: true },
  workers: { enabled: true, redisHost: "redis" },
} as unknown as ConfigContextType;

const NO_QUEUES = {
  entitlements: { queues: false },
  workers: { enabled: true, redisHost: "redis" },
} as unknown as ConfigContextType;

/** The access the earlier run was started with — NOT the dialog's default. */
const STORED_ACCESS = {
  rights_mode: "roles",
  users: [],
  roles: [{ id: "role-1", rights: "read" }],
  teams: [],
};

const RUNNING_ROW = {
  id: "job-7",
  label: "earlier.csv",
  state: "active",
  type: "import",
  context: CONTEXT_ID,
  trigger: "ui",
  trigger_metadata: JSON.stringify({
    fileName: "earlier.csv",
    user: { id: 1 },
    access: STORED_ACCESS,
  }),
  metadata: JSON.stringify({
    total: 9000,
    processed: 10,
    created: 10,
    updated: 0,
    failed: 0,
    invalid: 0,
  }),
  result: null,
  error: null,
  createdAt: "2026-10-21T09:00:00.000Z",
  updatedAt: "2026-10-21T09:00:10.000Z",
};

const REPORT_KEY = "bucket/imports/ctx_1/job-7-errors.csv";

/** The same row as the next poll sees it: finished, with an error report. */
const FINISHED_ROW = {
  ...RUNNING_ROW,
  state: "completed",
  metadata: null,
  result: JSON.stringify({
    total: 9000,
    processed: 9000,
    created: 8990,
    updated: 0,
    failed: 10,
    invalid: 0,
    errorReportKey: REPORT_KEY,
  }),
};

const RETRY_ROW = {
  ...RUNNING_ROW,
  id: "job-8",
  label: "earlier-errors.csv",
  trigger_metadata: JSON.stringify({
    fileName: "earlier-errors.csv",
    user: { id: 1 },
    access: STORED_ACCESS,
  }),
  metadata: JSON.stringify({ total: 10, processed: 0 }),
};

/** The wizard's "is an import already running here?" probe on open. */
function openProbe(items: unknown[]): MockedResponse {
  return {
    request: {
      query: GET_IMPORT_JOBS,
      variables: { filters: importJobFilters(CONTEXT_ID), limit: 1 },
    },
    result: { data: { job_resultsPagination: { items } } },
    maxUsageCount: Number.POSITIVE_INFINITY,
  };
}

function byIdPoll(row: Record<string, unknown>): MockedResponse {
  return {
    request: {
      query: GET_IMPORT_JOBS,
      variables: {
        filters: importJobByIdFilters(String(row.id)),
        limit: 1,
      },
    },
    result: { data: { job_resultsPagination: { items: [row] } } },
    maxUsageCount: Number.POSITIVE_INFINITY,
  };
}

function renderWizard(
  config: ConfigContextType,
  mocks: MockedResponse[] = [openProbe([])],
  link?: ApolloLink,
) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ConfigContext.Provider value={config}>
        <MockedProvider mocks={mocks} link={link}>
          <ImportWizardDialog open onOpenChange={() => {}} context={context} />
        </MockedProvider>
      </ConfigContext.Provider>
    </NextIntlClientProvider>,
  );
}

/**
 * A link that answers every import-jobs operation with `row`, but only once
 * the test releases it. A `delay` would make "the user dropped a CSV while
 * the probe was still in flight" a race against jsdom's FileReader; this
 * makes it an ordering the test owns.
 */
function heldJobsLink(row: Record<string, unknown>) {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const link = new ApolloLink(
    () =>
      new Observable<FetchResult>((observer) => {
        void held.then(() => {
          observer.next({ data: { job_resultsPagination: { items: [row] } } });
          observer.complete();
        });
      }),
  );
  return { link, release: () => release() };
}

/** Lets the released link's `.then` chain (and any state update) settle. */
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function csv(rows: number): File {
  const text =
    "name,title\n" +
    Array.from({ length: rows }, (_, i) => `Item ${i},T${i}`).join("\n") +
    "\n";
  return new File([text], `rows-${rows}.csv`, { type: "text/csv" });
}

/**
 * A CSV with `rows` data rows padded past `bytes` bytes — the shape that
 * trips the byte limit without coming near the row limit (long `text`/
 * `markdown` cells, which is what a RAG knowledge context is for).
 */
function fatCsv(rows: number, bytes: number): File {
  const header = "name,body\n";
  const pad = "x".repeat(Math.ceil(bytes / rows));
  const text =
    header +
    Array.from({ length: rows }, (_, i) => `Item ${i},${pad}`).join("\n") +
    "\n";
  return new File([text], `fat-${rows}.csv`, { type: "text/csv" });
}

function dropCsv(file: File) {
  const input = document.querySelector('input[type="file"]');
  expect(input).toBeTruthy();
  fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
}

afterEach(cleanup);

describe("ImportWizardDialog — mode decision", () => {
  it("keeps a small CSV in the browser", async () => {
    renderWizard(QUEUES);
    dropCsv(csv(2));

    expect(await screen.findByText(/imported in your browser/)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("sends a large CSV to the background when the queues are provisioned", async () => {
    renderWizard(QUEUES);
    dropCsv(csv(201));

    expect(
      await screen.findByText(
        /imported in the background \(201 rows, [\d.]+ KB\)/,
      ),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("refuses a large CSV and disables Continue without the queues licence", async () => {
    renderWizard(NO_QUEUES);
    dropCsv(csv(201));

    // The banner names the rows AND the size, so it is true whichever of the
    // two limits the file tripped — here, the row count.
    expect(
      await screen.findByText(/too large for a browser import \(201 rows, /),
    ).toBeTruthy();
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement)
          .disabled,
      ).toBe(true),
    );
  });

  it("refuses an oversized but short CSV without claiming it has too many rows", async () => {
    // 120 rows of long bodies trip the 2 MB limit, not the 200-row one. The
    // row-only copy used to tell the user 120 rows were too many — a reason
    // that is false, on a dead end (Continue is disabled) with nothing to act
    // on.
    const file = fatCsv(120, 2 * 1024 * 1024 + 1);
    expect(file.size).toBeGreaterThan(2 * 1024 * 1024);
    renderWizard(NO_QUEUES);
    dropCsv(file);

    expect(
      await screen.findByText(
        /too large for a browser import \(120 rows, 2\.0 MB\)/,
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/too many for a browser import/)).toBeNull();
  });

  it("retries with the access the import was started with, not the dialog default", async () => {
    // Reopening the wizard resets batchAccess to the context default, so a
    // retry that used it would silently re-import the failed rows under a
    // different rights mode. The mutation mock below only matches the
    // stored access — with anything else the step lands on its error panel.
    const startMock: MockedResponse = {
      request: {
        query: START_IMPORT(CONTEXT_ID),
        variables: {
          input: {
            s3Key: REPORT_KEY,
            fileName: "earlier-errors.csv",
            access: STORED_ACCESS,
            options: { delimiter: "," },
          },
        },
      },
      result: {
        data: { [`${CONTEXT_ID}_itemsStartImport`]: { jobResultId: "job-8" } },
      },
    };

    renderWizard(QUEUES, [
      openProbe([RUNNING_ROW]),
      byIdPoll(FINISHED_ROW),
      startMock,
      byIdPoll(RETRY_ROW),
    ]);

    fireEvent.click(
      await screen.findByRole("button", { name: "Retry failed rows" }),
    );

    expect(await screen.findByText("earlier-errors.csv")).toBeTruthy();
    expect(screen.queryByText(/The import couldn't be started/)).toBeNull();
  });

  it("opens on the run step when an import is already running for the context", async () => {
    renderWizard(QUEUES, [openProbe([RUNNING_ROW]), byIdPoll(RUNNING_ROW)]);

    expect(await screen.findByText("earlier.csv")).toBeTruthy();
    expect(screen.getByText("Running")).toBeTruthy();
  });

  it("leaves a dropped CSV alone when the running-import probe resolves late", async () => {
    // The probe is a network round-trip: on a slow connection it used to
    // resolve into `adopt(); setStep("run")` whatever the user had done
    // meanwhile, discarding a dropped (and possibly mapped) file with no way
    // back — the run step only offers Back after a failed start.
    const { link, release } = heldJobsLink(RUNNING_ROW);
    renderWizard(QUEUES, [], link);
    dropCsv(csv(2));

    // The file is in and the add step has decided where it would run.
    expect(await screen.findByText(/imported in your browser/)).toBeTruthy();

    release();
    await flush();

    // Still the add step, with the user's file — not someone else's job.
    expect(screen.getByText(/rows-2\.csv/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
    expect(screen.queryByText("earlier.csv")).toBeNull();
    expect(screen.queryByText("Running")).toBeNull();
  });

  it("offers no Back from a failed retry, because there is no review step behind it", async () => {
    // The card's Retry (and an adopted job) reach the run step without the
    // wizard's own steps: `csv` is null and `rows` is empty, so Back used to
    // land on a blank review grid showing "0 of 0".
    const refused: MockedResponse = {
      request: {
        query: START_IMPORT(CONTEXT_ID),
        variables: {
          input: {
            s3Key: REPORT_KEY,
            fileName: "earlier-errors.csv",
            access: STORED_ACCESS,
            options: { delimiter: "," },
          },
        },
      },
      error: new Error("IMPORT_ALREADY_RUNNING"),
    };

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ConfigContext.Provider value={QUEUES}>
          <MockedProvider mocks={[openProbe([]), refused]}>
            <ImportWizardDialog
              open
              onOpenChange={() => {}}
              context={context}
              retryJob={toImportJobView(FINISHED_ROW)}
            />
          </MockedProvider>
        </ConfigContext.Provider>
      </NextIntlClientProvider>,
    );

    expect(
      await screen.findByText(/An import is already running/),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    // Close stays the way out (the dialog's own × matches this name too).
    expect(
      screen.getAllByRole("button", { name: "Close" }).length,
    ).toBeGreaterThan(0);
  });

  it("opened with a retryJob (the Imports card's Retry action), retries immediately and lands on the run step", async () => {
    const startMock: MockedResponse = {
      request: {
        query: START_IMPORT(CONTEXT_ID),
        variables: {
          input: {
            s3Key: REPORT_KEY,
            fileName: "earlier-errors.csv",
            access: STORED_ACCESS,
            options: { delimiter: "," },
          },
        },
      },
      result: {
        data: { [`${CONTEXT_ID}_itemsStartImport`]: { jobResultId: "job-8" } },
      },
    };

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ConfigContext.Provider value={QUEUES}>
          <MockedProvider
            mocks={[openProbe([]), startMock, byIdPoll(RETRY_ROW)]}
          >
            <ImportWizardDialog
              open
              onOpenChange={() => {}}
              context={context}
              retryJob={toImportJobView(FINISHED_ROW)}
            />
          </MockedProvider>
        </ConfigContext.Provider>
      </NextIntlClientProvider>,
    );

    // Landed on the run step directly — no add-step dropzone, no mapping or
    // review step in between.
    expect(await screen.findByText("earlier-errors.csv")).toBeTruthy();
    expect(screen.queryByText("Import via CSV")).toBeNull();
  });
});
