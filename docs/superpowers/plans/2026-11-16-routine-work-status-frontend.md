# Routine Work Status (frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show and set a work status on routine runs, split the runs list into "open" and "done", and let routine editors configure the status list.

**Architecture:** Pure helpers in `lib/routine-runs/work-status.ts` (config parsing, key derivation, badge classes) keep the logic testable in node. `RoutineRunsList` gains a status badge with a menu and renders two query-backed areas when the routine has statuses. A new workbench section edits the list and saves it through the existing routine update mutation.

**Tech Stack:** Next.js 16, React 19, Apollo Client 3, next-intl, vitest + Testing Library (jsdom per file via `// @vitest-environment jsdom`).

**Spec:** `exulu/backend/docs/superpowers/specs/2026-11-16-routine-work-status-design.md`. Backend plan (must be merged and deployed first): `exulu/backend/docs/superpowers/plans/2026-11-16-routine-work-status.md`.

## Global Constraints

- A routine without statuses renders exactly as today: no badge column, no areas, no extra filter.
- Status key: `^[a-z][a-z0-9_]{1,39}$`, derived from the label on creation, **read-only afterwards**.
- The default status may not be a done status; warn (do not block) when no status is marked done.
- Everyone who sees the runs may set a status (no extra permission check in the UI).
- All copy in `messages/de.json` and `messages/en.json` under `routines.workStatus.*`; run `npm run check-messages`.
- Tests: `npx vitest run <path>`. Lint: `npx eslint <files>`. Types: `npx tsc --noEmit`.
- Colours come from a fixed palette of seven names: `gray, red, orange, yellow, green, blue, purple`.

## Review Focus

1. A run carries a key that is no longer configured → neutral badge showing the raw key and the "removed" hint; the menu still lets the user pick a valid status. (Task 3)
2. `work_statuses` arrives as `null`, `{}`, or a JSON string → treated as "none configured". (Task 1)
3. The mutation fails (network, validation) → optimistic badge reverts and a toast shows the server message. (Task 3)
4. A run moves between areas when its status changes → both areas' lists and counts refresh; the row does not appear in both or neither. (Task 4)
5. Two statuses whose labels derive the same key ("Erledigt" twice) → the second gets a `_2` suffix; saving never sends duplicates. (Tasks 1, 5)

---

### Task 1: Helpers — `lib/routine-runs/work-status.ts`

**Files:** Create `lib/routine-runs/work-status.ts`; Test `lib/routine-runs/work-status.test.ts`

**Interfaces — Produces:**

```ts
export type WorkStatusColor = "gray" | "red" | "orange" | "yellow" | "green" | "blue" | "purple";
export const WORK_STATUS_COLORS: WorkStatusColor[];
export interface WorkStatus { key: string; label: string; color?: WorkStatusColor; done?: boolean }
export interface WorkStatusConfig { statuses: WorkStatus[]; default: string | null }
export interface WorkStatusActor { kind: "user" | "tool" | "agent" | "default"; id?: number | string; user?: number }
export function parseWorkStatusConfig(raw: unknown): WorkStatusConfig;          // never throws
export function deriveStatusKey(label: string, taken: string[]): string;         // "Angebot im ERP" → "angebot_im_erp"; ä→ae ö→oe ü→ue ß→ss; collision → "_2", "_3"; empty → "status"
export function validateWorkStatusDraft(config: WorkStatusConfig): { errors: string[]; warnings: string[] }; // message keys under routines.workStatus.validation.*
export function workStatusBadgeClass(color?: string): string;                    // tailwind classes; unknown/undefined → gray
export function resolveRunStatus(config: WorkStatusConfig, key?: string | null): { key: string; label: string; color?: string; removed: boolean } | null;
```

- [ ] **Step 1: Failing tests**

```ts
it("parses null, {}, garbage and JSON strings", () => {
  for (const raw of [null, undefined, {}, "x"]) expect(parseWorkStatusConfig(raw)).toEqual({ statuses: [], default: null });
  expect(parseWorkStatusConfig(JSON.stringify({ statuses: [{ key: "neu", label: "Neu" }], default: "neu" })).default).toBe("neu");
});
it("derives keys", () => {
  expect(deriveStatusKey("Angebot im ERP angelegt", [])).toBe("angebot_im_erp_angelegt");
  expect(deriveStatusKey("Rückfrage – vorbereitet!", [])).toBe("rueckfrage_vorbereitet");
  expect(deriveStatusKey("Erledigt", ["erledigt"])).toBe("erledigt_2");
  expect(deriveStatusKey("123", [])).toBe("status_123");
  expect(deriveStatusKey("  ", [])).toBe("status");
  expect(deriveStatusKey("x".repeat(80), []).length).toBeLessThanOrEqual(40);
});
it("validates a draft", () => {
  const ok = { statuses: [{ key: "neu", label: "Neu" }, { key: "erledigt", label: "Erledigt", done: true }], default: "neu" };
  expect(validateWorkStatusDraft(ok)).toEqual({ errors: [], warnings: [] });
  expect(validateWorkStatusDraft({ ...ok, default: "erledigt" }).errors).toContain("defaultIsDone");
  expect(validateWorkStatusDraft({ ...ok, default: null }).errors).toContain("defaultMissing");
  expect(validateWorkStatusDraft({ statuses: [{ key: "neu", label: " " }], default: "neu" }).errors).toContain("labelEmpty");
  expect(validateWorkStatusDraft({ statuses: [{ key: "neu", label: "Neu" }], default: "neu" }).warnings).toContain("noDoneStatus");
  expect(validateWorkStatusDraft({ statuses: [], default: null })).toEqual({ errors: [], warnings: [] });
});
it("resolves a run's status, including a removed key", () => {
  const c = parseWorkStatusConfig({ statuses: [{ key: "neu", label: "Neu", color: "blue" }], default: "neu" });
  expect(resolveRunStatus(c, "neu")).toEqual({ key: "neu", label: "Neu", color: "blue", removed: false });
  expect(resolveRunStatus(c, "alt")).toEqual({ key: "alt", label: "alt", removed: true });
  expect(resolveRunStatus(c, null)).toBeNull();
});
```

- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** `git commit -m "feat(routines): work-status helpers"`

---

### Task 2: Types and queries

**Files:** Modify `lib/routine-runs/types.ts`, `lib/routine-runs/queries.ts`, `app/(application)/workflows/types.ts`, `app/(application)/workflows/queries.ts`

**Interfaces — Produces:**

- `RoutineRun` gains `work_status?: string | null; work_status_updated_at?: string | null; work_status_updated_by?: WorkStatusActor | null`.
- `ROUTINE_RUN_SELECTION` gains the three fields.
- `ROUTINE_RUNS` gains variables `$workStatuses: [String!]`, `$workStatusOpen: Boolean` passed through.
- `export const SET_ROUTINE_RUN_WORK_STATUS = gql\`mutation SetRoutineRunWorkStatus($id: ID!, $status: String) { setRoutineRunWorkStatus(id: $id, status: $status) { ${ROUTINE_RUN_SELECTION} } }\``.
- `Routine` gains `work_statuses?: unknown` (raw; consumers call `parseWorkStatusConfig`). Add `work_statuses` to every routine selection in `workflows/queries.ts` and a `$work_statuses: JSON` variable to the update mutation (the one that already takes `$steps_json: JSON`, line ~151).

- [ ] **Step 1:** Make the edits. **Step 2:** `npx tsc --noEmit` clean; `npx vitest run lib/routine-runs` green.
- [ ] **Step 3:** `git commit -m "feat(routines): work-status fields in routine and run queries"`

---

### Task 3: Status badge with menu

**Files:** Create `components/widgets/routine-runs/work-status-badge.tsx`; Test `components/widgets/routine-runs/work-status-badge.test.tsx`

**Interfaces — Produces:**

```tsx
export interface WorkStatusBadgeProps {
  run: Pick<RoutineRun, "id" | "work_status" | "work_status_updated_at" | "work_status_updated_by">;
  config: WorkStatusConfig;
  onChanged?: (run: RoutineRun) => void;   // called with the mutation result
}
export function WorkStatusBadge(props: WorkStatusBadgeProps): JSX.Element | null; // null when config.statuses is empty
```

Behaviour: a badge-styled button (use the existing `Badge` + `DropdownMenu` from `components/ui`) showing the resolved label, or `t("workStatus.none")` when the run has none. Removed keys: neutral style, raw key, `title={t("workStatus.removed")}`. The menu lists every configured status (colour dot, label, check on the current one) plus "Kein Status" to clear. Selecting calls `SET_ROUTINE_RUN_WORK_STATUS` with an `optimisticResponse`; on error show `toast.error(t("workStatus.updateFailed"), { description: error.message })` (sonner) — Apollo reverts the optimistic value. Tooltip/`title`: `t("workStatus.setBy.user" | "tool" | "agent" | "default", …)` + relative time via `components/primitives/relative-time`. The trigger stops click propagation (rows expand on click).

- [ ] **Step 1: Failing tests** (jsdom, `MockedProvider`, `NextIntlClientProvider` with `messages/de.json`; `afterEach(cleanup)`):
  - renders nothing for an empty config;
  - shows the label for a configured key and the raw key + removed hint for an unknown one;
  - choosing "Erledigt" sends the mutation with `{ id, status: "erledigt" }` and calls `onChanged`;
  - "Kein Status" sends `status: null`;
  - a mutation error leaves the original label on screen and calls `toast.error` (mock `sonner`).
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** PASS; `npx eslint` on the file clean.
- [ ] **Step 5:** `git commit -m "feat(routines): work-status badge with inline status menu"`

---

### Task 4: Two areas in the runs list

**Files:** Modify `components/widgets/routine-runs/runs-list.tsx` (778 lines — add, do not restructure); Modify `app/(application)/workflows/[id]/sections/runs.tsx`; Test `components/widgets/routine-runs/runs-list-work-status.test.tsx`

**Interfaces — Consumes:** `WorkStatusBadge` (Task 3), `parseWorkStatusConfig` (Task 1). **Produces:** `RoutineRunsListProps` gains `workStatuses?: WorkStatusConfig`. `RunsSection` passes `parseWorkStatusConfig(routine.work_statuses)`.

Behaviour when `workStatuses.statuses.length > 0`:

- The list body renders twice: area **"Offen"** (`workStatusOpen: true`) expanded, area **"Erledigt"** (`workStatusOpen: false`) collapsed by default, each a heading with its `total` as a count and its own pagination. Implement by extracting the existing query + table body into an inner `RunsArea` component that takes the extra variables — the outer component keeps filters, selection and dialogs. Each area's query uses `variables: { ...current, workflow, workStatusOpen }`.
- `RunRow` renders `<WorkStatusBadge>` next to the state badge (line ~593).
- `onChanged` refetches **both** areas.
- The filter bar gets a multi-select "Status" (`workStatuses` variable) built from the config.
- Without statuses (or without `workflow`, i.e. the cross-routine list): one area, no badge, no status filter — the current render path, untouched.

- [ ] **Step 1: Failing tests** (mock `ROUTINE_RUNS` twice via `MockedProvider`, keyed on `workStatusOpen`):
  - with statuses: headings "Offen (2)" and "Erledigt (1)" render; the done area's rows are not in the document until its heading is clicked;
  - without statuses: no area headings, exactly one `ROUTINE_RUNS` request without `workStatusOpen`;
  - after a status change in the open area both queries are refetched (assert on the mock call counts).
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** PASS; run the existing `components/widgets/routine-runs` and `lib/routine-runs` tests — still green.
- [ ] **Step 5:** `git commit -m "feat(routines): open and done areas in the runs list"`

---

### Task 5: Status editor in the routine workbench

**Files:** Create `app/(application)/workflows/[id]/sections/work-statuses.tsx`; Modify the workbench that lists the sections (the file importing `RunsSection`; add the new section before it and to the `SectionNav` items); Modify `app/(application)/workflows/[id]/hooks.ts` if the save goes through a shared hook; Test `app/(application)/workflows/[id]/sections/work-statuses.test.tsx`

**Interfaces — Consumes:** helpers from Task 1; the routine update mutation with `$work_statuses` (Task 2).

Behaviour: a `DetailSection` titled `t("workStatus.title")` with one row per status — label input, key shown read-only in monospace (derived live from the label **only while the row is new**; frozen once the routine was saved with it), colour picker (seven swatches), checkbox `t("workStatus.done")`, radio "Standard", remove button — reorderable with `components/primitives/sortable`. "Status hinzufügen" appends a row. Validation via `validateWorkStatusDraft`: errors block the save and show under the list; the `noDoneStatus` warning shows but does not block. Marking the default row as done moves the default to the first non-done row. Save uses the section's existing save pattern (look at `sections/basics.tsx` and `components/primitives/save-bar`), sending `work_statuses: { statuses, default }`, or `null` when the list is empty. Read-only for users without write access to the routine (same guard `basics.tsx` uses).

- [ ] **Step 1: Failing tests:**
  - adding a row with label "Rückfrage vorbereitet" shows key `rueckfrage_vorbereitet`; after a save (rows loaded from props) editing that label leaves the key unchanged;
  - two rows labelled "Erledigt" get keys `erledigt` and `erledigt_2`;
  - checking "Erledigt" on the default row moves the default radio;
  - saving sends `work_statuses` with the exact array and default; an empty list sends `null`;
  - with `defaultMissing` the save button is disabled and the message is visible;
  - `noDoneStatus` shows the warning and the save button stays enabled.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** `git commit -m "feat(routines): work-status editor in the routine workbench"`

---

### Task 6: Copy, checks, visual pass

- [ ] **Step 1:** Add `routines.workStatus.*` to `messages/de.json` and `messages/en.json`. German copy: title "Arbeitsstatus", description "Eigene Status für die Läufe dieser Routine, z. B. als Abarbeitungsliste.", `none` "Kein Status", `done` "Erledigt", `default` "Standard", `add` "Status hinzufügen", `areas.open` "Offen", `areas.done` "Erledigt", `removed` "Dieser Status wurde aus der Routine entfernt.", `updateFailed` "Status konnte nicht gesetzt werden", `setBy.user` "gesetzt von {name}", `setBy.tool` "gesetzt vom Tool {name}", `setBy.agent` "gesetzt vom Agenten", `setBy.default` "Standardstatus", validation: `defaultMissing` "Bitte einen Standardstatus wählen.", `defaultIsDone` "Der Standardstatus darf kein Erledigt-Status sein.", `labelEmpty` "Jeder Status braucht eine Bezeichnung.", `noDoneStatus` "Kein Status ist als erledigt markiert – alle Läufe bleiben im Bereich „Offen“."
- [ ] **Step 2:** `npm run check-messages && npx vitest run && npx eslint . && npx tsc --noEmit` — all green.
- [ ] **Step 3:** Run the app against a backend with the feature (`npm run dev`), configure four statuses on a routine, fire a run, set statuses by hand, and screenshot the runs list (both areas) and the editor for the PR description. Check light and dark theme.
- [ ] **Step 4:** `git commit -m "feat(routines): work-status copy (de, en)"`
