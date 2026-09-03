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
    <AnimatePresence>
      {isStage && step ? (
        <motion.div
          key={step.id}
          // justify-start + overflow-y-auto rather than justify-center: a
          // stage can carry a figure plus several blocks with no height cap
          // (StepPanel imposes none), and a centred, non-scrolling container
          // pushes overflow off BOTH edges — including the "Weiter" button,
          // with nothing behind an opaque full-bleed overlay to reach it
          // through. justify-start pins the top of the content so a tall
          // stage scrolls from there instead of clipping into negative space.
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-start overflow-y-auto bg-background p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          role="dialog"
          aria-modal="true"
          aria-label={step.title}
        >
          {/* my-auto keeps the centred look for content that fits: an auto
              margin on the flex item's block axis absorbs whatever space is
              left over, so it reads as centred exactly when there is slack to
              centre it in. When the content is taller than the viewport, auto
              margins collapse to 0 and the container's own overflow-y-auto
              takes over — nothing is lost, it scrolls instead of clipping. */}
          <div className="my-auto flex w-full max-w-3xl flex-col items-center gap-8">
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
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
