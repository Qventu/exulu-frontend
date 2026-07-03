# Design: Copy project ID via overflow menu

**Date:** 2026-07-03  
**Status:** Approved

## Summary

Add a "Copy project ID" action to the project detail page's existing `⋯` overflow menu. The action is placed at the top of the menu in its own copy group, separated from the edit/delete group by a divider. The `OverflowMenu` primitive is extended to support this grouping pattern generically via a `dividerAfter` flag.

## Motivation

Developers and DevOps practitioners frequently need the project ID when calling the Exulu API, writing scripts, or configuring integrations. It should be accessible in one click without leaving the page.

The overflow menu was chosen (over a standalone icon button) because the user wants to add further copy actions in the future (e.g. copy project URL, copy slug). Grouping them under the `⋯` menu keeps the header action bar from growing cluttered.

## Design

### Menu structure

```
⋯ (Project actions)
├── Copy project ID     ← copy group
├───────────────────    ← separator (dividerAfter: true on the copy item)
├── Edit details
└── Delete project...   ← destructive (existing separator before this)
```

### OverflowMenu extension

Add an optional `dividerAfter?: boolean` field to `OverflowMenuItem`. When `true`, a `DropdownMenuSeparator` is rendered immediately after that item, before the next item. This is a generic mechanism — no project-specific logic in the primitive.

### Copy behavior

- Calls `navigator.clipboard.writeText(project.id)`
- On success: `toast.success(t("common.copied"))`
- On failure: `toast.error(t("common.copyFailed"))`
- No copy/check icon state change on the menu item (the toast is sufficient feedback for a menu item, unlike an always-visible icon button)

### i18n

New key added to `projects.detail` in both `en.json` and `de.json`:

```json
"copyId": "Copy project ID"
```

## Files to change

| File | Change |
|------|--------|
| `components/primitives/overflow-menu.tsx` | Add `dividerAfter?: boolean` to `OverflowMenuItem`; render separator after item when set |
| `app/(application)/projects/components/project-detail-view.tsx` | Add copy item as first entry in `OverflowMenu` items array with `dividerAfter: true` |
| `messages/en.json` | Add `projects.detail.copyId` |
| `messages/de.json` | Add `projects.detail.copyId` |

## Out of scope

- Additional copy actions (copy URL, slug, etc.) — the structure makes these trivial to add later
- Copy feedback on the menu item trigger itself (icon toggle) — toast is sufficient
