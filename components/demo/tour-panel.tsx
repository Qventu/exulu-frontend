"use client";

import { useEffect, useState } from "react";

import { StepPanel } from "./step-panel";
import { useTour } from "./tour-provider";

/**
 * The tour, as a docked panel.
 *
 * Deliberately NOT positioned. It is a flex sibling of <main>, so the content
 * area narrows to make room instead of being covered. Everything the old
 * presentation fought over — z-index against Radix, pointer-events inherited
 * from a modal <body>, a collision probe walking a floating bubble up the
 * screen — stops being possible rather than being fixed again.
 *
 * The chapter menu lives in here for the same reason: as a separate floating
 * element it was the thing that broke against the agent wizard's dialog.
 */
export function TourPanel() {
  const { position, step, chapters, next, prev, jumpTo } = useTour();
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Detail is asked for per step, not switched on once. Collapsing on
  // navigation keeps the default state short, which is the point of the split.
  useEffect(() => {
    setExpanded(false);
    setMenuOpen(false);
  }, [position.chapter, position.step]);

  // Mirrors `expanded` onto <body> as a data attribute. app/globals.css's
  // --tour-panel-w (how much of the right edge portalled dialogs, e.g. the
  // chapter-7 wizard, must stay clear of) needs to grow from 380px to
  // 560px whenever this panel is expanded, and this client-only useState
  // has no way to reach that server-rendered <body> or its stylesheet
  // without being reflected onto the DOM explicitly like this.
  //
  // KEEP IN SYNC: 380/560 appear three times — here (conceptually, via
  // this attribute), in the md:w-[380px]/md:w-[560px] classes on the
  // <aside> below, and in app/globals.css's --tour-panel-w rule. Tailwind
  // arbitrary values can't read a shared constant at build/runtime, so
  // this duplication is unavoidable — if you change one of the three,
  // change all three, or a portalled dialog will overlap the panel again.
  useEffect(() => {
    document.body.setAttribute("data-demo-panel-expanded", String(expanded));
  }, [expanded]);

  if (!step) return null;

  const index = chapters.findIndex((c) => c.id === position.chapter);
  const chapter = chapters[index];
  const hasDetail = step.content.length > 0;

  return (
    <aside
      data-demo-id="tour-panel"
      // KEEP IN SYNC with app/globals.css's --tour-panel-w rule (380/560)
      // and the data-demo-panel-expanded effect above — see its comment.
      className={`flex shrink-0 flex-col border-t bg-card md:border-l md:border-t-0 ${
        expanded ? "md:w-[560px]" : "md:w-[380px]"
      } max-h-[45vh] w-full overflow-y-auto md:max-h-none`}
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <button type="button" onClick={() => setMenuOpen((v) => !v)} className="text-xs font-medium text-muted-foreground">
          Kapitel {index + 1} von {chapters.length} · {chapter?.title}
        </button>
        <span className="text-xs text-muted-foreground">
          {position.step + 1}/{chapter?.steps.length}
        </span>
      </div>

      {menuOpen && (
        <ul className="border-b">
          {chapters.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => jumpTo(c.id)}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-accent ${i === index ? "font-medium" : ""}`}
              >
                {i + 1}. {c.title}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex grow flex-col gap-4 p-4">
        <h2 className="text-lg font-semibold">{step.title}</h2>
        {step.lead && <p className="text-sm text-muted-foreground">{step.lead}</p>}
        {expanded && hasDetail && <StepPanel step={step} />}
        {hasDetail && (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="self-start text-sm underline">
            {expanded ? "Weniger" : "Mehr"}
          </button>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t p-4">
        <button type="button" onClick={prev} className="demo-button demo-button-secondary">Zurück</button>
        {step.cta ? (
          <a href={step.cta.href} className="demo-button">{step.cta.label}</a>
        ) : (
          <button type="button" onClick={next} className="demo-button">Weiter</button>
        )}
      </div>
    </aside>
  );
}
