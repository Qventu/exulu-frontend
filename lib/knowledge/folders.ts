/**
 * Pure helpers for the knowledge-base folder tree.
 *
 * Kept free of React/Apollo imports so the admin-managed grouping logic —
 * normalising API rows, sorting, grouping contexts into sections, computing
 * the folder updates for a move, and the per-browser collapse state — is
 * unit-testable in isolation (the Knowledge page hook consumes these).
 */

/** An admin-managed knowledge-base folder, normalised for client use. */
export type Folder = {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  sort_order?: number | null;
  context_ids: string[];
};

/** A rendered section of the Knowledge page: a folder's rows, or Ungrouped. */
export type FolderSection<R> = {
  id: string | null;
  name: string;
  icon?: string | null;
  rows: R[];
};

/** Coerce an unknown `sort_order` to a finite number, defaulting to 0. */
function normalizeSortOrder(value: unknown): number {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Coerce an unknown `context_ids` value (array, JSON-encoded string, or
 * missing/corrupt) to a clean array of string ids.
 */
function normalizeContextIds(value: unknown): string[] {
  let parsed: unknown = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((id): id is string => typeof id === "string");
}

/**
 * Normalise a raw folder row from the API (fields may arrive as strings,
 * JSON-encoded, or missing) into a {@link Folder} the rest of this module
 * can rely on.
 */
export function normalizeFolder(raw: {
  id: string;
  name: string;
  description?: unknown;
  icon?: unknown;
  sort_order?: unknown;
  context_ids?: unknown;
}): Folder {
  return {
    id: raw.id,
    name: raw.name,
    description: typeof raw.description === "string" ? raw.description : null,
    icon: typeof raw.icon === "string" ? raw.icon : null,
    sort_order: normalizeSortOrder(raw.sort_order),
    context_ids: normalizeContextIds(raw.context_ids),
  };
}

/** Folders in display order: ascending `sort_order` (missing ⇒ 0); stable on ties. */
export function sortFolders(folders: Folder[]): Folder[] {
  return [...folders].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

/**
 * Group rows into folder sections, in {@link sortFolders} order, followed
 * by an "Ungrouped" section for rows that belong to no folder.
 *
 * A row listed in several folders' `context_ids` is assigned only to the
 * first one by sort order — later folders and Ungrouped never repeat it.
 * Ungrouped is included only when it has rows, or when there are no
 * folders at all (so a brand-new knowledge base still renders something).
 */
export function groupContexts<R extends { id: string }>(
  rows: R[],
  folders: Folder[],
  ungroupedLabel: string,
): FolderSection<R>[] {
  const assigned = new Set<string>();

  const sections: FolderSection<R>[] = sortFolders(folders).map((folder) => {
    const memberIds = new Set(folder.context_ids);
    const folderRows = rows.filter((row) => {
      if (assigned.has(row.id) || !memberIds.has(row.id)) return false;
      assigned.add(row.id);
      return true;
    });
    return {
      id: folder.id,
      name: folder.name,
      icon: folder.icon,
      rows: folderRows,
    };
  });

  const ungroupedRows = rows.filter((row) => !assigned.has(row.id));
  if (ungroupedRows.length > 0 || folders.length === 0) {
    sections.push({
      id: null,
      name: ungroupedLabel,
      icon: undefined,
      rows: ungroupedRows,
    });
  }

  return sections;
}

/**
 * Compute the folder updates needed to move a context to `targetFolderId`
 * (or to Ungrouped, when `null`).
 *
 * Returns only the folders whose `context_ids` the caller needs to persist:
 * the target folder first (with the context added, or already present),
 * then every other folder that currently holds the context (with it
 * removed) — in their original relative order. A `null` target adds no
 * entry (Ungrouped isn't a real folder) and simply removes the context from
 * every folder that held it.
 */
export function nextFoldersAfterMove(
  folders: Folder[],
  contextId: string,
  targetFolderId: string | null,
): Array<{ id: string; context_ids: string[] }> {
  const result: Array<{ id: string; context_ids: string[] }> = [];

  if (targetFolderId !== null) {
    const target = folders.find((folder) => folder.id === targetFolderId);
    if (target) {
      const context_ids = target.context_ids.includes(contextId)
        ? [...target.context_ids]
        : [...target.context_ids, contextId];
      result.push({ id: target.id, context_ids });
    }
  }

  for (const folder of folders) {
    if (folder.id === targetFolderId) continue;
    if (folder.context_ids.includes(contextId)) {
      result.push({
        id: folder.id,
        context_ids: folder.context_ids.filter((id) => id !== contextId),
      });
    }
  }

  return result;
}

/** localStorage key for the set of collapsed folder ids (per browser). */
export const COLLAPSED_STORAGE_KEY = "knowledge.folders.collapsed";

/**
 * Read the collapsed-folder-id set from storage. Missing storage, a missing
 * key, corrupt JSON, a non-array payload, or a storage read error (e.g.
 * privacy mode) all fall back to an empty set rather than throwing.
 */
export function readCollapsed(
  storage: Pick<Storage, "getItem"> | null | undefined,
): Set<string> {
  if (!storage) return new Set();
  try {
    const raw = storage.getItem(COLLAPSED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

/**
 * Persist the collapsed-folder-id set to storage. Missing storage or a
 * storage write error (e.g. quota exceeded) is swallowed — collapse state
 * is a per-browser convenience, never a correctness requirement.
 */
export function writeCollapsed(
  storage: Pick<Storage, "setItem"> | null | undefined,
  ids: Set<string>,
): void {
  if (!storage) return;
  try {
    storage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Swallow — see doc comment above.
  }
}
