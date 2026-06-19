# Design: Recently Viewed & Favourites on `/data`

**Date:** 2026-06-19
**Branch:** `redesign/phase-0-foundations`
**Repos:** `exulu/frontend` (UI + GraphQL) and `exulu/backend` (schema + types)

## Goal

Help users quickly re-navigate to data items by adding two sections at the top
of the `/data` page:

1. **Favourites** — items the user has explicitly starred (cross-context).
2. **Recently Viewed** — the last items the user opened (cross-context).

Both are **per-user** and **cross-device** (persisted on the user object,
server-side). They render above the existing context library list.

## Non-goals

- No team/shared favourites — strictly per-user.
- No view analytics, counts, or "most viewed".
- No favouriting of contexts (that is a separate existing field,
  `favourite_contexts`).
- No new backend mutation or resolver — reuse the generic `usersUpdateOne`.

## Decisions (from brainstorming)

| Decision | Choice |
| --- | --- |
| Recently-viewed persistence | **Server-side** on the user object (cross-device) |
| Favourite toggle placement | **Item table rows** (`/data/[ctx]`) **and** item detail header |
| Section layout | **Responsive grid of small cards** (name + context badge + star) |
| Recently-viewed cap | **Keep 5, show 5** |
| Empty behaviour | Each section **hidden when empty**; both hidden while context search is active |
| ID storage | **Bare IDs** (`contextId/itemId`), resolved to names **live** on load |

## Data model

Both lists are JSON arrays stored on the `users` row and written through the
existing generic `usersUpdateOne` mutation — the same mechanism
`favourite_projects` already uses.

Stored as **ordered arrays of bare global IDs** (string `"contextId/itemId"`),
most-recent / most-recently-added first. Order encodes recency, so no timestamp
is stored.

```jsonc
// users.favourite_items        (column ALREADY EXISTS in core-schema.ts:363)
["documents/abc", "tickets/xyz"]

// users.recently_viewed_items  (NEW column — must be added)
["documents/abc", "people/q1", "tickets/xyz"]   // capped at 5, most-recent first
```

### Live name resolution

Items are context-scoped and there is **no cross-context "get items by id"
query**. On `/data` load we therefore resolve names live:

1. Collect the union of IDs from both lists.
2. Group them by `contextId`.
3. For each **distinct context**, run one items query filtered by
   `id IN (ids…)` (the existing `{context}ItemsPagination` supports an `id`
   filter). N = number of distinct contexts in the pinned/recent set (typically
   1–3), **not** one query per item.
4. Map results back to display cards. IDs that resolve to nothing (deleted
   items) are dropped from the rendered list and pruned from the stored array.

Trade-off accepted: names are always fresh, at the cost of N extra queries on
`/data` load. This was chosen over denormalized snapshots for accuracy.

## Backend changes (`exulu/backend`)

1. **`src/postgres/core-schema.ts`** — add one field to `usersSchema`:
   ```ts
   { name: "recently_viewed_items", type: "json" }
   ```
   `favourite_items` already exists (line 363). The init-exulu-db column sync
   auto-adds the new column to existing databases.
2. **`types/models/user.ts`** — add `favourite_items?: string[]` (currently
   absent from the TS type) and `recently_viewed_items?: string[]` for
   type-safety. (`favourite_projects` / `favourite_contexts` are also absent
   from this type today; add `favourite_items` at minimum since this feature
   reads/writes it.)
3. **No new mutation/resolver.** `usersUpdateOne` already accepts JSON fields
   and resolves the acting user via `context.user.id`.

## Frontend changes (`exulu/frontend`)

### Queries — `app/(application)/data/queries.ts`
- `GET_USER_DATA_PINS` — reads `favourite_items` + `recently_viewed_items` off
  the current user (mirrors `GET_USER_FAVOURITE_PROJECTS`).
- `UPDATE_USER_DATA_PINS` — `usersUpdateOne` writing the full arrays (mirrors
  `UpdateUserFavouriteProjects`).
- A reusable `GET_ITEMS_BY_IDS` shape: one `{context}ItemsPagination` call with
  an `id IN` filter, issued once per distinct context.

### Hooks — `app/(application)/data/hooks.ts`
- `useFavoriteItems()` — module-scoped store + optimistic toggle + backend
  re-anchor, cloned from `useFavoriteProjects` (`projects/hooks.ts:129`).
  Exposes `isFavorite(globalId)` and `toggleFavorite(globalId)`.
- `useRecentlyViewedItems()` — reads the recents array; exposes
  `recordView(globalId)` that prepends, de-dupes by id, caps at 5, and persists
  via `UPDATE_USER_DATA_PINS` (debounced).
- `useResolvedPinnedItems(ids)` — groups IDs by context and resolves names live
  via `GET_ITEMS_BY_IDS`; returns `{ items, loading }` and the list of unresolved
  IDs to prune.

### View tracking
- Call `recordView(globalId)` from
  `app/(application)/data/[ctx]/items/[itemId]/item-detail-client.tsx` on mount.

### Star toggle
- Reuse `components/primitives/favorite-toggle.tsx` on:
  - item table rows in `/data/[ctx]` (the items table), and
  - the item detail header.
- Toggling does not navigate (component already prevents link hijacking).

### Sections on `/data`
- New `DataPins` component rendered **above** `ContextLibrary` in the `/data`
  surface.
- Two sections: **Favourites** and **Recently Viewed**, each a responsive grid
  of small cards (item name + context badge + star).
- Recently Viewed shows up to 5; Favourites shows all.
- Each section is **hidden when it has no (resolved) items**; both hidden while
  the context search input is active (matches the projects pattern).

### i18n
- Add section titles / empty copy keys to `messages/en.json` and
  `messages/de.json`.

## Edge cases

- **Deleted/renamed items:** live resolution returns fresh names; unresolved IDs
  are dropped from the view and pruned from the stored array on next write.
- **De-dup:** re-viewing an item moves it to the top of recents, no duplicate.
- **Concurrent toggles:** reuse the in-flight-counter guard from
  `useFavoriteProjects`.
- **New user:** empty arrays → neither section renders.
- **Resolution failure for one context:** that context's items are simply
  omitted; the rest still render (no hard failure of the whole section).

## Testing

- **Backend:** Jest resolver test confirming `usersUpdateOne` round-trips
  `favourite_items` and `recently_viewed_items` (mirrors existing
  `usersUpdateOne` tests).
- **Frontend:** hook tests for `useRecentlyViewedItems` (prepend, de-dup, cap at
  5) and `useFavoriteItems` (optimistic toggle + rollback), plus a render test
  that sections hide when empty and during search.

## Key files (reference)

| Area | File | Note |
| --- | --- | --- |
| Backend schema | `src/postgres/core-schema.ts:363` | `favourite_items` exists; add `recently_viewed_items` |
| Backend user type | `types/models/user.ts` | add the two fields |
| Backend mutation | `src/graphql/mutations/index.ts` (`usersUpdateOne`) | reused as-is |
| FE projects pattern | `app/(application)/projects/hooks.ts:129` | clone for favourites |
| FE favourites query | `app/(application)/projects/queries.ts:118` | clone for pins |
| FE star component | `components/primitives/favorite-toggle.tsx` | reuse |
| FE data queries | `app/(application)/data/queries.ts` | add pin queries |
| FE data hooks | `app/(application)/data/hooks.ts` | add pin hooks |
| FE data surface | `app/(application)/data/components/context-library.tsx` | mount `DataPins` above |
| FE item detail | `app/(application)/data/[ctx]/items/[itemId]/item-detail-client.tsx` | record view on mount |
