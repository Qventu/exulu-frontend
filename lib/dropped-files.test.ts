import { describe, expect, it } from "vitest";

import { filesFromDrop, isFolderJunk } from "./dropped-files";

const file = (name: string) => new File(["x"], name);

const fileEntry = (name: string) => ({
  isFile: true,
  isDirectory: false,
  name,
  file: (ok: (f: File) => void) => ok(file(name)),
});

/** A folder whose reader hands out `batches` one call at a time, then an empty batch. */
const dirEntry = (name: string, ...batches: unknown[][]) => ({
  isFile: false,
  isDirectory: true,
  name,
  createReader: () => {
    let i = 0;
    return { readEntries: (ok: (e: unknown[]) => void) => ok(batches[i++] ?? []) };
  },
});

const drop = (files: File[], entries: unknown[] | null) =>
  ({
    files,
    items: entries === null ? undefined : entries.map((entry) => ({ webkitGetAsEntry: () => entry })),
  }) as unknown as DataTransfer;

describe("filesFromDrop", () => {
  it("returns the plain files when no folder was dropped", async () => {
    const a = file("a.pdf");
    expect(await filesFromDrop(drop([a], [fileEntry("a.pdf")]))).toEqual([a]);
  });

  it("returns the plain files when the browser has no entries API", async () => {
    const a = file("a.pdf");
    expect(await filesFromDrop(drop([a], null))).toEqual([a]);
    expect(await filesFromDrop(null)).toEqual([]);
  });

  it("walks a dropped folder, nested folders and every reader batch", async () => {
    const folder = dirEntry(
      "Pitch",
      [fileEntry("briefing.pdf"), dirEntry("Anlagen", [fileEntry("plan.xlsx")])],
      [fileEntry("zweite-ladung.docx")],
    );
    // What the browser reports for a folder in `files`: one useless entry.
    const names = (await filesFromDrop(drop([file("Pitch")], [folder]))).map((f) => f.name).sort();
    expect(names).toEqual(["briefing.pdf", "plan.xlsx", "zweite-ladung.docx"]);
  });

  it("keeps loose files dropped next to a folder", async () => {
    const names = (
      await filesFromDrop(drop([], [fileEntry("lose.pdf"), dirEntry("Ordner", [fileEntry("drin.pdf")])]))
    )
      .map((f) => f.name)
      .sort();
    expect(names).toEqual(["drin.pdf", "lose.pdf"]);
  });

  it("leaves out what the operating system put into the folder", async () => {
    const folder = dirEntry("Pitch", [
      fileEntry(".DS_Store"),
      fileEntry("Thumbs.db"),
      fileEntry("._briefing.pdf"),
      fileEntry("~$briefing.docx"),
      fileEntry("briefing.docx"),
    ]);
    expect((await filesFromDrop(drop([], [folder]))).map((f) => f.name)).toEqual(["briefing.docx"]);
  });
});

describe("isFolderJunk", () => {
  it("does not treat an ordinary dot-prefixed or tilde name as junk", () => {
    expect(isFolderJunk(".env.example")).toBe(false);
    expect(isFolderJunk("~notes.txt")).toBe(false);
  });
});
