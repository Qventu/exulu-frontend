# Delete Saved Transcription Entries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users delete a saved transcription entry on `/transcriptions`, with an optional per-delete checkbox that also deletes the linked knowledge-base item.

**Architecture:** Saved rows in `job-row.tsx` gain a third action (icon-only Trash button) that opens the shared `ConfirmDialog` primitive. The dialog's existing `options` cascade-checkbox prop offers "Also delete the saved transcript from the knowledge base" when the job has a `saved_item_id`. Confirm runs the (new) `transcriptions_itemsRemoveOneById` mutation first when the box is checked, then the existing `transcription_jobsRemoveOneById`. No backend changes.

**Tech Stack:** Next.js 16 App Router, React 19, Apollo Client (`useMutation`), next-intl, sonner toasts, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-07-07-delete-saved-transcription-entries-design.md`

## Global Constraints

- Two locale files must stay in parity: `messages/en.json` and `messages/de.json` (`npm run check-messages` validates).
- Destructive actions confirm via `components/primitives/confirm-dialog.tsx` — never a bare mutation or native `confirm()`.
- Touch targets ≥44px below `md` (existing row pattern: `max-md:h-11`).
- Icon-only buttons need `aria-label`.
- No unit tests for this feature (spec §Testing): manual verification only; the rows have no existing test setup.

---

### Task 1: Item-delete mutation + i18n keys

**Files:**
- Modify: `app/(application)/transcriptions/queries.ts` (append after `REMOVE_TRANSCRIPTION_JOB`, ~line 95)
- Modify: `messages/en.json` (`transcriptions` namespace)
- Modify: `messages/de.json` (`transcriptions` namespace)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `REMOVE_SAVED_TRANSCRIPT_ITEM` (gql `DocumentNode`, variables `{ id: ID! }`) exported from `app/(application)/transcriptions/queries.ts`; i18n keys `transcriptions.row.delete`, `transcriptions.confirmDelete.{title,description,confirm,alsoDeleteItem}`, `transcriptions.toasts.{deleted,deleteFailed}`. Task 2 references all of these by exactly these names.

- [ ] **Step 1: Add the mutation to `app/(application)/transcriptions/queries.ts`**

Insert directly below the `REMOVE_TRANSCRIPTION_JOB` export (before the "Recall meeting-bot operations" divider):

```ts
/**
 * Deletes the knowledge item a saved job produced (the cascade checkbox in
 * the delete confirm). Transcripts live in the context named "transcriptions"
 * — the same hardcoded home the saved-row "Open in library" link points at.
 */
export const REMOVE_SAVED_TRANSCRIPT_ITEM = gql`
  mutation RemoveSavedTranscriptItem($id: ID!) {
    transcriptions_itemsRemoveOneById(id: $id) {
      id
    }
  }
`;
```

- [ ] **Step 2: Add English keys to `messages/en.json`**

All inside the existing `"transcriptions"` object:

In `"row"` (alphabetical-ish placement next to `"dismiss"`):

```json
"delete": "Delete"
```

As a new sibling of `"confirmDismiss"`:

```json
"confirmDelete": {
  "title": "Delete saved transcription?",
  "description": "This removes the entry from this page. The saved transcript stays in the knowledge base unless you also select it below.",
  "confirm": "Delete",
  "alsoDeleteItem": "Also delete the saved transcript from the knowledge base"
}
```

In `"toasts"`:

```json
"deleted": "Transcription entry deleted",
"deleteFailed": "Couldn't delete the entry"
```

- [ ] **Step 3: Add German keys to `messages/de.json`**

Same positions in the `"transcriptions"` object:

In `"row"`:

```json
"delete": "Löschen"
```

Sibling of `"confirmDismiss"`:

```json
"confirmDelete": {
  "title": "Gespeicherte Transkription löschen?",
  "description": "Dadurch wird der Eintrag von dieser Seite entfernt. Das gespeicherte Transkript bleibt in der Wissensdatenbank erhalten, sofern Sie es unten nicht ebenfalls auswählen.",
  "confirm": "Löschen",
  "alsoDeleteItem": "Auch das gespeicherte Transkript aus der Wissensdatenbank löschen"
}
```

In `"toasts"`:

```json
"deleted": "Transkriptionseintrag gelöscht",
"deleteFailed": "Eintrag konnte nicht gelöscht werden"
```

- [ ] **Step 4: Verify locale parity and lint**

Run: `npm run check-messages`
Expected: passes (no missing/extra keys between en and de).

Run: `npx eslint "app/(application)/transcriptions/queries.ts"`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(application)/transcriptions/queries.ts" messages/en.json messages/de.json
git commit -m "feat(transcriptions): item-delete mutation and delete-confirm copy"
```

---

### Task 2: Delete action on saved rows

**Files:**
- Modify: `app/(application)/transcriptions/components/job-row.tsx`

**Interfaces:**
- Consumes: `REMOVE_SAVED_TRANSCRIPT_ITEM` from `../queries` and the i18n keys from Task 1; existing `REMOVE_TRANSCRIPTION_JOB`, `ConfirmDialog` (`options` / `onConfirm(optionIds?: string[])` props), `onChanged()` prop.
- Produces: nothing consumed by later tasks (final task).

- [ ] **Step 1: Wire imports, state, and mutation**

In `job-row.tsx`:

Add `Trash2` to the lucide import:

```ts
import { ExternalLink, FileAudio, Trash2, Video } from "lucide-react";
```

Extend the queries import:

```ts
import {
  CANCEL_TRANSCRIPTION_JOB,
  REMOVE_SAVED_TRANSCRIPT_ITEM,
  REMOVE_TRANSCRIPTION_JOB,
} from "../queries";
```

Below the existing `removeJob` mutation and confirm-state hooks (lines 44–47), add:

```ts
const [removeSavedItem] = useMutation(REMOVE_SAVED_TRANSCRIPT_ITEM);
const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
```

- [ ] **Step 2: Add the confirm handler**

Below `onConfirmDismiss` (after line 135), add:

```ts
// Cascade order: knowledge item first, then the job row — if the item
// delete fails the entry survives, so nothing dangles and the user can
// retry (or uncheck the box and delete just the entry).
const onConfirmDelete = async (optionIds?: string[]) => {
  try {
    if (optionIds?.includes("knowledge-item") && job.saved_item_id) {
      await removeSavedItem({ variables: { id: job.saved_item_id } });
    }
    await removeJob({ variables: { id: job.id } });
    toast.success(t("toasts.deleted"));
    onChanged();
  } catch (err: unknown) {
    toast.error(t("toasts.deleteFailed"), {
      description: err instanceof Error ? err.message : undefined,
    });
    throw err; // keep the ConfirmDialog open
  }
};
```

- [ ] **Step 3: Add the Trash button to the saved-row action cluster**

Inside the `{job.status === "saved" && (<>…</>)}` block, directly after the Edit button (the `<Button …>{tCommon("edit")}</Button>` closing tag, ~line 241), add:

```tsx
{/* Icon-only delete; ≥44px target below md like the row's other actions. */}
<Button
  type="button"
  variant="ghost"
  size="sm"
  aria-label={t("row.delete")}
  className="text-muted-foreground hover:text-destructive max-md:h-11 max-md:w-11 max-md:px-0 md:w-8 md:px-0"
  onClick={() => setConfirmDeleteOpen(true)}
>
  <Trash2 aria-hidden="true" className="size-4" />
</Button>
```

- [ ] **Step 4: Add the ConfirmDialog**

After the existing `confirmDismissOpen` `<ConfirmDialog …/>` (line 272–279), add:

```tsx
<ConfirmDialog
  open={confirmDeleteOpen}
  onOpenChange={setConfirmDeleteOpen}
  title={t("confirmDelete.title")}
  description={t("confirmDelete.description")}
  confirmLabel={t("confirmDelete.confirm")}
  options={
    job.saved_item_id
      ? [{ id: "knowledge-item", label: t("confirmDelete.alsoDeleteItem") }]
      : undefined
  }
  onConfirm={onConfirmDelete}
/>
```

- [ ] **Step 5: Static checks**

Run: `npx tsc --noEmit`
Expected: no new errors (compare against a pre-change run if the baseline is noisy).

Run: `npx eslint "app/(application)/transcriptions/components/job-row.tsx"`
Expected: no errors.

- [ ] **Step 6: Manual verification in the running app**

Run: `npm run dev`, open `http://localhost:3000/transcriptions`, then verify per spec §Testing:

1. Saved row shows the trash button; clicking opens the confirm dialog with the checkbox (checkbox absent on a saved row without `saved_item_id`, if one exists).
2. Confirm with checkbox OFF → row disappears from Saved; the knowledge item still opens at `/data/transcriptions/<saved_item_id>`.
3. Confirm with checkbox ON (on another saved row) → row gone AND the knowledge item is gone from `/data/transcriptions`.
4. Failure path (e.g. stop the backend, confirm) → error toast, dialog stays open.

- [ ] **Step 7: Commit**

```bash
git add "app/(application)/transcriptions/components/job-row.tsx"
git commit -m "feat(transcriptions): delete saved entries with optional knowledge-item cascade"
```
