# Bulk Import: Batch Access (rights mode) — Design

**Date:** 2026-07-21
**Status:** Approved
**Repos:** frontend (`main`), backend (`develop`)

## Problem

The knowledge-base bulk import wizard (`app/(application)/data/[ctx]/components/import/`)
creates every item private. There is no way to import a batch that is shared
with a team, specific users/roles, or public — users must open each imported
item afterwards and change its access individually.

Root cause on the backend: the generic `CreateOne` resolver
(`backend/src/graphql/mutations/index.ts`, insert call currently at line 528)
force-inserts `rights_mode: "private"` for every RBAC table, overriding both
client input and the items table's `defaultRightsMode` column default. RBAC
grant rows (users/roles/teams) sent via `input.RBAC` *are* stored via
`handleRBACUpdate` — only the mode itself is discarded.

## Decisions (from brainstorming)

1. **Scope:** full sharing control — reuse the existing `RBACControl`
   (mode + user/role/team grants with read/write), not a mode-only select.
2. **Update rows:** the batch access applies to **created items only**. Rows
   classified as updates (matched by id/external_id) keep their existing
   access untouched.
3. **Backend:** small backend change — `CreateOne` honors an explicitly
   provided, validated `input.rights_mode`. No create-then-update workaround.
4. **Placement:** review step footer — compact "Access" trigger next to the
   Import button, opening the full `RBACControl`.
5. **Approach:** batch-level access merged at the runner's create boundary
   (Approach A). Per-row rights columns (Approach B) rejected as
   disproportionate; grants don't fit CSV cells.

## Backend change

File: `backend/src/graphql/mutations/index.ts` (`createMutations` →
`${tableNamePlural}CreateOne`).

Replace the unconditional `...(table.RBAC ? { rights_mode: "private" } : {})`
spread with:

- `input.rights_mode` present and one of
  `private | users | roles | teams | public` → use it.
- Present but invalid → throw a GraphQL error (no silent fallback).
- Absent → insert `rights_mode: "private"`, exactly as today.

Untouched on purpose:

- `CopyOneById` keeps forcing private — deliberate "copies start private"
  semantics.
- Grant handling: `handleRBACUpdate` already runs after insert with
  users/roles/teams from `input.RBAC`; no change needed.

Accepted side effect (latent bug fix): existing create callers that already
send a real `rights_mode` — notably the chat save-preset modal
(`context_presetsCreateOne`) — start working as their UI promises. Today they
end up `private` with orphaned grant rows. All other audited callers send
`"private"` explicitly or omit the field, so their behavior is unchanged.

**Non-goal:** when `rights_mode` is absent we still force `"private"` rather
than letting the column's `defaultRightsMode` default apply. Making
`defaultRightsMode` effective for all GraphQL create paths (e.g. the
single-item new-item dialog) is a separate follow-up decision; this feature
does not depend on it because the wizard always sends the mode explicitly.

## Frontend change

### State & data flow

- `ImportWizardDialog` owns a `batchAccess` state:
  `{ rights_mode, users, roles, teams }` (same shape as `RbacState` in
  `use-item-editor.ts`).
  - Initialized to `context.configuration.defaultRightsMode ?? "private"`
    with empty grants; reset on dialog (re)open.
- `batchAccess` is passed to `useImportRunner`. Its `createItem` effect merges
  it into the input produced by `buildCreateInput`:
  - always: `rights_mode`;
  - only when mode is `users | roles | teams`:
    `RBAC: { users, roles, teams }`.
- The merge is extracted as a pure helper `mergeBatchAccess(input, access)` in
  `lib/import/rows.ts` so it is unit-testable.
- Unchanged: `buildCreateInput`, `buildUpdateInput`, `runImport`, and the
  entire update path — `lib/import` stays access-agnostic apart from the pure
  helper; the merge is applied only at the runner's create boundary.
- Retry semantics: "retry failed rows" re-runs with the same `batchAccess`.

### UI (review step)

- Footer, edit phase only, left of the Import button: an `outline` button with
  a lock icon and the current mode label (e.g. "Access: Private"), opening a
  popover hosting the existing `RBACControl`:
  - `subjectLabel` set to the imported-items wording (i18n),
  - `modalMode` enabled for correct nested-portal focus behavior,
  - fallback only if popover focus proves broken in practice: a small nested
    dialog, as in `save-preset-modal.tsx`.
- Hidden while the run is in progress and in the done phase.
- When the batch contains update rows and the chosen mode ≠ private, show a
  one-line muted hint: "Applies to newly created items only."
- New i18n strings (en + de) under the existing
  `knowledge.workspace.import` namespace.

### Error handling

Nothing new per row: a backend-rejected `rights_mode` surfaces through the
existing per-row failure path (row marked failed, message in the error report
CSV). No client-side validation beyond what `RBACControl` enforces.

## Testing

- **Backend** (pattern of
  `backend/src/graphql/mutations/validate-write-access.test.ts`):
  - explicit valid `rights_mode` is persisted on create;
  - invalid `rights_mode` throws;
  - absent `rights_mode` still lands `private`.
- **Frontend** (existing `lib/import/*.test.ts` style):
  - `mergeBatchAccess`: mode-only merge (private/public → no `RBAC` key),
    with-grants merge (users/roles/teams), input fields preserved;
  - runner-level: update rows never receive `rights_mode`/`RBAC`.

## Out of scope

- Per-row rights columns in the CSV mapping.
- Applying batch access to update rows (decided against; a per-run toggle can
  be a later addition).
- Honoring `defaultRightsMode` when `rights_mode` is absent on create
  (follow-up, see backend non-goal).
- The existing quirk that the item editor's update path omits team grants
  (`use-item-editor.ts` sends only users/roles) — pre-existing, separate.
