# Delete saved transcription entries — design

**Date:** 2026-07-07
**Status:** Approved
**Feedback driver:** Users can delete a saved transcript's knowledge-base item
(in `/data/transcriptions`) but cannot delete the transcription entry itself on
the `/transcriptions` page — saved rows only offer "Open in library" and "Edit".

## Goal

Let users delete a saved transcription entry from the transcriptions page, with
a per-delete choice to also delete the linked knowledge-base item.

## Non-goals

- No delete action inside the ReviewSheet (row-level only).
- No bulk delete.
- No backend changes — both mutations already exist.

## UI

In `app/(application)/transcriptions/components/job-row.tsx`, saved rows
(`job.status === "saved"`) gain a third right-aligned action after Edit: a
ghost, icon-only Trash button (destructive foreground on hover, ≥44px touch
target below md, `aria-label` = "Delete", matching the "Open in library"
icon-button pattern already in the row).

Clicking opens the shared `ConfirmDialog` primitive
(`components/primitives/confirm-dialog.tsx`):

- **Title/description:** removing the entry from the transcriptions page; the
  saved transcript in the knowledge base is kept unless the checkbox is
  selected.
- **Cascade checkbox** (via the existing `options` prop, only rendered when
  `job.saved_item_id` is set, unchecked by default): "Also delete the saved
  transcript from the knowledge base".
- **Confirm label:** Delete (destructive variant).

## Data flow

New mutation in `app/(application)/transcriptions/queries.ts`, mirroring the
data section's `DELETE_ITEM` shape for the `transcriptions` context:

```graphql
mutation RemoveSavedTranscriptItem($id: ID!) {
  transcriptions_itemsRemoveOneById(id: $id) {
    id
  }
}
```

On confirm (async handler; ConfirmDialog handles pending state):

1. If the checkbox is selected, run `transcriptions_itemsRemoveOneById` with
   `job.saved_item_id` first. On failure: error toast, reject → dialog stays
   open (user can retry or uncheck the box and delete just the entry).
2. Run the existing `REMOVE_TRANSCRIPTION_JOB`
   (`transcription_jobsRemoveOneById`) with `job.id`. On failure: error toast,
   reject → dialog stays open.
3. On success: success toast, `onChanged()` refetch — the row disappears from
   the Saved group.

## i18n

New keys under the `transcriptions` namespace in every locale file in
`messages/`:

- `row.delete` — aria-label for the trash button
- `confirmDelete.title`, `confirmDelete.description`,
  `confirmDelete.confirm`, `confirmDelete.alsoDeleteItem`
- `toasts.deleted`, `toasts.deleteFailed`

## Error handling

- Item delete fails (e.g. dangling `saved_item_id` after a manual KB delete):
  dialog stays open with an error toast; deleting just the entry (checkbox
  off) still works.
- Job delete fails: dialog stays open with an error toast.

## Testing

Manual verification in the running app:

1. Delete entry only → row gone, KB item still opens in `/data/transcriptions`.
2. Delete with checkbox → row gone and KB item gone.
3. Failure path (e.g. offline/backend error) → dialog stays open, toast shown.

No unit tests: the transcriptions rows have no existing test setup, and the
change is a thin composition of already-tested primitives.
