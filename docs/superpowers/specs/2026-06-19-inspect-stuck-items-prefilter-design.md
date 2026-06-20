# Inspect-stuck-items prefilter — design

**Date:** 2026-06-19
**Area:** `/data/[ctx]` workspace, Pipeline tab → Items tab

## Problem

The Pipeline tab's health overview shows a stuck-items alert — *"N items have no
embeddings · Ingested but never embedded — these items won't be returned by agent
retrieval"* — with an **Inspect items** button. The count comes from the server
aggregate `stuck_count` (items with 0 **or NULL** chunks).

The button navigates to `?tab=items` with **no filter applied**, so the user lands
on the full, unfiltered items list. Every row looks suspect even though only `N`
of them are actually unembedded — the opposite of the clarity the alert promised.

## Goal

The Inspect-items action must drop the user into the Items list **pre-filtered to
exactly the stuck set**, and the filtered state must be **visually obvious and
dismissible** so the user understands the list is scoped.

## Constraints / facts

- The items list already filters on `chunks_count` via `{ chunks_count: { lte: 0 } }`
  (`items-filter-fields.ts`), threaded through `advancedFilters` → `useContextItems`.
- Backend coalesces `NULL → 0`, so `chunks_count: { lte: 0 }` returns **exactly**
  the same set as the `stuck_count` aggregate. **No backend change needed.**
- `advancedFilters` is currently **local state** in `ItemsTab`, so it cannot survive
  the cross-tab navigation from the Pipeline tab. The deep-link must carry the intent
  in the URL.

## Approach (chosen: A)

URL-driven semantic flag + a visible, dismissible filter chip.

1. **`pipeline-tab.tsx`** — `goToItems` (only wired to the stuck alert) sets
   `tab=items` **and** `embed=missing` on the URL.
2. **`items-tab.tsx`** — derive `embedMissing` from the `embed` search param. When
   set, merge `{ chunks_count: { lte: 0 } }` into the filters passed to `ItemsTable`,
   include it in the active-filter count and `hasFilters`, and pass an
   `onClearEmbedFilter` that drops the `embed` param from the URL. "Clear filters"
   clears both local advanced filters and the `embed` param.
3. **`items-table.tsx`** — when the embed filter is active, render a labeled,
   dismissible **"Not embedded ✕"** chip in the toolbar next to the Filters button.
4. **i18n** — add the chip label key to `messages/en.json` and `messages/de.json`.

### Why A over alternatives

- **B (seed local filter, no chip):** only bumps the Filters count badge — the user
  still can't see *what* is filtered, and it's lost on reload. Doesn't fix the
  confusion.
- **C (fully generic URL-serialized filters + chips for all filters):** powerful but
  a real refactor; scope creep for this bug.

## Out of scope

- Generic URL-persistence / chip rendering for the full advanced-filter set.
- Any backend change (none required).

## Acceptance

- Clicking **Inspect items** lands on the Items tab showing only items with
  `chunks_count ≤ 0` (== the alert count), with a visible "Not embedded" chip.
- Dismissing the chip (or "Clear filters") restores the full list and drops the
  `embed` URL param.
- Reloading / sharing the `?tab=items&embed=missing` URL reproduces the filtered view.
