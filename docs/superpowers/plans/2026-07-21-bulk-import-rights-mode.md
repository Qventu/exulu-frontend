# Bulk Import Batch Access (rights mode) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the knowledge-base bulk import wizard set a rights mode (+ user/role/team grants) for all items it creates, instead of everything landing private.

**Architecture:** One batch-level `BatchAccess` state owned by `ImportWizardDialog`, edited via the existing `RBACControl` in a review-footer popover, merged into each create input at the runner's create boundary by a pure `mergeBatchAccess` helper. Rows classified as updates are never touched. One small backend change: the generic `CreateOne` resolver honors an explicitly provided, validated `rights_mode` instead of force-inserting `"private"`.

**Tech Stack:** Next.js 16 / React 19, Apollo GraphQL, next-intl, shadcn/ui (Radix Popover), vitest (frontend, node env), Node/Knex GraphQL backend with jest.

**Spec:** `docs/superpowers/specs/2026-07-21-bulk-import-rights-mode-design.md` — read it first.

## Global Constraints

- Two repositories: **frontend** = this repo (branch `main`), **backend** = `/Users/daniel.claessen/Desktop/Projects/exulu/backend` (branch `develop`). Task 1 is backend-only; Tasks 2–3 are frontend-only.
- Pre-existing baseline failures — do NOT try to fix them, only NEW failures block: frontend `components/shell/nav-config` test + an `entity-types` lint warning; backend has 14 pre-existing `tsc` errors.
- Both working trees may contain unrelated uncommitted changes (e.g. a chat-export feature in the frontend). `git add` ONLY the files named in each task — never `git add -A` / `git add .`.
- Every new user-facing string gets en + de entries in `messages/en.json` / `messages/de.json`.
- Valid rights modes everywhere: `private | users | roles | teams | public`.
- Do not push either repo; commits stay local. End commit messages with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Backend — `CreateOne` honors explicit `rights_mode`

**Files:**
- Modify: `/Users/daniel.claessen/Desktop/Projects/exulu/backend/src/graphql/mutations/index.ts` (module scope + the `CreateOne` insert, currently ~lines 522–530)
- Test (create): `/Users/daniel.claessen/Desktop/Projects/exulu/backend/src/graphql/mutations/create-rights-mode.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `${table}CreateOne` GraphQL mutations accept `input.rights_mode` (one of the 5 valid modes) and persist it; invalid values throw `Invalid rights_mode …`; absent still inserts `"private"`. `input.RBAC` grant handling is unchanged. Task 3's runner relies on this contract.

- [ ] **Step 1: Confirm backend repo is on `develop`**

Run: `git -C /Users/daniel.claessen/Desktop/Projects/exulu/backend branch --show-current`
Expected: `develop`. If not, stop and ask the user.

- [ ] **Step 2: Write the failing test**

Create `/Users/daniel.claessen/Desktop/Projects/exulu/backend/src/graphql/mutations/create-rights-mode.test.ts`. The mock header is copied from the sibling `validate-write-access.test.ts` — createMutations' module imports are heavy, so everything it touches must be mocked before import (jest.mock calls are hoisted).

```ts
/**
 * CreateOne rights_mode behavior: an explicitly provided, valid rights_mode
 * is persisted; an invalid one throws; absent still defaults to "private".
 * (Bulk-import batch access — spec 2026-07-21-bulk-import-rights-mode.)
 */

// Mock the heavy graph mutations/index.ts imports (same approach as
// validate-write-access.test.ts) — jest.mock calls are hoisted above the import.
jest.mock("@SRC/exulu/context", () => ({
  getChunksTableName: (id: string) => `${id}_chunks`,
  getTableName: (id: string) => id,
}));
jest.mock("@SRC/exulu/entities", () => ({
  resolveEntityModel: jest.fn(),
  setEntityModelSetting: jest.fn(),
}));
jest.mock("@SRC/exulu/statistics", () => ({ updateStatistic: jest.fn() }));
jest.mock("@SRC/graphql/resolvers/utils", () => ({
  contextItemsProcessorHandler: jest.fn(),
  getRequestedFields: jest.fn(() => []),
}));
jest.mock("@SRC/graphql/utilities/access-control", () => ({
  applyAccessControl: jest.fn((_t: any, q: any) => q),
}));
jest.mock("@SRC/auth/generate-key.ts", () => ({ SALT_ROUNDS: 10 }));
jest.mock("@SRC/postgres/client", () => ({ postgresClient: jest.fn() }));
jest.mock("@SRC/graphql/resolvers/apply-filters.ts", () => ({
  applyFilters: jest.fn(),
}));
jest.mock("@SRC/graphql/utilities/validate-super-admin-update.ts", () => ({
  validateCreateOrRemoveSuperAdminPermission: jest.fn(async () => {}),
}));
jest.mock("@SRC/graphql/utilities/encrypt-sensitive-fields.ts", () => ({
  encryptSensitiveFields: (input: any) => input,
}));
jest.mock("@SRC/graphql/utilities/sanitize-and-hydrate-fields.ts", () => ({
  finalizeRequestedFields: jest.fn((f: any) => f),
}));
jest.mock("@SRC/exulu/routines/run-state.ts", () => ({
  cancelRoutineRunRow: jest.fn(),
}));
jest.mock("@EE/queues/queues", () => ({ queues: {} }));
jest.mock("@SRC/graphql/resolvers/index.ts", () => ({
  itemsPaginationRequest: jest.fn(),
  sanitizeRequestedFields: jest.fn((f: any) => f),
}));
jest.mock("@EE/rbac-update.ts", () => ({ handleRBACUpdate: jest.fn() }));

import { handleRBACUpdate } from "@EE/rbac-update.ts";
import { createMutations } from "./index";

// Neutral RBAC table: none of the special-cased singulars (user/agent), and
// type !== "items" so postprocessUpdate skips the embedder/processor branch.
const presetsTable: any = {
  name: { singular: "preset", plural: "presets" },
  type: "presets",
  RBAC: true,
  fields: [
    { name: "name", type: "text" },
    { name: "rights_mode", type: "text" },
  ],
};

// Chainable knex-like mock for the CreateOne path: captures the inserted row.
function makeCreateDb() {
  const captured: { inserted?: any } = {};
  const builder = () => ({
    columnInfo: async () => ({ id: {}, name: {}, rights_mode: {}, created_by: {} }),
    insert: (obj: any) => {
      captured.inserted = obj;
      return { returning: async () => [{ ...obj }] };
    },
  });
  const db: any = Object.assign(() => builder(), {
    from: () => builder(),
    fn: { uuid: () => "00000000-0000-4000-8000-000000000001" },
  });
  return { db, captured };
}

function makeContext(db: any) {
  return { db, user: { id: 7, super_admin: true, role: { id: "role-1" } }, req: {} };
}

const mutations = createMutations(presetsTable, [], [], [], {} as any);
const createPreset = mutations["presetsCreateOne"];

beforeEach(() => jest.clearAllMocks());

describe("CreateOne rights_mode", () => {
  it("persists an explicitly provided valid rights_mode and keeps grant handling", async () => {
    const { db, captured } = makeCreateDb();
    const rbac = { teams: [{ id: "t1", rights: "read" }] };
    await createPreset(
      null,
      { input: { name: "X", rights_mode: "teams", RBAC: rbac } },
      makeContext(db),
      {},
    );
    expect(captured.inserted.rights_mode).toBe("teams");
    expect(handleRBACUpdate).toHaveBeenCalledWith(
      db,
      "preset",
      captured.inserted.id,
      rbac,
      [],
    );
  });

  it("rejects an invalid rights_mode without inserting", async () => {
    const { db, captured } = makeCreateDb();
    await expect(
      createPreset(
        null,
        { input: { name: "X", rights_mode: "everyone" } },
        makeContext(db),
        {},
      ),
    ).rejects.toThrow(/Invalid rights_mode/);
    expect(captured.inserted).toBeUndefined();
  });

  it("still defaults to private when rights_mode is absent", async () => {
    const { db, captured } = makeCreateDb();
    await createPreset(null, { input: { name: "X" } }, makeContext(db), {});
    expect(captured.inserted.rights_mode).toBe("private");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails the right way**

Run: `cd /Users/daniel.claessen/Desktop/Projects/exulu/backend && npx jest src/graphql/mutations/create-rights-mode.test.ts`
Expected: FAIL — test 1 fails with `Expected: "teams" / Received: "private"`, test 2 fails because nothing throws. Test 3 already passes.

- [ ] **Step 4: Implement the change**

In `/Users/daniel.claessen/Desktop/Projects/exulu/backend/src/graphql/mutations/index.ts`:

(a) Add at module scope, directly after the import block (before `const postprocessDeletion`):

```ts
// Same allow-list as utils/check-item-write-access.ts — the modes a client
// may explicitly set on create.
const VALID_RIGHTS_MODES = ["private", "users", "roles", "teams", "public"];
```

(b) In `${tableNamePlural}CreateOne`, find (currently ~lines 522–530):

```ts
      // We need to retrieve all the columns for potential post processing
      // operations that might need to be performed on the fields.
      const columns = await db(tableNamePlural).columnInfo();
      const insert = db(tableNamePlural)
        .insert({
          ...input,
          ...(table.RBAC ? { rights_mode: "private" } : {}),
        })
        .returning(Object.keys(columns));
```

and replace with:

```ts
      // Honor an explicitly provided rights_mode (bulk import batch access);
      // absent still means "private". Invalid values are rejected rather than
      // silently downgraded. CopyOneById intentionally keeps forcing private.
      if (table.RBAC && input.rights_mode != null && !VALID_RIGHTS_MODES.includes(input.rights_mode)) {
        throw new Error(
          `Invalid rights_mode "${input.rights_mode}" — expected one of: ${VALID_RIGHTS_MODES.join(", ")}`,
        );
      }

      // We need to retrieve all the columns for potential post processing
      // operations that might need to be performed on the fields.
      const columns = await db(tableNamePlural).columnInfo();
      const insert = db(tableNamePlural)
        .insert({
          ...input,
          ...(table.RBAC ? { rights_mode: input.rights_mode ?? "private" } : {}),
        })
        .returning(Object.keys(columns));
```

- [ ] **Step 5: Run the new test to verify it passes**

Run: `cd /Users/daniel.claessen/Desktop/Projects/exulu/backend && npx jest src/graphql/mutations/create-rights-mode.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Run the sibling mutations tests to catch regressions**

Run: `cd /Users/daniel.claessen/Desktop/Projects/exulu/backend && npx jest src/graphql/mutations`
Expected: PASS (the pre-existing `validate-write-access.test.ts` must stay green).

- [ ] **Step 7: Commit (backend repo)**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/backend
git add src/graphql/mutations/index.ts src/graphql/mutations/create-rights-mode.test.ts
git commit -m "feat(rbac): CreateOne honors explicit validated rights_mode

Absent input still forces private; invalid values throw. Enables bulk-import
batch access and fixes save-preset visibility being silently privatized.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Frontend — `BatchAccess` type + `mergeBatchAccess` helper

**Files:**
- Modify: `lib/import/types.ts` (add `BatchAccess`)
- Modify: `lib/import/rows.ts` (add `mergeBatchAccess`)
- Test: `lib/import/rows.test.ts` (new describe block)
- Test: `lib/import/runner.test.ts` (one guard test)

**Interfaces:**
- Consumes: nothing from other tasks (backend contract from Task 1 at runtime only).
- Produces:
  - `interface BatchAccess { rights_mode: "private" | "users" | "roles" | "teams" | "public"; users: { id: number; rights: "read" | "write" }[]; roles: { id: string; rights: "read" | "write" }[]; teams: { id: string; rights: "read" | "write" }[] }` exported from `lib/import/types.ts`.
  - `mergeBatchAccess(input: Record<string, unknown>, access: BatchAccess): Record<string, unknown>` exported from `lib/import/rows.ts`. Task 3 imports both.

- [ ] **Step 1: Write the failing tests**

Append to `lib/import/rows.test.ts` (add `mergeBatchAccess` to the existing `@/lib/import/rows` import and `BatchAccess` to the `@/lib/import/types` type import):

```ts
describe("mergeBatchAccess", () => {
  const base = { name: "A", description: "d", source: "import" };

  it("adds rights_mode without RBAC for private/public", () => {
    const out = mergeBatchAccess(base, {
      rights_mode: "public",
      users: [],
      roles: [],
      teams: [],
    });
    expect(out).toEqual({ ...base, rights_mode: "public" });
    expect("RBAC" in out).toBe(false);
  });

  it("adds rights_mode and RBAC grants for grant-based modes", () => {
    const access: BatchAccess = {
      rights_mode: "teams",
      users: [{ id: 1, rights: "read" }],
      roles: [],
      teams: [{ id: "t1", rights: "write" }],
    };
    const out = mergeBatchAccess(base, access);
    expect(out.rights_mode).toBe("teams");
    expect(out.RBAC).toEqual({
      users: access.users,
      roles: [],
      teams: access.teams,
    });
  });

  it("does not mutate the original input", () => {
    const out = mergeBatchAccess(base, {
      rights_mode: "private",
      users: [],
      roles: [],
      teams: [],
    });
    expect(out).not.toBe(base);
    expect(base).not.toHaveProperty("rights_mode");
  });
});
```

Append to `lib/import/runner.test.ts` inside `describe("runImport", …)` — locks in that the runner itself never injects access into update inputs (batch access is applied only in the hook's `createItem` effect, Task 3):

```ts
  it("update inputs never contain rights fields (batch access is create-only)", async () => {
    const fx = effects();
    const row: ImportRow = {
      key: "u2",
      action: "update",
      targetItemId: "item-2",
      runState: "pending",
      cells: { description: { raw: "d", value: "d" } },
    };
    await runImport([row], FIELDS, fx, { onRowState: () => {} });
    const input = fx.updateItem.mock.calls[0][1];
    expect(input).not.toHaveProperty("rights_mode");
    expect(input).not.toHaveProperty("RBAC");
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run lib/import/rows.test.ts lib/import/runner.test.ts`
Expected: rows.test.ts FAILS to compile/run (`mergeBatchAccess` is not exported); the runner guard test PASSES already (it documents existing behavior — that is fine, it exists to catch future regressions).

- [ ] **Step 3: Implement type + helper**

Append to `lib/import/types.ts`:

```ts
/**
 * Batch-level access chosen in the import wizard. Applied to CREATED rows
 * only — update rows keep their existing access (spec decision #2).
 */
export interface BatchAccess {
  rights_mode: "private" | "users" | "roles" | "teams" | "public";
  users: { id: number; rights: "read" | "write" }[];
  roles: { id: string; rights: "read" | "write" }[];
  teams: { id: string; rights: "read" | "write" }[];
}
```

Append to `lib/import/rows.ts` (add `BatchAccess` to its existing `@/lib/import/types` type import):

```ts
/**
 * Merge the wizard's batch access into a create input. rights_mode is always
 * sent; grant lists only for grant-based modes (private/public carry none).
 */
export function mergeBatchAccess(
  input: Record<string, unknown>,
  access: BatchAccess,
): Record<string, unknown> {
  const hasGrants =
    access.rights_mode === "users" ||
    access.rights_mode === "roles" ||
    access.rights_mode === "teams";
  return {
    ...input,
    rights_mode: access.rights_mode,
    ...(hasGrants
      ? {
          RBAC: {
            users: access.users,
            roles: access.roles,
            teams: access.teams,
          },
        }
      : {}),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/import/rows.test.ts lib/import/runner.test.ts`
Expected: PASS (all, including pre-existing tests).

- [ ] **Step 5: Commit**

```bash
git add lib/import/types.ts lib/import/rows.ts lib/import/rows.test.ts lib/import/runner.test.ts
git commit -m "feat(import): BatchAccess type and mergeBatchAccess helper

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Frontend — wire batch access through the wizard (hook, UI, i18n)

**Files:**
- Modify: `app/(application)/data/[ctx]/components/import/use-import-runner.ts`
- Modify: `app/(application)/data/[ctx]/components/import/import-wizard-dialog.tsx`
- Modify: `app/(application)/data/[ctx]/components/item-access-section.tsx` (export one const)
- Modify: `messages/en.json`, `messages/de.json`

**Interfaces:**
- Consumes: `BatchAccess` from `@/lib/import/types`, `mergeBatchAccess` from `@/lib/import/rows` (Task 2); backend contract from Task 1.
- Produces: `useImportRunner(contextId: string, fields: ImportField[], batchAccess: BatchAccess)` — third parameter is new; no other public surface changes.

There is no component-test infra (vitest runs in node env, no DOM), so this task's verification is: existing tests stay green, typecheck/lint pass, plus a manual walkthrough.

- [ ] **Step 1: Export the mode-label map**

In `app/(application)/data/[ctx]/components/item-access-section.tsx`, change:

```ts
const MODE_LABEL_KEY: Record<string, string> = {
```

to:

```ts
export const MODE_LABEL_KEY: Record<string, string> = {
```

- [ ] **Step 2: Thread batch access through the runner hook**

In `app/(application)/data/[ctx]/components/import/use-import-runner.ts`:

Change the imports:

```ts
import { mergeBatchAccess, rowIsValid } from "@/lib/import/rows";
import { runImport } from "@/lib/import/runner";
import type { RunSummary } from "@/lib/import/runner";
import type {
  BatchAccess,
  ImportField,
  ImportRow,
  RowRunState,
} from "@/lib/import/types";
```

Change the signature:

```ts
export function useImportRunner(
  contextId: string,
  fields: ImportField[],
  batchAccess: BatchAccess,
) {
```

Change the `createItem` effect inside `run` (the `updateItem` effect stays exactly as is):

```ts
          createItem: async (input) => {
            await client.mutate({
              mutation: CREATE_ITEM(contextId, []),
              variables: { input: mergeBatchAccess(input, batchAccess) },
            });
          },
```

Change the `run` callback's dependency array:

```ts
    [client, contextId, fields, batchAccess],
```

- [ ] **Step 3: Wizard dialog — state, reset, footer popover**

In `app/(application)/data/[ctx]/components/import/import-wizard-dialog.tsx`:

(a) Imports — extend/add:

```ts
import { CheckCircle2, Lock } from "lucide-react";
```

```ts
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RBACControl } from "@/components/rbac";
```

```ts
import type { BatchAccess, ImportRow } from "@/lib/import/types";
```

(replacing the existing `import type { ImportRow } from "@/lib/import/types";`)

```ts
import { MODE_LABEL_KEY } from "../item-access-section";
```

(b) State — insert directly BEFORE the `const runner = useImportRunner(...)` line:

```ts
  // Batch access (spec 2026-07-21-bulk-import-rights-mode): one setting for
  // the whole run, applied to CREATED rows only. Defaults to the context's
  // defaultRightsMode — sending it explicitly is what makes that config
  // effective (CreateOne otherwise forces private).
  const defaultBatchAccess = React.useCallback(
    (): BatchAccess => ({
      rights_mode: context.configuration?.defaultRightsMode ?? "private",
      users: [],
      roles: [],
      teams: [],
    }),
    [context],
  );
  const [batchAccess, setBatchAccess] =
    React.useState<BatchAccess>(defaultBatchAccess);
```

(c) Change the runner call:

```ts
  const runner = useImportRunner(context.id, fields, batchAccess);
```

(d) In the reset-on-open effect, add one line next to the other resets (before `runner.reset();`):

```ts
      setBatchAccess(defaultBatchAccess());
```

(e) Footer — replace the review/edit footer block:

```tsx
          {step === "review" && runner.phase === "edit" && (
            <>
              <span className="mr-auto text-sm text-muted-foreground">
                {t("workspace.import.review.validCount", {
                  valid: validRows.length,
                  total: rows.length,
                })}
              </span>
              <Button
                type="button"
                disabled={validRows.length === 0 || verifying}
                onClick={() => void runner.run(rowsRef.current)}
              >
                {validRows.length === rows.length
                  ? t("workspace.import.review.importAll", {
                      count: rows.length,
                    })
                  : t("workspace.import.review.importValid", {
                      count: validRows.length,
                    })}
              </Button>
            </>
          )}
```

with:

```tsx
          {step === "review" && runner.phase === "edit" && (
            <>
              <span className="mr-auto text-sm text-muted-foreground">
                {t("workspace.import.review.validCount", {
                  valid: validRows.length,
                  total: rows.length,
                })}
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline">
                    <Lock aria-hidden="true" className="size-4" />
                    {t("workspace.import.review.accessLabel", {
                      mode: t(
                        MODE_LABEL_KEY[batchAccess.rights_mode] ??
                          "workspace.access.modePrivate",
                      ),
                    })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="max-h-[60vh] w-[420px] overflow-y-auto"
                >
                  <div className="space-y-3">
                    <RBACControl
                      modalMode
                      subjectLabel={t("workspace.import.review.accessSubject")}
                      initialRightsMode={batchAccess.rights_mode}
                      initialUsers={batchAccess.users}
                      initialRoles={batchAccess.roles}
                      initialTeams={batchAccess.teams}
                      onChange={(rights_mode, users, roles, teams) =>
                        setBatchAccess({
                          rights_mode,
                          users,
                          roles,
                          teams: teams ?? [],
                        })
                      }
                    />
                    {rows.some((r) => r.action === "update") &&
                      batchAccess.rights_mode !== "private" && (
                        <p className="text-sm text-muted-foreground">
                          {t("workspace.import.review.accessHint")}
                        </p>
                      )}
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                disabled={validRows.length === 0 || verifying}
                onClick={() => void runner.run(rowsRef.current)}
              >
                {validRows.length === rows.length
                  ? t("workspace.import.review.importAll", {
                      count: rows.length,
                    })
                  : t("workspace.import.review.importValid", {
                      count: validRows.length,
                    })}
              </Button>
            </>
          )}
```

Notes: the control renders only in the edit phase, so it is automatically hidden while running/done — and "retry failed rows" reuses the same `batchAccess`. If the popover's nested portals misbehave in practice (RBACControl opens its own popover inside), the approved fallback is a small nested `Dialog` as in `save-preset-modal.tsx` — do NOT preemptively build it.

- [ ] **Step 4: i18n strings (en + de)**

In `messages/en.json`, inside `knowledge.workspace.import.review`, add (keep alphabetical order):

```json
"accessHint": "Applies to newly created items only.",
"accessLabel": "Access: {mode}",
"accessSubject": "imported item",
```

In `messages/de.json`, inside `knowledge.workspace.import.review`, add:

```json
"accessHint": "Gilt nur für neu erstellte Einträge.",
"accessLabel": "Zugriff: {mode}",
"accessSubject": "importiertes Element",
```

(The mode value interpolated into `accessLabel` comes from the existing `knowledge.workspace.access.mode*` keys via `MODE_LABEL_KEY` — no new keys needed for modes.)

- [ ] **Step 5: Verify — tests, typecheck, lint**

Run: `npx vitest run`
Expected: all pass EXCEPT the pre-existing `components/shell/nav-config` baseline failure.

Run: `npx tsc --noEmit`
Expected: clean (frontend tsc baseline is clean on main).

Run: `npm run lint`
Expected: no NEW warnings/errors beyond the pre-existing `entity-types` one.

- [ ] **Step 6: Manual walkthrough (needs backend from Task 1 running)**

1. Start backend (`npm run dev` in the backend repo) and frontend (`npm run dev`), log in.
2. Open a knowledge context → Import → add a CSV containing at least one new row and one row matching an existing item's `external_id` → reach the review step.
3. Footer shows `Access: Private` (or the context's `defaultRightsMode` label). Open it, pick e.g. Teams + one team with read — button label updates; the "Applies to newly created items only." hint shows (batch has an update row).
4. Import. Open a created item → Access section badge shows Teams and the team grant. Open the updated item → its access is unchanged.
5. Re-open the import dialog → access is back to the default (reset works).

- [ ] **Step 7: Commit**

```bash
git add "app/(application)/data/[ctx]/components/import/use-import-runner.ts" "app/(application)/data/[ctx]/components/import/import-wizard-dialog.tsx" "app/(application)/data/[ctx]/components/item-access-section.tsx" messages/en.json messages/de.json
git commit -m "feat(import): batch access (rights mode) control in the import wizard

Review-footer RBACControl popover; chosen mode + grants merged into create
inputs only — update rows keep their existing access.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
