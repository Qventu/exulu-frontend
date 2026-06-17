# Chat — Review & Design Concept

**Routes:** `/chat`, `/chat/[agent]`, `/chat/[agent]/[session]` (incl. the virtual `/chat/[agent]/new`), `/chat/[agent]/search`
**Primary persona:** P1 — The End User ("I talk to agents")
**Secondary:** P2 — The Power User (testing/debugging their agents in the same surface)
**Current state:** Functionally the richest surface in the product, but the L1 screen is crowded with builder/admin machinery, four destructive flows share three inconsistent confirmation patterns (two have no confirmation at all), and the layout is hard-broken on mobile — the one place philosophy says it must be flawless.

---

## 1. Current state

### Functionality inventory

This list is the contract: every item must remain reachable after the redesign. File references are
relative to the repo root; `chat.tsx` = `app/(application)/chat/[agent]/[session]/chat.tsx`,
`sessions` = `app/(application)/chat/[agent]/chat-sessions.tsx`, `search` =
`app/(application)/chat/[agent]/search/page.tsx`, `mr` = `components/message-renderer.tsx`.

**Routes & entry**

1. **Agent selection page** (`/chat`): searchable grid of active agents (lottie avatar, name, model badge, description); clicking creates a private session titled "New session with {agent}" and navigates into it (`app/(application)/chat/page.tsx:50-53`, `components/agent-selection-dialog.tsx:50-160`).
2. **Auto-redirect when exactly one agent** is accessible (`chat/page.tsx:40-42`).
3. **Auto-redirect to the default agent** (`defaultagent` flag) when set (`chat/page.tsx:45-48`).
4. **No-agents permission alert** ("contact your administrator") (`chat/page.tsx:26-37`).
5. **Load-failure error alert** with redirect-error passthrough (`chat/page.tsx:54-70`).
6. **`/chat/[agent]` → `/chat/[agent]/new` redirect** (`chat/[agent]/page.tsx:3-6`).
7. **Agent/session-not-found and generic error alerts** on the layout and session page (`chat/[agent]/layout.tsx:27-37`, `chat/[agent]/[session]/page.tsx:29-36,70-78,91-99,110-118`).
8. **Full-page spinner** while a session loads (`chat/[agent]/[session]/loading.tsx`).

**Session sidebar (desktop-only, 250px)**

9. **"Back to agent selection" link** to `/chat` (`sessions:203-209`).
10. **Agent name heading** (`sessions:211-213`).
11. **"New session" link** with in-flight loading state (spinner + "Loading…" + pointer-events lock) (`sessions:216-248`).
12. **"Search chats" entry** → `/chat/[agent]/search` (`sessions:250-271`).
13. **Recents list**: 20 most recent sessions for this agent, truncated titles (40 chars), hover-revealed relative "updated X ago" line, active-session highlight by pathname (`sessions:61-77, 273-404`).
14. **Per-session dropdown (write-access gated, hover-revealed): Rename** via dialog with Enter-to-submit (`sessions:353-378, 422-467`).
15. **Per-session Delete** — immediate, toast only, **no confirmation** (`sessions:379-393`).
16. **"Show all chats"** button when more sessions exist than loaded → search page (`sessions:406-420`).
17. **Loading skeletons (12 rows) and "No sessions found" empty state** (`sessions:277-298`).
18. **Dormant create-session dialog mode**: the rename dialog has a "create" mode (name → create + navigate) that no UI currently triggers (`sessions:49, 109-154, 426-431`) — keep the capability (named session creation) on the ladder.

**Search page (`/chat/[agent]/search`)**

19. **"Back to chat" link** (`search:157-164`).
20. **Debounced (300 ms) title-contains search**, active from 3 chars (`search:40-84`).
21. **Result rows**: title, "Updated X ago", click-to-open (`search:224-269`).
22. **Multi-select**: per-row checkboxes (write-gated) + "Select all" over writable rows (`search:90-114, 190-204, 243-250`).
23. **Bulk delete** with AlertDialog confirmation and result toast (`search:116-140, 288-307`).
24. **"Show more" pagination** with "(N of M)" count (`search:272-285`).
25. **Loading skeletons + contextual empty states** ("no match" vs. "none") (`search:208-222`).

**Chat header (session page)**

26. **Per-request model override** select: provider logos, "(default)" marker on the agent's model; source switches between LiteLLM catalog and the Models table by config; sends `X-Exulu-Model-Override` header per request; speech models filtered out (`chat.tsx:140-146, 267-295, 394-409, 894-946`).
27. **Context-window progress bar**: total tokens vs. `agent.maxContextLength` (`chat.tsx:886-890`).
28. **Static hint text** "Turn this conversation into a reusable template" beside the model select (`chat.tsx:947-951`).
29. **Share popover** (write-access + existing session): session URL with copy-confirmation, creator email, RBAC editor (`private`/`users`/`roles`) and "Save access rights" (`chat.tsx:953-1019`, `components/rbac.tsx`).
30. **"Save as Routine"** (enabled once ≥1 user and ≥1 assistant message) → SaveWorkflowModal: template name, description, editable message sequence with placeholders, save as workflow template (`chat.tsx:507-511, 1020-1028, 1448-1455`, `components/save-workflow-modal.tsx`).

**Conversation area**

31. **Empty/new-session state**: logo, "How can I help you today?" fallback or `agent.welcomemessage` rendered as an assistant bubble, animated AgentVisual (`chat.tsx:1034-1059`).
32. **History load**: first 50 messages fetched server-side and hydrated (`chat/[agent]/[session]/page.tsx:51-68`).
33. **Streaming chat** via `useChat` + `DefaultChatTransport`: 50 ms throttle, only last message sent (server holds history), session/user/auth headers, structured error parsing (`chat.tsx:346-413`).
34. **Lazy session creation on first send**: creates a private session titled with the first 50 input chars, swaps URL via `history.replaceState` without remount (`chat.tsx:524-566, 600-614`).
35. **Stick-to-bottom scrolling** with floating scroll-to-bottom button (`chat.tsx:1033, 1107`, `components/ai-elements/conversation.tsx:73-100`).
36. **"Read access only" badge** for read-only viewers (`chat.tsx:1109-1115`).
37. **Inline destructive error alert** above the composer (`chat.tsx:1116-1126`).
38. **Token accounting**: per-message metadata aggregated into total/reasoning/input/output/cached counts (`chat.tsx:415-451`). The detailed-breakdown `Context` ai-element is imported but never rendered (`chat.tsx:59-69`) — the breakdown must surface in the redesign.
39. **Streaming placeholder**: skeleton bar with rotating gradient status text ("Generating… Thinking… Researching…") (`mr:449-469, 1014-1024`).
40. **AgentVisual lottie** beside the last assistant message, animated by status (`mr:1161-1170`).

**Message rendering (`message-renderer.tsx` + `ai-elements/`)**

41. **Hardened markdown rendering** (hardened ReactMarkdown / Streamdown, code blocks with copy) (`components/ai-elements/response.tsx:169-185`, `code-block.tsx`).
42. **Knowledge-source citations**: `{item_name…}` blobs in text become inline badges → dialog with chunk content, PDF preview opened at the cited page, item metadata table, and a deep link to `/data/[context]/[item]` (`mr:556-599`, `response.tsx:326-586`). (No copy-to-clipboard here — the snippet copy button exists only in the web-search dialog, item 43.)
    - **42a. "Deactivate this source"** at the bottom of that same dialog: a `variant="destructive"` button that archives the cited knowledge item **globally** (`UPDATE_ITEM(context)` with `archived: true`), rendered for **any viewer of the session whenever `itemId` is present** — including read-only P1 users — with an inline warning line but **no confirmation dialog and no RBAC gate** (`response.tsx:357-376, 564-582`). This is a second entry point to the same archive mutation as the feedback dialog (item 58) and must remain reachable, but gated and confirmed (see ladder row 42a, U3).
43. **Web-search citations**: `{url…}` blobs become favicon badges → dialog with quoted snippet + copy, iframe page preview, domain/path table (`mr:601-640`, `response.tsx:189-323`).
44. **`source-url` parts** → collapsible "Sources" list (`mr:963-987`, `ai-elements/source.tsx`, `sources.tsx`).
45. **`reasoning` parts** → collapsible Reasoning panel with streaming shimmer state (`mr:989-1001`, `ai-elements/reasoning.tsx`).
46. **`todo_write` tool** → TodoList with status/priority rendering; only the latest todo message kept; `todo_read` suppressed (`mr:422-447, 685-702, 756-758`, `ai-elements/todo-list.tsx`).
47. **`question_ask` tool** → multi-select question card with confirm; collapses to an answered chip after reply or refresh; `[answer:…]` user messages render as check chips (`mr:528-552, 704-754, 1614-1733`; answer dispatch `chat.tsx:1095-1103`).
48. **`context_search` tools** → ReasoningVisualisation (numbered agentic steps with expandable ToolCallChips showing input/output JSON, "show all/less") + ContextSearchResults collapsible card (search-parameter badges; result item cards with chunk counts linking to `/data/[context]/[item]`; "show N more") (`mr:760-846, 1242-1612`).
49. **Generic/dynamic tool parts** → collapsible Tool block: prettified name, status badge, formatted input, output or error (`mr:848-947`, `chat.tsx:1769-1814` (`UntypedToolPart`), `ai-elements/tool.tsx`).
50. **Tool-call approval flow**: request card with "Allow for this chat" (persists tool id to `localStorage` key `pre-approved-tool-calls-{session}`, sent as `approvedTools` on subsequent sends), "Allow once", "Deny"; green/red resolved-state cards (`components/tool-call-approval.tsx`, `chat.tsx:619-635`).
51. **`image_generation_widget` output** → interactive image-generation widget (items 85–91) (`mr:854-876`).
52. **Legacy `image_generation` output** → inline image with model/prompt/revised-prompt metadata (`mr:877-892, 1735-1779`).
53. **Image file parts** rendered inline at 300px (`mr:949-961`).
54. **`<file name="…">` text blobs** extracted and rendered as a FileItem grid (`mr:486-501, 1006-1012`).
55. **Assistant message actions**: Retry/regenerate (write-gated), Copy to clipboard, Download as `.txt` (`mr:1031-1106`).
56. **Read-aloud TTS** (env-flag gated): sentence-chunked streaming playback with bounded-concurrency prefetch, pause/resume, per-message blob cache, 4000-char truncation notice, granular error toasts (`mr:126-376, 1059-1075`).
57. **Thumbs up / thumbs down** per assistant message (gated by `agent.feedback`) (`mr:1128-1147`).
58. **Feedback dialog**: free-text description, submit mutation; on negative feedback, cited sources are extracted and listed with a **"Deactivate" action that archives the knowledge item globally** (with explicit warning) (`chat.tsx:200-207, 789-822, 1466-1531, 1673-1767`).
59. **User-message Edit / Remove plumbing** (`showEdit`/`showRemove` props with inline textarea + confirm/cancel; off in chat today, exercised by the workflow editor) (`mr:107-110, 378-420, 644-674, 1107-1127`).

**Composer**

60. **Autosize textarea**: Enter sends, Shift+Enter newline, Escape clears; autofocus; max length = 80% of agent context window (≈4 chars/token); character counter from 90% with max-reached warning (`chat.tsx:156-157, 764-779, 1154-1169, 1419-1427`).
61. **Send / Stop buttons** swapping with stream status; disabled while empty, submitted, recording, or over budget (`chat.tsx:1199-1221`).
62. **Mic / speech-to-text** (env-flag gated): MediaRecorder with secure-context and permission diagnostics, recording/transcribing states, UI-locale language hint, transcript appended to input — never auto-sent (`chat.tsx:148-155, 641-762, 1170-1198`).
63. **Follow-up suggestion chips** (gated by `agent.suggestions_enabled`): up to 3 fetched after each assistant reply from a dedicated endpoint, click fills the input, aborted on next send (`chat.tsx:158-159, 453-504, 1129-1147`).
64. **"Files" button** toggling the session-files panel (auto-creates a session first if needed; open state persisted in `localStorage`) (`chat.tsx:218-256, 1225-1235`).
65. **"Prompts" button** → PromptSelectorModal: full-text search, tag-derived category rail, usage-sorted list with relative timestamps, per-prompt `{{variable}}` form with live color-coded preview, Copy, "Use template" (inserts into input + increments usage count); plus `?promptId=` deep-link autofill (`chat.tsx:193-207, 305-313, 568-583, 1236-1238, 1457-1463`, `…/components/prompt-selector-modal.tsx`, `prompt-variable-form.tsx`).
66. **"Context" button** → ItemsSelectionModal: browse contexts and individual items (tabbed, searchable), presets tab with validation/partial-apply reporting; attaches whole contexts or specific items; persists `session_items` (auto-creates session) (`chat.tsx:1241-1297`, `components/items-selection-modal.tsx`).
67. **Pinned context/item badges** (amber): resolve item names by id, removable per badge (`chat.tsx:1334-1354`, `components/project-details.tsx:806-834`).
68. **"Save context preset"** (visible when items pinned) → SavePresetModal: name (required), description, tags, advanced RBAC (`private/users/roles/teams`), selected-item stats; create + update modes (`chat.tsx:1356-1368, 1533-1538`, `components/save-preset-modal.tsx`).
69. **Skills popover**: per-skill on/off switches, Enable/Disable all, "N off" count badge on the trigger (`chat.tsx:1305-1315, 1575-1670`).
70. **Tools popover**: identical pattern for tools (`chat.tsx:1317-1327`); both write into one shared `disabledTools` array (`chat.tsx:781-787`).
71. **`disabledTools` + `approvedTools` sent in every request body** (`chat.tsx:627-635`).
72. **Managed-context notice** when the agent's `agentic_context_search` tool has `managed_context` enabled: "agent will only search contexts and items you add to this session" (`chat.tsx:189-193, 1400-1409`).
73. **Budget chip + hover card** (only when `user.budget` exists): BudgetBar with spend/limit, burn-rate projection marker, reset date; **budget-exceeded state disables input and send, shows destructive notice and toast** (`chat.tsx:129-135, 591-598, 1370-1396, 1412-1418`, `components/budget-bar.tsx`).
74. **Attached-file preview grid** with per-file remove; pinned items converted to presigned URLs (or data-URLs for s3-less items) and sent as message file parts (`chat.tsx:825-863, 1431-1440`).
75. **`addToContext` from tool output**: tool results can push a file into the next message's attachments (`chat.tsx:1091-1093`).
76. **AI disclaimer**: "AI can make mistakes. Check important info." (`chat.tsx:1442-1445`).
77. **Escape priority-closes overlays** (feedback → prompt selector → save-workflow) (`chat.tsx:319-337`).
78. **Read-only mode hides the entire composer** (suggestions, form, disclaimer) (`chat.tsx:1127-1447`).

**Session files panel**

79. **Resizable split layout**: chat ≥40%, panel 20–60%, drag handle; panel unmounts when closed (`chat.tsx:871-880, 1541-1556`).
80. **File list**: type-specific icons, size + relative time, **5 s polling** so agent-produced files appear live (`components/session-files/session-files-panel.tsx`, `file-row.tsx:18-34`).
    - **80a. Panel loading / empty / error states**: "Loading files…" spinner row while the list is null; empty state "No files yet. Upload below, or wait for the agent to produce one."; error state with a **Retry** button (`session-files-panel.tsx:122-138`). Itemized like their equivalents elsewhere (17, 25) and carried explicitly in the contract because the panel relocates into a Sheet on mobile (ladder rows 79, 80a).
81. **Hover row actions**: Preview, Download (presigned), Delete (**`window.confirm`**) (`file-row.tsx:58-88`, `session-files-panel.tsx:70-83`).
82. **Preview pane**: text/code inline ≤200 KB with syntax highlighting (extension-mapped language), images, PDFs via iframe, Office docs via backend LibreOffice→PDF, unknown → download-only; back navigation; deleted/re-uploaded files tracked against the poll (`preview-pane.tsx`, `session-files-panel.tsx:59-68`).
83. **Upload zone**: drag-drop + browse, multi-file sequential upload, per-file size cap with pre-validation, presigned PUT, sandbox-sync step with non-fatal warning (`upload-zone.tsx`).
84. **Session-scope privacy note**: "Files in this session aren't shared with other sessions, projects, or knowledge bases" (`session-files-panel.tsx:108-111`).

**Image-generation widget**

85. **Model / size / quality selects + count stepper**, all bounded by per-model capabilities, with auto-reset on model change (`components/image-generation/image-generation-widget.tsx:151-164, 410-434, 576-632`).
86. **Style picker** (none / user-owned / shared with owner icons) + **Edit style** and **New style** → EditStyleDialog (name, short description, style markdown, RBAC visibility) (`image-generation-widget.tsx:436-503`, `edit-style-dialog.tsx`).
87. **Prompt textarea + reference images** via Uppy (png/jpg/webp, max 5, thumbnails, per-image remove); edit-mode inferred from references with "model doesn't support editing" warning; mask-image support (`image-generation-widget.tsx:506-574, 138-139`).
88. **Generate / cancel (abortable)** with inline error display (`image-generation-widget.tsx:229-316, 634-656`).
89. **Generation history**: operation/model/size/quality badges, prompt, image grid with selection toggles, hover Download and Use-as-reference; rehydrated on reload (`image-generation-widget.tsx:194-228, 658-728`).
90. **"Use these"** sends the selection to the assistant as an injected system message (`image-generation-widget.tsx:317-373, 730-745`).
91. **Collapsed "Final selection" view** after selection, with "Edit again" to re-expand (`image-generation-widget.tsx:380-408`).

**RBAC summary (who can do what):** session write access = creator (private), anyone (public), listed user/role with `write` rights, or `super_admin` (`lib/check-chat-session-write-access.ts`). Write access gates: composer (78), rename/delete (14, 15, 22), Share (29), Retry (55). **Ungated today:** the knowledge-citation "Deactivate this source" (42a) renders for *every* viewer of a session — including read-only P1 end users — yet mutates global knowledge state (archives the item for all users); the redesign gates it by role like the feedback-dialog deactivation path (58). Agent visibility itself is backend-RBAC'd — `/chat` only lists agents the user may use (1–4). Feature flags: transcription (62) and TTS (56) by env config; suggestions (63) and thumbs feedback (57) per agent; budget chip (73) per user; managed-context notice (72) per agent tool config.

### UX review

| # | Severity | Issue | Evidence |
|---|----------|-------|----------|
| U1 | **High** | Fixed-width layout: composer, suggestions, error alert, notices, file grid are hard-coded `w-[850px]`; message internals have `min-w-[500px]`/`w-[500px]`. Anything narrower than ~900px horizontally overflows. | `chat.tsx:1117,1130,1152,1402,1414,1421,1433`; `mr:652,1007,1016` |
| U2 | **High** | The session history sidebar is `hidden … md:flex` with **no mobile alternative** — on a phone P1 cannot see history, start a named session, or reach search. | `sessions:199` |
| U3 | **High** | Destructive inconsistency: sidebar session delete fires immediately with no confirmation; search bulk-delete uses AlertDialog; file delete uses `window.confirm`; the citation-dialog "Deactivate this source" (42a) archives a knowledge item **globally** on one click — no confirmation, no role gate. Four destructive flows, three patterns, two with no confirmation at all — violates philosophy rule "destructive lives at L3+ with confirmation" and anti-pattern #4. Resolved by ladder rows 15/23/81 (shared ConfirmDialog) and 42a/58 (inline two-step confirm). | `sessions:379-393`; `search:288-307`; `session-files-panel.tsx:72`; `response.tsx:357-376, 564-582` |
| U4 | **High** | Tool approval card inverts emphasis: **Deny** is the filled high-contrast button, both Allow actions are outlines; colors are hardcoded grays/ambers outside the token system; the "Run {tool}" row has a chevron but no action; "Allow for this chat" writes an invisible, irrevocable localStorage pre-approval with no UI to review or undo. | `tool-call-approval.tsx:65-77, 86-150, 107-115` |
| U5 | **High** | L1 altitude is wrong for P1: model-override select, context progress bar, "Turn this conversation into a reusable template" hint, Share, Save as Routine, Skills/Tools/Budget chips are all permanently visible. A non-technical end user faces builder machinery before typing a word (anti-pattern #7; principle 1). | `chat.tsx:886-1029, 1224-1397` |
| U6 | Med | Hover-only affordances: session timestamps and the rename/delete menu (`max-h-0 opacity-0 group-hover:*`) are unreachable by keyboard and invisible on touch; same for file-row actions and image-history overlay buttons. | `sessions:334-341, 353-362`; `file-row.tsx:58`; `image-generation-widget.tsx:701` |
| U7 | Med | Token transparency half-shipped: rich breakdown (input/output/reasoning/cached) is computed and the `Context` ai-element is imported, but never rendered; only an unlabeled top `Progress` strip and per-message totals exist. Violates "trust through transparency" placement (≤L2, discoverable). | `chat.tsx:59-69, 415-451, 886-890` |
| U8 | Med | Two toast systems in one flow: chat uses `useToast`, session-files uses `sonner` — different look, position, behavior. | `chat.tsx:52` vs `session-files-panel.tsx:7` |
| U9 | Med | Empty state is busy: logo + lottie + greeting/welcome message stack (three focal points), centered at `max-w-2xl` while the conversation column is 850px and the composer another width — three competing widths on one screen. | `chat.tsx:1034-1061, 1152` |
| U10 | Med | The streaming placeholder is a 500px skeleton bar with rotating text inside a `Skeleton` component — visually heavy, mismatched with "skeletons mirror real layout". | `mr:1014-1024` |
| U11 | Med | Web-citation dialog embeds the source page in a `height: 100vh` iframe inside a `max-h-[80vh]` dialog (double scrolling); many sites block framing — no fallback detection. | `response.tsx:224, 296` |
| U12 | Med | Header is absolutely positioned over the conversation with hardcoded `dark:bg-black bg-white` instead of theme tokens; the progress strip overlays it at `top-4`. | `chat.tsx:887-892` |
| U13 | Med | Duplicate/ambiguous labels: both thumbs share `label="Feedback"` (screen readers can't distinguish); model select has no accessible label; "Search chats" uses a `SearchAlert` icon. | `mr:1133-1141`; `chat.tsx:894-900`; `sessions:264` |
| U14 | Low | Sidebar refetches the full session list (`network-only` + refetchQueries) on every mutation; 12 hand-written skeleton rows. | `sessions:61-77, 277-291` |
| U15 | Low | Dead code paths: dormant "create" dialog mode (`sessions:49`), unused `Context`/Tooltip imports (`chat.tsx:59-69, 16-21`), dead `projectQuery` — `GET_PROJECT_BY_ID` is fetched whenever `currentSession?.project` is set but its result is never rendered (`chat.tsx:297-302`), `console.log` in server page and renderer (`[session]/page.tsx:89`, `mr:495-497`). |
| U16 | Low | CapabilityPopover paints purple chips for every enabled skill — accent color used decoratively (anti-pattern #5). | `chat.tsx:1645-1652` |
| U17 | Low | Prompt selector is a fixed three-column dialog (`w-44` + `w-[340px]` + flex) — fine on desktop, unusable below ~768px. | `prompt-selector-modal.tsx:171-229` |

### Mobile audit (390 px)

The chat area is **broken**, not merely degraded:

- **Horizontal overflow everywhere**: `w-[850px]` composer/notices (`chat.tsx:1152` etc.) force the page to ~2.2× viewport width; the user must pan to type. `min-w-[500px]` file grids and edit textareas (`mr:652,1007`) overflow message bubbles.
- **No history/new/search access**: the sessions sidebar is `hidden` below `md` (`sessions:199`) and nothing replaces it. A phone user is trapped in whatever session they deep-linked into.
- **Viewport height bugs**: `h-[100vh]` (`chat/[agent]/layout.tsx:22`, `chat.tsx:883`, `loading.tsx:5`) ignores mobile browser chrome — the composer sits behind the iOS/Android toolbar; should be `dvh` + safe-area padding.
- **Session files panel**: a horizontal `ResizablePanelGroup` (`chat.tsx:872-1557`) at 390px gives the panel as little as 78px; drag handles are poor touch targets.
- **Hover-only controls** (U6) are invisible on touch: session menu, file actions, image download/reference overlays, budget hover card, citation `title` tooltips.
- **Dialogs**: prompt selector (3 fixed columns, `h-[82vh]`), items-selection modal, save-workflow modal (tabbed editor), citation dialogs (`max-w-[900px]`, embedded iframes) all assume desktop widths.
- **Tool approval**: three side-by-side buttons (`tool-call-approval.tsx:86-150`) wrap badly at 390px.
- **Agent selection grid** is responsive (`grid-cols-1 md:grid-cols-2`) and the search page mostly survives — the only two screens that do.

---

## 2. Jobs to be done

**PRIMARY: P1 — The End User.** Their #1 job in one sentence: *open Exulu (often on a phone), land in a conversation with the right agent, and get an answer — with zero ceremony.*

**P1 jobs on this page, by frequency:**
1. Send a message to the default/last-used agent and read the streaming answer (daily, many times).
2. Continue or find a previous conversation (daily) — history list, search.
3. Work with files: attach, review what the agent produced, download (weekly+).
4. Dictate instead of type; have answers read aloud (situational; mobile-heavy).
5. Use a prompt template; answer agent questions; pick generated images (weekly).
6. Give feedback on a bad answer (occasional).
7. Share a conversation with a colleague (occasional).

**SECONDARY: P2 — The Power User**, debugging the agents they build:
1. Inspect reasoning steps, tool calls, citations, and raw inputs/outputs (their core loop).
2. Try a different model on the same conversation (model override).
3. Toggle skills/tools off to isolate behavior; pin/manage knowledge contexts and presets.
4. Approve/deny tool calls; deactivate a bad knowledge source from negative feedback.
5. Turn a good conversation into a reusable routine/workflow template.

**Ownership matrix check:** `personas.md` lists Chat as P1-primary / P2-secondary (debugging). The code confirms this exactly — every P2 affordance found (26, 30, 48–50, 58, 69–70) is debugging/curation layered onto a P1 conversation surface. **No correction needed.** The design failure is not ownership but altitude: P2's L2–L3 machinery currently renders at L1.

---

## 3. Design concept

**Concept name: "The Quiet Column."** One centered conversation column on a full-bleed work surface. Everything that is not *reading the answer* or *composing the next message* moves one deliberate step away: history into a switchable rail/drawer, machinery into a header overflow and a composer "+" menu, depth into panels. Mobile is the design target, desktop the enhancement.

### Default view (L1)

Desktop (≥1024px), arriving at `/chat/[agent]/[session or new]`:

```
┌─────────┬──────────────────────────────────────────────┬─────────┐
│ App nav │  ChatHeader (h-12, border-b)                 │ (files  │
│ (shell) │  [☰ history] [AgentAvatar] Agent name        │  panel, │
│         │     Session title (inline-editable) · ⋯menu  │  closed │
│         │──────────────────────────────────────────────│  by     │
│         │                                              │ default)│
│         │        Conversation column                   │         │
│         │        max-w-3xl mx-auto px-4                │         │
│         │        (messages, streaming)                 │         │
│         │                                              │         │
│         │   [suggestion chips — one wrap row]          │         │
│         │  ┌────────────────────────────────────────┐  │         │
│         │  │ Composer card (max-w-3xl)              │  │         │
│         │  │ [＋] textarea ……………………  [🎤] [⬆ send]   │  │         │
│         │  │ {pinned-context chips, only if any}    │  │         │
│         │  └────────────────────────────────────────┘  │         │
│         │   AI can make mistakes. Check important info.│         │
└─────────┴──────────────────────────────────────────────┴─────────┘
```

- **One width.** Conversation, suggestions, alerts, notices, and composer all share `max-w-3xl mx-auto w-full px-4` (≈768px) — replacing today's 850/672/850 mix (U1, U9).
- **History rail** (the current 250px sidebar, redesigned) is collapsible and remembered; collapsed by default below `lg`. Contains: New chat (primary action, the *one* purple element in the rail), search field (filters the list inline, replacing a separate nav hop for short queries; full search page remains for bulk ops), Recents with always-visible timestamps and a focus-visible ⋯ menu.
- **ChatHeader** is the page's only header (PageHeader, work-surface variant): agent identity, session title with inline rename (relocates item 14 up — renaming is frequent), and a single ⋯ **OverflowMenu** holding Share, Save as Routine, Model, Usage, Delete. A small quiet **context-usage chip** (`text-xs text-muted-foreground`, e.g. "12% · 24k") sits right of the title when `maxContextLength` is set — replacing the unlabeled progress strip (27, U7); it turns amber at 80%.
- **Empty state** (new session): one EmptyState — AgentVisual *or* logo (single focal point; visual if the agent has one), greeting or welcome message, 2–3 starter suggestion chips if enabled. No second logo.
- **Primary action:** the send button is the screen's purple accent. Everything else in the composer is ghost/muted.
- **The composer row** has exactly four always-visible controls: **＋** (attach menu), textarea, mic (flag-gated), send/stop. The ＋ menu (Popover) contains: Upload/attach files, Add knowledge context, Insert prompt template, Open session files panel, and — when the agent has any — Skills & tools toggles. Pinned-context chips render under the textarea only when present, with the "Save preset" affordance at the end of that chip row.
- **Read-only sessions:** the composer region is replaced by a single muted bar: "Read-only — shared by {creator}. Ask them for write access." (consolidates 36 + 78).

### Disclosure ladder

Every numbered inventory item, mapped. L1 = visible on arrival; L2 = one step (expand/panel/menu); L3 = deliberate dialog/config; L4 = raw/expert.

| # | Capability | Level | Where it lives in the new design |
|---|-----------|-------|----------------------------------|
| 1 | Agent selection page | L1 (of `/chat`) | Unchanged route; PageShell + Toolbar search + agent card grid; opens chat **without** pre-creating a session (lazy creation, item 34, already exists) |
| 2–3 | Single/default agent redirects | L0 | Unchanged server redirects |
| 4–5, 7 | No-agents / error alerts | L1 | Shared EmptyState (error variant) instead of bare Alerts |
| 6 | `/chat/[agent]` redirect | L0 | Unchanged |
| 8 | Session loading | L1 | Skeleton mirroring the real layout (header bar + message bubbles + composer), not a centered spinner |
| 9 | Back to agent selection | L2 | History rail header: agent name is a button → agent switcher (same selection grid in a dialog); removes the dead "back" row |
| 10 | Agent name | L1 | ChatHeader identity block |
| 11 | New session | L1 | Primary button atop history rail; mobile: header "new chat" icon-button |
| 12 | Search chats | L1/L2 | Inline filter field in the rail (L1); full search page via "See all results" (L2) |
| 13 | Recents list | L1 | History rail / mobile history sheet; timestamps always visible (`text-xs text-muted-foreground`) |
| 14 | Rename session | L2 | Inline title edit in ChatHeader + rail row ⋯ menu (focus-visible, not hover-only) |
| 15 | Delete session | L3 | Rail row ⋯ menu → shared **ConfirmDialog** |
| 16 | Show all chats | L2 | "See all" link under Recents → search page |
| 17 | Sidebar skeletons/empty | L1 | Skeleton rows ×6; EmptyState "No conversations yet" + New chat action |
| 18 | Named session creation | L2 | "New chat" gets an optional name via the rail ⋯ → "New named chat…" dialog (revives the dormant mode deliberately) |
| 19 | Back to chat (search) | L1 | Search page header back affordance (PageHeader) |
| 20 | Title search | L1 | Toolbar search input on the search page |
| 21 | Result rows | L1 | ListDetail list rows (title, time) |
| 22 | Multi-select | L2 | Row checkboxes appear via a "Select" toolbar toggle (calmer default); select-all in toolbar |
| 23 | Bulk delete | L3 | Toolbar destructive button → shared ConfirmDialog |
| 24 | Pagination | L1 | "Show more (N of M)" unchanged |
| 25 | Search empty/loading | L1 | Shared EmptyState + skeletons |
| 26 | Model override | L3 | ⋯ menu → "Model… (current: {name})" opens a small dialog/popover with the provider-logo list and "(default)" marker; an active override shows a quiet `outline` badge "Model: {name} ×" next to the usage chip so the override is never hidden once engaged (trust rule: model identity ≤L2 — the *current* model is always visible in the badge/usage popover) |
| 27 | Context-window usage | L1 chip → L2 detail | Usage chip in ChatHeader; click → Usage popover |
| 28 | "Reusable template" hint | L2 | Deleted as standing text; becomes the description line inside the Save-as-Routine menu item and its dialog |
| 29 | Share + RBAC | L2/L3 | ⋯ menu → Share popover (copy link L2; access-rights editor in an "Access" collapsible = L3) |
| 30 | Save as Routine | L3 | ⋯ menu → SaveWorkflowModal (unchanged contents); menu item disabled with tooltip until ≥1 exchange |
| 31 | Empty/welcome state | L1 | Single-focal EmptyState (see Default view) |
| 32–33 | History load + streaming | L1 | Unchanged behavior |
| 34 | Lazy session creation | L1 (invisible) | Unchanged; also used by `/chat` entry (item 1) |
| 35 | Stick-to-bottom + jump button | L1 | Unchanged (`ConversationScrollButton`) |
| 36 | Read-only badge | L1 | Merged into the read-only composer bar |
| 37 | Error alert | L1 | Inline alert in-column (shared width); raw error details behind a "Details" disclosure (L4) |
| 38 | Token breakdown | L2 | Usage popover: renders the existing `Context` ai-element (input/output/reasoning/cached + per-message totals) |
| 39 | Streaming placeholder | L1 | Replace skeleton-box with the `shimmer` text loader on a normal-width line |
| 40 | AgentVisual by last reply | L1 | Kept, `w-8 h-8`, only while streaming/last message |
| 41 | Markdown rendering | L1 | Unchanged |
| 42–43 | Knowledge/web citation badges | L1 badge → L3 dialog | Badges inline; dialogs become responsive (mobile: full-screen sheet); iframe preview kept behind an explicit "Load preview" button with open-in-new-tab fallback (fixes U11) |
| 42a | Deactivate cited knowledge source | **L3, RBAC-gated** | Lives at the bottom of the citation dialog (already L3) but is **rendered only for roles permitted to run the archive mutation** — write/curation rights on the cited context, the same check as the feedback path (row 58); read-only viewers and plain P1 users never see it (fixes the ungated state in U3/RBAC summary). Confirmation is an **inline two-step confirm inside the same dialog** — clicking "Deactivate this source…" (destructive-outline) swaps the warning line into a confirm strip: "Archives *{item}* globally for every user." + **Confirm deactivate** (destructive) / **Cancel** (ghost) — because a nested ConfirmDialog would stack overlays (anti-pattern #3) and descend a second level mid-flow (ladder rule). Satisfies "anything destructive lives at L3 or deeper with confirmation" without a second modal; success collapses the strip into the existing "Deactivated" resolved state |
| 44 | Sources list | L2 | Collapsible, unchanged |
| 45 | Reasoning parts | L2 | Collapsible, unchanged |
| 46 | Todo list | L1 | Inline, unchanged |
| 47 | question_ask card | L1 | Inline (it *is* the conversation), restyled to column width |
| 48 | Context-search results + agentic steps | L2 | Collapsed one-line summary chip ("Searched 3 contexts · 12 items") → expands to steps + result cards; raw input/output JSON inside ToolCallChips = L4 |
| 49 | Generic tool blocks | L2 | Collapsed Tool header by default; input/output = L4 inside |
| 50 | Tool approval | L1 (blocking) | Inline card, rebuilt: tool name + input summary visible, **Allow once** = primary, "Allow for this chat" = secondary, **Deny** = destructive-outline; pre-approvals listed & revocable in the ＋ menu → "Skills & tools" sheet ("Approved for this chat" section) |
| 51 | Image widget trigger | L1 | Inline widget where the tool result appears |
| 52–54 | Legacy image / image parts / file blobs | L1 | Inline, responsive widths (`max-w-full`) |
| 55 | Retry/Copy/Download actions | L2 | Action row fades in on hover (desktop) and is always visible on the last assistant message + on touch; each with tooltip + distinct aria-labels |
| 56 | TTS read-aloud | L2 | Same action row (flag-gated) |
| 57 | Thumbs feedback | L2 | Same action row (agent-gated) |
| 58 | Feedback dialog + source deactivation | L3, RBAC-gated | Dialog unchanged in content; the per-source "Deactivate" uses **exactly the pattern of row 42a** — rendered only for roles permitted to archive items, and confirmed via the same inline two-step confirm strip inside the feedback dialog (never a stacked ConfirmDialog, anti-pattern #3). One mutation, one gate, one confirmation pattern across both entry points (anti-pattern #4) |
| 59 | Message edit/remove plumbing | L3 (off in chat) | Props preserved in MessageRenderer for the workflow editor; not exposed in chat (unchanged) |
| 60 | Textarea + limits + counter | L1 | Composer; counter appears ≥90% as today |
| 61 | Send/Stop | L1 | Primary button, swaps to Stop while streaming |
| 62 | Mic / speech-to-text | L1 | Composer icon (flag-gated), unchanged flow |
| 63 | Suggestion chips | L1 | Single row above composer, horizontally scrollable on mobile |
| 64 | Session files toggle | L2 | ＋ menu → "Session files"; when files exist, a quiet counter chip ("3 files") also appears in ChatHeader as a direct opener |
| 65 | Prompt templates | L2/L3 | ＋ menu → PromptSelectorModal (made responsive; mobile = full-screen sheet with stacked category→list→detail navigation); `?promptId=` deep link unchanged |
| 66 | Knowledge context attach | L2/L3 | ＋ menu → ItemsSelectionModal (responsive) |
| 67 | Pinned context chips | L1 (conditional) | Chip row under textarea, only when items exist |
| 68 | Save context preset | L3 | End of chip row → SavePresetModal; RBAC stays in its "Advanced" collapsible |
| 69–70 | Skills/Tools toggles | L2 | ＋ menu → single "Skills & tools" popover/sheet with two sections, switches, enable/disable-all; "N off" badge bubbles up onto the ＋ button so a non-default state is visible at L1 |
| 71 | disabled/approved tools in requests | — | Unchanged transport behavior |
| 72 | Managed-context notice | L2 | One-line note inside the Context modal and the ＋ menu's Context entry subtitle; on first load of a managed-context agent, a one-time dismissible inline hint above the composer |
| 73 | Budget chip + block | L1 (conditional) | Healthy budget: nothing at L1 (cost detail lives in the Usage popover = L2, satisfying "costs ≤L2"). At ≥80%: amber chip appears by the usage chip. Exceeded: composer disabled with destructive bar (as today) |
| 74 | Attachment previews + remove | L1 (conditional) | Chip/thumbnail row inside the composer card |
| 75 | addToContext from tools | L2 | "Attach to next message" action on file-producing tool outputs (label instead of bare icon) |
| 76 | Disclaimer | L1 | Below composer, `text-xs text-muted-foreground text-center` |
| 77 | Esc closes overlays | L1 | Keep; extend to all sheets |
| 78 | Read-only hides composer | L1 | Read-only bar (see Default view) |
| 79 | Resizable files split | L2 | Desktop: **SidePanel** (resizable as today); <`lg`: full-height Sheet from the right |
| 80 | File list + polling | L2 | Inside the panel, unchanged |
| 80a | Panel loading/empty/error states | L2 | Carried into the panel and its mobile Sheet (row 79) unchanged in meaning: loading becomes skeleton rows mirroring file rows (philosophy §6) instead of a spinner; "No files yet…" becomes the shared EmptyState with the upload zone as its action; error state keeps message + Retry button |
| 81 | File preview/download/delete | L2/L3 | Actions always visible at panel widths (icon buttons with tooltips); delete → shared ConfirmDialog (replaces `window.confirm`) |
| 82 | Preview pane | L2 | Unchanged content, `h-full` instead of `h-[calc(100vh-220px)]` |
| 83 | Upload zone | L2 | Bottom of panel, unchanged |
| 84 | Privacy note | L2 | Tooltip/info-icon on the panel title (one line is still fine inline on desktop) |
| 85 | Image model/size/quality/count | L1 (in widget) | Widget header collapses to a single "Settings" disclosure on mobile |
| 86 | Style picker + editor | L2/L3 | Style select in widget; Edit/New style dialog = L3 |
| 87 | Prompt + reference images + mask | L1/L2 | Prompt at L1; references behind "Add reference" (existing Uppy) |
| 88 | Generate/cancel | L1 | Full-width primary inside widget |
| 89 | Generation history | L2 | Collapsible "History (N)" section; image actions visible on touch |
| 90 | Use selected | L1 (in widget) | Sticky widget footer |
| 91 | Final-selection collapse | L1 | Unchanged |

### Layout & components

**Shared primitives (philosophy §5):**
- **PageShell** — full-bleed work-surface variant (`h-dvh flex min-h-0`), used by the chat layout; centered-content variant for `/chat` and `/chat/[agent]/search`.
- **PageHeader** — `/chat` ("Choose an agent") and search page ("Search conversations") use the standard header; the session screen uses the **ChatHeader** variant (same `h-12`/`text-sm` density, title-left/actions-right contract).
- **Toolbar** — search page (search input + Select toggle + bulk-delete) and `/chat` (agent search).
- **ListDetail** — search page list; history rail follows the same list-row recipe.
- **EmptyState** — new-session welcome, empty recents, search no-results, no-agents, error states.
- **ConfirmDialog** — session delete (single + bulk) and file delete. One pattern, three call sites.
- **NEW shared primitives to add to philosophy §5** (flagged in §4): **SidePanel** (desktop resizable side panel that degrades to a right Sheet below `lg`; needed again by data/evals detail views) and **OverflowMenu** (standardized ⋯ DropdownMenu with icon+label items, destructive section last).

**Component composition (shadcn + ai-elements):**
- ChatHeader: `div h-12 border-b px-4 flex items-center gap-2` — `Avatar`(AgentVisual) · agent name (`text-sm font-medium`) · `/` · session title (`Input` ghost variant on click, Enter/blur saves = item 14) · usage chip (`Badge variant="outline"`) · spacer · files chip · `OverflowMenu` (`DropdownMenu`).
- Usage popover: `Popover` rendering `Context/ContextContent*` from `ai-elements/context.tsx` (finally used) + `BudgetBar` when `user.budget` exists.
- History rail: `aside w-64 border-r` (not 250px; `w-64` token), `Button variant="default"` New chat, `Input` filter, list rows `rounded-md px-2 py-2 hover:bg-accent data-[active]:bg-muted`; row menu `DropdownMenu` triggered by a `Button variant="ghost" size="icon"` that is `opacity-0 group-hover:opacity-100 focus-visible:opacity-100` (keyboard-reachable, fixes U6).
- Composer: `Card`-like `rounded-lg border bg-card p-2 max-w-3xl mx-auto w-full` — `Popover`(＋ menu) · `TextareaAutosize` · mic `Button variant="ghost" size="icon"` · send `Button size="icon"` (default/purple). Chip rows: `flex flex-wrap gap-1.5 pt-2`.
- Messages: keep `Message/MessageContent` (user bubbles `bg-secondary`, assistant plain) and `Response`; all internal fixed widths removed (`max-w-full`, grids `grid-cols-2 sm:grid-cols-4`).
- Tool approval: `Card` with `border-border bg-card` (theme tokens), `CardTitle text-base`, input summary via `getToolPreview`, buttons: `Button` (Allow once, default) / `Button variant="outline"` (Allow for this chat) / `Button variant="outline"` `text-destructive` (Deny). `flex-col sm:flex-row gap-2`.
- Dialogs: PromptSelector, ItemsSelection, SaveWorkflow, SavePreset, EditStyle, Feedback, citation dialogs all get `sm:max-w-*` widths with mobile full-screen sheet behavior (`h-dvh sm:h-auto`).
- Toasts: standardize on one system (sonner) across chat + files (fixes U8).

**Spacing & type (CLAUDE.md):** header `h-12 px-4`; column `px-4`, message gap `gap-6` (rhythm "Medium"); composer internals `gap-2 p-2`; section titles in popovers `text-xs uppercase text-muted-foreground`; body `text-sm`; metadata `text-xs`; code/IDs `font-mono`. Accent purple appears at most three times on the default screen: send button, New chat button, active nav item.

### Mobile behavior

Designed for P1's mobile job (`personas.md`: "full chat experience — composing, streaming, files, history — must be excellent").

**< 640px (sm), the primary target:**
- Shell: `h-dvh` everywhere (kills `h-[100vh]`); composer wrapped with `pb-[env(safe-area-inset-bottom)]`; input `font-size ≥16px` to prevent iOS zoom.
- ChatHeader compresses to: `[☰]` history trigger · agent avatar+name (tap = session title actions) · `[+ new]` · `[⋯]`. Usage chip folds into ⋯ → Usage.
- **History = left Sheet** (`Sheet side="left" w-[85vw] max-w-sm`): New chat, filter, Recents, See all — full parity with the rail (fixes U2). Swipe/scrim to dismiss.
- Conversation column is `w-full px-4`; every fixed width from U1 removed.
- Composer controls unchanged (＋ / text / mic / send) — already a 4-control mobile pattern; suggestion chips become a single horizontally scrollable row (`overflow-x-auto no-scrollbar`).
- **Session files = right Sheet at 100vw** with the same list/preview/upload stack; preview iframes `h-full`.
- All multi-pane dialogs become full-screen sheets with stacked steps (prompt selector: categories → list → detail with back).
- Touch affordances: message action row always visible under the last assistant message and revealed by long-press elsewhere; file-row and image-history actions always visible at icon size with 44px hit areas.
- Tool approval buttons stack vertically, full width.

**640–1024px (sm–lg):** history rail hidden by default, toggled as overlay rail; files panel = Sheet; conversation column fluid `max-w-3xl`.

**≥1024px (lg):** rail persistent (collapsible, remembered per `localStorage` as today's files-panel state is); files panel = resizable SidePanel; everything else identical to mobile structurally — same components, more room.

### Motion

Per CLAUDE.md timings; all wrapped in `prefers-reduced-motion` guards:

1. **Streaming text shimmer** on the in-progress assistant line (existing `shimmer.tsx`) — continuous, replaces the skeleton box (item 39).
2. **Send affirmation**: user bubble fades/slides in `150ms ease-out` from the composer (explains origin); send icon swaps to stop with a `150ms` cross-fade.
3. **History sheet / files panel**: slide `300ms ease-in-out`; desktop rail collapse animates width `200ms`.
4. **Scroll-to-bottom button**: fade+rise `150ms` on appear (existing stick-to-bottom logic).
5. **Disclosure expands** (reasoning, tools, context-search, sources): height auto-animate `200ms`; chevron rotate `150ms`.
6. **Usage chip → amber** at 80%: `300ms` color transition — the only ambient state-change animation.
7. Reasoning-step stagger (existing `mr:1340-1355`) capped at 5 × 60ms; no decorative zoom-ins.

---

## 4. Implementation notes

**Files to change**
- `app/(application)/chat/[agent]/layout.tsx` — PageShell (work-surface), `h-dvh`, render history rail/sheet wrapper.
- `app/(application)/chat/[agent]/chat-sessions.tsx` → split into `components/chat/history-rail.tsx` + `components/chat/session-row.tsx`; add mobile Sheet variant; route deletes through ConfirmDialog; focus-visible row menus; wire the dormant named-create mode (item 18).
- `app/(application)/chat/[agent]/[session]/chat.tsx` (1813 lines) → decompose: `chat-header.tsx` (items 10, 14, 26–30, 38, 64, 73), `composer.tsx` (60–77), `attach-menu.tsx` (64–70, 72), `usage-popover.tsx` (27, 38, 73), keep transport/state in a `use-chat-session.ts` hook. Remove all `w-[850px]`/`h-[100vh]`; single `max-w-3xl` token.
- `app/(application)/chat/[agent]/search/page.tsx` — PageHeader + Toolbar + ListDetail + ConfirmDialog; "Select" toolbar toggle.
- `app/(application)/chat/page.tsx` — PageShell/PageHeader + EmptyState variants.
- `components/message-renderer.tsx` — remove fixed min-widths (652, 1007, 1016); replace streaming skeleton with shimmer; distinct thumbs aria-labels; touch-visible action row.
- `components/tool-call-approval.tsx` — rebuild with theme tokens + corrected button hierarchy; emit pre-approval list for the revocation UI.
- `components/session-files/*` — ConfirmDialog for delete, sheet-compatible sizing, sonner already in use (keep; migrate chat to sonner).
- `components/ai-elements/response.tsx` — citation dialogs responsive; "Load preview" gate for iframes.
- `…/components/prompt-selector-modal.tsx`, `components/items-selection-modal.tsx`, `components/save-workflow-modal.tsx`, `components/save-preset-modal.tsx`, `components/image-generation/*` — responsive/sheet passes only; functionality unchanged.

**Shared components needed**
- Existing per philosophy §5: PageShell, PageHeader, Toolbar, ListDetail, EmptyState, ConfirmDialog.
- **NEW (flag for philosophy §5):** `SidePanel` (resizable desktop / Sheet mobile container — also wanted by data & evals docs), `OverflowMenu` (standard ⋯ action menu). Chat-local but reusable: `UsagePopover` (token+budget transparency widget — candidate for dashboard reuse).

**Scope: XL.** Largest page in the app; touches a 1813-line monolith plus the renderer (1780 lines), ~12 satellite components, and is the reference implementation for SidePanel/OverflowMenu and the mobile sheet patterns.

**Dependencies**
- Shell/nav redesign (`design/navigation.md`): the history rail must coexist with the app sidebar (rail sits inside the chat page, not the shell); mobile header hamburger must not collide with the history trigger — agree on left=app-nav, in-page ☰=history.
- `design/responsive.md` breakpoint contracts (tables→cards, panels→sheets) — chat is the first consumer.
- Shared ConfirmDialog/EmptyState must land first (used by agents/data pages too).
- Backend untouched: transport headers, suggestion endpoint, session-files API, image endpoints all unchanged. This includes the **project-scoped agent fetch**: for project-linked sessions the server page passes `project: sessionData.agent_sessionById.project` into `GET_AGENT_BY_ID` (`[session]/page.tsx:80-87`) — invisible transport behavior the chat.tsx decomposition must preserve. (The dead client-side `projectQuery`, U15, may be removed; the server-side project scoping may not.)

**Risks**
1. **Regression surface**: chat.tsx decomposition touches streaming state, lazy session creation, and localStorage keys (`pre-approved-tool-calls-*`, `chat.sessionFilesPanel.open`) — keep keys stable; add integration tests for send→create-session→replaceState and approval→resend loops.
2. **Citation parsing** (regex-on-text, `mr:556-640`) is fragile; restyling must not alter the text pipeline — treat as black box this pass.
3. **Hover→touch conversions** can add visual noise; gate "always visible" actions to the last message + touch devices only.
4. **Model-override demotion to L3** may annoy P2 power users — mitigate with the persistent override badge and a keyboard shortcut (`⌘.` opens ⋯ menu); revisit with usage telemetry.
5. **Iframe previews** (web citations, PDFs) behave differently inside sheets on iOS Safari — needs device QA.
