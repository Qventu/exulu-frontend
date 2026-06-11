# Exulu Personas & Jobs To Be Done

> The four personas every design decision is made for. Each page in `design/pages/` names its
> **primary owner** from this list and maps its jobs to the disclosure ladder defined in
> `design/philosophy.md`.
>
> Personas are cumulative by capability (a power user can do everything an end user can; an
> admin and a developer are *additional hats*, often worn by the same human). RBAC determines
> which hats a given account has — and therefore what the navigation and pages even render.

---

## Cross-cutting traits (true of every persona)

**AI literacy varies independently of role.** Knowing *what someone may do* (their persona)
tells you nothing about *what they know about AI*: an admin may govern budgets without
knowing what a token is; an end user may be a prompt-engineering enthusiast; a developer may
be fluent in GraphQL but new to RAG. Design consequence (philosophy, principle 10): every
surface leads with plain, job-named language at L1 and explains unavoidable technical terms
in place; technical precision is something you *descend into* (L2–L4), never a prerequisite.
Persona only shifts the *starting* altitude — P4 surfaces like the API explorer may assume
fluency, P1 and P3 surfaces must assume none.

**Security-conscious by organization.** Exulu's customers choose it because it is the
sovereign, secure option — data processed and stored in the EU, never used for model
training. Every persona carries that expectation into the UI: P1 needs quiet reassurance at
the moments they disclose something (chat, uploads); P2 needs clarity about what their agents
expose to whom; P3 is *professionally accountable* for it (visible scopes, attribution,
masked secrets); P4 needs explicit data-boundary information for integrations. Design
consequence (philosophy, principle 9): trust signals at moments of doubt, visible care with
sensitive material, explicit boundaries when data crosses to external services.

---

## P1 — The End User ("I talk to agents")

**Who:** A knowledge worker at the organization using Exulu. Possibly non-technical. They did
not choose this tool; it was rolled out to them. They judge it against ChatGPT/Claude's
consumer polish.

**Context:** Opens Exulu to get an answer, draft a document, transcribe a meeting, or continue
yesterday's conversation. Often mid-task in another tool. Frequently on a phone or in a
split-screen window.

**Jobs to be done:**
1. Start a conversation with the right agent fast (or just *the* default agent, without
   thinking about "agents" at all).
2. Continue/find a previous conversation (search, history).
3. Work with files in a conversation (upload, reference, download results).
4. Organize ongoing work (projects/workspaces, if exposed to them).
5. Transcribe audio and use the transcript.
6. Set personal preferences (language, theme, personal system prompt).
7. Report a problem or wish (feedback).

**They should see:** Chat, their history, projects, transcriptions, settings. A sidebar of
roughly 4–6 items.
**They should never see:** model configuration, eval tooling, user management, API keys,
GraphiQL, variables. (RBAC-trimmed, not just collapsed.)

**Mobile job:** full chat experience — composing, streaming, files, history. This persona's
mobile experience must be excellent, not acceptable.

**Emotional goal:** *"This is as pleasant as the consumer AI apps, and it knows my company's
stuff."* Zero learning curve, zero intimidation.

---

## P2 — The Power User ("I build the agents")

**Who:** The AI champion in a team — technical-ish (analyst, ops lead, applied-AI engineer).
Owns the quality of what end users experience.

**Context:** Iterating: tweak an agent's prompt or tools → test in chat → check what went
wrong → adjust knowledge content → repeat. Lives in the loop between configuration and
conversation.

**Jobs to be done:**
1. Everything P1 does (they are also a chat user — often the heaviest one).
2. Create and configure agents: model, system prompt, tools/skills, knowledge contexts,
   visibility/access.
3. Test and debug an agent's behavior (run it, inspect reasoning/tool calls/citations).
4. Manage knowledge: create contexts, upload/curate content, check embedding/processing
   status, fix bad items.
5. Curate the prompt library and reusable skills.
6. Build and run workflows (incl. n8n where enabled); review runs.
7. Watch usage/quality signals for *their* agents (what are people asking, what fails).

**They should see:** P1's nav plus a "Build" area: Agents, Knowledge/Contexts, Prompts,
Skills, Workflows.
**Defaults matter:** creating an agent should require ~3 decisions (name, model, instructions);
everything else is L3 configuration with sane defaults.

**Mobile job:** monitor and triage — check an agent's recent sessions, read a failed run,
make a small prompt edit. Full authoring can be desktop-optimized.

**Emotional goal:** *"I can go from idea to working agent in minutes, and when it misbehaves
I can see exactly why."* Confidence through visibility.

---

## P3 — The Admin ("I keep it safe, fair, and on budget")

**Who:** IT / platform owner / engineering manager. Accountable for access, spend, and
compliance. May rarely chat at all.

**Context:** Comes in deliberately (onboard a team, rotate a secret, investigate a cost
spike) or reactively (someone can't log in, budget alert fired). Visits are infrequent but
high-stakes — the UI must be self-explanatory on every visit.

**Jobs to be done:**
1. Manage users: invite, deactivate, assign roles and teams.
2. Define roles/permissions (RBAC) and teams.
3. Manage secrets and environment variables safely (create, rotate, see where used —
   never accidentally expose).
4. Set and monitor budgets (per team/agent/model); act before overruns.
5. Watch platform analytics: usage, cost, adoption, errors.
6. Manage API keys and service credentials at the org level.
7. Configure the platform: theming/white-label, models and providers available, integrations.
8. Review feedback submitted by users.

**They should see:** a clearly separated "Administration" area: Users, Roles, Teams, Budgets,
Analytics, Variables/Secrets, Keys, Configuration, Models. Calm, table-first, audit-friendly.
**Design bias:** explicitness over cleverness — confirmation on destructive ops, visible
scopes ("who can see this?"), timestamps and actor attribution everywhere.

**Mobile job:** respond to alerts — check a budget, deactivate a user, read analytics
headlines. Read-mostly with a few critical actions; must work one-handed.

**Emotional goal:** *"Nothing here can surprise me."* Control, auditability, no foot-guns.

---

## P4 — The Developer ("I build on top of it")

**Who:** Software engineer integrating Exulu's API into products, or maintaining the
deployment. Fluent in curl, GraphQL, CI.

**Context:** Splits time between Exulu's UI and their editor/terminal. Uses the UI to get
credentials, explore the API, validate behavior (evals), and configure programmatic access.
Wants copy-paste-ready everything.

**Jobs to be done:**
1. Get credentials fast: create/rotate a personal API token; manage API keys.
2. Explore the API: GraphiQL/explorer, example queries, schema discovery.
3. Discover how to call a specific agent programmatically (IDs, slugs, endpoint snippets).
4. Build and run evals: define cases, run suites against agents/models, compare results over
   time, catch regressions.
5. Configure models/providers and environment variables for the deployment.
6. Debug integrations: inspect raw payloads, errors, run logs.

**They should see:** a "Develop" area: API Explorer, Evals, Tokens/Keys, plus shared access
to Models and Variables (with Admin).
**Design bias:** monospace where it matters, one-click copy on every ID/key/snippet, raw
views (L4) one toggle away, keyboard-first.

**Mobile job:** nearly none — check an eval run's status, copy a token in a pinch. Functional
degradation acceptable; broken layouts are not.

**Emotional goal:** *"The UI respects that I'd rather be in my terminal."* Fast paths,
zero ceremony, nothing hidden behind UI-only workflows.

---

## Page ownership matrix

Primary owner = whose #1 job defines the page's L1. Secondary = served at L2+ or via RBAC.
*This matrix is final: every page doc in `design/pages/` has confirmed or corrected its row,
and all corrections are applied below. The navigation built from it is specified in
`design/navigation.md`.*

| Route | Page | Primary | Secondary |
|---|---|---|---|
| `/` | Dashboard / Home | composed by role* — rendered Home defaults to P2; P1-only accounts redirect to Chat | P3, P4 (RBAC-gated sections); P1 (resume strip) |
| `/chat`, `/chat/[agent]`, `/chat/[agent]/[session]`, `/chat/[agent]/search` | Chat | P1 | P2 (debugging) |
| `/projects`, `/projects/[project]` | Projects | P1 | P2 |
| `/transcriptions` | Transcriptions | P1 | P2 (transcripts become knowledge-context items for agent RAG — curation fields at L3) |
| `/feedback` | Feedback review console | P3 (review) | P2 (quality signals for their agents). P1 *submits* via chat thumbs and the sidebar "Send feedback" dialog, never on this route |
| `/settings` | Personal settings | P1 | all |
| `/agents`, `/agents/edit/[id]` | Agents | P2 | P4 (programmatic info) |
| `/data/[[...query]]` | Knowledge contexts | P2 | P3 (usage dashboard, queue pause/drain), P4 (IDs, chunks, job debugging) |
| `/prompts`, `/prompts/[id]` | Prompt library | P2 | P1 (use) |
| `/skills`, `/skills/[skillId]` | Skills | P2 | P4 |
| `/workflows` | Workflows | P2 | P4 |
| `/n8n` | n8n integration | P2 | P4 (building automations; "enablement" is deploy-time env config, not a page job) |
| `/models`, `/models/create`, `/models/edit/[id]` | Models | P3 | P4, P2 (choose) |
| `/users` | Users | P3 | — |
| `/roles` | Roles | P3 | — |
| `/teams` | Teams | P3 | — |
| `/budgets` | Budgets | P3 | read-scoped reviewers (`budget_management: read`); P2's *own spend* is served by the in-chat indicator, not here |
| `/analytics` | Analytics | P3 | P2 (own agents — currently unserved: route is super_admin-only; a future `role.analytics`-gated, agent-scoped P2 view is specified in the page doc) |
| `/variables`, `/variables/*` | Variables / secrets | P3 | P4 |
| `/keys` | API keys | P3 | P4 |
| `/configuration` | Platform configuration | P3 | — |
| `/token` | Personal API token | P4 | P2 (nav entry lives in the Develop group, RBAC-trimmed; route stays URL-accessible to all) |
| `/explorer` | API explorer (GraphiQL) | P4 | P2 (via `role.api = "write"`) |
| `/evals`, `/evals/[id]`, `/evals/cases` | Evals | P4 | P2 |
| `/login` | Login | P1 (design owner — the flow is identical for every persona, so design for the least technical visitor) | P2–P4 (served automatically) |

\* "Composed by role" means composed, not everything-for-everyone: P1-only accounts keep
routing straight into Chat with no dashboard layer; any account with elevated rights gets a
Home whose L1 serves P2's resume-the-loop job, with P3/P4 sections (vitals, needs-attention
rows, footer links) appearing strictly by RBAC. See `design/pages/dashboard.md`.

---

## How personas shape the navigation

Navigation is grouped by persona altitude, not alphabetically (full spec:
`design/navigation.md`):

- **Home** (elevated accounts only): the role-composed dashboard at `/`, first item above the
  groups. P1-only accounts get no Home item — their `/` redirects straight to Chat.
- **Workspace** (P1, visible to all): Chat, Projects, Transcripts (config-gated) — what
  everyone lives in.
- **Build** (P2): Agents, Knowledge, Prompts, Skills, Routines (`/workflows`), Automation
  (`/n8n`, config-gated). RBAC-trimmed away from pure end users — including Knowledge, which
  today leaks to everyone.
- **Develop** (P4): Evals, API Explorer, Personal token (relocated here from the every-user
  dropdown; the route stays URL-accessible).
- **Administration** (P3): Users & access (Users · Roles · Teams as one tabbed area), Models,
  Budgets, Analytics, Variables, API keys, Feedback (the review console), Configuration.
- **Personal** (all, anchored at the bottom): Send feedback (dialog), Settings, and the user
  menu (theme light/dark/system, language, log out).

RBAC hides whole groups — a group with no visible items renders nothing, header included.
A pure end user sees Workspace + Personal only — their Exulu is a 4–6 item chat app. That
asymmetry is intentional and is the heart of the redesign.
