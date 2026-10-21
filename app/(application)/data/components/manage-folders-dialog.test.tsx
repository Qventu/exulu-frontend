// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Folder } from "@/lib/knowledge/folders";
import enMessages from "@/messages/en.json";

import { ManageFoldersDialog } from "./manage-folders-dialog";

/**
 * The admin dialog's own behaviour: what an edit sends, that a delete asks
 * first (it unassigns every context in the folder), and what the new-folder
 * form submits. The three writes are props — the hook that performs them is
 * tested with the rest of the data layer.
 */

const FOLDER: Folder = {
  id: "f1",
  name: "Tenders",
  description: "Everything we bid on",
  icon: "books",
  sort_order: 1,
  context_ids: ["c1", "c2"],
};

function renderDialog(
  overrides: {
    onCreate?: () => Promise<void>;
    onUpdate?: () => Promise<void>;
    onDelete?: () => Promise<void>;
  } = {},
) {
  const handlers = {
    onCreate: overrides.onCreate ?? vi.fn().mockResolvedValue(undefined),
    onUpdate: overrides.onUpdate ?? vi.fn().mockResolvedValue(undefined),
    onDelete: overrides.onDelete ?? vi.fn().mockResolvedValue(undefined),
  };

  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ManageFoldersDialog
        open
        onOpenChange={vi.fn()}
        folders={[FOLDER]}
        {...handlers}
      />
    </NextIntlClientProvider>,
  );

  return handlers;
}

/** The row for the single existing folder (the create form is its own region). */
function folderRow() {
  return within(screen.getByRole("listitem"));
}

/** The "New folder" form region. */
function createForm() {
  return within(screen.getByRole("form", { name: "New folder" }));
}

describe("ManageFoldersDialog", () => {
  afterEach(cleanup);

  it("sends the edited fields when a folder is saved", async () => {
    const { onUpdate } = renderDialog();
    const row = folderRow();

    fireEvent.change(row.getByLabelText("Name"), { target: { value: "Bids" } });
    fireEvent.change(row.getByLabelText("Sort order"), {
      target: { value: "4" },
    });
    fireEvent.click(row.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith("f1", {
        name: "Bids",
        description: "Everything we bid on",
        icon: "books",
        sort_order: 4,
      }),
    );
  });

  it("leaves Save unavailable until something changes", () => {
    renderDialog();

    expect(
      (folderRow().getByRole("button", { name: "Save" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("asks before deleting a folder", async () => {
    const { onDelete } = renderDialog();

    fireEvent.click(folderRow().getByRole("button", { name: "Delete" }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(
      folderRow().getByText(
        "Delete this folder? Its contexts move to Ungrouped.",
      ),
    ).toBeTruthy();

    fireEvent.click(folderRow().getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("f1"));
  });

  it("drops the delete confirmation when it is cancelled", () => {
    const { onDelete } = renderDialog();

    fireEvent.click(folderRow().getByRole("button", { name: "Delete" }));
    fireEvent.click(folderRow().getByRole("button", { name: "Cancel" }));

    expect(
      folderRow().queryByText(
        "Delete this folder? Its contexts move to Ungrouped.",
      ),
    ).toBeNull();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("creates a folder from the new-folder form and clears it", async () => {
    const { onCreate } = renderDialog();
    const form = createForm();

    expect(
      (form.getByRole("button", { name: "Create folder" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fireEvent.change(form.getByLabelText("Name"), {
      target: { value: "Products" },
    });
    fireEvent.change(form.getByLabelText("Sort order"), {
      target: { value: "3" },
    });
    fireEvent.click(form.getByRole("button", { name: "Create folder" }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith({
        name: "Products",
        description: "",
        icon: null,
        sort_order: 3,
      }),
    );
    await waitFor(() =>
      expect(
        (createForm().getByLabelText("Name") as HTMLInputElement).value,
      ).toBe(""),
    );
  });
});
