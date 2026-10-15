# Demo Tour Chapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put four chapters on the product screens that actually carry their claim — the assistant's access section, the waiting run's chat session with its approval card, the memory workbench, the model catalogue — and drop chapter 10's raw-transcript step, so the tour runs 38 steps on rails with real data behind every one.

**Architecture:** Every new screen is an existing product page answered by the demo resolvers (`lib/demo/resolvers.ts`) from fixtures; each gets one `data-demo-id` anchor and one allowlist entry (`supported-routes.ts`, `nav-routes.ts`). The chapter modules under `lib/demo/chapters/` change routes, anchors and copy; the walker's click-probe table follows the new positions. Two product components change behind `isDemoMode()` (the approval card's tool name) or for everyone where the product was already wrong (the models cost cell ignored its own `cost.perMillion` message).

**Tech Stack:** Next.js 16, React 19, Apollo Client 3.14 with the demo link, AI SDK v5 UIMessage parts, next-intl, vitest (node), Playwright outside the repo for `scripts/walk-demo.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-14-demo-tour-fix-design.md` — sub-project 5, decisions D4 and D5.

**Branch:** `fix/demo-tour-chapters` from `main` (d5517bf).

**Spec clarifications carried by this plan** (write them into the spec in Task 6):
1. **Roles, not teams.** `AGENT_RBAC_TEAMS_SUPPORTED` is `false` because the backend's `RBACData` has no `teams` field (`app/(application)/agents/edit/[id]/queries.ts:44-49`); a teams-shared agent would show a capability the product does not have. The assistant is shared with the role "Techniker" instead; the section's summary reads "Mit 1 Rolle(n) geteilt."
2. **The approval step is appended as `email.3`, after the runs step**, not swapped in at `email.1`: the runs step's sentence "einer wartet auf einen Menschen" is the setup and the card is its payoff. This is also what makes the spec's acceptance count add up: 37 − `meetings.1` + `kosten.1` + `email.3` = 38.
3. **Which run waits.** The export's one `waiting_approval` run (0ffccf21, "WG: DEMANDE DE DEVIS") is not the scripted session's run (f74bb00b, completed, "WG: Price and delivery time 2658446"). The two rows swap *state* in the fixture mapping — the scripted session's run waits, the French request is completed — so "Sitzung öffnen" on the one waiting run lands on the one session with a pending approval. Every other field stays as exported; the 14/8/2/1 distribution is unchanged.
4. **The part shape**, confirmed from `node_modules/ai/dist/index.d.ts` (the `DynamicToolUIPart` member with `state: 'approval-requested'`: `input`, no `output`, `approval: { id }`) and from the session's stored message 9 (same `approval` object in responded form): the pending part is added to the session's *last* assistant message — the assistant that just took the third correction asks to send the corrected quote — as `tool-Send_Email_Reply`.
5. **`region: "eu"`, not `"europe-west3"`**: `ProviderLogo` renders its EU pill only for the literal `"eu"` (`components/provider-logo.tsx:30,61`). The Google Cloud region appears as each row's tag instead.
6. **The models cost cell** hardcodes `$…/M` and ignores the existing `models.cost.perMillion` message (`{amount}/Mio.` in de.json, `{amount}/M` in en.json). It switches to that message with the amount from `spendCurrency()` — identical output for the product (USD, en-US), `2,00 €/Mio.` in the demo.
7. **Copy follows the screen.** `zugriff.0` and `memory.3` keep their titles' intent but are reworded, because an agent's access section is not an item's and a base row is not an item row. Listed for sign-off.
8. **No `#access` hash** in the route: `hrefFor` appends `?tour=` to the route string, so a hash would end up before the query. The anchor plus `scrollBlock: "start"` does the scrolling, exactly as `config.0` does.
9. **Off-rails limit, not fixed here:** the approval card's buttons send through the demo transport, which replays the techdoc script for a chapter without one. The tour is on rails (Weiter only); ALFREDO gets no script.

## Global Constraints

- Daniel runs the production build and server (`NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build`, then `… npx next start -p 3111`); the executor never runs `next build`. Product-file changes need a rebuild; walker-only changes do not.
- Product changes are behind `isDemoMode()` from `@/lib/demo/flag` (build-time inlined), or are `data-demo-id` attributes, or fix something the product got wrong for everyone (the cost cell, Task 4) — the last kind is tested for the non-demo output.
- New German is Sie-form, drafted here, listed in "Copy for sign-off". Numbers that a fixture determines are computed into the copy (`germanCount`), never typed.
- Client names (NEW Lift, ALGI) only in content the `contact` chapter reaches; `lib/demo/chapters/index.test.ts` enforces it. "AHT Alfred Giehl" appears only inside the stored session's own text, as it already did on `email.*`.
- Per-task gate: `npx vitest run <files>` + `npx eslint --no-warn-ignored <files>`; neither type-checks — watch nullable fields and exhaustive switches; Daniel's build is the type gate.
- Commit after every task; subjects lowercase after the type, ≤ 100 chars (commitlint); commit messages with double quotes go through `-F`; never push.
- Node 22.18 via nvm for anything that runs Next or Playwright.

## Review Focus

1. A non-demo approval card must render its tool name as before (spaced raw name) — Task 2 keeps that branch and the overlays test pins the demo label only.
2. The product's models table must print `$1.25/M` for en-US exactly as before — Task 4's `format.test.ts` pins the USD/en-US string and the en.json message stays `{amount}/M`.
3. `MemoryBases` must answer in every world, not only chapter 6's (the sidebar's "Gedächtnis" is one click away in any chapter) — Task 3 tests it at `{ chapter: "techdoc", step: 0 }`.
4. ALFREDO's chat must not list Newton's session — Task 2 tests `GetAgentSessions` with `filters.agent.eq` set to each agent.
5. Sharing the assistant with a role must not lock the editor or the chat for the demo user — the user is `super_admin` and `checkChatSessionWriteAccess` reads the session only; Task 6 checks on the build that `techdoc.0` still autotypes and streams.

---

### Task 1: Chapter 4 opens on the assistant's access section

**Files:**
- Create: `lib/demo/fixtures/roles.ts`
- Create: `lib/demo/resolvers.access.test.ts`
- Modify: `lib/demo/fixtures/chapter-techdoc.ts:51` (`rights_mode`)
- Modify: `lib/demo/resolvers.ts` (`AgentEditorById` ~720-738, `GetUserRoles` ~987, import block)
- Modify: `app/(application)/agents/edit/[id]/sections/access.tsx:55`
- Modify: `lib/demo/chapters/zugriff.ts` (whole file)
- Modify: `scripts/walk-demo.mjs` (`CLICK_PROBES["zugriff.0"]`)

**Interfaces:**
- Produces: `ROLE_TECHNIKER_ID = "role-techniker"`, `DEMO_ROLES` (rows with every field `GetUserRoles` selects: `id, name, createdAt, updatedAt, agents, workflows, api, variables, users, evals, budget_management`), anchor `agent-access`, step id `zugriff-agent`.

- [ ] **Step 1: Write the failing test**

`lib/demo/resolvers.access.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { GET_AGENT_EDITOR } from "@/app/(application)/agents/edit/[id]/queries";
import { GET_USER_ROLES } from "@/queries/queries";

import { DEMO_AGENT_ID } from "./fixtures";
import { ROLE_TECHNIKER_ID } from "./fixtures/roles";
import { runDemoOperation as run, runDemoQueryThroughCache } from "./test-support";
import { CHAPTERS } from "./tour";

const AT = { chapter: "zugriff", step: 0 } as const;

describe("chapter 4 opens on the assistant's access section", () => {
  it("shares the assistant with one role, which the roster lists by name", async () => {
    const editor = await run(GET_AGENT_EDITOR, { id: DEMO_AGENT_ID }, AT);
    const agent = editor.agentById as {
      rights_mode: string;
      RBAC: { roles: { id: string; rights: string }[] };
    };
    expect(agent.rights_mode).toBe("roles");
    expect(agent.RBAC.roles).toEqual([{ id: ROLE_TECHNIKER_ID, rights: "read" }]);

    // Through the cache: the roster must carry every field the document selects.
    const roster = await runDemoQueryThroughCache(GET_USER_ROLES, { page: 1, limit: 100 }, AT);
    const items = (roster.rolesPagination as { items: { id: string; name: string }[] }).items;
    expect(items.find((r) => r.id === ROLE_TECHNIKER_ID)?.name).toBe("Techniker");
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it("anchors the first zugriff step on the editor's access section", () => {
    const step = CHAPTERS.find((c) => c.id === "zugriff")!.steps[0];
    expect(step.id).toBe("zugriff-agent");
    expect(step.route).toBe(`/agents/edit/${DEMO_AGENT_ID}`);
    expect(step.anchor).toBe("agent-access");
    expect(step.scrollBlock).toBe("start");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run lib/demo/resolvers.access.test.ts`
Expected: FAIL — `./fixtures/roles` not found.

- [ ] **Step 3: The roles roster fixture**

`lib/demo/fixtures/roles.ts`:

```ts
/**
 * The roles roster the agent editor's access control lists (RBACControl
 * queries GetUserRoles, page 1 / limit 100). Chapter 4 shares the assistant
 * with "Techniker"; the other two are there so the list reads as a workspace
 * rather than a stub. Every field is one GetUserRoles selects
 * (queries/queries.ts): an absent selected field is an Apollo cache error.
 *
 * Teams were the spec's first choice. The product cannot share an agent with
 * a team — AGENT_RBAC_TEAMS_SUPPORTED is false because the backend's RBACData
 * has no `teams` field — so a teams-shared agent would have shown a
 * capability that does not exist.
 */
export const ROLE_TECHNIKER_ID = "role-techniker";

const role = (id: string, name: string) => ({
  id,
  name,
  createdAt: "2026-06-11T08:00:00.000Z",
  updatedAt: "2026-06-11T08:00:00.000Z",
  agents: "read",
  workflows: "read",
  api: "read",
  variables: "read",
  users: "read",
  evals: "read",
  budget_management: "read",
});

export const DEMO_ROLES = [
  role(ROLE_TECHNIKER_ID, "Techniker"),
  role("role-service", "Servicetechniker"),
  role("role-vertrieb", "Vertrieb"),
];
```

- [ ] **Step 4: The agent is shared with the role; the roster answers**

`lib/demo/fixtures/chapter-techdoc.ts:51`: `rights_mode: "public",` → `rights_mode: "roles",` with the comment line above it:

```ts
  // Shared with the Techniker role (fixtures/roles.ts): chapter 4 opens the
  // editor's access section on exactly this. The RBAC entry itself is added
  // by the AgentEditorById resolver, where the editor reads it.
  rights_mode: "roles",
```

`lib/demo/resolvers.ts` — import block: add `import { DEMO_ROLES, ROLE_TECHNIKER_ID } from "./fixtures/roles";` next to the other `./fixtures/*` imports.

`AgentEditorById`: replace `RBAC: { type: "agent", users: [], roles: [] },` with

```ts
      // One role, read — what chapter 4's access step points at. The roster
      // the control resolves the id against is GetUserRoles below.
      RBAC: { type: "agent", users: [], roles: [{ id: ROLE_TECHNIKER_ID, rights: "read" }] },
```

`GetUserRoles`: replace `GetUserRoles: () => ({ rolesPagination: { pageInfo: page(0), items: [] } }),` with

```ts
  GetUserRoles: () => ({
    rolesPagination: { pageInfo: page(DEMO_ROLES.length), items: DEMO_ROLES },
  }),
```

and amend the comment above `GetTeamsByIds` ("Teams is the only roster with entities…") to: "Teams and roles are the rosters with entities: teams match KOSTEN_ROSTERS in fixtures/chapter-kosten.ts, roles are fixtures/roles.ts (chapter 4)."

- [ ] **Step 5: The anchor**

`app/(application)/agents/edit/[id]/sections/access.tsx:55`:

```tsx
    <section id="access" className="scroll-mt-20 space-y-4" data-demo-id="agent-access">
```

- [ ] **Step 6: The chapter**

Replace `lib/demo/chapters/zugriff.ts` entirely:

```ts
import type { DemoChapter } from "../tour";
import { DEMO_AGENT_ID } from "../fixtures/chapter-techdoc";
import { sceneRoute } from "../scenes";

/**
 * Chapter 4 — the same question, two different answers, on purpose.
 *
 * Step 0 runs on the assistant's own access section: the assistant is shared
 * with one role, and the control that says so is the product's real one.
 * Before sub-project 5 this step sat on a single knowledge item's edit form —
 * the right control at the bottom of a form the visitor had no other reason
 * to see. The `config` chapter returns to this editor three chapters later
 * for a different section; the two visits are about different things (who
 * may ask, then how it answers).
 */
export const zugriffChapter: DemoChapter = {
  id: "zugriff",
  title: "Zugriff",
  goal: "Wer lesen darf, bestimmt auch, was die Antwort enthält.",
  steps: [
    {
      id: "zugriff-agent",
      route: `/agents/edit/${DEMO_AGENT_ID}`,
      anchor: "agent-access",
      // "start", as config.0: the section sits far below the fold of a
      // 6,400px editor page, and "nearest" would park it at the bottom edge.
      scrollBlock: "start",
      title: "Nicht jeder darf alles lesen",
      content: [
        {
          kind: "paragraph",
          text: "Dieser Assistent gehört dem Technikerteam: Nur die Rolle Techniker darf ihn befragen. Was er dabei lesen darf, ist zusätzlich pro Wissensbasis und pro Eintrag geregelt — interne Serviceanweisungen bleiben intern, Produktdatenblätter dürfen an den Kunden.",
        },
      ],
    },
    {
      // Routes to a scene (lib/demo/scenes.ts): step 0 already points at the
      // real rights control on screen. This step draws the CONCLUSION from it
      // — a diagram of two readers and a callout about per-search enforcement
      // — which has nothing on screen to point at.
      id: "zugriff-consequence",
      route: sceneRoute("zugriff-consequence"),
      anchor: null,
      title: "Die Antwort richtet sich nach dem Fragenden",
      content: [],
    },
  ],
};
```

Then: `grep -rn "zugriff-item\|item-access" lib scripts components app --include='*.ts' --include='*.tsx' --include='*.mjs'` — the only hits must be `item-access-section.tsx` (the product's own attribute, untouched) and the walker probe replaced in Step 7. Anything else referencing the old step id is updated to `zugriff-agent`.

- [ ] **Step 7: The walker probe**

`scripts/walk-demo.mjs`, `CLICK_PROBES`, replace the `"zugriff.0"` entry:

```js
  "zugriff.0": { attempts: [{ spec: { kind: "css", selector: '[data-demo-id="agent-access"] button[role="combobox"]' }, describe: "the access section's visibility combobox — the very control this step spotlights — would open its option list" }] },
```

- [ ] **Step 8: Run the tests**

Run: `npx vitest run lib/demo/resolvers.access.test.ts lib/demo/resolvers.agents.test.ts lib/demo/tour.test.ts lib/demo/chapters/index.test.ts lib/demo/nav-routes.test.ts lib/demo/supported-routes.test.ts lib/demo/apollo-link.operations.test.ts && npx eslint --no-warn-ignored lib/demo/fixtures/roles.ts lib/demo/resolvers.ts lib/demo/chapters/zugriff.ts lib/demo/resolvers.access.test.ts "app/(application)/agents/edit/[id]/sections/access.tsx"`
Expected: all PASS. If `resolvers.agents.test.ts` pins `rights_mode: "public"` for Newton, update that assertion to `"roles"` with a one-line comment pointing at chapter 4.

- [ ] **Step 9: Commit**

```bash
git add lib/demo/fixtures/roles.ts lib/demo/fixtures/chapter-techdoc.ts lib/demo/resolvers.ts lib/demo/chapters/zugriff.ts lib/demo/resolvers.access.test.ts "app/(application)/agents/edit/[id]/sections/access.tsx" scripts/walk-demo.mjs
git commit -m "feat(demo): chapter 4 opens on the assistant's access section, shared with one role

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Chapter 9 ends on the waiting run's session and its approval card

**Files:**
- Create: `lib/demo/resolvers.approval.test.ts`
- Modify: `lib/demo/fixtures/chapter-email.ts` (`ALGI_AGENT`, `ALGI_RUNS` mapping, new exports after `ALGI_SESSION_ID`)
- Modify: `lib/demo/routes.ts` (`ALGI_CHAT`)
- Modify: `lib/demo/resolvers.ts` (`agentFor` ~311, `scrollbackRows` ~266, `GetAgentSessionById` ~1028, `GetAgentSessions` ~1039, import block)
- Modify: `lib/demo/overlays.ts:26-29` (`TOOL_LABELS`), `lib/demo/overlays.test.ts`
- Modify: `app/(application)/chat/components/tool-call-approval.tsx` (tool name, `data-demo-id`)
- Modify: `lib/demo/chapters/email.ts` (new last step)
- Modify: `scripts/walk-demo.mjs` (`CLICK_PROBES["email.3"]`)

**Interfaces:**
- Consumes: `filterValue(variables, field)` (resolvers.ts:242, reads `filters.<field>.eq` from an object or an array), `page(itemCount)` (resolvers.ts:212), `DEMO_USER_ID` (`lib/demo/user.ts`), `toolLabel` (`lib/demo/overlays.ts`).
- Produces: `ALGI_SESSION: AgentSession`, `ALGI_APPROVAL_MESSAGES: UIMessage[]`, `ALGI_APPROVAL_TOOL = "Send_Email_Reply"`, `ALGI_APPROVAL_ID`, `quoteDraftFrom(text)`, route constant `ALGI_CHAT`, anchor `chat-tool-approval`, step id `email-approval`.

- [ ] **Step 1: Write the failing tests**

`lib/demo/resolvers.approval.test.ts`:

```ts
import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

import {
  GET_AGENT_BY_ID,
  GET_AGENT_MESSAGES,
  GET_AGENT_SESSION_BY_ID,
  GET_AGENT_SESSIONS,
} from "@/app/(application)/chat/queries";

import { DEMO_AGENT_ID } from "./fixtures";
import {
  ALGI_AGENT_ID,
  ALGI_APPROVAL_ID,
  ALGI_APPROVAL_TOOL,
  ALGI_RUNS,
  ALGI_SESSION_ID,
  quoteDraftFrom,
} from "./fixtures/chapter-email";
import { ALGI_CHAT } from "./routes";
import { runDemoOperation as run, runDemoQueryThroughCache } from "./test-support";
import { CHAPTERS } from "./tour";

const AT = { chapter: "email", step: 3 } as const;

const sessionsFor = (agent: string) =>
  run(GET_AGENT_SESSIONS, { page: 1, limit: 20, filters: { agent: { eq: agent } } }, AT);

describe("chapter 9 opens the waiting run's session on a pending approval", () => {
  it("shows exactly one run waiting, and it is the scripted session's", () => {
    const waiting = ALGI_RUNS.filter((r) => r.state === "waiting_approval");
    expect(waiting).toHaveLength(1);
    expect(waiting[0].session).toBe(ALGI_SESSION_ID);
    // The export's distribution survives the state swap.
    const count = (state: string) => ALGI_RUNS.filter((r) => r.state === state).length;
    expect([count("completed"), count("failed"), count("filtered"), count("waiting_approval")]).toEqual([14, 8, 2, 1]);
  });

  it("resolves ALFREDO by id with every field the chat page selects, and its session", async () => {
    const agent = await runDemoQueryThroughCache(GET_AGENT_BY_ID, { id: ALGI_AGENT_ID }, AT);
    expect((agent.agentById as { id: string }).id).toBe(ALGI_AGENT_ID);
    const session = await run(GET_AGENT_SESSION_BY_ID, { id: ALGI_SESSION_ID }, AT);
    expect((session.agent_sessionById as { id: string; agent: string }).agent).toBe(ALGI_AGENT_ID);
  });

  it("lists each agent's own sessions only", async () => {
    const alfredo = await sessionsFor(ALGI_AGENT_ID);
    expect((alfredo.agent_sessionsPagination as { items: unknown[] }).items).toHaveLength(0);
    const newton = await sessionsFor(DEMO_AGENT_ID);
    expect((newton.agent_sessionsPagination as { items: unknown[] }).items.length).toBeGreaterThan(0);
  });

  it("serves the stored session ending on an approval-requested tool part", async () => {
    const data = await run(
      GET_AGENT_MESSAGES,
      { page: 1, limit: 50, sort: { field: "createdAt", direction: "DESC" }, filters: { session: { eq: ALGI_SESSION_ID } } },
      AT,
    );
    const items = (data.agent_messagesPagination as { items: { content: string }[] }).items;
    expect(items).toHaveLength(15);
    // DESC: the first row is the conversation's last message.
    const newest = JSON.parse(items[0].content) as UIMessage;
    expect(newest.role).toBe("assistant");
    const last = newest.parts[newest.parts.length - 1] as {
      type: string; state: string; approval?: { id: string }; output?: unknown;
      input: { subject: string; to: string; body: string };
    };
    expect(last.type).toBe(`tool-${ALGI_APPROVAL_TOOL}`);
    expect(last.state).toBe("approval-requested");
    expect(last.approval?.id).toBe(ALGI_APPROVAL_ID);
    expect(last.output).toBeUndefined();
    expect(last.input.body).toMatch(/^\*\*Subject: RE: Price and delivery time 2658446/);
  });

  it("takes the draft from after the rule, not the acknowledgement before it", () => {
    expect(quoteDraftFrom("Danke.\n\n***\n\n**Subject: x**\n\nDear")).toBe("**Subject: x**\n\nDear");
    expect(quoteDraftFrom("no rule")).toBe("no rule");
  });

  it("is the chapter's last step, after the runs list that announces it", () => {
    const steps = CHAPTERS.find((c) => c.id === "email")!.steps;
    expect(steps.map((s) => s.id)).toEqual(["email-routine", "email-trigger", "email-runs", "email-approval"]);
    expect(steps[3].route).toBe(ALGI_CHAT);
    expect(steps[3].anchor).toBe("chat-tool-approval");
  });
});
```

Add to `lib/demo/overlays.test.ts`, inside `describe("toolLabel")`:

```ts
  it("names the two tools chapter 9's stored session shows", () => {
    expect(toolLabel("Send_Email_Reply")).toBe("E-Mail-Versand");
    expect(toolLabel("Create_Agent_Memory_Memory_Item")).toBe("Gedächtnis-Eintrag gespeichert");
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run lib/demo/resolvers.approval.test.ts lib/demo/overlays.test.ts`
Expected: FAIL — `ALGI_APPROVAL_ID` / `ALGI_CHAT` not exported; the label test gets "Send Email Reply".

- [ ] **Step 3: The fixture — state swap, the session, the approval part**

`lib/demo/fixtures/chapter-email.ts`:

Imports — add after the existing type imports:

```ts
import type { AgentSession } from "@/types/models/agent-session";

import { DEMO_USER_ID } from "../user";
```

`ALGI_AGENT` — add the model fields Newton carries, so the chat page's `GetAgentById` selection is complete (the cache-backed test in Step 1 is the gate; if it reports any further missing field, add it with Newton's value shape from `chapter-techdoc.ts:16-52`). After `description:` add:

```ts
  category: "assistant",
  model: "gemini-3.1-pro",
  modelName: "gemini-3.1-pro",
  providerName: "Google",
```

`ALGI_RUNS` — replace the mapping with:

```ts
/**
 * Which run is shown waiting. The export has one run in `waiting_approval`
 * (0ffccf21, "WG: DEMANDE DE DEVIS"), and the scripted session below belongs
 * to a different, completed run (f74bb00b, "WG: Price and delivery time
 * 2658446"). Chapter 9 opens the scripted session on a pending approval, so
 * the two rows swap STATE here: the session's run is the one waiting, the
 * French request the one completed. Every other field stays as exported and
 * the distribution the comment above describes is unchanged. Done in the
 * mapping, not in algi-runs.json, so the export stays the export.
 */
const APPROVAL_RUN_ID = "f74bb00b-fd2f-4a7f-8d51-7215a35bc8c2";
const EXPORTED_WAITING_RUN_ID = "0ffccf21-78c0-42fe-9c63-3b613ab96d4a";

const shownState = (run: RoutineRun): string =>
  run.id === APPROVAL_RUN_ID
    ? "waiting_approval"
    : run.id === EXPORTED_WAITING_RUN_ID
      ? "completed"
      : run.state;

export const ALGI_RUNS: RoutineRun[] = (
  RAW_RUNS as Array<Record<string, unknown>>
).map((raw) => {
  const run = raw as unknown as RoutineRun;
  return {
    ...run,
    state: shownState(run),
    workflow: ALGI_ROUTINE_ID,
    workflowName: ALGI_ROUTINE.name,
    agent: ALGI_AGENT_ID,
  };
});
```

After `export const ALGI_SESSION_ID = …;` add:

```ts
/** The scripted session as the chat route's GetAgentSessionById sees it. */
export const ALGI_SESSION: AgentSession = {
  id: ALGI_SESSION_ID,
  agent: ALGI_AGENT_ID,
  project: "demo-project",
  // The inbound mail's subject — the first thing on screen above the thread.
  title: "WG: Price and delivery time 2658446",
  metadata: null,
  // The routine ran as user 11, but the composer goes read-only for anyone
  // but the creator of a private session (lib/check-chat-session-write-access),
  // and a read-only notice above an approval card would contradict the card.
  created_by: DEMO_USER_ID,
  session_items: [],
  rights_mode: "private",
  createdAt: "2026-08-18T07:21:19.544Z",
  updatedAt: "2026-08-18T09:12:40.000Z",
};

/**
 * The part that puts chapter 9 on a pending approval. Shape per the AI SDK's
 * DynamicToolUIPart union (node_modules/ai/dist/index.d.ts, the member with
 * state 'approval-requested'): `input` present, no `output`, `approval.id`
 * set — ToolCallApproval renders nothing without the id. Message 9 of this
 * session carries the same `approval` object in its responded form.
 */
export const ALGI_APPROVAL_TOOL = "Send_Email_Reply";
export const ALGI_APPROVAL_ID = "aitxt-Q7mVd2sK9pLx0wE4rTn1bYcH";

/** The corrected quote: everything after the first rule in the assistant's last message. */
export function quoteDraftFrom(text: string): string {
  const rule = text.indexOf("***");
  return (rule === -1 ? text : text.slice(rule + 3)).trim();
}

const lastMessage = ALGI_SESSION_MESSAGES[ALGI_SESSION_MESSAGES.length - 1];
const lastTextPart = lastMessage.parts.find((part) => part.type === "text");
const lastText = lastTextPart && "text" in lastTextPart ? lastTextPart.text : "";

export const ALGI_APPROVAL_PART = {
  type: `tool-${ALGI_APPROVAL_TOOL}`,
  toolCallId: "call_3104__send_email_reply",
  state: "approval-requested",
  // `subject` first: the card's summary shows the first short string value.
  input: {
    subject:
      "RE: Price and delivery time 2658446 - Cylinder packing seal for AZKBZ 110 (Commission No. G47490)",
    to: "⟨Kundenkontakt⟩",
    body: quoteDraftFrom(lastText),
  },
  approval: { id: ALGI_APPROVAL_ID },
};

/**
 * The session as chapter 9 shows it: the assistant that has just taken the
 * third correction asks to send the corrected quote. The export ends on the
 * acknowledgement; the ask is the one part added to its last message.
 */
export const ALGI_APPROVAL_MESSAGES: UIMessage[] = [
  ...ALGI_SESSION_MESSAGES.slice(0, -1),
  {
    ...lastMessage,
    parts: [...lastMessage.parts, ALGI_APPROVAL_PART as unknown as UIMessage["parts"][number]],
  },
];
```

`lib/demo/routes.ts` — add after `MEMORY_CHAT`:

```ts
import { ALGI_AGENT_ID, ALGI_SESSION_ID } from "./fixtures/chapter-email";
```
(in the import block) and

```ts
/** Chapter 9's last step: ALFREDO's stored session, ending on an approval card. */
export const ALGI_CHAT = `/chat/${ALGI_AGENT_ID}/${ALGI_SESSION_ID}`;
```

- [ ] **Step 4: The resolvers**

`lib/demo/resolvers.ts` — extend the `./fixtures/chapter-email` import with `ALGI_AGENT_ID, ALGI_APPROVAL_MESSAGES, ALGI_SESSION, ALGI_SESSION_ID`.

`agentFor`:

```ts
function agentFor(world: DemoWorld, variables: Record<string, unknown>) {
  return (
    world.agents.find((a) => a.id === variables.id) ??
    // ALFREDO belongs to another deployment's world (chapter 9 opens its chat
    // session): reachable by id only, never listed among Newton's agents.
    (variables.id === ALGI_AGENT_ID ? ALGI_AGENT : world.agents[0])
  );
}
```

`scrollbackRows` — insert right after `const sessionId = filterValue(variables, "session");`:

```ts
  // Chapter 9's session is not a scripted exchange but a stored one: fifteen
  // messages from another deployment, ending on a pending approval. Served
  // whole, whatever the step.
  if (sessionId === ALGI_SESSION_ID) {
    return ALGI_APPROVAL_MESSAGES.map((message, index) => ({
      id: `${sessionId}-scrollback-${index}`,
      session: sessionId,
      createdAt: new Date(0).toISOString(),
      content: JSON.stringify(message),
    }));
  }
```

`GetAgentSessionById`:

```ts
  GetAgentSessionById: (world, variables) => ({
    agent_sessionById:
      world.sessions.find((s) => s.id === variables.id) ??
      (variables.id === ALGI_SESSION_ID ? ALGI_SESSION : world.sessions[0]),
  }),
```

`GetAgentSessions` — take `variables` and filter:

```ts
  GetAgentSessions: (world, variables) => {
    // The chat surface asks for the CURRENT agent's sessions (filters.agent.eq);
    // ALFREDO's page must not list Newton's.
    const agent = filterValue(variables, "agent");
    const items = world.sessions
      .filter((session) => !agent || session.agent === agent)
      .map((session) => ({
        ...session,
        user: session.created_by,
        RBAC: { type: session.rights_mode ?? "private", users: [], roles: [] },
      }));
    return {
      agent_sessionsPagination: { pageInfo: page(items.length), items },
    };
  },
```

- [ ] **Step 5: The labels and the card**

`lib/demo/overlays.ts` `TOOL_LABELS`:

```ts
export const TOOL_LABELS: Record<string, string> = {
  Context_Search: "Wissenssuche",
  Create_Newton_Memory_Item: "Gedächtnis-Eintrag gespeichert",
  // Chapter 9's stored session (ALFREDO): its memory tool, and the send the
  // approval card asks about — "{tool} ausführen?" wants a noun.
  Create_Agent_Memory_Memory_Item: "Gedächtnis-Eintrag gespeichert",
  Send_Email_Reply: "E-Mail-Versand",
};
```

`app/(application)/chat/components/tool-call-approval.tsx` — imports:

```ts
import { isDemoMode } from "@/lib/demo/flag";
import { toolLabel } from "@/lib/demo/overlays";
```

Replace the `toolName` derivation (lines 76-79):

```ts
  const rawToolName =
    (part as { type: string }).type?.replace("tool-", "") || "command";
  // The demo shows German tool names (lib/demo/overlays.ts), as the tool
  // header does in message-column.tsx; the product keeps the spaced raw name.
  const toolName = isDemoMode()
    ? toolLabel(rawToolName)
    : rawToolName.replace(/_/g, " ");
```

and the pending card's root (line 126):

```tsx
      <Card className="mt-3 border-border bg-card" data-demo-id="chat-tool-approval">
```

- [ ] **Step 6: The step**

`lib/demo/chapters/email.ts` — import `ALGI_CHAT` from `"../routes"`, and append after the `email-runs` step:

```ts
    {
      id: "email-approval",
      route: ALGI_CHAT,
      anchor: "chat-tool-approval",
      title: "Der eine, der auf einen Menschen wartet",
      content: [
        {
          kind: "paragraph",
          text: "Das ist der Lauf, der wartet: Der Assistent hat die Anfrage gelesen, den Katalog durchsucht und drei Korrekturen des Verkäufers übernommen — und fragt jetzt, bevor er die Antwort an den Kunden schickt. Gesendet wird erst, wenn ein Mensch es freigibt.",
        },
      ],
    },
```

`scripts/walk-demo.mjs` `CLICK_PROBES` — after `"email.2"` add `"email.3": COPY_BUTTON,` (the stored session has assistant messages with a Copy action; the probe must never touch the approval buttons — see clarification 9).

- [ ] **Step 7: Run the tests**

Run: `npx vitest run lib/demo/resolvers.approval.test.ts lib/demo/overlays.test.ts lib/demo/resolvers.routines.test.ts lib/demo/apollo-link.operations.test.ts lib/demo/tour.test.ts lib/demo/chapters/index.test.ts lib/demo/nav-routes.test.ts lib/demo/supported-routes.test.ts lib/demo/fixture-dates.test.ts && npx eslint --no-warn-ignored lib/demo/fixtures/chapter-email.ts lib/demo/routes.ts lib/demo/resolvers.ts lib/demo/overlays.ts lib/demo/chapters/email.ts lib/demo/resolvers.approval.test.ts "app/(application)/chat/components/tool-call-approval.tsx"`
Expected: all PASS. `fixture-dates.test.ts` guards that no fixture stamp is past the epoch — the session's stamps are 2026-08-18.

- [ ] **Step 8: Commit**

```bash
git add lib/demo/fixtures/chapter-email.ts lib/demo/routes.ts lib/demo/resolvers.ts lib/demo/overlays.ts lib/demo/overlays.test.ts lib/demo/chapters/email.ts lib/demo/resolvers.approval.test.ts "app/(application)/chat/components/tool-call-approval.tsx" scripts/walk-demo.mjs
git commit -m "feat(demo): chapter 9 ends on the waiting run's session and its approval card

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Chapter 6 ends on the memory workbench

**Files:**
- Create: `lib/demo/resolvers.memory-bases.test.ts`
- Modify: `lib/demo/supported-routes.ts:46` (after `"/budgets"`), `lib/demo/nav-routes.ts` (set + doc comment)
- Modify: `lib/demo/fixtures/chapter-memory.ts` (export `MEMORY_COUNT_AFTER_CORRECTION`)
- Modify: `lib/demo/resolvers.ts` (`MemoryBases` ~702, import block)
- Modify: `app/(application)/memory/components/memory-overview.tsx:182-209` (wrapper)
- Modify: `lib/demo/chapters/memory.ts:48-59` (last step)
- Modify: `lib/demo/chapter-memory.test.ts:112-123`, `lib/demo/apollo-link.operations.test.ts:169-172`
- Modify: `scripts/walk-demo.mjs` (`CLICK_PROBES["memory.3"]`)

**Interfaces:**
- Consumes: `MEMORY_CONTEXT_ID`, `MEMORY_WRITTEN_AT_STEP`, `world.itemsByContext`, `CONTEXTS` (already imported in resolvers), `DEMO_USER_ID`, `germanCount`/`capitalise` (`lib/demo/fixtures/meeting-tally.ts`).
- Produces: `MEMORY_COUNT_AFTER_CORRECTION` (= 4), anchor `memory-bases`, step id `memory-base`, route `/memory` in both allowlists.

- [ ] **Step 1: Write the failing tests**

`lib/demo/resolvers.memory-bases.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { GET_MEMORY_BASES } from "@/app/(application)/memory/queries";

import { contentText } from "./content";
import { DEMO_AGENT_ID } from "./fixtures";
import {
  MEMORY_CONTEXT_ID,
  MEMORY_COUNT_AFTER_CORRECTION,
  MEMORY_WRITTEN_AT_STEP,
} from "./fixtures/chapter-memory";
import { runDemoQueryThroughCache as run } from "./test-support";
import { CHAPTERS } from "./tour";

type Base = {
  id: string;
  name: string;
  agents: { id: string }[];
  stats: { total: number; contributors: number; lastSavedAt: string | null };
};

describe("the memory overview (chapter 6, last step)", () => {
  it("lists the assistant's memory base with every field the overview selects", async () => {
    const data = await run(GET_MEMORY_BASES, {}, { chapter: "memory", step: 3 });
    const bases = data.memoryBases as Base[];
    expect(bases).toHaveLength(1);
    expect(bases[0].id).toBe(MEMORY_CONTEXT_ID);
    expect(bases[0].name).toBe("Assistenten-Gedächtnis");
    expect(bases[0].agents.map((a) => a.id)).toEqual([DEMO_AGENT_ID]);
    expect(bases[0].stats.total).toBe(MEMORY_COUNT_AFTER_CORRECTION);
    expect(bases[0].stats.contributors).toBe(1);
    expect(bases[0].stats.lastSavedAt).toBeTruthy();
  });

  it("counts one memory fewer before the correction is written", async () => {
    const data = await run(GET_MEMORY_BASES, {}, { chapter: "memory", step: MEMORY_WRITTEN_AT_STEP - 1 });
    expect((data.memoryBases as Base[])[0].stats.total).toBe(MEMORY_COUNT_AFTER_CORRECTION - 1);
  });

  it("answers in a world that is not chapter 6's (the sidebar entry is one click away anywhere)", async () => {
    const data = await run(GET_MEMORY_BASES, {}, { chapter: "techdoc", step: 0 });
    const bases = data.memoryBases as Base[];
    expect(bases).toHaveLength(1);
    expect(bases[0].stats.total).toBeGreaterThanOrEqual(0);
  });

  it("is what the chapter's last step opens, and the copy counts the same memories", () => {
    const steps = CHAPTERS.find((c) => c.id === "memory")!.steps;
    const last = steps[steps.length - 1];
    expect(last.id).toBe("memory-base");
    expect(last.route).toBe("/memory");
    expect(last.anchor).toBe("memory-bases");
    expect(contentText(last.content)).toMatch(/^Vier Einträge/);
  });
});
```

`lib/demo/chapter-memory.test.ts:112-123` — the reveal step is now the overview:

```ts
  it("keeps the reveal step aligned with the step that navigates to it", () => {
    // MEMORY_WRITTEN_AT_STEP and the tour's step list are edited in different
    // files. If they drift, the overview either spoils the ending or shows
    // three memories where the visitor was just told there are four.
    const revealIndex = CHAPTERS.find((c) => c.id === "memory")!.steps.findIndex(
      (s) => s.route === "/memory",
    );
    expect(revealIndex, "no step opens the memory overview").toBeGreaterThan(-1);
    expect(revealIndex).toBeGreaterThanOrEqual(MEMORY_WRITTEN_AT_STEP);
  });
```
(drop the `MEMORY_CONTEXT_ID` import there if it becomes unused).

`lib/demo/apollo-link.operations.test.ts:169-172`:

```ts
  it("answers MemoryBases with the assistant's base as a row (chapter 6 ends on it)", async () => {
    const data = await run(GET_MEMORY_BASES, {}, { chapter: "memory", step: 3 });
    expect((data.memoryBases as { id: string }[]).map((b) => b.id)).toEqual(["newton_memory_context"]);
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run lib/demo/resolvers.memory-bases.test.ts lib/demo/chapter-memory.test.ts lib/demo/apollo-link.operations.test.ts`
Expected: FAIL — `MEMORY_COUNT_AFTER_CORRECTION` missing; `memoryBases` is `[]`.

- [ ] **Step 3: Allowlists**

`lib/demo/supported-routes.ts` — after `"/budgets",`:

```ts
  // Chapter 6 ("memory") ends on the memory workbench's overview: the base
  // the correction was written to, as a row with its counts. The matcher
  // admits /memory/[ctx] too; the tour never goes there.
  "/memory",
```

`lib/demo/nav-routes.ts` — add `"/memory",` after `"/budgets",` and change the doc comment's last sentence to: `Sub-project 5 added /memory (chapter 6) and /models (chapter 11).` (Task 4 adds the second entry.)

- [ ] **Step 4: The count, the row, the anchor**

`lib/demo/fixtures/chapter-memory.ts` — after `export const CORRECTION_MEMORY` add:

```ts
/**
 * How many memories the base holds once the correction is written: the
 * three existing plus the one chapter 6 produces. The overview's row
 * (resolvers.ts MemoryBases) and the chapter's copy both read this, so the
 * screen and the sentence beside it cannot disagree.
 */
export const MEMORY_COUNT_AFTER_CORRECTION = EXISTING_MEMORIES.length + 1;
```

`lib/demo/resolvers.ts` — extend the `./fixtures/chapter-memory` import to `{ MEMORY_CONTEXT_ID, MEMORY_SESSION_ID }`; add `import { DEMO_USER_ID } from "./user";`. Replace `MemoryBases: () => ({ memoryBases: [] }),` and the two comment lines above it with:

```ts
  // The base the correction was written to, as one row with live counts:
  // chapter 6's last step opens this overview. The counts come from the
  // world, so the row shows three memories before the correction and four
  // after — the same threshold the knowledge page honours. Every field the
  // document selects is present (an absent one is an Apollo cache error).
  MemoryBases: (world) => {
    const items = world.itemsByContext[MEMORY_CONTEXT_ID] ?? [];
    const context = CONTEXTS.find((c) => c.id === MEMORY_CONTEXT_ID);
    const stamps = items.map((item) => item.createdAt ?? "").filter(Boolean).sort();
    const lastSavedAt = stamps.length ? stamps[stamps.length - 1] : null;
    return {
      memoryBases: [
        {
          id: MEMORY_CONTEXT_ID,
          name: context?.name ?? "Assistenten-Gedächtnis",
          description: context?.description ?? null,
          valid: true,
          missing: [],
          missingFromCode: false,
          agents: world.agents.map((a) => ({ id: a.id, name: a.name })),
          stats: {
            total: items.length,
            public: items.length,
            private: 0,
            contributors: items.length ? 1 : 0,
            visible: items.length,
            lastSavedAt,
            lastSavedBy: lastSavedAt ? { id: DEMO_USER_ID, name: "Demo" } : null,
          },
        },
      ],
    };
  },
```

If the cache-backed test reports a missing `__typename`, add `__typename: "MemoryBase"` to the row and `__typename: "MemoryBaseStats"` to `stats` (the LiteLLM rows carry theirs the same way).

`app/(application)/memory/components/memory-overview.tsx` — wrap the `<DataTable<MemoryBase> … />` element (lines 182-209) in `<div data-demo-id="memory-bases">` … `</div>`; nothing else changes.

- [ ] **Step 5: The step**

`lib/demo/chapters/memory.ts` — imports:

```ts
import { MEMORY_COUNT_AFTER_CORRECTION } from "../fixtures/chapter-memory";
import { capitalise, germanCount } from "../fixtures/meeting-tally";
```

Replace the last step (`memory-item`) with:

```ts
    {
      id: "memory-base",
      route: "/memory",
      anchor: "memory-bases",
      title: "Ein Gedächtnis, das Ihnen gehört",
      content: [
        {
          kind: "paragraph",
          // The count is the fixture's, not typed: the row on screen shows it.
          text: `${capitalise(germanCount(MEMORY_COUNT_AFTER_CORRECTION))} Einträge, ein Assistent, ein Beitragender — der jüngste ist Ihre Korrektur von eben. Jeder Eintrag ist einsehbar, änderbar, löschbar; ab sofort bekommen alle Kollegen die richtige Antwort.`,
        },
      ],
    },
```

`scripts/walk-demo.mjs` `CLICK_PROBES["memory.3"]`:

```js
  "memory.3": { attempts: [{ spec: { kind: "css", selector: '[data-demo-id="memory-bases"] tbody tr' }, describe: "the memory base's row — would navigate to /memory/newton_memory_context" }] },
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run lib/demo/resolvers.memory-bases.test.ts lib/demo/chapter-memory.test.ts lib/demo/apollo-link.operations.test.ts lib/demo/tour.test.ts lib/demo/chapters/index.test.ts lib/demo/nav-routes.test.ts lib/demo/supported-routes.test.ts && npx eslint --no-warn-ignored lib/demo/resolvers.ts lib/demo/chapters/memory.ts lib/demo/fixtures/chapter-memory.ts lib/demo/supported-routes.ts lib/demo/nav-routes.ts lib/demo/resolvers.memory-bases.test.ts "app/(application)/memory/components/memory-overview.tsx"`
Expected: all PASS (`nav-routes.test.ts` passes once `/memory` is in the set — it ties the set to the chapters in both directions).

- [ ] **Step 7: Commit**

```bash
git add lib/demo/resolvers.ts lib/demo/chapters/memory.ts lib/demo/fixtures/chapter-memory.ts lib/demo/supported-routes.ts lib/demo/nav-routes.ts lib/demo/resolvers.memory-bases.test.ts lib/demo/chapter-memory.test.ts lib/demo/apollo-link.operations.test.ts "app/(application)/memory/components/memory-overview.tsx" scripts/walk-demo.mjs
git commit -m "feat(demo): chapter 6 ends on the memory workbench with the base's live counts

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Chapter 11 gains the model catalogue

**Files:**
- Create: `lib/demo/resolvers.models.test.ts`, `app/(application)/models/components/format.test.ts`
- Modify: `lib/demo/supported-routes.ts` (after `"/memory"`), `lib/demo/nav-routes.ts` (`"/models"`)
- Modify: `lib/demo/resolvers.ts` (`litellmModel` ~105-136, `GetLiteLLMCatalog` ~868, `GetAgentLiteLLMCatalog` ~878-883)
- Modify: `app/(application)/models/components/format.ts:12-16`
- Modify: `app/(application)/models/components/litellm-catalog-view.tsx:71` (anchor), `:235-245` and `:295-302` (cost cells)
- Modify: `lib/demo/chapters/kosten.ts` (new step after `kosten-verbrauch`; one sentence in `kosten-kontrolle`; header comment)
- Modify: `scripts/walk-demo.mjs` (`CLICK_PROBES` kosten keys)

**Interfaces:**
- Consumes: `spendCurrency()` (`lib/spend-currency.ts`), `models.cost.perMillion` message (`{amount}/M` en, `{amount}/Mio.` de), `GET_LITELLM_CATALOG` (`queries/queries.ts`), `GET_AGENT_LITELLM_CATALOG` (`app/(application)/agents/queries.ts:268`).
- Produces: `LITELLM_CATALOGUE` (module-private, four rows), `formatCostPerMillion(n, { currency, locale } = spendCurrency())`, anchor `models-catalog`, step id `kosten-modelle` at index 1, `/models` in both allowlists.

- [ ] **Step 1: Write the failing tests**

`lib/demo/resolvers.models.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { GET_AGENT_LITELLM_CATALOG } from "@/app/(application)/agents/queries";
import { GET_LITELLM_CATALOG } from "@/queries/queries";

import { getWorld } from "./fixtures";
import { runDemoQueryThroughCache as run } from "./test-support";
import { CHAPTERS } from "./tour";

type Row = {
  model_name: string;
  region: string;
  tags: string[];
  input_cost_per_million_tokens: number | null;
  output_cost_per_million_tokens: number | null;
};

const AT = { chapter: "kosten", step: 1 } as const;

describe("the model catalogue (chapter 11, models step)", () => {
  it("lists four EU-hosted models with prices, every field the table selects", async () => {
    const data = await run(GET_LITELLM_CATALOG, {}, AT);
    const rows = data.litellmCatalog as Row[];
    expect(rows.map((r) => r.model_name)).toEqual([
      "gemini-3.1-pro",
      "gemini-3.1-flash",
      "mistral-medium-3",
      "claude-sonnet-4-6",
    ]);
    for (const row of rows) {
      expect(row.region, row.model_name).toBe("eu");
      expect(row.tags, row.model_name).toContain("europe-west3");
      expect(typeof row.input_cost_per_million_tokens, row.model_name).toBe("number");
      expect(typeof row.output_cost_per_million_tokens, row.model_name).toBe("number");
    }
  });

  it("is the same list the agent editor's selector sees, and the agent's model is in it", async () => {
    const editor = await run(GET_AGENT_LITELLM_CATALOG, {}, { chapter: "config", step: 0 });
    const names = (editor.litellmCatalog as Row[]).map((r) => r.model_name);
    const agentModel = getWorld({ chapter: "config", step: 0 }).agents[0].model;
    expect(names).toContain(agentModel);
    expect(names).toHaveLength(4);
  });

  it("is chapter 11's second step, between attribution and the budget", () => {
    const steps = CHAPTERS.find((c) => c.id === "kosten")!.steps;
    expect(steps.map((s) => s.route.split("?")[0])).toEqual(["/analytics", "/models", "/budgets", "/budgets"]);
    expect(steps[1].id).toBe("kosten-modelle");
    expect(steps[1].anchor).toBe("models-catalog");
  });
});
```

`app/(application)/models/components/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { formatCostPerMillion, formatTokens } from "./format";

describe("formatCostPerMillion", () => {
  it("renders dollars with two decimals for the product, free models included", () => {
    expect(formatCostPerMillion(1.25, { currency: "USD", locale: "en-US" })).toBe("$1.25");
    expect(formatCostPerMillion(0, { currency: "USD", locale: "en-US" })).toBe("$0.00");
  });

  it("renders euros the German way for the demo", () => {
    // Intl separates the amount and the sign with a no-break space.
    expect(formatCostPerMillion(2, { currency: "EUR", locale: "de-DE" })).toBe("2,00\u00a0€");
  });

  it("follows the spend currency by default", () => {
    // Not a demo build under vitest: USD.
    expect(formatCostPerMillion(3)).toBe("$3.00");
  });
});

describe("formatTokens", () => {
  it("humanises counts and dashes the unknown", () => {
    expect(formatTokens(1048576)).toBe("1.0M");
    expect(formatTokens(200000)).toBe("200K");
    expect(formatTokens(null)).toBe("—");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run lib/demo/resolvers.models.test.ts "app/(application)/models/components/format.test.ts"`
Expected: FAIL — the catalogue is empty; `formatCostPerMillion(1.25, …)` returns `"1.25"`.

- [ ] **Step 3: Allowlists**

`lib/demo/supported-routes.ts` — after the `"/memory"` entry:

```ts
  // Chapter 11's second step: the LiteLLM catalogue, read-only, with the four
  // models this deployment names and where they are hosted.
  "/models",
```

`lib/demo/nav-routes.ts` — add `"/models",` after `"/memory",`.

- [ ] **Step 4: The catalogue**

`lib/demo/resolvers.ts` — replace the `litellmModel` helper and its doc comment (~105-136) with:

```ts
/**
 * One row of the LiteLLM catalogue, with every field GetLiteLLMCatalog and
 * GetAgentLiteLLMCatalog select (queries/queries.ts:1158 and
 * agents/queries.ts:268 — the same set). All of them, because Apollo does
 * not fail an incomplete cache write — it logs a console.error per missing
 * field and falls back to the raw network result, so a partial row is silent
 * breakage.
 *
 * Capabilities and limits are the published ones. Costs are per million
 * tokens and EXAMPLE figures — chapter 11 says so on screen — because /models
 * renders them from sub-project 5 on. `region` is the literal "eu" because
 * ProviderLogo's EU pill keys on that; the Google Cloud region the deployment
 * runs in is each row's tag.
 */
const litellmModel = (
  name: string,
  upstream: string,
  brand: string,
  cost: { input: number; output: number },
  limits: { input: number; output: number } = { input: 1048576, output: 65536 },
): Record<string, unknown> => ({
  __typename: "LiteLLMModel",
  model_name: name,
  active: true,
  upstream_model: upstream,
  type: "chat",
  tags: ["europe-west3"],
  brand,
  region: "eu",
  max_tokens: limits.output,
  max_input_tokens: limits.input,
  max_output_tokens: limits.output,
  supports_vision: true,
  supports_function_calling: true,
  supports_pdf_input: true,
  supports_audio_input: false,
  input_cost_per_million_tokens: cost.input,
  output_cost_per_million_tokens: cost.output,
});

/**
 * The four models this deployment names: the agent's own and the eval judge
 * (fixtures/evals.ts), the small Gemini, and a Mistral — all served from
 * Vertex AI in europe-west3 (Frankfurt), which is what chapter 11's models
 * step is about. One list for both catalogue operations, so the agent
 * editor's selector and /models cannot disagree. The agent's model has to be
 * IN it or the selector marks it stale and renders it in destructive red.
 */
const LITELLM_CATALOGUE = [
  litellmModel("gemini-3.1-pro", "vertex_ai/gemini-3.1-pro", "Google", { input: 2, output: 12 }),
  litellmModel("gemini-3.1-flash", "vertex_ai/gemini-3.1-flash", "Google", { input: 0.3, output: 2.5 }),
  litellmModel("mistral-medium-3", "vertex_ai/mistral-medium-3", "Mistral", { input: 0.4, output: 2 }, { input: 131072, output: 8192 }),
  litellmModel("claude-sonnet-4-6", "vertex_ai/claude-sonnet-4-6", "Anthropic", { input: 3, output: 15 }, { input: 200000, output: 64000 }),
];
```

Replace `GetLiteLLMCatalog: () => ({ litellmCatalog: [] }),` and the `GetAgentLiteLLMCatalog` resolver with:

```ts
  // Two documents select the same `litellmCatalog` root under two operation
  // names — the chat surface's and the agent editor's — and the resolver
  // table is keyed by OPERATION, so both must be mapped. Same list for both.
  GetLiteLLMCatalog: () => ({ litellmCatalog: LITELLM_CATALOGUE }),
  GetAgentLiteLLMCatalog: () => ({ litellmCatalog: LITELLM_CATALOGUE }),
```

and delete the two superseded comment blocks above them ("Knowledge section the chapter is about…" through "…Only the models this deployment actually names"). Then `grep -rn "litellmCatalog" lib app --include='*.test.ts' --include='*.test.tsx'`: any test pinning two rows or null costs (demo-editor tests) is updated to the shared list of four.

- [ ] **Step 5: The cost cell and the anchor**

`app/(application)/models/components/format.ts` — replace `formatCostPerMillion` and its comment:

```ts
import { spendCurrency } from "@/lib/spend-currency";

/**
 * formatCostPerMillion — the per-million-token price as currency, in the
 * display currency spend uses everywhere else (USD in the product, EUR in
 * the demo — lib/spend-currency.ts). Two decimals always, so a free model
 * renders $0.00 rather than dropping the cell (U15). The "/M" suffix is the
 * `models.cost.perMillion` message's business, not this helper's.
 */
export const formatCostPerMillion = (
  n: number,
  { currency, locale }: { currency: "USD" | "EUR"; locale: string } = spendCurrency(),
): string =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
```
(the import goes at the top of the file.)

`app/(application)/models/components/litellm-catalog-view.tsx`:
- line 71: `<div className="space-y-4" data-demo-id="models-catalog">`
- the two table badges (~235-245): `${formatCostPerMillion(entry.input_cost_per_million_tokens)}/M` → `{t("cost.perMillion", { amount: formatCostPerMillion(entry.input_cost_per_million_tokens) })}`, and the same for `output_cost_per_million_tokens` (`t` is already in scope: `useTranslations("models")` at the row component's top).
- the mobile card (~295-302): `` `$${formatCostPerMillion(…)}/M` `` → `t("cost.perMillion", { amount: formatCostPerMillion(…) })` for input and output (the card component also holds `t`; if it does not, add `const t = useTranslations("models");` beside its sibling hooks).

Then `grep -n '\$\${\|\$<\|"\$"' "app/(application)/models/components/litellm-catalog-view.tsx"` must return nothing.

- [ ] **Step 6: The step**

`lib/demo/chapters/kosten.ts` — insert after the `kosten-verbrauch` step object (before `id: "kosten-kontrolle"`):

```ts
    {
      id: "kosten-modelle",
      route: "/models",
      anchor: "models-catalog",
      title: "Welches Modell, wo gehostet",
      content: [
        {
          kind: "paragraph",
          text: "Vier Modelle stehen zur Wahl, alle in Frankfurt gehostet — welches ein Assistent nutzt, ist eine Einstellung, keine Bindung an einen Anbieter. Die Preise je Million Token stehen daneben; auch sie sind hier Beispielwerte.",
        },
      ],
    },
```

In `kosten-kontrolle`'s second paragraph change `Der Zeitraum in der Analyse eben war frei wählbar;` to `Der Zeitraum in der Analyse vorhin war frei wählbar;` (a step now lies between). In the header comment, change `Three steps, not two:` to `Four steps, not two:` and add one line after that paragraph: `Sub-project 5 put the model catalogue between attribution and the budget: where the spend goes before who caps it.`

`scripts/walk-demo.mjs` `CLICK_PROBES` — the kosten block becomes:

```js
  "kosten.0": { attempts: [{ spec: { kind: "tab", containerSelector: "main" }, describe: "a non-active Radix tab (range preset or measure) — would switch the selected view" }] },
  "kosten.1": { attempts: [{ spec: { kind: "css", selector: '[data-demo-id="models-catalog"] tbody tr[role="button"]' }, describe: "a model row — would open its detail sheet" }] },
  "kosten.2": { attempts: [{ spec: { kind: "tab", containerSelector: "main" }, describe: "a non-active budget-scope tab (Benutzer/Rollen/...) — would switch the budgets view away from Teams" }] },
  "kosten.3": { attempts: [{ spec: { kind: "tab", containerSelector: "main" }, describe: "a non-active budget-scope tab — would switch the budgets view away from Teams" }] },
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run lib/demo/resolvers.models.test.ts "app/(application)/models/components/format.test.ts" lib/demo/tour.test.ts lib/demo/chapters/index.test.ts lib/demo/nav-routes.test.ts lib/demo/supported-routes.test.ts lib/demo/apollo-link.operations.test.ts "app/(application)/agents" && npx eslint --no-warn-ignored lib/demo/resolvers.ts lib/demo/chapters/kosten.ts lib/demo/supported-routes.ts lib/demo/nav-routes.ts lib/demo/resolvers.models.test.ts "app/(application)/models/components/format.ts" "app/(application)/models/components/format.test.ts" "app/(application)/models/components/litellm-catalog-view.tsx"`
Expected: all PASS, including `tour.test.ts`'s kosten register (the new copy contains "Beispielwerte" and none of the forbidden claim phrasings).

- [ ] **Step 8: Commit**

```bash
git add lib/demo/resolvers.ts lib/demo/chapters/kosten.ts lib/demo/supported-routes.ts lib/demo/nav-routes.ts lib/demo/resolvers.models.test.ts "app/(application)/models/components/format.ts" "app/(application)/models/components/format.test.ts" "app/(application)/models/components/litellm-catalog-view.tsx" scripts/walk-demo.mjs
git commit -m "feat(demo): chapter 11 shows the model catalogue, priced in the spend currency

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Chapter 10 is list → document; the tour is 38 steps

**Files:**
- Modify: `lib/demo/chapters/meetings.ts:33-44` (delete the `meetings-transcript` step)
- Modify: `lib/demo/tour.test.ts` (new describe), `lib/demo/chapters/index.test.ts:119` (comment)
- Modify: `scripts/walk-demo.mjs` (`CLICK_PROBES` meetings keys; comments at :27 and :102), `scripts/dump-demo-steps.ts:7` (comment), `lib/demo/scenes.ts:9` (comment)

- [ ] **Step 1: Write the failing test**

Append to `lib/demo/tour.test.ts`:

```ts
describe("the tour after sub-project 5", () => {
  it("runs chapter 10 as list → document, with no raw-transcript step between", () => {
    const steps = CHAPTERS.find((c) => c.id === "meetings")!.steps;
    expect(steps.map((s) => s.id)).toEqual(["meetings-list", "meetings-guide"]);
  });

  it("is 38 steps long — the spec's acceptance count", () => {
    // 37 before: minus the raw transcript, plus the model catalogue, plus the
    // approval card. The walker derives its list from CHAPTERS, so this is
    // the one place the number is written down.
    expect(CHAPTERS.reduce((n, c) => n + c.steps.length, 0)).toBe(38);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run lib/demo/tour.test.ts`
Expected: FAIL — three meetings steps; 39 steps.

- [ ] **Step 3: Remove the step; renumber the probes; fix the counts in comments**

`lib/demo/chapters/meetings.ts` — delete the whole `meetings-transcript` step object (from its `{` through its `},`). Keep `REVIEW` (the guide step uses it).

`scripts/walk-demo.mjs` `CLICK_PROBES` — the meetings block becomes:

```js
  // The transcripts list is rows of links (the review sheet became a page),
  // and the review page's operable controls are its review actions.
  "meetings.0": { attempts: [{ spec: { kind: "css", selector: '[data-demo-id="transcriptions"] a[href^="/transcriptions/review/"]' }, describe: "a transcript row link — would navigate to its review page" }] },
  "meetings.1": { attempts: [
    { spec: { kind: "text", containerSelector: "main", tag: "button", textIncludes: "Als geprüft markieren" }, describe: "'Als geprüft markieren' — would run the mark-reviewed mutation" },
    { spec: { kind: "text", containerSelector: "main", tag: "button", textIncludes: "In Wissensdatenbank veröffentlichen" }, describe: "fallback: 'In Wissensdatenbank veröffentlichen' — would finalize the job" },
  ] },
```

Comments: `scripts/walk-demo.mjs:27` and `:102` "The 37 steps" → "The 38 steps"; `scripts/dump-demo-steps.ts:7` "37 URLs" → "38 URLs"; `lib/demo/scenes.ts:9` "all 37 steps" → "all 38 steps"; `lib/demo/chapters/index.test.ts:119` "read 37 times" → "read 38 times".

- [ ] **Step 4: Run the whole suite**

Run: `npx vitest run && npx eslint --no-warn-ignored lib/demo/chapters/meetings.ts lib/demo/tour.test.ts scripts/walk-demo.mjs`
Expected: all PASS (`components/shell/nav-config.test.ts` is a pre-existing failure if it appears; compare with `main`). Then `npx tsx scripts/dump-demo-steps.ts | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s);console.log(a.length, a.map(x=>x.pos).join(" "))})'` prints `38` and the positions `… email.3 meetings.0 meetings.1 kosten.0 kosten.1 kosten.2 kosten.3 contact.0 contact.1`.

- [ ] **Step 5: Commit**

```bash
git add lib/demo/chapters/meetings.ts lib/demo/tour.test.ts lib/demo/chapters/index.test.ts scripts/walk-demo.mjs scripts/dump-demo-steps.ts lib/demo/scenes.ts
git commit -m "feat(demo): chapter 10 goes straight from the list to the document; 38 steps

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Verify on Daniel's build; spec note; copy for sign-off

**Files:**
- Modify: `docs/superpowers/specs/2026-10-14-demo-tour-fix-design.md` (append "Clarifications 2026-10-15 (sub-project 5)" with the nine items from this plan's header)
- Modify: this plan (Verification, Copy for sign-off)

- [ ] **Step 1: Ask Daniel to build and serve**

```bash
NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build
NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next start -p 3111
```

- [ ] **Step 2: Walk it**

`DEMO_BASE_URL=http://localhost:3111 node /Users/daniel.claessen/Desktop/Projects/exulu/frontend/scripts/walk-demo.mjs` (Node 22 via nvm; Playwright from the scratch directory) — expected **38/38**, `leaks=none`, 3 Tabs to Weiter, every anchored step `ring=1/1@anchor=true`.

- [ ] **Step 3: Spot checks (Playwright, scratch directory)**

- `zugriff.0`: the ring sits on `[data-demo-id="agent-access"]`; `main` text contains "Mit 1 Rolle(n) geteilt." and "Techniker"; the techdoc chat still autotypes and streams on `techdoc.0` (Review Focus 5).
- `email.2`: exactly one run row is in the waiting state and its "Sitzung öffnen" link's href is `email.3`'s route (minus `?tour=`).
- `email.3`: `[data-demo-id="chat-tool-approval"]` is visible with the title "E-Mail-Versand ausführen?", the mono summary starting "RE: Price and delivery time 2658446" and the three buttons; no "Denke nach"; the composer is enabled (no read-only notice); no session titled "Nothalt COP…" anywhere on the page; the two retrieval cards and the two memory tool traces of the stored session render without console errors; tool headers read "Wissenssuche" / "Gedächtnis-Eintrag gespeichert", never "Create Agent Memory".
- `memory.3`: the row "Assistenten-Gedächtnis" shows the agent chip, 4 memories, 1 contributor and a relative time in German; the stat cards read 1 / 1 von 1 / 4 / 1; the sidebar lists "Gedächtnis".
- `kosten.1`: four rows; every cost badge matches `/\d,\d\d\s?€\/Mio\./`; no `$` in `main`; each row has the EU pill and the tag `europe-west3`; the sidebar lists "Modelle".
- `meetings.0` → Weiter → `meetings.1` lands on the review page with the ring on `meeting-guide`.
- Non-demo sanity is by code review only (no non-demo build): the format test pins the product's `$1.25` and en.json's `/M`.

- [ ] **Step 4: Record and commit**

Append `## Verification` and `## Copy for sign-off` (the table below, filled from the chapter modules) to this plan; append the nine clarifications to the spec.

```bash
git add docs/superpowers/plans/2026-10-15-demo-tour-chapters.md docs/superpowers/specs/2026-10-14-demo-tour-fix-design.md
git commit -m "docs(demo): record the chapters walk and list the copy for sign-off

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

## Verification

2026-10-15 — Daniel's production demo builds; final 9fcc67f (BUILD_ID lRuPg-7DEEmEpPJlLCfnz), `next start -p 3111`, Playwright at 1440×900.

- Walker in Weiter mode: **38/38**, zero deny-list leaks, 3 Tabs to Weiter, every anchored step `ring=true@anchor=true` (the approval card, the access section, the memory table and the catalogue included).
- `zugriff.0`: the access section is in view with "Mit 1 Rolle(n) geteilt." and the Techniker role; `techdoc.0` still autotypes (send at 3.3 s) and streams (first growth at 4.9 s) with the role-shared agent.
- `email.2`: the runs list shows one "Erfordert Aufmerksamkeit" row; `email.3` opens ALFREDO's session titled "WG: Price and delivery time 2658446", the card reads "E-Mail-Versand ausführen?" with the subject summary and the three German buttons, the composer is enabled, no Newton session is listed, both memory tool traces read "Gedächtnis-Eintrag gespeichert", no English status words.
- `memory.3`: one row "Assistenten-Gedächtnis · Technischer Dokumentationsassistent · 4 · 1 · jetzt"; stat cards 1 / 1 von 1 / 4 / 1; the header description is Sie-form; "Gedächtnis" is in the sidebar.
- `kosten.1`: four rows, eight cost badges of the form `2,00 €/Mio.`, no dollar sign on the page, EU pill and `europe-west3` tag on every row; "Modelle" is in the sidebar's Administration group.
- `meetings.0` → Weiter → `meetings.1` lands on the review page with the guide in view.
- Console pass over the seven checked screens: zero errors after the transcripts settings resolver (the first build showed one Apollo missing-field error on `/transcriptions`).
- First build (b9bec42) found and fixed: the optional items map in `MemoryBases` (type gate), the memory page's Du-form description (walker leak), the unmapped transcripts settings query (console).
- Unit: full suite 139 files / 1,447 tests at 9fcc67f.
- Known, deferred: on a hard load of a chat step the anchor sits ~28 px above the viewport top (scrollIntoView also scrolls an overflow-hidden ancestor); pre-existing on `memory.2`, absent in the Weiter flow.

## Copy for sign-off

New visitor-facing German introduced by this plan (implementer drafts; Daniel + Doro sign off).

| Where | Text |
|---|---|
| `zugriff.0` body (`lib/demo/chapters/zugriff.ts`) | Dieser Assistent gehört dem Technikerteam: Nur die Rolle Techniker darf ihn befragen. Was er dabei lesen darf, ist zusätzlich pro Wissensbasis und pro Eintrag geregelt — interne Serviceanweisungen bleiben intern, Produktdatenblätter dürfen an den Kunden. |
| Roles roster (`lib/demo/fixtures/roles.ts`) | Techniker · Servicetechniker · Vertrieb |
| `email.3` title (`lib/demo/chapters/email.ts`) | Der eine, der auf einen Menschen wartet |
| `email.3` body | Das ist der Lauf, der wartet: Der Assistent hat die Anfrage gelesen, den Katalog durchsucht und drei Korrekturen des Verkäufers übernommen — und fragt jetzt, bevor er die Antwort an den Kunden schickt. Gesendet wird erst, wenn ein Mensch es freigibt. |
| Approval card tool name (`lib/demo/overlays.ts`) | E-Mail-Versand (renders as "E-Mail-Versand ausführen?") |
| ALFREDO's memory tool header (`lib/demo/overlays.ts`) | Gedächtnis-Eintrag gespeichert (same label as Newton's) |
| Session title (`lib/demo/fixtures/chapter-email.ts`) | WG: Price and delivery time 2658446 (the real inbound subject) |
| `memory.3` title (`lib/demo/chapters/memory.ts`) | Ein Gedächtnis, das Ihnen gehört |
| `memory.3` body (count computed from the fixture) | Vier Einträge, ein Assistent, ein Beitragender — der jüngste ist Ihre Korrektur von eben. Jeder Eintrag ist einsehbar, änderbar, löschbar; ab sofort bekommen alle Kollegen die richtige Antwort. |
| `kosten.1` title (`lib/demo/chapters/kosten.ts`) | Welches Modell, wo gehostet |
| `kosten.1` body | Vier Modelle stehen zur Wahl, alle in Frankfurt gehostet — welches ein Assistent nutzt, ist eine Einstellung, keine Bindung an einen Anbieter. Die Preise je Million Token stehen daneben; auch sie sind hier Beispielwerte. |
| `kosten.2` body, one word | "in der Analyse eben" → "in der Analyse vorhin" |
| Model rows (`lib/demo/resolvers.ts`, example prices per million tokens) | gemini-3.1-pro 2,00 € / 12,00 € · gemini-3.1-flash 0,30 € / 2,50 € · mistral-medium-3 0,40 € / 2,00 € · claude-sonnet-4-6 3,00 € / 15,00 € |

Removed: `meetings.1` "So sieht eine halbe Stunde davon aus" and its body; `zugriff.0`'s old body ("… getrennt wird pro Eintrag, nicht pro Ordner."); `memory.3`'s old title and body ("Und ein Wissenseintrag, der Ihnen gehört" / "Die Korrektur liegt jetzt als Eintrag …").
