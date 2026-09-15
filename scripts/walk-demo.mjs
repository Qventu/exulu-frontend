#!/usr/bin/env node
/**
 * Walks every step of the demo tour in a real browser and asserts the
 * property the docked-panel redesign exists to guarantee: the tour panel
 * and the product content never occupy the same pixels.
 *
 * Per step this asserts:
 *   1. panelVisible   — the docked panel (`[data-demo-id="tour-panel"]`) has
 *                        real, nonzero layout.
 *   2. overlapsContent — FALSE. The panel's rect and `<main>`'s rect do not
 *                        intersect. This is the one this whole project exists
 *                        for — see `assertGeometry` below, which compares real
 *                        `getBoundingClientRect()` output and throws (not
 *                        `console.warn`s) on failure.
 *   3. coveringPanel  — FALSE. No hit-testable `position: fixed` element (a
 *                        portalled Radix dialog/backdrop, most likely) draws
 *                        on top of the panel.
 *   4. ringOk         — the spotlight ring shows up exactly when the step
 *                        declares an anchor, no more and no less, AND sits on
 *                        that anchor rather than somewhere else on screen.
 *   5. Non-operability + scrollability — see `runClickProbe` and
 *                        `runScrollProbe`. Both are deliberately NOT "click
 *                        the first thing and hope": see their docblocks for
 *                        why each probe is a real test rather than a no-op.
 *
 * ── Getting the step list ───────────────────────────────────────────────
 * The 37 steps are never hardcoded here. This script shells out to
 * `npx tsx scripts/dump-demo-steps.ts`, which imports `CHAPTERS` and
 * `hrefFor` straight from lib/demo/tour.ts, so the walker cannot drift out
 * of sync with the chapters — reorder or add a step there and this script
 * picks it up on its next run with no edit here.
 *
 * ── Running it ───────────────────────────────────────────────────────────
 * Playwright is NOT a dependency of this repo and must stay that way (no
 * browser automation belongs in package.json for a product that ships to
 * users). Install it once anywhere, e.g.:
 *
 *   mkdir -p /tmp/pw-demo-walk && cd /tmp/pw-demo-walk && npm init -y \
 *     && npm install playwright && npx playwright install chromium
 *
 * Then build and serve the app in demo mode:
 *
 *   NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build
 *   NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next start -p 3111
 *
 * Then, from the SAME directory you installed Playwright into (this is what
 * makes `require("playwright")` below resolve — see `resolvePlaywright()`),
 * run this script by absolute path:
 *
 *   cd /tmp/pw-demo-walk && node /path/to/frontend/scripts/walk-demo.mjs
 *
 * Override the target with DEMO_BASE_URL (default http://localhost:3111) and
 * the Playwright install directory with PLAYWRIGHT_DIR (default: cwd).
 * Screenshots and a JSON results dump land next to this script's
 * OUT_DIR (default: a `walk-demo-out` directory under the Playwright dir).
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const BASE_URL = process.env.DEMO_BASE_URL ?? "http://localhost:3111";
const PLAYWRIGHT_DIR = process.env.PLAYWRIGHT_DIR ?? process.cwd();
const OUT_DIR = process.env.WALK_OUT_DIR ?? path.join(PLAYWRIGHT_DIR, "walk-demo-out");

/**
 * Resolves the `playwright` package from PLAYWRIGHT_DIR rather than from
 * this script's own location, because this script lives in the repo (which
 * deliberately has no Playwright) while Playwright lives wherever the
 * operator installed it (a scratch directory, by design — see the module
 * docblock). `createRequire` scoped to a fake file *inside* PLAYWRIGHT_DIR
 * walks up node_modules from there, exactly like requiring "playwright"
 * from a script that actually lived in that directory would.
 */
function resolvePlaywright() {
  const req = createRequire(path.join(PLAYWRIGHT_DIR, "__walk-demo__.cjs"));
  try {
    return req("playwright");
  } catch (err) {
    console.error(
      `Could not resolve "playwright" from ${PLAYWRIGHT_DIR}.\n` +
        `Install it there (see this script's header comment for the exact ` +
        `commands) and either run this script with that directory as your ` +
        `cwd, or set PLAYWRIGHT_DIR to it.\n`,
    );
    throw err;
  }
}

/**
 * The 37 steps, derived from lib/demo/chapters via scripts/dump-demo-steps.ts
 * — never hardcoded. Spawning `tsx` (rather than importing the .ts file
 * directly into this plain .mjs process) sidesteps needing a TypeScript
 * loader wired into this script itself.
 */
function loadSteps() {
  const out = execFileSync(
    "npx",
    ["tsx", "scripts/dump-demo-steps.ts"],
    { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  return JSON.parse(out);
}

// ── In-page assertion code ────────────────────────────────────────────────

/**
 * THE property this whole project exists for, verbatim from the task brief:
 * real `getBoundingClientRect()` rects, compared, with no try/catch around
 * the comparison — if `panel` or `main` is missing this throws, which is
 * what we want: a missing panel on a demo route is a real failure, not
 * something to swallow into a false "pass".
 */
function assertGeometry(anchor) {
  const panel = document.querySelector('[data-demo-id="tour-panel"]');
  const main = document.querySelector("main");
  if (!panel) throw new Error("tour-panel not found in DOM");
  if (!main) throw new Error("main not found in DOM");
  const p = panel.getBoundingClientRect();
  const m = main.getBoundingClientRect();
  const ring = document.querySelector('[data-demo-id="tour-ring"]');
  const anchorEl = anchor ? document.querySelector(`[data-demo-id="${anchor}"]`) : null;
  // The ring is drawn 4px outside its anchor on every side (tour-ring.tsx).
  // "On the anchor" therefore means exactly that offset, with a px of slack
  // for subpixel layout — NOT "roughly near it": the bug this catches put it
  // a whole sheet-width away.
  //
  // Read from the ring's INLINE STYLE, which is where tour-ring.tsx writes the
  // position it computed, not from its rect: the ring also carries a
  // `transition-all duration-200`, so for a fifth of a second after any move
  // its rect is wherever the animation has got to. Asserting on the rect made
  // this report a correctly-aimed ring as misplaced whenever the read landed
  // inside that window (a smooth scrollIntoView keeps it moving for longer
  // than the transition itself).
  const ringOnAnchor = (() => {
    if (!ring || !anchorEl) return null;
    const a = anchorEl.getBoundingClientRect();
    const left = parseFloat(ring.style.left);
    const top = parseFloat(ring.style.top);
    if (Number.isNaN(left) || Number.isNaN(top)) return false;
    return Math.abs(left + 4 - a.left) <= 1 && Math.abs(top + 4 - a.top) <= 1;
  })();
  return {
    panelVisible: p.width > 0 && p.height > 0,
    overlapsContent: p.left < m.right && p.right > m.left && p.top < m.bottom && p.bottom > m.top,
    ringPresent: !!ring,
    ringOnAnchor,
    // Scoped to elements that could actually TAKE the panel over: a portalled
    // Radix dialog or backdrop. The tour's own ring is excluded — it is
    // pointer-events: none, so it cannot intercept anything, and it is sized
    // from a product anchor, so an anchor flush with the content area's right
    // edge (the /transcriptions list) puts its 4px outline 4px into the
    // panel's border. That is not this assertion's hazard; a ring in the
    // wrong PLACE is, and ringOnAnchor above measures that directly.
    coveringPanel: [...document.querySelectorAll("body *")].some((e) => {
      if (e === panel || panel.contains(e) || e.contains(panel)) return false;
      if (e === ring) return false;
      const cs = getComputedStyle(e);
      if (cs.position !== "fixed" || cs.visibility === "hidden" || cs.display === "none") return false;
      if (cs.pointerEvents === "none") return false;
      const r = e.getBoundingClientRect();
      return r.width > 100 && r.left < p.right && r.right > p.left && r.top < p.bottom && r.bottom > p.top;
    }),
    panelRect: { left: p.left, right: p.right, top: p.top, bottom: p.bottom, width: p.width, height: p.height },
    mainRect: { left: m.left, right: m.right, top: m.top, bottom: m.bottom, width: m.width, height: m.height },
  };
}

/**
 * Locates the element a CLICK_PROBES entry describes and tags it with a
 * throwaway attribute so Playwright can click it with a real, CDP-dispatched
 * mouse click (not a synthetic `.click()` call from inside the page, which
 * would skip the realism of an actual pointer event even though it happens
 * to also cross ContentInert's capture-phase listener).
 *
 * kind: "nav-link"       — the first sidebar link whose href differs from
 *                           the current path. Used only where the page has
 *                           no product-specific control (the four full-page
 *                           `/demo/szene/*` scenes): a real cross-page
 *                           `<a href>` is a genuine "would navigate" test,
 *                           not a no-op click.
 * kind: "css"            — first non-disabled match for a CSS selector.
 * kind: "text"           — first non-disabled match for `tag` inside
 *                           `containerSelector` whose text includes
 *                           `textIncludes`.
 * kind: "wizard-tab"     — a step tab inside the agent-editor wizard
 *                           ([data-demo-id="agent-wizard-steps"]) other than
 *                           the currently active one (identified by the
 *                           `bg-primary` class Radix has no aria for here).
 * kind: "tab"            — a `[role="tab"]` inside `containerSelector` with
 *                           `aria-selected="false"` (i.e. NOT the active tab
 *                           in its tablist).
 */
function locateProbe(spec) {
  document.querySelectorAll("[data-walk-probe]").forEach((e) => e.removeAttribute("data-walk-probe"));

  const nonDisabled = (els) => els.filter((e) => !("disabled" in e) || !e.disabled);

  let el = null;
  if (spec.kind === "nav-link") {
    const candidates = ["/chat", "/data", "/workflows", "/evals", "/transcriptions"];
    el = [...document.querySelectorAll("a[href]")].find(
      (a) => candidates.includes(a.getAttribute("href")) && a.getAttribute("href") !== location.pathname,
    );
  } else if (spec.kind === "css") {
    el = nonDisabled([...document.querySelectorAll(spec.selector)])[0];
  } else if (spec.kind === "text") {
    const root = document.querySelector(spec.containerSelector);
    if (root) {
      el = nonDisabled([...root.querySelectorAll(spec.tag)]).find((e) =>
        e.textContent.includes(spec.textIncludes),
      );
    }
  } else if (spec.kind === "wizard-tab") {
    const steps = [...document.querySelectorAll('[data-demo-id="agent-wizard-steps"] button')];
    el = steps.find((b) => !b.className.includes("bg-primary"));
  } else if (spec.kind === "tab") {
    const root = document.querySelector(spec.containerSelector) ?? document;
    el = [...root.querySelectorAll('[role="tab"][aria-selected="false"]')][0];
  }

  if (!el) return { ok: false };
  el.setAttribute("data-walk-probe", "1");
  return {
    ok: true,
    tag: el.tagName,
    text: el.textContent.trim().slice(0, 60),
    demoId: el.getAttribute("data-demo-id") ?? el.closest("[data-demo-id]")?.getAttribute("data-demo-id") ?? null,
  };
}

/**
 * A signature of "did anything happen", captured before and after the click.
 * Covers every failure mode the CLICK_PROBES table's choices can produce:
 * navigation (url), a dialog/sheet opening (dialogCount), a toast firing
 * (toastCount, e.g. the Copy button's "Copied" toast), a dropdown/select/
 * popover opening (popperCount), and the clicked control's own toggled state
 * (elState — aria-checked/data-state/aria-selected/aria-expanded), plus
 * whichever wizard-step or evals-tab panel is currently showing
 * (activePanelId), for the two probes that swap a sibling panel rather than
 * toggling their own state.
 */
function captureSignature() {
  const el = document.querySelector('[data-walk-probe="1"]');
  const tablist = el?.closest('[role="tablist"]');
  return {
    url: location.pathname + location.search,
    dialogCount: document.querySelectorAll('[role="dialog"]').length,
    toastCount: document.querySelectorAll("[data-sonner-toast]").length,
    popperCount: document.querySelectorAll("[data-radix-popper-content-wrapper]").length,
    elState: el
      ? {
          ariaChecked: el.getAttribute("aria-checked"),
          dataState: el.getAttribute("data-state"),
          ariaSelected: el.getAttribute("aria-selected"),
          ariaExpanded: el.getAttribute("aria-expanded"),
          text: el.textContent.trim().slice(0, 80),
        }
      : null,
    activeTabInSameList: tablist
      ? tablist.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim()
      : null,
    activePanelId:
      document
        .querySelector('[data-demo-id^="agent-wizard-"]:not([data-demo-id="agent-wizard-steps"])')
        ?.getAttribute("data-demo-id") ??
      document.querySelector('[data-demo-id="evals-matrix"], [data-demo-id="evals-cases"]')?.getAttribute(
        "data-demo-id",
      ) ??
      null,
  };
}

/** Finds a genuinely-overflowing scroller inside <main>, or null. */
function findScroller() {
  document.querySelectorAll("[data-walk-scroller]").forEach((e) => e.removeAttribute("data-walk-scroller"));
  const main = document.querySelector("main");
  if (!main) return null;
  // scrollHeight > clientHeight alone is not "genuine overflow" — a flex
  // layout wrapper with `overflow: hidden` and taller content than its box
  // matches that arithmetic too, but a wheel event over it can never scroll
  // anything (that's what overflow: hidden means). Require the computed
  // overflow to actually be auto/scroll, or the probe below is scrolling a
  // clipped wrapper and would "pass" regardless of whether ContentInert
  // does the right thing with wheel events.
  const canScroll = (cs) => cs.overflowY === "auto" || cs.overflowY === "scroll" || cs.overflow === "auto" || cs.overflow === "scroll";
  const s = [...main.querySelectorAll("*")].find(
    (e) => e.scrollHeight > e.clientHeight + 40 && canScroll(getComputedStyle(e)),
  );
  if (!s) return null;
  s.setAttribute("data-walk-scroller", "1");
  const r = s.getBoundingClientRect();
  return {
    tag: s.tagName,
    className: String(s.className).slice(0, 80),
    scrollTop: s.scrollTop,
    maxScrollTop: s.scrollHeight - s.clientHeight,
    rect: { x: r.x, y: r.y, width: r.width, height: r.height },
  };
}

// ── Per-step click probes ─────────────────────────────────────────────────
//
// The brief's own starting point — `page.locator("main a, main button").first()`
// — is explicitly called out as too weak: most of the first 20-odd elements
// on any of these pages (the sidebar's search button, the theme toggle, an
// avatar menu trigger) do nothing observable even when they DO fire, so a
// "URL didn't change" pass proves little. Every entry below instead names a
// control that has a real, checkable side effect if clicked for real, and
// `describe` is what actually lands in the report — see task-8-report.md
// for the per-step rationale.

const COPY_BUTTON = {
  attempts: [
    { spec: { kind: "text", containerSelector: '[data-demo-id="chat-messages"]', tag: "button", textIncludes: "Copy" },
      describe: "the assistant message's Copy action — for real this writes to the clipboard, flips its icon, and raises a \"Copied\" toast" },
    { spec: { kind: "nav-link" },
      describe: "fallback sidebar nav link (no assistant message with a Copy action was on screen yet)" },
  ],
};

const CLICK_PROBES = {
  "daten.0": { attempts: [{ spec: { kind: "nav-link" }, describe: "sidebar nav link to a different route — this scene is static prose with no product control, so a real cross-page link is the strongest available test" }] },
  "daten.1": { attempts: [{ spec: { kind: "nav-link" }, describe: "sidebar nav link to a different route (static scene, no product control)" }] },
  "struktur.0": { attempts: [
    { spec: { kind: "css", selector: '[data-demo-id="knowledge-contexts"] a[href]' }, describe: "a knowledge-context row link — would navigate to /data/<ctx>" },
    { spec: { kind: "nav-link" }, describe: "fallback nav link (struktur-empty has no context cards yet)" },
  ] },
  "struktur.1": { attempts: [{ spec: { kind: "css", selector: '[data-demo-id="knowledge-contexts"] a[href]' }, describe: "a knowledge-context row link — would navigate to /data/tech_doc_context" }] },
  "struktur.2": { attempts: [{ spec: { kind: "css", selector: '[data-demo-id="knowledge-contexts"] a[href]' }, describe: "a knowledge-context row link — would navigate to /data/tech_doc_context" }] },
  "aufnahme.0": { attempts: [{ spec: { kind: "text", containerSelector: "main", tag: "button", textIncludes: "Neues Element" }, describe: "'Neues Element' — would open the create-item dialog" }] },
  "aufnahme.1": { attempts: [{ spec: { kind: "text", containerSelector: "main", tag: "button", textIncludes: "Neues Element" }, describe: "'Neues Element' — would open the create-item dialog" }] },
  "aufnahme.2": { attempts: [{ spec: { kind: "nav-link" }, describe: "sidebar nav link (static scene, no product control)" }] },
  "aufnahme.3": { attempts: [{ spec: { kind: "text", containerSelector: "main", tag: "button", textIncludes: "Neues Element" }, describe: "'Neues Element' — would open the create-item dialog" }] },
  "zugriff.0": { attempts: [{ spec: { kind: "css", selector: '[data-demo-id="item-access"], [data-demo-id="item-access"] button' }, describe: "the item's access-control button — the very control this step spotlights — would open the access-editor popover" }] },
  "zugriff.1": { attempts: [{ spec: { kind: "nav-link" }, describe: "sidebar nav link (static scene, no product control)" }] },
  "techdoc.0": COPY_BUTTON,
  "techdoc.1": COPY_BUTTON,
  "techdoc.2": COPY_BUTTON,
  "memory.0": COPY_BUTTON,
  "memory.1": COPY_BUTTON,
  "memory.2": COPY_BUTTON,
  "memory.3": { attempts: [
    { spec: { kind: "text", containerSelector: "main", tag: "button", textIncludes: "Archiviert" }, describe: "'Archiviert' filter toggle — would switch the active/archived item filter" },
    { spec: { kind: "nav-link" }, describe: "fallback nav link" },
  ] },
  "config.0": { attempts: [{ spec: { kind: "css", selector: '[data-demo-id="agent-agentic-retrieval"] button[role="switch"]' }, describe: "the agentic-retrieval Switch — would toggle it off and flip the Enabled/Disabled badge" }] },
  "config.1": { attempts: [{ spec: { kind: "wizard-tab" }, describe: "a different wizard step tab — would swap the visible wizard panel away from Sources" }] },
  "config.2": { attempts: [{ spec: { kind: "wizard-tab" }, describe: "a different wizard step tab — would swap the visible wizard panel away from Routing" }] },
  "config.3": { attempts: [{ spec: { kind: "wizard-tab" }, describe: "a different wizard step tab — would swap the visible wizard panel away from Fachvokabular" }] },
  "config.4": { attempts: [{ spec: { kind: "wizard-tab" }, describe: "a different wizard step tab — would swap the visible wizard panel away from Verhalten" }] },
  "evals.0": { attempts: [{ spec: { kind: "text", containerSelector: '[data-demo-id="evals-suites"]', tag: "button", textIncludes: "Technical documentation regression" }, describe: "the eval-suite row — would navigate to its detail page" }] },
  "evals.1": { attempts: [{ spec: { kind: "text", containerSelector: "main", tag: "button", textIncludes: "Testfälle" }, describe: "the 'Testfälle' tab — would swap the results matrix for the test-cases panel" }] },
  "evals.2": { attempts: [{ spec: { kind: "text", containerSelector: "main", tag: "button", textIncludes: "Ergebnisse" }, describe: "the 'Ergebnisse' tab — would swap the test-cases panel back for the results matrix" }] },
  "email.0": { attempts: [{ spec: { kind: "css", selector: '[data-demo-id="routine-runs"] button[role="combobox"]' }, describe: "the 'Alle Status' filter combobox — would open its dropdown" }] },
  "email.1": { attempts: [{ spec: { kind: "css", selector: '[data-demo-id="routine-email-trigger"] button[role="switch"]' }, describe: "the trigger's enabled Switch — would toggle it off" }] },
  "email.2": { attempts: [{ spec: { kind: "css", selector: '[data-demo-id="routine-runs"] button[role="combobox"]' }, describe: "the 'Alle Status' filter combobox — would open its dropdown" }] },
  "meetings.0": { attempts: [{ spec: { kind: "text", containerSelector: '[data-demo-id="transcriptions"]', tag: "button", textIncludes: "Bearbeiten" }, describe: "'Bearbeiten' on a transcript row — would open its editor" }] },
  "meetings.1": { attempts: [{ spec: { kind: "text", containerSelector: '[data-demo-id="transcriptions"]', tag: "button", textIncludes: "Bearbeiten" }, describe: "'Bearbeiten' on a transcript row — would open its editor" }] },
  "meetings.2": { attempts: [
    { spec: { kind: "text", containerSelector: '[data-demo-id="meeting-guide"]', tag: "button", textIncludes: "Erneut ausführen" }, describe: "'Erneut ausführen' on a generated work instruction — would re-run it and show a loading spinner" },
    { spec: { kind: "text", containerSelector: '[data-demo-id="transcriptions"]', tag: "button", textIncludes: "Bearbeiten" }, describe: "fallback: 'Bearbeiten' on a transcript row" },
  ] },
  "kosten.0": { attempts: [{ spec: { kind: "tab", containerSelector: "main" }, describe: "a non-active Radix tab (range preset or measure) — would switch the selected view" }] },
  "kosten.1": { attempts: [{ spec: { kind: "tab", containerSelector: "main" }, describe: "a non-active budget-scope tab (Benutzer/Rollen/...) — would switch the budgets view away from Teams" }] },
  "kosten.2": { attempts: [{ spec: { kind: "tab", containerSelector: "main" }, describe: "a non-active budget-scope tab — would switch the budgets view away from Teams" }] },
  "contact.0": COPY_BUTTON,
  "contact.1": COPY_BUTTON,
};

async function runClickProbe(page, pos) {
  const entry = CLICK_PROBES[pos] ?? { attempts: [{ spec: { kind: "nav-link" }, describe: "fallback sidebar nav link" }] };

  // Retry across a short window rather than trying once: several probed
  // containers (a transcript list, an eval-suite table) render their own
  // GraphQL-backed rows a beat after the anchor/panel this step is already
  // waiting on has mounted, so a single immediate lookup raced real data
  // loading rather than testing anything about non-operability. This is a
  // harness timing fix, not a product one.
  let located = null;
  let describe = null;
  const findStart = Date.now();
  while (Date.now() - findStart < 6000 && !located?.ok) {
    for (const attempt of entry.attempts) {
      located = await page.evaluate(locateProbe, attempt.spec);
      if (located.ok) {
        describe = attempt.describe;
        break;
      }
    }
    if (!located?.ok) await page.waitForTimeout(500);
  }
  if (!located?.ok) {
    // A FAILURE, not an n/a. Unlike the scroll probe — where "this step has
    // no scrollable element" is a legitimate state of the page — every
    // product step has some operable control, so "no candidate found" means
    // the selector rotted (a renamed data-demo-id, a restructured table) and
    // this step's non-operability went UNTESTED. Folding that into PASS made
    // the branch's only executable guard on its headline property report a
    // rot as a proof.
    return { ran: false, describe: "no candidate element found for this step", pass: false };
  }

  // Hover and settle BEFORE capturing the baseline signature. Playwright's
  // .click() moves the mouse to the element first, same as a real user, and
  // several sidebar items are wrapped in a Radix Tooltip that opens on
  // hover-intent — capturing "before" pre-hover made that tooltip's
  // appearance look like a click effect (a `data-state="delayed-open"` and
  // an extra popper element that were never caused by the click at all).
  // Hovering here folds that into the baseline so the comparison isolates
  // what the CLICK itself did.
  const probeLocator = page.locator('[data-walk-probe="1"]').first();
  try {
    await probeLocator.hover({ force: true, timeout: 2000 });
  } catch {
    // Not hoverable (e.g. zero-size) — proceed anyway, click below still
    // exercises ContentInert the same way.
  }
  // Wait past Radix's hover-intent delay (~700ms) BEFORE polling for
  // stability, not from time zero: polling immediately can see the same
  // "closed" tooltip state twice in a row and call that "settled" a beat
  // before the tooltip actually opens, which then made the click look like
  // it caused the open. Two identical reads 300ms apart, after that initial
  // wait, is "settled"; 3s total is a hard ceiling.
  await page.waitForTimeout(900);
  let prevState = null;
  const settleStart = Date.now();
  while (Date.now() - settleStart < 2100) {
    const state = await page.evaluate(captureSignature);
    if (prevState && JSON.stringify(prevState) === JSON.stringify(state)) break;
    prevState = state;
    await page.waitForTimeout(300);
  }
  const before = await page.evaluate(captureSignature);
  const urlBefore = page.url();
  try {
    await probeLocator.click({ force: true, timeout: 2000 });
  } catch {
    // A timeout here (e.g. "element intercepts pointer events" from a modal
    // backdrop) is itself evidence the product is non-operable — fall
    // through to the signature comparison rather than treating it as a
    // harness error.
  }
  await page.waitForTimeout(500);
  const after = await page.evaluate(captureSignature);
  const urlAfter = page.url();

  const changed = [];
  if (urlBefore !== urlAfter) changed.push(`url ${urlBefore} -> ${urlAfter}`);
  if (before.dialogCount !== after.dialogCount) changed.push(`dialogCount ${before.dialogCount} -> ${after.dialogCount}`);
  if (before.toastCount !== after.toastCount) changed.push(`toastCount ${before.toastCount} -> ${after.toastCount}`);
  if (before.popperCount !== after.popperCount) changed.push(`popperCount ${before.popperCount} -> ${after.popperCount}`);
  if (JSON.stringify(before.elState) !== JSON.stringify(after.elState)) {
    changed.push(`elState ${JSON.stringify(before.elState)} -> ${JSON.stringify(after.elState)}`);
  }
  if (before.activeTabInSameList !== after.activeTabInSameList) {
    changed.push(`activeTab ${before.activeTabInSameList} -> ${after.activeTabInSameList}`);
  }
  if (before.activePanelId !== after.activePanelId) {
    changed.push(`activePanelId ${before.activePanelId} -> ${after.activePanelId}`);
  }

  return {
    ran: true,
    element: `${located.tag}${located.demoId ? `[data-demo-id="${located.demoId}"]` : ""} "${located.text}"`,
    describe,
    pass: changed.length === 0,
    changed,
  };
}

/**
 * Dispatches a REAL wheel event (via CDP, `page.mouse.wheel`) over a
 * genuinely-overflowing element inside <main>, rather than calling
 * `element.scrollBy()` from inside the page. `scrollBy()` proves nothing
 * about wheel handling — it works identically whether or not a `wheel`
 * listener anywhere would have blocked the equivalent user gesture, since
 * it never dispatches one. ContentInert deliberately leaves `wheel`
 * unblocked (see its docblock); this is the positive-control check that
 * that is actually true, and it explicitly reports "n/a" rather than a
 * false pass when the step has no scrollable element to test against.
 */
async function runScrollProbe(page) {
  const scroller = await page.evaluate(findScroller);
  if (!scroller) return { applicable: false, pass: null };

  const before = scroller.scrollTop;
  // Chat message lists auto-scroll to the bottom, so "scroll down" is
  // sometimes a no-op with nowhere further to go — not a ContentInert
  // failure, just the wrong direction to probe in. Scroll up instead
  // whenever we're already within a few px of the bottom.
  const room = scroller.maxScrollTop - before;
  const deltaY = room > 20 ? 120 : -120;
  const cx = scroller.rect.x + Math.min(scroller.rect.width / 2, 200);
  const cy = scroller.rect.y + Math.min(scroller.rect.height / 2, 200);
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, deltaY);
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => document.querySelector("[data-walk-scroller]")?.scrollTop ?? null);

  return {
    applicable: true,
    pass: after !== null && after !== before,
    before,
    after,
    element: `${scroller.tag}.${scroller.className.split(" ")[0] ?? ""}`,
  };
}

/**
 * Waits for every finite animation on the page to finish, up to `timeoutMs`.
 *
 * The geometry assertions describe a step's STEADY STATE. A right-side Radix
 * sheet (chapter 10's `?review=` drawer, chapter 7's wizard) starts its
 * `slide-in-from-right` at translateX(100%) — entirely off the right edge,
 * which is the column the docked panel occupies — so for ~500ms it genuinely
 * is "a fixed element overlapping the panel". No layout can avoid that: a
 * drawer that enters from the right crosses the right edge. Reading geometry
 * mid-slide measured the animation, not the layout, and reported
 * `coveringPanel` on exactly the steps that open a drawer.
 *
 * Infinite animations (spinners, shimmers) are skipped — waiting on one would
 * never return — and the whole wait is bounded, so a page that never settles
 * costs a second rather than the run.
 */
async function settleAnimations(page, timeoutMs = 2000) {
  await page
    .evaluate(async (limit) => {
      const running = document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => null));
      if (!running.length) return;
      await Promise.race([
        Promise.all(running),
        new Promise((resolve) => setTimeout(resolve, limit)),
      ]);
    }, timeoutMs)
    .catch(() => {});
}

/**
 * Reads the geometry once the page has stopped moving.
 *
 * `settleAnimations` alone is a snapshot: an animation that has not STARTED
 * yet is not one to wait for, and several steps load their real content a
 * beat after the panel and ring are already up (the `?review=` drawer mounts
 * after its query resolves; the agent editor's accordion reflows as sections
 * fill). A single read taken in that window measured the page mid-move and
 * reported a drawer over the panel, or a ring still transitioning toward an
 * anchor that had just shifted.
 *
 * So: read, wait, read again, and only accept a value that came back
 * IDENTICAL twice in a row. Bounded — after `tries` attempts it returns the
 * last read rather than looping, so a page that genuinely never settles fails
 * on its real geometry instead of hanging.
 */
async function readSettledGeometry(page, anchor, tries = 6) {
  const key = (g) =>
    JSON.stringify([g.panelVisible, g.overlapsContent, g.coveringPanel, g.ringPresent, g.ringOnAnchor, g.panelRect]);
  await settleAnimations(page);
  let previous = await page.evaluate(assertGeometry, anchor);
  for (let i = 0; i < tries; i++) {
    await page.waitForTimeout(350);
    await settleAnimations(page);
    const current = await page.evaluate(assertGeometry, anchor);
    if (key(current) === key(previous)) return current;
    previous = current;
  }
  return previous;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const { chromium } = resolvePlaywright();
  const steps = loadSteps();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Loaded ${steps.length} steps from lib/demo/chapters.`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Output: ${OUT_DIR}\n`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const results = [];
  let expandedCheckDone = false;
  let expandedCheckResult = null;

  for (const step of steps) {
    const url = BASE_URL + step.href;
    const row = { pos: step.pos, chapterTitle: step.chapterTitle, stepId: step.stepId, route: step.route, anchor: step.anchor, href: step.href };

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    } catch (err) {
      row.error = `navigation failed: ${String(err).split("\n")[0]}`;
      results.push(row);
      console.log(`${step.pos.padEnd(18)} NAV FAIL ${row.error}`);
      continue;
    }

    // Poll rather than a flat sleep: most steps settle in well under a
    // second, but chat routes replay a scripted exchange (documented in
    // tour-ring.tsx as up to ~15s worst case) before their anchor exists.
    // Anchored steps get up to 22s (just past tour-ring.tsx's own 20s
    // give-up timer); anchor-less steps get a shorter budget since nothing
    // further is going to appear.
    const budgetMs = step.anchor ? 22000 : 8000;
    const start = Date.now();
    let geometry = null;
    while (Date.now() - start < budgetMs) {
      try {
        geometry = await page.evaluate(assertGeometry, step.anchor);
      } catch {
        geometry = null;
      }
      const ringOk = step.anchor ? geometry?.ringPresent && geometry?.ringOnAnchor : true;
      if (geometry?.panelVisible && ringOk) break;
      await page.waitForTimeout(400);
    }
    // Final read, in case the loop exited on the timeout with a stale value —
    // taken once the page has stopped moving, so it measures the layout
    // rather than a drawer halfway through sliding in. See
    // readSettledGeometry and settleAnimations.
    try {
      geometry = await readSettledGeometry(page, step.anchor);
    } catch (err) {
      row.error = `geometry assertion threw: ${String(err).split("\n")[0]}`;
      results.push(row);
      console.log(`${step.pos.padEnd(18)} ERROR ${row.error}`);
      continue;
    }

    row.panelVisible = geometry.panelVisible;
    row.overlapsContent = geometry.overlapsContent;
    row.coveringPanel = geometry.coveringPanel;
    row.ringPresent = geometry.ringPresent;
    row.ringExpected = step.anchor !== null;
    row.ringOnAnchor = geometry.ringOnAnchor;
    // Present exactly when a step declares an anchor, AND drawn on that
    // anchor. The second half exists because the ring used to be measured
    // once, at the frame the anchor was inserted — inside a sheet still
    // sliding in, that is a whole sheet-width from where it ends up, and
    // "ringPresent" happily reported true the whole time.
    row.ringOk =
      geometry.ringPresent === row.ringExpected &&
      (!row.ringExpected || geometry.ringOnAnchor === true);
    row.panelRect = geometry.panelRect;
    row.mainRect = geometry.mainRect;
    // Not one of the brief's 5 assertions (and not part of row.allPass below)
    // — a diagnostic surfaced because it was too material to leave out. The
    // panel is a plain flow sibling of <main>, not position: sticky/fixed,
    // so on any route where the PAGE (not an inner container) is what
    // scrolls, scrollIntoView-ing a deep anchor drags the panel's own
    // header/content/Weiter-button out of the viewport along with it. That
    // never fails overlapsContent (the two rects stay horizontally
    // separated regardless of vertical scroll) or panelVisible (a
    // getBoundingClientRect() has nonzero width/height even off-screen), so
    // none of the 5 given assertions catch it — see task-8-report.md.
    row.panelScrolledAway = geometry.panelRect.top < -5 || geometry.panelRect.height > 950;

    // Screenshot BEFORE the click/scroll probes below: both hover a real
    // element (to settle any tooltip) and can leave the page mid-scroll,
    // and this screenshot is the one task-8-report.md's reflow review reads
    // — it should show the step as a visitor actually sees it, not this
    // harness's own probing.
    const shotPath = path.join(OUT_DIR, `${step.pos.replace(/\./g, "-")}.png`);
    try {
      await page.screenshot({ path: shotPath, fullPage: false });
      row.screenshot = shotPath;
    } catch {
      row.screenshot = null;
    }

    const clickResult = await runClickProbe(page, step.pos);
    row.click = clickResult;

    const scrollResult = await runScrollProbe(page);
    row.scroll = scrollResult;

    row.allPass =
      row.panelVisible === true &&
      row.overlapsContent === false &&
      row.coveringPanel === false &&
      row.ringOk === true &&
      clickResult.pass === true &&
      // scroll is the one probe where null ("no scroller on this step") is a
      // real n/a rather than a rotted selector — see runScrollProbe.
      (scrollResult.pass === true || scrollResult.pass === null);

    // One-off bonus check (not part of the per-step 5, see task-8-report.md):
    // expand the panel to 560px on the first step that has "Mehr" content,
    // and re-run the geometry assertion, so the property is also confirmed
    // at the wider of the panel's two docked widths, not only its default
    // collapsed 380px.
    if (!expandedCheckDone) {
      const hasMehr = await page.evaluate(() => !!document.querySelector('[data-demo-id="tour-panel"] button'));
      if (hasMehr) {
        const clicked = await page.evaluate(() => {
          const btns = [...document.querySelectorAll('[data-demo-id="tour-panel"] button')];
          const mehr = btns.find((b) => b.textContent.trim() === "Mehr");
          if (!mehr) return false;
          mehr.click();
          return true;
        });
        if (clicked) {
          await page.waitForTimeout(400);
          await settleAnimations(page);
          const expandedGeometry = await page.evaluate(assertGeometry, step.anchor);
          expandedCheckResult = { pos: step.pos, ...expandedGeometry };
          expandedCheckDone = true;
          const shotPath2 = path.join(OUT_DIR, `${step.pos.replace(/\./g, "-")}-expanded.png`);
          await page.screenshot({ path: shotPath2, fullPage: false }).catch(() => {});
        }
      }
    }

    results.push(row);
    const flag = row.allPass ? "PASS" : "FAIL";
    console.log(
      `${step.pos.padEnd(18)} ${flag} panel=${row.panelVisible} overlap=${row.overlapsContent} covering=${row.coveringPanel} ring=${row.ringPresent}/${row.ringExpected}${row.ringExpected ? `@anchor=${row.ringOnAnchor}` : ""} click=${clickResult.pass} scroll=${scrollResult.applicable ? scrollResult.pass : "n/a"}${row.panelScrolledAway ? " [panel-scrolled-away]" : ""}`,
    );
  }

  await browser.close();

  const resultsPath = path.join(OUT_DIR, "results.json");
  fs.writeFileSync(resultsPath, JSON.stringify({ results, expandedCheckResult }, null, 2));

  const failCount = results.filter((r) => r.allPass === false || r.error).length;
  console.log(`\n${results.length - failCount}/${results.length} steps passed all assertions.`);
  console.log(`Full results: ${resultsPath}`);
  console.log(`Screenshots: ${OUT_DIR}`);
  if (expandedCheckResult) {
    console.log(
      `Expanded-panel spot check (${expandedCheckResult.pos}, 560px): overlapsContent=${expandedCheckResult.overlapsContent} coveringPanel=${expandedCheckResult.coveringPanel}`,
    );
  }

  process.exitCode = failCount > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
