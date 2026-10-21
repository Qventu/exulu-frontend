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
 * which jsdom does implement.
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
import { afterEach, describe, expect, it } from "vitest";

import {
  ConfigContext,
  type ConfigContextType,
} from "@/components/shell/config-context";
import {
  GET_IMPORT_JOBS,
  importJobByIdFilters,
  importJobFilters,
} from "@/lib/api/imports";
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
) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ConfigContext.Provider value={config}>
        <MockedProvider mocks={mocks}>
          <ImportWizardDialog open onOpenChange={() => {}} context={context} />
        </MockedProvider>
      </ConfigContext.Provider>
    </NextIntlClientProvider>,
  );
}

function csv(rows: number): File {
  const text =
    "name,title\n" +
    Array.from({ length: rows }, (_, i) => `Item ${i},T${i}`).join("\n") +
    "\n";
  return new File([text], `rows-${rows}.csv`, { type: "text/csv" });
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

    expect(await screen.findByText(/imported in the background/)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("refuses a large CSV and disables Continue without the queues licence", async () => {
    renderWizard(NO_QUEUES);
    dropCsv(csv(201));

    expect(
      await screen.findByText(/too many for a browser import/),
    ).toBeTruthy();
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement)
          .disabled,
      ).toBe(true),
    );
  });

  it("opens on the run step when an import is already running for the context", async () => {
    renderWizard(QUEUES, [openProbe([RUNNING_ROW]), byIdPoll(RUNNING_ROW)]);

    expect(await screen.findByText("earlier.csv")).toBeTruthy();
    expect(screen.getByText("Running")).toBeTruthy();
  });
});
