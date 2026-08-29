# Review brief: the Exulu guided demo tour

You are reviewing a guided product tour that has been built but never seen by
anyone except the person who built it. **Your job is to be the first outside
reader, and to be hard on it.**

Please run it in a real browser using the Claude in Chrome tools
(`mcp__claude-in-chrome__*`) rather than reading the code and reasoning about
it. Most of what matters here — pacing, whether the story lands, whether a
screen looks broken — is only visible on screen. Several defects in this tour
survived a full green test suite and were only found by looking at it.

---

## What it is and who it is for

Qventu sells the **Exulu IMP platform**. This tour is a lead-generation asset
for the **elevator industry**: a prospect arrives from a HubSpot form, walks a
scripted tour of a real deployment, and is asked to book a call at the end.
Sales-assisted, low volume, high value per lead.

The premise the whole thing rests on: **it is the real product, with real
customer data, not a mockup.** Screens are the actual application. Content
comes from two live deployments — Newlift (elevator control boards) and ALGI
(hydraulic elevator systems). Chapters 1–5 are Newlift, 6–7 are ALGI.

The audience is technical and sceptical: service engineers, technical
directors, operations people at elevator companies. Much of the content is
German, because the customers are.

## How to run it

The dev server should already be running on port 3000 in demo mode. If not:

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend
NEXT_PUBLIC_DEMO_MODE=true npx next dev -p 3000
```

Start here and walk it with the **Next** button, as a prospect would:

```
http://localhost:3000/demo/tour?tour=intro.0
```

The tour position lives in the URL as `?tour=<chapter>.<step>`, so you can jump
to any step directly. There is also a **Tour** bubble bottom-right that opens a
chapter menu.

| # | Chapter | Steps | Runs on |
|---|---------|-------|---------|
| 1 | `intro` — What this is | 1 | `/demo/tour` |
| 2 | `techdoc` — Answering a hard question | 3 | `/demo/tour` |
| 3 | `ingestion` — How it learned that | 4 | `/data/...` |
| 4 | `config` — Making it yours | 5 | `/agents/edit/...` |
| 5 | `memory` — Correcting it | 4 | `/demo/tour`, `/data/...` |
| 6 | `evals` — Proving it | 4 | `/evals/...` |
| 7 | `email` — Working while you sleep | 4 | `/workflows/...` |
| 8 | `meetings` — Capturing what is said | 3 | `/transcriptions` |
| 9 | `contact` — Talk to us | 1 | `/demo/tour` |

Twenty-nine steps. Walk **all** of them. Check the browser console as you go
(`mcp__claude-in-chrome__read_console_messages`) — it should be clean, and
anything in it is a finding.

Also try it in **light mode** and at a **narrow window**. Both are plausible for
a real visitor and neither has been checked properly.

## What I want from you

In rough order of value:

1. **Does the story land?** Nine steps, ~12 minutes. Does it build? Is there a
   chapter that should be cut, moved, or shortened? Does a prospect know what
   they are being sold by the end?

2. **Is the copy right for the audience?** It was written by the builder, in
   one voice, without an editor. Look for: overclaiming, jargon that assumes
   too much, jokes that will not land in a sales context, sentences that are
   too long, anything that sounds like marketing rather than engineering.

3. **Does anything look broken, ugly, or unfinished?** Popovers covering the
   thing they describe, layout that breaks, images that do not fit, text that
   overflows, steps where the highlighted element is not the interesting one.

4. **Is anything misleading?** This matters more than usual. The tour claims to
   be real throughout. If a screen implies something the product does not do,
   or a number appears without support, that is the most serious class of
   finding here. Two places are knowingly not-real and say so in the copy —
   check that the disclosure is adequate rather than a fig leaf.

5. **Would a sceptical engineer believe it?** That is the actual test.

## Please disagree with the builder

Several decisions were argued for at length in the commit messages. Those
arguments are one person's reasoning and you should not treat them as settled.
In particular:

- **Chapters 1 and 5 open mid-conversation** rather than letting the visitor
  type, so that every step works for someone who only clicks Next. This trades
  away watching an answer stream in live, which was arguably the best moment in
  the demo. Reasonable people could call that the wrong trade.
- **Chapter 4 shows all 55 glossary terms** on the theory that the length is
  the point. It may just be boring.
- **The illustrations are deliberately plain** technical line drawings, on the
  theory that anything glossier would undercut the plainness of the real
  screens. They may simply look cheap.
- **The intro is a tour step rather than a landing page.** A prospect's first
  sight is a popover over a chat screen, not a designed opening frame.
- **Failures are shown on purpose** — eight failed email runs, a red failing
  eval cell, three cancelled recordings — on the theory that this is more
  credible than an all-green fixture. It might just look like the product is
  unreliable.

If you think any of these is wrong, say so plainly. A second reviewer who
agrees with everything has not earned their keep.

## Known and accepted — do not spend time here

- `DEMO_BOOKING_URL` in `lib/demo/tour.ts` is empty, so the closing step has no
  booking link yet. Known; a HubSpot link is coming.
- `components/shell/nav-config.test.ts` fails on `main` too. Unrelated.
- One eslint error in `app/(application)/data/components/entity-types.tsx`.
  Pre-existing.
- Voice input in the composer is switched off; it needs an auth change that has
  not been agreed.
- Clicking **Save** on the agent editor succeeds but does not persist. Deliberate.
- The generated work instruction in chapter 8 was written by hand, not produced
  by the product. The copy says so — judge whether that disclosure is enough,
  but do not report the fact itself as a discovery.

## How to report back

Lead with the three things most worth changing, then everything else. For each:
what you saw, where (chapter and step), and why it matters. Include screenshots
for anything visual — a description of a layout problem is much weaker than the
frame itself.

Separate **"this is broken"** from **"I would have done this differently"**, and
say which of your findings you would block a launch on. If you think the tour is
ready to show a prospect, say that too.
