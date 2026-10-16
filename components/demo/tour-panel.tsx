"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { footerControls } from "@/lib/demo/panel-controls";
import { railSegments } from "@/lib/demo/panel-rail";
import { nextPosition } from "@/lib/demo/tour";
import { DEMO_BOOKING_LABEL } from "@/lib/demo/routes";
import { panelBookingUrl } from "@/lib/demo/booking";

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
 * ONE width, and the step's copy always on screen. The first docked version
 * hid every explanation behind a "Mehr" toggle and showed a headline over
 * 700px of nothing on 33 of 37 steps; a visitor who only pressed Weiter —
 * the visitor the tour is built for — read 37 titles and nothing else.
 *
 * The chapter menu lives in here for the same reason as the panel itself:
 * as a separate floating element it was the thing that broke against the
 * agent wizard's dialog. The rail above it is the visible version of the
 * same information — where you are, what is left — and each segment jumps.
 *
 * DOM order: the panel is rendered BEFORE <main> (app/(application)/
 * layout.tsx) and placed last by `order-last`, so Tab reaches Zurück and
 * Weiter in a few presses instead of walking the inert sidebar and product
 * first. The rail segments are tabIndex -1 for the same reason — the text
 * menu is the keyboard route to a chapter.
 */
export function TourPanel() {
  const { position, step, chapters, next, prev, jumpTo } = useTour();
  // The position the menu was opened AT. Deriving `menuOpen` from it means
  // any navigation — Weiter, Zurück, a rail segment, a menu item — closes the
  // menu without an effect: the key no longer matches.
  const [menuOpenAt, setMenuOpenAt] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  if (!step) return null;

  const index = chapters.findIndex((c) => c.id === position.chapter);
  const chapter = chapters[index];
  const segments = railSegments(chapters, position);
  const controls = footerControls({
    hasCta: !!step.cta,
    isLast: nextPosition(chapters, position) === null,
  });
  const positionKey = `${position.chapter}.${position.step}`;
  // Empty when the booking link is unset — then no link renders (routes.ts).
  // The utm_medium names this step, so a booking says where the click came from.
  const bookingHref = panelBookingUrl(index + 1, step.id);
  const menuOpen = menuOpenAt === positionKey;

  return (
    <aside
      data-demo-id="tour-panel"
      // KEEP IN SYNC with app/globals.css's --tour-panel-w rule (420px) —
      // Tailwind arbitrary values cannot read a shared constant.
      //
      // Sticky, in both directions, because the panel is a flex sibling of
      // <main> in normal flow: nothing pins it. The row's height is
      // content-driven, so a tall page scrolls the DOCUMENT and would take
      // the panel with it. md and up: `top-12` clears the fixed h-12 TopBar,
      // and the explicit height plus self-start is what makes sticky bite.
      // Below md the row is a column and `order-last` puts the panel after
      // the content; `bottom-0` docks it to the bottom edge.
      //
      // overflow-hidden here, overflow-y-auto on the BODY below: the header
      // and the Zurück/Weiter footer stay put and only the step's copy
      // scrolls. With the whole aside scrolling, a figure step at 1366×768
      // (~815px of panel against 720px available) pushed Weiter below the
      // fold, and below md every content step did.
      //
      // z-40: above the spotlight ring (z-30), below Radix's z-50 portals,
      // which app/globals.css insets by --tour-panel-w instead.
      className="order-last sticky bottom-0 z-40 flex max-h-[45vh] w-full shrink-0 flex-col overflow-hidden border-t bg-card md:bottom-auto md:top-12 md:h-[calc(100svh-3rem)] md:max-h-none md:w-[420px] md:self-start md:border-l md:border-t-0"
    >
      <div className="shrink-0 border-b px-4 pb-3 pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            OPEN IMP · Geführte Tour
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            Kapitel {index + 1} von {chapters.length} · Schritt {position.step + 1}/{chapter.steps.length}
          </span>
        </div>

        <ol className="mt-1 flex gap-1" aria-label="Kapitel">
          {segments.map((s) => (
            <li key={s.id} className="flex-1">
              {/* The bar is the visual; the button around it is the target.
                  A 6px-tall button was too fiddly to hit with a mouse. */}
              <button
                type="button"
                tabIndex={-1}
                title={`${s.index + 1}. ${s.title}`}
                aria-label={`${s.index + 1}. ${s.title}`}
                aria-current={s.state === "current" ? "step" : undefined}
                onClick={() => jumpTo(s.id)}
                className="block w-full py-2"
              >
                <span
                  className={`block h-1.5 w-full rounded-sm transition-colors ${
                    s.state === "current"
                      ? "bg-primary"
                      : s.state === "past"
                        ? "bg-muted-foreground/60"
                        : "bg-muted"
                  }`}
                />
              </button>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={() => setMenuOpenAt(menuOpen ? null : positionKey)}
          aria-expanded={menuOpen}
          aria-controls="demo-chapter-menu"
          aria-label={menuOpen ? "Schließen" : "Alle Kapitel"}
          className="mt-1 flex w-full items-baseline justify-between gap-2 text-left"
        >
          <span className="text-sm font-medium">{chapter.title}</span>
          <span className="text-xs text-muted-foreground">{menuOpen ? "Schließen" : "Alle Kapitel"}</span>
        </button>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{chapter.goal}</p>
      </div>

      <div className="flex min-h-0 grow flex-col overflow-y-auto">
      {menuOpen && (
        <ul id="demo-chapter-menu" className="shrink-0 border-b">
          {chapters.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  setMenuOpenAt(null);
                  jumpTo(c.id);
                }}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-accent ${i === index ? "font-medium" : ""}`}
              >
                {i + 1}. {c.title}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Keyed on the position so each step enters fresh: a 250ms rise-and-
          fade is what turns a hard cut into a sequence. `initial={false}`
          under reduced motion renders the resting state immediately. */}
      <motion.div
        key={positionKey}
        className="flex flex-col gap-4 p-4"
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <h2 className="text-lg font-semibold leading-snug">{step.title}</h2>
        {step.lead && <p className="text-sm text-muted-foreground">{step.lead}</p>}
        {step.content.length > 0 && <StepPanel content={step.content} />}
      </motion.div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t p-4">
        {controls.includes("back") && (
          <button type="button" onClick={prev} className="demo-button demo-button-secondary">Zurück</button>
        )}
        {controls.includes("cta") && step.cta && (
          <a href={step.cta.href} className="demo-button">{step.cta.label}</a>
        )}
        {controls.includes("next") && (
          <button type="button" onClick={next} className="demo-button">Weiter</button>
        )}
        {/* The booking link on every step but the last (which has the button).
            Last in DOM so Tab reaches Weiter in the same three presses; first
            visually, at the far left (order-first + mr-auto). */}
        {bookingHref && !step.cta && (
          <a
            href={bookingHref}
            className="order-first mr-auto text-sm text-primary underline underline-offset-4"
            data-demo-id="tour-booking-link"
          >
            {DEMO_BOOKING_LABEL}
          </a>
        )}
      </div>
    </aside>
  );
}
