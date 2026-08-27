# Demo Shell — Foundation & Chapter 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the demo-shell foundation — flag, fixtures, mocked Apollo link, scripted chat transport, tour engine, lead gate — and prove it end to end with Chapter 1 (techdoc accuracy).

**Architecture:** A `DEMO_MODE`-gated `/demo` route group renders the real Exulu product components against scripted data. Instead of intercepting the network, two framework seams are swapped: the Apollo terminating link (`app/(application)/authenticated.tsx:147`) and the chat transport (`app/(application)/chat/hooks.ts:386`). All mock logic lives in pure modules under `lib/demo/`, unit-tested in the repo's existing node-environment vitest. React components stay thin.

**Tech Stack:** Next.js 16.0.10 (App Router), React 19.2.3, Apollo Client 3.10.7, AI SDK (`ai` 6.0.49 / `@ai-sdk/react` 3.0.51), vitest 4.1.8 (`environment: "node"`).

**Spec:** `docs/superpowers/specs/2026-08-27-demo-shell-design.md`

## Global Constraints

- **No new runtime dependencies.** MSW was explicitly rejected; both transports have first-class injection points.
- **No backend.** No Postgres, Redis, S3, LiteLLM, or live LLM inference. Every byte the demo renders comes from a fixture.
- **Tests run in `environment: "node"`.** `@testing-library/react` is NOT installed and must not be added. Only `.test.ts` files under `lib/`, `components/`, `app/` are collected (see `vitest.config.ts`) — note `.test.tsx` is NOT in the include globs. Pure modules get vitest tests; React components get manual verification steps.
- **Fixtures are typed against `types/models/`** (`Agent`, `AgentSession`, `AgentMessage`, `Context`, `Item`). NOT `lib/graphql/__generated__/`, which does not exist.
- **Fixtures are pure and step-addressable.** `getWorld(position)` returns a complete world; never a delta. Chapter jumping depends on this.
- **The flag must be `NEXT_PUBLIC_DEMO_MODE`**, not `DEMO_MODE` — it is read from client components, and Next.js only exposes `NEXT_PUBLIC_`-prefixed vars to the browser.
- Run `npm run lint` and `npm run prettier:fix` before each commit.

## File Structure

| File | Responsibility |
| --- | --- |
| `lib/demo/flag.ts` | Single source of truth for "are we in demo mode" |
| `lib/demo/tour.ts` | Chapter/step model and pure navigation maths |
| `lib/demo/types.ts` | `DemoWorld` — the complete scripted world at one step |
| `lib/demo/fixtures/index.ts` | `getWorld(position)` dispatcher |
| `lib/demo/fixtures/chapter-techdoc.ts` | Chapter 1 world states |
| `lib/demo/apollo-link.ts` | Terminating `ApolloLink` resolving operations from a `DemoWorld` |
| `lib/demo/script.ts` | Scripted-turn model → `UIMessageChunk[]` |
| `lib/demo/chat-transport.ts` | `ChatTransport` replaying chunks as a paced `ReadableStream` |
| `components/demo/tour-provider.tsx` | Holds position, exposes navigation |
| `components/demo/tour-bubble.tsx` | Persistent chapter list / jump control |
| `components/demo/spotlight.tsx` | Highlight overlay anchored to `data-demo-id` |
| `app/demo/page.tsx` | Lead-capture gate |
| `app/demo/tour/page.tsx` | Tour host |

---

### Task 1: Demo mode flag

**Files:**
- Create: `lib/demo/flag.ts`
- Test: `lib/demo/flag.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `isDemoMode(env?: Record<string, string | undefined>): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// lib/demo/flag.test.ts
import { describe, expect, it } from "vitest";
import { isDemoMode } from "./flag";

describe("isDemoMode", () => {
  it("is true only for the exact string 'true'", () => {
    expect(isDemoMode({ NEXT_PUBLIC_DEMO_MODE: "true" })).toBe(true);
  });

  it("is false when unset", () => {
    expect(isDemoMode({})).toBe(false);
  });

  it("is false for truthy-looking values that are not 'true'", () => {
    expect(isDemoMode({ NEXT_PUBLIC_DEMO_MODE: "1" })).toBe(false);
    expect(isDemoMode({ NEXT_PUBLIC_DEMO_MODE: "TRUE" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/demo/flag.test.ts`
Expected: FAIL — cannot resolve `./flag`

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/demo/flag.ts

/**
 * The demo shell is gated on NEXT_PUBLIC_DEMO_MODE rather than DEMO_MODE:
 * client components read it, and Next.js only inlines NEXT_PUBLIC_* vars
 * into the browser bundle.
 *
 * Strict equality with "true" — a deployment that sets "1" or "TRUE" should
 * fail closed rather than silently serve the demo from a customer instance.
 */
export function isDemoMode(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  return env.NEXT_PUBLIC_DEMO_MODE === "true";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/demo/flag.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/demo/flag.ts lib/demo/flag.test.ts
git commit -m "feat(demo): add demo mode flag"
```

---

### Task 2: Tour model and navigation

**Files:**
- Create: `lib/demo/tour.ts`
- Test: `lib/demo/tour.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type DemoChapterId = "techdoc" | "ingestion" | "config" | "memory" | "evals" | "email" | "meetings"`
  - `interface DemoStep { id: string; route: string; anchor: string | null; title: string; body: string }`
  - `interface DemoChapter { id: DemoChapterId; title: string; steps: DemoStep[] }`
  - `interface TourPosition { chapter: DemoChapterId; step: number }`
  - `CHAPTERS: DemoChapter[]`
  - `resolveStep(chapters: DemoChapter[], pos: TourPosition): DemoStep | null`
  - `nextPosition(chapters: DemoChapter[], pos: TourPosition): TourPosition | null`
  - `prevPosition(chapters: DemoChapter[], pos: TourPosition): TourPosition | null`
  - `startOfChapter(id: DemoChapterId): TourPosition`

- [ ] **Step 1: Write the failing test**

```ts
// lib/demo/tour.test.ts
import { describe, expect, it } from "vitest";
import {
  CHAPTERS,
  type DemoChapter,
  nextPosition,
  prevPosition,
  resolveStep,
  startOfChapter,
} from "./tour";

const FIXTURE: DemoChapter[] = [
  {
    id: "techdoc",
    title: "A",
    steps: [
      { id: "a1", route: "/demo/tour", anchor: null, title: "t", body: "b" },
      { id: "a2", route: "/demo/tour", anchor: null, title: "t", body: "b" },
    ],
  },
  {
    id: "ingestion",
    title: "B",
    steps: [{ id: "b1", route: "/demo/tour", anchor: null, title: "t", body: "b" }],
  },
];

describe("resolveStep", () => {
  it("returns the step at a valid position", () => {
    expect(resolveStep(FIXTURE, { chapter: "techdoc", step: 1 })?.id).toBe("a2");
  });

  it("returns null for an out-of-range step", () => {
    expect(resolveStep(FIXTURE, { chapter: "techdoc", step: 9 })).toBeNull();
  });

  it("returns null for an unknown chapter", () => {
    expect(resolveStep(FIXTURE, { chapter: "evals", step: 0 })).toBeNull();
  });
});

describe("nextPosition", () => {
  it("advances within a chapter", () => {
    expect(nextPosition(FIXTURE, { chapter: "techdoc", step: 0 })).toEqual({
      chapter: "techdoc",
      step: 1,
    });
  });

  it("rolls over into the next chapter", () => {
    expect(nextPosition(FIXTURE, { chapter: "techdoc", step: 1 })).toEqual({
      chapter: "ingestion",
      step: 0,
    });
  });

  it("returns null at the very end", () => {
    expect(nextPosition(FIXTURE, { chapter: "ingestion", step: 0 })).toBeNull();
  });
});

describe("prevPosition", () => {
  it("rolls back to the LAST step of the previous chapter", () => {
    expect(prevPosition(FIXTURE, { chapter: "ingestion", step: 0 })).toEqual({
      chapter: "techdoc",
      step: 1,
    });
  });

  it("returns null at the very start", () => {
    expect(prevPosition(FIXTURE, { chapter: "techdoc", step: 0 })).toBeNull();
  });
});

describe("CHAPTERS", () => {
  it("declares all seven chapters in spec order", () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual([
      "techdoc",
      "ingestion",
      "config",
      "memory",
      "evals",
      "email",
      "meetings",
    ]);
  });

  it("gives every chapter at least one step", () => {
    for (const chapter of CHAPTERS) {
      expect(chapter.steps.length).toBeGreaterThan(0);
    }
  });

  it("starts a chapter at step 0", () => {
    expect(startOfChapter("evals")).toEqual({ chapter: "evals", step: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/demo/tour.test.ts`
Expected: FAIL — cannot resolve `./tour`

- [ ] **Step 3: Write minimal implementation**

Chapters 2–7 carry a single placeholder step here so navigation is exercisable end to end; each gets its real steps in its own plan.

```ts
// lib/demo/tour.ts

export type DemoChapterId =
  | "techdoc"
  | "ingestion"
  | "config"
  | "memory"
  | "evals"
  | "email"
  | "meetings";

export interface DemoStep {
  id: string;
  /** Route the shell navigates to for this step. */
  route: string;
  /** `data-demo-id` value to spotlight, or null for a full-screen step. */
  anchor: string | null;
  title: string;
  body: string;
}

export interface DemoChapter {
  id: DemoChapterId;
  title: string;
  steps: DemoStep[];
}

export interface TourPosition {
  chapter: DemoChapterId;
  step: number;
}

const stub = (id: string, title: string): DemoStep => ({
  id,
  route: "/demo/tour",
  anchor: null,
  title,
  body: "Coming soon.",
});

export const CHAPTERS: DemoChapter[] = [
  {
    id: "techdoc",
    title: "Answering a hard question",
    steps: [
      {
        id: "techdoc-ask",
        route: "/demo/tour",
        anchor: "chat-composer",
        title: "A question with a precise answer",
        body: "A service engineer asks about a specific fault condition. Watch how the assistant finds it.",
      },
      {
        id: "techdoc-retrieval",
        route: "/demo/tour",
        anchor: "chat-tool-trace",
        title: "Retrieval, in the open",
        body: "The assistant decides which knowledge bases to search, and shows its work.",
      },
      {
        id: "techdoc-answer",
        route: "/demo/tour",
        anchor: "chat-sources",
        title: "Every claim, sourced",
        body: "The answer cites the documents it came from. Open one to check it.",
      },
    ],
  },
  { id: "ingestion", title: "How it learned that", steps: [stub("ingestion-intro", "How it learned that")] },
  { id: "config", title: "Making it yours", steps: [stub("config-intro", "Making it yours")] },
  { id: "memory", title: "Correcting it", steps: [stub("memory-intro", "Correcting it")] },
  { id: "evals", title: "Proving it", steps: [stub("evals-intro", "Proving it")] },
  { id: "email", title: "Working while you sleep", steps: [stub("email-intro", "Working while you sleep")] },
  { id: "meetings", title: "Capturing what is said", steps: [stub("meetings-intro", "Capturing what is said")] },
];

function chapterIndex(chapters: DemoChapter[], id: DemoChapterId): number {
  return chapters.findIndex((c) => c.id === id);
}

export function resolveStep(chapters: DemoChapter[], pos: TourPosition): DemoStep | null {
  const chapter = chapters[chapterIndex(chapters, pos.chapter)];
  if (!chapter) return null;
  return chapter.steps[pos.step] ?? null;
}

export function nextPosition(chapters: DemoChapter[], pos: TourPosition): TourPosition | null {
  const ci = chapterIndex(chapters, pos.chapter);
  if (ci < 0) return null;
  const chapter = chapters[ci];
  if (pos.step + 1 < chapter.steps.length) {
    return { chapter: chapter.id, step: pos.step + 1 };
  }
  const next = chapters[ci + 1];
  return next ? { chapter: next.id, step: 0 } : null;
}

export function prevPosition(chapters: DemoChapter[], pos: TourPosition): TourPosition | null {
  const ci = chapterIndex(chapters, pos.chapter);
  if (ci < 0) return null;
  if (pos.step > 0) return { chapter: pos.chapter, step: pos.step - 1 };
  const prev = chapters[ci - 1];
  return prev ? { chapter: prev.id, step: prev.steps.length - 1 } : null;
}

export function startOfChapter(id: DemoChapterId): TourPosition {
  return { chapter: id, step: 0 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/demo/tour.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/demo/tour.ts lib/demo/tour.test.ts
git commit -m "feat(demo): add tour chapter model and navigation"
```

---

### Task 3: DemoWorld type and step-addressable fixtures

**Files:**
- Create: `lib/demo/types.ts`, `lib/demo/fixtures/chapter-techdoc.ts`, `lib/demo/fixtures/index.ts`
- Test: `lib/demo/fixtures/index.test.ts`

**Interfaces:**
- Consumes: `TourPosition`, `CHAPTERS` from `lib/demo/tour.ts`
- Produces:
  - `interface DemoWorld { agents: Agent[]; contexts: Context[]; items: Item[]; sessions: AgentSession[] }`
  - `getWorld(pos: TourPosition): DemoWorld`
  - `DEMO_AGENT_ID: string`, `DEMO_AGENT_SLUG: string`

- [ ] **Step 1: Write the failing test**

The purity test is the important one — it is what makes chapter jumping safe.

```ts
// lib/demo/fixtures/index.test.ts
import { describe, expect, it } from "vitest";
import { CHAPTERS } from "../tour";
import { DEMO_AGENT_ID, getWorld } from "./index";

describe("getWorld", () => {
  it("returns a complete world for every step of every chapter", () => {
    for (const chapter of CHAPTERS) {
      for (let step = 0; step < chapter.steps.length; step++) {
        const world = getWorld({ chapter: chapter.id, step });
        expect(world.agents.length, `${chapter.id}:${step}`).toBeGreaterThan(0);
        expect(world.contexts.length, `${chapter.id}:${step}`).toBeGreaterThan(0);
      }
    }
  });

  it("is pure — repeated calls for the same position deep-equal", () => {
    const a = getWorld({ chapter: "techdoc", step: 2 });
    const b = getWorld({ chapter: "techdoc", step: 2 });
    expect(a).toEqual(b);
  });

  it("does not accumulate — reaching a step directly equals reaching it in sequence", () => {
    const direct = getWorld({ chapter: "techdoc", step: 2 });
    getWorld({ chapter: "techdoc", step: 0 });
    getWorld({ chapter: "techdoc", step: 1 });
    const sequential = getWorld({ chapter: "techdoc", step: 2 });
    expect(sequential).toEqual(direct);
  });

  it("returns callers a copy they cannot use to corrupt later reads", () => {
    const world = getWorld({ chapter: "techdoc", step: 0 });
    world.agents.pop();
    expect(getWorld({ chapter: "techdoc", step: 0 }).agents.length).toBeGreaterThan(0);
  });

  it("exposes the demo agent in every world", () => {
    const world = getWorld({ chapter: "techdoc", step: 0 });
    expect(world.agents.some((a) => a.id === DEMO_AGENT_ID)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/demo/fixtures/index.test.ts`
Expected: FAIL — cannot resolve `./index`

- [ ] **Step 3: Write minimal implementation**

Open `types/models/agent.ts`, `context.ts`, `item.ts` and `agent-session.ts` first, and fill every **required** field. If a required field is missing the build fails — that is the drift defence working, not an obstacle to route around. Do not cast to `any` or add `as unknown as Agent`.

```ts
// lib/demo/types.ts
import type { Agent } from "@/types/models/agent";
import type { AgentSession } from "@/types/models/agent-session";
import type { Context } from "@/types/models/context";
import type { Item } from "@/types/models/item";

/**
 * The complete scripted world at one tour step.
 *
 * Every field is fully specified at every step — never a delta over the
 * previous step. The Tour bubble lets a visitor jump straight to chapter 6,
 * and accumulated state would land them in an incoherent application.
 */
export interface DemoWorld {
  agents: Agent[];
  contexts: Context[];
  items: Item[];
  sessions: AgentSession[];
}
```

```ts
// lib/demo/fixtures/chapter-techdoc.ts
import type { DemoWorld } from "../types";

export const DEMO_AGENT_ID = "demo-agent-newton";
export const DEMO_AGENT_SLUG = "chat";

const AGENT = {
  id: DEMO_AGENT_ID,
  name: "Technical Documentation Assistant",
  // ...fill EVERY required field from types/models/agent.ts
} as const;

const CONTEXTS = [
  { id: "ctx-techdoc", name: "Technical documentation" /* ...required fields */ },
  { id: "ctx-vorschriften", name: "Standards & regulations" /* ...required fields */ },
] as const;

/**
 * Chapter 1 shows one continuous conversation, so its three steps share a
 * world. Later chapters vary theirs per step (e.g. ingestion, where the
 * pipeline must look empty before and populated after).
 */
const BASE: DemoWorld = {
  agents: [AGENT as unknown as DemoWorld["agents"][number]],
  contexts: CONTEXTS as unknown as DemoWorld["contexts"],
  items: [],
  sessions: [],
};

export function techdocWorld(_step: number): DemoWorld {
  return BASE;
}
```

> Replace the two `as unknown as` casts above once the real required fields are
> filled in — they exist only so this file parses before you have opened
> `types/models/`. A cast that survives into the committed code defeats the
> entire drift defence.

```ts
// lib/demo/fixtures/index.ts
import type { TourPosition } from "../tour";
import type { DemoWorld } from "../types";
import { DEMO_AGENT_ID, DEMO_AGENT_SLUG, techdocWorld } from "./chapter-techdoc";

export { DEMO_AGENT_ID, DEMO_AGENT_SLUG };

/** Deep clone so a caller mutating the returned world cannot poison later reads. */
function clone(world: DemoWorld): DemoWorld {
  return structuredClone(world);
}

export function getWorld(pos: TourPosition): DemoWorld {
  switch (pos.chapter) {
    case "techdoc":
      return clone(techdocWorld(pos.step));
    // Chapters 2-7 reuse chapter 1's world until their own plans land, so the
    // shell always has a coherent application behind every step.
    default:
      return clone(techdocWorld(0));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/demo/fixtures/index.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Verify types are real, not cast away**

Run: `npx tsc --noEmit`
Expected: no errors, and `grep -c "as unknown as" lib/demo/fixtures/chapter-techdoc.ts` returns `0`.

- [ ] **Step 6: Commit**

```bash
git add lib/demo/types.ts lib/demo/fixtures/
git commit -m "feat(demo): add step-addressable fixture worlds"
```

---

### Task 4: Demo Apollo link

**Files:**
- Create: `lib/demo/apollo-link.ts`
- Test: `lib/demo/apollo-link.test.ts`

**Interfaces:**
- Consumes: `DemoWorld` from `lib/demo/types.ts`
- Produces: `createDemoLink(getWorldForNow: () => DemoWorld): ApolloLink`

- [ ] **Step 1: Write the failing test**

```ts
// lib/demo/apollo-link.test.ts
import { ApolloLink, execute, gql, Observable } from "@apollo/client/core";
import { describe, expect, it } from "vitest";
import { createDemoLink } from "./apollo-link";
import type { DemoWorld } from "./types";

const WORLD = {
  agents: [{ id: "a1", name: "Demo agent" }],
  contexts: [{ id: "c1", name: "Docs" }],
  items: [],
  sessions: [],
} as unknown as DemoWorld;

function run(link: ApolloLink, query: ReturnType<typeof gql>): Promise<any> {
  return new Promise((resolve, reject) => {
    const obs = execute(link, { query }) as Observable<any>;
    obs.subscribe({ next: resolve, error: reject });
  });
}

describe("createDemoLink", () => {
  it("resolves a known operation from the world", async () => {
    const link = createDemoLink(() => WORLD);
    const result = await run(link, gql`query agents { agents { id name } }`);
    expect(result.data.agents).toHaveLength(1);
    expect(result.data.agents[0].id).toBe("a1");
  });

  it("reads the world lazily, so stepping the tour changes results", async () => {
    let world = WORLD;
    const link = createDemoLink(() => world);
    world = { ...WORLD, agents: [] } as unknown as DemoWorld;
    const result = await run(link, gql`query agents { agents { id } }`);
    expect(result.data.agents).toHaveLength(0);
  });

  it("returns empty data for an unmapped operation rather than throwing", async () => {
    const link = createDemoLink(() => WORLD);
    const result = await run(link, gql`query somethingUnmapped { widgets { id } }`);
    expect(result.data).toEqual({});
  });

  it("names the operation it could not map, to make gaps findable", async () => {
    const seen: string[] = [];
    const link = createDemoLink(() => WORLD, (name) => seen.push(name));
    await run(link, gql`query somethingUnmapped { widgets { id } }`);
    expect(seen).toEqual(["somethingUnmapped"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/demo/apollo-link.test.ts`
Expected: FAIL — cannot resolve `./apollo-link`

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/demo/apollo-link.ts
import { ApolloLink, Observable } from "@apollo/client/core";
import type { DemoWorld } from "./types";

type Resolver = (world: DemoWorld, variables: Record<string, unknown>) => unknown;

/**
 * Operation name -> resolver. Keys must match the operation names in the
 * product's own documents (e.g. `query agents { ... }`), because that is what
 * Apollo puts on operation.operationName.
 */
const RESOLVERS: Record<string, Resolver> = {
  agents: (world) => ({ agents: world.agents }),
  contexts: (world) => ({ contexts: world.contexts }),
  items: (world) => ({ items: world.items }),
  agent_sessions: (world) => ({ agent_sessions: world.sessions }),
};

/**
 * A terminating ApolloLink that answers from the current tour step's world.
 *
 * `getWorldForNow` is a thunk, not a value: the tour advances underneath a
 * long-lived Apollo client, and a captured world would freeze the demo at
 * whichever step happened to mount first.
 */
export function createDemoLink(
  getWorldForNow: () => DemoWorld,
  onUnmapped: (operationName: string) => void = (name) =>
    console.warn(`[demo] unmapped GraphQL operation: ${name}`),
): ApolloLink {
  return new ApolloLink((operation) => {
    return new Observable((observer) => {
      const resolver = RESOLVERS[operation.operationName];
      if (!resolver) {
        onUnmapped(operation.operationName);
        observer.next({ data: {} });
        observer.complete();
        return;
      }
      observer.next({
        data: resolver(getWorldForNow(), operation.variables ?? {}),
      });
      observer.complete();
    });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/demo/apollo-link.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/demo/apollo-link.ts lib/demo/apollo-link.test.ts
git commit -m "feat(demo): add fixture-backed Apollo link"
```

---

### Task 5: Scripted chat turns → UI message chunks

**Files:**
- Create: `lib/demo/script.ts`
- Test: `lib/demo/script.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `interface ScriptedToolCall { toolCallId: string; toolName: string; input: unknown; output: unknown }`
  - `interface ScriptedTurn { id: string; toolCalls: ScriptedToolCall[]; text: string; sources: ScriptedSource[] }`
  - `interface ScriptedSource { sourceId: string; url: string; title: string }`
  - `buildChunks(turn: ScriptedTurn): UIMessageChunk[]`

Chunk shapes are taken verbatim from the installed `ai@6.0.49` `UIMessageChunk`
union (`node_modules/ai/dist/index.d.ts:1768`). Do not invent field names.

- [ ] **Step 1: Write the failing test**

```ts
// lib/demo/script.test.ts
import { describe, expect, it } from "vitest";
import { buildChunks, type ScriptedTurn } from "./script";

const TURN: ScriptedTurn = {
  id: "m1",
  toolCalls: [
    {
      toolCallId: "tc1",
      toolName: "searchContexts",
      input: { query: "door contact fault" },
      output: { chunks: 7 },
    },
  ],
  text: "Check the door contact chain.",
  sources: [{ sourceId: "s1", url: "https://example.test/manual.pdf", title: "Manual" }],
};

describe("buildChunks", () => {
  it("emits the tool call before any assistant text", () => {
    const types = buildChunks(TURN).map((c) => c.type);
    expect(types.indexOf("tool-input-available")).toBeLessThan(types.indexOf("text-start"));
  });

  it("pairs every tool input with its output", () => {
    const chunks = buildChunks(TURN);
    expect(chunks.filter((c) => c.type === "tool-input-available")).toHaveLength(1);
    expect(chunks.filter((c) => c.type === "tool-output-available")).toHaveLength(1);
  });

  it("brackets text deltas with text-start and text-end", () => {
    const types = buildChunks(TURN).map((c) => c.type);
    expect(types.indexOf("text-start")).toBeLessThan(types.indexOf("text-delta"));
    expect(types.lastIndexOf("text-delta")).toBeLessThan(types.indexOf("text-end"));
  });

  it("reassembles to exactly the scripted text", () => {
    const text = buildChunks(TURN)
      .filter((c): c is Extract<typeof c, { type: "text-delta" }> => c.type === "text-delta")
      .map((c) => c.delta)
      .join("");
    expect(text).toBe(TURN.text);
  });

  it("uses one consistent id for the whole text block", () => {
    const ids = new Set(
      buildChunks(TURN)
        .filter((c) => c.type.startsWith("text-"))
        .map((c) => (c as { id: string }).id),
    );
    expect(ids).toEqual(new Set(["m1"]));
  });

  it("emits sources after the text ends", () => {
    const types = buildChunks(TURN).map((c) => c.type);
    expect(types.indexOf("text-end")).toBeLessThan(types.indexOf("source-url"));
  });

  it("handles a turn with no tool calls and no sources", () => {
    const chunks = buildChunks({ id: "m2", toolCalls: [], text: "Hi", sources: [] });
    expect(chunks.map((c) => c.type)).toEqual(["text-start", "text-delta", "text-end"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/demo/script.test.ts`
Expected: FAIL — cannot resolve `./script`

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/demo/script.ts
import type { UIMessageChunk } from "ai";

export interface ScriptedToolCall {
  toolCallId: string;
  toolName: string;
  input: unknown;
  output: unknown;
}

export interface ScriptedSource {
  sourceId: string;
  url: string;
  title: string;
}

export interface ScriptedTurn {
  /** Also used as the text-block id, so all text chunks correlate. */
  id: string;
  toolCalls: ScriptedToolCall[];
  text: string;
  sources: ScriptedSource[];
}

/** One delta per word, keeping the trailing space so deltas rejoin exactly. */
function splitIntoDeltas(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [];
}

/**
 * Order matters: tool calls resolve before the assistant speaks, and sources
 * land after the text. That is the sequence the product's own renderer
 * expects, and the sequence that makes retrieval legible on screen.
 */
export function buildChunks(turn: ScriptedTurn): UIMessageChunk[] {
  const chunks: UIMessageChunk[] = [];

  for (const call of turn.toolCalls) {
    chunks.push({
      type: "tool-input-available",
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      input: call.input,
    });
    chunks.push({
      type: "tool-output-available",
      toolCallId: call.toolCallId,
      output: call.output,
    });
  }

  chunks.push({ type: "text-start", id: turn.id });
  for (const delta of splitIntoDeltas(turn.text)) {
    chunks.push({ type: "text-delta", id: turn.id, delta });
  }
  chunks.push({ type: "text-end", id: turn.id });

  for (const source of turn.sources) {
    chunks.push({
      type: "source-url",
      sourceId: source.sourceId,
      url: source.url,
      title: source.title,
    });
  }

  return chunks;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/demo/script.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/demo/script.ts lib/demo/script.test.ts
git commit -m "feat(demo): build UI message chunks from scripted turns"
```

---

### Task 6: Demo chat transport

**Files:**
- Create: `lib/demo/chat-transport.ts`
- Test: `lib/demo/chat-transport.test.ts`

**Interfaces:**
- Consumes: `buildChunks`, `ScriptedTurn` from `lib/demo/script.ts`
- Produces: `class DemoChatTransport implements ChatTransport<UIMessage>`, constructed as
  `new DemoChatTransport({ turns: ScriptedTurn[]; delayMs?: number; sleep?: (ms: number) => Promise<void> })`

- [ ] **Step 1: Write the failing test**

Injecting `sleep` keeps the test instant and deterministic — never make a test
wait on real timers.

```ts
// lib/demo/chat-transport.test.ts
import { describe, expect, it, vi } from "vitest";
import { DemoChatTransport } from "./chat-transport";
import type { ScriptedTurn } from "./script";

const TURNS: ScriptedTurn[] = [
  { id: "m1", toolCalls: [], text: "First answer.", sources: [] },
  { id: "m2", toolCalls: [], text: "Second answer.", sources: [] },
];

async function drain(stream: ReadableStream<any>) {
  const out: any[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.push(value);
  }
  return out;
}

const noSleep = () => Promise.resolve();

describe("DemoChatTransport", () => {
  it("streams the first scripted turn", async () => {
    const t = new DemoChatTransport({ turns: TURNS, sleep: noSleep });
    const chunks = await drain(await t.sendMessages({} as any));
    const text = chunks.filter((c) => c.type === "text-delta").map((c) => c.delta).join("");
    expect(text).toBe("First answer.");
  });

  it("advances to the next turn on the next send", async () => {
    const t = new DemoChatTransport({ turns: TURNS, sleep: noSleep });
    await drain(await t.sendMessages({} as any));
    const chunks = await drain(await t.sendMessages({} as any));
    const text = chunks.filter((c) => c.type === "text-delta").map((c) => c.delta).join("");
    expect(text).toBe("Second answer.");
  });

  it("replays the last turn once the script runs out", async () => {
    const t = new DemoChatTransport({ turns: TURNS, sleep: noSleep });
    await drain(await t.sendMessages({} as any));
    await drain(await t.sendMessages({} as any));
    const chunks = await drain(await t.sendMessages({} as any));
    const text = chunks.filter((c) => c.type === "text-delta").map((c) => c.delta).join("");
    expect(text).toBe("Second answer.");
  });

  it("paces the stream between chunks", async () => {
    const sleep = vi.fn(() => Promise.resolve());
    const t = new DemoChatTransport({ turns: TURNS, delayMs: 25, sleep });
    await drain(await t.sendMessages({} as any));
    expect(sleep).toHaveBeenCalledWith(25);
  });

  it("stops streaming when aborted", async () => {
    const controller = new AbortController();
    const t = new DemoChatTransport({
      turns: TURNS,
      sleep: () => {
        controller.abort();
        return Promise.resolve();
      },
    });
    const chunks = await drain(await t.sendMessages({ abortSignal: controller.signal } as any));
    expect(chunks.length).toBeLessThan(5);
  });

  it("has no stream to reconnect to", async () => {
    const t = new DemoChatTransport({ turns: TURNS, sleep: noSleep });
    await expect(t.reconnectToStream({ chatId: "x" } as any)).resolves.toBeNull();
  });

  it("refuses an empty script rather than streaming nothing", () => {
    expect(() => new DemoChatTransport({ turns: [] })).toThrow(/at least one turn/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/demo/chat-transport.test.ts`
Expected: FAIL — cannot resolve `./chat-transport`

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/demo/chat-transport.ts
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import { buildChunks, type ScriptedTurn } from "./script";

interface DemoChatTransportOptions {
  turns: ScriptedTurn[];
  /** Pause between chunks, in ms. Tuned for realism, not speed. */
  delayMs?: number;
  /** Injected so tests run instantly and deterministically. */
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Replays a fixed script in place of DefaultChatTransport.
 *
 * The visitor's typed text is ignored by design: the tour is scripted, and the
 * composer exists to make retrieval feel live, not to accept free input.
 */
export class DemoChatTransport implements ChatTransport<UIMessage> {
  private readonly turns: ScriptedTurn[];
  private readonly delayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private cursor = 0;

  constructor({ turns, delayMs = 18, sleep = realSleep }: DemoChatTransportOptions) {
    if (turns.length === 0) {
      throw new Error("DemoChatTransport needs at least one turn to replay.");
    }
    this.turns = turns;
    this.delayMs = delayMs;
    this.sleep = sleep;
  }

  sendMessages = async (
    options: { abortSignal?: AbortSignal } & Record<string, unknown>,
  ): Promise<ReadableStream<UIMessageChunk>> => {
    // Clamp rather than wrap: re-answering the first question after the script
    // ends would read as a glitch, whereas repeating the last answer reads as
    // the tour simply being over.
    const turn = this.turns[Math.min(this.cursor, this.turns.length - 1)];
    this.cursor += 1;

    const chunks = buildChunks(turn);
    const { sleep, delayMs } = this;
    const signal = options?.abortSignal;

    return new ReadableStream<UIMessageChunk>({
      async start(controller) {
        for (const chunk of chunks) {
          if (signal?.aborted) break;
          controller.enqueue(chunk);
          await sleep(delayMs);
        }
        controller.close();
      },
    });
  };

  reconnectToStream = async (): Promise<ReadableStream<UIMessageChunk> | null> => null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/demo/chat-transport.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Run the whole demo suite together**

Run: `npx vitest run lib/demo`
Expected: PASS — all tests from Tasks 1-6

- [ ] **Step 6: Commit**

```bash
git add lib/demo/chat-transport.ts lib/demo/chat-transport.test.ts
git commit -m "feat(demo): add scripted chat transport"
```

---

### Task 7: Wire the seams and bypass the server-side gates

**Files:**
- Create: `lib/demo/current-position.ts`
- Test: `lib/demo/current-position.test.ts`
- Modify: `app/(application)/authenticated.tsx:147` (Apollo link composition)
- Modify: `app/(application)/chat/hooks.ts:386` (chat transport)
- Modify: `app/(application)/layout.tsx:40,45,48,91` (server-side calls)
- Create: `components/demo/tour-provider.tsx`

**Interfaces:**
- Consumes: `isDemoMode`, `CHAPTERS`, `TourPosition`, `nextPosition`, `prevPosition`, `resolveStep`, `startOfChapter`, `getWorld`, `createDemoLink`, `DemoChatTransport`, `TECHDOC_TURNS`
- Produces:
  - `getCurrentPosition(): TourPosition` and `setCurrentPosition(pos: TourPosition): void` from `lib/demo/current-position.ts`
  - `turnsFor(chapter: DemoChapterId): ScriptedTurn[]` from `lib/demo/current-position.ts`
  - `useTour(): { position, step, chapters, next, prev, jumpTo, world }` from `components/demo/tour-provider.tsx`

Apollo and `useChat` are both constructed outside React's render tree and
outlive any single tour step, so neither can read position from context. A
module-level cell that `TourProvider` keeps current is the seam both can reach.
It is also a pure module, so it gets real tests.

Beyond that cell this task is React wiring, which the repo's node-only runner
cannot render. Verification is the dev server plus a production build. Do not
add `@testing-library/react` to make it testable.

- [ ] **Step 1: Write the failing test for the position cell**

```ts
// lib/demo/current-position.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { getCurrentPosition, setCurrentPosition, turnsFor } from "./current-position";

describe("current position cell", () => {
  beforeEach(() => setCurrentPosition({ chapter: "techdoc", step: 0 }));

  it("defaults to the start of chapter one", () => {
    expect(getCurrentPosition()).toEqual({ chapter: "techdoc", step: 0 });
  });

  it("reflects the most recent write", () => {
    setCurrentPosition({ chapter: "evals", step: 2 });
    expect(getCurrentPosition()).toEqual({ chapter: "evals", step: 2 });
  });
});

describe("turnsFor", () => {
  it("returns the techdoc script for chapter one", () => {
    expect(turnsFor("techdoc").length).toBeGreaterThan(0);
  });

  it("never returns an empty script, since DemoChatTransport rejects one", () => {
    for (const chapter of ["ingestion", "config", "memory", "evals", "email", "meetings"] as const) {
      expect(turnsFor(chapter).length, chapter).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/demo/current-position.test.ts`
Expected: FAIL — cannot resolve `./current-position`

- [ ] **Step 3: Implement the position cell and Chapter 1's script**

First append the scripted turns to `lib/demo/fixtures/chapter-techdoc.ts`. The
copy is placeholder: the real exchange is blocked on Newlift's content approval
(see the spec's Risks section), and swapping it later is a content edit, not a
code change.

```ts
// lib/demo/fixtures/chapter-techdoc.ts (append)
import type { ScriptedTurn } from "../script";

export const TECHDOC_TURNS: ScriptedTurn[] = [
  {
    id: "techdoc-turn-1",
    toolCalls: [
      {
        toolCallId: "tc-search-1",
        toolName: "searchContexts",
        input: { query: "door contact chain fault", contexts: ["ctx-techdoc", "ctx-vorschriften"] },
        output: { passages: 7, contexts: ["ctx-techdoc"] },
      },
    ],
    text: "PLACEHOLDER pending Newlift approval — replace with the real production exchange.",
    sources: [
      { sourceId: "src-1", url: "https://example.test/techdoc.pdf", title: "Controller manual, §4.2" },
    ],
  },
];
```

Then the cell itself:

```ts
// lib/demo/current-position.ts
import { TECHDOC_TURNS } from "./fixtures/chapter-techdoc";
import type { ScriptedTurn } from "./script";
import type { DemoChapterId, TourPosition } from "./tour";

let current: TourPosition = { chapter: "techdoc", step: 0 };

export function getCurrentPosition(): TourPosition {
  return current;
}

export function setCurrentPosition(pos: TourPosition): void {
  current = pos;
}

/**
 * Chapters without their own script yet fall back to the techdoc turns, so the
 * chat surface always has something to replay — DemoChatTransport throws on an
 * empty script by design.
 */
export function turnsFor(chapter: DemoChapterId): ScriptedTurn[] {
  switch (chapter) {
    case "techdoc":
    default:
      return TECHDOC_TURNS;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/demo/current-position.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Create the tour provider**

```tsx
// components/demo/tour-provider.tsx
"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { getWorld } from "@/lib/demo/fixtures";
import {
  CHAPTERS,
  type DemoChapterId,
  type TourPosition,
  nextPosition,
  prevPosition,
  resolveStep,
  startOfChapter,
} from "@/lib/demo/tour";

const TourContext = createContext<ReturnType<typeof useTourState> | null>(null);

function useTourState() {
  const [position, setPosition] = useState<TourPosition>({ chapter: "techdoc", step: 0 });

  const next = useCallback(() => {
    setPosition((p) => nextPosition(CHAPTERS, p) ?? p);
  }, []);
  const prev = useCallback(() => {
    setPosition((p) => prevPosition(CHAPTERS, p) ?? p);
  }, []);
  const jumpTo = useCallback((chapter: DemoChapterId) => {
    setPosition(startOfChapter(chapter));
  }, []);

  // Publish to the module cell so Apollo and useChat — both constructed
  // outside this tree — see the current step. Synchronous, not an effect: the
  // link may be asked to resolve before effects flush.
  setCurrentPosition(position);

  const step = useMemo(() => resolveStep(CHAPTERS, position), [position]);
  const world = useMemo(() => getWorld(position), [position]);

  return { position, step, chapters: CHAPTERS, next, prev, jumpTo, world };
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const value = useTourState();
  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used inside <TourProvider>");
  return ctx;
}
```

- [ ] **Step 6: Swap the Apollo terminating link**

In `app/(application)/authenticated.tsx`, find the composition at line 147:

```ts
const link = ApolloLink.from([basic, authLink, new HttpLink({ uri: uri })]);
```

Replace with:

```ts
const terminating = isDemoMode()
  ? createDemoLink(() => getWorld(getCurrentPosition()))
  : new HttpLink({ uri: uri });
const link = ApolloLink.from([basic, authLink, terminating]);
```

The thunk is read on every operation, so the link follows the tour. Passing
`getWorld(getCurrentPosition())` eagerly instead would freeze the demo at
whichever step mounted first — that is exactly what `createDemoLink`'s thunk
parameter exists to prevent.

Note the memo on line 166 keys on `[uri]`. Do not add the position to its
dependencies: the client must be built once, and freshness comes from the thunk.

- [ ] **Step 7: Swap the chat transport**

In `app/(application)/chat/hooks.ts` at line 386, replace the
`transport: new DefaultChatTransport({...})` value with a conditional:

```ts
transport: isDemoMode()
  ? new DemoChatTransport({ turns: turnsFor(getCurrentPosition().chapter) })
  : new DefaultChatTransport({ /* ...existing config unchanged, verbatim... */ }),
```

Leave the entire existing `DefaultChatTransport` configuration untouched in the
other branch — it carries auth and session plumbing the real product needs.

- [ ] **Step 8: Bypass the three server-side calls**

In `app/(application)/layout.tsx`, guard each with `isDemoMode()`:

- line 40 `serverSideAuthCheck()` — in demo mode, use a synthetic user object instead of redirecting to `/login`
- line 45 external-user redirect — skip entirely in demo mode
- line 48 `configApi.backend()` — return a static config object
- line 91 `configApi.theme()` — return `{ light: {}, dark: {} }`

- [ ] **Step 9: Verify in the browser**

Run: `NEXT_PUBLIC_DEMO_MODE=true npm run dev`
Then open `http://localhost:3000/demo/tour`.
Expected: the application shell renders with fixture data and **no network requests to a backend** (confirm in the Network tab). No redirect to `/login`.

- [ ] **Step 10: Verify the flag fails closed**

Run: `npm run dev` (without the flag)
Expected: `/demo/tour` returns 404; normal auth redirect behaviour on the rest of the app is unchanged.

- [ ] **Step 11: Verify the production build**

Run: `npm run lint && npx tsc --noEmit && npm run test && npm run build`
Expected: all pass.

- [ ] **Step 12: Commit**

```bash
git add lib/demo/current-position.ts lib/demo/current-position.test.ts components/demo/tour-provider.tsx "app/(application)/authenticated.tsx" "app/(application)/chat/hooks.ts" "app/(application)/layout.tsx"
git commit -m "feat(demo): wire demo link, transport and layout bypasses"
```

---

### Task 8: Tour bubble, spotlight, and the demo route

**Files:**
- Create: `components/demo/tour-bubble.tsx`, `components/demo/spotlight.tsx`, `app/demo/tour/page.tsx`, `app/demo/layout.tsx`

**Interfaces:**
- Consumes: `useTour()` from `components/demo/tour-provider.tsx`; `isDemoMode` from `lib/demo/flag.ts`
- Produces: the mounted demo surface at `/demo/tour`; `data-demo-id` anchors on product components

- [ ] **Step 1: Build the spotlight overlay**

```tsx
// components/demo/spotlight.tsx
"use client";

import { useEffect, useState } from "react";

/**
 * Positions a highlight over the element carrying data-demo-id={anchor}.
 * Renders nothing when the anchor is absent, so a step whose target has not
 * mounted yet degrades to an un-spotlit step rather than a crash.
 */
export function Spotlight({ anchor }: { anchor: string | null }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!anchor) {
      setRect(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector(`[data-demo-id="${anchor}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [anchor]);

  if (!rect) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-50 rounded-lg ring-4 ring-primary transition-all"
      style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }}
    />
  );
}
```

- [ ] **Step 2: Build the tour bubble**

```tsx
// components/demo/tour-bubble.tsx
"use client";

import { useState } from "react";
import { useTour } from "./tour-provider";

export function TourBubble() {
  const { chapters, position, step, next, prev, jumpTo } = useTour();
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 rounded-xl border bg-background p-4 shadow-lg">
      <button className="text-sm font-medium" onClick={() => setOpen((o) => !o)}>
        Tour {open ? "▾" : "▸"}
      </button>

      {open && (
        <ul className="mt-3 space-y-1">
          {chapters.map((c, i) => (
            <li key={c.id}>
              <button
                className={c.id === position.chapter ? "font-semibold" : "opacity-70"}
                onClick={() => {
                  jumpTo(c.id);
                  setOpen(false);
                }}
              >
                {i + 1}. {c.title}
              </button>
            </li>
          ))}
        </ul>
      )}

      {step && (
        <div className="mt-3">
          <p className="font-medium">{step.title}</p>
          <p className="mt-1 text-sm opacity-80">{step.body}</p>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button onClick={prev}>Back</button>
        <button onClick={next}>Next</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add `data-demo-id` anchors**

Add `data-demo-id="chat-composer"`, `data-demo-id="chat-tool-trace"` and
`data-demo-id="chat-sources"` to the corresponding product components. These are
the only edits the demo makes to product code — keep them to a bare attribute,
with no demo-specific logic or imports in product files.

- [ ] **Step 4: Create the tour route**

```tsx
// app/demo/layout.tsx
import { notFound } from "next/navigation";
import { TourProvider } from "@/components/demo/tour-provider";
import { isDemoMode } from "@/lib/demo/flag";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  // Fail closed: a customer deployment that ships this route group must not
  // serve it.
  if (!isDemoMode()) notFound();
  return <TourProvider>{children}</TourProvider>;
}
```

- [ ] **Step 5: Verify the full chapter end to end**

Run: `NEXT_PUBLIC_DEMO_MODE=true npm run dev`, open `/demo/tour`.
Expected:
- the bubble shows all seven chapters and highlights the current one
- Next advances through Chapter 1's three steps, and the spotlight moves
- the chat replays the scripted turn: tool call renders first, then text streams, then the source appears
- jumping to chapter 5 and back to chapter 1 leaves a coherent screen (this is the fixture-purity requirement working)

- [ ] **Step 6: Verify build and full test suite**

Run: `npm run lint && npx tsc --noEmit && npm run test && npm run build`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add components/demo/ app/demo/
git commit -m "feat(demo): add tour bubble, spotlight and chapter 1 script"
```

---

## Follow-on plans

This plan delivers the foundation plus one working chapter. Chapters 2–7 are
repeated applications of the pattern it establishes — a fixture module, a step
list, and (where the chapter is chat-based) a scripted turn set — so each gets
its own plan once the vertical slice is proven:

| Plan | Chapters | Note |
| --- | --- | --- |
| 2 | 3 (config wizard), 4 (memory) | Cheapest; ride on machinery built here |
| 3 | 2 (ingestion), 7 (meetings/voice) | New fixture surfaces, no new mechanism |
| 4 | 6 (email routine) | Needs `tool-approval-request` chunk for the approval pause |
| 5 | 5 (evals) | Heaviest; results matrix is the priority artifact |

The lead-capture gate (`app/demo/page.tsx` → HubSpot) is deliberately deferred:
it gates access to the tour, so it is worth building once the tour is worth
gating, and it needs the HubSpot form identifier that is still an open item in
the spec.
