"use client";

import { useState } from "react";

import { useTour } from "./tour-provider";

/**
 * The chapter menu.
 *
 * Deliberately NOT a second set of Back/Next controls: Shepherd renders the
 * active step's title, body and navigation in its popover. This is only the
 * thing Shepherd has no concept of — jumping between the seven chapters, so a
 * prospect who cares about one scenario can go straight to it.
 */
export function TourBubble() {
  const { chapters, position, jumpTo } = useTour();
  const [open, setOpen] = useState(false);

  const currentIndex = chapters.findIndex((c) => c.id === position.chapter);
  const stepCount = chapters[currentIndex]?.steps.length ?? 1;
  const hasMoreInChapter = position.step < stepCount - 1;
  const nextChapter = chapters[currentIndex + 1];

  return (
    // Above Shepherd's own layers, which are fixed in its stylesheet: the
    // popover sits at 9999 and the modal overlay at 9997. The menu has to
    // clear both or it is buried by the overlay it is meant to escape.
    <div className="fixed bottom-6 right-6 z-[10000] w-72">
      {open && (
        <ul className="mb-2 overflow-hidden rounded-lg border bg-popover shadow-lg">
          {chapters.map((chapter, index) => {
            const isCurrent = index === currentIndex;
            return (
              <li key={chapter.id}>
                <button
                  type="button"
                  aria-current={isCurrent ? "step" : undefined}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                    isCurrent
                      ? "bg-accent/60 font-medium text-foreground"
                      : "text-muted-foreground"
                  }`}
                  onClick={() => {
                    jumpTo(chapter.id);
                    setOpen(false);
                  }}
                >
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                      index < currentIndex
                        ? "bg-primary/15 text-primary"
                        : isCurrent
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {index + 1}
                  </span>
                  {chapter.title}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg border bg-popover px-4 py-3 text-sm font-medium shadow-lg transition-colors hover:bg-accent hover:text-accent-foreground"
        onClick={() => setOpen((o) => !o)}
      >
        <span>Tour</span>
        <span className="text-xs font-normal text-muted-foreground">
          {/* Chapter AND step. "3 of 9" alone hid how much of a chapter was
              left, and chapters run from one step to five — a visitor entering
              a five-step chapter had no way to know they had signed up for
              four more clicks. That not-knowing is most of what made the tour
              feel long. */}
          {currentIndex + 1} von {chapters.length}
          {stepCount > 1 ? (
            <span className="ml-1 opacity-70">
              · {position.step + 1}/{stepCount}
            </span>
          ) : null}
          <span aria-hidden className="ml-2">
            {open ? "▾" : "▴"}
          </span>
        </span>
      </button>

      {/* Skip the rest of this chapter.
          Only while there IS a rest of it, and never on the last chapter —
          a control that does nothing is worse than no control. A prospect who
          only cares about two chapters should not have to click through the
          other seven, and the jump menu above is a deliberate act they have to
          think about first. */}
      {hasMoreInChapter && nextChapter ? (
        <button
          type="button"
          // Opaque like the bubble above it. Transparent, this sat directly
          // over table rows and buttons on /data and /transcriptions and was
          // illegible — the reviewer hit it on both.
          className="mt-1 w-full rounded-lg border bg-popover px-4 py-2 text-left text-xs text-muted-foreground shadow-lg transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={() => jumpTo(nextChapter.id)}
        >
          Kapitel überspringen: {nextChapter.title} →
        </button>
      ) : null}
    </div>
  );
}
