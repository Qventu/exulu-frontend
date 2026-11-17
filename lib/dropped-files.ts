/**
 * The files of a drop, folders included.
 *
 * `dataTransfer.files` lists a dropped FOLDER as one unreadable zero-byte
 * entry, so a drop target that reads only that uploads nothing useful when
 * someone drags a folder in. This walks dropped folders through the entries
 * API and returns their files, flat.
 *
 * Without a folder in the drop it returns `dataTransfer.files` untouched, so
 * plain file drops behave exactly as before.
 *
 * MUST be called synchronously inside the drop handler: the item list is only
 * readable while the event is being dispatched. The entries are grabbed
 * before the first await for that reason.
 *
 * Flat on purpose: session and project folders hold one file per name, with
 * no sub-folders. Two files of the same name in different sub-folders reach
 * the uploader as two files and it reports the second as already present.
 */

/** Files an operating system puts into folders by itself; never worth uploading. */
const JUNK = new Set([".ds_store", "thumbs.db", "desktop.ini"]);

export function isFolderJunk(name: string): boolean {
  const lower = name.toLowerCase();
  // "~$Report.docx" is Office's lock file next to an open document.
  return JUNK.has(lower) || lower.startsWith("._") || lower.startsWith("~$");
}

type Entry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (ok: (file: File) => void, fail: (err: unknown) => void) => void;
  createReader?: () => {
    readEntries: (ok: (entries: Entry[]) => void, fail: (err: unknown) => void) => void;
  };
};

function walk(entry: Entry, out: File[]): Promise<void> {
  return new Promise((resolve) => {
    if (entry.isFile && entry.file) {
      entry.file(
        (file) => {
          if (!isFolderJunk(file.name)) out.push(file);
          resolve();
        },
        () => resolve(),
      );
      return;
    }
    if (entry.isDirectory && entry.createReader) {
      const reader = entry.createReader();
      // readEntries hands out a folder in batches (100 in Chromium) and
      // signals the end with an empty one.
      const readBatch = () => {
        reader.readEntries(
          (entries) => {
            if (entries.length === 0) {
              resolve();
              return;
            }
            void Promise.all(entries.map((child) => walk(child, out))).then(readBatch);
          },
          () => resolve(),
        );
      };
      readBatch();
      return;
    }
    resolve();
  });
}

export function filesFromDrop(dataTransfer: DataTransfer | null | undefined): Promise<File[]> {
  const plain = Array.from(dataTransfer?.files ?? []);
  const entries: Entry[] = [];
  for (const item of Array.from(dataTransfer?.items ?? [])) {
    const getEntry = (item as DataTransferItem & { webkitGetAsEntry?: () => unknown }).webkitGetAsEntry;
    const entry = typeof getEntry === "function" ? (getEntry.call(item) as Entry | null) : null;
    if (entry) entries.push(entry);
  }
  if (!entries.some((entry) => entry.isDirectory)) return Promise.resolve(plain);

  const out: File[] = [];
  return Promise.all(entries.map((entry) => walk(entry, out))).then(() => out);
}
