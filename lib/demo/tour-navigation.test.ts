import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CHAPTERS,
  TOUR_PARAM,
  encodePosition,
  hrefFor,
  parsePosition,
  resolveStep,
} from "./tour";

/**
 * These guard the tour's ability to MOVE, which is the part that failed
 * silently for two chapters.
 *
 * Chapter 4 shipped with a step whose route was `/data/newton_memory_context`
 * and nothing ever read it: no navigation happened, the payoff screen was never
 * shown, and the existing tests passed because they asserted the route was a
 * well-formed string. A well-formed string nobody uses is exactly what a broken
 * tour looks like from the inside.
 */

const allSteps = CHAPTERS.flatMap((c) =>
  c.steps.map((step, index) => ({ chapter: c.id, index, step })),
);

describe("the position survives a page load", () => {
  it("round-trips every step through the URL", () => {
    for (const { chapter, index } of allSteps) {
      const pos = { chapter, step: index };
      expect(parsePosition(encodePosition(pos), CHAPTERS)).toEqual(pos);
    }
  });

  it("falls back to the start rather than a chapter with no such step", () => {
    // A stale or hand-edited link must not resolve to a step that does not
    // exist — resolveStep would return null and the bubble would lose its Next
    // button, which is the only way forward.
    expect(parsePosition("memory.99", CHAPTERS)).toBeNull();
    expect(parsePosition("nosuchchapter.0", CHAPTERS)).toBeNull();
    expect(parsePosition("memory.-1", CHAPTERS)).toBeNull();
    expect(parsePosition("memory.abc", CHAPTERS)).toBeNull();
    expect(parsePosition("", CHAPTERS)).toBeNull();
    expect(parsePosition(null, CHAPTERS)).toBeNull();
  });
});

describe("every step is reachable at a real href", () => {
  it("carries the position on each one", () => {
    for (const { chapter, index } of allSteps) {
      const href = hrefFor({ chapter, step: index }, CHAPTERS);
      expect(href).toContain(`${TOUR_PARAM}=${chapter}.${index}`);
      expect(href.startsWith("/")).toBe(true);
    }
  });

  it("appends to a route that already has a query string", () => {
    // Chapter 3's steps deep-link into the retrieval wizard with `?wizard=`.
    // Joining with a second `?` would fold the tour parameter into the wizard
    // value, so the tour resets to step 1 on every advance — a loop with no
    // error anywhere.
    const withQuery = allSteps.filter(({ step }) => step.route.includes("?"));
    expect(
      withQuery.length,
      "no step deep-links any more — drop this test or find the new form",
    ).toBeGreaterThan(0);

    for (const { chapter, index } of withQuery) {
      const href = hrefFor({ chapter, step: index }, CHAPTERS);
      expect(href.match(/\?/g), `${href} has more than one ?`).toHaveLength(1);
      const parsed = new URL(href, "https://example.test");
      expect(parsed.searchParams.get(TOUR_PARAM)).toBe(`${chapter}.${index}`);
    }
  });

  it("resolves back to the step it came from", () => {
    for (const { chapter, index, step } of allSteps) {
      const href = hrefFor({ chapter, step: index }, CHAPTERS);
      const raw = new URL(href, "https://example.test").searchParams.get(
        TOUR_PARAM,
      );
      const round = parsePosition(raw, CHAPTERS);
      expect(round).not.toBeNull();
      expect(resolveStep(CHAPTERS, round!)?.id).toBe(step.id);
    }
  });
});

/**
 * Collects every `data-demo-id` in the source. Literal values are exact;
 * template values like `agent-wizard-${step}` become a pattern, because the
 * anchor they produce is only known at runtime.
 */
function declaredAnchors(): { literals: Set<string>; patterns: RegExp[] } {
  const literals = new Set<string>();
  const patterns: RegExp[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === ".next") continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!full.endsWith(".tsx")) continue;
      const source = readFileSync(full, "utf8");

      for (const m of source.matchAll(/data-demo-id="([^"]+)"/g)) {
        literals.add(m[1]);
      }
      for (const m of source.matchAll(/data-demo-id=\{`([^`]+)`\}/g)) {
        patterns.push(
          new RegExp(`^${m[1].replace(/\$\{[^}]+\}/g, "[A-Za-z0-9_-]+")}$`),
        );
      }
    }
  };
  ["app", "components"].forEach(walk);
  return { literals, patterns };
}

describe("every anchor the tour spotlights exists in the UI", () => {
  it("matches a data-demo-id in the source", () => {
    // The spotlight does document.querySelector on this value and renders
    // nothing when it finds nothing. A renamed or misspelled anchor therefore
    // produces a step that looks finished and highlights nothing at all — the
    // most likely way for a chapter to rot as the UI is refactored. This test
    // found chapter 4 spotlighting "chat-messages", which nothing declared.
    //
    // LIMIT: this proves the anchor is DECLARED, not that it reaches the DOM.
    // An anchor placed on a component that drops unknown props would pass here
    // and still light nothing. Check the component forwards props when adding
    // one to anything other than a plain element.
    const { literals, patterns } = declaredAnchors();
    expect(
      literals.size,
      "no data-demo-id found — did the directory walk break?",
    ).toBeGreaterThan(0);

    const anchored = allSteps.filter(({ step }) => step.anchor);
    expect(anchored.length).toBeGreaterThan(0);

    for (const { chapter, index, step } of anchored) {
      const anchor = step.anchor!;
      const found =
        literals.has(anchor) || patterns.some((p) => p.test(anchor));
      expect(
        found,
        `${chapter} step ${index} ("${step.title}") spotlights "${anchor}", which no component declares`,
      ).toBe(true);
    }
  });
});

describe("the wizard deep links agree with what they spotlight", () => {
  it("opens the same step it highlights", () => {
    // Two independent strings say which wizard step a tour step is about: the
    // `?wizard=` parameter that opens it and the `agent-wizard-<step>` anchor
    // that highlights it. If they drift, the drawer opens on Sources while the
    // ring sits over a step that is not mounted — so nothing lights up.
    for (const { chapter, index, step } of allSteps) {
      const requested = new URL(
        step.route,
        "https://example.test",
      ).searchParams.get("wizard");
      if (!requested) continue;
      expect(
        step.anchor,
        `${chapter} step ${index} opens the ${requested} wizard step but spotlights ${step.anchor}`,
      ).toBe(`agent-wizard-${requested}`);
    }
  });
});
