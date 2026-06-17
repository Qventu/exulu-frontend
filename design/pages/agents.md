# Agents — Review & Design Concept
**Routes:** `/agents`, `/agents/edit/[id]`  **Primary persona:** P2 (Power User)  **Secondary:** P4 (programmatic info: ID/slug/endpoint), P1 (incidental: launches chats from the list today)  **Current state:** Feature-rich but shapeless — the list page doubles as a chat launcher with surprise side effects, and the edit page is a wall of 10+ equal-weight cards whose two-column grid is hard-broken on mobile.

---

## 1. Current state

Source files:

- List page: `app/(application)/agents/page.tsx`
- List components: `app/(application)/agents/components/agent-card.tsx`, `agent-details-sheet.tsx`, `create-new-agent-card.tsx`, `create-new-agent.tsx`, `agent-model-selector.tsx`, `agent-provider-selector.tsx` (dead code, zero imports), `agent-delete.tsx`
- Edit page: `app/(application)/agents/edit/[id]/page.tsx` (server component), `form.tsx` (1,663 lines), `components/agent-hierarchy-view.tsx`, `components/agent-tool-card.tsx`, `components/prompt-browser-sheet.tsx`
- Shared deps: `components/rbac.tsx` (RBACControl), `components/reranker-selector.tsx`, `components/lottie.tsx` (AgentVisual), `components/uppy-dashboard.tsx`, `app/(application)/prompts/components/prompt-card.tsx` + `prompt-editor-modal.tsx`, `queries/queries.ts` (GET_AGENTS:168, CREATE_AGENT:949, UPDATE_AGENT_BY_ID:1024, COPY_AGENT_BY_ID:990, REMOVE_AGENT_BY_ID:1421, AGENT_FIELDS:114)

**RBAC summary:** The list page gates *create* and *edit* on `user.super_admin || user.role?.agents === "write"` (`page.tsx:29`). Read-only users still see all agents they have access to, can open details, and can start chats. The edit route has **no client-side gate** — enforcement is server-side via GraphQL (`edit/[id]/page.tsx:13-29`). Agent-level visibility itself (`rights_mode`: private/users/roles/teams/public with per-user/per-role read|write rights) is configured *on* the agent via `RBACControl` (`components/rbac.tsx:39-48`). **Caution:** the teams half of that sentence is currently broken on this page — `RBACControl` supports per-team assignment, but the agents form drops the team selections on save (trapped capability; see item 45 and review #21).

### Functionality inventory

This list is the contract. Every numbered item must appear in the disclosure ladder in section 3.

**List page — `/agents`**

1. Fetch and display agent collection — `GET_AGENTS`, page 1, hard `limit: 100`, sorted `updatedAt DESC` (`page.tsx:31-42`). No pagination UI despite paginated query.
2. Loading state: 8 pulsing skeleton blocks (h-80) in the grid (`page.tsx:136-142`).
3. Error state: heading + description (`page.tsx:105-114`).
4. Client-side search filter on agent **name only** (`page.tsx:44-52`, `page.tsx:124-133`).
5. "Create New Agent" dashed card — rendered only with write rights (`page.tsx:146-152`, gate at `page.tsx:29`).
6. Create dialog: Name input (autofocus) (`create-new-agent.tsx:145-153`).
7. Create dialog: Description input (`create-new-agent.tsx:154-162`).
8. Create dialog: Model selector ("Backend" label) via `AgentModelSelector` (`create-new-agent.tsx:163-168`).
9. Create dialog: "Generate AI image for this agent" checkbox, **default checked** (`create-new-agent.tsx:31`, `169-178`).
10. Create dialog: image style Select with 11 styles (origami, anime, japanese_anime, vaporwave, lego, paper_cut, felt_puppet, 3d, app_icon, pixel_art, isometric) (`create-new-agent.tsx:38-50`, `179-195`).
11. Create dialog: info alert explaining `OPENAI_IMAGE_GENERATION_API_KEY` is required for image generation (`create-new-agent.tsx:196-200`).
12. Create dialog: parallel generation of 4 avatar images with progress bar and per-slot done/loading tiles (`create-new-agent.tsx:71-109`, `244-271`).
13. Create dialog: generated-image selection grid, first image auto-selected, check overlay on the selection (`create-new-agent.tsx:112-138`, `263`).
14. Create dialog: monogram preview (first letter of name) when image generation is off (`create-new-agent.tsx:64-70`).
15. Create dialog: `CREATE_AGENT` mutation with `rights_mode` hard-coded to `"private"`, optional `model` and `image`; on success navigates to `/agents/edit/{id}` (`create-new-agent.tsx:211-242`, `page.tsx:54-66`).
16. Create dialog: validation — name required (toast); failure toasts for image generation and creation (sonner) (`create-new-agent.tsx:226-229`, `267`, `275`).
17. Agent card: animated avatar via `AgentVisual` (Lottie; custom `animation_idle`/`animation_responding` from S3 with presigned URLs, or bundled defaults) (`agent-card.tsx:60-62`, `components/lottie.tsx`).
18. Agent card: name (line-clamp-1) + description truncated to 200 chars and line-clamp-2, "No description available" fallback (`agent-card.tsx:44-49`, `93-95`).
19. Agent card: Active/Inactive badge (`agent-card.tsx:97-104`).
20. Agent card click → **immediately creates a chat session** (`CREATE_AGENT_SESSION`, title "New session with {agent}", `rights_mode: "private"`) and navigates to `/chat/{agent}/{session}`; success and error toasts (`page.tsx:74-102`, `agent-card.tsx:26-30`).
21. Agent card: pencil icon button → `/agents/edit/{id}`, only rendered for write users (`agent-card.tsx:70-80`, wired at `page.tsx:159`).
22. Agent card: info icon button → opens `AgentDetailsSheet` (`agent-card.tsx:81-89`, `page.tsx:168-174`).
23. Details sheet: identity header — image or monogram, name, Active/Inactive badge, model-name badge ("No model selected" fallback) (`agent-details-sheet.tsx:64-89`).
24. Details sheet: description with fallback (`agent-details-sheet.tsx:92-98`).
25. Details sheet: capability tiles for text/images/files/audio/video with tooltips listing the accepted MIME types per modality (`agent-details-sheet.tsx:100-153`).
26. Details sheet: enabled-tools list with `enabled/total` count badge (`agent-details-sheet.tsx:155-183`).
27. Details sheet: firewall ("Security") status badge Protected/Unprotected + list of active scanners (promptGuard, codeShield, agentAlignment, hiddenAscii, piiDetection) (`agent-details-sheet.tsx:185-214`). **The section is blind:** it reads `agent.firewall` (`agent-details-sheet.tsx:190-194`), but `AGENT_FIELDS` (`queries/queries.ts:114-167`) contains no `firewall` field, so the value is always `undefined` — the sheet can only ever render "Unprotected" with zero scanners, regardless of what the database holds (see item 69).
28. Details sheet: access-control section showing `rights_mode` badge ("Open" fallback) (`agent-details-sheet.tsx:216-225`).
28a. Details sheet loading state: a centered spinner fills the sheet while the agent + tools queries resolve (`agent-details-sheet.tsx:46-56`).

**Edit page — `/agents/edit/[id]`**

29. Server-side agent fetch by ID with destructive error alert on failure/not-found (`edit/[id]/page.tsx:13-45`).
30. Save: `UPDATE_AGENT_BY_ID` with the full payload — name, description, instructions, welcomemessage, defaultagent, category, active, memory, feedback, suggestions_enabled, model, animations, rights_mode + RBAC (users/roles only — team selections are dropped, see item 45), tools (JSON), skills (JSON) (`form.tsx:474-517`). The form also passes `firewall` (JSON, `form.tsx:499-502`), but the mutation declares no `$firewall` variable, so Apollo silently discards it (see item 69). Refetches `GET_AGENT_BY_ID`; **no success toast, no navigation**.
31. Back button → `/agents`, no unsaved-changes guard (`form.tsx:518-525`).
32. Delete: icon-only destructive button → type-to-confirm dialog (must type "delete this agent" / localized `agents.deleteDialog.confirmationText`), then `REMOVE_AGENT_BY_ID` and redirect to `/agents` (`agent-delete.tsx:20-72`, `form.tsx:402-409`, `526-530`).
33. Copy Agent: duplicates via `COPY_AGENT_BY_ID`, toast, navigates to the copy's edit page (`form.tsx:411-427`, `531-539`).
34. Agent image thumbnail in the "Agent" card header when set (`form.tsx:558-566`).
35. Agent ID display + copy-to-clipboard button with toast (`form.tsx:391-398`, `569-579`). (`slug` is also fetched in `AGENT_FIELDS` at `queries.ts:136` but never displayed.)
36. Name field, zod-validated 2–300 chars (`form.tsx:193-200`, `585-601`).
37. Category select — 9 hard-coded categories: marketing, sales, finance, hr, coding, support, research, knowledge, product (`form.tsx:94-104`, `603-635`).
38. Description textarea, max 10,000 chars (`form.tsx:202-209`, `637-658`).
39. Welcome Message textarea (shown in chat when the agent loads) (`form.tsx:659-678`).
40. System Instructions: read-only disabled textarea, rendered only when `agent.systemInstructions` is set by a developer (`form.tsx:679-704`).
41. Custom Instructions textarea, max 40,000 chars, included in every session (`form.tsx:705-730`).
42. "Go to chat" test card → `/chat/{id}/new`; copy notes super admins can test without activating the agent (`form.tsx:733-751`).
43. "Is this agent active?" switch — controls availability via UI and API (`form.tsx:756-778`).
44. "Set as default agent" switch — loads as the default agent on the chat page (`form.tsx:780-801`).
45. Access Control collapsible → `RBACControl`: rights_mode private/users/roles/teams/public; per-user and per-role read/write assignment; user search by email — **not debounced**, `searchUsers` triggers a refetch on every keystroke (`components/rbac.tsx:113-133`, wired at `:243`); role and team pickers (`form.tsx:803-843`, `components/rbac.tsx:39-110`). **Trapped capability — teams are silently lost:** `RBACControl` fully supports a teams mode with per-team read/write assignment (`rbac.tsx:43`, `48`, `56-72`, `450-539`) and emits the team selections as the 4th `onChange` argument (`rbac.tsx:67`, `164-166`), but the agents form (a) never passes `initialTeams` and (b) drops that 4th argument — `setRbac` stores only rights_mode/users/roles (`form.tsx:826-839`) — so the save payload sends `RBAC: { users, roles }` only (`form.tsx:494-498`), and `UPDATE_AGENT_BY_ID`'s RBAC selection likewise returns users/roles only (`queries/queries.ts:1079-1090`). Net effect: a user can pick "Shared with Teams", select teams, save — `rights_mode: "teams"` persists but the team assignments vanish, likely locking everyone but the owner out. See review #21.
45a. RBAC "all selected users" management dialog: when more than 5 users are selected, a "+N more users" link (`rbac.tsx:335-347`) opens a Dialog listing every selected user with view, edit-rights, and remove controls (`rbac.tsx:541-616`).
46. Provider Configuration collapsible: "{model} from {provider}" badge, modality capability tiles with MIME tooltips (text/images/files/audio/video) (`form.tsx:845-921`).
47. Model selection via `AgentModelSelector`: source switches between LiteLLM catalog (`GET_LITELLM_CATALOG`, when `ConfigContext.liteLLM.enabled`) and the Models table (`GET_MODELS_LITE`); in-dropdown search with auto-focus; provider logos; tag badges; "(inactive)" marker; **stale-value detection** rendering a red, disabled "(unknown — re-select): {value}" entry when the stored model isn't in the catalog (e.g. after the `EXULU_USE_LITELLM` toggle flips); empty-state guidance ("Edit config.yaml…" / "Create one in the Models page.") (`agent-model-selector.tsx:35-192`, used at `form.tsx:922-928`).
48. Prompt Templates collapsible: assigned-count in subtitle, list of assigned prompts rendered as minimal `PromptCard`s, empty state with hint (`form.tsx:934-994`, assigned prompts fetched server-side filtered at `form.tsx:332-343`).
49. Prompt Browser sheet ("Manage"): folder view from unique prompt tags + an untagged-prompts bucket **rendered with the label "All"** (`prompt-browser-sheet.tsx:250` — a mislabel: it holds only untagged prompts, not all of them; see review #22) with counts; folder-name search (the folder list is filtered by the same `searchQuery`, `prompt-browser-sheet.tsx:217-220`) and prompt search; assigned-first sorting with "Assigned to {agent}" / "Other Prompts" dividers; per-prompt Add/Remove toggling `prompt.assigned_agents`; toasts (`prompt-browser-sheet.tsx:35-352`).
50. Prompt Browser: "Create Prompt" → `PromptEditorModal` pre-assigned to this agent and pre-tagged with the open folder (`prompt-browser-sheet.tsx:180-191`, `353-361`).
51. Authentication info card: explains auth/budget live on the Model; "Edit this model" button opens `/models/edit/{model}` in a new tab. The "Manage models" → `/models` fallback branch is **dead code**: the button is disabled whenever no model is selected (`disabled={!selectedModel}`, `form.tsx:1018`), so the fallback label renders but can never be clicked (`form.tsx:996-1024`).
52. Agent Memory collapsible: enabled/disabled badge, searchable context combobox (Popover + Command) with a "None" option to clear; memory retrieval explained in helper copy (`form.tsx:1026-1127`).
53. "Enable feedback collection?" switch (`form.tsx:1129-1151`).
54. "Enable follow-up suggestions?" switch (up to 3 follow-up suggestions per reply; uses the agent's model; tokens count toward limits) (`form.tsx:1153-1177`).
55. Custom Visualizations collapsible — only when `configContext.fileUploads.s3endpoint` is set: upload idle and responding Lottie `.json` files via `UppyDashboard` (selection limit 1), with live `AgentVisual` previews (`form.tsx:1179-1278`).
56. Agentic Retrieval Configuration collapsible — only when the `agentic_context_search` tool exists: enabled/disabled badge, enable switch, and the tool's config fields (contexts, reranker, etc.) (`form.tsx:1280-1364`, tool resolved at `form.tsx:464-466`).
57. Tools search input with 300 ms debounce and inline clear (X) button (`form.tsx:256-263`, `1383-1402`).
58. Tools category filter (categories from `GET_TOOL_CATEGORIES`) + clear-filters button (`form.tsx:1405-1425`).
59. "Expand all" / "Collapse all" buttons — **currently dead controls**: they mutate `collapsedCategories` state (`form.tsx:1429-1438`) that `AgentHierarchyView` never receives (`agent-hierarchy-view.tsx:18-30`).
60. Tool result count: "N tools found/available" (`form.tsx:1440-1443`).
60a. Tools card header enabled-count summary: "N tools enabled for this agent" / "No tools enabled for this agent" in the card description (`form.tsx:1371-1377`) — distinct from item 60's found/available count.
61. Sub-Agents section: tools with `category === "agents"` listed separately with enabled/total badge; for each **enabled** sub-agent, its details are fetched (`GET_AGENT_BY_ID`) to show tool count, sub-agent count, and capability count as clickable chips; "Show agent's tools & sub-agents" button opens the nested `AgentDetailsSheet` (`agent-hierarchy-view.tsx:50-122`, `217-290`; `agent-tool-card.tsx:149-219`, `303-317`).
62. Tools section: regular tools as left-bordered rows with enable/disable switch (`agent-hierarchy-view.tsx:124-164`, `agent-tool-card.tsx:294-298`).
63. Tool row metadata: Agent/Tool type badge, category badge, config-completeness badge `filled/required` that turns destructive with an alert icon when incomplete (`agent-tool-card.tsx:113-141`).
64. Tool info sheet + config sheet (info icon always; settings icon when enabled and configurable; the config sheet **auto-opens** when enabling a tool that has config) (`agent-tool-card.tsx:223-292`, auto-open at `form.tsx:1465-1467`).
65. Tool config field types: `string` → textarea; `number` → input; `boolean` → switch; `reranker` → searchable `RerankerSelector`; default/variable → variables combobox with encrypted (🔒) indicator and a "Default value" preview card (`form.tsx:1551-1663`, `107-185`).
66. Skills section: list of skills (from `GET_SKILLS`) with enable/disable switches and enabled/total badge; persisted as `skills` JSON (`agent-hierarchy-view.tsx:166-209`, `form.tsx:1498-1506`).
67. Tools empty state when filters match nothing, with "Clear filters" action (`form.tsx:1510-1519`).
68. List exclusions: the agent's own tool is filtered out (no self-calls) and `agentic_context_search` is excluded from the general list because it has its own section (`form.tsx:346-348`, `agent-hierarchy-view.tsx:54-57`).
69. Firewall enabled flag + 5 scanner flags (promptGuard, codeShield, agentAlignment, hiddenAscii, piiDetection): form state exists (`form.tsx:265-280`, zod schema includes `firewall` at `form.tsx:220-230`) and the save handler passes `firewall: JSON.stringify(...)` (`form.tsx:499-502`) — but the capability is **triply trapped**: (a) **never loaded** — `AGENT_FIELDS` (`queries/queries.ts:114-167`) has no `firewall` field, so `agent.firewall` is always `undefined` and the state always initializes to all-false; (b) **never persisted** — `UPDATE_AGENT_BY_ID` (`queries/queries.ts:1024-1093`) declares no `$firewall` variable and its input has no firewall field, so the value the form passes is silently dropped (`grep firewall queries/queries.ts`: 0 hits); (c) **no editing UI** is rendered anywhere in the form. The only place scanners appear is the read-only details sheet (item 27), which — for the same missing-fetch reason — always shows "Unprotected" with zero scanners. Restoring this capability is not pure relocation: it requires GraphQL changes (and backend schema verification), see Section 4.

*Fetched-but-unsurfaced fields (relocation contract completeness):* besides `slug` (noted at item 35), `AGENT_FIELDS` also fetches `streaming`, `maxContextLength`, `authenticationInformation`, and `workflows { enabled, queue }` (`queries/queries.ts:130-141`) that are never rendered on these pages. They are not inventory items (no UI exists today); `maxContextLength` and `authenticationInformation` are natural candidates for the editor's Developer section, the rest stay fetch-only until another page claims them — nothing may be silently dropped if the query is trimmed.

### UX review

| # | Severity | Issue | Evidence |
|---|----------|-------|----------|
| 1 | **High** | Edit form layout is `grid grid-rows-1 grid-flow-col … lg:grid-cols-2` — `grid-flow-col` forces two side-by-side columns at **every** viewport width, so the form renders as two ~170 px columns on phones. | `form.tsx:551` |
| 2 | **High** | Firewall/scanner configuration is triply broken: no editing UI exists, the value is never fetched (`AGENT_FIELDS` has no `firewall` field — the details sheet always shows "Unprotected"), and the `firewall` JSON the form sends on save is silently dropped because `UPDATE_AGENT_BY_ID` declares no `$firewall` variable. A safety-critical capability is invisible, uneditable, and un-persistable (violates "Trust through transparency"). | `form.tsx:265-280`, `499-502`; `queries/queries.ts:114-167`, `1024-1093` (grep "firewall": 0 hits); `agent-details-sheet.tsx:190-194`; no firewall JSX anywhere in `form.tsx` |
| 3 | **High** | Clicking an agent card silently **creates a chat session** as a side effect, then navigates. No affordance says the card does this; accidental clicks create orphan sessions. The page's primary persona (P2) most often wants to *edit*, which hides behind a small pencil. | `page.tsx:74-102`, `agent-card.tsx:26-30` |
| 4 | **High** | Save gives no success feedback (no toast, no navigation, no dirty indicator) and Back discards edits with no unsaved-changes guard. Users cannot tell whether their changes persisted. | `form.tsx:429-437` (no `onCompleted`), `form.tsx:518-525` |
| 5 | **High** | "Expand all" / "Collapse all" are dead buttons — the state they toggle is never consumed by `AgentHierarchyView`. | `form.tsx:1429-1438` vs `agent-hierarchy-view.tsx:18-30` |
| 6 | **High** | No pagination and client-side-only name search over a hard `limit: 100` fetch — agent #101 is unreachable, and search never hits the server. | `page.tsx:36-42`, `44-52` |
| 7 | **High** | Header action hierarchy inverted: Save is `variant="secondary"`, identical to Back and Copy Agent, while Delete is an icon-only destructive button sitting **between** Back and Copy Agent — mystery meat with no label/tooltip, in the path of routine actions. | `form.tsx:513-514`, `526-530`, `agent-delete.tsx:32-36` |
| 8 | **High** | Create flow defaults to AI image generation (checkbox pre-checked), so the primary button reads "Generate Images" and creation blocks on generating 4 images — the opposite of "create an agent in ~3 decisions". | `create-new-agent.tsx:31`, `244-271`, `279` |
| 9 | Med | Two competing toast systems on the same flows: shadcn `useToast` (list page, form) vs `sonner` (create dialog, prompt browser). | `page.tsx:15` vs `create-new-agent.tsx:22`, `prompt-browser-sheet.tsx:20` |
| 10 | Med | The edit page is a flat wall of ~12 sibling cards mixing three different section patterns (switch-row FormItems, collapsible cards, always-open cards) with no grouping by job or frequency — pure clutter; "Authentication" is an informational card given equal weight to real configuration. | `form.tsx:754-1523`, `996-1024` |
| 11 | Med | Most of `form.tsx` is hard-coded English ("Save", "Back", "Copy Agent", "Name", "Category", every section title), while the list page is fully i18n'd — the de locale breaks on the page where P2 lives. | `form.tsx:515`, `524`, `538`, `590`, `612`, etc. |
| 12 | Med | Page title uses `text-3xl font-bold` instead of the standard PageHeader `text-2xl`; the page predates the shared bones (no PageHeader/Toolbar/ListDetail). | `page.tsx:119` |
| 13 | Med | No empty state: with zero agents (or zero search hits) the grid renders nothing — a read-only user with no agents sees a blank page (i18n keys `agentSelection.noAgentsFound`/`noAgentsAvailable` exist but are unused here). | `page.tsx:144-164` |
| 14 | Med | Capability tiles use hard-coded `bg-gray-500 text-white` (and `bg-green-500` in the sheet) — non-semantic, theme-breaking color in both light and dark. | `agent-details-sheet.tsx:105-150`, `form.tsx:873-919` |
| 15 | Med | Whole card is a click target via `div onClick` — no `role="button"`, no `tabIndex`, no keyboard activation; icon buttons use `title` instead of `aria-label`. | `agent-card.tsx:53-56`, `76`, `86` |
| 16 | Med | Details sheet shows `rights_mode || "Open"` — "Open" is not a real mode (real values: private/users/roles/teams/public), misrepresenting access state. | `agent-details-sheet.tsx:222` |
| 17 | Med | Vestigial scaffolding and noise: a `Tabs defaultValue="complete"` wrapper with no tabs, `toggleCategoryCollapse` never wired, `console.log` calls left in production paths, dead `agent-provider-selector.tsx` component. | `form.tsx:543`, `379-389`, `241`, `419`, `476`, `1349-1356` |
| 18 | Low | Create dialog claims "name and description (optional)" but only validates name with a generic "Please fill in all fields" toast; the mutation declares `description: String!`. | `create-new-agent.tsx:226-229`, `queries.ts:952` |
| 19 | Low | Agent categories are hard-coded in the component while tool categories come from the backend — two sources of truth for the same concept. | `form.tsx:94-104` vs `form.tsx:317-319` |
| 20 | Low | `z-[9999]` escape hatch on the memory context popover; `any`-typed props across selectors. | `form.tsx:1075`, `agent-provider-selector.tsx:12` |
| 21 | **High** | RBAC team assignments are silently lost: `RBACControl` offers "Shared with Teams" and emits team selections via its 4th `onChange` argument, but the form never passes `initialTeams` and drops that argument, and the save payload + `UPDATE_AGENT_BY_ID` carry users/roles only. Saving a teams-shared agent persists `rights_mode: "teams"` with no team list — likely locking everyone but the owner out. (Same trapped-capability class as #2.) | `components/rbac.tsx:67`, `164-166`, `450-539`; `form.tsx:494-498`, `826-839`; `queries/queries.ts:1079-1090` |
| 22 | Low | The prompt browser's untagged-prompts folder is labelled "All", implying it contains every prompt when it holds only untagged ones. | `prompt-browser-sheet.tsx:250` |

### Mobile audit (390 px)

- **Edit page: broken.** `grid-rows-1 grid-flow-col` (`form.tsx:551`) lays the two form columns side-by-side at all widths — each column gets ~170 px; selects, switches, and tool rows are unusable. This alone fails philosophy anti-pattern #9.
- **Header action row overflows:** four buttons (`Save`, `Back`, trash icon, `Copy Agent`) in a non-wrapping `flex w-full space-x-2` row (`form.tsx:471`) clip at 390 px.
- **Fixed-width sheets:** `AgentDetailsSheet` and the tool info/config sheet use `w-[400px] sm:w-[540px]` (`agent-details-sheet.tsx:49`, `63`; `agent-tool-card.tsx:253`) — 400 px > 390 px viewport, causing horizontal overflow below `sm`. (`PromptBrowserSheet` gets it right with `w-full sm:max-w-2xl`, `prompt-browser-sheet.tsx:157`.)
- **Tools toolbar overflows:** the filter row combines a `w-[200px]` Select, a clear button, and two text buttons ("Expand all", "Collapse all") in a non-wrapping flex row (`form.tsx:1405-1439`).
- **List page: acceptable.** The card grid collapses to one column (`grid-cols-1 md:grid-cols-2 …`, `page.tsx:144`) and the search input is fluid. Remaining issues: the 400 px details sheet (above) and the hover-revealed feel of the icon buttons (they're `opacity-60`, always rendered, so touch works — minor).
- **Hover-only tooltips:** capability MIME types and sub-agent metadata are tooltip-only (`agent-details-sheet.tsx:108-150`, `agent-tool-card.tsx:152-217`) — unreachable on touch.

---

## 2. Jobs to be done

**P2 — Power User (PRIMARY).** *#1 job in one sentence: "Open the agent I'm iterating on, adjust its instructions/model/tools, and test it in chat — in a tight, repeatable loop."* Jobs ranked by frequency:

1. Tweak an existing agent (instructions, model, tools) and immediately test it in chat — daily, many times.
2. See what an agent currently is (model, tools, access, safety) at a glance — daily.
3. Curate attached knowledge: memory context, agentic retrieval, prompt templates — weekly.
4. Create a new agent — weekly; must be ~3 decisions (name, model, instructions) per `personas.md:68-69`.
5. Control visibility/access (RBAC) and activate/deactivate — monthly.
6. Duplicate an agent as a starting point — monthly.
7. Polish presentation (avatar, animations, welcome message, category) — rare.
8. Delete an agent — rare, destructive.

**P4 — Developer (secondary).** Copy the agent ID (and slug) to call it programmatically; check capabilities/modalities; jump to the model's auth configuration. Wants one-click copy and monospace.

**P1 — End User (incidental today).** The current page doubles as a chat launcher (card click → new session). In the target navigation, P1 picks agents inside Chat; `/agents` lives in the **Build** group and P1 never sees it (RBAC/nav-trimmed). "Open in chat" remains on this page as a normal, side-effect-free action for P2's test loop.

**Ownership matrix check:** `personas.md:156` (`/agents` → P2 primary, P4 secondary) is **correct** — this doc confirms it. The only nuance: the current implementation leaks a P1 job (chat launching) into L1 here; the redesign returns that job to Chat and makes P2 ownership real.

---

## 3. Design concept

### Default view (L1) — `/agents`

A calm list page built from the shared bones:

- **PageHeader** — "Agents" (`text-2xl`), one line of purpose ("Build and manage the AI agents your organization talks to."), and the single purple primary action on the page: **"New agent"** (rendered only for write users; item 5).
- **Toolbar** directly beneath: search input (server-side, debounced 300 ms, searching name *and* description), a Status filter (All / Active / Inactive), a Category filter, and a sort control defaulting to "Last updated". Search replaces the client-only filter (fixes review #6) and pagination ("Load more" or numbered) appears under the list when `pageInfo.hasNextPage`.
- **ListDetail** — the collection itself: rows, not cards. Each row: 32 px `AgentVisual` avatar, **name** (`text-sm font-medium`), model name (`text-sm text-muted-foreground`), quiet status dot (muted green = active, gray = inactive; color only, no loud badge — "status is quiet until it isn't"), relative "updated" timestamp, and right-aligned actions: **Edit** (ghost text button, write users only), **Chat** (ghost), and an overflow `⋯` menu (Details, Duplicate, Copy ID — **no Delete**: deleting an agent happens only in the editor header overflow behind type-to-confirm, item 32; this matches today's behavior, where the list page has no delete entry point).
- **Row click → detail panel (L2)** on the right (desktop) — the evolved `AgentDetailsSheet`: identity, description, capabilities, tools, safety, access, plus two buttons: "Open in chat" and "Edit agent". Read-only users get exactly this panel; nothing dead-ends.
- **"Chat" navigates to `/chat/{id}/new`** — no session is created until the user sends a message (fixes review #3, reuses the route already used by the form's test button at `form.tsx:742`).
- **EmptyState** (per philosophy §5): Bot icon, "Agents are AI assistants configured for your team's work.", primary action "New agent" for write users; for read users: "No agents are available to you yet — ask your workspace admin." (fixes review #13).
- The first skeleton mirrors the row layout (no spinner walls).

This is deliberately boring: a list, a search, one purple button. P2 lands, sees their most-recently-touched agents first (sort already `updatedAt DESC`), and is one click from editing or testing.

### Create flow — "an agent in ~3 decisions"

"New agent" opens one small **Dialog** with exactly three fields:

1. **Name** (required, autofocus)
2. **Model** — `AgentModelSelector`, **pre-selected** to the platform default (first active model / LiteLLM default) so it's a confirmation, not a hunt
3. **Instructions** — optional textarea, placeholder "What should this agent do? (you can refine later)"

One primary button: **"Create agent"** → creates immediately (`rights_mode: "private"` as today) and lands in the editor. Description, avatar/AI image generation (with all 11 styles and the 4-option picker), and visibility are **relocated, not removed**: they live in the editor's *Appearance* and *Access* sections (see ladder, items 7, 9-14). Creation never blocks on image generation (fixes review #8). The info alert about the image API key (item 11) moves with the generator.

**Mutation dependency — this dialog is not implementable against today's `CREATE_AGENT`:** the current document (`queries/queries.ts:949-988`) declares **no `$instructions` variable** and requires **`$description: String!`** (`queries/queries.ts:952` — the same mismatch review #18 flags). As specified, the dialog can neither pass instructions at create time nor create an agent without a description. Shipping it requires the `CREATE_AGENT` changes in Section 4: add `$instructions` (+ input field), and relax `$description` to nullable — or default it client-side to `""` if the backend create input keeps it required. Backend-schema verification that `agentsCreateOne` accepts `instructions` is a prerequisite (same caveat class as firewall); until it lands, the dialog falls back to creating with name + model only and writing instructions via the editor's first save (which already supports `$instructions`, `queries/queries.ts:1035`).

### Edit view — `/agents/edit/[id]`: the agent workbench

**Header (PageHeader variant):** breadcrumb "Agents / {name}", avatar + agent name, an inline **Active** switch with a quiet status dot (item 43 — activation is trust-critical, stays at L1), then actions right-aligned: **"Test in chat"** (outline — the loop P2 lives in, item 42), **"Save"** (the page's single primary/purple button, disabled until dirty), and an overflow `⋯` menu: Duplicate (33), Copy ID (35), Copy slug, Delete (32, opens **ConfirmDialog** with the existing type-to-confirm). This fixes review #7: Save is visually primary, Delete is off the main path but one deliberate step away.

**Body:** one main column (`max-w-3xl`) with a sticky **SectionNav** on the left (desktop ≥ `lg`) — anchor links, Linear-settings style. One scroll surface, one form, one Save. Sections in frequency order:

1. **Basics** — name (36), description (38), category (37), model (46/47 — selector with provider logo, capability tiles, and the stale-model warning preserved verbatim). The "current model/provider" badge and modality tiles render inline under the selector; tiles use semantic tokens (`bg-muted text-muted-foreground` off, `bg-primary/10 text-primary` on) instead of gray-500 (fixes #14), with tap-friendly popovers instead of hover-only tooltips.
2. **Instructions** — custom instructions (41) as the section hero (large mono-friendly textarea), system instructions (40) beneath it in a collapsed read-only disclosure ("Set by developer — read-only"), then **Prompt templates** (48): assigned list + "Manage" → the existing `PromptBrowserSheet` (49, 50) unchanged in behavior, with one copy fix: the untagged-prompts folder is relabelled from "All" to "Untagged" (review #22); folder-name search and prompt search are both kept.
3. **Tools & skills** — the existing search (57), category filter (58), count (60), Sub-Agents/Tools/Skills sections (61, 62, 66) with config badges (63), info/config sheet (64, auto-open behavior kept), config field types (65), exclusions (68), and empty state (67). "Expand all/Collapse all" (59) become *functional*: categories render as Accordion groups wired to the collapse state — fixing the dead controls instead of deleting them.
4. **Knowledge & memory** — Agentic Retrieval (56) and Agent Memory (52) side by side as two `SettingRow`-headed subsections; each shows its quiet enabled/disabled badge and expands to its existing config.
5. **Chat experience** — welcome message (39), follow-up suggestions (54), feedback collection (53), default agent (44) as uniform `SettingRow`s (label + one-line description + switch/field). One pattern, not three (fixes #10).
6. **Access** — `RBACControl` (45) rendered open (not collapsed — "visible scopes" per P3 bias), with a plain-language summary line ("Private — only you" / "Shared with 3 roles" / "Shared with 2 teams"). **The teams round-trip is repaired here** (review #21): the form passes `initialTeams`, captures the 4th `onChange` argument, and includes `teams` in the saved RBAC payload — which requires adding `teams { id rights }` to `AGENT_FIELDS`' RBAC selection and to `UPDATE_AGENT_BY_ID`'s RBAC input/return (see Section 4). The "+N more users" management dialog (45a) is preserved as-is, and the user search gains the 300 ms debounce the tools search already has (it currently refetches per keystroke, item 45).
7. **Safety** — **NEW UI + NEW plumbing, restored capability** (69/27): firewall enable switch + the five scanner switches with one-line descriptions. Unlike every other section this is *not* pure relocation: today the flags are neither fetched nor persisted (item 69 — the form's `firewall` JSON is silently dropped by `UPDATE_AGENT_BY_ID`, and `AGENT_FIELDS` never queries it). Shipping this section requires adding `firewall` to `AGENT_FIELDS`, a `$firewall` variable + input field to `UPDATE_AGENT_BY_ID`, and verifying the backend GraphQL schema accepts and returns the field at all (see Section 4 — one of four backend-facing GraphQL dependencies on this page, alongside RBAC teams in item 45, instructions-at-create in the create flow, and image-on-update in Appearance below). Fixes review #2.
8. **Appearance** — avatar: current image, "Generate with AI" (relocated items 9-14: style select with all 11 styles, 4-image progress grid, picker, API-key info alert) in a dialog launched from here; custom Lottie idle/responding uploads with previews (55), still gated on `configContext.fileUploads.s3endpoint`. **Mutation dependency — without it this relocation creates a new trapped capability, the exact failure class of firewall (69) and RBAC teams (45):** `UPDATE_AGENT_BY_ID` (`queries/queries.ts:1024-1095`) declares no `$image` variable and carries no `image` input field or return selection — today `image` is persistable only via `CREATE_AGENT` at creation time. As-is, an avatar generated or picked in the editor would be **silently dropped on save**. Shipping this section requires adding `$image` (+ input field + return selection) to `UPDATE_AGENT_BY_ID` (see Section 4); the Appearance avatar UI must not land before that plumbing does.
9. **Developer** — `CopyField`s for agent ID (35) and slug (mono, one-click copy, P4 bias), and the model authentication note + "Edit this model" link (51) demoted from a full card to one labelled row. The row renders the link only when a model is selected; with no model it shows a muted "No model selected — choose one in Basics" hint. (The current "Manage models" → `/models` fallback is unreachable dead code — the button is disabled without a model, `form.tsx:1018` — and is not carried over.)

**Dirty-state handling (fixes #4):** a **SaveBar** slides up from the bottom of the form when any field is dirty — "Unsaved changes · [Discard] [Save]" — and navigation away triggers a confirm. Save success shows a toast (single toast system: sonner everywhere) and clears the bar.

### Disclosure ladder

Every inventory item, its level, and where it physically lives:

| # | Capability | Level | Where it lives |
|---|-----------|-------|----------------|
| 1 | Agent collection fetch/display | L1 | List rows on `/agents` (+ pagination control) |
| 2 | Loading skeleton | L1 | Row-shaped skeletons in the list |
| 3 | Error state | L1 | Inline error block in PageShell |
| 4 | Search agents | L1 | Toolbar search (now server-side) |
| 5 | Create agent entry (RBAC write) | L1 | "New agent" primary button in PageHeader |
| 6 | Create: name | L2 | Create dialog, field 1 |
| 7 | Create: description | L3 | Editor → Basics (relocated out of dialog — requires relaxing `CREATE_AGENT`'s `$description: String!` or a client-side `""` default; see Section 4) |
| 8 | Create: model select | L2 | Create dialog, field 2 (pre-selected default) |
| 9 | Generate-AI-image option | L3 | Editor → Appearance → "Generate with AI" dialog (**persisting from the editor requires `$image` on `UPDATE_AGENT_BY_ID`** — see Section 4) |
| 10 | 11 image styles | L3 | Same Appearance dialog, style select |
| 11 | Image API-key info alert | L3 | Same Appearance dialog, inline alert |
| 12 | 4-image generation + progress | L3 | Same Appearance dialog |
| 13 | Generated-image picker | L3 | Same Appearance dialog (selection saved via the new `$image` on `UPDATE_AGENT_BY_ID`, Section 4 — never silently dropped) |
| 14 | Monogram fallback preview | L2 | Avatar everywhere an image is missing (rows, header, panel) |
| 15 | Create mutation → editor | L2 | Create dialog primary action (via the revised `CREATE_AGENT` — `$instructions` added, `$description` relaxed; see Section 4) |
| 16 | Create validation + error toasts | L2 | Inline field error (name) + toast on failure |
| 17 | Animated AgentVisual avatar | L1 | List rows, editor header, detail panel |
| 18 | Name + description display | L1 | Row (name); description in detail panel (L2) |
| 19 | Active/inactive status | L1 | Quiet status dot on row; switch in editor header |
| 20 | Start a chat with the agent | L1 | "Chat" row action + "Open in chat" in panel → `/chat/{id}/new` (session created on first message, not on click) |
| 21 | Edit agent (RBAC write) | L1 | "Edit" row action; row click for write users goes to panel with Edit primary |
| 22 | Agent details view | L2 | Detail side panel (row click / overflow "Details") |
| 23 | Identity header (image, name, status, model) | L2 | Detail panel header |
| 24 | Description (full) | L2 | Detail panel |
| 25 | Capability/modality tiles + MIME info | L2 | Detail panel + editor Basics; MIME lists in tap-friendly popover (L3) |
| 26 | Enabled tools list | L2 | Detail panel "Tools" section |
| 27 | Firewall status + scanners (read) | L2 | Detail panel "Safety" section — shows real state only once `firewall` is added to `AGENT_FIELDS` (today it is never fetched; see item 69 and Section 4) |
| 28 | rights_mode display | L2 | Detail panel "Access" line (real mode names, no "Open" fallback) |
| 28a | Detail panel loading state | L2 | Panel-shaped skeleton mirroring the panel layout (philosophy §6 — replaces the centered spinner) |
| 29 | Server fetch + error alert | L1 | Editor page load |
| 30 | Save (full payload) | L1 | Header Save button + SaveBar; success toast |
| 31 | Back navigation | L1 | Breadcrumb "Agents" (with unsaved-changes guard) |
| 32 | Delete + type-to-confirm | L3 | Header `⋯` overflow → ConfirmDialog (destructive stays ≥ L3) |
| 33 | Duplicate agent | L3 | Header `⋯` overflow; also row overflow on list |
| 34 | Agent image in editor | L1 | Editor header avatar |
| 35 | Copy agent ID | L3/L4 | Developer section CopyField; also `⋯` overflow + list-row overflow |
| 36 | Name field | L2 | Editor → Basics |
| 37 | Category select | L2 | Editor → Basics |
| 38 | Description field | L2 | Editor → Basics |
| 39 | Welcome message | L3 | Editor → Chat experience |
| 40 | System instructions (read-only) | L3 | Editor → Instructions, collapsed disclosure |
| 41 | Custom instructions | L2 | Editor → Instructions (section hero) |
| 42 | Test in chat | L1 | Editor header "Test in chat" |
| 43 | Active switch | L1 | Editor header inline switch |
| 44 | Default-agent switch | L3 | Editor → Chat experience SettingRow |
| 45 | RBAC visibility control | L3 | Editor → Access section (open, with plain-language summary; **teams round-trip repaired** — see Section 4) |
| 45a | All-selected-users dialog (>5 users) | L3 | Dialog from "+N more users" inside the Access section (opens from a page section, not a modal — no modal-on-modal) |
| 46 | Model/provider badge + modality tiles | L2 | Editor → Basics, under model selector |
| 47 | Model selector (LiteLLM/DB, search, stale detection, empty states) | L2 | Editor → Basics |
| 48 | Assigned prompt list | L3 | Editor → Instructions → Prompt templates |
| 49 | Prompt browser (folders, folder + prompt search, add/remove) | L3 | Sheet from "Manage" (one overlay deep — sheet, not dialog-on-dialog); untagged folder relabelled "Untagged" |
| 50 | Create prompt from browser | L3 | PromptEditorModal from the sheet (replaces sheet content focus; never two stacked modals) |
| 51 | Model auth note + edit-model link | L4 | Editor → Developer section row (link only when a model is set; the unreachable `/models` fallback is not replicated) |
| 52 | Memory context selection | L3 | Editor → Knowledge & memory |
| 53 | Feedback collection switch | L3 | Editor → Chat experience SettingRow |
| 54 | Follow-up suggestions switch | L3 | Editor → Chat experience SettingRow |
| 55 | Lottie idle/responding uploads + previews | L3 | Editor → Appearance (S3-gated as today) |
| 56 | Agentic retrieval enable + config | L3 | Editor → Knowledge & memory |
| 57 | Tool search (debounced, clearable) | L2 | Editor → Tools & skills toolbar |
| 58 | Tool category filter + clear | L2 | Editor → Tools & skills toolbar |
| 59 | Expand/Collapse all categories | L2 | Tools section header — **wired to working Accordion groups** |
| 60 | Tool result count | L2 | Tools toolbar, muted text |
| 60a | Enabled-tools count summary | L2 | Tools & skills section header, muted text under the heading |
| 61 | Sub-agents section + per-agent drill-down | L2 | Tools & skills → Sub-Agents group; drill-down sheet at L3 |
| 62 | Tool enable/disable switches | L2 | Tool rows |
| 63 | Type/category/config-status badges | L2 | Tool rows |
| 64 | Tool info + config sheet (auto-open on enable) | L3 | Side sheet per tool |
| 65 | Config field types (string/number/boolean/reranker/variable) | L3 | Inside tool config sheet |
| 66 | Skills toggles | L2 | Tools & skills → Skills group |
| 67 | Tools empty state + clear filters | L2 | Tools section body |
| 68 | Self/agentic-search exclusions | L2 | Tools list behavior (unchanged) |
| 69 | Firewall enable + 5 scanner switches | L3 | Editor → Safety section (**new UI restoring editability** — plus the GraphQL fetch/persist plumbing it never had; see Section 4) |

No item is dropped; items 7, 9-13 are relocated from the create dialog to the editor — and neither relocation is pure UI: the slimmed create dialog needs `CREATE_AGENT` to accept `$instructions` and a nullable/defaulted `description`, and the editor-side avatar (9-13) needs `$image` added to `UPDATE_AGENT_BY_ID`, or the generated/selected image is silently dropped on save (both in Section 4); item 59 is repaired; item 45 gets its teams round-trip fixed; item 69 gains both the UI and the fetch/persist plumbing it never had. The only intentionally non-replicated behavior is item 51's `/models` fallback, which is unreachable dead code today.

### Layout & components

**`/agents` list page**

- `PageShell` (centered content page) → `PageHeader` (title `text-2xl`, purpose `text-sm text-muted-foreground`, primary `Button` default variant) → `Toolbar` (shadcn `Input` with Search icon, two `Select`s, one `DropdownMenu` for sort) → `ListDetail`.
- Rows: plain bordered list (`divide-y`, no Card-in-Card; "prefer dividers over boxes"), `py-3 px-4` (Default spacing), `gap-4` internals. Status dot `size-2 rounded-full bg-green-500/70` (muted) / `bg-muted-foreground/40`.
- Detail panel: shadcn `Sheet` on desktop `sm:max-w-[540px] w-full` (never a fixed `w-[400px]`), sections separated by `space-y-6`, headings `text-sm font-medium`, badges per CLAUDE.md badge rules (default = Active, outline = inactive/neutral, secondary = categories).
- `EmptyState` shared primitive. There is **no delete in the list-row overflow** (consistent with the Default view and ladder item 32): the single delete entry point is the editor header overflow, where `ConfirmDialog` is adopted with the existing type-to-confirm content.

**`/agents/edit/[id]` editor**

- `PageShell` full-width work surface; header region with breadcrumb (`text-sm text-muted-foreground`), `text-2xl` agent name, `Switch` + actions; `Separator` below.
- Body grid: `lg:grid-cols-[200px_1fr] gap-8`; left column = **SectionNav** (sticky, `text-sm`, active anchor in `text-primary` — this and Save are the only purple on screen); right column `max-w-3xl space-y-12` (XL spacing between sections per CLAUDE.md).
- Sections: heading `text-lg font-medium` + one-line `text-sm text-muted-foreground`, content `space-y-4`. No nested cards — sections are whitespace-delimited; only genuinely distinct blocks (tool rows, prompt cards) get a single border level (anti-pattern #6).
- **SettingRow** (NEW shared primitive): `flex items-start justify-between gap-4 rounded-lg border p-4` — label (`text-sm font-medium`), description (`text-sm text-muted-foreground`), control right — replaces today's three competing switch-row styles.
- **SaveBar** (NEW shared primitive): sticky bottom bar, `border-t bg-background/95 backdrop-blur`, appears when `formState.isDirty`.
- **CopyField** (NEW shared primitive): `font-mono text-sm` value + ghost copy `Button` with `aria-label`, toast on copy.
- Form: keep `react-hook-form` + zod (`form.tsx:187-230` schema extended with firewall already); shadcn `Form/FormField/FormItem`; `Textarea` for instructions with `font-mono` option; `Command`-in-`Popover` comboboxes preserved for memory/variables; `Accordion` for tool category groups; tool config in `Sheet` (`w-full sm:max-w-[540px]`).
- All strings through `next-intl` (en/de) — the form gets the i18n pass the list page already had.
- One toast system (sonner) across list, create, editor, prompt browser.
- Accessibility: every icon-only button gets `aria-label` + `Tooltip`; rows are real `<button>`/`<a>` elements or carry `role="button" tabIndex={0}` with key handlers; focus rings per CLAUDE.md ring-offset pattern; capability info available on focus/tap (popover), not hover-only.

### Mobile behavior

Designed for P2's mobile job (`personas.md:71-72`): *monitor and triage — check an agent, read recent behavior, make a small prompt edit.* Full authoring stays desktop-optimized but nothing breaks.

**`/agents` list**

- `< md`: Toolbar collapses to search + one "Filters" button opening a bottom `Sheet` (status/category/sort). Rows compress to avatar + name + status dot + chevron; actions move entirely into the row overflow.
- Detail panel becomes a full-width bottom sheet (`w-full`, `max-h-[85dvh]`, scrollable). "Open in chat" and "Edit" as full-width stacked buttons at top.
- No fixed widths anywhere; the current `w-[400px]` sheets are replaced (fixes the 390 px overflow).

**`/agents/edit/[id]` editor**

- `< lg`: SectionNav becomes a horizontally scrollable chip row (or `Select` jump menu) pinned under the header — one tap to any section.
- The body is a single column (the `grid-flow-col` bug is gone by construction); every section stacks at `space-y-8`.
- Header: breadcrumb + name + Active switch on line one; actions condense to **Save** + `⋯` (Test in chat, Duplicate, Copy ID, Delete move into the overflow at `< sm`). Save never leaves the screen (SaveBar is sticky).
- Tools toolbar wraps: search full-width, category filter + expand/collapse in a second row; tool config sheets are `w-full`.
- Quick-edit path optimized: Basics and Instructions (the "small prompt edit" job) are the first two sections — reachable in two thumb-scrolls; heavy sections (Tools, Appearance) are below and collapsed-by-default on mobile.

### Motion

Few, purposeful, per CLAUDE.md timings, all respecting `prefers-reduced-motion`:

- **Row hover/focus:** background + border transition, 150 ms ease-in-out.
- **Detail panel / tool config sheet:** slide-in from right (bottom on mobile), 300 ms ease-in-out — explains origin (the row/tool that opened it).
- **SaveBar:** slide-up + fade, 200 ms when the form becomes dirty; explains causality (your edit armed the save).
- **Accordion (tool categories, system-instructions disclosure):** height auto-animate, 200 ms.
- **Avatar Lottie:** the one signature moment — `AgentVisual` idle animation on rows and editor header (already built); it is content, not decoration, and is paused under reduced motion.
- **AI image generation:** keep the determinate 4-slot progress treatment (`transition-all duration-300`), it honestly shows long-running work.
- No purple confetti, no page-level transitions beyond the shell's standard.

---

## 4. Implementation notes

**Files to change**

- `app/(application)/agents/page.tsx` — rebuild on PageShell/PageHeader/Toolbar/ListDetail/EmptyState; server-side search + pagination variables; remove session-creation side effect (navigate to `/chat/{id}/new` instead — delete `CREATE_AGENT_SESSION` usage here).
- `app/(application)/agents/components/agent-card.tsx` → replace with `agent-row.tsx` (accessible row) — keep `AgentVisual` usage.
- `app/(application)/agents/components/agent-details-sheet.tsx` → `agent-detail-panel.tsx`: responsive widths (`w-full sm:max-w-[540px]`), semantic capability tiles, real rights_mode labels, add "Open in chat"/"Edit" actions; replace the centered loading spinner with a panel-shaped skeleton (item 28a, philosophy §6); the Safety section shows real firewall state only after `firewall` lands in `AGENT_FIELDS` (see `queries/queries.ts` below); reused by both the list page and the tools drill-down (item 61).
- `app/(application)/agents/components/create-new-agent.tsx` — reduce to 3-field dialog (**depends on the `CREATE_AGENT` changes under `queries/queries.ts` below**: `$instructions` added, `$description` relaxed/defaulted); move image generation UI into a new `components/agent-avatar-generator.tsx` consumed by the editor's Appearance section (keep `agents.image.generate` API, all 11 styles, progress grid, picker, info alert — its output is only persistable once `$image` lands on `UPDATE_AGENT_BY_ID`, below).
- `app/(application)/agents/components/create-new-agent-card.tsx` — delete (entry point becomes the PageHeader button).
- `app/(application)/agents/components/agent-provider-selector.tsx` — delete (dead code, zero imports).
- `app/(application)/agents/edit/[id]/form.tsx` — split into `edit/[id]/sections/basics.tsx`, `instructions.tsx`, `tools.tsx`, `knowledge.tsx`, `chat-experience.tsx`, `access.tsx` (**fix the RBAC teams round-trip**: pass `initialTeams`, capture the 4th `onChange` argument, send `teams` in the RBAC payload — item 45 / review #21), `safety.tsx` (**new firewall UI**, item 69 — depends on the `queries/queries.ts` changes below), `appearance.tsx` (avatar generator + Lottie uploads — **depends on `$image` landing on `UPDATE_AGENT_BY_ID`**, see `queries/queries.ts` below), `developer.tsx`, plus `editor-header.tsx`; one `useForm` at the page level passed down; remove vestigial `Tabs`, dead collapse state (wire it properly in `tools.tsx`), console.logs; add success toast + unsaved-changes guard; i18n every string (en + de). **Before deleting/splitting this file, extract `VariableSelectionElement`** (exported at `form.tsx:107`) into a shared module — it is imported by the Knowledge page (`app/(application)/data/components/embeddings.tsx:44`, used at `:241`) and the split breaks that import otherwise (see Shared components).
- `queries/queries.ts` — **required GraphQL document changes** (these are what un-trap items 45 and 69 and make the relocations of items 7 and 9-13 real):
  - `UPDATE_AGENT_BY_ID` (`:1024-1095`): add a `$firewall: JSON` variable + `firewall: $firewall` input field (+ return selection) — item 69; add `teams { id rights }` to its RBAC input/return — item 45; add an `$image: String` variable + `image: $image` input field (+ `image` in the return selection) — items 9-13: the mutation currently has no `$image` at all, so `image` is writable only via `CREATE_AGENT` at creation time and an avatar generated/picked in the editor's Appearance section would be silently dropped on save.
  - `CREATE_AGENT` (`:949-988`): add an `$instructions: String` variable + `instructions: $instructions` input field (the new dialog's field 3); relax `$description: String!` (`:952`) to `String` — or, if the backend create input keeps it non-null, default it client-side to `""` — because description moves out of the dialog into the editor (item 7, review #18). Without both changes the redesigned dialog cannot create an agent with instructions, nor without a description.
  - `AGENT_FIELDS` (`:114-167`): add `firewall` (so the editor and detail panel can read real state) and `teams { id rights }` in the RBAC selection.
  - **Prerequisite:** verify the backend GraphQL schema actually accepts and returns `firewall`, `RBAC.teams`, and `image` on agent update, and `instructions` on agent create (and whether `description` is nullable in the create input) — whatever is missing server-side must land first (see Dependencies/Risks).
- `app/(application)/data/components/embeddings.tsx` — update the `VariableSelectionElement` import to the new shared location (no behavior change).
- `app/(application)/agents/edit/[id]/components/agent-hierarchy-view.tsx` — accept category-collapse state (Accordion), keep Sub-Agents/Tools/Skills structure.
- `app/(application)/agents/edit/[id]/components/agent-tool-card.tsx` — responsive sheet widths, `aria-label`s, popovers for touch.
- `messages/en.json`, `messages/de.json` — new keys for all editor sections.

**Shared components needed**

- From philosophy §5 (built once, shell-wide): `PageShell`, `PageHeader`, `Toolbar`, `ListDetail`, `EmptyState`, `ConfirmDialog` (adopt for agent delete, preserving type-to-confirm).
- **NEW shared primitives proposed** (not yet in philosophy §5 — flag for adoption there, also useful on Models/Prompts/Skills/Users pages):
  - `SectionNav` — sticky anchored section navigation for long settings/editor pages.
  - `SaveBar` — sticky dirty-state save/discard bar with navigation guard.
  - `SettingRow` — label + description + control row (the single switch-row pattern).
  - `CopyField` — monospace value + copy button + toast (P4 bias; also for `/token`, `/keys`, `/variables`).

**Scope: L.** The list page is an M on its own; the editor split, firewall UI, SaveBar/guard, i18n pass, and mobile repair push the area to L. Backend exposure is the schema-verification list under `queries/queries.ts` (firewall, RBAC teams, image-on-update, instructions-at-create) plus (optionally) name+description search support in `agentsPagination` filters — verify filter capabilities; if `description` search is unsupported, ship name-only server search first.

**Dependencies**

- Shell/nav redesign: Agents moves under the **Build** group (`design/navigation.md`); breadcrumb pattern comes from the shell.
- Shared primitives above must exist (or be built here first and promoted).
- Prompts page components (`PromptCard`, `PromptEditorModal`) are reused as-is — coordinate any redesign of those with `design/pages/prompts.md`.
- Models page: "Edit this model" deep-link must survive the Models redesign (`/models/edit/[id]`).
- Chat: relies on `/chat/{id}/new` creating the session lazily (already used by `form.tsx:742`) — confirm no regression for the removed eager `CREATE_AGENT_SESSION` path.
- Backend GraphQL schema: the four verifications under `queries/queries.ts` — `firewall` and `RBAC.teams` read/write, `image` accepted on `agentsUpdateOneById`, `instructions` accepted (and `description` nullable) on `agentsCreateOne`. Any gap is backend work that must land before the dependent frontend slice (Safety section, Access teams, Appearance avatar, slimmed create dialog respectively).

**Risks**

- **Save payload regression:** `UPDATE_AGENT_BY_ID` sends the full document including JSON-stringified `tools`/`skills`/`firewall` and RBAC (`form.tsx:474-517`); splitting the form must keep one assembly point. The parity check must also cover the *newly added* fields — `firewall`, `RBAC.teams`, and `image` (the Appearance avatar) — precisely because Apollo silently discards variables the document doesn't declare: a missed field fails silently, not loudly (that is how items 45 and 69 got trapped, and how the avatar would be if `$image` is skipped). Add an integration test asserting payload parity before/after, including the new fields.
- **Legacy tool format:** `agent.tools` may arrive as legacy `string[]` (`form.tsx:242-244` comment) — preserve the conversion.
- **LiteLLM stale-model handling** (`agent-model-selector.tsx:94-107`) is subtle operational armor — port verbatim.
- **Firewall UI is "new" to users:** exposing previously hidden scanner flags may reveal surprising existing values; show current persisted state honestly (it was always being saved).
- **Orphan-session behavior change:** users habituated to "click card → chat" get one extra step (explicit Chat action); mitigated by making Chat a visible row action and panel primary.
- **i18n volume:** the editor adds ~80 keys in two locales; budget review time for de.
