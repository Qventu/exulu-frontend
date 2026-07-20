# Project Budget Visibility on the Project Detail Page

**Date:** 2026-07-20
**Status:** Approved
**Repos:** `frontend` (this repo) + `backend`

## Goal

Show a project's budget usage (spend vs. cap, reset time) on the project
detail page, visible to **every user who can open the project** — not just
budget admins. Read-only: no editing affordances anywhere on the detail page.

Today this data is only visible on the admin-only `/budgets` page (project
tab), guarded by `budget_management:read`. The backend nulls the `budget`
field for everyone else, so this feature requires a small backend change plus
frontend rendering.

## Decisions (approved)

1. **Backend rule:** members with row-level access to a project can read its
   budget; the response respects the platform-wide `user_budget_display`
   setting (`amount` | `percent`) — same convention as the `/me/budget`
   self-view. Budget admins keep full USD everywhere.
2. **Placement:** compact budget bar in the project detail **PageHeader**
   (under the description), visible on every tab, with a click/keyboard
   Popover carrying details (used, remaining, projection, reset date).
3. **Visibility gating:** always on. No new admin toggle; orgs that don't
   want raw cost figures exposed use the existing percent display mode.
4. **No budget configured:** the indicator renders nothing (no "No budget"
   text for members).

## Backend change

**File:** `backend/src/graphql/utilities/sanitize-and-hydrate-fields.ts`
(`addBudgetField`, currently lines 53–79).

Current behavior: requester without `budget_management:read`/`write` (and not
super admin) → `result.budget = null` for every entity type.

New behavior, **for `entityType === "project"` only**:

- Requester **with** budget rights: unchanged — full tag info from
  `getTagBudgetMap()` (includes `budget_id`), no `display` echo. Admin UIs
  render USD as today.
- Requester **without** budget rights: return a **member view** instead of
  `null`:

  ```ts
  {
    spend: number,
    max_budget: number | null,
    budget_duration: string | null,
    budget_reset_at: string | null,
    display: "amount" | "percent",  // echoes platform user_budget_display
  }
  ```

  `budget_id` (internal LiteLLM identifier) is omitted. The `display` value
  comes from `getBudgetSettings().user_budget_display`.

- **Row-level safety needs no new code:** the project row only reaches field
  hydration if the RBAC-filtered query (`applyAccessControl` in
  `access-control.ts`) already returned it to this requester.
- **All other entity types** (user, role, team, agent, workflow_template)
  keep the existing admin-only gating exactly as today.
- Percent mode remains **UI-level**: raw figures are still sent on the wire,
  matching the documented product decision for `/me/budget`
  (`budget-service.ts:187–190`).

**Verify during implementation:** `projectById` (resolvers/index.ts:168–171)
runs through `finalizeRequestedFields` so the hydrated `budget` field is
populated on the detail query, not only on `projectsPagination`.

**Backend tests:** non-admin + project → member view with `display` echo;
non-admin + any other entity → `null`; admin + project → unchanged full view.

## Frontend changes

### Data

- Add `budget` to `GET_PROJECT_BY_ID`
  (`app/(application)/projects/queries.ts`).
- Add `budget?: BudgetInfo | null` to the `Project` interface
  (`types/models/project.ts`).

### Shared component: `BudgetBar` percent mode

`components/budget-bar.tsx` currently always renders USD (inline text and
tooltip) even though `BudgetInfo.display` exists. Make it display-aware:

- When `budget.display === "percent"`: inline text and tooltip use the
  existing `budgets.bar.percent*` i18n strings — never a USD figure.
- When `display` is absent or `"amount"`: byte-identical behavior to today.
  Admin queries never set `display`, so all admin surfaces are unchanged.
- Side benefit: fixes the latent gap where the chat `UsagePopover` renders
  `BudgetBar` with the user's `/me/budget` payload and could leak USD in
  percent mode.

### Shared popover content

Extract the percent-aware detail block (used / remaining + duration /
projection / resets-on) currently inlined in
`components/shell/top-bar-budget.tsx` into a shared component (e.g.
`components/budget-details.tsx`). `TopBarBudget` keeps its chip face and
reuses the shared block; the new project indicator reuses it too. No visual
change to the top bar.

### New route-local component: `ProjectBudgetIndicator`

`app/(application)/projects/components/project-budget-indicator.tsx`:

- Focusable button wrapping a **compact** `BudgetBar` (fixed width, ~`w-44`),
  opening a Popover with the shared detail block — same accessibility pattern
  as the admin page's `budget-bar-with-details.tsx` (keyboard- and
  touch-reachable; not hover-only).
- Rendered in the PageHeader of `project-detail-view.tsx`, under the
  description line, so it is visible on all three tabs.
- Renders `null` when `budget` is null or `max_budget` is null/≤ 0.
- Read-only: no edit affordance, no link to `/budgets`.

### i18n

Reuse existing `budgets.bar.*` keys. Add at most an aria-label key for the
indicator (en + de, keep parity — no new failures beyond the 4 known-failing
baseline checks).

## Error handling

- Budget hydration failure or LiteLLM disabled → backend returns `null` →
  indicator doesn't render. No error surface needed.
- Warning/over-budget coloring comes free from `BudgetBar`'s existing
  projection logic (green / amber / red + projection marker).

## Testing

- **Backend:** unit tests for `addBudgetField` member-view branch (see
  above).
- **Frontend:**
  - `BudgetBar` percent mode: no USD substring in output; amount mode
    unchanged.
  - `ProjectBudgetIndicator`: hidden when budget is null / uncapped; renders
    bar + popover details when capped; percent mode shows percentages only.
  - Update any `GET_PROJECT_BY_ID` mocks to include the new field.

## Out of scope

- Budget display on the projects **list** page.
- Any editing/admin affordances on the project detail page.
- New admin settings/toggles.
- Other entity types (agents, routines, teams…) — admin-gated as before.
