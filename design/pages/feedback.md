# Feedback — Review & Design Concept
**Routes:** `/feedback` (review console). Submission surfaces that feed it live elsewhere: chat message thumbs (`/chat/[agent]/[session]`) and the global sidebar feedback dialog (shell footer).  **Primary persona:** P3 Admin (review/triage)  **Secondary:** P2 Power user (quality signal for their agents); P1 End user only on the *submission* surfaces, never on this route  **Current state:** a functional but untranslated, desktop-only admin table that hides below 768px, dresses positive feedback in accent purple, dead-ends investigations inside a sheet (no jump to the session), and fetches 2,000 lookup records to populate two dropdowns.

The "Feedback" area is really three surfaces sharing one name:

1. **Message feedback (submit, P1/P2):** thumbs up/down on assistant messages in chat → a dialog → `feedbackCreateOne`. This is the data the `/feedback` page reviews.
2. **Product feedback (submit, all):** the sidebar-footer "Feedback" button → a bug/feature chooser → an agent-driven chat against a *separately configured* feedback backend. This data never reaches `/feedback`; it goes to the feedback agents.
3. **Review console (`/feedback`, P3):** table + detail sheet + delete over the message-feedback records.

The special question — "who is this page for?" — is answered by the code: **the route contains zero
submission capability**. It is P3's review console. The redesign keeps all three surfaces, sharpens
the naming so admins stop seeing two different things both labeled "Feedback", and turns the review
console into a proper triage tool (negative-first scanability, conversation replay, jump-to-session).

---

## 1. Current state

### Functionality inventory

Numbered contract — nothing on this list may be lost. File paths relative to repo root.

**A. Submission surface 1 — message thumbs in chat (feeds this page)**

1. Thumbs up / thumbs down `MessageAction` buttons on chat messages, rendered **only when the
   agent has `feedback: true`** in its config (`components/message-renderer.tsx:1128-1146`; gate at
   `:1129`; agent field `feedback` in `AGENT_FIELDS`, `queries/queries.ts:118`). Both buttons carry the
   same label "Feedback" (`message-renderer.tsx:1133,1140`).
2. Clicking a thumb opens the chat feedback modal pre-loaded with `{session, agent, score 1|0}`;
   for **negative** feedback the message text is regex-scanned for referenced knowledge items
   (`item_id`/`item_name`/`context` blobs) and they are attached to the modal
   (`app/(application)/chat/[agent]/[session]/chat.tsx:1064-1077`, extraction at `:1684-1718`).
3. Feedback modal (`chat.tsx:1466-1538`): title/description switch on score — "What did you like?" /
   "What could be improved?" (`:1475-1481`); required free-text `Textarea` (`:1484-1488`); Cancel
   (`:1515-1523`); Submit disabled while the mutation runs **or while the text is empty** —
   score-only feedback is impossible (`:1525-1529`). Submit fires `CREATE_FEEDBACK`
   (`feedbackCreateOne`, `queries/queries.ts:355-363`) with `{session, score, agent, description,
   user: user.id}`, then success toast + reset; failure → destructive toast with error message
   (`chat.tsx:788-821`).
4. Negative-feedback "Sources referenced in this response" panel inside the modal
   (`chat.tsx:1489-1513`): amber warning that deactivating archives the item **globally**; scrollable
   list of `ReferencedSourceRow`s, each with item name, context, and a destructive **Deactivate**
   button that runs `UPDATE_ITEM(context)` with `{archived: true}`, flips to a disabled "Deactivated"
   outline state, and toasts success/failure (`chat.tsx:1720-1768`).
5. Escape-key handling closes the feedback modal before other chat overlays (`chat.tsx:324-337`).

**B. Submission surface 2 — global sidebar feedback dialog (`components/feedback/`)**

6. Sidebar-footer "Feedback" item (`MessageSquarePlus` icon, tooltip + `aria-label`, label hidden
   when sidebar collapses to icons), rendered for **every authenticated user** but only when
   `config.feedback.enabled` (`components/feedback/feedback-button.tsx:19-37`; mounted in
   `SidebarFooter` at `components/custom/main-nav.tsx:510`).
7. `FeedbackDialog`: `max-w-2xl h-[80vh]` dialog with two internal views (`choice` → `chat`); all
   state (view, kind, session id) resets when the dialog closes; title switches between "Send
   feedback" / "Bug report" / "Feature request" via i18n
   (`components/feedback/feedback-dialog.tsx:20-64`). Translated en + de
   (`messages/en.json:184-206`, `messages/de.json:184-206`) **with two exceptions that bypass
   i18n**: the error `Alert` title "Error" (`feedback-chat.tsx:148`) and the fallback error
   message "An unexpected error occurred. Please try again." (`feedback-chat.tsx:59-61`).
8. `FeedbackChoice`: two large card-buttons — **Feature request** (Lightbulb) and **Bug report**
   (Bug) — with description copy, `hover:border-primary`, visible focus rings, `grid-cols-1
   md:grid-cols-2` (`components/feedback/feedback-choice.tsx:10-52`). Choosing one mints a
   `crypto.randomUUID()` session id (`feedback-dialog.tsx:34-38`).
9. `FeedbackChat`: a real streaming agent chat (`useChat` + `DefaultChatTransport`) against the
   configured feedback backend — distinct slug/id per kind (`fb.bugAgentSlug/Id` vs
   `fb.featureAgentSlug/Id`), endpoint `${fb.backend}/agents/{slug}/run/{id}`, auth via
   `exulu-api-key: fb.token` plus `User`/`Session`/`Stream` headers
   (`components/feedback/feedback-chat.tsx:36-82`). Every message carries a `feedbackContext`
   payload: user email, current page URL, app version, kind (`:42-50`).
10. Chat affordances (`feedback-chat.tsx:110-189`): Back button to the chooser (`:112-122`);
    kind-specific empty-state copy and input placeholder (`:101-108,126-129`); `MessageRenderer`
    with actions/tokens/edit/remove disabled (`:131-138`); destructive error `Alert` that parses
    backend `detail`/`message` JSON (`:53-63,144-152`); autosizing textarea 1–6 rows, Enter sends,
    Shift+Enter newline (`:86-99,156-165`); composer disabled while a message is submitted but
    not yet streaming (`disabled={isBusy && status === "submitted"}`, `:164`); send button
    disabled when empty (`:176-186`); **Stop** button replaces send while streaming (`:166-175`);
    **scroll-to-bottom** `ConversationScrollButton` over the conversation (`:141`).
11. Config plumbing: `FeedbackConfig {enabled, backend, token, featureAgentSlug, featureAgentId,
    bugAgentSlug, bugAgentId}` delivered to the client through the server `/config` fetch
    (`util/api.ts:50-58`; `components/config-context.tsx:9`). Both `FeedbackButton` and
    `FeedbackChat` independently null-render when `feedback.enabled` is false
    (`feedback-button.tsx:19`, `feedback-chat.tsx:35-36`).

**C. Review console — `/feedback` route**

12. Sidebar nav item "Feedback" (ThumbsUp icon, translated label `navigation.feedback`) visible
    **only when `user.super_admin`** (`components/custom/main-nav.tsx:161-167`). There is **no
    `feedback` permission area in the role model** (`components/role-form.tsx` PERMISSION_AREAS has
    no feedback key) — gating is super-admin-or-nothing. The page itself has **no client-side
    guard**: any user who types the URL renders the shell, and only backend GraphQL authorization
    stands between them and the data (`app/(application)/feedback/page.tsx` — 23 lines, no role
    check).
13. Page: client component, `export const dynamic = "force-dynamic"` (`feedback/page.tsx:5`);
    header `h2` "Feedback" + description "Review and manage user feedback from chat sessions."
    — hard-coded English, no i18n (`page.tsx:13-16`); page root is
    `hidden h-full flex-1 flex-col space-y-8 p-8 md:flex` — **renders nothing below `md`**
    (`page.tsx:10`).
14. Server-paginated feedback table: hard-coded `limit: 20`, hard-coded sort `createdAt DESC`,
    `fetchPolicy: "no-cache"` + `nextFetchPolicy: "network-only"`, **30-second polling**
    (`feedback/components/data-table.tsx:101-114`; `GET_FEEDBACK` at `queries/queries.ts:195-215`).
    Stale-while-loading: previous page's rows shown while a refetch is in flight
    (`data-table.tsx:140-149`).
15. Lookup queries to power filters and name resolution: `GET_AGENTS` with `limit: 1000`
    (`data-table.tsx:117-122`) and `GET_USERS` with `limit: 1000` (`data-table.tsx:125-130`).
16. Search input "Search feedback..." (`w-[250px]`) builds a server-side
    `{description: {contains}}` filter, **refetching on every keystroke**, resetting to page 1;
    value is read back out of the filters array (`data-table.tsx:305-319,371-381`).
17. Type filter `Select` (`w-[150px]`): All Types / Positive / Negative → server filter
    `{score: {eq: 1|0}}` (`data-table.tsx:321-334,383-401`).
18. User filter `Select` (`w-[200px]`): All Users + every user (name or email fallback) → server
    filter `{user: {eq: parseFloat(id)}}` — numeric cast of the id (`data-table.tsx:336-349,
    403-420`; cast at `:343`).
19. Agent filter `Select` (`w-[200px]`): All Agents + every agent by name → `{agent: {eq: id}}`
    (`data-table.tsx:351-364,422-439`).
20. "Reset" ghost button clears **all** filters and returns to page 1; rendered only while any
    filter exists (condition `filters.length > 0 || filters.some(f => f.description)` — second
    clause redundant) (`data-table.tsx:441-452`).
21. Row selection: per-row checkbox + select-all-on-page header checkbox, both with `aria-label`s
    (`data-table.tsx:152-173`); "{n} of {m} row(s) selected." text in the footer while a selection
    exists (`data-table.tsx:528-534`).
22. Bulk delete: with a selection, a destructive "Delete {n} item(s)" button (Trash2) appears in
    the toolbar (`data-table.tsx:455-465`), opening an `AlertDialog` ("Are you sure?" / "This will
    permanently delete {n} feedback item(s). This action cannot be undone.") whose confirm runs
    `DELETE_FEEDBACK` (`feedbackRemoveOneById`, `queries/queries.ts:558-564`) **once per row via
    `Promise.all`** — no bulk endpoint — then success/error toast, clears selection, refetches
    (`data-table.tsx:276-303,605-624`).
23. Columns (`data-table.tsx:152-247`): **Date** — `toLocaleDateString() + toLocaleTimeString()`
    (`:174-185`); **Type** — `Badge variant="default"` + ThumbsUp "Positive" or
    `variant="destructive"` + ThumbsDown "Negative" (`:186-203`); **Agent** — name resolved from the
    1000-agent lookup, fallback `Agent {id}` (`:204-218`); **Feedback** — description preview
    truncated at 120 chars, `max-w-[500px]` (`:219-230`); **actions** — per-row outline "View
    Details" button that opens the detail sheet (`:231-247`). Rows are not otherwise clickable.
24. Loading state: single full-width `Loading` spinner row on first load (`data-table.tsx:490-495`);
    empty state: full-width "No feedback found." row (`:512-521`).
25. Pagination footer: "Page {x} of {y}", first/prev/next/last icon buttons with `sr-only` labels,
    disabled at bounds; first/last `hidden lg:flex` (`data-table.tsx:536-580`).
26. Detail sheet (`FeedbackDetailSheet`): opens on View Details; `w-full sm:max-w-4xl
    overflow-y-auto` (`feedback/components/feedback-detail-sheet.tsx:118-119`). On open it fires
    four queries with skip-guards: session messages (`GET_AGENT_MESSAGES`, `limit: 1000`, filtered
    by session, `:59-76`), user by id (`:79-84`), session by id (`:87-92`), agent by id (`:95-100`).
    Message `content` is `JSON.parse`d with malformed rows silently dropped (`:104-111`).
27. Sheet header: "Feedback Details" + description; destructive **Delete** button with its own
    nested `AlertDialog` confirmation ("Delete Feedback" / "...cannot be undone.")
    (`feedback-detail-sheet.tsx:121-154`). The wired `onDelete` runs the mutation, toasts success,
    closes the sheet, refetches — `.then` with **no `.catch`**: a failed delete is an unhandled
    rejection with no user feedback (`data-table.tsx:584-602`).
28. Sheet metadata block: Positive/Negative badge (same variants as the table), created timestamp
    (`toLocaleString`), user name → email → `User {id}` fallback, agent name, session title — the
    last two only when resolved (`feedback-detail-sheet.tsx:156-191`).
29. Feedback text block: "Feedback" heading + `whitespace-pre-wrap` description in a muted bordered
    box (`feedback-detail-sheet.tsx:196-202`).
30. Conversation replay: "Conversation" heading; read-only `MessageRenderer` (tokens hidden,
    `writeAccess: false`, no-op approval/feedback handlers, `marginTopFirstMessage: "mt-0"`) inside
    a fixed `h-[600px]` `ScrollArea`; spinner while loading; "No messages found for this session."
    empty state (`feedback-detail-sheet.tsx:206-235`).
31. Data shape & vestiges that must not be mistaken for behavior: `FEEDBACK_FIELDS` selects a
    **`status`** field that no UI ever displays (`queries/queries.ts:103-112`) — there is no
    update/triage mutation in the frontend (`UPDATE_FEEDBACK`/`feedbackUpdateOne` absent from
    `queries/queries.ts`); the table wires sorting, column-visibility, and faceting state/models
    (`data-table.tsx:86-94,249-271`) but renders **no** sort headers, view-options menu, or faceted
    filters — plain string headers only; `FeedbackFilters` type (`data-table.tsx:67-72`).

### UX review

| # | Severity | Issue | Evidence |
|---|----------|-------|----------|
| 1 | **High** | The entire review console is invisible below 768 px — `hidden ... md:flex` on the page root. P3's mobile job ("respond to alerts, read-mostly") is impossible. | `feedback/page.tsx:10` |
| 2 | **High** | Two unrelated features share the name "Feedback" in the same sidebar: the super-admin nav item (review console, ThumbsUp icon) and the footer button (submit dialog, MessageSquarePlus icon). An admin sees both with no hint which is which. | `main-nav.tsx:161-167` vs `main-nav.tsx:510` + `feedback-button.tsx:23-33` |
| 3 | **High** | Investigation dead-ends: the detail sheet replays the conversation but offers **no link to the live session** (`/chat/[agent]/[session]`), no copy-id affordances, and no way to act on the insight (contact user, open agent config). | `feedback-detail-sheet.tsx:117-236` |
| 4 | **High** | Single-delete from the sheet has no error path — `.then` without `.catch`; a backend failure silently closes nothing and shows nothing. | `data-table.tsx:590-601` |
| 5 | **High** | No client-side route guard: non-admins reaching `/feedback` render the full UI and fire `GET_USERS`/`GET_AGENTS`/`GET_FEEDBACK`; failures surface as a permanently empty table rather than an access message. | `feedback/page.tsx:7-23` |
| 6 | **High** | The chat feedback modal's referenced-sources **Deactivate** archives a knowledge item **globally for all users** in a single click — `handleDeactivate` fires `UPDATE_ITEM {archived: true}` directly `onClick`, with no confirmation step (the amber warning paragraph is not one). Violates philosophy.md:57 ("anything destructive lives at L3 or deeper **with confirmation**") and is inconsistent with every delete on this page, which routes through a confirm dialog. | `chat.tsx:1489-1513` (panel + warning), `:1729-1764` (`handleDeactivate`/`onClick`); philosophy.md:57 |
| 7 | **Med** | Positive feedback wears the **primary purple** badge (`variant="default"`), violating "semantic colors only for meaning" (positive should be quiet green, negative earns the color). Purple here also dilutes the accent (anti-pattern 5). | `data-table.tsx:192-195`, `feedback-detail-sheet.tsx:160-163`; philosophy §4 |
| 8 | **Med** | Zero i18n on the review surface (title, description, filters, dialogs, toasts all hard-coded English) and on the chat feedback modal — while the sibling submit dialog is translated en/de **except two hard-coded error strings** (the Alert title "Error", `feedback-chat.tsx:148`, and the fallback "An unexpected error occurred. Please try again.", `:59-61`). German users get a mixed-language experience. | `page.tsx:13-16`, `data-table.tsx:372,397-399,463,518,608-611`, `chat.tsx:1475-1481`, `feedback-chat.tsx:148,59-61`; vs `messages/de.json:184-206` |
| 9 | **Med** | Search refetches the server on **every keystroke**, combined with `no-cache` + 30 s polling — chatty and janky on slow networks; no debounce anywhere. | `data-table.tsx:305-319,101-114` |
| 10 | **Med** | Filter dropdowns require fetching **1000 users + 1000 agents** up front; unusable at org scale and slow on first paint. A plain `Select` with hundreds of items is also keyboard-hostile. | `data-table.tsx:117-130,403-439` |
| 11 | **Med** | The `status` field exists in the data model but no triage state is surfaced — admins cannot mark items reviewed/resolved, so the list never shrinks and every visit re-reads everything. | `queries/queries.ts:105`; no UI anywhere |
| 12 | **Med** | User filter casts ids with `parseFloat` — fragile if user ids are ever non-numeric (UUID ids would become `NaN` and the filter silently matches nothing). | `data-table.tsx:343` |
| 13 | **Low** | Per-row "View Details" outline buttons add a column of visual noise; the row itself is not clickable and has no hover affordance. | `data-table.tsx:231-247` |
| 14 | **Low** | Date column renders full locale date + time for every row — verbose; no relative time, no tooltip. | `data-table.tsx:174-185` |
| 15 | **Low** | Clearing the search by deleting text leaves a stale `{description: {contains: ""}}` filter in state, keeping "Reset" visible and sending an empty filter to the server. | `data-table.tsx:305-319,441` |
| 16 | **Low** | Vestigial table plumbing (sorting/visibility/faceting wired but UI-less) misleads maintainers and bloats the bundle. | `data-table.tsx:86-94,249-271` |
| 17 | **Low** | Sheet → nested AlertDialog is an overlay on an overlay; acceptable only because it is the destructive-confirm pattern, but it must become the single shared `ConfirmDialog`. | `feedback-detail-sheet.tsx:128-153`; philosophy anti-pattern 3 |
| 18 | **Low** | Both thumbs share the ARIA/tooltip label "Feedback" — indistinguishable to screen readers. | `message-renderer.tsx:1133,1140` |

### Mobile audit (390 px)

- **The page does not exist on mobile.** `hidden h-full ... md:flex` (`page.tsx:10`) renders an
  empty screen below 768 px. Severity: broken by construction.
- If un-hidden, the toolbar would overflow immediately: a single non-wrapping flex row containing
  fixed widths `w-[250px]` + `w-[150px]` + `w-[200px]` + `w-[200px]` (`data-table.tsx:370-439`)
  ≈ 800 px before buttons.
- The 6-column table (checkbox, date, type, agent, preview `max-w-[500px]`, actions) has no
  responsive variants and would horizontally scroll (`data-table.tsx:152-247,469-524`).
- The detail sheet is the one mobile-ready piece: `w-full sm:max-w-4xl` (`feedback-detail-sheet.tsx:119`),
  though the fixed `h-[600px]` conversation ScrollArea (`:215`) exceeds small viewports and double-scrolls.
- The **submit** dialog is mobile-usable: chooser collapses to one column
  (`feedback-choice.tsx:13`), composer autosizes; but `h-[80vh]` on a 390×844 viewport with the
  software keyboard open leaves very little conversation visible (`feedback-dialog.tsx:49`).
- Pagination first/last hide below `lg` (`data-table.tsx:545,572`) — fine; prev/next remain.

---

## 2. Jobs to be done

**The provisional ownership matrix is wrong for this route.** `personas.md:154` lists `/feedback`
as "P1 (submit), P3 (review)". The code contains no submission capability on the route — P1
submits via chat thumbs (`message-renderer.tsx:1128-1146`) and the shell footer dialog
(`main-nav.tsx:510`), never at `/feedback`, and the nav item is super-admin-only
(`main-nav.tsx:161-167`). Correction to flow back to `personas.md`: **`/feedback` — Primary P3
(review), Secondary P2 (quality signals for their own agents)**; P1's "report a problem or wish"
job (P1 JTBD #7) is served by the chat and shell surfaces, which this doc preserves in place.

**P3 Admin (primary).** #1 job in one sentence: *"Show me what went wrong — find the negative
feedback, read the conversation behind it, and decide what to do."* Ranked jobs:
1. Triage new negative feedback since the last visit (most frequent — reactive, weekly-ish).
2. Investigate one item: read the user's comment in the context of the full conversation; identify
   whether the agent, the knowledge, or the user was the problem; jump to the artifact (session,
   agent) to act.
3. Spot patterns: which agent or which user generates the complaints (filter by agent/user/type).
4. Housekeeping: delete spam/test feedback (single + bulk).

**P2 Power user (secondary).** *"Is my agent making people happy?"* — scan feedback filtered to
their agents, read negatives, fix prompt/knowledge (personas.md P2 JTBD #7). Today they are locked
out entirely (super_admin gate, no `feedback` role right); the redesign keeps the current gate but
records the missing role right as a dependency (see §4).

**P1 End user (on the submission surfaces only).** *"Tell them this answer was wrong / I wish it
did X"* — two taps from the message or one click in the sidebar, then done. Mobile-critical
(P1's mobile job is the full chat experience, personas.md:38-39).

**P4 Developer.** Marginal: copy session/agent ids out of a feedback item while debugging. Served
by copy affordances at L2, nothing more.

---

## 3. Design concept

### Default view (L1)

Audience: P3 arriving deliberately ("budget alert" energy — infrequent, must be self-explanatory).
Calm, table-first, audit-friendly (personas.md:100-102).

- **PageShell** (full-bleed work surface) with **PageHeader**: title "Feedback" (`text-2xl`),
  purpose line "What users said about agent responses." Right slot: no create action (review-only
  page) — instead a quiet summary stat, e.g. `"86% positive · 14 negative"` in
  `text-sm text-muted-foreground`. **Data source — buildable today, no new backend:** two
  parallel count probes on the existing `GET_FEEDBACK` (`queries/queries.ts:195-215`) with
  `limit: 1` and filters `[{score: {eq: 1}}]` / `[{score: {eq: 0}}]`, reading
  `pageInfo.itemCount` from each; the percentage is derived client-side; both probes refresh on
  the page's existing 30 s poll and hide the stat (render nothing) while loading or on error.
  The stat is therefore **all-time, not time-windowed** — deliberately, so that clicking the
  negative count applies exactly the Negative segment filter the count was computed from
  (a shortcut, not a chart): the number shown and the rows revealed always agree. A 30-day
  windowed variant would require a `createdAt` range operator on `FilterFeedback` (unconfirmed
  in the schema; the frontend only ever sends `score`/`user`/`agent`/`description` filters) or a
  server-side aggregate query — recorded as an optional, non-blocking backend dependency in §4,
  not assumed by this design.
- **Toolbar** directly under the header, one row: debounced search input (flexible width,
  `min-w-0 flex-1 max-w-xs`); a **segmented type control** `All · Negative · Positive` (Tabs-based,
  default **All**, newest first); an **Agent** combobox (async-searching, replaces the 1000-item
  Select); a "Filter" ghost button opening a popover with the **User** combobox (L2 — user-filtering
  is rarer than agent-filtering); "Reset" ghost chip appears only while filters are active.
- **The list** (ListDetail's list half): full-width table. Columns: **type indicator** — a small
  muted green dot + ThumbsUp glyph for positive, a `destructive`-tinted ThumbsDown for negative
  (problems earn color, healthy stays quiet — philosophy §4; fixes the purple badge); **feedback
  preview** (primary cell, `text-sm`, single-line truncate — the widest column); **agent** name;
  **user** name; **relative date** (`text-sm text-muted-foreground`, absolute timestamp in a
  tooltip). Entire **row is clickable** → opens the detail panel; per-row "View Details" button is
  removed in favor of the row affordance + visible hover state. The selection checkbox column stays
  (leading), since bulk delete depends on it.
- **EmptyState** (shared primitive): ThumbsUp icon, "No feedback yet. Thumbs up/down in chat land
  here once an agent has feedback enabled.", action "Review agent settings" → `/agents`. A second
  variant for filtered-empty: "Nothing matches these filters" + Reset action.
- **Pagination** footer: page x of y + prev/next (first/last stay, `hidden lg:flex` as today).
- Primary action on this screen = opening a row; the purple accent appears only on the active
  segmented-control state and the focused row. No purple badges anywhere.

### Disclosure ladder

Every inventory item mapped. "(unchanged)" = the capability stays on its current surface; this
redesign touches its placement only as noted.

| Inv # | Capability | Level | Where it lives in the new design |
|---|---|---|---|
| 1 | Message thumbs (gated by `agent.feedback`) | L1 of chat (unchanged) | Message hover actions; fix distinct ARIA labels ("Good response"/"Bad response") |
| 2 | Open feedback modal w/ score + referenced-item extraction | L2 of chat (unchanged) | Dialog opened from the thumb |
| 3 | Feedback text + submit (`CREATE_FEEDBACK`) | L2 of chat (unchanged) | Same dialog; i18n'd copy; text stays required |
| 4 | Referenced-sources Deactivate (global archive) | L3 of chat | Same dialog section, destructive styling + amber warning kept — but Deactivate now routes through the shared **ConfirmDialog** ("Deactivate {itemName}? This archives the item globally for every user.") before firing `UPDATE_ITEM {archived: true}`; today it mutates directly `onClick` with no confirmation (`chat.tsx:1729-1764`), violating philosophy.md:57 ("anything destructive lives at L3 or deeper **with confirmation**") — the warning paragraph is not a confirmation step. Per-row Deactivated state unchanged after confirm. Confirm-over-dialog here is the one sanctioned overlay-on-overlay (the destructive-confirm pattern, same as rows 22/27) |
| 5 | Escape closes feedback modal | L2 (unchanged) | Standard dialog behavior |
| 6 | Sidebar "Feedback" submit button (config-gated, all users) | L0 shell (unchanged) | Stays in sidebar footer / "Personal" group; **relabel "Send feedback"** to break the name collision with the admin page (i18n key `feedback.label`) |
| 7 | Submit dialog with choice→chat views, state reset, kind titles | L1 of dialog (unchanged) | As today |
| 8 | Bug / Feature chooser cards | L1 of dialog (unchanged) | As today |
| 9 | Agent-driven feedback chat (separate backend, token, per-kind agents, feedbackContext) | L2 of dialog (unchanged) | As today; token exposure flagged in §4 risks |
| 10 | Back, empty states, error alert, autosize composer, Enter-to-send, disabled-while-submitted composer, Stop, scroll-to-bottom button | L2 of dialog (unchanged) | As today; the error Alert title and fallback message move onto i18n keys (see §4) |
| 11 | `FeedbackConfig` plumbing + double `enabled` gate | n/a (infra) | Unchanged |
| 12 | Super-admin nav gate; no role right; no route guard | L0 | Nav item moves into the **Administration** group (navigation.md); add a client route guard rendering an access EmptyState; `feedback` role right recorded as backend dependency |
| 13 | Page header (title + description) | L1 | Shared **PageHeader**, i18n'd; page visible at all breakpoints (kills `hidden md:flex`) |
| 14 | Paginated list, 20/page, newest first, 30 s polling, stale-while-loading | L1 | ListDetail list; polling kept (quiet refresh, no spinner); sort stays `createdAt DESC` |
| 15 | Agent/user lookups for filters & name resolution | L1/L2 (infra) | Replaced by async **EntityCombobox** server-side search; row agent/user names come from the feedback query enrichment or a capped lookup — behavior (names, options) preserved |
| 16 | Description search | L1 | Toolbar search, debounced 300 ms; empty input removes the filter (fixes stale `contains: ""`) |
| 17 | Type filter (All/Positive/Negative) | L1 | Segmented control in Toolbar (promoted from a Select — it is the triage axis) |
| 18 | User filter | L2 | "Filter" popover in Toolbar → User combobox (id passed verbatim, no `parseFloat`) |
| 19 | Agent filter | L1 | Agent combobox in Toolbar (P2/P3's pattern-spotting axis) |
| 20 | Reset filters | L1 | Ghost chip in Toolbar, visible only when ≥1 filter active |
| 21 | Row selection (per-row + select-all-page, counts) | L1 (≥md) / L2 (<md) | Leading checkbox column renders in the page-default table, so on desktop this is L1 by definition (the layout tree below shows Checkbox as the first column); below `md` selection sits one step in, behind the filter Sheet's "Select" toggle (L2, see Mobile behavior). The SelectionBar summary appears once ≥1 row is selected; the destructive bulk delete it exposes stays at L3 (row 22) |
| 22 | Bulk delete + confirmation | L3 | Destructive button in the selection action bar → shared **ConfirmDialog** naming the count; per-row mutations kept until a bulk endpoint exists |
| 23 | Columns: date, type, agent, preview, open-detail | L1 | Type dot/glyph, preview (primary), agent, user, relative date; "open" = row click |
| 24 | Loading + empty states | L1 | Skeleton rows mirroring the table (philosophy §6) replace the spinner row; shared **EmptyState** for zero/filtered-zero |
| 25 | Pagination controls | L1 | Footer as today, sr-only labels kept |
| 26 | Detail open + 4 contextual queries (messages/user/session/agent) | L2 | **ListDetail detail panel**: side panel ≥`lg`, full-height Sheet below; same queries with skip-guards; conversation query fires lazily when the panel opens |
| 27 | Delete single item + confirm; (fix missing error path) | L3 | "Delete" in the panel's overflow (ghost icon button w/ tooltip) → shared ConfirmDialog; `.catch` → destructive toast |
| 28 | Metadata: type, timestamp, user, agent, session title | L2 | Panel header block; ids get one-click copy buttons (P4); type uses the same quiet-green/destructive treatment |
| 29 | Feedback text block | L2 | First content block in the panel, `whitespace-pre-wrap`, muted surface |
| 30 | Conversation replay (read-only MessageRenderer) | L2 | Panel body, flex-fill height (no fixed 600 px), single scroll context; **new additive action: "Open in Chat" link** → `/chat/[agent]/[session]` (fixes the dead-end; additive, removes nothing) |
| 31 | `status` field + vestigial table plumbing | L4 / cleanup | `status` rendered as a quiet badge in the panel **if** the backend populates it; "mark reviewed" triage is a flagged follow-up needing a backend mutation (§4); dead sorting/visibility/faceting plumbing deleted (code, not capability) |

### Layout & components

```
PageShell (full-bleed)
└─ PageHeader            title "Feedback" · purpose line · right: summary stat (text-sm muted)
└─ Toolbar (gap-2)       [Search input] [Tabs: All|Negative|Positive] [EntityCombobox: Agent]
                         [Popover "Filter": EntityCombobox User] [Reset ghost]
└─ SelectionBar          (conditional, h-10) "{n} selected" · [Delete n] destructive sm
└─ ListDetail
   ├─ list: shadcn Table (rounded-md border) — Checkbox | type | preview | agent | user | date
   │        TanStack table kept for selection/pagination only; skeleton rows on load
   └─ detail: side panel (≥lg, w-[480px] border-l) / Sheet (<lg, side="right", w-full)
       ├─ header: type indicator · relative date (tooltip absolute) · overflow menu (Delete)
       ├─ meta grid (text-sm, gap-2): user · agent · session title · copy-id buttons (font-mono text-xs)
       ├─ "Open in Chat" outline sm button (ExternalLink icon)
       ├─ feedback text: bg-muted/50 rounded-md p-4, whitespace-pre-wrap
       └─ Conversation: MessageRenderer read-only, flex-1 min-h-0 overflow-y-auto
└─ Pagination footer (justify-between, text-sm)
ConfirmDialog (shared)   single + bulk delete confirms
EmptyState (shared)      zero-data and filtered-zero variants
```

- shadcn pieces: `Table`, `Tabs` (segmented control), `Input`, `Popover`, `Command` (inside
  EntityCombobox), `Sheet`, `Badge` (status only), `Button` (`ghost` for toolbar chips,
  `destructive` for deletes, `outline` for Open in Chat), `Tooltip`, `Checkbox`, `Skeleton`,
  `DropdownMenu` (panel overflow).
- Type/spacing per CLAUDE.md: page title `text-2xl`; section labels in the panel `text-sm
  font-semibold`; metadata `text-sm`/`text-xs text-muted-foreground`; ids `font-mono text-xs`;
  toolbar `gap-2`, content blocks `gap-4`, page padding `p-8` desktop / `p-4` mobile.
- Color: destructive tint reserved for negative indicators and delete actions; green (muted) for
  positive; purple only on the active tab segment and focus rings.
- All strings via a new `feedbackReview.*` i18n namespace (en + de), including toasts and confirm
  copy; existing `feedback.*` submit-dialog namespace untouched except `feedback.label` →
  "Send feedback" / "Feedback senden".
- Accessibility: row click is implemented as a focusable row with `aria-label` summarizing the
  item; checkbox clicks stop propagation; thumbs in chat get distinct labels; the type indicator
  always pairs icon + sr-only text (never color alone).

### Mobile behavior

P3's mobile job: respond to alerts — read a complaint, maybe delete it, one-handed
(personas.md:104-105). The page must *exist* first (remove `hidden md:flex`).

- **< md (390 px):**
  - Table → **card list**: each card = type indicator (top-left), two-line clamped feedback text,
    `agent · user` line (`text-xs text-muted-foreground`), relative time top-right. Tap opens the
    detail Sheet. Min touch target 44 px.
  - Toolbar collapses to: search (full width) + one "Filter" button (badge shows active-filter
    count) opening a bottom Sheet containing the type segmented control, agent and user comboboxes,
    and Reset.
  - Selection: an overflow "Select" toggle in the filter Sheet enables checkboxes on cards, showing
    the SelectionBar (bulk delete stays reachable — nothing dropped, just one step deeper, matching
    its L3 placement).
  - Detail = full-screen Sheet; conversation flex-fills under the metadata; "Open in Chat"
    navigates to the mobile chat view; Delete in the Sheet header overflow.
  - Pagination: prev/next only (as today's `hidden lg:flex` already implies).
- **md–lg:** table layout with the user column dropped to the detail (preview keeps priority);
  detail remains a Sheet overlay.
- **≥ lg:** full table + persistent side panel (ListDetail), first/last pagination buttons return.
- Submit surfaces on mobile (unchanged scope, small fixes): the submit dialog becomes a
  full-height Sheet below `sm` so `h-[80vh]` + keyboard stops cropping the conversation
  (`feedback-dialog.tsx:49`); chooser stays single-column.

### Motion

Per CLAUDE.md timings, all honoring `prefers-reduced-motion`:

- Detail panel/Sheet slide-in: 300 ms `ease-in-out` (explains origin: from the row's side).
- Row hover: background transition 150 ms; selected row gets a `bg-muted` state, no animation.
- Filter/tab changes: list crossfade 200 ms (old rows fade as skeletons appear) — communicates
  "same list, new query" without layout jump.
- SelectionBar: 200 ms height+opacity entrance when the first row is selected.
- Poll refresh: silent — no spinner, no flash; only changed rows may fade in (200 ms).
- Conversation replay: no streaming shimmer (it is historical, not live).

---

## 4. Implementation notes

**Files to change**
- `app/(application)/feedback/page.tsx` — rewrite: PageShell + PageHeader, remove `hidden md:flex`,
  add client route guard (super_admin check from `UserContext`; non-admins get an access
  EmptyState, no data queries fired), i18n.
- `app/(application)/feedback/components/data-table.tsx` — split into `feedback-list.tsx`
  (table/cards + selection + pagination), `feedback-toolbar.tsx` (search/segments/comboboxes/reset),
  and a `use-feedback-query.ts` hook (debounced filters, polling, stale-while-loading; also the
  header-stat count probes — two `GET_FEEDBACK` `limit: 1` queries reading `pageInfo.itemCount`,
  see §3 Default view). Delete the vestigial sorting/visibility/faceting wiring. Fix: debounce
  (300 ms), empty-search filter removal, no `parseFloat` on user ids, `.catch` on the
  single-delete path, both deletes through ConfirmDialog.
- `app/(application)/feedback/components/feedback-detail-sheet.tsx` → `feedback-detail-panel.tsx`:
  renders inside ListDetail (panel ≥lg / Sheet <lg); flex-height conversation (drop `h-[600px]`);
  add "Open in Chat" link (`/chat/${feedback.agent}/${feedback.session}`), copy-id buttons,
  optional `status` badge.
- `app/(application)/chat/[agent]/[session]/chat.tsx` — `ReferencedSourceRow` (`:1720-1768`):
  route **Deactivate** through the shared ConfirmDialog (naming the item and the global,
  all-users consequence) before firing `UPDATE_ITEM {archived: true}`; the post-confirm
  Deactivated state, loading state, and success/failure toasts are unchanged. (Coordinate with
  `design/pages/chat.md` — the modal lives on the chat surface.)
- `messages/en.json`, `messages/de.json` — new `feedbackReview.*` namespace; change
  `feedback.label` to "Send feedback"/"Feedback senden"; add chat-feedback-modal strings (the
  chat modal copy at `chat.tsx:1475-1481` and the `ReferencedSourceRow` strings/toasts at
  `:1734-1763` should consume them — coordinate with `design/pages/chat.md`); add keys for the
  Deactivate ConfirmDialog copy and for the submit chat's two untranslated error strings (below).
- `components/feedback/feedback-chat.tsx` — i18n the hard-coded error `Alert` title "Error"
  (`:148`) and the `onError` fallback message "An unexpected error occurred. Please try again."
  (`:59-61`); no behavior change.
- `components/feedback/feedback-dialog.tsx` — `sm:` Sheet variant for mobile (visual only; flow unchanged).
- `components/message-renderer.tsx:1128-1146` — distinct labels for the two thumbs (a11y, copy-only).
- `components/custom/main-nav.tsx:161-167` — nav item moves to the Administration group per
  `design/navigation.md` (owned by the nav workstream, not this page).

**Shared primitives used** (philosophy §5): PageShell, PageHeader, Toolbar, ListDetail, EmptyState,
ConfirmDialog. **NEW shared primitives needed (not in philosophy §5 — flag for adoption):**
- **EntityCombobox** — async, server-searching single-select for users/agents (Command+Popover,
  debounced `contains` query, selected-value chip). Also needed by analytics, budgets, evals filters.
- **RelativeTime** — relative timestamp with absolute-value tooltip; used by every audit-ish table.
- **SelectionBar** — the "{n} selected + bulk actions" strip; every multi-select table needs one
  (variables, users, keys).

**Scope: M.** One route, one panel, a toolbar, and i18n; no new data model (the header stat is
computed from existing `GET_FEEDBACK` count probes). The submit surfaces need copy/a11y/
mobile-sheet touches plus one behavioral fix: the chat modal's Deactivate gains a ConfirmDialog
step (inventory #4, UX issue #6).

**Dependencies**
- Shell/nav redesign (`design/navigation.md`): Administration grouping, "Send feedback" relabel in
  the Personal group — resolves UX issue #2.
- Shared primitives above (PageShell/PageHeader/Toolbar/ListDetail/EmptyState/ConfirmDialog) from
  the codebase restructuring; this page is a good second adopter after a simpler list page.
- Backend (flagged, not blocking): a `feedback` role right so P2 can see feedback for their agents
  (today super-admin only, `main-nav.tsx:161`); `feedbackUpdateOne` for status triage (the `status`
  field already exists, `queries/queries.ts:105`); a true bulk-delete mutation (today N requests,
  `data-table.tsx:278-285`); server-side enrichment of agent/user names on `feedbackPagination`
  (else keep capped lookups and accept `Agent {id}` fallbacks at scale); **optionally**, a
  `createdAt` range operator on `FilterFeedback` or an aggregate stats query if the header
  summary stat should ever be time-windowed (e.g. 30d) — the design as specified ships with
  all-time `pageInfo.itemCount` probes and needs nothing new (§3 Default view).

**Risks**
- `config.feedback.token` is an API key delivered to every browser via `/config`
  (`util/api.ts:50-58`, used at `feedback-chat.tsx:75`) — pre-existing; the redesign must not widen
  its exposure (keep it out of any new debug/raw views). Recommend a backend proxy as follow-up.
- `MessageRenderer` reuse in the replay panel couples this page to chat internals
  (`feedback-detail-sheet.tsx:216-227`); any chat-side prop changes must keep the read-only
  configuration working — add a smoke test.
- Removing the 1000-item lookups changes filter UX from "browse all" to "type to search"; keep the
  combobox opening with the first ~20 entries preloaded so browsing small orgs still works.
- Polling + `no-cache` retained for parity; if the page later shows triage state, switch to
  cache-and-network to avoid losing optimistic status updates between polls.
