# Exulu Design Philosophy

> The single source of truth for how Exulu's interface is designed. Every page concept in
> `design/pages/` derives from this document and `design/personas.md`. When a design decision
> is unclear, resolve it here first — then record the resolution so the next decision is easier.

Exulu grew feature by feature. It is now close to feature-complete, which changes the design
question from *"how do we add this?"* to *"how does everything we have become coherent, calm,
and fast for the person using it right now?"* This document answers that.

---

## Vision

**Exulu should feel like a calm command center.** Every screen is organized around the job a
person came to do — not around our data model, not around the order features shipped in.
The first glance shows exactly what the primary persona needs; everything else is one
deliberate step away. Nothing is removed, but nothing shouts.

Four words: **Calm. Capable. Honest. Trusted.**

- **Calm** — minimal default surfaces, generous whitespace, one accent color doing the work.
- **Capable** — full power is always reachable; depth is layered, never amputated.
- **Honest** — transparency about what the AI is doing (tokens, models, reasoning, costs) is a
  product value, not a debug mode.
- **Trusted** — customers choose Exulu because it is the secure, sovereign option: data stays
  in the EU, is never used for model training, and access is tightly controlled. The interface
  must keep earning that positioning on every screen (principle 9).

---

## Core Principles

### 1. Jobs, not features

Every page is designed by first asking: *which persona is the primary owner of this page, and
what jobs do they come here to do?* (Personas and their jobs: `design/personas.md`.) The
default view of a page serves the primary persona's most frequent job. Secondary personas and
infrequent jobs get deliberate, discoverable paths — not equal billing.

**Test:** for any page, you must be able to name its primary persona and its #1 job in one
sentence. If you can't, the page is doing too much and should be split or layered.

### 2. Minimalism through progressive disclosure — never through removal

The platform is feature-complete. Minimalism here means *relocating and layering*, not
deleting. Every existing capability must remain reachable. The discipline is the
**disclosure ladder** — every piece of UI is assigned a level:

| Level | Name | What lives here | Examples |
|-------|------|-----------------|----------|
| **L0** | Navigation | The few destinations the persona needs | Sidebar items, command palette |
| **L1** | Page default | The primary job, ready to act on | Chat input, agent list, run eval button |
| **L2** | One step in | Frequent secondary actions and detail | Expand row, side panel, tab switch |
| **L3** | Deliberate depth | Configuration, advanced options, bulk ops | Dialog, "Advanced" section, settings drawer |
| **L4** | Raw / expert | JSON views, API payloads, debug detail | Raw output toggle, GraphiQL, cURL snippets |

**Rules of the ladder:**
- Moving something *down* a level requires evidence it's infrequent — not just that it's ugly.
- Anything destructive lives at L3 or deeper with confirmation, regardless of frequency.
- Nothing critical to trust (errors, costs, what model ran) may be hidden below L2.
- A job should never require descending more than one level mid-flow ("dialog opens dialog" is a bug).

### 3. One screen, one owner

Each page has exactly one primary persona (see the page ownership matrix in
`design/personas.md`). Design L1 for them. Other personas' needs on that page appear at L2+,
or via role-based visibility (RBAC trims what each role's nav and pages even render).
Navigation itself is persona-shaped: an end user should see a 4-item sidebar, not a 20-item
admin tree. The interface a person sees should look like it was built only for them.

### 4. Calm surfaces, purposeful accents

- **Neutral foundation:** cool gray backgrounds and borders structure the page; structure
  comes from spacing and typography first, lines and boxes second. Prefer whitespace over
  dividers, dividers over boxes, boxes over nested boxes.
- **One accent:** the Exulu purple (`--primary`) marks *the* primary action and active state
  on a screen — at most a handful of purple elements visible at once. If purple is everywhere,
  it is nowhere.
- **Semantic colors only for meaning:** green = success/healthy, red = destructive/failed,
  orange = warning/budget pressure, blue = informational. Never decorative.
- **Status is quiet until it isn't:** healthy states are muted (dot, subtle badge); problems
  earn color and weight.
- Both themes are first-class. Every concept is specified to work in light and dark.

### 5. Same bones everywhere

A small set of shared layout primitives gives every page the same skeleton, so users transfer
knowledge between pages and the codebase stops re-implementing scaffolding:

- **PageShell** — consistent max-width, padding, and vertical rhythm per page type
  (full-bleed work surface vs. centered content page).
- **PageHeader** — title (`text-2xl`), one-line purpose, primary action on the right.
  One per page. No page invents its own header.
- **Toolbar** — search + filters + view switches, directly under the header, identical
  placement on every list page.
- **ListDetail** — list/table on the left or top, detail in a side panel or subpage;
  the pattern for every collection (agents, models, prompts, evals, users, keys…).
- **EmptyState** — icon, one sentence of value, one primary action. Every list has one.
- **StatCard / ChartCard** — the only two dashboard widget shapes.
- **ConfirmDialog** — single shared destructive-confirmation pattern.

These primitives are the contract between this design plan and the codebase restructuring
(`design/codebase-structure.md`).

### 6. Speed is the aesthetic

Perceived performance is part of the visual design, not an engineering afterthought:

- Navigation and state changes feel instant; optimistic UI wherever the backend allows.
- Skeletons mirror the real layout (no spinner walls); streaming text uses shimmer;
  spinners only for short indeterminate actions.
- Animation budget: 150–200 ms hover/focus, ~300 ms state changes, ~500 ms max for page-level
  transitions; `ease-in-out`; everything respects `prefers-reduced-motion`.
- Motion must explain something (origin, hierarchy, causality) or it doesn't ship.
  Signature moments are few and deliberate — see `design/navigation.md` for the shell's
  motion language.

### 7. Mobile is a context, not a shrink

Each persona has a *mobile job* that differs from their desktop job (see
`design/personas.md`). Responsive design means serving that mobile job well — not cramming
the desktop layout into 390 px:

- **End user mobile:** chat is fully first-class — this is the one experience that must be
  flawless on a phone.
- **Power user / admin / dev mobile:** monitor and react — check status, read a run, approve,
  pause, copy a key. Heavy authoring (agent config, eval design, theme editing) may remain
  desktop-optimized but must never be *broken* on mobile: read-only degradation is acceptable,
  horizontal overflow and unusable controls are not.
- Standard breakpoint behaviors (tables→cards, side panels→sheets, toolbars→collapsed) are
  defined once in `design/responsive.md` and reused.

### 8. Trust through transparency

Exulu manages AI operations; showing the machinery is a feature. Token usage, model choice,
costs, reasoning steps, tool calls, citations, and errors are always *available* — placed on
the disclosure ladder (usually L2), never amputated for the sake of a cleaner screen. Errors
state what happened and what to do next, in plain language, with the raw detail one level
deeper.

### 9. Security you can feel

Our customers pick Exulu *because* it is the secure, sovereign choice: **data is processed and
stored in the EU, is never used to train models, and stays under their control.** That promise
is kept by the backend — but it is *believed* (or doubted) at the surface. People judge a
platform's security by interface details, so the UI must continuously, quietly earn the trust
the product promises:

- **Reassure at moments of anxiety, not as wallpaper.** Place data-residency and
  no-training signals exactly where a user hesitates before disclosing something — the login
  screen, first chat input, file upload, knowledge ingestion ("Stored encrypted in the EU.
  Never used for training.") — not as a repeated banner that decays into noise.
- **Handle sensitive material with visible care.** Secrets and tokens are masked by default
  with a deliberate reveal-and-copy interaction; visibility and scope are always labeled
  ("who can see this?"); sharing states are explicit, never ambiguous; admin objects carry
  attribution (who changed it, when).
- **Make data boundaries explicit.** Wherever data crosses a boundary — an external model
  provider, an n8n workflow, a share link — say so at the point of action. Nothing should
  *feel* like it might silently leave the platform.
- **Calm, not theatrical.** No scary iconography or paranoid confirmations on routine
  actions; friction is reserved for genuinely dangerous operations (L3+). Security theater
  reads as insecurity.
- **Reliability is a trust signal.** Dead buttons, silent failures, and inconsistent states
  erode belief in the security claims too. A platform that feels precise feels safe.

### 10. Assume curiosity, not AI expertise

Users range from AI-fluent engineers to people who have never heard the words "token",
"context window", "embedding", or "temperature" — and AI literacy varies *independently of
role* (an admin may set budgets without knowing what a token is; see the AI-literacy note in
`design/personas.md`). The interface must work for all of them without condescending to any
of them:

- **Plain language at L1.** Surfaces lead with human outcomes, not mechanics: name things by
  their job ("Knowledge", "Instructions", "Monthly budget"), keeping the technical term as a
  subtitle or tooltip for those who know it.
- **Explain in place.** Any technical concept that must appear gets a one-line plain-language
  explanation where it stands (info tooltip, helper text) — never force someone to leave the
  app to understand a label. Example: "Tokens — the units AI usage is measured in; roughly ¾
  of a word each."
- **Translate as you ascend the ladder.** The same fact renders for different fluencies:
  cost in **€** and plain words at L1, token counts at L2, raw model parameters at L3/L4.
  Depth increases technical precision; L1 never requires it.
- **Defaults do the expert's job.** Model choices, parameters, and chunking strategies ship
  with sane presets so a person who can't evaluate "temperature 0.7" never has to — while the
  expert can still reach the dial in one step.
- **Never condescend.** This is progressive vocabulary, not a dumbed-down UI: experts get a
  one-step path to full precision, novices get an interface that quietly teaches as they go.

---

## Anti-patterns (things this redesign explicitly forbids)

1. **Deleting capability and calling it minimalism.** Everything stays reachable.
2. **Mystery-meat icons.** Icon-only buttons need tooltips + ARIA labels; primary actions get text.
3. **Modal-on-modal.** One overlay at a time; deep flows get pages or panels.
4. **Five ways to do the same thing.** One pattern per job (one confirm dialog, one empty state, one table style).
5. **Purple confetti.** Accent color on more than the primary action and active states.
6. **Boxes in boxes in boxes.** Card nesting deeper than one level.
7. **The everything-page.** If a page serves all four personas equally at L1, it serves no one.
8. **Decorative motion.** Animation that doesn't explain origin, hierarchy, or causality.
9. **Desktop-only afterthought.** Any page that horizontally scrolls or traps focus on mobile.
10. **Hidden costs.** Spend, token, and model information buried below L2.
11. **Unexplained jargon at L1.** "Tokens", "temperature", "embeddings", "RAG", "context
    window" on a default surface without an in-place plain-language explanation.
12. **Casual handling of sensitive material.** Secrets rendered unmasked, ambiguous sharing
    or visibility states, security-relevant changes without attribution.
13. **Trust banners as wallpaper.** Repeating "secure & EU-hosted" on every screen until it
    becomes invisible — trust signals belong at the exact moments of disclosure and doubt.

---

## Decision heuristics

When designing or reviewing a screen, in order:

1. **Who owns this screen?** → primary persona, #1 job (one sentence).
2. **What's at L1?** → only what that job needs. Everything else gets a ladder level.
3. **Can a feature move down a level?** → if used <weekly by the primary persona, yes.
4. **Is anything two clicks deeper than its frequency justifies?** → move it up.
5. **Does it use the shared bones?** → PageHeader/Toolbar/ListDetail/EmptyState, or a written reason why not.
6. **Does it read in both themes, at 390 px and 1440 px?**
7. **Would Linear/Vercel ship this screen?** → gut-check for calm, density, and polish.
8. **Would a first-day user with zero AI vocabulary understand every L1 label?** → if not,
   rename by job-to-be-done or explain in place (principle 10).
9. **Does anything here create doubt about where data goes or who can see it?** → add the
   residency/no-training signal, visibility label, or boundary note at that exact moment
   (principle 9).

---

## Relationship to existing guidance

`CLAUDE.md` (stack, color system, typography scale, spacing scale, shadcn conventions,
animation timings, accessibility) remains in force as the *implementation standard*. This
document sits above it as the *decision framework*. Where the two could conflict, this
document wins on "what/why", `CLAUDE.md` wins on "with which tokens/components".

**Reading order for implementers:**
1. `design/philosophy.md` (this file) — why and what
2. `design/personas.md` — for whom
3. `design/navigation.md` — the shared shell
4. `design/pages/<page>.md` — the screen you're building
5. `design/responsive.md` + `CLAUDE.md` — the standards you build it with
