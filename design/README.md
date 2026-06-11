# design/ — The Exulu Frontend Redesign

**Summary.** Exulu grew feature by feature and is now feature-complete; this directory holds
the complete redesign of its frontend around three commitments: minimalism through
progressive disclosure (an L0–L4 ladder — relocate and layer, **never remove**),
jobs-to-be-done (every page has one primary persona and one #1 job at L1, with RBAC trimming
what each role even sees), and a calm, consistent system (shared layout primitives, one
accent color, both themes first-class, mobile as a context rather than a shrink). The work
spans a fresh persona-grouped app shell, a normalized design system, a restructured codebase,
and twenty page-by-page redesigns — sequenced in `IMPLEMENTATION_PLAN.md`.

## Documents

| Doc | What it is |
|---|---|
| [`philosophy.md`](philosophy.md) | **The decision framework.** Vision, core principles, the L0–L4 disclosure ladder, shared-bones primitives, anti-patterns, decision heuristics. Every other doc derives from it. |
| [`personas.md`](personas.md) | The four personas (P1 end user, P2 power user, P3 admin, P4 developer), their jobs to be done, mobile jobs, and the **final page ownership matrix** (all page-doc corrections applied). |
| [`navigation.md`](navigation.md) | The app shell: sidebar IA ("The Spine"), the declarative nav-config, RBAC rendering rules, command palette, mobile drawer/top bar, motion language, shell implementation notes. |
| [`codebase-structure.md`](codebase-structure.md) | The structural contract: target directory tree, the shared primitive/widget registry with prop sketches, import-tier rules, conventions (data fetching, i18n, naming), and the Wave 0/1/2 migration strategy. |
| [`responsive.md`](responsive.md) | The responsive contract: persona mobile jobs, surface tiers A/B/C, hard rules, breakpoint meanings, the standard transforms (T1–T9, S1–S6, V-rules), per-page hotlist, and the definition-of-done checklist every page must pass. |
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) | **The master execution plan**: goal/scope, Phase 0 foundations, Phase 1 shell, Phases 2–5 page work items with dependencies and acceptance criteria, the living tracking table, and the working agreement. |
| `../CLAUDE.md` (repo root) | The implementation standard: color tokens, typography scale, spacing scale, shadcn conventions, animation timings, accessibility. Philosophy wins on what/why; CLAUDE.md wins on with-which-tokens. |

## Subdirectories

- [`pages/`](pages/) — twenty page design docs, one per surface (chat, dashboard, projects,
  agents, knowledge, models, prompts, skills, workflows, evals, explorer, access, budgets,
  analytics, variables, keys-token, settings-config, transcriptions, feedback, auth). Each
  follows the same shape: §1 current state (**functionality inventory** — the hard
  no-removal contract — UX review, mobile audit), §2 jobs to be done, §3 design concept
  (L1 default, disclosure ladder, layout, mobile, motion), §4 implementation notes
  (files, scope, dependencies, risks).
- [`audits/`](audits/) — the evidence base the synthesis docs were built from:
  [`shell-navigation.md`](audits/shell-navigation.md) (current nav/shell issues),
  [`design-system.md`](audits/design-system.md) (tokens, typography, component divergence —
  source of the Phase 0 normalization fixes), and
  [`codebase-structure.md`](audits/codebase-structure.md) (file layout, data fetching,
  dead code). Audits are historical records; the synthesis docs above are canonical.

## Reading order

**Newcomers (understand the redesign):**
1. This README → 2. `philosophy.md` → 3. `personas.md` → 4. skim two contrasting page docs
(`pages/chat.md` for P1, `pages/access.md` for P3) → 5. `navigation.md`.

**Implementers (build a work item):**
1. `philosophy.md` → 2. `personas.md` → 3. `navigation.md` → 4. your `pages/<page>.md` →
5. `responsive.md` + `CLAUDE.md` → 6. `codebase-structure.md` (where files go, primitive
specs). Then follow `IMPLEMENTATION_PLAN.md` §7 (working agreement) and update its tracking
table as you go. The page doc's functionality inventory is a contract: every capability
stays reachable at its assigned ladder level.
