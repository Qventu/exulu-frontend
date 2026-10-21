// @vitest-environment jsdom
/**
 * ImportJobRow — the presentational display of one server-side import job
 * (state badge, progress, counters, metadata, error text, and its Download/
 * Retry/Cancel actions with the cancel confirm dialog), shared by the
 * Pipeline tab's Imports card and the wizard's run step (fix round 1 / F3 —
 * this used to be ~120 duplicated lines in each).
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  toImportJobView,
  type ImportJobRow as JobRow,
} from "@/lib/import/job-view";
import enMessages from "@/messages/en.json";

import { ImportJobRow } from "./import-job-row";

const RUNNING: JobRow = {
  id: "job-1",
  label: "big.csv",
  state: "active",
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
};

const DONE_WITH_REPORT: JobRow = {
  ...RUNNING,
  state: "completed",
  metadata: null,
  result: JSON.stringify({
    total: 10,
    processed: 10,
    created: 9,
    updated: 0,
    failed: 1,
    invalid: 0,
    durationMs: 4200,
    errorReportKey: "bucket/imports/ctx_1/job-1-errors.csv",
  }),
};

function withProviders(ui: React.ReactElement) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

afterEach(cleanup);

describe("ImportJobRow", () => {
  it("renders the file name, badge, progress and counters", () => {
    render(
      withProviders(
        <ImportJobRow view={toImportJobView(RUNNING)} canCancel={false} />,
      ),
    );

    expect(screen.getByText("big.csv")).toBeTruthy();
    expect(screen.getByText("Running")).toBeTruthy();
    expect(screen.getByRole("progressbar")).toBeTruthy();
    expect(screen.getByText(/250 of 1,?000 rows processed/)).toBeTruthy();
    expect(
      screen.getByText(/200 created, 50 updated, 0 failed, 0 invalid/),
    ).toBeTruthy();
  });

  it('shows the started-by line only with layout "card"', () => {
    const view = toImportJobView(RUNNING);

    render(
      withProviders(
        <ImportJobRow view={view} canCancel={false} layout="card" />,
      ),
    );
    expect(screen.getByText(/Started by user 7/)).toBeTruthy();
    cleanup();

    render(
      withProviders(
        <ImportJobRow view={view} canCancel={false} layout="step" />,
      ),
    );
    expect(screen.queryByText(/Started by user 7/)).toBeNull();
  });

  it("shows Download only with an error report, and Retry only when the view allows it", () => {
    render(
      withProviders(
        <ImportJobRow view={toImportJobView(RUNNING)} canCancel={false} />,
      ),
    );
    expect(
      screen.queryByRole("button", { name: "Download error report" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Retry failed rows" }),
    ).toBeNull();
    cleanup();

    render(
      withProviders(
        <ImportJobRow
          view={toImportJobView(DONE_WITH_REPORT)}
          canCancel={false}
        />,
      ),
    );
    expect(
      screen.getByRole("button", { name: "Download error report" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Retry failed rows" }),
    ).toBeTruthy();
  });

  it("shows Cancel only while running AND canCancel is true", () => {
    render(
      withProviders(
        <ImportJobRow view={toImportJobView(RUNNING)} canCancel={false} />,
      ),
    );
    expect(screen.queryByRole("button", { name: "Cancel import" })).toBeNull();
    cleanup();

    render(
      withProviders(
        <ImportJobRow view={toImportJobView(RUNNING)} canCancel={true} />,
      ),
    );
    expect(screen.getByRole("button", { name: "Cancel import" })).toBeTruthy();
    cleanup();

    // Not running — even an allowed canCancel gets no button.
    render(
      withProviders(
        <ImportJobRow
          view={toImportJobView(DONE_WITH_REPORT)}
          canCancel={true}
        />,
      ),
    );
    expect(screen.queryByRole("button", { name: "Cancel import" })).toBeNull();
  });

  it("confirms before calling onCancel, with the job's id", () => {
    const onCancel = vi.fn();
    render(
      withProviders(
        <ImportJobRow
          view={toImportJobView(RUNNING)}
          canCancel={true}
          onCancel={onCancel}
        />,
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel import" }));
    expect(onCancel).not.toHaveBeenCalled();
    const actions = screen.getAllByRole("button", { name: "Cancel import" });
    fireEvent.click(actions[actions.length - 1]);

    expect(onCancel).toHaveBeenCalledWith("job-1");
  });

  it("calls onDownload with the error report key and onRetry with the view", () => {
    const onDownload = vi.fn();
    const onRetry = vi.fn();
    const view = toImportJobView(DONE_WITH_REPORT);
    render(
      withProviders(
        <ImportJobRow
          view={view}
          canCancel={false}
          onDownload={onDownload}
          onRetry={onRetry}
        />,
      ),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Download error report" }),
    );
    expect(onDownload).toHaveBeenCalledWith(view.errorReportKey);

    fireEvent.click(screen.getByRole("button", { name: "Retry failed rows" }));
    expect(onRetry).toHaveBeenCalledWith(view);
  });

  it("disables Download/Retry/Cancel per the busy flags", () => {
    render(
      withProviders(
        <ImportJobRow
          view={toImportJobView(DONE_WITH_REPORT)}
          canCancel={false}
          busy={{ downloading: true, starting: true }}
        />,
      ),
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Download error report",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Retry failed rows",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    cleanup();

    render(
      withProviders(
        <ImportJobRow
          view={toImportJobView(RUNNING)}
          canCancel={true}
          busy={{ cancelling: true }}
        />,
      ),
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Cancel import",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("renders a passed hint between the row's metadata and its actions", () => {
    render(
      withProviders(
        <ImportJobRow
          view={toImportJobView(RUNNING)}
          canCancel={false}
          hint={<p>keeps running in the background</p>}
        />,
      ),
    );
    expect(screen.getByText("keeps running in the background")).toBeTruthy();
  });
});
