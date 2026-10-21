// @vitest-environment jsdom
/**
 * StepReviewGrid's two modes. The client flow edits rows in place; a server
 * import never does — the grid is a read-only preview of the sampled rows,
 * because the file the worker reads is the uploaded one, not what the grid
 * holds. An editable cell there would silently throw the edit away.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { autoMapColumns } from "@/lib/import/map-columns";
import { parseCsvText } from "@/lib/import/parse-csv";
import { rowsFromCsv, validateRow } from "@/lib/import/rows";
import type { ImportField } from "@/lib/import/types";
import enMessages from "@/messages/en.json";

import { StepReviewGrid } from "./step-review-grid";

const FIELDS: ImportField[] = [
  {
    name: "name",
    label: "name",
    type: "shortText",
    required: true,
    core: true,
  },
  {
    name: "description",
    label: "description",
    type: "longText",
    required: false,
    core: true,
  },
];

const parsed = parseCsvText("name,description\nAlpha,first\nBeta,second\n");
const rows = rowsFromCsv(
  parsed,
  autoMapColumns(parsed.headers, FIELDS),
  FIELDS,
).map((r) => validateRow(r, FIELDS));

function renderGrid(readOnly: boolean) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepReviewGrid
        fields={FIELDS}
        displayFields={FIELDS}
        rows={rows}
        running={false}
        finished={false}
        rowStates={{}}
        batchAccessMode="private"
        readOnly={readOnly}
        onCellChange={vi.fn()}
        onKeyCellBlur={vi.fn()}
        onRemoveRow={vi.fn()}
      />
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);

describe("StepReviewGrid", () => {
  it("edits cells in the client flow", () => {
    renderGrid(false);

    expect(screen.getAllByRole("textbox")).toHaveLength(4);
    expect(screen.getAllByRole("button", { name: "Remove row" })).toHaveLength(
      2,
    );
  });

  it("is a read-only preview in server mode", () => {
    renderGrid(true);

    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(
      screen.queryAllByRole("button", { name: "Remove row" }),
    ).toHaveLength(0);
    // The sampled values are still legible, just not editable.
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText("second")).toBeTruthy();
  });
});
