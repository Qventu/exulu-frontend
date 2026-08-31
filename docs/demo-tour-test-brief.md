# Test the demo tour — briefing

You are going to walk a guided product tour in a real browser and review it.
Assume no prior knowledge of this project; everything you need is below.

## What it is

Qventu sells a platform called **OPEN IMP**. This tour is a lead-generation
asset for the **elevator industry**: a prospect arrives from a marketing PDF,
walks a scripted tour of a real deployment, and is asked to book a call.

The premise it rests on: **it is the real product, with real customer data, not
a mockup.** Screens are the actual application. Content comes from two live
deployments — Newlift (elevator control boards) and ALGI (hydraulic elevator
systems). Much of it is German, because the customers are.

Audience: technical and sceptical. Service engineers, technical directors,
operations people.

## Start it

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend
NEXT_PUBLIC_DEMO_MODE=true npm run dev
```

The flag is required. Without it the tour 404s.

Then open this and click **Next** all the way through, as a prospect would:

```
http://localhost:3000/chat/demo-agent-newton/session-demo-techdoc-1?tour=intro.0
```

Nothing happens for the first ~10 seconds while the chat mounts. That is
expected; note whether it feels too long.

## Drive it with Claude in Chrome

Use the `mcp__claude-in-chrome__*` tools, not the code. Nearly every defect
worth finding here was invisible to a green test suite and only showed up on
screen.

1. `tabs_context_mcp` first, then `tabs_create_mcp` for a fresh tab.
2. `navigate` to the URL above.
3. `computer` with `action: "screenshot"` to look, and `action: "left_click"`
   to press Next. **Click at coordinates read off the screenshot** — the
   popover moves between steps, so re-screenshot before each click.
4. `read_console_messages` as you go. Yellow Apollo deprecation warnings are
   pre-existing noise; anything else is a finding.
5. `javascript_tool` if you want to measure something (positions, overflow).

Two traps, learned the hard way:

- **Do not drive buttons with `.click()` from `javascript_tool`.** It skips
  hit-testing and will pass on things a real user cannot click. Use real
  clicks at real coordinates.
- **Several stale `.shepherd-element` nodes exist at once.** If you query the
  popover in JS, filter on computed `display` *and* `visibility` *and*
  `opacity`, or you will measure a hidden one. Screenshots are more reliable.

## The route

27 steps, 9 chapters. The tour position is in the URL as `?tour=<chapter>.<step>`
so you can jump anywhere directly.

| # | Chapter | Steps | Runs on |
|---|---------|-------|---------|
| 1 | What this is | 1 | chat |
| 2 | Answering a hard question | 3 | chat |
| 3 | Correcting it | 4 | chat, then `/data/…` |
| 4 | How it learned that | 4 | `/data/…` |
| 5 | Making it yours | 5 | `/agents/edit/…` |
| 6 | Proving it | 3 | `/evals/…` |
| 7 | Working while you sleep | 3 | `/workflows/…` |
| 8 | Capturing what is said | 3 | `/transcriptions` |
| 9 | Talk to us | 1 | chat |

Chapters 2 and 3 **type a question into the chat box by themselves** and stream
a reply. Let them finish. That is the tour's main event — judge it closely.

Bottom-right there is a **Tour** bubble showing e.g. `5 of 9 · 3/5`. It opens a
chapter menu and offers a "Skip to …" link. Try both.

## What to report

In rough order of value:

1. **Does the story land?** Nine chapters, ~12 minutes. Does it build? Should
   anything be cut, shortened or moved? Does a prospect know what they are
   being sold by the end?
2. **Is anything misleading?** The tour claims to be real throughout. A screen
   implying something the product does not do is the most serious finding
   available. Two places are knowingly not-real and say so — check that the
   disclosure is adequate rather than a fig leaf.
3. **Does anything look broken, ugly or unfinished?** Popovers covering the
   thing they describe, layout breaking, text overflowing, steps where the
   highlighted element is not the interesting one.
4. **Is the copy right for a sceptical German-speaking engineer?**
   Overclaiming, jargon, marketing register, sentences that run long.
5. **Would a sceptical engineer believe it?** That is the real test.

Lead with the three things most worth changing. For each: what you saw, which
chapter and step, why it matters. Include screenshots — a description of a
layout problem is much weaker than the frame. Separate **"this is broken"**
from **"I would have done this differently"**, and say which you would block a
launch on.

## Known and accepted — do not spend time here

- The **booking link is missing** on the last step. A HubSpot URL is coming.
- The **OPEN logo does not load** (`/demo/brand/logo_*.png` 404). The asset
  does not exist yet; the header falls back to the wordmark.
- **Poppins and Playfair are not loaded**, so the theme's fonts fall back to
  Inter. Palette only for now.
- **Dark mode is forced.** Light mode is deliberately unreachable — its accent
  colour fails contrast badly.
- `components/shell/nav-config.test.ts` fails on `main` too, and there is one
  pre-existing eslint error in `data/components/entity-types.tsx`.
- Clicking **Save** in the agent editor succeeds but does not persist.
- Two artefacts are not product output and say so in the copy: the work
  instruction in chapter 8, and the scores in chapter 6's grid.

## Please disagree

Several decisions were argued for at length by whoever built this. Treat none
of them as settled:

- Chapters 2 and 3 **type for the visitor** rather than letting them type.
- Chapter 5 shows **all 55 glossary terms**, on the theory that the length is
  the point.
- The illustrations are **deliberately plain** line drawings.
- The intro is **a tour step, not a landing page** — the first thing a prospect
  sees is a popover over a chat screen.
- **Failures are shown on purpose** — failed email runs, a red eval cell,
  cancelled recordings — on the theory that this is more credible than an
  all-green fixture.

If you think any of these is wrong, say so plainly. A reviewer who agrees with
everything has not earned their keep.
