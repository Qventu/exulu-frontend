# Transcriptions — Review & Design Concept
**Routes:** `/transcriptions` · `?new=1` · `/transcriptions/review/<jobId>` · `/transcriptions/<itemId>` · `/transcriptions/<itemId>?edit=1`  **Primary persona:** P1 (End User)  **Secondary:** P2 (Power User) — *correction to the ownership matrix, see §2*  **Current state:** Shipped (2026-09-29 redesign, stages 1–2 of `docs/superpowers/specs/2026-09-29-transcripts-redesign-design.md`, backend repo). One list unions in-progress jobs and saved transcripts; one composer dialog covers all three sources; one `TranscriptDocument` component serves the reading view, first review and post-save correction; a five-format export route rounds it out. Stage 3 (admin Transcript settings) and stage 4 (speaker suggestions/merge, the People filter, the project vocabulary list) are deliberately not built.

---

## 1. Current state

Transcriptions is a document library, not a job queue. Recording still goes through upload → transcribe (WhisperX, diarized) → review → save, but "saved" is no longer an exit from the page: the saved output is a **knowledge context item** in the `transcriptions` context, and this feature now reads, corrects, exports and links to it directly. `/data/transcriptions` still exists as the generic knowledge view and is still where "Open in library" points — it just isn't the only way to use a transcript anymore.

**Code surface:**
- `app/(application)/transcriptions/page.tsx` — the home list: tabs, toolbar, in-progress strip, grouped rows, bulk actions.
- `app/(application)/transcriptions/[itemId]/page.tsx` — the reading view, and (with `?edit=1`) post-save correction.
- `app/(application)/transcriptions/review/[jobId]/page.tsx` + `job-to-draft-item.ts` — first review of a job, before it becomes an item.
- `app/(application)/transcriptions/components/transcript-document.tsx` — the one component behind both of the above (`mode="read" | "edit"`); the largest file in the feature.
- `app/(application)/transcriptions/components/new-transcript-dialog.tsx` + `composer.tsx` / `meeting-composer.tsx` / `record-composer.tsx` — the composer and its three sources.
- `app/(application)/transcriptions/components/export-menu.tsx` — Copy text + five downloads, calling the backend's `GET /transcription-items/:itemId/export`.
- `app/(application)/transcriptions/components/{speakers-panel,find-replace,review-checklist,post-processing-results,ask-box,audio-timeline,meeting-video-player,in-progress-strip,transcript-row,job-row,file-gallery,file-gallery-dialog}.tsx` — the rest of the surface area; each is documented at its own top.
- `hooks.ts` — every `useQuery`, polling policy and refetch (`useTranscripts`, `useTranscriptItem`, `useRecordingUsage`, `useProjectOptions`, `useTicker`, `usePostProcessingOptions`); pages never call `useQuery` inline (`design/codebase-structure.md` §3.2).
- `types.ts` — the pure, unit-tested core: `mergeTranscriptRows`, `filterTranscriptRows`, `groupTranscriptRows`, `canWriteTranscriptItem`, `applyFindReplace`, `effectiveSegments`, and the `TranscriptRow`/`TranscriptItemDetail` shapes.
- `queries.ts` — every GraphQL document; `linkify.ts` — `[mm:ss]` citation parsing shared by the reading view and post-processing output.
- Nav: `components/shell/nav-config.ts` (`flagEnabled`, case `"transcriptions"`) — shown when **any** of `config.transcription.enabled` (Record on this device), `config.recall.enabled` (meeting bot) or `config.whisper.enabled` (upload) is on; `layout.tsx` guards the route with the identical flag via `guardRoute("transcripts")`, so a direct URL hit is denied too when nothing at all is configured, not just hidden from nav.

**RBAC summary:** two stores, two rights models, unioned client-side (§1.1 of the spec). In-progress work lives in `transcription_jobs`, which is **creator-only** — only the recorder (or a super-admin) ever sees a running or failed job. Once a job is saved it becomes a `transcriptions_items` row, which is **RBAC'd** per user/role exactly like any other knowledge item (`created_by`/`rights_mode` via `addCoreFields`). This is why "Shared with me" and the Mine/Shared tabs need no new backend query — the rights already exist on the item — and why post-save correction (`[itemId]?edit=1`) is gated by the generic item write rule (`canWriteTranscriptItem`, a client-side mirror of the backend's `validateWriteAccess`) rather than by job ownership. Teams sharing stays hidden in every composer/edit surface here (the backend doesn't store `target_rbac_teams`); an item that already carries `rights_mode: "teams"` from outside this feature still renders correctly (read-only) but cannot be produced from here.

### Functionality inventory

This list is the contract. Every numbered item must appear in the disclosure ladder (§3).

**Home list (`page.tsx`, `hooks.ts`, `types.ts`)**
1. Union data spine: `useTranscripts` runs the creator-only jobs query and the RBAC'd `transcriptions_itemsPagination` query and `mergeTranscriptRows` unions them into one `TranscriptRow[]`; a job that already produced an item contributes nothing (matched by `job_id`, `saved_item_id`, or `status === "saved"/"cancelled"`), which is what keeps the union duplicate-free.
2. Polling discipline: only the jobs query polls, every 5 s, and only while something is `queued`/`transcribing`/`recording`; the items query never polls.
3. Tabs: All / Needs review (amber count badge) / Mine / Shared with me, via `filterTranscriptRows` over `createdBy`.
4. Search: server-side `contains` filter on the items query's `name`; in-progress job rows aren't filtered by it and stay visible regardless.
5. Filters: Source, Project, Date, applied client-side over the loaded page. **People is not built** — speaker names live in an unstructured `speakers` JSON map, so a filter over it would silently miss renames (stage 4).
6. Grouping: This week / Earlier by `recordedAt`, 7-day cutoff (`groupTranscriptRows`); a scheduled meeting bot's future `join_at` still sorts into This week.
7. Pagination: 50 items per page, "Load more" appends via the items query's `hasNextPage`.
8. In-progress strip: `recording`/`queued`/`transcribing` rows collapse behind one "N in progress" disclosure row with a per-state summary; `failed` rows are never folded away and always render below it with their own recovery action.
9. Recovered-job link: the 2026-09-22 "reported lost" fix — when a failed meeting job exists, one targeted query looks for a later `saved` job sharing its `meeting_url`, and the failed row links to "already saved as …" when found.
10. Row anatomy: checkbox (disabled + tooltip for job rows — bulk actions apply to items only), title, amber "Needs review" badge, one summary line (first line of a post-processing output, when one exists), a meta line that degrades quietly on a null pre-backfill field, an access indicator (Only you / Everyone / Shared with you / N people / role label), one action button.
11. Bulk actions: select item rows, then Archive / Delete / Set access from the dark `ItemsActionBar` + `BulkAccessDialog` (`components/widgets/`, promoted there so this feature-local page can use them without crossing the feature-isolation lint rule) via the generic `itemsBulkUpdateRBAC` mutation — no re-embed, atomic.
12. Monthly recording usage bar: shown only when Recall is enabled **and** a cap is configured; hidden entirely otherwise, never a bogus "0 of 0 used".
13. Overflow menu: "…" next to the header's New-transcript button links out to `/data/transcriptions`.
14. Legacy link: an old `?review=<jobId>` query param redirects to `/transcriptions/review/<jobId>` on mount, so pre-redesign bookmarks and shared links still resolve.

**Composer (`new-transcript-dialog.tsx`, `composer.tsx`, `meeting-composer.tsx`, `record-composer.tsx`)**
15. One dialog, three sources: `?new=1` opens a 680 px `Dialog` with a source `ToggleGroup` (Upload a file / Invite a meeting bot / Record on this device); each source is gated by its own backend flag.
16. Unconfigured sources stay visible: a disabled `ToggleGroupItem` carries a "not set up" tooltip instead of disappearing; if every source is off, the body shows a quiet not-set-up note. The "ask an admin" guidance is plain text, not a link — there is no admin settings page yet that exposes these flags (stage 3), so linking anywhere would be a dead end.
17. Options collapsible per source: project, sharing, and (for uploads) language/speaker-count collapse behind one `<button aria-expanded>` summarizing the current values inline, so the common path is drop file → Start.
18. Recording pin: while a "Record on this device" session is active, the dialog stays open regardless of the URL (Escape/overlay/✕ can't dismiss it) because the close-out (upload + `liveRecordingStop`) must finish before the surface can safely unmount. Predates this plan; unchanged by it.
19. Post-processing: the meeting and record composers can attach prompt+agent pairs that auto-run once the transcript is ready.

**Reading view (`[itemId]/page.tsx`, `transcript-document.tsx`, read mode)**
20. Header: title, Share (an access-pill popover backed directly by the shared `RBACControl` primitive), Export ▾, "…" overflow (Correct text and speakers → `?edit=1`, Move to project, Open in library, Delete).
21. Chapters column: parsed from a post-processing output whose markdown has a `## Chapters` heading; the column simply doesn't render when no output supplies one.
22. Summary / Action items: the remaining post-processing outputs, rendered as markdown; `[mm:ss]` citations are linkified into buttons that seek the player.
23. Transcript: segments merged into consecutive-same-speaker blocks.
24. Right column: the meeting video or audio player, then the ask box.
25. Ask about this transcript: an agent picker (agents that already search the `transcriptions` context first, under "Can search Transcriptions"; everyone else under "attach only"), two suggested questions, Send navigates to `/chat/<agentId>?items=transcriptions/<itemId>&q=<question>`.
26. Read-only notice: a viewer who can read but not correct never sees a Save button — `canWriteTranscriptItem` decides this ahead of render; a server rejection is still caught and shown as a plain message as a backstop.

**Review & correction (same component, `mode="edit"`, at `review/[jobId]` and `[itemId]?edit=1`)**
27. One component, two entry points: first review of a job (seeded by the pure `jobToDraftItem` adapter) and post-save correction render the identical edit UI; only the save mutation differs (`FINALIZE_TRANSCRIPTION_JOB` vs. the generic item update).
28. Inline correction: click a block to turn it into a textarea; blur commits to local state, Escape reverts; only `text` ever changes — `start`/`end`/`speaker` are preserved so timestamps and the audio ribbon survive a correction.
29. Find and replace: hidden behind a button; find/replace/match-case drive a live match count as you type, Replace all applies it. The "remembered for the project" vocabulary list is stage 4 and does not exist.
30. Review checklist: a header status pill/popover deriving title-set / speakers-named / summary-present / sharing-chosen from local draft state; purely informational — nothing on it blocks Save.
31. Speakers panel: one row per distinct raw speaker label, one open at a time — name input, "Hear" (seeks the player to the speaker's first block, plays ~4 s), talk share. Suggestions from earlier transcripts and a Merge control are stage 4 and do not exist.
32. Details section: project + sharing as local draft state, applied only on Save (unlike the reading view's immediate-apply popovers).
33. Pinned footer: the audio/video player plus Save / Discard; Discard confirms through the shared `ConfirmDialog`.
34. Post-processing re-run: shown above the document on the job-review route only, since it needs the real `Job`, not the item-shaped props `TranscriptDocument` takes.
35. Sharing round-trips: a job's chosen `target_rbac_users`/`target_rbac_roles`/`target_rights_mode` seed the edit draft, so an unchanged first review saves the same sharing the user picked in the composer, byte for byte.
36. Stale-save guard: the correction page refetches on window focus; if the item's `updatedAt` moved since the edit session began, Save confirms before overwriting rather than silently clobbering someone else's change.
37. Stale-job redirect: landing on `review/<jobId>` for a job that's already saved (a stale link) redirects to that item's own page instead of showing a stale review UI.

**Export (`export-menu.tsx`, backend `GET /transcription-items/:itemId/export`)**
38. Five formats: Markdown, Word (.docx), PDF, CSV, SRT, all built server-side from the same markdown builder Copy text also calls, so the clipboard and the `.md` download can never diverge.
39. Three Include toggles: Summary and action items, Timestamps, Speaker names — all default on, persisted per browser in `localStorage`.
40. Authenticated download: each format is fetched with a bearer token and handed to the browser as a blob download, not a plain link/navigation — the export route authenticates only via headers, so a bare navigation would 401 and replace the app with a raw error page.

### UX review

The June-2026 findings below are closed. What follows is what's actually still open, as of this redesign.

**Resolved by this redesign (kept here for the record, not as open items)**
- Zero i18n, teams-sharing data loss, unconfirmed destructive actions, and the review transcript being visually last and smallest are all gone: every string is translated, teams stays hidden rather than lying, every destructive action confirms via `ConfirmDialog`, and the transcript is the centre column at real reading size in both read and edit mode.
- Cancelled jobs no longer vanish silently: `toasts.cancelled` fires and the row leaves both lists on refetch instead of lingering as an unreachable status.
- `saved_item_id` is no longer toast-only: the reading view is now a real page at `/transcriptions/<itemId>`, and "Open in library" is a persistent link, not a five-second toast.

**Known gaps (deliberate, per the spec's Out of scope §9 — not bugs)**
- No People filter on home (speaker names aren't structured data yet).
- No speaker-name suggestions or Merge control in the speakers panel.
- No "remembered for the project" find-and-replace vocabulary list.
- No admin Transcript settings page — the three source flags are backend env vars with no UI, which is exactly why addition (1) above demotes the composer's "ask an admin" copy to plain text instead of a link.
- Video/audio retention, workspace-level sharing defaults, and per-deployment bot name/notice are still env-var only.

**Open follow-ups (tracked, not blocking; see the plan's progress ledger for detail)**
- No live backend click-through has verified all five export formats end-to-end, or a full phone pass of the composer, reading view and review page — deferred to manual QA after this task.
- `rights_mode: "teams"` on a pre-existing item renders more restrictively here than the server enforces (a team member with a write grant is locked out in this UI); mitigated today because this feature never produces that mode itself.
- An inline block edit writes the whole block's text onto its first segment, so an SRT/VTT export times a multi-segment correction only to that first segment's slice — fine for reading, worth a note before subtitle timing is relied on more heavily.
- The backend's correction-resolution logic (`transcriptionService.finalize`) has no dedicated test harness, so it's the least-covered code in the change; flagged in the plan's ledger as the highest-value backend follow-up.

### Mobile audit (per the spec's phone-verification requirement)

- Row actions and the composer's toggle/collapsible controls use `max-md:h-11`-style sizing throughout for ≥44 px touch targets, not just desktop `size="sm"`.
- The header's "New transcript" action is duplicated into the mobile top bar (`MobileTopbarAction`) rather than relying on a header that might wrap off-screen.
- The file gallery becomes a full-screen bottom `Sheet` (`h-[90dvh]`) below `md`, upload section first, instead of the two-column desktop dialog.
- **Verdict: not yet independently verified.** The spec calls for "manual verification for every screen, on desktop and a phone" (§7); that pass is open, not part of this task.

---

## 2. Jobs to be done

**P1 — End User (primary).** Persona job 5: "Transcribe audio and use the transcript."
Ranked jobs on this page:
1. Upload a recording and get a transcript started (weekly-to-daily for meeting-heavy users).
2. Review the finished transcript: name the speakers, skim/verify against the audio, save.
3. Check progress of a running transcription ("is it done yet?") — often the *mobile* visit.
4. Re-open a saved transcript to fix speaker names, correct text, or sharing.
5. Find the saved transcript to use it — read it, ask a question about it, export it, or attach it in chat — without leaving this feature; `/data/transcriptions` is still there for the generic knowledge-browsing case, and "Open in library" links out to it.

**P2 — Power User (secondary).** The output is RAG content: P2 cares that transcripts land in
the right **project**, with the right **sharing**, so agents and teammates
can use them (persona jobs 4 and 2). P2 also re-curates: re-opening saved transcripts to fix speaker
labels that pollute retrieval quality. These fields live one deliberate step
in (the composer's Options collapsible, the edit page's Details section) rather than cluttering the P1 happy path.

**Primary persona and #1 job in one sentence:** *P1 turns a recording into a correctly
speaker-labeled transcript with as little ceremony as possible.*

**Ownership matrix correction:** `personas.md:154` lists `/transcriptions` as P1 with secondary
"—". That is wrong: **P2 is a real secondary owner** — project targeting, RBAC sharing, and
speaker-label quality exist for the knowledge/RAG pipeline, which is P2's domain (persona job 4).
The correction should flow back to `personas.md`.

---

## 3. Design concept

**Concept headline: "One library, one document."** Every recording — mid-transcription, awaiting
review, or long since saved — is one row in one list, and every saved recording is the same
document component whether you're reading it, correcting it, or reviewing it for the first time.
Configuration (source, project, sharing, language) folds behind one collapsible per surface so the
common path stays a single action: drop a file, or press Start, or open a saved row.

### Default view (L1)

Single list at `/transcriptions` (`PageShell variant="content"`) — no more three permanently-named
status groups. Top to bottom: `PageHeader` (title, purpose line, overflow "…" → library link, "New
transcript" primary action); the optional monthly-recording-usage bar; a `Tabs` + `Toolbar` row
(All / Needs review / Mine / Shared with me, search, Source/Project/Date filters, and — once
something is selected — the bulk action bar in the toolbar's own selection slot); the
`InProgressStrip`; then the list itself, grouped This week / Earlier, each row a `TranscriptListRow`;
a "Load more" footer past the first page. An `EmptyState` covers the zero-rows case, and a quieter
inline one covers "no rows match this tab/filter/search" without losing the chrome around it.

**The composer (L2):** "New transcript" opens `NewTranscriptDialog` — a modal `Dialog`, not an inline
card, because it now has to host three genuinely different flows (file upload, meeting-bot invite,
on-device recording) behind one switch. Each source keeps its own required field on top (file /
meeting URL / big Start button) with an "Options" collapsible for project, sharing, language and
speaker count, summarized inline so nobody needs to open it for the default path. An active
on-device recording pins the dialog open across navigation and URL changes until its close-out
finishes.

**Reading view (L2):** opening a saved row goes to `/transcriptions/<itemId>` — a full page, not a
side panel. Header (title, Share, Export ▾, "…"), a left chapters column, a centre column that is
the transcript itself at real reading size (preceded by any Summary/Action-items post-processing
output), and a right column with the player and the "Ask about this transcript" box. "Open in
library" in the overflow menu is the only remaining link to `/data/transcriptions/<itemId>`.

**Review & correction (L2, edit mode):** the exact same component, `mode="edit"`, reached two ways —
first review of a job at `/transcriptions/review/<jobId>` (a full page; post-processing re-run sits
above it), and correcting an already-saved transcript at `/transcriptions/<itemId>?edit=1`. The right
column becomes the speakers panel; the centre column gains inline click-to-edit blocks and a
find-and-replace trigger; a header checklist pill reports readiness without blocking Save; a pinned
footer holds the player and Save/Discard. A viewer who can read but not write never sees this mode at
all — the page silently stays in read mode with an explanatory notice instead.

**Export (L2 trigger, L3 detail):** the reading view's Export ▾ opens `ExportMenu` — Copy text plus
five format downloads, with three Include toggles tucked below them. One request-time builder on the
backend serves every format and the clipboard, so they can't drift apart.

### Disclosure ladder

Every inventory item (1–40) mapped. "List" = the home page; "Composer" = `NewTranscriptDialog`;
"Document" = `TranscriptDocument` (read or edit mode, per item); "Export" = `ExportMenu`.

| # | Capability | Level | Physical location |
|---|------------|-------|-------------------|
| 1 | Union data spine (jobs ∪ items) | L1 | List, invisible to the user by design — it's what makes one list correct |
| 2 | Polling only while something is in motion | L1 | List, invisible |
| 3 | Tabs (All / Needs review / Mine / Shared) | L1 | List header row |
| 4 | Search | L1 | List Toolbar |
| 5 | Filters (Source, Project, Date) | L2 | List Toolbar, behind the Filter control |
| 6 | This week / Earlier grouping | L1 | List, section headers |
| 7 | Pagination / Load more | L1 | List footer, once a page is full |
| 8 | In-progress strip (collapsed running, always-visible failed) | L1 | List, above the grouped rows |
| 9 | Recovered-job link | L2 | In-progress strip, on the affected failed row only |
| 10 | Row anatomy (identity, badge, summary, meta, access, action) | L1 | Every `TranscriptListRow` |
| 11 | Bulk actions (archive/delete/set access) | L2 | Toolbar selection slot, once ≥1 item row is checked |
| 12 | Monthly recording usage bar | L1 (conditional) | Below `PageHeader`, only when Recall + a cap are both configured |
| 13 | Overflow → library link | L3 | `PageHeader`'s "…" menu |
| 14 | Legacy `?review=` redirect | L1, invisible | Runs on mount, no UI of its own |
| 15 | One dialog, three sources | L2 | Composer, `ToggleGroup` |
| 16 | Unconfigured-source handling + plain-text admin note | L2/L3 | Composer, disabled toggle item / not-set-up body |
| 17 | Options collapsible (project, sharing, language, speakers) | L3 | Composer, per source |
| 18 | Recording pin | L2, invisible | Composer, controls its own `open` prop |
| 19 | Post-processing prompts (meeting/record) | L3 | Composer Options, meeting/record only |
| 20 | Reading-view header (Share, Export, overflow) | L1 | Document, read mode header |
| 21 | Chapters column | L1 (conditional) | Document, read mode left column, only when present |
| 22 | Summary / Action items | L1 | Document, read mode centre column, above the transcript |
| 23 | Transcript (merged speaker blocks) | L1 | Document, read mode centre column, the hero |
| 24 | Video/audio player | L1 | Document, read mode right column |
| 25 | Ask about this transcript | L2 | Document, read mode right column, below the player |
| 26 | Read-only notice | L1 (conditional) | Document, in place of edit-mode chrome when `canWrite` is false |
| 27 | One component, two edit entry points | L1/L2, invisible | Routing only — `review/[jobId]` vs `[itemId]?edit=1` |
| 28 | Inline correction | L2 | Document, edit mode, click any transcript block |
| 29 | Find and replace | L3 | Document, edit mode, behind its trigger button |
| 30 | Review checklist | L2 | Document, edit mode header pill/popover |
| 31 | Speakers panel | L2 | Document, edit mode right column |
| 32 | Details (project + sharing draft) | L3 | Document, edit mode, collapsible section |
| 33 | Pinned footer (player + Save/Discard) | L1 | Document, edit mode, sticky footer |
| 34 | Post-processing re-run | L2 (conditional) | Job-review route only, above the document |
| 35 | Sharing round-trip from the composer | L1, invisible | Job-review route, `jobToDraftItem` |
| 36 | Stale-save guard | L3 (destructive-adjacent) | Correction page, `ConfirmDialog` on a real conflict |
| 37 | Stale-job redirect | L1, invisible | `review/[jobId]`, on mount |
| 38 | Five export formats | L2 | Export menu, format list |
| 39 | Include toggles | L3 | Export menu, below the format list |
| 40 | Authenticated blob download | L1, invisible | Export menu, every download/copy action |

### Layout & components

- **List:** `PageShell variant="content"` → `PageHeader` → optional usage bar → `Tabs` + `Toolbar`
  (search, filters, selection slot) → `InProgressStrip` → grouped `TranscriptListRow` lists.
- **Composer:** shadcn `Dialog` (`sm:max-w-[680px]`), a `ToggleGroup` source switch, per-source
  `Dropzone` (upload) or big Start button (record), a `Collapsible` Options section with
  `motion-reduce`-gated open/close animation.
- **Document:** three-column grid below a sticky header (read mode) or above a pinned footer (edit
  mode); `Popover` for the access pill and the agent picker; `Collapsible` for chapters and the edit
  Details section; `ConfirmDialog` for discard/delete/stale-save.
- **Export:** `DropdownMenu` triggered from the header's Export ▾.
- **Shared primitives used throughout:** `PageShell`, `PageHeader`, `Toolbar`, `EmptyState`
  (default/quiet/error variants), `ConfirmDialog`, `Dropzone`, `StatusDot`, `RelativeTime`,
  `Skeleton` loading states, `MobileTopbarAction`. All pre-existed or were promoted to
  `components/widgets/` (`ItemsActionBar`, `BulkAccessDialog`) during this plan rather than
  duplicated feature-locally.
- **Buttons:** header "New transcript" and Save/Start are the page's `default` (purple) actions;
  row/menu actions are `outline`/`ghost`; every destructive action routes through `ConfirmDialog`.

### Mobile behavior

- `PageHeader` stacks; the primary action is duplicated into `MobileTopbarAction` so it's reachable
  without scrolling to the header.
- Composer Options collapse to one column below `sm`; the file gallery becomes a full-screen bottom
  `Sheet` (`h-[90dvh]`) with the upload section first.
- The document's three columns stack to one on mobile (chapters → transcript/summary → player/ask or
  speakers), with the pinned footer (edit mode) or player (read mode) staying reachable.
- Row and composer controls use `max-md:h-11`-style sizing for ≥44 px touch targets below `md`.
- Not yet independently phone-verified end to end — see the Mobile audit above.

### Motion

Few and purposeful, all gated by `prefers-reduced-motion` (`motion-reduce:` variants throughout):

- **Collapsible sections** (composer Options, edit-mode Details, chapters): height + rotation via the
  shared `animate-collapsible-down`/`-up` utility classes.
- **Dialog / Popover / DropdownMenu:** Radix's default fade/scale-in, unchanged from the design
  system defaults — no custom transitions layered on top.
- **In-progress strip:** a pulsing `StatusDot` on the collapsed disclosure row while anything is
  actually running; no animation once everything shown is static (saved/failed).
- **Inline block editing:** no transition — a block becomes a textarea instantly on click, since any
  delay there would read as lag on the page's most-used interaction.

---

## 4. Implementation notes

This redesign is implemented, not proposed. What follows is the as-built map and what's
intentionally still missing, not a build plan.

**Backend companion:** `docs/superpowers/specs/2026-09-29-transcripts-redesign-design.md` (this
plan's spec, backend repo) — five denormalised columns + `corrected_segments` on
`transcriptions_items`, `corrected_segments` on `transcription_jobs`, the
`GET /transcription-items/:itemId/export` route, and `renderTranscript`'s `withTimestamps` option.
No new tables, no new resolvers beyond the one export route. Deploy backend before frontend (the
frontend degrades gracefully without it: no export route → the Export menu would fail its requests;
no new columns → rows lose their meta line).

**Files** — see §1's Code surface for the full list; nothing here still describes files that were
deleted or never built. Notably gone: `review-sheet.tsx` (its block-merge logic, speaker state and
`AudioTimeline` pinning moved into `transcript-document.tsx` and `speakers-panel.tsx`).

**Deliberately not built (spec §9 "Out of scope")**
- Stage 3: admin Transcript settings (so the three source flags stay backend-only), post-processing
  for uploads, workspace-level sharing/summary defaults, video retention configuration.
- Stage 4: speaker-name suggestions and Merge, the People filter, per-user/per-project usage,
  unreviewed-transcript reminders, highlight actions (Add note, Turn into task), calendar scheduling,
  interactive action-item checkboxes, the "remembered for the project" find-and-replace vocabulary
  list.
- Unchanged by any of this: the transcription engines, diarization, the Recall integration, chat
  dictation, the training-guide flow, live transcripts across devices, and teams sharing.

**Known follow-ups (not blocking, worth tracking)**
1. Manual phone + live-backend verification (all five export formats, the full composer/reading/
   review flow on a real device) is still open.
2. `rights_mode: "teams"` renders more restrictively here than the server enforces for a pre-existing
   item; revisit if teams sharing for transcripts is ever actually offered again.
3. Inline block correction maps onto the block's first segment only — fine for reading, worth a note
   before SRT/VTT timing on a multi-segment correction is relied on.
4. The backend's `finalize` correction-resolution logic has no dedicated test harness; the two real
   bugs found while building this plan both lived there (see the plan's progress ledger, Task 11).
5. `job-row.tsx` still carries a `job.status === "saved"` rendering branch (Delete / Open in library /
   Edit for a saved job row) that may now be unreachable in practice — `mergeTranscriptRows` filters
   `status === "saved"` jobs out before `InProgressStrip` (the only caller of `JobRow`) ever sees them.
   Not removed here: confirming it's truly dead requires tracing every caller, which is outside a
   copy/vocabulary pass — flagged for whoever next touches `job-row.tsx`.

**Risks (carried forward, largely mitigated already)**
1. **Union correctness** — the list must never show a saved job twice (once as a job, once as an
   item) or drop one. Covered by `mergeTranscriptRows`' unit tests (duplicate-free union, the
   `claimedJobIds`-only race) rather than by inspection alone.
2. **Write-access mirroring** — `canWriteTranscriptItem` duplicates backend logic on the client so a
   read-only viewer never sees a Save button. A client mirror can drift from its server source; it's
   documented as a mirror (naming both backend files) specifically so a future backend RBAC change
   doesn't silently desync it.
3. **Export authentication** — the export route accepts only header-based auth, so the menu must stay
   on the authenticated-fetch-plus-blob pattern rather than a plain link; regressing to
   `window.location.href` here would 401 and blank the app.
