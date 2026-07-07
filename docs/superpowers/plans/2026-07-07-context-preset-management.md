# Context Preset Edit & Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users delete and edit saved context presets — metadata via the existing (dormant) `SavePresetModal` edit mode, contents via a preset-aware pinned-context row with an explicit "Update preset" save.

**Architecture:** All GraphQL mutations already exist (`DELETE_CONTEXT_PRESET` is unused; `UPDATE_CONTEXT_PRESET` is used only by `SavePresetModal`). We add: a shared `ContextPreset` type + RBAC write-access helper, per-row edit/delete actions in `ItemsSelectionModal` (delete = two-step inline confirm, never modal-on-modal), a `replaceSessionItems` controller method, composer-local `activePreset` state, and a preset chip + dirty-state "Update preset" button in `PinnedContextRow`.

**Tech Stack:** Next.js 16 App Router, React 19, Apollo Client, next-intl, shadcn/ui, lucide-react, vitest.

**Spec:** `docs/superpowers/specs/2026-07-07-context-preset-management-design.md`

## Global Constraints

- All preset mutations must use `refetchQueries: [GET_CONTEXT_PRESETS, "GetContextPresets"]` — the STRING operation name keeps the byte-identical duplicate documents in `app/(application)/chat/queries.ts` and `queries/queries.ts` in sync (contract note in `save-preset-modal.tsx`).
- Never modal-on-modal: deletes inside an open dialog use the two-step inline confirm pattern, NOT `ConfirmDialog` (rule documented in `components/primitives/confirm-dialog.tsx` header).
- Every new user-facing string gets a key under `chat.presets` in BOTH `messages/en.json` and `messages/de.json` (du-form German, „…“ quotes), inserted in alphabetical key order. `npm run check-messages` must pass.
- Icon-only buttons need `aria-label`.
- Baseline: `components/shell/nav-config.test.ts` has 1 pre-existing failure on main ("models" nav entry). Do not fix it here; every other test must pass.
- Commit after each task. Conventional commit messages (`feat:`, `test:`, `chore:`).
- Working directory is the worktree at `.claude/worktrees/feature+context-preset-management` on branch `feature/context-preset-management`.

---

### Task 1: Shared `ContextPreset` type + write-access helper

**Files:**
- Create: `types/models/context-preset.ts`
- Create: `lib/presets/check-preset-access.ts`
- Test: `lib/presets/check-preset-access.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `ContextPreset` interface (used by Tasks 5 and 7); `checkPresetWriteAccess(preset, user): boolean` and `PresetAccessUser` (used by Tasks 5 and 7). Signature: `checkPresetWriteAccess(preset: Pick<ContextPreset, "created_by" | "rights_mode" | "RBAC">, user: PresetAccessUser): boolean`.

- [ ] **Step 1: Create the shared type**

Create `types/models/context-preset.ts`. Field set mirrors `CONTEXT_PRESET_FIELDS` in `queries/queries.ts:2777-2800`:

```typescript
// Shared shape for context presets, mirroring CONTEXT_PRESET_FIELDS in
// queries/queries.ts. Replaces the per-component interface copies
// (items-selection-modal.tsx, save-preset-modal.tsx kept its local frozen
// copy — this type is structurally assignable to it).

export interface ContextPresetRBACUser {
  id: number;
  rights: "read" | "write";
}

export interface ContextPresetRBACEntry {
  id: string;
  rights: "read" | "write";
}

export interface ContextPreset {
  id: string;
  name: string;
  description?: string;
  /** Global ids: "<contextId>" (whole context) or "<contextId>/<itemId>". */
  preset_items: string[];
  tags?: string[];
  usage_count: number;
  favorite_count?: number;
  rights_mode?: "private" | "users" | "roles" | "teams" | "public";
  created_by: number;
  createdAt?: string;
  updatedAt?: string;
  RBAC?: {
    type?: string;
    users?: ContextPresetRBACUser[];
    roles?: ContextPresetRBACEntry[];
    teams?: ContextPresetRBACEntry[];
  };
}
```

- [ ] **Step 2: Write the failing tests**

Create `lib/presets/check-preset-access.test.ts`:

```typescript
// Unit tests for the preset RBAC write predicate, mirroring the semantics of
// lib/prompts/check-prompt-access.ts (creator/admin always; public → write;
// users/roles → explicit "write" entry; teams unresolvable client-side → false).

import { describe, expect, it } from "vitest";

import {
  checkPresetWriteAccess,
  type PresetAccessUser,
} from "@/lib/presets/check-preset-access";
import type { ContextPreset } from "@/types/models/context-preset";

const owner: PresetAccessUser = { id: 1, super_admin: false, role: { id: "role-a" } };
const admin: PresetAccessUser = { id: 2, super_admin: true, role: null };
const other: PresetAccessUser = { id: 3, super_admin: false, role: { id: "role-b" } };

function preset(
  overrides: Partial<Pick<ContextPreset, "created_by" | "rights_mode" | "RBAC">>,
): Pick<ContextPreset, "created_by" | "rights_mode" | "RBAC"> {
  return { created_by: 1, rights_mode: "private", ...overrides };
}

describe("checkPresetWriteAccess", () => {
  it("creator always has write access", () => {
    expect(checkPresetWriteAccess(preset({}), owner)).toBe(true);
  });

  it("super_admin always has write access", () => {
    expect(checkPresetWriteAccess(preset({}), admin)).toBe(true);
  });

  it("private: non-creator non-admin has no write access", () => {
    expect(checkPresetWriteAccess(preset({}), other)).toBe(false);
  });

  it("public: everyone has write access", () => {
    expect(checkPresetWriteAccess(preset({ rights_mode: "public" }), other)).toBe(true);
  });

  it("users: write entry grants access, read entry does not", () => {
    const withWrite = preset({
      rights_mode: "users",
      RBAC: { users: [{ id: 3, rights: "write" }] },
    });
    const withRead = preset({
      rights_mode: "users",
      RBAC: { users: [{ id: 3, rights: "read" }] },
    });
    expect(checkPresetWriteAccess(withWrite, other)).toBe(true);
    expect(checkPresetWriteAccess(withRead, other)).toBe(false);
  });

  it("users: no entry for the user means no write access", () => {
    const p = preset({
      rights_mode: "users",
      RBAC: { users: [{ id: 99, rights: "write" }] },
    });
    expect(checkPresetWriteAccess(p, other)).toBe(false);
  });

  it("roles: write entry for the user's role grants access, read does not", () => {
    const withWrite = preset({
      rights_mode: "roles",
      RBAC: { roles: [{ id: "role-b", rights: "write" }] },
    });
    const withRead = preset({
      rights_mode: "roles",
      RBAC: { roles: [{ id: "role-b", rights: "read" }] },
    });
    expect(checkPresetWriteAccess(withWrite, other)).toBe(true);
    expect(checkPresetWriteAccess(withRead, other)).toBe(false);
  });

  it("roles: user without a role has no write access", () => {
    const p = preset({
      rights_mode: "roles",
      RBAC: { roles: [{ id: "role-b", rights: "write" }] },
    });
    expect(checkPresetWriteAccess(p, { id: 3, super_admin: false, role: null })).toBe(false);
  });

  it("teams: not resolvable client-side, no write access", () => {
    const p = preset({
      rights_mode: "teams",
      RBAC: { teams: [{ id: "team-1", rights: "write" }] },
    });
    expect(checkPresetWriteAccess(p, other)).toBe(false);
  });

  it("missing rights_mode: no write access for non-creator", () => {
    expect(checkPresetWriteAccess(preset({ rights_mode: undefined }), other)).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run lib/presets/check-preset-access.test.ts`
Expected: FAIL — cannot resolve `@/lib/presets/check-preset-access`.

- [ ] **Step 4: Write the implementation**

Create `lib/presets/check-preset-access.ts`:

```typescript
// RBAC write predicate for context presets, mirroring
// lib/prompts/check-prompt-access.ts. Pure module: no React, no framework
// imports (same pattern as lib/rights.ts) so it stays unit-testable.

import type { ContextPreset } from "@/types/models/context-preset";

/** Minimal user shape (UserContext's user satisfies it structurally). */
export interface PresetAccessUser {
  id: number;
  super_admin: boolean;
  role?: { id: string } | null;
}

export function checkPresetWriteAccess(
  preset: Pick<ContextPreset, "created_by" | "rights_mode" | "RBAC">,
  user: PresetAccessUser,
): boolean {
  if (user.super_admin) return true;
  if (preset.created_by === user.id) return true;

  switch (preset.rights_mode) {
    case "public":
      return true;
    case "users":
      return (
        preset.RBAC?.users?.find((u) => u.id === user.id)?.rights === "write"
      );
    case "roles":
      return (
        preset.RBAC?.roles?.find((r) => r.id === user.role?.id)?.rights ===
        "write"
      );
    // "teams" membership is not resolvable client-side (CONTEXT_PRESET_FIELDS
    // does not fetch teams); "private"/undefined are creator-only.
    default:
      return false;
  }
}
```

Note: `?.rights === "write"` already yields a boolean, so no coercion is needed.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/presets/check-preset-access.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 6: Commit**

```bash
git add types/models/context-preset.ts lib/presets/check-preset-access.ts lib/presets/check-preset-access.test.ts
git commit -m "feat(presets): shared ContextPreset type and RBAC write-access helper"
```

---

### Task 2: `sameItemSet` dirty-comparison helper

**Files:**
- Create: `lib/presets/preset-items.ts`
- Test: `lib/presets/preset-items.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `sameItemSet(a: string[], b: string[]): boolean` — order-insensitive, duplicate-insensitive set equality. Used by Task 7 (composer dirty detection).

- [ ] **Step 1: Write the failing tests**

Create `lib/presets/preset-items.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { sameItemSet } from "@/lib/presets/preset-items";

describe("sameItemSet", () => {
  it("equal arrays are the same set", () => {
    expect(sameItemSet(["a", "b/1"], ["a", "b/1"])).toBe(true);
  });

  it("order does not matter", () => {
    expect(sameItemSet(["a", "b/1"], ["b/1", "a"])).toBe(true);
  });

  it("duplicates do not matter", () => {
    expect(sameItemSet(["a", "a", "b/1"], ["b/1", "a"])).toBe(true);
  });

  it("different members are not the same set", () => {
    expect(sameItemSet(["a"], ["b"])).toBe(false);
    expect(sameItemSet(["a", "b"], ["a"])).toBe(false);
    expect(sameItemSet(["a"], ["a", "b"])).toBe(false);
  });

  it("both empty is the same set", () => {
    expect(sameItemSet([], [])).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/presets/preset-items.test.ts`
Expected: FAIL — cannot resolve `@/lib/presets/preset-items`.

- [ ] **Step 3: Write the implementation**

Create `lib/presets/preset-items.ts`:

```typescript
// Set-equality over pinned-item gids ("ctx" or "ctx/item"). Used for the
// active-preset dirty check in the chat composer. Pure module.

export function sameItemSet(a: string[], b: string[]): boolean {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size !== setB.size) return false;
  for (const gid of setA) {
    if (!setB.has(gid)) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/presets/preset-items.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/presets/preset-items.ts lib/presets/preset-items.test.ts
git commit -m "feat(presets): sameItemSet helper for active-preset dirty detection"
```

---

### Task 3: i18n keys (en + de)

**Files:**
- Modify: `messages/en.json` (inside the existing `chat.presets` object, ~line 1264)
- Modify: `messages/de.json` (same object)

**Interfaces:**
- Consumes: nothing.
- Produces: the `chat.presets.*` keys used by Tasks 5–7. Existing keys `update` ("Update preset"), `updating`, `updatedToastTitle`, `updatedToastDescription`, `errorToastTitle`, `errorToastDescription` are REUSED, not duplicated.

- [ ] **Step 1: Add English keys**

In `messages/en.json`, insert into `chat.presets` in alphabetical key order:

```json
"activePresetLabel": "Active preset: {name}",
"deleteAction": "Delete preset \"{name}\"",
"deleteConfirmAction": "Confirm delete",
"deleteConfirmHint": "This cannot be undone.",
"deletedToastDescription": "\"{name}\" has been deleted.",
"deletedToastTitle": "Preset deleted",
"deleteErrorToastDescription": "There was an error deleting the preset. Please try again.",
"deleteErrorToastTitle": "Error deleting preset",
"deselectPreset": "Deselect preset \"{name}\"",
"editAction": "Edit preset \"{name}\"",
"modified": "modified"
```

(Alphabetical placement: `activePresetLabel` after `addTag`; the `delete*`/`deselectPreset` block after `defaultPermissions`; `editAction` before `editDescription`; `modified` after `itemCount`… follow strict a-z ordering of the final object.)

- [ ] **Step 2: Add German keys (du-form, „…“ quotes)**

In `messages/de.json`, same object, alphabetical order:

```json
"activePresetLabel": "Aktives Preset: {name}",
"deleteAction": "Preset „{name}“ löschen",
"deleteConfirmAction": "Löschen bestätigen",
"deleteConfirmHint": "Dies kann nicht rückgängig gemacht werden.",
"deletedToastDescription": "„{name}“ wurde gelöscht.",
"deletedToastTitle": "Preset gelöscht",
"deleteErrorToastDescription": "Beim Löschen des Presets ist ein Fehler aufgetreten. Bitte versuche es erneut.",
"deleteErrorToastTitle": "Fehler beim Löschen des Presets",
"deselectPreset": "Preset „{name}“ abwählen",
"editAction": "Preset „{name}“ bearbeiten",
"modified": "geändert"
```

- [ ] **Step 3: Verify key parity**

Run: `npm run check-messages`
Expected: passes (en/de key sets match).

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/de.json
git commit -m "feat(presets): i18n keys for preset edit, delete, and active-preset row"
```

---

### Task 4: `replaceSessionItems` on the chat session controller

**Files:**
- Modify: `app/(application)/chat/hooks.ts:116-118` (interface), `:584-615` (implementation), `:765-767` (return object)

**Interfaces:**
- Consumes: existing `ensureSession`, `updateAgentSessionItems`, `setSessionItems` internals of the controller hook.
- Produces: `replaceSessionItems(gids: string[]): Promise<void>` on `ChatSessionController` — replaces the whole pinned set (deduped), persists via the same mutation as add/remove. Used by Task 7.

- [ ] **Step 1: Extend the `ChatSessionController` interface**

At `app/(application)/chat/hooks.ts:116-118`, after `removeSessionItem`:

```typescript
  // pinned knowledge scope (items 66/67) — gids are "ctx" or "ctx/item"
  sessionItems: string[] | null;
  addSessionItems: (gids: string[]) => Promise<void>;
  removeSessionItem: (gid: string) => Promise<void>;
  replaceSessionItems: (gids: string[]) => Promise<void>;
```

- [ ] **Step 2: Implement it next to `removeSessionItem` (after line 615)**

Mirror the existing style exactly (same session guard and toast):

```typescript
  const replaceSessionItems = async (gids: string[]): Promise<void> => {
    const session = await ensureSession();
    if (!session) {
      toast.error(t("errors.title"), {
        description: t("errors.sessionCreateFailed"),
      });
      return;
    }
    const update = [...new Set(gids)];
    updateAgentSessionItems({
      variables: { id: session.id, session_items: update },
    });
    setSessionItems(update);
  };
```

- [ ] **Step 3: Expose it in the returned controller object**

At the return block (~line 765), after `removeSessionItem,` add `replaceSessionItems,`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(application)/chat/hooks.ts"
git commit -m "feat(chat): replaceSessionItems controller method for preset apply/deselect"
```

---

### Task 5: Edit & delete actions in `ItemsSelectionModal`

**Files:**
- Modify: `components/items-selection-modal.tsx` (imports/lines 1-49, props 51-87, state ~103-120, `reset` 135-142, preset list rows 455-513)

**Interfaces:**
- Consumes: `ContextPreset` + `checkPresetWriteAccess` + `PresetAccessUser` (Task 1), i18n keys (Task 3), `DELETE_CONTEXT_PRESET` / `GET_CONTEXT_PRESETS` from `@/queries/queries`.
- Produces: two new optional props consumed by Task 7:
  - `onEditPreset?: (preset: ContextPreset) => void` — pencil renders only when provided.
  - `onPresetDeleted?: (presetId: string) => void` — fired after successful delete.
  - The existing `onApplyPreset?: (items: string[], preset: ContextPreset) => void | Promise<void>` now types its second arg with the shared `ContextPreset`.

- [ ] **Step 1: Update imports and remove the local interface**

- Line 4: add `useContext` → `import { useState, useEffect, useMemo, useContext } from "react"`.
- Line 5: add `Pencil` and `Trash2` to the lucide import (`Loader2` is already there).
- Line 23: add `DELETE_CONTEXT_PRESET` to the `@/queries/queries` import.
- Add new imports:

```typescript
import { useTranslations } from "next-intl";
import { UserContext } from "@/app/(application)/authenticated";
import { checkPresetWriteAccess } from "@/lib/presets/check-preset-access";
import type { ContextPreset } from "@/types/models/context-preset";
```

- Delete the local `interface ContextPreset { ... }` (lines 40-49) — the shared type replaces it. (All consumers of the modal live under the authenticated `(application)` layout, so `UserContext` is always populated.)

- [ ] **Step 2: Add the new props**

In the destructure and the props type (lines 51-87), after `onApplyPreset`:

```typescript
    onEditPreset,
    onPresetDeleted,
```

```typescript
    onApplyPreset?: (items: string[], preset: ContextPreset) => void | Promise<void>
    /** When provided, a per-row edit (pencil) action is shown for presets the
     *  user can write; the caller owns the edit surface (the chat composer
     *  opens SavePresetModal in edit mode). */
    onEditPreset?: (preset: ContextPreset) => void
    /** Fired after a preset is deleted so callers can clear dependent state
     *  (e.g. the composer's active-preset chip). */
    onPresetDeleted?: (presetId: string) => void
```

- [ ] **Step 3: Add state, mutation, and delete handler**

After the `incrementUsage` mutation (line 120):

```typescript
    const t = useTranslations("chat");
    const tCommon = useTranslations("common");
    const { user } = useContext(UserContext);

    // Two-step inline delete confirm (never a stacked ConfirmDialog inside
    // this dialog — one overlay at a time, per confirm-dialog.tsx).
    const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
    const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);
    const [deletePresetMutation] = useMutation(DELETE_CONTEXT_PRESET, {
        // STRING operation name keeps the chat/queries.ts duplicate documents
        // refreshing too (contract note in save-preset-modal.tsx).
        refetchQueries: [GET_CONTEXT_PRESETS, "GetContextPresets"],
    });

    const handleDeletePreset = async (preset: ContextPreset) => {
        setDeletingPresetId(preset.id);
        try {
            await deletePresetMutation({ variables: { id: preset.id } });
            toast.success(t("presets.deletedToastTitle"), {
                description: t("presets.deletedToastDescription", { name: preset.name }),
            });
            if (selectedPreset?.id === preset.id) {
                setSelectedPreset(null);
                setValidationResult(null);
            }
            setConfirmingDeleteId(null);
            onPresetDeleted?.(preset.id);
        } catch (error) {
            // Keep the confirm strip open so the user can retry or cancel.
            console.error('Error deleting preset:', error);
            toast.error(t("presets.deleteErrorToastTitle"), {
                description: error instanceof Error ? error.message : t("presets.deleteErrorToastDescription"),
            });
        } finally {
            setDeletingPresetId(null);
        }
    };
```

Note: `UserContext`'s `user` (a `UserWithRole`) structurally satisfies `PresetAccessUser`.

- [ ] **Step 4: Reset confirm state with the rest**

In `reset()` (lines 135-142) add `setConfirmingDeleteId(null);`.

- [ ] **Step 5: Restructure the preset row (lines 456-512)**

The row is currently one `<button>`; interactive children may not nest. Replace the whole `filteredPresets.map` body with:

```tsx
{filteredPresets.map((preset) => {
    const stats = parsePresetItemsForDisplay(preset.preset_items);
    const isSelected = selectedPreset?.id === preset.id;
    const canWrite = user ? checkPresetWriteAccess(preset, user) : false;
    const isConfirmingDelete = confirmingDeleteId === preset.id;
    const isDeleting = deletingPresetId === preset.id;

    return (
        <div
            key={preset.id}
            className={cn(
                "relative w-full rounded-lg border transition-all",
                "hover:border-primary/50 hover:bg-accent/50",
                isSelected && "border-primary bg-accent"
            )}
        >
            <button
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={cn("w-full text-left p-3", canWrite && "pr-16")}
            >
                <div className="flex items-start gap-2 mb-2">
                    <h4 className="font-medium text-sm line-clamp-1">{preset.name}</h4>
                    {isSelected && (
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    )}
                </div>

                {preset.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {preset.description}
                    </p>
                )}

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Database className="h-3 w-3" />
                    <span>
                        {stats.contextCount} {stats.contextCount === 1 ? 'context' : 'contexts'}
                    </span>
                    {stats.itemCount > 0 && (
                        <>
                            <span>•</span>
                            <span>{stats.itemCount} {stats.itemCount === 1 ? 'item' : 'items'}</span>
                        </>
                    )}
                </div>

                {preset.tags && preset.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                        {preset.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                                {tag}
                            </Badge>
                        ))}
                        {preset.tags.length > 3 && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                +{preset.tags.length - 3}
                            </Badge>
                        )}
                    </div>
                )}
            </button>

            {canWrite && !isConfirmingDelete && (
                <div className="absolute right-2 top-2 flex items-center gap-0.5">
                    {onEditPreset && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-foreground"
                            aria-label={t("presets.editAction", { name: preset.name })}
                            onClick={() => onEditPreset(preset)}
                        >
                            <Pencil className="size-3.5" aria-hidden="true" />
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        aria-label={t("presets.deleteAction", { name: preset.name })}
                        onClick={() => setConfirmingDeleteId(preset.id)}
                    >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                </div>
            )}

            {isConfirmingDelete && (
                <div className="flex items-center gap-2 border-t px-3 py-2">
                    <p className="flex-1 text-xs text-destructive">
                        {t("presets.deleteConfirmHint")}
                    </p>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={isDeleting}
                        onClick={() => setConfirmingDeleteId(null)}
                    >
                        {tCommon("cancel")}
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={isDeleting}
                        onClick={() => void handleDeletePreset(preset)}
                    >
                        {isDeleting && (
                            <Loader2 className="mr-1 size-3 animate-spin" aria-hidden="true" />
                        )}
                        {t("presets.deleteConfirmAction")}
                    </Button>
                </div>
            )}
        </div>
    );
})}
```

Layout notes: the selected `Check` moves inline next to the name (the top-right corner now belongs to the actions); `pr-16` on the select button keeps text clear of the two icons; the confirm strip renders as a bordered row under the card body, in place — no overlay.

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint components/items-selection-modal.tsx`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/items-selection-modal.tsx
git commit -m "feat(presets): per-row edit and inline-confirm delete in items selection modal"
```

---

### Task 6: Preset-aware `PinnedContextRow`

**Files:**
- Modify: `app/(application)/chat/components/pinned-context-row.tsx` (whole file — it is 69 lines)

**Interfaces:**
- Consumes: i18n keys (Task 3).
- Produces: new optional props consumed by Task 7:
  - `activePreset?: { id: string; name: string } | null`
  - `presetDirty?: boolean`
  - `canUpdatePreset?: boolean`
  - `updatingPreset?: boolean`
  - `onDeselectPreset?: () => void`
  - `onUpdatePreset?: () => void`

- [ ] **Step 1: Replace the file contents**

```tsx
"use client";

/**
 * PinnedContextRow — conditional chip row under the composer textarea
 * (chat.md items 67/68; replaces the pinned-badges block in chat.tsx:1277–1315).
 *
 * Renders one SessionItemBadge (imported as-is from components/project-details)
 * per controller.sessionItems gid ("ctx" or "ctx/item"), removable per badge
 * via controller.removeSessionItem. The "Save context preset" affordance sits
 * at the end of the row (item 68) and opens the composer-owned SavePresetModal.
 *
 * Preset awareness (spec 2026-07-07-context-preset-management-design.md §3):
 * when the composer passes `activePreset`, a leading chip names the applied
 * preset (× deselects it), and when the pinned set diverges from the preset
 * (`presetDirty`) an "Update preset" action appears for users with write
 * access. All state and mutations live in the composer — this row stays
 * presentational.
 *
 * CONTRACT NOTE: `onSavePreset` and the preset-awareness props are ADDITIVE
 * optional props on top of the binding `{ controller }` shape — the
 * save-preset overlay flag and active-preset state are composer-local per the
 * architect's state-ownership map, so the row needs callbacks to reach them.
 * Flagged in the builder report.
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import { Bookmark, Check, Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SessionItemBadge } from "@/components/project-details";

import type { ChatSessionController } from "../hooks";

export interface PinnedContextRowProps {
  controller: ChatSessionController;
  /** Additive (flagged): opens the composer-owned SavePresetModal (item 68). */
  onSavePreset?: () => void;
  /** The preset last applied to this session (composer-local, ephemeral). */
  activePreset?: { id: string; name: string } | null;
  /** Pinned set differs from the active preset's items. */
  presetDirty?: boolean;
  /** Current user may write the active preset (checkPresetWriteAccess). */
  canUpdatePreset?: boolean;
  /** UPDATE_CONTEXT_PRESET in flight. */
  updatingPreset?: boolean;
  onDeselectPreset?: () => void;
  onUpdatePreset?: () => void;
}

export function PinnedContextRow({
  controller,
  onSavePreset,
  activePreset,
  presetDirty,
  canUpdatePreset,
  updatingPreset,
  onDeselectPreset,
  onUpdatePreset,
}: PinnedContextRowProps) {
  const t = useTranslations("chat");

  const items = controller.sessionItems;
  // Keep the row while a preset is active even if all badges were removed,
  // so "Update preset" / deselect stay reachable.
  if ((!items || items.length === 0) && !activePreset) return null;

  return (
    <div
      role="group"
      className="flex flex-wrap items-center gap-1.5 pt-2"
      aria-label={t("composer.pinnedContextLabel")}
    >
      {activePreset && (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
          aria-label={t("presets.activePresetLabel", { name: activePreset.name })}
        >
          <Bookmark className="size-3.5" aria-hidden="true" />
          <span className="max-w-40 truncate">{activePreset.name}</span>
          {presetDirty && (
            <span className="font-normal italic text-primary/70">
              {t("presets.modified")}
            </span>
          )}
          {onDeselectPreset && (
            <button
              type="button"
              onClick={onDeselectPreset}
              aria-label={t("presets.deselectPreset", { name: activePreset.name })}
              className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          )}
        </span>
      )}
      {(items || []).map((gid) => (
        <SessionItemBadge
          key={gid}
          gid={gid}
          onRemove={(removedGid) => void controller.removeSessionItem(removedGid)}
        />
      ))}
      {activePreset && presetDirty && canUpdatePreset && onUpdatePreset && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onUpdatePreset}
          disabled={updatingPreset}
          className="h-9 rounded-full text-xs md:h-7"
        >
          {updatingPreset ? (
            <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="mr-1 size-3.5" aria-hidden="true" />
          )}
          {updatingPreset ? t("presets.updating") : t("presets.update")}
        </Button>
      )}
      {onSavePreset && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onSavePreset}
          className="h-9 rounded-full text-xs md:h-7"
        >
          <Plus className="mr-1 size-3.5" aria-hidden="true" />
          {t("presets.savePresetAction")}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint "app/(application)/chat/components/pinned-context-row.tsx"`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(application)/chat/components/pinned-context-row.tsx"
git commit -m "feat(chat): preset-aware pinned-context row with deselect and update actions"
```

---

### Task 7: Composer wiring (active preset, edit mode, update mutation)

**Files:**
- Modify: `app/(application)/chat/components/composer.tsx` (imports 27-61, state ~89-110, Esc chain 176-189, `PinnedContextRow` render ~527-530, overlays 603-631)

**Interfaces:**
- Consumes: everything produced by Tasks 1-6: `ContextPreset`, `checkPresetWriteAccess`, `sameItemSet`, i18n keys, `controller.replaceSessionItems`, `ItemsSelectionModal`'s `onEditPreset`/`onPresetDeleted`, `PinnedContextRow`'s preset props, `UPDATE_CONTEXT_PRESET`/`GET_CONTEXT_PRESETS` from `../queries` (the chat copies).
- Produces: end-user behavior; no new exports.

- [ ] **Step 1: Add imports**

- Line 35: `import { useQuery, useMutation } from "@apollo/client";`
- Line 54: `import { GET_PROMPT_BY_ID, UPDATE_CONTEXT_PRESET, GET_CONTEXT_PRESETS } from "../queries";`
- New:

```typescript
import { checkPresetWriteAccess } from "@/lib/presets/check-preset-access";
import { sameItemSet } from "@/lib/presets/preset-items";
import type { ContextPreset } from "@/types/models/context-preset";
```

- Ensure `useMemo` is in the react import (line 28-34 destructure; add it if absent).

- [ ] **Step 2: Add composer-local state, derived values, and handlers**

Near the other overlay flags (after line 96 `savePresetOpen`):

```typescript
  // Active preset (spec §2): ephemeral, composer-local. Set on apply,
  // cleared on deselect/delete; lost on reload or session switch by design.
  const [activePreset, setActivePreset] = useState<ContextPreset | null>(null);
  // Preset being edited via SavePresetModal's edit mode (metadata + sharing).
  const [editingPreset, setEditingPreset] = useState<ContextPreset | null>(null);
```

Below the state (after the derived values around line 130):

```typescript
  const [updatePresetContents, { loading: updatingPreset }] = useMutation(
    UPDATE_CONTEXT_PRESET,
    {
      // STRING operation name keeps both document copies fresh (contract §0).
      refetchQueries: [GET_CONTEXT_PRESETS, "GetContextPresets"],
    },
  );

  const presetDirty = useMemo(
    () =>
      Boolean(
        activePreset &&
          !sameItemSet(controller.sessionItems || [], activePreset.preset_items),
      ),
    [activePreset, controller.sessionItems],
  );

  const canUpdatePreset = useMemo(
    () => Boolean(activePreset && user && checkPresetWriteAccess(activePreset, user)),
    [activePreset, user],
  );

  const handleUpdatePreset = async () => {
    if (!activePreset) return;
    const items = controller.sessionItems || [];
    try {
      await updatePresetContents({
        variables: { id: activePreset.id, preset_items: items },
      });
      toast.success(t("presets.updatedToastTitle"), {
        description: t("presets.updatedToastDescription", {
          name: activePreset.name,
        }),
      });
      setActivePreset((prev) => (prev ? { ...prev, preset_items: items } : prev));
    } catch (error) {
      // Dirty state stays so the user can retry.
      console.error("Error updating preset contents:", error);
      toast.error(t("presets.errorToastTitle"), {
        description:
          error instanceof Error ? error.message : t("presets.errorToastDescription"),
      });
    }
  };

  const handleDeselectPreset = async () => {
    setActivePreset(null);
    await controller.replaceSessionItems([]);
  };
```

Note: `UPDATE_CONTEXT_PRESET` declares all input variables as optional; passing only `id` + `preset_items` leaves name/description/tags/rights untouched (GraphQL omits unprovided variable fields).

- [ ] **Step 3: Extend the Esc chain (lines 176-189)**

`editingPreset` opens the same SavePresetModal surface, so it takes the `savePresetOpen` slot's priority:

```typescript
      if (capabilitiesOpen) {
        setCapabilitiesOpen(false);
      } else if (savePresetOpen || editingPreset) {
        setSavePresetOpen(false);
        setEditingPreset(null);
      } else if (promptSelectorOpen) {
        setPromptSelectorOpen(false);
      }
```

Update the effect deps to `[capabilitiesOpen, savePresetOpen, editingPreset, promptSelectorOpen]`.

- [ ] **Step 4: Pass the preset props to `PinnedContextRow` (line 527)**

```tsx
          <PinnedContextRow
            controller={controller}
            onSavePreset={() => setSavePresetOpen(true)}
            activePreset={activePreset}
            presetDirty={presetDirty}
            canUpdatePreset={canUpdatePreset}
            updatingPreset={updatingPreset}
            onDeselectPreset={() => void handleDeselectPreset()}
            onUpdatePreset={() => void handleUpdatePreset()}
          />
```

- [ ] **Step 5: Rewire the overlays (lines 603-631)**

`ItemsSelectionModal` — replace the `onApplyPreset` handler and add the two new props:

```tsx
        onApplyPreset={async (items, preset) => {
          // Replace (not merge): the pinned set becomes the preset (spec §2).
          // activePreset keeps the preset's own item list so dropped invalid
          // items surface as "modified" (spec §4).
          await controller.replaceSessionItems(items);
          setActivePreset(preset);
        }}
        onEditPreset={(preset) => {
          // One overlay at a time: close this dialog before opening the
          // edit surface (never modal-on-modal).
          setContextModalOpen(false);
          setEditingPreset(preset);
        }}
        onPresetDeleted={(presetId) => {
          setActivePreset((prev) => (prev && prev.id === presetId ? null : prev));
        }}
```

`SavePresetModal` — replace the render with:

```tsx
      {/* Save context preset (item 68) + edit mode (spec §1). The key forces
          a remount per target: SavePresetModal seeds its fields from
          existingPreset via useState initializers, which only run on mount. */}
      <SavePresetModal
        key={editingPreset?.id ?? "create"}
        isOpen={savePresetOpen || Boolean(editingPreset)}
        onClose={() => {
          setSavePresetOpen(false);
          setEditingPreset(null);
        }}
        currentItems={controller.sessionItems || []}
        existingPreset={editingPreset ?? undefined}
        onSave={(saved) => {
          // Keep the active-preset chip's metadata in sync after an edit.
          setActivePreset((prev) =>
            prev && prev.id === saved.id ? { ...prev, ...saved } : prev,
          );
        }}
      />
```

(`saved` is `SavePresetModal`'s local `ContextPreset` — a structural subset of the shared type, so the spread is type-safe. Its `preset_items` is the server echo of the unchanged items, so spreading it does not clobber the dirty baseline.)

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint "app/(application)/chat/components/composer.tsx"`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add "app/(application)/chat/components/composer.tsx"
git commit -m "feat(chat): active-preset state — apply replaces pinned set, edit/delete/update wiring"
```

---

### Task 8: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: only the pre-existing `nav-config.test.ts` failure ("models" entry); all new `lib/presets/*` tests pass.

- [ ] **Step 2: Lint, messages, build**

Run: `npm run lint && npm run check-messages && npm run build`
Expected: all pass.

- [ ] **Step 3: Manual QA (dev server, `npm run dev`)**

Walk through, in the chat composer:
1. Open the context modal → Presets tab: pencil/trash appear only on presets you own (or have write on); a shared read-only preset shows neither.
2. Trash → inline "This cannot be undone." strip → Confirm delete → toast, list refreshes; deleting the previewed preset clears the preview.
3. Pencil → items modal closes, edit modal opens pre-filled → rename → save → toast; reopen items modal, name updated.
4. Apply a preset → modal closes, chip `Bookmark <name>` leads the badge row; pinned set equals the preset (pre-existing pinned items were replaced).
5. Remove a badge → chip shows "modified" + "Update preset" (write access only) → click → toast, dirty clears. Re-add via attach menu → dirty appears again.
6. Chip × → all badges and the chip clear.
7. Delete the currently-applied preset from the modal → chip clears, badges stay.
8. Esc order: with edit modal open, Esc closes it first; composer Esc chain unchanged otherwise.
9. Switch language to German and spot-check the new strings.

**Expected:** all nine behaviors as described; report any deviation instead of claiming success.

- [ ] **Step 4: Final commit (if verification produced fixes)**

```bash
git status
```

Commit any fixes with a descriptive message; otherwise nothing to do.
