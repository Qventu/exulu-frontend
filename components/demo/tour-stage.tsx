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
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-8 bg-background p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          role="dialog"
          aria-modal="true"
          aria-label={step.title}
        >
          <div className="w-full max-w-3xl">
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
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
