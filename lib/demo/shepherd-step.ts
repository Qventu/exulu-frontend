import type { PopperPlacement, StepOptions } from "shepherd.js";

import type { ContentBlock } from "./content";
import {
  type DemoChapter,
  type DemoStep,
  type TourPosition,
  nextPosition,
  prevPosition,
} from "./tour";

/**
 * Translates the tour into Shepherd step options.
 *
 * Kept as pure functions in lib/ rather than inline in the overlay so the
 * translation is testable in node. The decisions encoded here — whether the
 * visitor may still type, how long to wait for an element that has not
 * rendered, where each button navigates — are the ones that quietly break a
 * chapter, and a component that only runs in a browser is a component nobody
 * asserts on.
 *
 * The types come from Shepherd itself via `import type`, which is erased at
 * compile time: this module keeps zero runtime dependency on the package (the
 * tests below run with no DOM) while still failing `tsc` if a future version
 * renames an option. An earlier draft declared the option shape structurally
 * and would have accepted a misspelled option forever.
 */

/**
 * Narrower than Shepherd's own `StepOptionsButton`, whose `action` is typed
 * `(this: Tour) => void`. Ours never uses `this` — every button navigates
 * through the router — and the plain signature is also what lets the tests
 * call `action()` directly.
 */
export interface DemoTourButton {
  text: string;
  action: () => void;
  secondary?: boolean;
}

/**
 * Assignability to Shepherd's `StepOptions` is not asserted here; it is proved
 * at the point of use, where `tour.addSteps()` takes these. That is a real
 * call site rather than a ceremonial type test, so it cannot drift.
 */
export type DemoStepOptions = Omit<
  StepOptions,
  "attachTo" | "buttons" | "text" | "title"
> & {
  id: string;
  title: string;
  text: string;
  buttons: DemoTourButton[];
  attachTo?: { element: string; on: PopperPlacement };
};

export interface StepHandlers {
  onNext: () => void;
  onPrev: () => void;
  /** Back to the first step. Only used on the last one. */
  onRestart: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

/**
 * Long enough for a route change plus an Apollo round trip and, on chapter 3,
 * the wizard drawer's open animation. Short enough that a genuinely missing
 * anchor still surfaces as an unattached step rather than a hang.
 *
 * Deliberately NOT paired with Shepherd's `skipMissingElement`. Skipping would
 * turn a broken anchor into a silently shorter tour, and this branch has
 * already shipped two anchors that pointed at nothing — a step floating in the
 * middle of the screen is the louder failure, which is what we want.
 */
export const ANCHOR_WAIT_MS = 4000;

/** Interim block → HTML. Replaced wholesale by the React renderer in Task 4. */
function blockToHtml(block: ContentBlock): string {
  switch (block.kind) {
    case "figure":
      return `<img src="${block.src}" alt="${block.alt ?? ""}" class="shepherd-schematic" />`;
    case "paragraph":
      return `<p>${block.text}</p>`;
    case "bullets":
      return `<ul>${block.items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
    case "callout":
      return `<blockquote>${block.text}</blockquote>`;
    case "stat":
      return `<p><strong>${block.value}</strong> ${block.label}</p>`;
    case "sequence":
      return `<ol>${block.steps.map((s) => `<li>${s}</li>`).join("")}</ol>`;
    default: {
      // Adding a ContentBlock kind without handling it here is a compile
      // error, not a silently dropped string. tsconfig sets `strict` but not
      // `noImplicitReturns`, so without this the return type would quietly
      // widen to `string | undefined` and the new kind would render as
      // nothing rather than fail the build.
      const unhandled: never = block;
      return unhandled;
    }
  }
}

export function shepherdStepFor(
  step: DemoStep,
  handlers: StepHandlers,
): DemoStepOptions {
  const buttons: DemoTourButton[] = [];
  if (handlers.hasPrev) {
    // `secondary: true` is what adds `shepherd-button-secondary`; passing the
    // class as well would be duplicating what the option already does.
    buttons.push({ text: "Zurück", action: handlers.onPrev, secondary: true });
  }
  if (handlers.hasNext) {
    buttons.push({ text: "Weiter", action: handlers.onNext });
  } else {
    // The last step. Without this the footer holds "Back" and nothing else, so
    // the tour makes its offer and then gives the visitor no way to take it —
    // on the one screen whose entire job is conversion.
    //
    // "Start over" is present even when a booking link is configured, because
    // the alternative is a terminal step with a single button that leaves the
    // site. Someone who reached the end and wants to re-check a chapter should
    // not have to reach for the browser's back button.
    if (step.cta) {
      const { href, label } = step.cta;
      buttons.push({
        text: label,
        // noopener,noreferrer for the same reason the anchor form carried
        // rel="noopener noreferrer": the opened page gets no handle on this one.
        action: () => window.open(href, "_blank", "noopener,noreferrer"),
      });
    }
    buttons.push({
      text: "Von vorn",
      action: handlers.onRestart,
      secondary: Boolean(step.cta),
    });
  }

  return {
    id: step.id,
    title: step.title,
    // Shepherd's `text` takes an HTML string, which is how the schematic gets
    // in without a custom renderer. The content is static and lives in this
    // repo — no visitor input reaches it — so there is nothing to escape.
    //
    // The drawings are dark lines on transparency. `.shepherd-text img` in
    // shepherd-theme.css inverts them under `.dark`, so one asset serves both
    // themes rather than two files that can drift apart.
    //
    // Interim: an HTML string built from the blocks. Task 4 replaces this
    // whole property with a thunk returning a React-rendered element; until
    // then this keeps the tour looking exactly as it did before the copy
    // became data.
    text: step.content.map(blockToHtml).join(""),
    // A step with no anchor is a full-screen beat (chapter openers, the
    // knowledge-item reveal). Shepherd centres those, which is what we want.
    ...(step.anchor
      ? {
          // "bottom" is a preference, not a constraint: Shepherd runs
          // floating-ui's flip middleware, so a step anchored to something at
          // the bottom of the viewport — the chat composer — flips above it
          // instead of rendering off-screen.
          attachTo: {
            element: `[data-demo-id="${step.anchor}"]`,
            on: (step.placement ?? "bottom") as PopperPlacement,
          },
          waitForElement: ANCHOR_WAIT_MS,
          // Chapter 3 points at a 55-row glossary well below the fold. Without
          // this the popover opens against an element nobody can see.
          //
          // "nearest", never "center". Shepherd passes these straight to
          // scrollIntoView on the target, and chapter 1's target is the
          // composer, which sits at the BOTTOM of its scroll container.
          // Centring it scrolls that container down by several hundred pixels
          // to put it in the middle, taking the session header out of view and
          // leaving empty space below — the layout is untouched, the container
          // is simply scrolled. "nearest" moves the minimum needed and does
          // nothing when the target is already visible, which still satisfies
          // the glossary case above.
          //
          // Note this scrolls the nearest scrollable ANCESTOR, not the window,
          // so it leaves scrollY at 0 and the document no taller than the
          // viewport — the two things I kept measuring to rule it out.
          scrollTo: { behavior: "auto", block: step.scrollBlock ?? "nearest" },
        }
      : {}),
    // The composer is an anchor the visitor is asked to TYPE into (chapters 1
    // and 4). Blocking clicks on the target would make those steps impossible
    // to complete — the demo would highlight the box and refuse the keystroke.
    canClickTarget: true,
    modalOverlayOpeningPadding: 4,
    buttons,
  };
}

/**
 * The whole tour, in Shepherd's order.
 *
 * Each step's buttons navigate to a target derived from THAT STEP'S OWN
 * position, computed once here. Shepherd holds these closures for the lifetime
 * of the tour while the URL changes underneath it, so a button that asked
 * "where am I now?" would be reading a position captured when the tour was
 * built. Asking "where does this step go?" has no such lifetime problem — the
 * structure is static.
 */
export function shepherdStepsFor(
  chapters: DemoChapter[],
  navigate: (target: TourPosition) => void,
): DemoStepOptions[] {
  return chapters.flatMap((chapter) =>
    chapter.steps.map((step, index) => {
      const position: TourPosition = { chapter: chapter.id, step: index };
      const forward = nextPosition(chapters, position);
      const back = prevPosition(chapters, position);

      return shepherdStepFor(step, {
        onNext: () => {
          if (forward) navigate(forward);
        },
        onPrev: () => {
          if (back) navigate(back);
        },
        onRestart: () => navigate({ chapter: chapters[0].id, step: 0 }),
        hasNext: Boolean(forward),
        hasPrev: Boolean(back),
      });
    }),
  );
}
