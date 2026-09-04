"use client";

import { AnimatePresence, motion } from "framer-motion";

import { nextPosition, prevPosition } from "@/lib/demo/tour";

import { StepPanel } from "./step-panel";
import { useTour } from "./tour-provider";

/**
 * Full-bleed steps, rendered outside Shepherd.
 *
 * A cinematic opening is not a popover over a dimmed application, and pushing
 * one through Shepherd's positioning would be fighting the tool for nothing:
 * there is no anchor to attach to, no flip to compute, no cutout to punch.
 *
 * Renders nothing at all for popover steps, which is what keeps the two
 * systems from ever being on screen together.
 */
export function TourStage() {
  const { step, next, prev, jumpTo, position, chapters } = useTour();
  const isStage = step?.kind === "stage";

  // The same two functions the Shepherd footer (lib/demo/shepherd-step.ts)
  // asks for its own hasPrev/hasNext, rather than a hand-rolled duplicate of
  // that logic living here as well — the two are the single source of truth
  // for "is there another step in that direction" and must never disagree.
  const hasPrev = Boolean(prevPosition(chapters, position));
  const hasNext = Boolean(nextPosition(chapters, position));

  return (
    // Outer AnimatePresence + a motion.div keyed "tour-stage" — not a plain
    // div — so the backdrop's UNMOUNT (isStage flipping to false) can fade
    // instead of cutting instantly. The key is stable across every stage
    // step, never step.id, so a stage->stage transition (isStage true
    // throughout) never remounts this element and never re-triggers its own
    // enter/exit animation — only the inner content below, keyed on step.id,
    // crossfades in that case.
    //
    // This backdrop IS the opaque takeover, so it must never sit below
    // opacity 1 ON ENTER or BETWEEN stages. A stage's whole premise is that
    // the product UI behind it is not visible — chapter 1 opens on the
    // customer's problem with no product on screen — and that only holds if
    // bg-background sits at opacity 1 for the entire time any stage is
    // showing, transitions included. `initial` is pinned to the same value as
    // `animate` (both opacity 1) for exactly that reason: framer-motion still
    // runs an "enter" pass on mount, and if initial were 0 that pass would be
    // a visible fade-in, briefly showing the app through the backdrop on the
    // tour's very first stage and on every popover -> stage hand-off.
    //
    // This used to be a motion.div with a fade on both enter AND exit,
    // wrapped in a bare <AnimatePresence> with no `mode`. With no mode,
    // AnimatePresence ran the exiting step's exit and the entering step's
    // initial/animate concurrently, so for the ~300ms transition BOTH stacked
    // copies of this element sat below opacity 1 at once: the product UI
    // showed through the gap, and the two steps' German titles were both
    // partially visible and overlapping. Chapter 1 (daten-pile ->
    // daten-problem) is exactly that transition, so the bug sat right on the
    // tour's opening beat. That regression is what pinned initial === animate
    // above and moved the crossfade to the inner content div instead — the
    // outgoing content finishes fading out before the incoming content starts
    // fading in (AnimatePresence mode="wait" below), while the backdrop
    // itself persists underneath, unanimated, across that whole exchange, so
    // whatever brief gap exists shows this opaque backdrop, never the app.
    //
    // EXIT is the one direction that regression's fix must not also kill: a
    // conditional `if (!isStage || !step) return null` unmounts this element
    // synchronously the instant the tour leaves its last stage step, and two
    // of the three stage->popover hand-offs (chapter "daten" -> "struktur",
    // "aufnahme" -> "zugriff") cross a route boundary — so an instant unmount
    // flashes the destination route's empty/loading chat screen for a frame
    // before it finishes loading. Revealing the app IS correct once the tour
    // is actually leaving every stage; it should just fade rather than cut.
    // `exit={{ opacity: 0 }}` on this element is what restores that fade
    // without reopening the enter/between-stages bug above, because exit only
    // fires when this motion.div actually unmounts (isStage/step going
    // false) — a stage->stage transition never unmounts it, so it never
    // triggers this animation.
    <AnimatePresence>
      {isStage && step ? (
        <motion.div
          key="tour-stage"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          // justify-start + overflow-y-auto rather than justify-center: a
          // stage can carry a figure plus several blocks with no height cap
          // (StepPanel imposes none), and a centred, non-scrolling container
          // pushes overflow off BOTH edges — including the "Weiter" button,
          // with nothing behind an opaque full-bleed overlay to reach it
          // through. justify-start pins the top of the content so a tall
          // stage scrolls from there instead of clipping into negative space.
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-start overflow-y-auto bg-background p-8"
          role="dialog"
          aria-modal="true"
          aria-label={step.title}
        >
          <AnimatePresence mode="wait">
            {/* key belongs here, on the content that crossfades between
                stage steps — see the outer comment for why the backdrop
                above uses a different, stable key instead. */}
            <motion.div
              key={step.id}
              // my-auto keeps the centred look for content that fits: an auto
              // margin on the flex item's block axis absorbs whatever space is
              // left over, so it reads as centred exactly when there is slack to
              // centre it in. When the content is taller than the viewport, auto
              // margins collapse to 0 and the container's own overflow-y-auto
              // takes over — nothing is lost, it scrolls instead of clipping.
              className="my-auto flex w-full max-w-3xl flex-col items-center gap-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="w-full">
                <h2 className="mb-4 text-3xl font-semibold">{step.title}</h2>
                <StepPanel step={step} />
              </div>
              {/* Its own footer: a stage never reaches Shepherd, so it never gets
                  Shepherd's buttons. Back is shared verbatim with the Shepherd
                  footer's handler and its hasPrev/hasNext test above. Weiter is
                  NOT shared past that: shepherdStepFor (lib/demo/shepherd-step.ts)
                  drops it on the tour's last step and offers a cta (if any) plus
                  "Von vorn" instead, because a Weiter that calls next() into a
                  null position does nothing — "rendering a dead button is worse
                  than rendering none" per that file's own comment. Mirrored here
                  rather than shared as code because Shepherd's version also
                  has to build shepherd.js button objects, which this component
                  has no use for. */}
              <div className="flex gap-3">
                {hasPrev ? (
                  <button type="button" className="shepherd-button shepherd-button-secondary" onClick={prev}>
                    Zurück
                  </button>
                ) : null}
                {hasNext ? (
                  <button type="button" className="shepherd-button" onClick={next}>
                    Weiter
                  </button>
                ) : (
                  (() => {
                    const cta = step.cta;
                    return (
                      <>
                        {cta ? (
                          <button
                            type="button"
                            className="shepherd-button"
                            onClick={() => window.open(cta.href, "_blank", "noopener,noreferrer")}
                          >
                            {cta.label}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={`shepherd-button${cta ? " shepherd-button-secondary" : ""}`}
                          onClick={() => jumpTo(chapters[0].id)}
                        >
                          Von vorn
                        </button>
                      </>
                    );
                  })()
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
