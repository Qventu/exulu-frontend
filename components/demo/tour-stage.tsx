"use client";

import { AnimatePresence, motion } from "framer-motion";

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
  const { step, next, prev, position, chapters } = useTour();
  const isStage = step?.kind === "stage";

  const hasPrev =
    position.step > 0 || chapters.findIndex((c) => c.id === position.chapter) > 0;

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
                Shepherd's buttons. Same handlers, so Back and Weiter behave
                identically on both kinds of step. */}
            <div className="flex gap-3">
              {hasPrev ? (
                <button type="button" className="shepherd-button shepherd-button-secondary" onClick={prev}>
                  Zurück
                </button>
              ) : null}
              <button type="button" className="shepherd-button" onClick={next}>
                Weiter
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
