# Copy project ID — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Copy project ID" action to the project detail page's `⋯` overflow menu, grouped above the existing Edit/Delete actions via a separator.

**Architecture:** Extend the `OverflowMenu` primitive with a generic `dividerAfter` flag on `OverflowMenuItem` (renders a `DropdownMenuSeparator` after that item). Wire the copy action in `project-detail-view.tsx` using `navigator.clipboard` + sonner toast. Add one i18n key per locale.

**Tech Stack:** Next.js 16 / React 19, shadcn/ui (`DropdownMenu`), next-intl, sonner (toast), Lucide React icons.

## Global Constraints

- Icon stroke-width: 1 (Lucide default in this codebase — do not override)
- Toast calls: use `toast.success(t("common.copied"))` on success, `toast.error(t("common.copyFailed"))` on failure — keys already exist
- No new files — all changes are in existing files
- No copy/check icon feedback on the menu item itself (toast is sufficient per spec)

---

### Task 1: Extend OverflowMenu with `dividerAfter` support and add i18n keys

**Files:**
- Modify: `components/primitives/overflow-menu.tsx`
- Modify: `messages/en.json`
- Modify: `messages/de.json`

**Interfaces:**
- Produces: `OverflowMenuItem.dividerAfter?: boolean` — when `true`, a `DropdownMenuSeparator` is rendered after that item in the standard items list (not between the last standard item and the destructive group, which already has its own separator)

---

- [ ] **Step 1: Add `dividerAfter` to `OverflowMenuItem` and update the render loop**

Open `components/primitives/overflow-menu.tsx`. Make two changes:

**1a.** Add the optional field to the `OverflowMenuItem` interface (after `destructive?`):

```tsx
export interface OverflowMenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
  /** When true, renders a DropdownMenuSeparator after this item within the standard items group. */
  dividerAfter?: boolean;
  disabled?: boolean;
  description?: string;
  shortcut?: string;
}
```

**1b.** In the `OverflowMenu` component body, replace the `standardItems` render block:

Before:
```tsx
{standardItems.map((item, index) => (
  <OverflowMenuEntry key={`${index}-${item.label}`} item={item} />
))}
```

After:
```tsx
{standardItems.map((item, index) => (
  <React.Fragment key={`${index}-${item.label}`}>
    <OverflowMenuEntry item={item} />
    {item.dividerAfter && index < standardItems.length - 1 && (
      <DropdownMenuSeparator />
    )}
  </React.Fragment>
))}
```

The guard `index < standardItems.length - 1` prevents a double separator when the last standard item has `dividerAfter: true` and there are destructive items (the destructive separator already handles that gap).

- [ ] **Step 2: Add i18n key to `messages/en.json`**

Find the `"projects"` → `"detail"` object (around line 2883). Add `"copyId"` in alphabetical order (after `"backToProjects"`, before `"deleteProject"`):

```json
"detail": {
  "actions": "Project actions",
  "backToProjects": "Back to projects",
  "copyId": "Copy project ID",
  "deleteProject": "Delete project...",
  "editDetails": "Edit details",
  "errorTitle": "Couldn't load this project",
  "instructionsActive": "Instructions active",
  "newSession": "New session",
  "notFoundDescription": "It may have been deleted, or you no longer have access to it.",
  "notFoundTitle": "Project not found",
  "viewInstructions": "View"
},
```

- [ ] **Step 3: Add i18n key to `messages/de.json`**

Find the `"projects"` → `"detail"` object (same structure, around line 2883). Add `"copyId"` in the same alphabetical position:

```json
"detail": {
  "actions": "Projektaktionen",
  "backToProjects": "Zurück zu Projekten",
  "copyId": "Projekt-ID kopieren",
  "deleteProject": "Projekt löschen...",
  "editDetails": "Details bearbeiten",
  "errorTitle": "Dieses Projekt konnte nicht geladen werden",
  "instructionsActive": "Anweisungen aktiv",
  "newSession": "Neue Sitzung",
  "notFoundDescription": "Es wurde möglicherweise gelöscht oder Sie haben keinen Zugriff mehr darauf.",
  "notFoundTitle": "Projekt nicht gefunden",
  "viewInstructions": "Anzeigen"
},
```

- [ ] **Step 4: Verify TypeScript compiles cleanly**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/primitives/overflow-menu.tsx messages/en.json messages/de.json
git commit -m "feat(overflow-menu): add dividerAfter support; add projects.detail.copyId i18n"
```

---

### Task 2: Wire copy action in the project detail view

**Files:**
- Modify: `app/(application)/projects/components/project-detail-view.tsx`

**Interfaces:**
- Consumes: `OverflowMenuItem.dividerAfter?: boolean` (from Task 1)
- Consumes: `project.id: string` (already available in scope)
- Consumes: `t("detail.copyId")` → `"Copy project ID"` (from Task 1 i18n)
- Consumes: `t("common.copied")` → `"Copied to clipboard"` (already exists)
- Consumes: `t("common.copyFailed")` → `"Couldn't copy to clipboard"` (already exists)
- Consumes: `toast` from sonner (already imported)

---

- [ ] **Step 1: Add `Copy` to the lucide-react import**

At the top of `app/(application)/projects/components/project-detail-view.tsx`, the lucide import currently reads:

```tsx
import { FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";
```

Add `Copy`:

```tsx
import { Copy, FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";
```

- [ ] **Step 2: Add the copy item to the OverflowMenu**

Find the `OverflowMenu` usage in the `action` prop of `PageHeader` (around line 274). The `items` array currently reads:

```tsx
items={[
  {
    label: t("detail.editDetails"),
    icon: Pencil,
    onSelect: () => setTab("settings", { edit: true }),
  },
  {
    label: t("detail.deleteProject"),
    icon: Trash2,
    destructive: true,
    onSelect: () => setDeleteOpen(true),
  },
]}
```

Replace with:

```tsx
items={[
  {
    label: t("detail.copyId"),
    icon: Copy,
    dividerAfter: true,
    onSelect: async () => {
      try {
        await navigator.clipboard.writeText(project.id);
        toast.success(t("common.copied"));
      } catch {
        toast.error(t("common.copyFailed"));
      }
    },
  },
  {
    label: t("detail.editDetails"),
    icon: Pencil,
    onSelect: () => setTab("settings", { edit: true }),
  },
  {
    label: t("detail.deleteProject"),
    icon: Trash2,
    destructive: true,
    onSelect: () => setDeleteOpen(true),
  },
]}
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Manually verify in the browser**

Start the dev server (`npm run dev`), navigate to any project detail page, open the `⋯` menu and confirm:

1. "Copy project ID" appears as the first item
2. A separator divides it from "Edit details"
3. Clicking it shows a "Copied to clipboard" toast
4. The clipboard contains the project's ID (paste into a text editor to confirm)
5. The existing "Edit details" and "Delete project..." items still work

- [ ] **Step 5: Commit**

```bash
git add "app/(application)/projects/components/project-detail-view.tsx"
git commit -m "feat(projects): add copy project ID action to overflow menu"
```
