# Final Review Fixes Report

## Fix 1 — Blur-verification race (import-wizard-dialog.tsx)

**What changed:**
- Added `const [verifying, setVerifying] = React.useState(false);` (line 72)
- Added `const phaseRef = React.useRef(runner.phase); phaseRef.current = runner.phase;` after `runner` declaration (lines 88-89)
- In `handleKeyCellBlur`: added `setVerifying(true)` before `void verifyRows(...)`; added `if (phaseRef.current !== "edit") return;` as first statement in `.then` before calling `setRows`; added `.finally(() => setVerifying(false))` at end of chain
- Changed review Import button: `disabled={validRows.length === 0 || verifying}`

**File:line:** `app/(application)/data/[ctx]/components/import/import-wizard-dialog.tsx` — lines 72, 85-89, 227-270, 470

---

## Fix 2 — Error report exports stored key for file cells (lib/import/template.ts + test)

**What changed:**
- In `buildErrorReportCsv`, replaced the simple `row.cells[f.name]?.raw ?? ""` with a conditional: for file-typed fields, if the cell has no attached `File` and `cell.value` is a non-empty string, export `cell.value`; otherwise fall back to `cell?.raw ?? ""`
- Added new test `"exports the stored key for file cells that resolved to a value"` in `lib/import/template.test.ts`
- Existing test kept passing: its file cell (`doc_s3key`) is absent from the row fixture, so `cell` is undefined and the new guard is skipped; output unchanged

**File:line:**
- `lib/import/template.ts` lines 56-67
- `lib/import/template.test.ts` lines 117-152

---

## Fix 3 — Blank-clears warning false positives (import-wizard-dialog.tsx)

**What changed:**
- Changed inner predicate in `hasBlankUpdateCells` from `(c.value === null || c.value === "") && !c.file` to `!c.file && c.raw.trim() === ""`
- This ensures coercion-error cells (which set `value: null` but have non-blank `raw`) no longer trigger the warning

**File:line:** `app/(application)/data/[ctx]/components/import/import-wizard-dialog.tsx` — lines 303-307

---

## Fix 4 — Template download stays enabled (step-add-data.tsx)

**What changed:**
- Removed `disabled={csvZoneDisabled}` from the template download Button
- The Dropzone and other CSV zone controls remain governed by `csvZoneDisabled`; only the reference download is unconditional

**File:line:** `app/(application)/data/[ctx]/components/import/step-add-data.tsx` — line 200

---

## Gate Outputs

### 1. Tests
- `npm test -- lib/import/template.test.ts`: **4 passed (4)** — all new + existing tests green
- `npm test` (full suite): **267 passed, 1 failed** — sole failure is pre-existing `nav-config.test.ts > agents:read` (known gate exclusion)

### 2. TypeScript / Lint / Messages
- `npx tsc --noEmit`: **exit 0** — no new type errors (pre-existing login.tsx error also absent)
- `npm run lint`: **exit 0** — 1 pre-existing error + 108 pre-existing warnings; no new issues
- `npm run check-messages`: **✔ Message key parity OK: 3397 keys across en, de**

### 3. Prettier
- All four touched files pass `npx prettier --check`
- Two files (`import-wizard-dialog.tsx`, `template.test.ts`) were reformatted with `--write`
