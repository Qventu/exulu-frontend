# Knowledge-base folders — design

**Status:** 2026-10-21, builder-checked (write gating via apiWrites, fail-safe move order); written autonomously on the operator's instruction ("fully
implement without asking"); every decision below is the author's call and is listed
again in the hand-over for review.
**Date:** 2026-10-21
**Author:** Claude Fable 5.1 for daniel.claessen
**Repos:** `exulu/frontend` (UI) and `exulu/backend` (one core table + write gating).

## Purpose

The Knowledge page lists every context in one flat list. Customers now run many
knowledge bases, and the list stops being navigable. Admins should be able to group
contexts into **folders** ("Tenders", "Products", …) so the page shows a few named
groups instead of one long list. Folders are a UI organisation feature only: they do
not change retrieval, access, or the contexts themselves.

## Facts (read 2026-10-21)

| Area | Fact |
|---|---|
| List UI | `app/(application)/data/components/context-library.tsx` renders `rows` from `useContextLibrary({ search })` (`hooks.ts`) as one `<ul>` of `LibraryRow` (`library-row.tsx`, props `row, icon, canEdit, onSetIcon, index`); favourites/recents card above the list; search is a local filter |
| Admin precedent | Context icons: one `platform_configurations` row (`config_key: "knowledge_context_icons"`, `config_value` JSON), read by everyone, edited only when `userCtx.user.super_admin === true` (`canEditIcons`), through `GET/CREATE/UPDATE_CONTEXT_ICONS` in `data/queries.ts` and `useContextIcons` in `hooks.ts` |
| Core tables | `backend/src/postgres/core-schema.ts` declares core tables (`context_presets`, `platform_configurations`, …); `init-exulu-db.ts` creates missing tables on boot (`createTable(schema)`); core tables get the generic GraphQL CRUD (`<plural>Pagination`, `<plural>CreateOne`, `<plural>UpdateOneById`, `<plural>RemoveOneById`) — the icons feature uses exactly that on `platform_configurations` |
| Write gating | `validateWriteAccess` (`backend/src/graphql/mutations/index.ts:325`) gates a fixed list of core tables by role area; tables not in the list and without RBAC are writable by any authenticated user |
| Rights | Frontend `lib/rights.ts` (`can(user, requirement)`, `"super_admin"` requirement); `UserContext` exposes `user.super_admin` |
| i18n | `messages/en.json` + `de.json`, namespace `knowledge.library.*`; parity check in CI |
| Tests | vitest, node environment by default (`// @vitest-environment jsdom` pragma for DOM tests), `@testing-library/react` available; no component tests under `data/components` today, pure helpers are tested (`pin-utils.test.ts`) |

## Scope

**In scope**

- Backend: core table `context_folders` (fields below), created on boot like the other
  core tables; writes restricted to super admins in `validateWriteAccess`.
- Frontend: the Knowledge page groups contexts by folder (collapsible sections, an
  "Ungrouped" section last), remembers collapsed sections per browser; admins create,
  rename, reorder (by number) and delete folders and move a context into a folder from
  the row; everyone else sees the grouping read-only.
- i18n (en/de), tests for the grouping logic and the admin dialog logic, a short entry
  in the frontend's docs if a knowledge page doc exists.

**Out of scope**

- Nested folders, drag-and-drop ordering, per-user folders, folder-level permissions,
  folders anywhere else than the Knowledge page (agent context pickers stay flat).
- Backend behaviour of any kind beyond storing folders (no retrieval, no access impact).

## Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Storage: a core table `context_folders` with `name` (text, required, index), `description` (text), `icon` (text, optional, same icon names as context icons), `sort_order` (number, default 0), `context_ids` (json, required, array of context ids). One row per folder; a context belongs to at most one folder by convention: `moveContext` adds it to the target folder **first**, then removes it from every other folder (two generic updates, fail-safe order), and `groupContexts` renders a context only in the first folder (by sort order) that lists it, so a transient or failed second write never shows a context twice or loses it. No RBAC. | The operator asked for a table in `core-schema.ts`. Membership on the folder row keeps it to one table and the generic CRUD; without a custom resolver there is no multi-row transaction, so the order of the two writes is the safety net (the worst case is a context listed in two folders until the next move, never an orphaned one). |
| D2 | Writes to `context_folders` require `super_admin` through the table definition's existing `apiWrites: "super_admin"` (as `shared_artifacts` uses it), which the generic resolvers enforce for `CreateOne`, `UpdateOne(ById)`, `RemoveOne(ById)`, `CopyOneById` and `BulkUpdateRBAC`; reads stay open to every authenticated user. | Admins organise, everyone benefits. `validateWriteAccess` would not cover `CreateOne`; `apiWrites` is the purpose-built, tested guard (`api-writes-guard.test.ts`). |
| D3 | The generic core-table GraphQL CRUD is used as is (`context_foldersPagination`, `context_foldersCreateOne`, `context_foldersUpdateOneById`, `context_foldersRemoveOneById`); no custom resolvers. | Same mechanics as icons; nothing new in the schema layer. |
| D4 | Grouping is computed in the client: `groupContexts(rows, folders)` returns folder sections (sorted by `sort_order`, then name) with their member rows (in the list's existing order), followed by `Ungrouped` with the rest; a folder with no existing members still renders (admins see it to fill it); context ids that no longer exist are ignored. | Pure, testable, no backend change for grouping. |
| D5 | While a search term is set the list stays flat (as today); grouping applies only to the unfiltered list. | Search is a lookup; folders are browsing. |
| D6 | Section collapse state is per browser in `localStorage` (`knowledge.folders.collapsed`: folder ids), default expanded; errors reading storage are ignored. | Cheap, matches the page's other per-browser conveniences; no backend state. |
| D7 | Admin UI: a **Manage folders** button (super admin only) opens a dialog listing folders with name, description, icon, sort order; create / rename / delete (delete only unassigns, contexts fall back to Ungrouped). On every `LibraryRow` a super admin gets a "Move to folder…" item (dropdown of folders + "Ungrouped"). | Covers the use case with two surfaces: one for folders, one for assignment; no drag-and-drop. |
| D8 | Mutations are optimistic-free: each change awaits its mutation(s) and refetches `context_foldersPagination`; a failure shows the page's standard error toast and the list re-renders from the refetched server state (which, by D1's write order, is at worst "in two folders" and self-heals on the next move). | Low frequency admin actions; simplicity over latency. |
| D9 | The favourites/recents card and the stats stay where they are; sections render below them inside the existing bordered container, one `<ul>` per section with a header row (icon, name, count, chevron). | Minimal change to the page's layout; existing demo ids (`data-demo-id="knowledge-contexts"`) stay on the container. |
| D10 | i18n keys under `knowledge.library.folders.*` (title, ungrouped, manage, new, rename, delete, deleteConfirm, moveTo, moveToUngrouped, sortOrder, empty, saved/error copy). | Repo rule. |
| D11 | Tests: `lib/knowledge/folders.ts` (pure: `groupContexts`, `nextFoldersAfterMove`, `sortFolders`, collapse-state helpers) with vitest in node; one jsdom component test for the sections (headers, counts, collapse toggle); the manage dialog's reducer/helpers tested as pure functions. | Same pattern as `pin-utils.ts`. |

## Components

### Backend (`exulu/backend`)

- `src/postgres/core-schema.ts`: add the `context_folders` schema (`type: "context_folders"`, `name: { plural: "context_folders", singular: "context_folder" }`, fields per D1, `RBAC: false`).
- `src/postgres/core-schema.ts`: the schema carries `apiWrites: "super_admin"` (D2); no resolver changes.
- Tests: `core-schema.test.ts` (table present with the fields and `apiWrites`), and the existing `api-writes-guard.test.ts` pattern extended with `context_folders` if it enumerates tables.

### Frontend (`exulu/frontend`)

- `lib/knowledge/folders.ts` (pure) + `folders.test.ts`:
  ```ts
  export type Folder = { id: string; name: string; description?: string | null; icon?: string | null; sort_order?: number | null; context_ids: string[] };
  export type FolderSection<R> = { id: string | null; name: string; icon?: string | null; rows: R[] };
  export function sortFolders(folders: Folder[]): Folder[];
  export function groupContexts<R extends { id: string }>(rows: R[], folders: Folder[], ungroupedLabel: string): FolderSection<R>[]; // a context listed in several folders renders only in the first by sort order
  export function nextFoldersAfterMove(folders: Folder[], contextId: string, targetFolderId: string | null): Array<{ id: string; context_ids: string[] }>; // only the folders whose membership changes, target folder FIRST (D1 write order)
  export function readCollapsed(storage: Pick<Storage, "getItem">): Set<string>; export function writeCollapsed(storage: Pick<Storage, "setItem">, ids: Set<string>): void;
  ```
- `app/(application)/data/queries.ts`: `GET_CONTEXT_FOLDERS`, `CREATE_CONTEXT_FOLDER`, `UPDATE_CONTEXT_FOLDER`, `DELETE_CONTEXT_FOLDER` on the generic CRUD.
- `app/(application)/data/hooks.ts`: `useContextFolders()` → `{ folders, loading, createFolder, updateFolder, deleteFolder, moveContext, refetch }`.
- `app/(application)/data/components/folder-section.tsx` (header + collapsible `<ul>` of `LibraryRow`), `manage-folders-dialog.tsx` (super admin), `library-row.tsx` gains optional `folders`/`onMoveToFolder` props rendering the "Move to folder…" menu when `canEdit`.
- `context-library.tsx`: uses `groupContexts` when `search === ""`, renders sections; `Manage folders` button next to the search for super admins.
- `messages/en.json`, `messages/de.json`.

## Left to the builder

- Exact dialog layout (shadcn `Dialog`, `Input`, `Select`), icon picker reuse (`ContextIconPicker`) for folder icons.
- Whether `LibraryRow`'s existing icon menu and the new move menu share one dropdown.
- Error toast wording.
