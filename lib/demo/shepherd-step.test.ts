import { describe, expect, it } from "vitest";

import { ANCHOR_WAIT_MS, shepherdStepFor, shepherdStepsFor } from "./shepherd-step";
import { CHAPTERS, type DemoStep, type TourPosition, encodePosition } from "./tour";

/**
 * Shepherd renders in a browser and this suite runs in node, so what is
 * asserted here is the TRANSLATION — which is where the demo-specific
 * decisions live. Everything Shepherd does with these options afterwards is
 * the library's business and is not this repo's to test.
 *
 * These run with no DOM and without importing the package: `shepherd-step.ts`
 * takes its types via `import type`, which is erased.
 */

const handlers = {
  onNext: () => {},
  onPrev: () => {},
  hasPrev: true,
  hasNext: true,
};

const allSteps: DemoStep[] = CHAPTERS.flatMap((c) => c.steps);

describe("anchored steps point Shepherd at the right element", () => {
  it("builds a selector matching the data-demo-id contract", () => {
    // The anchors themselves are verified against the source by
    // tour-navigation.test.ts. What matters here is that we hand Shepherd a
    // SELECTOR rather than a bare id — `attachTo.element` is a CSS selector,
    // so passing "chat-composer" would silently match nothing.
    const step = allSteps.find((s) => s.anchor)!;
    const options = shepherdStepFor(step, handlers);

    expect(options.attachTo?.element).toBe(`[data-demo-id="${step.anchor}"]`);
    expect(options.attachTo?.element.startsWith("[")).toBe(true);
  });

  it("waits for elements that mount late, and scrolls to them", () => {
    // Chapter 3 opens a drawer via a deep link and then attaches to something
    // inside it; chapter 4 attaches after a route change. Both anchors appear
    // after the step is shown. Without waitForElement the popover renders
    // unattached in the centre of the screen — no error, just a tour that
    // stopped pointing at anything.
    for (const step of allSteps.filter((s) => s.anchor)) {
      const options = shepherdStepFor(step, handlers);
      expect(options.waitForElement, `${step.id} would not wait`).toBe(
        ANCHOR_WAIT_MS,
      );
      expect(
        options.scrollTo,
        `${step.id} would not scroll into view`,
      ).toBeTruthy();
    }
  });

  it("leaves the target clickable so the visitor can type", () => {
    // canClickTarget: false sets pointer-events: none on the target. On the
    // composer steps that makes the chapter uncompletable — the box is
    // highlighted and will not accept the message the tour just asked for.
    const composer = allSteps.find((s) => s.anchor === "chat-composer");
    expect(composer, "no composer step — has the anchor been renamed?").toBeTruthy();
    expect(shepherdStepFor(composer!, handlers).canClickTarget).toBe(true);
  });
});

describe("unanchored steps are full-screen beats", () => {
  it("omits attachTo entirely rather than passing an empty selector", () => {
    // `attachTo: { element: "" }` is not the same as no attachTo: Shepherd
    // treats the former as a failed match and the latter as a centred step.
    const step = allSteps.find((s) => !s.anchor);
    expect(step, "no unanchored step left — drop this test").toBeTruthy();

    const options = shepherdStepFor(step!, handlers);
    expect(options.attachTo).toBeUndefined();
    expect("waitForElement" in options).toBe(false);
  });
});

describe("the footer buttons match where the visitor is", () => {
  it("offers Back and Next in the middle of the tour", () => {
    const options = shepherdStepFor(allSteps[1], handlers);
    expect(options.buttons.map((b) => b.text)).toEqual(["Back", "Next"]);
  });

  it("drops Back at the very start and Next at the very end", () => {
    // Rendering a dead button is worse than rendering none: the visitor clicks
    // it, nothing happens, and they conclude the demo is broken.
    const first = shepherdStepFor(allSteps[0], { ...handlers, hasPrev: false });
    expect(first.buttons.map((b) => b.text)).toEqual(["Next"]);

    const last = shepherdStepFor(allSteps[0], { ...handlers, hasNext: false });
    expect(last.buttons.map((b) => b.text)).toEqual(["Back"]);
  });

  it("marks Back as secondary without also hand-writing the class", () => {
    // `secondary: true` is what emits `shepherd-button-secondary`. Passing the
    // class too is not wrong, just duplicated — and it drifts if Shepherd
    // renames it.
    const back = shepherdStepFor(allSteps[1], handlers).buttons.find(
      (b) => b.text === "Back",
    );
    expect(back?.secondary).toBe(true);
  });
});

describe("every step in the tour translates", () => {
  it("produces a titled, texted step with at least one way onward", () => {
    for (const [index, step] of allSteps.entries()) {
      const options = shepherdStepFor(step, {
        ...handlers,
        hasPrev: index > 0,
        hasNext: index < allSteps.length - 1,
      });
      expect(options.title, `${step.id} has no title`).toBeTruthy();
      expect(options.text, `${step.id} has no body`).toBeTruthy();
      expect(
        options.buttons.length,
        `${step.id} has no button — the visitor is stuck`,
      ).toBeGreaterThan(0);
    }
  });
});

/**
 * The tour is added to Shepherd ONCE and then lives as long as the page does,
 * while the URL — the actual source of truth — changes underneath it. So the
 * question these cover is not "does a button exist" but "does the button on
 * step N still navigate to N+1 an hour later". They pin the wiring that makes
 * that true: each closure targets a position computed from its own step.
 */
describe("the whole tour wires its own navigation", () => {
  const build = () => {
    const visited: string[] = [];
    const steps = shepherdStepsFor(CHAPTERS, (target: TourPosition) => {
      visited.push(encodePosition(target));
    });
    return { steps, visited };
  };

  it("emits one Shepherd step per tour step, in order", () => {
    const { steps } = build();
    expect(steps.map((s) => s.id)).toEqual(allSteps.map((s) => s.id));
  });

  it("advances each step to the one after it", () => {
    const { steps, visited } = build();
    for (const step of steps) {
      step.buttons.find((b) => b.text === "Next")?.action();
    }
    // Every step except the last has a Next, and each lands on its successor.
    expect(visited).toEqual(
      CHAPTERS.flatMap((c, ci) =>
        c.steps
          .map((_, si) =>
            si + 1 < c.steps.length
              ? `${c.id}.${si + 1}`
              : CHAPTERS[ci + 1]
                ? `${CHAPTERS[ci + 1].id}.0`
                : null,
          )
          .filter((v): v is string => v !== null),
      ),
    );
  });

  it("crosses chapter boundaries in both directions", () => {
    // The seam most likely to break: the last step of a chapter must go to the
    // first step of the next, not off the end of its own chapter.
    const { steps, visited } = build();
    const lastOfFirst = CHAPTERS[0].steps.length - 1;

    steps[lastOfFirst].buttons.find((b) => b.text === "Next")!.action();
    expect(visited).toEqual([`${CHAPTERS[1].id}.0`]);

    steps[lastOfFirst + 1].buttons.find((b) => b.text === "Back")!.action();
    expect(visited[1]).toBe(`${CHAPTERS[0].id}.${lastOfFirst}`);
  });

  it("gives the first step no Back and the last step no Next", () => {
    const { steps } = build();
    expect(steps[0].buttons.map((b) => b.text)).toEqual(["Next"]);
    expect(steps[steps.length - 1].buttons.map((b) => b.text)).toEqual(["Back"]);
  });
});
