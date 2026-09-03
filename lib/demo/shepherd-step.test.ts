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
  onRestart: () => {},
  hasPrev: true,
  hasNext: true,
};

/**
 * A stand-in for the real React renderer (components/demo/step-content-host.tsx),
 * which this node-only file must never import. Its return value is never
 * inspected below — only whether and when it gets called.
 */
const renderContent = () => ({}) as HTMLElement;

const allSteps: DemoStep[] = CHAPTERS.flatMap((c) => c.steps);

describe("anchored steps point Shepherd at the right element", () => {
  it("builds a selector matching the data-demo-id contract", () => {
    // The anchors themselves are verified against the source by
    // tour-navigation.test.ts. What matters here is that we hand Shepherd a
    // SELECTOR rather than a bare id — `attachTo.element` is a CSS selector,
    // so passing "chat-composer" would silently match nothing.
    const step = allSteps.find((s) => s.anchor)!;
    const options = shepherdStepFor(step, handlers, renderContent);

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
      const options = shepherdStepFor(step, handlers, renderContent);
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
    expect(shepherdStepFor(composer!, handlers, renderContent).canClickTarget).toBe(
      true,
    );
  });

  it("honours a step's placement, defaulting to bottom", () => {
    // The popover was covering the content some steps narrate — the wizard
    // steps hid the drawer's own title. floating-ui still flips when the
    // preferred side does not fit, so this is a preference, not a promise.
    const anchored = allSteps.find((s) => s.anchor && !s.placement)!;
    expect(shepherdStepFor(anchored, handlers, renderContent).attachTo?.on).toBe(
      "bottom",
    );

    const placed = allSteps.find((s) => s.placement === "left");
    expect(placed, "no left-placed step — config wizard steps should be").toBeTruthy();
    expect(shepherdStepFor(placed!, handlers, renderContent).attachTo?.on).toBe(
      "left",
    );
  });
});

describe("unanchored steps are full-screen beats", () => {
  it("omits attachTo entirely rather than passing an empty selector", () => {
    // `attachTo: { element: "" }` is not the same as no attachTo: Shepherd
    // treats the former as a failed match and the latter as a centred step.
    const step = allSteps.find((s) => !s.anchor);
    expect(step, "no unanchored step left — drop this test").toBeTruthy();

    const options = shepherdStepFor(step!, handlers, renderContent);
    expect(options.attachTo).toBeUndefined();
    expect("waitForElement" in options).toBe(false);
  });
});

describe("the footer buttons match where the visitor is", () => {
  it("offers Back and Next in the middle of the tour", () => {
    const options = shepherdStepFor(allSteps[1], handlers, renderContent);
    expect(options.buttons.map((b) => b.text)).toEqual(["Zurück", "Weiter"]);
  });

  it("drops Back at the very start", () => {
    // Rendering a dead button is worse than rendering none: the visitor clicks
    // it, nothing happens, and they conclude the demo is broken.
    const first = shepherdStepFor(
      allSteps[0],
      { ...handlers, hasPrev: false },
      renderContent,
    );
    expect(first.buttons.map((b) => b.text)).toEqual(["Weiter"]);
  });

  it("replaces Next at the very end rather than leaving nothing", () => {
    // This assertion used to read `toEqual(["Zurück"])` — it pinned the dead end
    // in place and passed for as long as the dead end existed. Dropping Next is
    // right; leaving only Back is not, because the last step is the one that
    // makes the ask. A reviewer found it on screen; this file had certified it.
    const last = shepherdStepFor(
      allSteps[0],
      { ...handlers, hasNext: false },
      renderContent,
    );
    expect(last.buttons.map((b) => b.text)).toEqual(["Zurück", "Von vorn"]);
  });

  it("leads with the call to action when one is configured", () => {
    const withCta = shepherdStepFor(
      { ...allSteps[0], cta: { label: "Book a call", href: "https://x.test" } },
      { ...handlers, hasNext: false },
      renderContent,
    );
    expect(withCta.buttons.map((b) => b.text)).toEqual([
      "Zurück",
      "Book a call",
      "Von vorn",
    ]);
    // The ask is the primary; restarting steps aside for it.
    expect(withCta.buttons.find((b) => b.text === "Book a call")?.secondary).toBe(
      undefined,
    );
    expect(withCta.buttons.find((b) => b.text === "Von vorn")?.secondary).toBe(
      true,
    );
  });

  it("marks Back as secondary without also hand-writing the class", () => {
    // `secondary: true` is what emits `shepherd-button-secondary`. Passing the
    // class too is not wrong, just duplicated — and it drifts if Shepherd
    // renames it.
    const back = shepherdStepFor(allSteps[1], handlers, renderContent).buttons.find(
      (b) => b.text === "Zurück",
    );
    expect(back?.secondary).toBe(true);
  });
});

describe("every step in the tour translates", () => {
  it("produces a titled, texted step with at least one way onward", () => {
    for (const [index, step] of allSteps.entries()) {
      const options = shepherdStepFor(
        step,
        {
          ...handlers,
          hasPrev: index > 0,
          hasNext: index < allSteps.length - 1,
        },
        renderContent,
      );
      expect(options.title, `${step.id} has no title`).toBeTruthy();
      // options.text is now a thunk (() => renderContent(step)), unconditionally
      // set regardless of step.content — a function reference is always
      // truthy, so asserting on it would never catch a step with no body.
      // Assert on the source data instead, which is what this line always
      // meant to check.
      expect(step.content.length, `${step.id} has no body`).toBeGreaterThan(0);
      // "At least one button" was the old bar, and the last step cleared it
      // with Back alone — a button that only goes backwards. What matters is
      // that every step offers a way ONWARD, so Back does not count here.
      expect(
        options.buttons.filter((b) => b.text !== "Zurück").length,
        `${step.id} offers only Back — the visitor has nowhere to go`,
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
    const steps = shepherdStepsFor(
      CHAPTERS,
      (target: TourPosition) => {
        visited.push(encodePosition(target));
      },
      renderContent,
    );
    return { steps, visited };
  };

  it("emits one Shepherd step per tour step, in order", () => {
    const { steps } = build();
    expect(steps.map((s) => s.id)).toEqual(allSteps.map((s) => s.id));
  });

  it("advances each step to the one after it", () => {
    const { steps, visited } = build();
    for (const step of steps) {
      step.buttons.find((b) => b.text === "Weiter")?.action();
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

    steps[lastOfFirst].buttons.find((b) => b.text === "Weiter")!.action();
    expect(visited).toEqual([`${CHAPTERS[1].id}.0`]);

    steps[lastOfFirst + 1].buttons.find((b) => b.text === "Zurück")!.action();
    expect(visited[1]).toBe(`${CHAPTERS[0].id}.${lastOfFirst}`);
  });

  it("gives the first step no Back, and the last step somewhere to go", () => {
    const { steps } = build();
    expect(steps[0].buttons.map((b) => b.text)).toEqual(["Weiter"]);

    // Asserted `["Zurück"]` until a reviewer pointed out that a tour ending on a
    // single Back button asks for the meeting and then offers no way to take
    // it. Whatever the last step's buttons are, one of them must lead forward.
    const last = steps[steps.length - 1].buttons;
    expect(last.map((b) => b.text)).not.toEqual(["Zurück"]);
    expect(last.some((b) => b.text !== "Zurück")).toBe(true);
  });

  it("sends Start over back to the very first step", () => {
    const { steps, visited } = build();
    steps[steps.length - 1].buttons
      .find((b) => b.text === "Von vorn")!
      .action();
    expect(visited).toEqual([`${CHAPTERS[0].id}.0`]);
  });
});

describe("step content rendering", () => {
  const step = {
    id: "s", route: "/chat", anchor: null, title: "t",
    content: [{ kind: "paragraph" as const, text: "b" }],
  };
  const handlers = {
    onNext: () => {}, onPrev: () => {}, onRestart: () => {},
    hasPrev: false, hasNext: true,
  };

  // Shepherd's StepText accepts a function returning an HTMLElement. It must
  // be a FUNCTION, not a value: tour-shepherd.tsx calls show() for the same
  // step up to five times while settling an anchor, and a captured element
  // would leak a React root on every one of them.
  it("emits text as a thunk, not a rendered value", () => {
    const options = shepherdStepFor(step, handlers, () => ({}) as HTMLElement);
    expect(typeof options.text).toBe("function");
  });

  it("does not call the renderer until Shepherd asks", () => {
    let calls = 0;
    const options = shepherdStepFor(step, handlers, () => {
      calls++;
      return {} as HTMLElement;
    });
    expect(calls).toBe(0);
    (options.text as () => HTMLElement)();
    expect(calls).toBe(1);
  });

  it("widens the panel only when the step asks", () => {
    expect(shepherdStepFor(step, handlers, () => ({}) as HTMLElement).classes)
      .toBeUndefined();
    expect(
      shepherdStepFor({ ...step, size: "wide" }, handlers, () => ({}) as HTMLElement).classes,
    ).toBe("demo-step-wide");
  });
});
