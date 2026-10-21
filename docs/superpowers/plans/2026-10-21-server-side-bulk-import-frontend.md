# Server-side Bulk Import — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The import wizard handles large CSVs without parsing them in the browser: it decides the mode by size, maps columns from a sample, uploads the file, starts the backend job and shows progress; the context's Pipeline tab lists imports with cancel, error-report download and retry.

**Architecture:** Pure helpers in `lib/import/` (sample peek, row counting, mode decision, job view model), gql documents in `lib/api/imports.ts`, a `useServerImport` hook, a new `run` step in the wizard, and an `ImportsCard` in the Pipeline tab. The ≤200-row client flow is untouched.

**Tech Stack:** Next.js/React, Apollo (`useApolloClient`, `useQuery` with `pollInterval`), papaparse, shadcn/ui, next-intl (`messages/en.json`, `messages/de.json`, `npm run check-messages`), vitest (`npx vitest run <file>`).

**Spec:** `../../../backend/docs/superpowers/specs/2026-10-21-server-side-bulk-import-design.md` (exulu/backend repo). Backend plan: `2026-10-21-server-side-bulk-import-backend.md` there — its mutations `${context}_itemStartImport(input)` / `${context}_itemCancelImport(jobResultId)` and the `job_results` row shape are what this plan consumes.

## Global Constraints

- Thresholds: `IMPORT_CLIENT_MAX_ROWS = 200`, `IMPORT_CLIENT_MAX_BYTES = 2 * 1024 * 1024`; sample size `IMPORT_SAMPLE_ROWS = 500`.
- Server mode available iff `config.entitlements?.queues === true && config.workers?.enabled === true && !!config.workers?.redisHost` (from `configApi`, `lib/api/config.ts`).
- Never read a server-mode file fully into memory; peek and count work on `file.slice()` chunks of 1 MB.
- Mapping sent to the backend is `[{ header, fieldName }]` (header-based); `fieldName: null` = ignore.
- Every new string in `messages/en.json` and `messages/de.json`; `npm run check-messages` must pass.
- The existing client flow (steps `add` → `map` → `review`, `useImportRunner`) keeps working unchanged for ≤200 rows; its tests must stay green.
- Commit messages: conventional (commitlint), one commit per task.

## Review Focus

1. A quoted field containing a newline must not be counted as two rows by the chunked counter — test in Task 1 (`countCsvRows`).
2. A file with exactly 200 rows goes client-side, 201 rows or 2 MB + 1 byte server-side — test in Task 1 (`decideImportMode`).
3. With server mode unavailable, a large file is refused with the license hint and nothing is uploaded — test in Task 3 (`useServerImport` guard) and the add-step copy.
4. Closing the dialog during a server run must not cancel the job; reopening shows it running — test in Task 3 (hook keeps no cancel side effect on unmount).
5. "Retry failed rows" must pre-map `import_error` to Ignore and keep the original mapping — test in Task 1 (`retryMapping`).

---

### Task 1: Pure helpers — peek, count, mode, retry mapping

**Files:**
- Modify: `lib/import/parse-csv.ts`
- Create: `lib/import/mode.ts`, `lib/import/retry.ts`
- Test: `lib/import/parse-csv.test.ts` (extend), `lib/import/mode.test.ts`, `lib/import/retry.test.ts`

**Interfaces:**

```ts
// parse-csv.ts (additions)
export async function peekCsvFile(file: Blob, sampleRows: number): Promise<ParsedCsv>;   // reads 1 MB chunks until sampleRows data rows are complete; Papa.parse on the accumulated text with preview: sampleRows + 1
export async function countCsvRows(file: Blob): Promise<number>;                           // RFC 4180-aware newline counter over chunks (quote state carried across chunks), minus the header, ignoring blank lines
// mode.ts
export const IMPORT_CLIENT_MAX_ROWS = 200; export const IMPORT_CLIENT_MAX_BYTES = 2 * 1024 * 1024;
export type ImportMode = "client" | "server" | "unavailable";
export function decideImportMode(input: { rows: number; bytes: number; serverAvailable: boolean }): ImportMode; // server when rows > max or bytes > max; "unavailable" when that would be server but serverAvailable is false
export function serverImportAvailable(config: { entitlements?: Record<string, boolean>; workers?: { enabled?: boolean; redisHost?: string } } | null | undefined): boolean;
// retry.ts
export function retryMapping(original: Array<{ header: string; fieldName: string | null }>): Array<{ header: string; fieldName: string | null }>; // original + { header: "import_error", fieldName: null }
```

- [ ] **Step 1: Write the failing tests**

```ts
// parse-csv.test.ts
const big = "a,b\n" + Array.from({ length: 1000 }, (_, i) => `${i},"x\ny"`).join("\n") + "\n";
expect(await countCsvRows(new Blob([big]))).toBe(1000);                       // Review Focus 1
expect(await countCsvRows(new Blob(["﻿a,b\r\n1,2\r\n\r\n3,4\r\n"]))).toBe(2);
const sample = await peekCsvFile(new Blob([big]), 3);
expect(sample.headers).toEqual(["a", "b"]); expect(sample.rows).toHaveLength(3); expect(sample.rows[0]).toEqual(["0", "x\ny"]);
// mode.test.ts — Review Focus 2
expect(decideImportMode({ rows: 200, bytes: 10, serverAvailable: true })).toBe("client");
expect(decideImportMode({ rows: 201, bytes: 10, serverAvailable: true })).toBe("server");
expect(decideImportMode({ rows: 10, bytes: 2 * 1024 * 1024 + 1, serverAvailable: true })).toBe("server");
expect(decideImportMode({ rows: 201, bytes: 10, serverAvailable: false })).toBe("unavailable");
expect(serverImportAvailable({ entitlements: { queues: true }, workers: { enabled: true, redisHost: "r" } })).toBe(true);
expect(serverImportAvailable({ entitlements: { queues: false }, workers: { enabled: true, redisHost: "r" } })).toBe(false);
expect(serverImportAvailable(null)).toBe(false);
// retry.test.ts — Review Focus 5
expect(retryMapping([{ header: "name", fieldName: "name" }])).toEqual([{ header: "name", fieldName: "name" }, { header: "import_error", fieldName: null }]);
```

- [ ] **Step 2: Run to verify they fail** — `npx vitest run lib/import` → FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run to verify they pass** — `npx vitest run lib/import` → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(import): csv peek, row count and mode decision for large files"`

---

### Task 2: API documents and job view model

**Files:**
- Create: `lib/api/imports.ts`, `lib/import/job-view.ts`
- Test: `lib/import/job-view.test.ts`

**Interfaces:**

```ts
// lib/api/imports.ts
export const START_IMPORT = (context: string) => gql`mutation StartImport${context}($input: StartImportInput!) { ${context}_itemStartImport(input: $input) { jobResultId } }`;
export const CANCEL_IMPORT = (context: string) => gql`mutation CancelImport${context}($jobResultId: ID!) { ${context}_itemCancelImport(jobResultId: $jobResultId) { ok } }`;
export const GET_IMPORT_JOBS = gql`query ImportJobs($filters: [FilterJob_result], $limit: Int) { job_resultsPagination(filters: $filters, sort: { field: "createdAt", direction: "DESC" }, limit: $limit) { items { id label state type context trigger trigger_metadata metadata result createdAt updatedAt } } }`;
export const importJobFilters = (contextId: string) => [{ context: { eq: contextId } }, { type: { eq: "import" } }];
export const importJobByIdFilters = (id: string) => [{ id: { eq: id } }];
// lib/import/job-view.ts
export type ImportJobRow = { id: string; label: string; state: string; trigger_metadata?: any; metadata?: any; result?: any; createdAt: string; updatedAt?: string };
export type ImportJobView = { id: string; fileName: string; state: "waiting" | "active" | "completed" | "failed" | "cancelled" | "other"; progress: number | null; counters: { total: number | null; processed: number; created: number; updated: number; failed: number; invalid: number }; errorReportKey: string | null; startedBy: number | null; durationMs: number | null; isRunning: boolean; canRetry: boolean };
export function toImportJobView(row: ImportJobRow): ImportJobView;   // metadata/result may be JSON strings or objects; progress = processed/total*100 or null; canRetry = !!errorReportKey && !isRunning
```

(The exact mutation field names follow the backend plan's SDL: `${tableNameSingular}StartImport` where the singular is `<context>_item`; verify against the generated schema when the backend lands and adjust the two builders. Likewise verify that `context`, `trigger_metadata` and `updatedAt` are selectable on `job_result` — `type` and `context` are columns of the table in `ee/schemas.ts`; drop any field the generated type does not expose.)

- [ ] **Step 1: Write the failing test** — rows with `metadata` as string and as object; `state: "active"` with processed 50/total 200 → `progress 25`, `isRunning true`; `completed` with `result.errorReportKey` → `canRetry true`; `cancelled` → `canRetry` false without key.
- [ ] **Step 2: Run to verify it fails**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run to verify it passes**
- [ ] **Step 5: Commit** — `git commit -m "feat(import): gql documents and job view model for server imports"`

---

### Task 3: `useServerImport` hook and the wizard's server mode

**Files:**
- Create: `app/(application)/data/[ctx]/components/import/use-server-import.ts`, `app/(application)/data/[ctx]/components/import/step-run-server.tsx`
- Modify: `app/(application)/data/[ctx]/components/import/import-wizard-dialog.tsx`, `step-add-data.tsx`, `step-review-grid.tsx` (read-only sample mode), `lib/import/types.ts` (add `mode`)
- Test: `app/(application)/data/[ctx]/components/import/use-server-import.test.ts` (hook logic with a fake apollo client: `start` uploads then mutates; `start` refused when unavailable; `cancel` calls the mutation; unmount does not cancel)

**Interfaces:**

```ts
export type ServerImportPhase = "idle" | "uploading" | "starting" | "running" | "done" | "error";
export function useServerImport(contextId: string, deps?: { client?: ApolloClient<any>; upload?: (file: File) => Promise<string> }): {
  phase: ServerImportPhase; jobResultId: string | null; error: string | null;
  start: (args: { file: File; mapping: Array<{ header: string; fieldName: string | null }>; access: BatchAccess; totalRows: number; options?: { skipEmbeddings?: boolean } }) => Promise<void>;
  startFromKey: (args: { s3Key: string; fileName: string; mapping; access; options? }) => Promise<void>;   // retry path
  cancel: () => Promise<void>;
  reset: () => void;
};
```

Wizard changes: on CSV drop in `step-add-data.tsx` call `countCsvRows` + `peekCsvFile(file, IMPORT_SAMPLE_ROWS)` (the dialog holds `csv = { name, parsed: sample, file, totalRows, bytes }`); `decideImportMode` with `serverImportAvailable(config)` → store `mode`; the add step shows a banner: client ("… Zeilen, Import im Browser"), server ("… Zeilen, Import im Hintergrund"), unavailable (refuse: copy from `import.server.unavailable`, Continue disabled — Review Focus 3). Map step unchanged. Review step in server mode: the grid renders the sample read-only (no cell editing, no per-row run state) with a note "Vorschau der ersten 500 Zeilen" and validation counts over the sample; footer button "Import starten" → `useServerImport.start(...)` → step `run`. `step-run-server.tsx`: polls `GET_IMPORT_JOBS` with `importJobByIdFilters` every 2 s while running; shows `toImportJobView` (progress bar, counters, state), buttons Cancel (confirm), Close ("Der Import läuft im Hintergrund weiter"), and when done: summary + "Fehlerreport herunterladen" (presigned URL via the existing S3 helper the item file fields use) + "Fehlgeschlagene Zeilen wiederholen" (`startFromKey` with `retryMapping`). The beforeunload warning of the client runner is not shown in server mode.

- [ ] **Step 1: Write the failing hook test**
- [ ] **Step 2: Run to verify it fails** — `npx vitest run app/\(application\)/data/\[ctx\]/components/import` → FAIL
- [ ] **Step 3: Implement the hook, the run step and the wizard changes**
- [ ] **Step 4: Run the import tests and the whole suite** — `npx vitest run` → PASS; `npm run lint` / typecheck → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(import): server mode in the import wizard with background job progress"`

---

### Task 4: Imports card in the Pipeline tab

**Files:**
- Create: `app/(application)/data/[ctx]/components/imports-card.tsx`
- Modify: `app/(application)/data/[ctx]/components/pipeline-tab.tsx` (render the card between the stage cards and the ActivityList)
- Test: `app/(application)/data/[ctx]/components/imports-card.test.tsx` (renders rows from `toImportJobView`; cancel button only while running; retry only with an error report; polling only while a row is running)

The card lists the context's imports (`GET_IMPORT_JOBS` with `importJobFilters`, limit 20, `pollInterval` 5 s only while any row `isRunning`): file name, state badge, progress or counters, started by, duration; actions: Cancel (`CANCEL_IMPORT`), Download error report, Retry failed rows (opens the wizard in server mode with `startFromKey`). Empty state copy. Follows `CLAUDE.md`: shadcn `Card`, `text-sm` metadata, semantic badge colours.

- [ ] **Step 1: Write the failing component test**
- [ ] **Step 2: Run to verify it fails**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run tests, lint, typecheck** → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(import): imports card with cancel, error report and retry in the pipeline tab"`

---

### Task 5: i18n and parity fixture

**Files:**
- Modify: `messages/en.json`, `messages/de.json` (keys `import.server.*`: `banner.client`, `banner.server`, `unavailable`, `preview.note`, `start`, `run.title`, `run.closeHint`, `run.cancel`, `run.cancelConfirm`, `run.done`, `run.downloadReport`, `run.retry`, counters labels; `pipeline.imports.*`: `title`, `empty`, `state.*`, `startedBy`, `duration`, actions)
- Create: `lib/import/fixtures/coercion-cases.json` (identical to the backend's `src/exulu/import/fixtures/coercion-cases.json`), and make `lib/import/coerce.test.ts` iterate it in addition to its own cases.

- [ ] **Step 1: Add the keys and the fixture; wire the coerce test**
- [ ] **Step 2: Run `npm run check-messages` and `npx vitest run lib/import`** → PASS
- [ ] **Step 3: Commit** — `git commit -m "feat(import): i18n for server imports and shared coercion fixture"`
