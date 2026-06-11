# components/primitives/

Presentational, data-in-via-props building blocks shared across pages. This is the
"bones" tier of the redesign (philosophy §5): PageShell, PageHeader, Toolbar, DataTable,
ListDetail, EmptyState, ConfirmDialog, SidePanel, and the small utility primitives.

## The contract

Every file in this directory MUST:

1. **Be built to the registry spec** — `design/codebase-structure.md` §2 defines the
   canonical prop API for each primitive (§2.1 merges/aliases, §2.2 core bones,
   §2.3/§2.4 remaining registry). A primitive that a page needs but that doesn't exist
   yet is built *to that spec* by its first consuming page — review against §2 is part
   of that PR.
2. **Use token-only colors** — semantic CSS-variable tokens (`bg-background`, `text-muted-foreground`,
   `border-border`, `text-destructive`, status tokens, …). Never raw hex, never Tailwind
   palette colors (`text-red-500`), never theme-conditional values (design-system R1/R6/R8).
3. **Ship i18n from day one** — all user-visible copy via `common.*` keys through the
   existing language-provider pattern, with en/de parity in `messages/` (design-system R12;
   `react/jsx-no-literals` is lint-enforced here).
4. **Build responsive transforms in** — the relevant `design/responsive.md` transforms
   (T1 table→cards, T2 panel→sheet, T3 toolbar collapse, …) and V-rules are part of the
   primitive itself, so consuming pages get correct mobile behavior for free. Never hide
   content by breakpoint (no `hidden md:flex` shells, R3).
5. **Never be page-flavored** — no feature-specific props, copy, or styling. If a page
   needs a variant, it's either a generic prop on the spec'd API or it stays in that
   page's `components/` folder until a second feature needs it (graduation rule,
   codebase-structure §1.1).

## Import boundaries (lint-enforced, codebase-structure §1.2)

May import: `components/ui/`, react, lucide-react, `next/link`, `lib/utils`,
i18n (`common` namespace only).

Must NOT import: Apollo / any data layer (`lib/api`, `lib/graphql`, queries),
`components/widgets/`, `components/shell/`, anything under `app/`.

Primitives receive data and callbacks via props — if it fetches, mutates, or polls,
it belongs in `components/widgets/` instead; shell furniture goes to `components/shell/`.
