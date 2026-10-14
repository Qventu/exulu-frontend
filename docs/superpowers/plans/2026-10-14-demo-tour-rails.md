# Demo Tour Rails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the guided demo tour survive its own Weiter path: all 37 steps reachable by clicking Weiter, each showing the screen its copy describes, and a walker that fails when that stops being true.

**Architecture:** Five small, independent fixes to the tour engine and three product screens (chapter 10 route and fixture status, a refetch-on-step component inside the demo Apollo provider, URL-synced evals tabs, a ring that re-scrolls once, a last step without Weiter), plus a Weiter-driven mode for the existing Playwright walker. Every fix has a pure helper with a node test; the walker is the integration gate.

**Tech Stack:** Next.js 16 app router, React 19, Apollo Client 3.14, framer-motion 12, vitest (node environment, `**/*.test.ts` only), Playwright installed outside the repo for `scripts/walk-demo.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-14-demo-tour-fix-design.md` — sub-project 1.

**Branch:** `fix/demo-tour-rails` from `main`.

## Global Constraints

- Node 22.18.0 (`package.json` engines). Builds on Node 23 stall; prefix `PATH=/opt/homebrew/opt/nvm/versions/node/v22.18.0/bin:$PATH`.
- Demo flag is `NEXT_PUBLIC_DEMO_MODE=true`, strict equality, inlined at build time. Production build: `NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build` (≈ 27 min on this machine), then `npx next start -p 3001`.
- vitest runs in `environment: "node"`, collects only `**/*.test.ts`; React components are not unit-tested, pure helpers are.
- No visitor-facing German is added or reworded in this plan. (Copy work is sub-project 3.)
- Client names (NEW Lift, ALGI) only in `lib/demo/chapters/contact.ts` — test-enforced.
- Resolver keys must be the operation names in the product's gql documents.
- Commit after every task; never push.

## Review Focus

1. A legacy `/transcriptions?review=<id>&foo=bar` link must land on `/transcriptions/review/<id>?foo=bar` — Task 1 tests this.
2. The first render of the demo app must not trigger a refetch storm — Task 3's helper returns false on first render, tested.
3. Switching tabs by hand on `/evals/[id]` must not be undone by the effect — Task 4's effect depends only on the param, tested at the helper level and checked once in the browser.
4. An anchor that is partially visible must not be re-scrolled (it would jump under the reader) — Task 5 tests the partial case.
5. A step with a CTA must never also show Weiter, and the last step without a CTA shows only Zurück — Task 6 tests both.

---

### Task 1: Legacy review redirect keeps the query string

**Files:**
- Create: `app/(application)/transcriptions/review-href.ts`
- Create: `app/(application)/transcriptions/review-href.test.ts`
- Modify: `app/(application)/transcriptions/page.tsx:136-140`

**Interfaces:**
- Produces: `reviewHref(jobId: string, searchParams: URLSearchParams): string`

- [ ] **Step 1: Create the branch**

```bash
git checkout -b fix/demo-tour-rails main
```

- [ ] **Step 2: Write the failing test**

`app/(application)/transcriptions/review-href.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { reviewHref } from "./review-href";

describe("reviewHref", () => {
  it("moves a legacy ?review= link to the review page", () => {
    expect(reviewHref("abc", new URLSearchParams("review=abc"))).toBe(
      "/transcriptions/review/abc",
    );
  });

  it("keeps every other search param", () => {
    expect(
      reviewHref("abc", new URLSearchParams("review=abc&tour=meetings.1")),
    ).toBe("/transcriptions/review/abc?tour=meetings.1");
  });

  it("encodes the id", () => {
    expect(reviewHref("a b", new URLSearchParams())).toBe(
      "/transcriptions/review/a%20b",
    );
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run "app/(application)/transcriptions/review-href.test.ts"`
Expected: FAIL — cannot find module `./review-href`.

- [ ] **Step 4: Write the helper**

`app/(application)/transcriptions/review-href.ts`:

```ts
/**
 * Where a legacy `/transcriptions?review=<id>` link goes now that the review
 * sheet is a page.
 *
 * Keeps every other search param. The guided demo tour carries its position
 * as `?tour=`, and dropping it here reset the tour to chapter 1 on step 30.
 */
export function reviewHref(jobId: string, searchParams: URLSearchParams): string {
  const rest = new URLSearchParams(searchParams);
  rest.delete("review");
  const query = rest.toString();
  return `/transcriptions/review/${encodeURIComponent(jobId)}${query ? `?${query}` : ""}`;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run "app/(application)/transcriptions/review-href.test.ts"`
Expected: PASS (3 tests).

- [ ] **Step 6: Use it in the page**

In `app/(application)/transcriptions/page.tsx`, add the import next to the other local imports:

```ts
import { reviewHref } from "./review-href";
```

Replace the effect at lines 136-140 with:

```ts
  // The review sheet became a page (spec §1.2); keep old links working,
  // carrying every other param with them (the demo tour's `?tour=` included).
  const legacyReviewId = searchParams.get("review");
  React.useEffect(() => {
    if (legacyReviewId) {
      router.replace(reviewHref(legacyReviewId, new URLSearchParams(searchParams)));
    }
  }, [legacyReviewId, router, searchParams]);
```

- [ ] **Step 7: Type-check and lint the file**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "transcriptions/(page|review-href)" ; npx eslint "app/(application)/transcriptions/page.tsx" "app/(application)/transcriptions/review-href.ts"`
Expected: no lines from tsc for these files; eslint clean.

- [ ] **Step 8: Commit**

```bash
git add "app/(application)/transcriptions/review-href.ts" "app/(application)/transcriptions/review-href.test.ts" "app/(application)/transcriptions/page.tsx"
git commit -m "fix(transcriptions): keep the query string on the legacy ?review= redirect

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Chapter 10 routes to the review page and its meeting passes the page's guards

**Files:**
- Modify: `lib/demo/chapters/meetings.ts`
- Modify: `lib/demo/fixtures/algi-meetings.json` (one row)
- Modify: `lib/demo/resolvers.ts` (add `GetProjects` next to `GetProjectsByIds`, ~line 918)
- Modify: `app/(application)/transcriptions/demo-meetings.test.ts`
- Modify: `lib/demo/supported-routes.test.ts`
- Test: `lib/demo/apollo-link.operations.test.ts`

**Interfaces:**
- Consumes: `ALGI_MEETING_ID` from `lib/demo/fixtures/chapter-meetings.ts`; `transcriptPublishState` from `app/(application)/transcriptions/types.ts`; `runDemoQueryThroughCache` from `lib/demo/test-support.ts`; `GET_PROJECTS` from `app/(application)/projects/queries.ts`.

- [ ] **Step 1: Write the failing tests**

Append to `app/(application)/transcriptions/demo-meetings.test.ts` (inside the existing `describe("opening one recording", …)` block, or as a new describe at the bottom):

```ts
import { transcriptPublishState } from "./types";

describe("the review page's guards", () => {
  // review/[jobId]/page.tsx returns null for a `saved` job and rejects
  // anything but awaiting_review/reviewed. The sheet this chapter was built
  // on had no such guard, and the walk of 2026-10-14 found a blank page.
  it("accepts the meeting the chapter opens", async () => {
    const data = await runDemoQueryThroughCache(
      GET_TRANSCRIPTION_JOB,
      { id: ALGI_MEETING_ID },
      at,
    );
    const job = data.transcription_jobById as {
      status: "awaiting_review" | "reviewed" | "saved" | string;
      saved_item_id: string | null;
    };
    expect(["awaiting_review", "reviewed"]).toContain(job.status);
    expect(job.saved_item_id).toBeNull();
    expect(transcriptPublishState(job as never)).toBe("draft");
  });
});
```

Append to `lib/demo/supported-routes.test.ts` inside the top-level describe:

```ts
  // The product redirects the legacy `?review=` param to its own route and
  // drops every other param — including `?tour=`. A step must never depend
  // on a parameter the product rewrites.
  it("never navigates with the legacy review query parameter", () => {
    for (const chapter of CHAPTERS) {
      for (const step of chapter.steps) {
        const params = new URL(step.route, "http://demo.invalid").searchParams;
        expect(
          params.has("review"),
          `${chapter.id}.${step.id} uses ?review=, which /transcriptions redirects away`,
        ).toBe(false);
      }
    }
  });
```

Append to `lib/demo/apollo-link.operations.test.ts` in the `describe("/data page operations")` neighbourhood as its own describe:

```ts
import { GET_PROJECTS } from "@/app/(application)/projects/queries";

describe("/transcriptions/review/[jobId] operations", () => {
  it("answers GetProjects with an empty page (the review page's project picker)", async () => {
    const data = await runDemoOperation(GET_PROJECTS, { page: 1, limit: 50 }, { chapter: "meetings", step: 1 });
    const page = data.projectsPagination as { items: unknown[]; pageInfo: { itemCount: number } };
    expect(page.items).toEqual([]);
    expect(page.pageInfo.itemCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run "app/(application)/transcriptions/demo-meetings.test.ts" lib/demo/supported-routes.test.ts lib/demo/apollo-link.operations.test.ts`
Expected: FAIL — status is `saved`; a step route contains `review=`; `GetProjects` unmapped throws.

- [ ] **Step 3: Route the chapter to the review page**

In `lib/demo/chapters/meetings.ts`, add after the import of `ALGI_MEETING_ID`:

```ts
/**
 * The review PAGE, not the old `?review=` sheet. /transcriptions redirects
 * the legacy param to this route and drops everything else in the query —
 * the tour position included — so the chapter goes straight there.
 */
const REVIEW = `/transcriptions/review/${ALGI_MEETING_ID}`;
```

and change both `route: \`/transcriptions?review=${ALGI_MEETING_ID}\`` lines (steps `meetings-transcript` and `meetings-guide`) to `route: REVIEW,`.

- [ ] **Step 4: Put the meeting into review**

In `lib/demo/fixtures/algi-meetings.json`, on the object with `"id": "000cf053-e361-47b2-8f53-536ff29d912d"`, change `"status": "saved"` to `"status": "awaiting_review"`. Leave every other field.

- [ ] **Step 5: Map GetProjects**

In `lib/demo/resolvers.ts`, directly after the `GetProjectsByIds` entry (~line 918), add:

```ts
  // The review page's TranscriptDocument offers a project picker on load. No
  // projects exist in the tour, and an unmapped operation renders the page
  // blank rather than empty.
  GetProjects: () => ({
    projectsPagination: { pageInfo: page(0), items: [] },
  }),
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run "app/(application)/transcriptions/demo-meetings.test.ts" lib/demo/supported-routes.test.ts lib/demo/apollo-link.operations.test.ts lib/demo/chapters/index.test.ts lib/demo/tour.test.ts`
Expected: PASS. If `demo-meetings.test.ts`'s "returns every meeting" asserts a status set, update its expectation to include `awaiting_review` for this row.

- [ ] **Step 7: Commit**

```bash
git add lib/demo/chapters/meetings.ts lib/demo/fixtures/algi-meetings.json lib/demo/resolvers.ts "app/(application)/transcriptions/demo-meetings.test.ts" lib/demo/supported-routes.test.ts lib/demo/apollo-link.operations.test.ts
git commit -m "fix(demo): route chapter 10 to the review page it can actually render

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Refetch every active query when the tour position changes

**Files:**
- Create: `lib/demo/step-refetch.ts`
- Create: `lib/demo/step-refetch.test.ts`
- Create: `components/demo/step-refetch.tsx`
- Modify: `app/(application)/authenticated.tsx` (provider JSX, ~line 199)

**Interfaces:**
- Produces: `shouldRefetch(previous: string | null | undefined, next: string | null): boolean`; `<DemoStepRefetch />`.
- Consumes: `TOUR_PARAM` from `lib/demo/tour.ts`.

- [ ] **Step 1: Write the failing test**

`lib/demo/step-refetch.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { shouldRefetch } from "./step-refetch";

describe("shouldRefetch", () => {
  it("does nothing on the first render", () => {
    expect(shouldRefetch(undefined, "daten.0")).toBe(false);
  });

  it("refetches when the position changes on the same route", () => {
    expect(shouldRefetch("struktur.0", "struktur.1")).toBe(true);
  });

  it("stays quiet when the position is unchanged", () => {
    expect(shouldRefetch("techdoc.0", "techdoc.0")).toBe(false);
  });

  it("refetches when the position is lost", () => {
    expect(shouldRefetch("daten.1", null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/demo/step-refetch.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the helper**

`lib/demo/step-refetch.ts`:

```ts
/**
 * Whether a change of `?tour=` must refetch every active query.
 *
 * The demo link answers from `getWorld(getCurrentPosition())` at request
 * time, so a new step IS a new world — but the product's `cache-first`
 * queries (/data's context list, for one) never ask again when only the
 * query string changes on the same route. Chapter 2's list stayed empty for
 * three steps because of this.
 *
 * `undefined` for `previous` means the first render: nothing is stale yet,
 * and refetching there would double every query on every page load.
 */
export function shouldRefetch(
  previous: string | null | undefined,
  next: string | null,
): boolean {
  if (previous === undefined) return false;
  return previous !== next;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/demo/step-refetch.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the component**

`components/demo/step-refetch.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useApolloClient } from "@apollo/client";
import { useSearchParams } from "next/navigation";

import { shouldRefetch } from "@/lib/demo/step-refetch";
import { TOUR_PARAM } from "@/lib/demo/tour";

/**
 * Refetches every active query whenever the tour moves.
 *
 * Mounted INSIDE the demo ApolloProvider (app/(application)/authenticated.tsx)
 * because the tour provider itself sits outside it and cannot reach the
 * client. Reads the position from the URL, which is the tour's source of
 * truth, rather than from the tour context for the same reason.
 *
 * `reFetchObservableQueries` refetches cache-first queries too; `resetStore`
 * would also clear the cache and briefly empty every screen, which is the
 * flash this exists to avoid.
 */
export function DemoStepRefetch() {
  const client = useApolloClient();
  const raw = useSearchParams().get(TOUR_PARAM);
  const previous = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (shouldRefetch(previous.current, raw)) {
      void client.reFetchObservableQueries();
    }
    previous.current = raw;
  }, [raw, client]);

  return null;
}
```

- [ ] **Step 6: Mount it in the provider**

In `app/(application)/authenticated.tsx`, add the import:

```ts
import { DemoStepRefetch } from "@/components/demo/step-refetch";
```

and change the returned JSX to:

```tsx
  return (
    <ApolloProvider client={client}>
      {demoMode && (
        // useSearchParams needs a Suspense boundary or the whole subtree
        // opts out of static rendering — same rule as TourOverlay.
        <React.Suspense fallback={null}>
          <DemoStepRefetch />
        </React.Suspense>
      )}
      <SessionProvider>
        <AppShell sidebarDefaultOpen={sidebarDefaultOpen} user={user}>
          {children}
        </AppShell>
      </SessionProvider>
    </ApolloProvider>
  );
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "step-refetch|authenticated" || echo clean`
Expected: `clean`.

- [ ] **Step 8: Commit**

```bash
git add lib/demo/step-refetch.ts lib/demo/step-refetch.test.ts components/demo/step-refetch.tsx "app/(application)/authenticated.tsx"
git commit -m "fix(demo): refetch active queries when the tour position changes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Evals tabs follow the URL

**Files:**
- Create: `app/(application)/evals/[id]/tab-param.ts`
- Create: `app/(application)/evals/[id]/tab-param.test.ts`
- Modify: `app/(application)/evals/[id]/page.tsx:82-88`

**Interfaces:**
- Produces: `type EvalSetTab = "results" | "testCases"`; `tabFromParam(raw: string | null): EvalSetTab`.

- [ ] **Step 1: Write the failing test**

`app/(application)/evals/[id]/tab-param.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { tabFromParam } from "./tab-param";

describe("tabFromParam", () => {
  it("opens the cases tab when asked", () => {
    expect(tabFromParam("testCases")).toBe("testCases");
  });

  it("defaults to results", () => {
    expect(tabFromParam(null)).toBe("results");
    expect(tabFromParam("")).toBe("results");
  });

  it("ignores values it does not know", () => {
    expect(tabFromParam("cases")).toBe("results");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run "app/(application)/evals/[id]/tab-param.test.ts"`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the helper**

`app/(application)/evals/[id]/tab-param.ts`:

```ts
export type EvalSetTab = "results" | "testCases";

/** `?tab=testCases` opens the cases tab; anything else is the results tab. */
export function tabFromParam(raw: string | null): EvalSetTab {
  return raw === "testCases" ? "testCases" : "results";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run "app/(application)/evals/[id]/tab-param.test.ts"`
Expected: PASS (3 tests).

- [ ] **Step 5: Sync the page's tab to the param**

In `app/(application)/evals/[id]/page.tsx`, make sure `useEffect` is imported from `react` alongside `useState`, add:

```ts
import { tabFromParam, type EvalSetTab } from "./tab-param";
```

and replace lines 82-88 (the `requestedTab` / `initialTab` / `useState` block and its comment) with:

```ts
  // Deep link: ?tab=testCases opens the cases tab. Followed on every CHANGE
  // of the param, not only on arrival — the demo tour deep-links tab by tab
  // on one route without a reload. Manual tab switches are not fought: the
  // effect runs only when the param itself changes.
  const requestedTab = tabFromParam(useSearchParams().get("tab"));
  const [activeTab, setActiveTab] = useState<EvalSetTab>(requestedTab);
  useEffect(() => {
    setActiveTab(requestedTab);
  }, [requestedTab]);
```

Update the `onValueChange` cast at ~line 308 to `(v) => setActiveTab(v as EvalSetTab)`.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "evals/\[id\]/(page|tab-param)" || echo clean`
Expected: `clean`.

- [ ] **Step 7: Commit**

```bash
git add "app/(application)/evals/[id]/tab-param.ts" "app/(application)/evals/[id]/tab-param.test.ts" "app/(application)/evals/[id]/page.tsx"
git commit -m "fix(evals): follow ?tab= when it changes without a reload

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The ring re-scrolls once when its anchor is pushed off screen

**Files:**
- Create: `lib/demo/ring-geometry.ts`
- Create: `lib/demo/ring-geometry.test.ts`
- Modify: `components/demo/tour-ring.tsx` (the effect body, lines ~104-220)
- Modify: `lib/demo/chapters/config.ts` (step `config-overview`)

**Interfaces:**
- Produces: `isOutsideViewport(box: { top: number; height: number }, viewportHeight: number): boolean`.

- [ ] **Step 1: Write the failing test**

`lib/demo/ring-geometry.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { isOutsideViewport } from "./ring-geometry";

describe("isOutsideViewport", () => {
  it("is true below the fold", () => {
    // config.0 as measured on 2026-10-14: anchor at 1009 in a 900px viewport.
    expect(isOutsideViewport({ top: 1009, height: 263 }, 900)).toBe(true);
  });

  it("is true above the top edge", () => {
    expect(isOutsideViewport({ top: -300, height: 100 }, 900)).toBe(true);
  });

  it("is false when any part is visible", () => {
    expect(isOutsideViewport({ top: 800, height: 200 }, 900)).toBe(false);
    expect(isOutsideViewport({ top: -50, height: 100 }, 900)).toBe(false);
    expect(isOutsideViewport({ top: 100, height: 100 }, 900)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/demo/ring-geometry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the helper**

`lib/demo/ring-geometry.ts`:

```ts
export interface VerticalBox {
  top: number;
  height: number;
}

/**
 * True when no pixel of the box is inside a viewport of `viewportHeight`.
 *
 * Partial visibility counts as visible: re-scrolling an element the reader
 * can already see would yank the page under them.
 */
export function isOutsideViewport(box: VerticalBox, viewportHeight: number): boolean {
  return box.top >= viewportHeight || box.top + box.height <= 0;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/demo/ring-geometry.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Re-scroll from the ring**

In `components/demo/tour-ring.tsx`:

Add the import:

```ts
import { isOutsideViewport } from "@/lib/demo/ring-geometry";
```

Next to the other `let` declarations at the top of the effect (`let raf = 0;` …), add:

```ts
    // One re-scroll per attach. The agent editor's prompt and tool sections
    // load after first paint and push the anchor back below the fold after
    // the first scrollIntoView; measured at y=1009 in a 900px viewport.
    let rescrolled = false;
```

Replace the start of `measure` so it reads:

```ts
    const measure = () => {
      if (!observedEl || holding) return;
      const next = observedEl.getBoundingClientRect();
      if (!rescrolled && isOutsideViewport(next, window.innerHeight)) {
        rescrolled = true;
        observedEl.scrollIntoView({ block: scrollBlock, behavior: "smooth" });
        return;
      }
      if (
        lastRect &&
        next.top === lastRect.top &&
        next.left === lastRect.left &&
        next.width === lastRect.width &&
        next.height === lastRect.height
      ) {
        return;
      }
      lastRect = next;
      setRect(next);
    };
```

In `detach`, add `rescrolled = false;` after `holding = false;`.

In `sync`, after the `if (el && el !== observedEl) { … }` block and before `else if (!el && observedEl)`, add a branch so late DOM growth above the anchor is noticed (the MutationObserver already calls `sync` on every mutation; `measure` returns early when nothing moved):

```ts
      } else if (el && el === observedEl) {
        measure();
      } else if (!el && observedEl) {
```

- [ ] **Step 6: Align the editor anchor to the top**

In `lib/demo/chapters/config.ts`, on the `config-overview` step add `scrollBlock: "start",` after `anchor: "agent-agentic-retrieval",` with the comment:

```ts
      // "start", not the default "nearest": the card is below the fold on a
      // 6,400px page, and "nearest" parks its top at the viewport's bottom.
      scrollBlock: "start",
```

- [ ] **Step 7: Type-check and run the tour tests**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "tour-ring|ring-geometry|chapters/config" || echo clean; npx vitest run lib/demo/tour.test.ts lib/demo/chapters/index.test.ts`
Expected: `clean`; tests PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/demo/ring-geometry.ts lib/demo/ring-geometry.test.ts components/demo/tour-ring.tsx lib/demo/chapters/config.ts
git commit -m "fix(demo): re-scroll an anchor the page pushed off screen

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: The last step has no Weiter

**Files:**
- Create: `lib/demo/panel-controls.ts`
- Create: `lib/demo/panel-controls.test.ts`
- Modify: `components/demo/tour-panel.tsx` (footer, lines ~124-131, and the `useTour` destructure)

**Interfaces:**
- Produces: `type FooterControl = "back" | "next" | "cta"`; `footerControls(input: { hasCta: boolean; isLast: boolean }): FooterControl[]`.
- Consumes: `nextPosition` from `lib/demo/tour.ts`.

- [ ] **Step 1: Write the failing test**

`lib/demo/panel-controls.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { footerControls } from "./panel-controls";

describe("footerControls", () => {
  it("offers Back and Next on an ordinary step", () => {
    expect(footerControls({ hasCta: false, isLast: false })).toEqual(["back", "next"]);
  });

  it("replaces Next with the call to action when a step has one", () => {
    expect(footerControls({ hasCta: true, isLast: true })).toEqual(["back", "cta"]);
    expect(footerControls({ hasCta: true, isLast: false })).toEqual(["back", "cta"]);
  });

  it("never offers a Next that does nothing", () => {
    // The 2026-10-14 walk: the closing step rendered Weiter, which was a no-op.
    expect(footerControls({ hasCta: false, isLast: true })).toEqual(["back"]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/demo/panel-controls.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the helper**

`lib/demo/panel-controls.ts`:

```ts
export type FooterControl = "back" | "next" | "cta";

/**
 * Which buttons the docked panel's footer shows.
 *
 * A CTA takes Next's place; the last step without one shows only Back. The
 * footer used to render Next unconditionally, and on the closing step that
 * button called `next()` with nowhere to go.
 */
export function footerControls({
  hasCta,
  isLast,
}: {
  hasCta: boolean;
  isLast: boolean;
}): FooterControl[] {
  if (hasCta) return ["back", "cta"];
  return isLast ? ["back"] : ["back", "next"];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/demo/panel-controls.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Use it in the panel**

In `components/demo/tour-panel.tsx`, add the imports:

```ts
import { nextPosition } from "@/lib/demo/tour";
import { footerControls } from "@/lib/demo/panel-controls";
```

After `const hasDetail = step.content.length > 0;` add:

```ts
  const controls = footerControls({
    hasCta: !!step.cta,
    isLast: nextPosition(chapters, position) === null,
  });
```

Replace the footer `<div className="flex items-center justify-end gap-2 border-t p-4">…</div>` with:

```tsx
      <div className="flex items-center justify-end gap-2 border-t p-4">
        {controls.includes("back") && (
          <button type="button" onClick={prev} className="demo-button demo-button-secondary">Zurück</button>
        )}
        {controls.includes("cta") && step.cta && (
          <a href={step.cta.href} className="demo-button">{step.cta.label}</a>
        )}
        {controls.includes("next") && (
          <button type="button" onClick={next} className="demo-button">Weiter</button>
        )}
      </div>
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "tour-panel|panel-controls" || echo clean`
Expected: `clean`.

- [ ] **Step 7: Commit**

```bash
git add lib/demo/panel-controls.ts lib/demo/panel-controls.test.ts components/demo/tour-panel.tsx
git commit -m "fix(demo): drop the no-op Weiter from the closing step

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: The walker clicks Weiter and asserts the next step arrived

**Files:**
- Modify: `scripts/dump-demo-steps.ts` (emit `title`)
- Modify: `scripts/walk-demo.mjs` (navigation in the step loop, ~lines 597-607; `assertGeometry`, ~line 119; the `ringOk` computation, ~line 653)

**Interfaces:**
- Consumes: `step.title` from the dump; `WALK_MODE` env (`next` default, `direct`).

- [ ] **Step 1: Emit the title**

In `scripts/dump-demo-steps.ts`, add `title: step.title,` after `stepId: step.id,` and update the docblock's field list to include `title`.

Run: `npx tsx scripts/dump-demo-steps.ts | node -e "const s=JSON.parse(require('fs').readFileSync(0,'utf8')); if(!s.every(x=>typeof x.title==='string'&&x.title)) process.exit(1); console.log('titles ok', s.length)"`
Expected: `titles ok 37`.

- [ ] **Step 2: Add the mode switch and a title wait**

In `scripts/walk-demo.mjs`, next to `const BASE_URL = …`, add:

```js
// "next" (default) walks the tour the way a prospect does: load the first
// step, then click Weiter and wait for the NEXT step's title in the panel.
// "direct" loads every step by URL — faster, and blind to every bug that
// lives in the transition (a redirect that drops ?tour=, a same-route step
// that never refetches, a tab that only follows the URL on reload).
const WALK_MODE = process.env.WALK_MODE ?? "next";
```

Add this helper above the `main`/loop function:

```js
/**
 * Clicks Weiter and waits until the panel's <h2> reads `expectedTitle`.
 * Resolves to null on success, or a message naming what the panel showed.
 */
async function advance(page, expectedTitle) {
  const weiter = page.locator('[data-demo-id="tour-panel"] button', { hasText: /^Weiter$/ });
  if ((await weiter.count()) === 0) return "no Weiter button on the previous step";
  await weiter.first().click();
  try {
    await page.waitForFunction(
      (title) => document.querySelector('[data-demo-id="tour-panel"] h2')?.textContent?.trim() === title,
      expectedTitle,
      { timeout: 20000 },
    );
    return null;
  } catch {
    const got = await page.evaluate(() => ({
      title: document.querySelector('[data-demo-id="tour-panel"] h2')?.textContent?.trim() ?? null,
      url: location.pathname + location.search,
    }));
    return `panel shows ${JSON.stringify(got.title)} at ${got.url}, expected ${JSON.stringify(expectedTitle)}`;
  }
}
```

Replace the navigation block at the top of the step loop (the `try { await page.goto(url, …) } catch …` statement) with:

```js
    const isFirst = results.length === 0;
    if (WALK_MODE === "direct" || isFirst) {
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      } catch (err) {
        row.error = `navigation failed: ${String(err).split("\n")[0]}`;
        results.push(row);
        console.log(`${step.pos.padEnd(18)} NAV FAIL ${row.error}`);
        continue;
      }
    } else {
      const problem = await advance(page, step.title);
      if (problem) {
        row.error = `Weiter did not reach this step: ${problem}`;
        row.transitionOk = false;
        results.push(row);
        console.log(`${step.pos.padEnd(18)} TRANSITION FAIL ${row.error}`);
        // Recover by URL so the rest of the walk still reports per step.
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
        continue;
      }
      row.transitionOk = true;
    }
```

- [ ] **Step 3: Assert the ring is real and on screen**

In `assertGeometry`, after `const anchorEl = …`, add:

```js
  // A ring drawn around a hidden anchor is an 8x8 box at the viewport
  // corner (evals.2 on 2026-10-14). Require real size and some overlap with
  // the viewport.
  const ringSane = (() => {
    if (!ring) return null;
    const r = ring.getBoundingClientRect();
    const onScreen = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    return r.width >= 16 && r.height >= 16 && onScreen;
  })();
```

and add `ringSane,` to the returned object. Where `row.ringOk` is computed, change it to:

```js
    row.ringOk =
      geometry.ringPresent === row.ringExpected &&
      (!row.ringExpected || (geometry.ringOnAnchor === true && geometry.ringSane === true));
```

In the `row.allPass` expression add `(row.transitionOk !== false) &&` as the first operand.

- [ ] **Step 4: Syntax-check the walker**

Run: `node --check scripts/walk-demo.mjs && echo ok`
Expected: `ok`.

- [ ] **Step 5: Commit**

```bash
git add scripts/dump-demo-steps.ts scripts/walk-demo.mjs
git commit -m "test(demo): walk the tour by clicking Weiter, not by loading URLs

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Verify on a production demo build

**Files:** none (verification only).

- [ ] **Step 1: Run the whole demo test filter**

Run: `npx vitest run lib/demo "app/(application)/transcriptions" "app/(application)/evals" "app/(application)/data" "app/(application)/agents"`
Expected: all PASS. Pre-existing failures outside this filter (`components/shell/nav-config.test.ts`) are not ours.

- [ ] **Step 2: Build and serve**

```bash
export PATH=/opt/homebrew/opt/nvm/versions/node/v22.18.0/bin:$PATH
NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build
NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next start -p 3111
```

Expected: build exits 0 (≈ 27 min); `curl -s -o /dev/null -w "%{http_code}" "http://localhost:3111/demo/szene/daten-pile?tour=daten.0"` prints `200`.

- [ ] **Step 3: Walk it**

From the directory where Playwright is installed (see the walker's docblock):

```bash
DEMO_BASE_URL=http://localhost:3111 node /Users/daniel.claessen/Desktop/Projects/exulu/frontend/scripts/walk-demo.mjs
```

Expected: 37 rows, every `allPass: true`, no `TRANSITION FAIL`. Specifically: `struktur.2` ring present on `knowledge-contexts`; `aufnahme.1` ring present on `knowledge-items`; `evals.2` `ringSane: true`; `config.0` `ringSane: true`; `meetings.1` and `meetings.2` reached by Weiter with the review page on screen; `contact.1` has no Weiter (the walker's `advance` is never asked to leave it).

- [ ] **Step 4: Spot-check two screens by eye**

Open `http://localhost:3111/data?tour=struktur.0`, click Weiter twice: the list fills to seven. Open `/evals/evalset-techdoc-regression?tour=evals.1`, click Weiter: the Testfälle tab is active; click Ergebnisse by hand with the tour panel's Weiter untouched: the tab stays on Ergebnisse (the effect does not fight manual switching).

- [ ] **Step 5: Record the result**

Append a dated line to `docs/superpowers/plans/2026-10-14-demo-tour-rails.md` under a `## Verification` heading with the walker's pass count and the build commit, and commit:

```bash
git add docs/superpowers/plans/2026-10-14-demo-tour-rails.md
git commit -m "docs(demo): record the rails walk result

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

## Verification

- 2026-10-14 — production demo build of `4324e96` (built and served by Daniel, `next start -p 3111`), walker at `9db9b3d` in Weiter mode, 1440 × 900: **37/37 steps pass all assertions**, 36/36 transitions reached by clicking Weiter, both scripted chat exchanges completed before advancing. Spot checks on the same build: chapter 2 fills 0 → 3 → 7 bases and chapter 3 fills 0 → 4 documents via Weiter; `evals.2` opens the Testfälle tab with a 747 × 256 ring; `config.0`'s ring lands in view (top 364) within 0.8 s with no re-scroll on reader scrolling; `meetings.1`/`.2` keep `?tour=` on `/transcriptions/review/<id>` and the `meeting-guide` ring attaches to the rendered document; `contact.1` offers only Zurück. Unit: vitest demo filter 39 files / 402 tests; `tsc --noEmit` clean at `8f78a22` (the later ring commits were type-checked by the build).
- Fresh-context review (fable) on `596186d..8f78a22`: 0 Critical, 2 Important (both resolved: the ring re-scroll predicate in `413e944`/`4324e96`; the green walk above), 5 Minor deferred — see the branch's final message.
