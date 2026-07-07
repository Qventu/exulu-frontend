# Context Preset Management — Edit & Delete

**Date:** 2026-07-07
**Status:** Approved
**Scope:** Frontend only. All required GraphQL mutations already exist in the backend.

## Problem

The "Browse contexts and items, or load a saved preset" modal
(`components/items-selection-modal.tsx`) lets users create and load context
presets, but offers no way to delete a preset or edit an existing one. The
API layer already has `DELETE_CONTEXT_PRESET` (unused by any UI) and
`UPDATE_CONTEXT_PRESET` (used only by `SavePresetModal`'s never-triggered edit
mode), so this is purely a missing-UI problem.

Additionally, once a preset is applied its identity is discarded — items are
merged into the chat session anonymously — so there is no way to edit a
preset's *contents* through the UI users already know.

## Current state (verified)

- `queries/queries.ts:2845-2919` — `CREATE_CONTEXT_PRESET`,
  `UPDATE_CONTEXT_PRESET`, `DELETE_CONTEXT_PRESET`, `INCREMENT_PRESET_USAGE`
  all exist. Delete is referenced nowhere in the UI.
- `app/(application)/chat/components/save-preset-modal.tsx` — supports full
  edit mode via optional `existingPreset` prop (name, description, tags,
  sharing/RBAC), but no caller ever passes it.
- `components/items-selection-modal.tsx:456-512` — preset rows render as a
  single `<button>` with no action affordances.
- `app/(application)/chat/components/composer.tsx:621-623` —
  `onApplyPreset` merges preset items into the session via
  `controller.addSessionItems(items)`; preset identity is lost.
- `app/(application)/chat/components/pinned-context-row.tsx` — renders
  `controller.sessionItems` as removable badges plus a "Save context preset"
  button.
- `ItemsSelectionModal` has four consumers: chat `composer.tsx`,
  chat `attach-menu.tsx`, projects `files-tab.tsx`, data
  `item-form-fields.tsx`.
- Preset shape (`CONTEXT_PRESET_FIELDS`): `id`, `name`, `description`,
  `preset_items` (array of `"ctx_id"` or `"ctx_id/item_id"`), `tags`,
  `usage_count`, `favorite_count`, `rights_mode`, `created_by`, `RBAC`,
  timestamps.

## Design

### 1. Browse modal: per-row edit & delete actions

In `components/items-selection-modal.tsx`:

- Restructure each preset row from a single `<button>` to a `div` containing
  the selectable area and separate icon action buttons (no nested buttons).
  Keyboard access and the selected-state styling are preserved.
- Show a pencil (edit) and trash (delete) icon per row, only when the current
  user has write access to that preset.
- **Write access helper:** new pure module
  `lib/presets/check-preset-access.ts`, modeled on
  `lib/prompts/check-prompt-access.ts`: write access iff the user is an
  admin, is the preset's `created_by`, or has `rights: "write"` through the
  preset's `rights_mode`/`RBAC` entries (users/roles/teams). Unit-tested with
  vitest.
- **Delete:** trash opens the standard `ConfirmDialog` primitive
  (`components/primitives/confirm-dialog.tsx`) in destructive mode with the
  preset name in the copy. Confirm fires `DELETE_CONTEXT_PRESET` with
  `refetchQueries: [GET_CONTEXT_PRESETS, "GetContextPresets"]` (the string
  operation name keeps the `chat/queries.ts` duplicate documents in sync, per
  the existing contract note in `save-preset-modal.tsx`). On success: toast;
  if the deleted preset was selected in the preview pane, clear the
  selection; call the new optional `onPresetDeleted(presetId)` prop so the
  composer can clear its active-preset state if it matches.
- **Edit (metadata + sharing):** pencil calls a new optional
  `onEditPreset(preset)` prop. The pencil renders only when the prop is
  provided. The chat composer wires it to the existing `SavePresetModal`
  with `existingPreset` set — no changes to that modal are needed for
  metadata editing. Other `ItemsSelectionModal` consumers are unaffected
  until they opt in (delete works everywhere since it is self-contained).

### 2. Composer: active-preset state

In `composer.tsx` (composer-local state, consistent with the existing
"composer-owned overlays" ownership map):

- New state: `activePreset: { id, name, preset_items } | null`.
- `onApplyPreset` sets it and **replaces** the pinned items with the
  preset's items (instead of merging): remove existing session items not in
  the preset, add the preset's items. Applying a second preset replaces the
  first. `INCREMENT_PRESET_USAGE` behavior is unchanged.
- The association is **ephemeral**: lost on reload or session switch. The
  session items themselves persist as today. Persisting the association
  would require a backend session field and is out of scope.
- Editing preset metadata (via `onEditPreset` → `SavePresetModal`) while
  that preset is active updates the active-preset name on save.
- `onPresetDeleted(id)`: if it matches `activePreset.id`, clear
  `activePreset` (pinned items stay).

### 3. Pinned-context row: preset awareness & content editing

In `pinned-context-row.tsx`, new optional props (additive, following the
row's existing contract-note pattern): `activePreset`, `onDeselectPreset`,
`onUpdatePreset`, `updatingPreset` (pending flag), `canUpdatePreset`.

When a preset is active:

- A leading chip renders `Bookmark {preset.name} ×`. The × calls
  `onDeselectPreset`, which removes all pinned items and clears
  `activePreset`.
- Items are added/removed exactly as today (attach menu, badge ×) — those
  actions affect only the chat session.
- **Dirty detection:** the row is "modified" when
  `set(controller.sessionItems) ≠ set(activePreset.preset_items)`.
- When modified **and** the user has write access to the preset
  (`canUpdatePreset`), an "Update preset" button appears. Clicking it fires
  `UPDATE_CONTEXT_PRESET` with `preset_items = controller.sessionItems`
  (all other fields unchanged), shows a toast, and refreshes
  `activePreset.preset_items` so the dirty state clears.
- Without write access no update button is shown; the existing
  "Save context preset" button already covers save-as-new.

The `UPDATE_CONTEXT_PRESET` call and write-access computation live in the
composer (which has `UserContext` and owns the mutation wiring); the row
stays presentational.

### 4. Error handling

- Delete/update mutation failures: destructive dialog surfaces the error via
  `ConfirmDialog`'s error slot; update-preset failures toast an error and
  keep the dirty state so the user can retry.
- Validation of preset items on apply (`validate-preset-items.ts`) is
  unchanged; a preset whose items partially fail validation applies only the
  valid ones, as today — the active-preset chip still binds to the preset,
  so the row may immediately show "modified" if items were dropped. This is
  accurate (the session genuinely differs from the preset) and acceptable.

### 5. i18n

New keys under `chat.presets` in both `messages/en.json` and
`messages/de.json`: edit/delete action labels, delete-confirm title/body,
deleted toast, deselect-preset label, active-preset chip aria-label,
modified indicator, update-preset action, updated-contents toast.

### 6. Testing

- Vitest unit tests for `lib/presets/check-preset-access.ts` (owner, admin,
  each rights_mode, read-vs-write RBAC entries).
- Vitest unit test for the dirty-set comparison helper if extracted.
- Lint + typecheck + build must pass; UI flows verified manually
  (delete with confirm, edit metadata, apply → modify → update preset,
  deselect, no-write-access hides affordances).

## Out of scope

- Persisting the active-preset association on the chat session (backend).
- Preset edit/delete affordances in the non-chat consumers of
  `ItemsSelectionModal` beyond the self-contained delete.
- Favorites, duplication, or preset item-picker UI inside the edit modal.
