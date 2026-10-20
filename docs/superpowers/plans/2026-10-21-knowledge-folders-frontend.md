# Knowledge Folders — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Knowledge page groups contexts into admin-managed folders: collapsible sections per folder plus "Ungrouped", a Manage-folders dialog and a per-row "Move to folder" action for super admins.

**Architecture:** Pure grouping/move/collapse helpers in `lib/knowledge/folders.ts`; gql documents on the generic `context_folders` CRUD; a `useContextFolders` hook; a `FolderSection` component and a `ManageFoldersDialog`; `context-library.tsx` renders sections when not searching; `LibraryRow` gains an optional move menu.

**Tech Stack:** Next.js/React, Apollo, shadcn/ui, next-intl, vitest (node by default; `// @vitest-environment jsdom` pragma + `@testing-library/react` for the component test).

**Spec:** `docs/superpowers/specs/2026-10-21-knowledge-folders-design.md`

## Global Constraints

- Folder shape from the API: `{ id, name, description, icon, sort_order, context_ids }` (`context_ids` is a JSON array; tolerate `null` and a JSON string by normalising to `string[]`).
- `groupContexts(rows, folders, ungroupedLabel)`: folders sorted by `sort_order` ascending then `name` (locale compare), each with its member rows in the list's existing order; a context listed in several folders appears only in the first; ids without a matching row are ignored; empty folders still appear; the `Ungrouped` section (id `null`) is last and only rendered when it has rows **or** there are no folders at all.
- `nextFoldersAfterMove(folders, contextId, target)` returns only changed folders, the **target first** (added), then every other folder that contained the id (removed); `target === null` = Ungrouped (removals only).
- Collapse state: `localStorage` key `knowledge.folders.collapsed`, JSON array of folder ids; read/write wrapped in try/catch; default expanded.
- Grouping only when `search === ""`; the search result stays a flat list.
- Super-admin gating: `userCtx.user.super_admin === true` (same as `canEditIcons`).
- i18n keys under `knowledge.library.folders.*` in both `messages/en.json` and `messages/de.json`; `npm run check-messages` passes.
- Existing behaviour (favourites card, icons, search, demo ids) unchanged; `npx vitest run` green; `npm run lint` green.
- Commit messages conventional (commitlint), one per task.

## Review Focus

1. A context id present in two folders renders once, in the first folder by sort order — test in Task 1 (`groupContexts`).
2. Moving a context to Ungrouped removes it from every folder and never adds — test in Task 1 (`nextFoldersAfterMove`).
3. Corrupt `localStorage` content must not break the page (default expanded) — test in Task 1 (`readCollapsed`).
4. With a search term, no section headers render — test in Task 3 (component test).
5. A non-admin never sees Manage folders or Move to folder — test in Task 3 (component test with `super_admin: false`).

---

### Task 1: Pure helpers

**Files:**
- Create: `lib/knowledge/folders.ts`
- Test: `lib/knowledge/folders.test.ts`

**Interfaces:**

```ts
export type Folder = { id: string; name: string; description?: string | null; icon?: string | null; sort_order?: number | null; context_ids: string[] };
export type FolderSection<R> = { id: string | null; name: string; icon?: string | null; rows: R[] };
export function normalizeFolder(raw: { id: string; name: string; description?: unknown; icon?: unknown; sort_order?: unknown; context_ids?: unknown }): Folder;
export function sortFolders(folders: Folder[]): Folder[];
export function groupContexts<R extends { id: string }>(rows: R[], folders: Folder[], ungroupedLabel: string): FolderSection<R>[];
export function nextFoldersAfterMove(folders: Folder[], contextId: string, targetFolderId: string | null): Array<{ id: string; context_ids: string[] }>;
export const COLLAPSED_STORAGE_KEY = "knowledge.folders.collapsed";
export function readCollapsed(storage: Pick<Storage, "getItem"> | null | undefined): Set<string>;
export function writeCollapsed(storage: Pick<Storage, "setItem"> | null | undefined, ids: Set<string>): void;
```

- [ ] **Step 1: Write the failing tests**

```ts
const rows = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
const f1 = { id: "f1", name: "Tenders", sort_order: 2, context_ids: ["b", "zzz"] };
const f2 = { id: "f2", name: "Products", sort_order: 1, context_ids: ["a", "b"] };
expect(sortFolders([f1, f2]).map((f) => f.id)).toEqual(["f2", "f1"]);
expect(groupContexts(rows, [f1, f2], "Ungrouped")).toEqual([
  { id: "f2", name: "Products", icon: undefined, rows: [{ id: "a" }, { id: "b" }] },     // b only here — Review Focus 1
  { id: "f1", name: "Tenders", icon: undefined, rows: [] },
  { id: null, name: "Ungrouped", icon: undefined, rows: [{ id: "c" }, { id: "d" }] },
]);
expect(groupContexts(rows, [], "Ungrouped")).toEqual([{ id: null, name: "Ungrouped", icon: undefined, rows }]);
expect(groupContexts([{ id: "a" }], [{ id: "f", name: "F", context_ids: ["a"] }], "U")).toEqual([{ id: "f", name: "F", icon: undefined, rows: [{ id: "a" }] }]); // no empty Ungrouped
expect(nextFoldersAfterMove([f1, f2], "b", "f1")).toEqual([{ id: "f1", context_ids: ["b", "zzz"] }, { id: "f2", context_ids: ["a"] }]);           // target first, already present → unchanged ids kept
expect(nextFoldersAfterMove([f1, f2], "c", "f1")).toEqual([{ id: "f1", context_ids: ["b", "zzz", "c"] }]);
expect(nextFoldersAfterMove([f1, f2], "b", null)).toEqual([{ id: "f1", context_ids: ["zzz"] }, { id: "f2", context_ids: ["a"] }]);               // Review Focus 2
expect(normalizeFolder({ id: "x", name: "N", context_ids: '["a","b"]', sort_order: "3" })).toEqual({ id: "x", name: "N", description: null, icon: null, sort_order: 3, context_ids: ["a", "b"] });
expect(normalizeFolder({ id: "x", name: "N", context_ids: null })).toEqual({ id: "x", name: "N", description: null, icon: null, sort_order: 0, context_ids: [] });
expect(readCollapsed({ getItem: () => "not json" })).toEqual(new Set());                 // Review Focus 3
expect(readCollapsed({ getItem: () => '["f1"]' })).toEqual(new Set(["f1"]));
expect(readCollapsed(null)).toEqual(new Set());
const store: Record<string, string> = {}; writeCollapsed({ setItem: (k, v) => { store[k] = v; } }, new Set(["f2"])); expect(store[COLLAPSED_STORAGE_KEY]).toBe('["f2"]');
expect(() => writeCollapsed({ setItem: () => { throw new Error("quota"); } }, new Set())).not.toThrow();
```

- [ ] **Step 2: Run to verify they fail** — `npx vitest run lib/knowledge` → FAIL
- [ ] **Step 3: Implement** — [ ] **Step 4: Run to verify they pass**
- [ ] **Step 5: Commit** — `git commit -m "feat(knowledge): folder grouping, move and collapse helpers"`

---

### Task 2: Queries and hook

**Files:**
- Modify: `app/(application)/data/queries.ts` (append), `app/(application)/data/hooks.ts` (append)
- Test: `app/(application)/data/folders-hook.test.ts` (pure parts only: the `moveContext` sequencing helper)

**Interfaces:**

```ts
// queries.ts — generic CRUD on context_folders (same style as the CONTEXT_ICONS documents)
export const CONTEXT_FOLDER_FIELDS = `id name description icon sort_order context_ids`;
export const GET_CONTEXT_FOLDERS = gql`query GetContextFolders { context_foldersPagination(page: 1, limit: 200, sort: { field: "sort_order", direction: "ASC" }) { items { ${CONTEXT_FOLDER_FIELDS} } } }`;
export const CREATE_CONTEXT_FOLDER = gql`mutation CreateContextFolder($input: context_folderInput!) { context_foldersCreateOne(input: $input) { item { ${CONTEXT_FOLDER_FIELDS} } } }`;
export const UPDATE_CONTEXT_FOLDER = gql`mutation UpdateContextFolder($id: ID!, $input: context_folderInput!) { context_foldersUpdateOneById(id: $id, input: $input) { ${CONTEXT_FOLDER_FIELDS} } }`;
export const DELETE_CONTEXT_FOLDER = gql`mutation DeleteContextFolder($id: ID!) { context_foldersRemoveOneById(id: $id) { id } }`;
// (verify the exact input type name and payload shapes against the generated schema the way the icons documents did; adjust if the generic names differ)
// hooks.ts
export function useContextFolders(): { folders: Folder[]; loading: boolean; error?: unknown; refetch: () => Promise<unknown>;
  createFolder: (input: { name: string; description?: string; icon?: string | null; sort_order?: number }) => Promise<void>;
  updateFolder: (id: string, input: Partial<{ name: string; description: string; icon: string | null; sort_order: number; context_ids: string[] }>) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  moveContext: (contextId: string, targetFolderId: string | null) => Promise<void> };   // applies nextFoldersAfterMove in order, awaiting each update, then refetch
export async function applyMoves(updates: Array<{ id: string; context_ids: string[] }>, update: (id: string, input: { context_ids: string[] }) => Promise<void>): Promise<void>; // sequential, in order; stops at the first failure (rethrows)
```

- [ ] **Step 1: Write the failing test** — `applyMoves` calls `update` sequentially in order; a throw on the second call leaves the first applied and rethrows.
- [ ] **Step 2: Run to verify it fails** — [ ] **Step 3: Implement queries + hook** — [ ] **Step 4: Run to verify it passes**
- [ ] **Step 5: Commit** — `git commit -m "feat(knowledge): context folder queries and hook"`

---

### Task 3: Sections, manage dialog, move menu, page wiring

**Files:**
- Create: `app/(application)/data/components/folder-section.tsx`, `app/(application)/data/components/manage-folders-dialog.tsx`
- Modify: `app/(application)/data/components/library-row.tsx` (optional `folders`, `onMoveToFolder`), `app/(application)/data/components/context-library.tsx`
- Test: `app/(application)/data/components/folder-section.test.tsx` (`// @vitest-environment jsdom`, `@testing-library/react`)

Behaviour: `FolderSection` = header row (icon via `ContextIcon` when set, name, count badge, chevron button toggling collapse with `aria-expanded`) + the existing `<ul>` of `LibraryRow`; collapsed sections render the header only. `context-library.tsx`: `useContextFolders()`; when `search === ""` render `groupContexts(rows, folders, t("library.folders.ungrouped"))` as sections inside the existing bordered container; when searching, the flat list as today; collapse state via `readCollapsed`/`writeCollapsed` on `window.localStorage`. Super admins get a **Manage folders** button next to the search (opens `ManageFoldersDialog`: list with name, description, icon (reuse `ContextIconPicker`), sort order; create, rename/edit, delete with confirm) and, on each `LibraryRow`, a "Move to folder…" dropdown (folders + Ungrouped) that calls `moveContext`. Errors → the page's standard error toast.

- [ ] **Step 1: Write the failing component test** — renders `FolderSection`s from a fixed grouping: two headers with counts; clicking a chevron hides its rows and flips `aria-expanded`; with `search="x"` no headers (Review Focus 4); with a non-admin user no "Manage folders" button and no move menu (Review Focus 5). Mock `useContextLibrary`/`useContextFolders`/`useContextIcons` and the `UserContext` value.
- [ ] **Step 2: Run to verify it fails** — `npx vitest run app/\(application\)/data/components/folder-section` → FAIL
- [ ] **Step 3: Implement** — [ ] **Step 4: Run the test, `npx vitest run`, `npm run lint`** → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(knowledge): folder sections, manage dialog and move-to-folder for admins"`

---

### Task 4: i18n

**Files:**
- Modify: `messages/en.json`, `messages/de.json` (`knowledge.library.folders.*`: `ungrouped`, `manage`, `title`, `new`, `name`, `description`, `icon`, `sortOrder`, `create`, `save`, `delete`, `deleteConfirm`, `moveTo`, `moveToUngrouped`, `empty`, `errorSave`, `errorLoad`, `count`)

- [ ] **Step 1: Add the keys (English and German)**
- [ ] **Step 2: Run `npm run check-messages` and `npx vitest run`** → PASS
- [ ] **Step 3: Commit** — `git commit -m "feat(knowledge): i18n for context folders"`
