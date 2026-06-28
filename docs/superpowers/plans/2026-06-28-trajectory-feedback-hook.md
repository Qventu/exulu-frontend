# Trajectory Feedback Hook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Forward the platform's existing thumbs feedback to the agentic-retrieval harness so a 👍 marks the trajectory that fetched the answer's data replay-eligible (and a 👎 lets the feedback-agent prune/rewrite it).

**Architecture:** Frontend-only. A pure finder locates the closest trajectory ref from message history; the existing `FeedbackDialog` posts to the harness route on submit, best-effort, via the repo's shared authenticated `request()` helper. No changes to the harness, backend, or `newlkiag`.

**Tech Stack:** Next.js + React (TypeScript), Vitest 4 (`vitest run`), AI SDK (`UIMessage` from `ai`), existing `lib/api/client.ts` `request()` helper, Apollo `useMutation` (existing feedback path, untouched).

**Design spec:** `/Users/daniel.claessen/Desktop/Projects/newlkiag/docs/superpowers/specs/2026-06-28-trajectory-feedback-hook-design.md` (the harness side; this plan is the frontend implementation that closes that loop).

## Global Constraints

- **Frontend-only.** Do NOT modify `newlkiag` (harness, routes, `exulu.ts`). The route `POST /retrieval/trajectories/:ref/feedback` with body `{ positive: boolean, message?: string }` already exists and is mounted at the agent backend's origin root.
- **Name-agnostic detection.** Never match on the tool name `knowledge_search`. Detect a trajectory by the presence of a string `trajectoryId` in a message part's `output`. (The tool may be renamed / moved into the library.)
- **Positive = bare fast-path.** A 👍 sends `{ positive: true }` with NO `message`, hitting the harness fast-path that marks the trajectory positive without an LLM call — so a good rating can never delete/rewrite a strategy. The free-text note goes only to the existing GraphQL feedback.
- **Closest-trajectory, unbounded walk.** Walk backward from the rated message through the entire history (across user messages); return the first trajectoryId found; if a message made several retrieval calls, the latest one within that message wins.
- **Best-effort.** A failed trajectory POST must never block or fail the existing GraphQL feedback or its success toast. Swallow errors (dev-only `console.warn`).
- **Reuse `request()`.** Use the shared authenticated helper in `lib/api/client.ts` (`request(path, method, body?)` — handles base URL, `Bearer` token, JSON, throws on non-2xx). Do not hand-roll `fetch`/token/ConfigContext plumbing.
- **Test convention.** Vitest, colocated `*.test.ts`, pure-function unit tests (`import { describe, test, expect } from "vitest"`). The repo has no React component tests; do not introduce React Testing Library.
- **Commits.** Conventional Commits (commitlint `config-conventional`, enforced by husky `commit-msg`): `feat(chat): …`, `docs: …`.

---

### Task 1: Trajectory feedback API client

**Files:**
- Create: `lib/api/trajectory-feedback.ts`
- Test: `lib/api/trajectory-feedback.test.ts`

**Interfaces:**
- Consumes: `request` from `lib/api/client.ts` — `request(path: string, method: string, body?: object) => Promise<any>`.
- Produces:
  - `interface TrajectoryFeedbackBody { positive: boolean; message?: string }`
  - `trajectoryFeedbackPath(ref: string): string`
  - `buildTrajectoryFeedbackBody(score: 0 | 1, message: string): TrajectoryFeedbackBody`
  - `postTrajectoryFeedback(ref: string, body: TrajectoryFeedbackBody): Promise<unknown>`

- [ ] **Step 1: Write the failing test**

Create `lib/api/trajectory-feedback.test.ts`:

```ts
import { describe, test, expect } from "vitest";
import {
  trajectoryFeedbackPath,
  buildTrajectoryFeedbackBody,
} from "./trajectory-feedback";

describe("trajectoryFeedbackPath", () => {
  test("encodes the :: ref into the harness route path", () => {
    expect(
      trajectoryFeedbackPath("newton::550e8400-e29b-41d4-a716-446655440000"),
    ).toBe(
      "/retrieval/trajectories/newton%3A%3A550e8400-e29b-41d4-a716-446655440000/feedback",
    );
  });
});

describe("buildTrajectoryFeedbackBody", () => {
  test("positive → bare { positive: true } (fast-path, no message)", () => {
    expect(buildTrajectoryFeedbackBody(1, "great answer")).toEqual({
      positive: true,
    });
  });
  test("negative → { positive: false, message }", () => {
    expect(buildTrajectoryFeedbackBody(0, "wrong doc")).toEqual({
      positive: false,
      message: "wrong doc",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/api/trajectory-feedback.test.ts`
Expected: FAIL — cannot resolve `./trajectory-feedback` (module/exports not found).

- [ ] **Step 3: Write minimal implementation**

Create `lib/api/trajectory-feedback.ts`:

```ts
import { request } from "@/lib/api/client";

/** Body accepted by `POST /retrieval/trajectories/:ref/feedback` (harness route). */
export interface TrajectoryFeedbackBody {
  positive: boolean;
  message?: string;
}

/**
 * Builds the harness feedback route path for a trajectory ref.
 * The ref is `<agentId>::<uuid>`; `encodeURIComponent` keeps it intact through the single
 * Express `:ref` param (Express auto-decodes), so `::` survives as `%3A%3A`.
 */
export const trajectoryFeedbackPath = (ref: string): string =>
  `/retrieval/trajectories/${encodeURIComponent(ref)}/feedback`;

/**
 * Maps a thumbs score to the route body.
 * - positive (1) → bare `{ positive: true }`: harness fast-path, marks the trajectory
 *   replay-eligible with NO LLM call, so a good rating can never delete/rewrite a strategy.
 * - negative (0) → `{ positive: false, message }`: routed to the feedback-agent to prune/rewrite.
 */
export const buildTrajectoryFeedbackBody = (
  score: 0 | 1,
  message: string,
): TrajectoryFeedbackBody =>
  score === 1 ? { positive: true } : { positive: false, message };

/** POSTs trajectory feedback via the shared authenticated `request` helper. Throws on non-2xx. */
export const postTrajectoryFeedback = (
  ref: string,
  body: TrajectoryFeedbackBody,
): Promise<unknown> => request(trajectoryFeedbackPath(ref), "POST", body);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/api/trajectory-feedback.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/api/trajectory-feedback.ts lib/api/trajectory-feedback.test.ts
git commit -m "feat(chat): add trajectory feedback api client"
```

---

### Task 2: Closest-trajectory finder

**Files:**
- Create: `app/(application)/chat/components/trajectory-ref.ts`
- Test: `app/(application)/chat/components/trajectory-ref.test.ts`

**Interfaces:**
- Consumes: `UIMessage` from `ai` (the chat controller's message type).
- Produces:
  - `trajectoryIdFromPart(part: unknown): string | null`
  - `findTrajectoryRefForFeedback(messages: UIMessage[] | undefined, ratedMessageId: string): string | null`

- [ ] **Step 1: Write the failing test**

Create `app/(application)/chat/components/trajectory-ref.test.ts`:

```ts
import { describe, test, expect } from "vitest";
import type { UIMessage } from "ai";
import {
  findTrajectoryRefForFeedback,
  trajectoryIdFromPart,
} from "./trajectory-ref";

// Minimal factories — only the fields the finder reads.
const ksPart = (trajectoryId: string | null) => ({
  type: "tool-knowledge_search",
  output: {
    result: JSON.stringify({
      chunks: [],
      ...(trajectoryId ? { trajectoryId } : {}),
    }),
  },
});
const textPart = (text: string) => ({ type: "text", text });
const msg = (id: string, role: "user" | "assistant", parts: unknown[]) =>
  ({ id, role, parts }) as unknown as UIMessage;

describe("trajectoryIdFromPart", () => {
  test("reads trajectoryId from a wrapped { result: json } output", () => {
    expect(trajectoryIdFromPart(ksPart("newton::abc"))).toBe("newton::abc");
  });
  test("reads trajectoryId present directly on output (future shape)", () => {
    expect(
      trajectoryIdFromPart({ output: { trajectoryId: "newton::xyz" } }),
    ).toBe("newton::xyz");
  });
  test("name-agnostic: any tool part whose output carries trajectoryId", () => {
    expect(
      trajectoryIdFromPart({
        type: "tool-something_else",
        output: { result: JSON.stringify({ trajectoryId: "a::b" }) },
      }),
    ).toBe("a::b");
  });
  test("null for malformed JSON, missing field, or no output", () => {
    expect(trajectoryIdFromPart({ output: { result: "{not json" } })).toBeNull();
    expect(
      trajectoryIdFromPart({ output: { result: JSON.stringify({ chunks: [] }) } }),
    ).toBeNull();
    expect(trajectoryIdFromPart(textPart("hi"))).toBeNull();
    expect(trajectoryIdFromPart(undefined)).toBeNull();
  });
});

describe("findTrajectoryRefForFeedback", () => {
  test("one retrieval part in the rated message", () => {
    const messages = [
      msg("u1", "user", [textPart("q")]),
      msg("a1", "assistant", [ksPart("T1"), textPart("ans")]),
    ];
    expect(findTrajectoryRefForFeedback(messages, "a1")).toBe("T1");
  });
  test("two retrieval parts → latest within the message", () => {
    const messages = [
      msg("a1", "assistant", [ksPart("T1"), ksPart("T2"), textPart("ans")]),
    ];
    expect(findTrajectoryRefForFeedback(messages, "a1")).toBe("T2");
  });
  test("rated text-only message → walks back to a prior assistant retrieval", () => {
    const messages = [
      msg("a1", "assistant", [ksPart("T1")]),
      msg("a2", "assistant", [textPart("ans")]),
    ];
    expect(findTrajectoryRefForFeedback(messages, "a2")).toBe("T1");
  });
  test("unbounded walk: crosses an intervening user message (late feedback)", () => {
    const messages = [
      msg("u1", "user", [textPart("q1")]),
      msg("a1", "assistant", [ksPart("T1"), textPart("ans1")]),
      msg("u2", "user", [textPart("q2 follow-up")]),
      msg("a2", "assistant", [textPart("ans2, no retrieval")]),
    ];
    expect(findTrajectoryRefForFeedback(messages, "a2")).toBe("T1");
  });
  test("no trajectory anywhere → null", () => {
    const messages = [
      msg("u1", "user", [textPart("q")]),
      msg("a1", "assistant", [textPart("ans")]),
    ];
    expect(findTrajectoryRefForFeedback(messages, "a1")).toBeNull();
  });
  test("unknown id / undefined messages → null", () => {
    expect(
      findTrajectoryRefForFeedback(
        [msg("a1", "assistant", [ksPart("T1")])],
        "nope",
      ),
    ).toBeNull();
    expect(findTrajectoryRefForFeedback(undefined, "a1")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(application)/chat/components/trajectory-ref.test.ts"`
Expected: FAIL — cannot resolve `./trajectory-ref`.

- [ ] **Step 3: Write minimal implementation**

Create `app/(application)/chat/components/trajectory-ref.ts`:

```ts
import type { UIMessage } from "ai";

/**
 * Extracts a harness trajectory ref from a single message part, or null.
 *
 * Name-agnostic by design: does NOT match on the tool name (`knowledge_search`), since the
 * retrieval tool may be renamed or moved into the library. Reads any part's `output` (covering
 * `tool-*` and `dynamic-tool` shapes). The harness wraps its payload as `{ result: "<json>" }`;
 * parse that, falling back to treating `output` itself as the payload, then read `trajectoryId`.
 */
export function trajectoryIdFromPart(part: unknown): string | null {
  const output = (part as { output?: unknown } | null | undefined)?.output;
  if (!output || typeof output !== "object") return null;
  let payload: { trajectoryId?: unknown } = output as {
    trajectoryId?: unknown;
  };
  const result = (output as { result?: unknown }).result;
  if (typeof result === "string") {
    try {
      payload = JSON.parse(result);
    } catch {
      return null;
    }
  }
  const id = payload?.trajectoryId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * Finds the trajectory ref that fetched the data for a rated answer.
 *
 * Walks backward from the rated message through the whole history (across user messages — late
 * feedback after follow-ups is still valid for the trajectory used in an earlier turn). Returns the
 * first trajectoryId found (closest / most recent); if a single message made several retrieval
 * calls, the latest one within that message wins. Returns null when no part at-or-before the rated
 * message carries a trajectoryId.
 */
export function findTrajectoryRefForFeedback(
  messages: UIMessage[] | undefined,
  ratedMessageId: string,
): string | null {
  if (!messages) return null;
  const idx = messages.findIndex((m) => m.id === ratedMessageId);
  if (idx < 0) return null;
  for (let i = idx; i >= 0; i--) {
    let lastInMessage: string | null = null;
    for (const part of messages[i]?.parts ?? []) {
      const id = trajectoryIdFromPart(part);
      if (id) lastInMessage = id;
    }
    if (lastInMessage) return lastInMessage;
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/(application)/chat/components/trajectory-ref.test.ts"`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add "app/(application)/chat/components/trajectory-ref.ts" "app/(application)/chat/components/trajectory-ref.test.ts"
git commit -m "feat(chat): add closest-trajectory finder for feedback"
```

---

### Task 3: Wire feedback into the trajectory store

**Files:**
- Modify: `app/(application)/chat/components/feedback-dialog.tsx` (the `FeedbackTarget` interface ~46-51, and `handleSubmit` ~129-158)
- Modify: `app/(application)/chat/components/message-column.tsx` (the `handleFeedback` callback ~178-191)

**Interfaces:**
- Consumes: `findTrajectoryRefForFeedback` (Task 2); `buildTrajectoryFeedbackBody`, `postTrajectoryFeedback` (Task 1).
- Produces: `FeedbackTarget` gains `trajectoryId: string | null`.

**Note on testing:** This task is wiring only — its testable logic lives in Tasks 1 & 2 (already unit-tested). The repo has no React component tests and we are not adding RTL (Global Constraints). The task gate is therefore a clean typecheck plus the full unit suite, not a new test.

- [ ] **Step 1: Extend the `FeedbackTarget` interface**

In `app/(application)/chat/components/feedback-dialog.tsx`, add `trajectoryId` to the interface (currently ~lines 46-51):

```ts
export interface FeedbackTarget {
  sessionId: string;
  agentId: string;
  score: 0 | 1;
  referencedItems: ReferencedItem[];
  trajectoryId: string | null;
}
```

- [ ] **Step 2: Import the client helpers in the dialog**

In `app/(application)/chat/components/feedback-dialog.tsx`, add to the imports (near the existing `import { CREATE_FEEDBACK, UPDATE_ITEM } from "../queries";`):

```ts
import {
  buildTrajectoryFeedbackBody,
  postTrajectoryFeedback,
} from "@/lib/api/trajectory-feedback";
```

- [ ] **Step 3: Fire the best-effort POST on submit**

In `handleSubmit`, immediately AFTER the `await createFeedback({ … })` call succeeds and BEFORE `toast.success(…)`, insert:

```ts
      // Close the trajectory feedback loop (best-effort; never blocks the GraphQL feedback).
      if (target.trajectoryId) {
        try {
          await postTrajectoryFeedback(
            target.trajectoryId,
            buildTrajectoryFeedbackBody(target.score, description),
          );
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.warn(
              "Trajectory feedback POST failed (non-blocking):",
              error,
            );
          }
        }
      }
```

For reference, the surrounding block becomes:

```ts
  const handleSubmit = async () => {
    if (!target) return;
    try {
      await createFeedback({
        variables: {
          input: {
            session: target.sessionId,
            score: target.score,
            agent: target.agentId,
            description,
            user: user.id,
          },
        },
      });
      // Close the trajectory feedback loop (best-effort; never blocks the GraphQL feedback).
      if (target.trajectoryId) {
        try {
          await postTrajectoryFeedback(
            target.trajectoryId,
            buildTrajectoryFeedbackBody(target.score, description),
          );
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.warn(
              "Trajectory feedback POST failed (non-blocking):",
              error,
            );
          }
        }
      }
      toast.success(t("feedbackDialog.submitted"), {
        description: t("feedbackDialog.submittedDescription"),
      });
      onOpenChange(false);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to submit feedback:", error);
      }
      toast.error(t("feedbackDialog.submitFailed"), {
        description:
          error instanceof Error
            ? error.message
            : t("feedbackDialog.submitFailedDescription"),
      });
    }
  };
```

- [ ] **Step 4: Compute `trajectoryId` in `handleFeedback`**

In `app/(application)/chat/components/message-column.tsx`, add the import (with the other `./` component imports, e.g. near `import { ToolCallApproval } from "./tool-call-approval";`):

```ts
import { findTrajectoryRefForFeedback } from "./trajectory-ref";
```

Then update `handleFeedback` (currently ~lines 178-191) to compute and pass the ref:

```ts
  const handleFeedback = (
    messageId: string,
    feedback: "positive" | "negative",
  ) => {
    const message = messages?.find((m) => m.id === messageId);
    const referencedItems =
      feedback === "negative" && message ? extractReferencedItems(message) : [];
    const trajectoryId = findTrajectoryRefForFeedback(messages, messageId);
    setFeedbackTarget({
      sessionId: controller.session?.id ?? "",
      agentId: agent.id,
      score: feedback === "positive" ? 1 : 0,
      referencedItems,
      trajectoryId,
    });
  };
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (In particular, no missing-property error on `setFeedbackTarget` — `trajectoryId` is now required on `FeedbackTarget` and supplied; and `findTrajectoryRefForFeedback(messages, …)` accepts the controller's `messages`.)

- [ ] **Step 6: Run the full unit suite**

Run: `npm run test`
Expected: PASS — all tests green, including Tasks 1 & 2.

- [ ] **Step 7: Commit**

```bash
git add "app/(application)/chat/components/feedback-dialog.tsx" "app/(application)/chat/components/message-column.tsx"
git commit -m "feat(chat): forward thumbs feedback to trajectory store"
```

---

## Manual validation (after all tasks)

1. With Newton (trajectories + feedback enabled), ask a question that triggers `knowledge_search`; wait for the answer.
2. Click 👍, add a note, submit → expect a `POST /retrieval/trajectories/<ref>/feedback` with `{ "positive": true }` (network tab) and the existing success toast.
3. Verify replay: re-ask a very similar question → the harness `trajectory_lookup` debug event should now report `decision: replay` (was `hint` before feedback existed).
4. Click 👎 on another answer, add a note, submit → expect `{ "positive": false, "message": "<note>" }`; the trajectory is deleted or its steps rewritten by the feedback-agent.
5. Rate an answer that did no retrieval → no trajectory POST is sent (only the GraphQL feedback).
