# Transcriptions — Review & Design Concept
**Routes:** `/transcriptions`  **Primary persona:** P1 (End User)  **Secondary:** P2 (Power User) — *correction to the ownership matrix, see §2*  **Current state:** Feature-rich single page that works end-to-end, but the core job (reviewing a transcript) is squeezed into a cramped inline accordion with a `max-h-60` preview, destructive actions ship without proper confirmation, the teams-sharing option silently loses data, and the page has zero i18n.

---

## 1. Current state

Transcriptions is an upload → transcribe (WhisperX, diarized) → review → save pipeline. The
saved output is a **knowledge context item** in the `transcriptions` context (`/data/transcriptions`),
optionally attached to a project and shared via RBAC — i.e. the output of this P1 page is
input to agent RAG.

**Code surface:**
- `app/(application)/transcriptions/page.tsx` — the entire page (1,036 lines): queue, new-transcription panel, job rows, review panel, audio timeline. No layout file; rendered inside the `(application)` shell.
- `components/uppy-dashboard.tsx` — file gallery + upload dialog (`UppyDashboard`, `FileGalleryAndUpload`, `FileItem`, `getPresignedUrl`).
- `components/rbac.tsx` — `RBACControl` visibility/sharing widget (shared app-wide).
- Queries: `queries/queries.ts:3063-3137` (`GET_TRANSCRIPTION_JOBS`, `GET_TRANSCRIPTION_JOB`, `START_TRANSCRIPTION_JOB`, `FINALIZE_TRANSCRIPTION_JOB`, `CANCEL_TRANSCRIPTION_JOB`, `REMOVE_TRANSCRIPTION_JOB`).
- Nav: `components/custom/main-nav.tsx:169-174` — **ungated** entry (every authenticated user sees it), label `t('navigation.transcriptions')` = "Transcripts" (en) / "Transkription" (de).

**RBAC summary:** No role gate on nav or page; any authenticated user can transcribe. Job
listing scoping (`created_by`, `rights_mode`) is server-side. The `RBACControl` inside the
page governs the *resulting context item's* permissions (`target_rights_mode`,
`target_rbac_users`, `target_rbac_roles`), not page access.

### Functionality inventory

This list is the contract. Every numbered item must appear in the disclosure ladder (§3).
All references are `app/(application)/transcriptions/page.tsx` unless stated.

**Page shell & queue**
1. **Page header** with title, one-line purpose, and an inline deep link "View previously saved transcripts" → `/data/transcriptions` (`:162-173`).
2. **"New transcription" toggle button** in the header; label morphs to "Cancel" while the panel is open; opening it collapses any expanded job row (`:174-182`).
3. **Active-jobs query**: statuses `queued | transcribing | awaiting_review | failed`, `cache-and-network`, **5-second polling** (`:123-137`).
4. **Saved-jobs query**: status `saved`, limit 50, sorted `createdAt DESC` by query default (`:139-151`, `queries/queries.ts:3084-3095`).
5. **Live timestamps**: a 1-second `tick` re-render keeps elapsed counters and "X ago" labels moving (`:116-121`); `formatRelative` renders "just now/Ns/Nm/Nh/Nd ago" then short dates (`:73-97`).
6. **"In progress" section** with a dashed-border empty state ("No transcriptions in progress. Click \"New transcription\" to start one.") (`:194-218`).
7. **"Completed" section**, rendered only when saved jobs exist, with explainer copy ("Re-open a saved transcript to rename speakers; saving will update the existing context item.") (`:220-244`).
8. **Single-expansion accordion**: one `expandedJobId` shared across both sections — opening one row closes the other (`:115`, `:209-211`, `:235-238`).

**New-transcription panel (`NewTranscriptionPanel`, `:252-456`)**
9. **Audio file selection** via `UppyDashboard` dialog; `selectionLimit: 1`; allowed types `.mp3 .wav .m4a .mp4 .mpeg` (`:344-359`).
10. **Selected-file chip**: FileAudio icon + human filename (decoded from the `_EXULU_` S3-key convention) + icon-only clear (X) button (`:281-285`, `:330-342`).
11. **Title input**, auto-filled from the filename with extension stripped, only if still empty (`:287-289`, `:363-371`).
12. **Language select**: Auto-detect (default) + en, de, fr, es, it, nl, pt; "auto" is sent as `null` (`:269`, `:303`, `:375-390`).
13. **Speaker-count select**: Auto-detect (default) or 1–8; "auto" sent as `null` (`:270`, `:304`, `:392-407`).
14. **Project assignment** (optional): Select over the first 100 projects (`GET_PROJECTS`, `:274-277`, `:410-428`).
15. **Target permissions** for the resulting item via `RBACControl` (`modalMode`), capturing rights mode + per-user/per-role read/write (`:262-267`, `:430-443`).
16. **Start action**: disabled until a file is chosen; busy spinner; "Transcription started" toast; destructive toast with server message on failure (`:291-324`, `:445-453`).
17. **Cancel action** (panel footer) closes the panel without starting (`:446-448`); same effect as the header toggle (item 2).

**File gallery / upload dialog (`components/uppy-dashboard.tsx`, opened by item 9)**
18. **Browse previously uploaded S3 files** in a thumbnail/icon grid with type-specific icons and secure image previews (`uppy-dashboard.tsx:313-364`, `:431-535`, `:562-586`).
19. **Filename search** within the gallery (`:319-324`, `:296-300`).
20. **Pagination** via S3 continuation tokens: first / previous / next buttons (`:366-411`).
21. **Upload new files** through the embedded Uppy Dashboard widget (max 10 files per batch, theme-aware light/dark) (`:250-290`, `:414-418`).
22. **Auto-list + auto-select newly uploaded files**, respecting the selection limit (`:259-285`, `:302-305`).
23. **Delete a stored file** from the gallery (hover-revealed X; tanstack mutation → `files.delete`) (`:227-233`, `:355-361`, `:518-531`).
24. **View/download any file** via presigned URL in a new tab (`:499-516`).
25. **Selection counter** ("n / limit files selected") + allowed-types hint; files of other types are rendered disabled/dimmed (`:325-328`, `:361`).
26. **Gallery empty state** ("Nothing to see here... yet!") and a 9-tile skeleton loading grid (`:330-351`).
27. **Confirm selection** button closes the dialog and hands the S3 key back to the page (`:420-427`, `:147-157`).

**RBAC control (`components/rbac.tsx`, used in items 15 and 45)**
28. **Visibility mode picker**: private / users / roles / teams / public in a searchable Command popover; choosing a mode clears the other modes' selections (`rbac.tsx:39-48`, `:175-231`).
29. **Users sharing**: server-side email search (excludes `type: api`), first-5 results checklist, per-user read/write rights select, per-user remove (`:234-357`).
30. **">5 users" management modal**: hydrated full list with rights editing and removal (`:335-347`, `:541-616`).
31. **Roles sharing**: checkbox list of roles (excludes `api` type, limit 30) with per-role read/write and removal (`:87-101`, `:359-448`).
32. **Teams sharing**: checkbox list (limit 100) with per-team read/write and removal (`:103-110`, `:450-539`). ⚠️ **On this page the team selection is silently discarded** — the page's `onChange` only destructures `(mode, users, roles)` (`page.tsx:437-441` vs. the 4-arg signature `rbac.tsx:67`), and `START/FINALIZE` inputs carry no teams field (`queries/queries.ts:3106-3124`). See UX review.

**Job rows (`JobRow`, `:461-623`)**
33. **Row identity**: FileAudio icon + title, falling back to the decoded filename from `audio_s3key` (`:478-482`, `:583-585`).
34. **Status line per state** (`:559-568`): "Queued…"; live transcribing label combining audio length + elapsed + **estimated remaining time** computed from `NEXT_PUBLIC_TRANSCRIPTION_FACTOR` (default `2`; "wrapping up" when overdue) (`:33-39`, `:495-511`, `:539-543`); "Awaiting review (length)"; "Saved/Updated X ago · length" with a 2-second-jitter heuristic distinguishing first save from re-save (`:548-557`); "Failed"; "Cancelled".
35. **Full timestamp tooltip** on saved rows via the native `title` attribute (`:572-578`, `:586-589`).
36. **Inline error text** appended to the status line in destructive color (`:591-593`).
37. **Cancel** for queued/transcribing jobs (`CANCEL_TRANSCRIPTION_JOB`) — no confirmation; destructive toast on failure (`:513-524`, `:596-600`).
38. **"Review & save"** toggle (primary button) for `awaiting_review`, expanding the review panel; label flips to "Close" (`:601-605`).
39. **"Edit speakers"** toggle (outline button) for `saved`, re-opening the review panel in re-save mode (`:606-610`).
40. **"Dismiss"** (trash icon + label) for `failed` jobs → `REMOVE_TRANSCRIPTION_JOB` — no confirmation; destructive toast on failure (`:526-537`, `:611-615`).

**Review panel (`ReviewPanel`, `:625-883`)**
41. **Full job fetch** incl. `raw_segments` (tolerant of JSON-string or array payloads), `cache-and-network`, with an inline loading state (`:634-652`, `:771-778`).
42. **Diarization-disabled notice** (amber alert) when every segment's speaker is `"unknown"`, with guidance to type a single name (`:780`, `:784-789`).
43. **Editable title** (`:667`, `:791-798`).
44. **Project re-assignment** select, pre-filled from the job (`:668`, `:800-818`).
45. **Permissions re-editing** via `RBACControl`, pre-filled from `target_*` fields (`:669-677`, `:820-833`).
46. **Speaker renaming**: one input per distinct speaker, ordered by first appearance in the audio; raw label (`SPEAKER_00`…) shown as `code`; placeholder "(keep raw label)"; **pre-populated from the persisted `job.speakers` map** so re-edits start from saved names (`:99-109`, `:654-664`, `:680-682`, `:835-854`).
47. **Live text preview**: consecutive same-speaker segments merged into `Name: text` blocks, re-rendered as names are typed (`:694-706`, `:865-870`).
48. **Save / finalize** (`FINALIZE_TRANSCRIPTION_JOB`): creates or updates the context item; success toast carries a deep link to `/data/transcriptions/[item_id]`; re-save mode shows "Save changes", toasts "Transcript updated", and auto-closes; busy spinner; destructive toast on failure (`:708-745`, `:872-880`).
49. **Discard / Close**: for `awaiting_review`, native `confirm()` then job cancellation; for `saved`, the button is relabeled "Close" and never deletes the item (`:747-769`, `:872-875`).

**Audio timeline (`AudioTimeline`, `:915-1035`)**
50. **Audio playback** via presigned URL (1-minute client-side cache in `getPresignedUrl`, `uppy-dashboard.tsx:537-560`) in a native `<audio controls>` element, with a loading state (`:924-961`, `:963-973`).
51. **Speaker-colored segment ribbon**: deterministic hash → 8-color palette per raw speaker id (stable across renames); minimum 0.15% segment width; total duration falls back to the last segment's end before audio metadata loads (`:888-913`, `:944-946`, `:974-1001`).
52. **Click a segment to seek and play** from its start (`:948-952`, `:995`).
53. **Hover popup per segment**: speaker name (live-renamed), time range (`m:ss`), and segment text, positioned over the ribbon (`:996-998`, `:1011-1031`).
54. **Live playhead line** synced to `currentTime` (`:970-972`, `:1002-1009`).

### UX review

**High**
- **Hierarchy inversion in review** — the transcript, the thing being reviewed, is the *last* element of the panel, rendered as a `text-xs` `<pre>` capped at `max-h-60` (`:865-870`), below four form sections. The page's #1 job gets the least space. The audio timeline (`:856-863`) is similarly buried mid-form.
- **Teams sharing silently loses data** — `RBACControl` offers "Shared with Teams" (`rbac.tsx:43`, `:450-539`) but the page's `onChange` drops the 4th argument (`page.tsx:437-441`, `:826-832`) and neither `transcriptionJobStart` nor `transcriptionJobFinalize` sends a teams field (`queries/queries.ts:3106-3124`). A user can select teams, see them listed, save — and the selection evaporates. Mode `"teams"` may even persist with an empty member list.
- **Destructive actions outside the design system** — Cancel on a running job (`:596-600`) and Dismiss on a failed job (`:611-615`) execute immediately with no confirmation; Discard uses native `confirm()` (`:754`). Violates philosophy §2 ("anything destructive lives at L3+ with confirmation") and anti-pattern 4 (one confirm pattern).
- **Hover-only / keyboard-inaccessible review affordances** — segment popups exist only on `onMouseEnter` (`:996-998`); ribbon segments are plain `div`s with `onClick`, no `role`, no `tabIndex`, no focus state (`:986-999`); the saved-row full timestamp lives in a `title` attribute (`:586-589`). Unusable by keyboard and touch.

**Med**
- **Zero i18n on a P1 page** — every string is hardcoded English (`page.tsx` throughout) in an en/de app; only the nav label is translated, and it disagrees with the page ("Transcripts" `messages/en.json:11` vs. h1 "Transcriptions" `page.tsx:165`).
- **Whole-page 1 s re-render + 5 s polling** — the `tick` interval re-renders the entire page including all rows and any open review panel (`:116-121`); polling continues even when nothing is active (`:136`). Contradicts "Performance is a feature".
- **"In progress" contains failed jobs** — the active query includes `failed` (`:129-131`), so dead jobs sit under a section titled "In progress" indefinitely until manually dismissed.
- **Estimate constant contradicts its own comment** — comment says "We use 10 as a deliberately-conservative default" but the fallback is `"2"` (`:33-39`); on CPU-bound servers the "~remaining" label will routinely show "wrapping up" for hours.
- **Cancelled jobs vanish without a trace** — neither query includes status `cancelled` (`:129-131`, `:146`), so `statusLabel.cancelled` (`:567`) is unreachable after refetch; a cancel looks like a delete.
- **Saved list capped at 50** with no pagination, search, or count (`:147`); heavy users lose access to older jobs (the items survive in `/data/transcriptions`, but speaker re-editing via this page does not).
- **Wrong copy in shared RBAC widget** — visibility descriptions say "agent" ("Only you can see this agent") regardless of context (`rbac.tsx:40`, `:44`).
- **`saved_item_id` never surfaced** — the field is fetched (`queries/queries.ts:3076`) but the only link to the saved item is the transient success toast (`:727-733`); afterwards there is no path from a saved row to its item.
- **Morphing header button** — "New transcription" relabels to "Cancel" (`:180`), making the page's primary action disappear while the panel is open and reading ambiguously next to job-row "Cancel" buttons.
- **Icon-only clear-file button without aria-label** (`:334-341`); the trash "Dismiss" icon does have text, the X does not.

**Low**
- Hand-rolled header/empty state instead of shared primitives (expected pre-redesign) (`:163-182`, `:198-201`).
- Multiple `default`-variant (purple) buttons visible at once when rows await review (header + per-row "Review & save" + panel "Start"/"Save") — purple-confetti risk (anti-pattern 5).
- Hover popup can clip at viewport edges (`-translate-x-1/2` with no collision handling, `:1011-1014`).
- Speaker palette uses raw HSL literals (`:888-897`) — fine as semantic speaker mapping, but contrast of `opacity-70` fills should be verified in light mode.
- `console.log` noise in `uppy-dashboard.tsx` (`:61`, `:247`, `:506-508`, `:554`, `:564`).
- `size="sm"`/icon buttons are ~32 px touch targets.

### Mobile audit (390 px)

Nothing hard-breaks (no fixed widths, no wide tables), but the review job degrades:

- **Hover-only segment popups are dead on touch** (`:996-998`) — tapping a segment seeks and plays (`:995`) but there is no way to read a segment's text/speaker from the ribbon. The `title`-attribute timestamp (`:588`) is equally unreachable.
- **Ribbon segments are sub-millimeter tap targets** for short utterances (min width 0.15% of ~350 px ≈ 0.5 px, `:982-985`).
- **Upload dialog is a desktop composite**: `DialogContent sm:max-w-[900px]` (`uppy-dashboard.tsx:142`) stacks gallery above the Uppy widget at `grid-cols-1 md:grid-cols-2` (`:313`) with **no max-height/scroll handling on the dialog itself** — gallery + pagination + Uppy Dashboard easily exceed the viewport; the confirm button can land off-screen.
- **Header row doesn't wrap**: `flex items-center justify-between` (`:163`) squeezes "New transcription" against the title block; no `sm:` variants anywhere on the page.
- **Form grid `grid-cols-2`** for Language/Speakers (`:373`) renders ~160 px selects — functional but tight; no `sm:` fallback to one column.
- Long transcribing status strings ("Transcribing 1h 2m 10s of audio… 12m 4s elapsed · ~1h 52m remaining") wrap to 3 lines and push row buttons — `items-center` keeps it usable, just noisy.
- Review panel forms, preview `<pre>` (`whitespace-pre-wrap`), and native audio controls behave fine.

**Verdict: minor** — the upload → wait → save happy path works on a phone; reading/verifying the transcript against audio (the actual review) does not.

---

## 2. Jobs to be done

**P1 — End User (primary).** Persona job 5: "Transcribe audio and use the transcript."
Ranked jobs on this page:
1. Upload a recording and get a transcript started (weekly-to-daily for meeting-heavy users).
2. Review the finished transcript: name the speakers, skim/verify against the audio, save.
3. Check progress of a running transcription ("is it done yet?") — often the *mobile* visit.
4. Re-open a saved transcript to fix speaker names or sharing.
5. Find the saved transcript to use it (in chat, in a project) — currently exits to `/data/transcriptions`.

**P2 — Power User (secondary).** The output is RAG content: P2 cares that transcripts land in
the right **project**, with the right **sharing** (items 14-15, 44-45), so agents and teammates
can use them (persona jobs 4 and 2). P2 also re-curates: re-opening saved jobs to fix speaker
labels that pollute retrieval quality. These are exactly the fields the current UI promotes to
top-level — for everyone.

**Primary persona and #1 job in one sentence:** *P1 turns a recording into a correctly
speaker-labeled transcript with as little ceremony as possible.*

**Ownership matrix correction:** `personas.md:154` lists `/transcriptions` as P1 with secondary
"—". That is wrong: **P2 is a real secondary owner** — project targeting, RBAC sharing, and
speaker-label quality exist for the knowledge/RAG pipeline, which is P2's domain (persona job 4).
Consequence for the design: project + sharing fields move to L3 (P2's deliberate depth) instead
of cluttering P1's L1/L2 flow. The correction should flow back to `personas.md`.

---

## 3. Design concept

**Concept headline: "Drop audio, watch it cook, name the voices."** The page becomes a calm
three-stage queue ordered by what needs the user (review first, processing second, saved last),
and review graduates from a cramped accordion into a focused side panel where the **transcript
itself is the hero** — readable, tappable, synced to the audio — with configuration folded
behind it.

### Default view (L1)

Single centered content page (PageShell, `max-w-4xl`, `p-6` rhythm — the current width is right).

1. **PageHeader** (shared primitive): title "Transcriptions" (`text-2xl`), purpose line
   "Turn audio into speaker-labeled transcripts you can use in chats and projects.", and the
   page's **only purple button: "New transcription"** on the right. The header link to the
   library moves into the Saved group header (below). The button no longer morphs to "Cancel"
   — while the composer is open it becomes disabled (the composer has its own Cancel).
2. **Toolbar** (shared primitive, directly under the header): a single search input filtering
   jobs by title (client-side over loaded jobs; server `contains` filter when the saved list
   paginates). Nothing else — no filters, no view switches.
3. **The queue**, one vertical list in three status groups, each a `text-sm font-medium
   text-muted-foreground` group header with a count, separated by `gap-8`:
   - **Needs review** (`awaiting_review`) — pinned first; rows carry an outline "Review" button.
     This is the actionable group, so it leads.
   - **Processing** (`queued`, `transcribing`) — quiet rows with a muted animated status dot, the
     live elapsed/remaining label, and a ghost "Cancel" action. A 2 px indeterminate progress
     strip under the row border while transcribing. **Failed** jobs render here too but visually
     distinct (red status dot, error message in destructive text, "Dismiss" ghost action) — the
     group is honestly named "Processing & failed" only when failures exist; otherwise "Processing".
   - **Saved** — replaces "Completed"; each row shows "Saved/Updated {relative} · {length}", an
     "Edit" outline action (re-opens review), and a quiet "Open in library ↗" ghost link built
     from `saved_item_id` (fixes the toast-only deep link). The group header carries the
     "Transcript library" link to `/data/transcriptions` (inventory 1's link, relocated).
   - Healthy states are muted; only failures earn color (philosophy §4).
4. **EmptyState** (shared primitive) when there are no jobs at all: FileAudio icon, "Upload a
   meeting or voice memo and get back a speaker-labeled transcript.", primary action
   "New transcription".
5. **Row anatomy** (identical across groups): FileAudio icon · title (`font-medium`, truncate) ·
   status line (`text-xs text-muted-foreground`, RelativeTime with a real Tooltip for the full
   timestamp) · right-aligned action. One action per row; no purple below the header.

**The composer (L2):** clicking "New transcription" expands an inline card at the top of the
queue (no dialog — the file gallery is itself a dialog, and modal-on-modal is forbidden,
anti-pattern 3). Contents, in order:
- **File area**: a quiet dropzone ("Drop an audio file or **browse** — mp3, wav, m4a, mp4, mpeg");
  browse opens the existing gallery dialog (inventory 18-27 unchanged). Once chosen: the file
  chip with clear button (clear gets `aria-label="Remove file"`).
- **Title input** (auto-filled from filename as today).
- **Footer**: ghost "Cancel" + purple "Start".
- **"Options" collapsible** (L3, collapsed by default, chevron + label): Language, Speakers,
  Project, Sharing (RBACControl). Defaults — auto, auto, none, private — are stated inline so
  nobody *needs* to open it ("Auto-detect language and speakers · Private · No project").
This makes the P1 happy path exactly: drop file → Start. P2's targeting lives one deliberate
step in.

**Review (L2, the heart):** "Review" / "Edit" opens a **right-side panel** (Sheet, `max-w-xl`
on desktop) — not an inline accordion — addressable as `/transcriptions?review=<jobId>` so it
is linkable and survives refresh. Structure top-to-bottom:
- **Panel header**: editable title (single input styled as heading), status subline, close (X).
- **Diarization-disabled Alert** when applicable (inventory 42), unchanged copy, amber/info style.
- **Speakers strip**: the rename inputs (inventory 46) as a compact horizontal-wrapping list of
  `color-dot + code raw-label + input` — visible without scrolling because naming speakers is
  the #1 review action.
- **Transcript (the hero)**: the merged speaker blocks (inventory 47) rendered as a scrollable,
  full-height reading surface — each block is a real `<button>` row: colored speaker dot +
  name (live-renamed) + `m:ss` start time + text (`text-sm`, readable, not `text-xs`).
  **Clicking/tapping a block seeks the audio** — this replaces the hover-popup as the primary
  segment↔audio affordance (keyboard- and touch-accessible by construction). The block at the
  current playhead position is subtly highlighted while playing.
- **Sticky audio footer**: native audio controls + the colored segment ribbon with playhead
  (inventory 50-54). Ribbon stays as a navigational overview: click/tap to seek **and** scroll
  the transcript to that block; hover popups remain as a desktop-only enhancement (now
  redundant, not load-bearing).
- **"Details" collapsible (L3)**: Project select + Sharing (RBACControl) — pre-filled, exactly
  today's behavior (inventory 44-45).
- **Panel footer**: ghost "Discard"/"Close" (per mode) + purple "Save"/"Save changes".
  Discard routes through the shared **ConfirmDialog** ("Discard this transcript? The audio stays
  in your files; the transcription job will be cancelled.").

### Disclosure ladder

Every inventory item (1-54) mapped. "Queue" = the L1 list; "Composer" = inline new-transcription
card; "Panel" = the review side panel; "Gallery" = the file gallery dialog.

| # | Capability | Level | Physical location |
|---|------------|-------|-------------------|
| 1 | Header + purpose + library link | L1 | PageHeader; library link relocated to Saved group header ("Transcript library ↗") |
| 2 | New-transcription entry point | L1 | PageHeader primary button (also EmptyState action); no longer morphs to "Cancel" |
| 3 | Active-jobs query + polling | L1 | Queue (Needs review + Processing groups); poll only while active jobs exist |
| 4 | Saved-jobs query | L1 | Saved group; "Load more" affordance past 50 (fixes the silent cap) |
| 5 | Live elapsed / relative timestamps | L1 | Row status lines via shared `RelativeTime` + a row-scoped ticker (no whole-page re-render) |
| 6 | Empty state (no active jobs) | L1 | Group-level quiet line "Nothing processing"; page-level shared EmptyState when zero jobs total |
| 7 | Completed section + re-open explainer | L1 / L2 | Saved group; explainer copy becomes a Tooltip on the group's info icon (it's guidance, not status) |
| 8 | Single-expansion behavior | L2 | Replaced by the single review panel (`?review=` param) — inherently one-at-a-time |
| 9 | Audio file selection (gallery, limit 1, audio types) | L2 trigger, L3 dialog | Composer dropzone "browse" → Gallery dialog |
| 10 | Selected-file chip + clear | L2 | Composer file area (clear gets aria-label) |
| 11 | Title input + autofill | L2 | Composer, always visible |
| 12 | Language select | L3 | Composer → "Options" collapsible |
| 13 | Speaker-count select | L3 | Composer → "Options" collapsible |
| 14 | Project assignment (new job) | L3 | Composer → "Options" collapsible |
| 15 | Target permissions (new job) | L3 | Composer → "Options" collapsible (RBACControl) |
| 16 | Start action + busy + toasts | L2 | Composer footer (purple) |
| 17 | Cancel composer | L2 | Composer footer (ghost) |
| 18 | Gallery: browse uploaded files | L3 | Gallery dialog, left/stacked section |
| 19 | Gallery: filename search | L3 | Gallery dialog search input |
| 20 | Gallery: pagination | L3 | Gallery dialog footer of list |
| 21 | Gallery: upload via Uppy | L3 | Gallery dialog, right/stacked section |
| 22 | Gallery: auto-list/select new uploads | L3 | Gallery dialog (behavior preserved) |
| 23 | Gallery: delete stored file | L3 (destructive) | Always-visible icon button on file card + shared ConfirmDialog (currently hover-only, unconfirmed) |
| 24 | Gallery: view/download file | L3 | Icon button on file card (tooltip + aria-label) |
| 25 | Gallery: selection counter + type gating | L3 | Gallery dialog header line; disabled cards keep tooltip "Not an audio file" |
| 26 | Gallery: empty + skeleton states | L3 | Gallery dialog (shared EmptyState styling) |
| 27 | Gallery: confirm selection | L3 | Gallery dialog footer |
| 28 | RBAC visibility mode picker | L3 | Inside Sharing (Composer Options / Panel Details) |
| 29 | RBAC users search + rights + remove | L3 | Inside Sharing, shown when mode = users |
| 30 | RBAC ">5 users" modal | L4 | Dialog from Sharing section (deep management; acceptable as the one nested overlay only if Sharing is *not* itself in a dialog — it isn't: composer card / side panel) |
| 31 | RBAC roles list + rights | L3 | Inside Sharing, mode = roles |
| 32 | RBAC teams list + rights | L3 | Inside Sharing, mode = teams — **wired through** (page passes 4-arg onChange; mutations gain `target_rbac_teams`) or, if backend can't ship, `allowedModes` excludes teams so the UI stops lying. Either way: no silent data loss |
| 33 | Row identity (icon + title/filename) | L1 | Queue rows |
| 34 | Per-state status labels incl. estimate | L1 | Queue row status line; estimate factor fixed/documented |
| 35 | Full timestamp on saved rows | L2 | shadcn Tooltip on the RelativeTime (works for keyboard/touch via focus/long-press) |
| 36 | Inline error text | L1 | Failed rows, destructive text — never hidden (philosophy §8) |
| 37 | Cancel running job | L2 action, L3 confirm | Row ghost "Cancel" → shared ConfirmDialog ("Stop transcribing? Progress is lost; the audio file stays") |
| 38 | Review awaiting job | L1→L2 | Row outline "Review" → review panel |
| 39 | Edit saved job (speakers etc.) | L1→L2 | Saved row outline "Edit" → review panel (re-save mode) |
| 40 | Dismiss failed job | L2 action, L3 confirm | Failed row ghost "Dismiss" → shared ConfirmDialog (it permanently removes the job record) |
| 41 | Full job fetch + loading | L2 | Panel skeleton mirroring header/speakers/transcript |
| 42 | Diarization-disabled notice | L2 | Alert at top of panel |
| 43 | Editable title | L2 | Panel header input |
| 44 | Project re-assignment | L3 | Panel → "Details" collapsible |
| 45 | Permissions re-editing | L3 | Panel → "Details" collapsible (RBACControl) |
| 46 | Speaker renaming | L2 | Panel speakers strip (top, always visible) |
| 47 | Merged transcript preview | L1-of-panel (L2) | Panel hero: scrollable transcript blocks |
| 48 | Save / finalize + deep-link toast | L2 | Panel footer (purple); toast keeps the item link; saved row additionally gets a persistent "Open in library" link from `saved_item_id` |
| 49 | Discard / Close | L3 (destructive) | Panel footer ghost → shared ConfirmDialog (replaces native `confirm()`); "Close" in re-save mode unchanged |
| 50 | Audio playback (presigned, cached) | L2 | Panel sticky audio footer |
| 51 | Speaker-colored ribbon | L2 | Panel sticky audio footer, above/with controls |
| 52 | Click segment to seek | L2 | Ribbon click + transcript-block click (new primary path) |
| 53 | Segment popup (speaker/time/text) | L4 (desktop enhancement) | Hover-only Tooltip on ribbon; the same information is permanently visible in transcript blocks, so nothing is hover-gated anymore |
| 54 | Live playhead | L2 | Ribbon playhead line + highlighted current transcript block |

### Layout & components

- **PageShell** (centered content variant, `max-w-4xl mx-auto p-6`) → **PageHeader** →
  **Toolbar** (search only) → queue groups (`space-y-8` between groups, `space-y-2` between rows).
- **Rows**: plain bordered list items (`border rounded-lg p-3`, `gap-3` internals) — *not* Cards
  (no nested boxes; the page stays one level of containment). Status dot: 8 px circle,
  `bg-muted-foreground/40` (queued), pulse animation (transcribing), `bg-destructive` (failed),
  none for saved.
- **Composer**: single `Card` (`p-4 space-y-4`); dropzone is a `border-dashed rounded-lg`
  region with `FileAudio` icon (shared **Dropzone** primitive — NEW, see §4); "Options" uses
  shadcn `Collapsible` with a `ChevronRight` rotating 90° on open.
- **Review panel**: shadcn `Sheet` (side="right", `sm:max-w-xl`), internal layout
  `flex flex-col` — header (`p-6 pb-4`), scrollable body (`flex-1 overflow-y-auto px-6 space-y-6`),
  sticky footer (`border-t p-4`: audio + ribbon + actions, `space-y-3`). Transcript blocks:
  `text-sm leading-relaxed`, speaker name `font-medium` with color dot, timestamp
  `text-xs text-muted-foreground font-mono`. Raw speaker labels in `font-mono text-xs`.
- **Form controls**: existing shadcn `Input`, `Select`, `Label`; `Alert` (custom amber via
  existing warning tokens) for the diarization notice; `Tooltip` replaces all `title`
  attributes; `Badge` (secondary) for group counts.
- **ConfirmDialog** (shared primitive) for: cancel running job, dismiss failed job, discard
  transcript, delete gallery file.
- **EmptyState** (shared primitive) for the zero-jobs page and the gallery.
- **Buttons**: header "New transcription" = `default` (purple); row actions = `outline`
  (Review/Edit) and `ghost` (Cancel/Dismiss/Open in library); panel Save = `default`; everything
  destructive confirms. At most two purple elements visible at once (header + open panel's Save).
- **Type/spacing** per CLAUDE.md: `text-2xl` page title, `text-sm` body, `text-xs` meta,
  `font-mono` for raw labels/timestamps; spacing steps 2/4/6/8 as listed above.
- **i18n**: every string through `t('transcriptions.*')`; reconcile nav label with page title
  ("Transcripts" everywhere, or rename the nav key — one word, both locales).

### Mobile behavior

P1's mobile job here (from `personas.md:38-39` plus job 5): *upload a recording from the phone
(voice memos are born on phones), check whether processing finished, and read the result.*

- **< md (≤ 768 px):**
  - PageHeader stacks: title block, then the primary button full-row below (`flex-col gap-4`).
  - Composer: Options grid `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`; dropzone becomes a
    tap target ("Tap to choose an audio file") — same gallery dialog behind it.
  - **Gallery dialog → full-screen Sheet** (bottom, `h-[90dvh]`, internal `overflow-y-auto`):
    upload section first (the phone job is "upload what I just recorded"), gallery below;
    fixes the unscrollable-dialog overflow.
  - **Review panel → full-screen Sheet**: header, speakers strip (horizontal scroll if >3),
    transcript hero, sticky audio footer. Transcript blocks are the segment-reading mechanism —
    no hover required (the ribbon's hover popup is desktop-only sugar, item 53).
  - Ribbon height grows `h-10` → `h-12`; tapping it seeks and auto-scrolls the transcript to
    the matching block (precision comes from the blocks, not the sub-pixel segments).
  - Row action buttons keep ≥40 px hit areas (`size="sm"` with `min-h` bump); status lines clamp
    to two lines (`line-clamp-2`).
- **md–lg:** side-panel review at `sm:max-w-xl`; everything else as desktop.
- No table↔card transforms needed — the queue is already a card-list at every width.

### Motion

Few and purposeful, per CLAUDE.md timings, all gated by `prefers-reduced-motion`:

- **Review panel slide-in** from the right, 300 ms `ease-in-out` (explains origin: the row you clicked).
- **Composer expand/collapse**: height + opacity, 200 ms (explains causality from the header button).
- **Transcribing status dot**: slow 2 s opacity pulse; the 2 px progress strip uses the existing
  gradient-shimmer pattern (streaming-state convention).
- **Row state transitions** (e.g. transcribing → awaiting review on a poll tick): 150 ms
  crossfade of the status line; newly saved rows flash `bg-muted` and fade over 300 ms.
- **Transcript follow-along**: current block highlight swaps instantly (no animation — it tracks
  audio time); programmatic scrolls use `behavior: "smooth"` only when reduced-motion is off.
- Hover/focus on rows and transcript blocks: 150 ms background transition.

---

## 4. Implementation notes

**Files to change/create**
- `app/(application)/transcriptions/page.tsx` — slim down to the page shell (queries + groups + `?review=` param handling); extract into `components/transcriptions/`:
  - `composer.tsx` (items 9-17, incl. Options collapsible),
  - `job-row.tsx` (items 33-40, ConfirmDialogs),
  - `review-sheet.tsx` (items 41-49; transcript hero; Details collapsible),
  - `audio-timeline.tsx` (items 50-54; move out of the page file; add seek-syncs-transcript callback),
  - `use-transcription-jobs.ts` (both queries; conditional `pollInterval` only while queued/transcribing jobs exist; expose `refetchAll`),
  - `use-ticker.ts` or render counters via the shared `RelativeTime` so the 1 s tick is scoped to timestamp components, not the page (`page.tsx:116-121`).
- **Bug/consistency fixes folded in:**
  - Teams RBAC: pass the 4-arg `onChange` and add `target_rbac_teams` to `START/FINALIZE` inputs (`queries/queries.ts:3106-3124`) — **requires backend schema support**; if not available this release, pass `allowedModes={["private","users","roles","public"]}` to `RBACControl` so the broken option isn't offered (no capability is lost — it never worked).
  - Replace native `confirm()` (`page.tsx:754`) and unconfirmed Cancel/Dismiss with shared ConfirmDialog.
  - Reconcile `NEXT_PUBLIC_TRANSCRIPTION_FACTOR` default with its comment (`page.tsx:33-39`) and document the env var.
  - Surface `saved_item_id` as a persistent "Open in library" link on saved rows.
  - Decide `cancelled` handling: show cancelled jobs in the Processing group for one poll cycle with an undo-window toast, or keep them excluded but toast "Transcription cancelled" on the action — pick one so cancellation has visible feedback.
  - `aria-label` on the clear-file button; real Tooltips instead of `title` attrs; transcript blocks as `<button>`s give the review keyboard access.
- `components/uppy-dashboard.tsx` — responsive Sheet variant + `max-h-[90dvh] overflow-y-auto`, delete-file ConfirmDialog, remove `console.log`s. **Shared with agents/knowledge/chat uploads — coordinate.**
- `components/rbac.tsx` — fix context-blind "agent" copy (`rbac.tsx:40-44`): accept a `subjectLabel` prop or neutral copy ("Only you can see this"). **Shared component — coordinate with agents/projects docs.**
- i18n: add `transcriptions.*` to `messages/en.json` + `messages/de.json`; align `navigation.transcriptions` label with the page title.

**Shared components needed**
- From philosophy §5: **PageShell, PageHeader, Toolbar, EmptyState, ConfirmDialog** (this page consumes five; no ListDetail table — the queue-with-side-panel is the ListDetail pattern in its list+panel form).
- Reuse **`RelativeTime`** (proposed in `design/pages/projects.md` §4) for all "X ago" labels with the live-tick behavior moved inside it.
- **NEW shared primitive (flag for philosophy §5): `Dropzone`** — bordered-dashed drag-and-drop file target with click-to-browse fallback and type hint; chat attachments and knowledge item upload want the same surface.
- Page-local (not shared): `AudioTimeline`/transcript-sync — specific enough to stay in `components/transcriptions/`.

**Scope: M.** One route, no new data model; all six mutations/queries exist. The work is one
page decomposition + a Sheet, adoption of five shared primitives, the uppy/rbac shared-component
touch-ups, and i18n. The only backend ask is optional (`target_rbac_teams`); everything else is
frontend-only.

**Dependencies**
- Shell/nav redesign: Transcriptions sits in the **Workspace** group (P1) per `personas.md:187`; no RBAC gate today (`main-nav.tsx:169-174`) — keep it ungated.
- Shared primitives must exist or be built here and promoted (this page is a good early adopter: it exercises PageHeader, Toolbar, EmptyState, ConfirmDialog, and the Sheet-detail pattern at small scale).
- `components/uppy-dashboard.tsx` and `components/rbac.tsx` changes ripple to agents, knowledge, projects, chat — sequence with those page docs.
- Knowledge page doc (`design/pages/knowledge.md`): `/data/transcriptions` is the saved-output destination; the "Open in library" deep links assume that route's item-detail URLs (`/data/transcriptions/[itemId]`) remain stable.
- Backend: `transcriptionJobStart/Finalize` input extension for teams (optional); whisper-server diarization flag drives the item-42 notice.

**Risks**
1. **Ticker/poll refactor regressions** — elapsed counters and "wrapping up" labels depend on the 1 s tick; scoping it to `RelativeTime`/row components must not freeze the transcribing label. Test with a long-running job.
2. **Presigned-URL expiry during review** — the 1-minute cache (`uppy-dashboard.tsx:537-560`) vs. multi-minute review sessions: seeking after expiry can 404 on ranged requests (pre-existing; the sticky audio footer makes it more visible). Mitigate by re-fetching the URL on audio `error` events.
3. **`?review=` param vs. poll refetches** — the panel holds form state (title, speakers) while the underlying job list polls; ensure the panel doesn't remount/reset on poll updates (key the Sheet by job id, fetch job once, don't poll inside the panel).
4. **Shared-component blast radius** — `RBACControl` copy prop and uppy dialog responsiveness touch every consumer; gate mobile variants on viewport only, keep desktop DOM identical.
5. **Teams decision is product-visible** — wiring teams through changes who can see transcripts retroactively edited; hiding the option may surprise users who previously "selected" teams (which never persisted). Either path needs a release note.
6. **Estimate accuracy** — surfacing "~X remaining" more prominently (progress strip) raises expectations; if the deployment's real factor diverges, the label misleads. Keep the `~` and the "wrapping up" fallback, document tuning via `NEXT_PUBLIC_TRANSCRIPTION_FACTOR`.
