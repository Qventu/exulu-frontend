"use client";

import { useApolloClient } from "@apollo/client";
import { CheckCircle2, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { RBACControl } from "@/components/rbac";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { filesApi } from "@/lib/api/files";
import { coerceValue } from "@/lib/import/coerce";
import { fileFields, importableFields } from "@/lib/import/fields";
import { autoMapColumns } from "@/lib/import/map-columns";
import type { ColumnMapping } from "@/lib/import/map-columns";
import type { ParsedCsv } from "@/lib/import/parse-csv";
import { classifyRows } from "@/lib/import/resolve-targets";
import type { ExistingRefs } from "@/lib/import/resolve-targets";
import {
  rowIsValid,
  rowsFromCsv,
  rowsFromFiles,
  validateRow,
} from "@/lib/import/rows";
import { buildErrorReportCsv } from "@/lib/import/template";
import {
  applyMissingFileErrors,
  fileKeysOf,
  findMissingFileKeys,
} from "@/lib/import/verify-files";
import type { BatchAccess, ImportRow } from "@/lib/import/types";
import type { Context } from "@/types/models/context";

import {
  GET_ITEMS_BY_EXTERNAL_IDS,
  GET_ITEMS_BY_IDS,
  PAGINATION_POSTFIX,
} from "../../../queries";

import { MODE_LABEL_KEY } from "../item-access-section";

import { StepAddData } from "./step-add-data";
import { StepMapColumns } from "./step-map-columns";
import { StepReviewGrid, translateCellError } from "./step-review-grid";
import { useImportRunner } from "./use-import-runner";

type WizardStep = "add" | "map" | "review";

export interface ImportWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: Context;
}

export function ImportWizardDialog({
  open,
  onOpenChange,
  context,
}: ImportWizardDialogProps) {
  const t = useTranslations("knowledge");
  const client = useApolloClient();
  const fields = React.useMemo(() => importableFields(context), [context]);
  const fileTargets = React.useMemo(() => fileFields(fields), [fields]);

  const [step, setStep] = React.useState<WizardStep>("add");
  const [classifying, setClassifying] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const [files, setFiles] = React.useState<File[]>([]);
  const [csv, setCsv] = React.useState<{
    name: string;
    parsed: ParsedCsv;
  } | null>(null);
  const [mapping, setMapping] = React.useState<ColumnMapping[]>([]);
  const [rows, setRows] = React.useState<ImportRow[]>([]);
  const rowsRef = React.useRef(rows);
  rowsRef.current = rows;

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

  const runner = useImportRunner(context.id, fields, batchAccess);
  const running = runner.phase === "running";
  const phaseRef = React.useRef(runner.phase);
  phaseRef.current = runner.phase;

  // Single file field auto-selects; multiple need the add-step dropdown.
  const [fileFieldTarget, setFileFieldTarget] = React.useState<string | null>(
    null,
  );
  const resolvedFileTarget =
    fileTargets.length === 1 ? fileTargets[0].name : fileFieldTarget;

  // Reset everything on (re)open, mirroring new-item-dialog.tsx.
  React.useEffect(() => {
    if (open) {
      setStep("add");
      setFiles([]);
      setCsv(null);
      setMapping([]);
      setRows([]);
      setFileFieldTarget(null);
      setBatchAccess(defaultBatchAccess());
      runner.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Warn against closing the tab while the import runs.
  React.useEffect(() => {
    if (!running) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [running]);

  const classifyAgainstServer = React.useCallback(
    async (input: ImportRow[]): Promise<ImportRow[]> => {
      const ids = [
        ...new Set(
          input
            .map((r) =>
              typeof r.cells.id?.value === "string" ? r.cells.id.value : "",
            )
            .filter(Boolean),
        ),
      ];
      const exts = [
        ...new Set(
          input
            .map((r) =>
              typeof r.cells.external_id?.value === "string"
                ? r.cells.external_id.value
                : "",
            )
            .filter(Boolean),
        ),
      ];
      const existing: ExistingRefs = {
        byExternalId: new Map(),
        knownIds: new Set(),
      };
      if (exts.length > 0) {
        const { data } = await client.query({
          query: GET_ITEMS_BY_EXTERNAL_IDS(context.id),
          variables: { ids: exts, limit: exts.length },
          fetchPolicy: "network-only",
        });
        for (const item of data?.[context.id + PAGINATION_POSTFIX]?.items ??
          []) {
          if (item.external_id)
            existing.byExternalId.set(item.external_id, item.id);
        }
      }
      if (ids.length > 0) {
        const { data } = await client.query({
          query: GET_ITEMS_BY_IDS(context.id),
          variables: { ids, limit: ids.length },
          fetchPolicy: "network-only",
        });
        for (const item of data?.[context.id + PAGINATION_POSTFIX]?.items ??
          []) {
          existing.knownIds.add(item.id);
        }
      }
      return classifyRows(input, existing).map((r) => validateRow(r, fields));
    },
    [client, context.id, fields],
  );

  const verifyRows = React.useCallback(
    async (input: ImportRow[]): Promise<ImportRow[]> => {
      const classified = await classifyAgainstServer(input);
      const keys = fileKeysOf(classified, fields);
      if (keys.length === 0) return classified;
      const missing = await findMissingFileKeys(keys, async (key) => {
        const res = await filesApi.object(key);
        return res?.$metadata?.httpStatusCode === 200;
      });
      return applyMissingFileErrors(classified, fields, missing);
    },
    [classifyAgainstServer, fields],
  );

  const enterReview = React.useCallback(async () => {
    setClassifying(true);
    try {
      let built: ImportRow[] = [];
      if (csv) built = rowsFromCsv(csv.parsed, mapping, fields);
      else if (resolvedFileTarget)
        built = rowsFromFiles(files, resolvedFileTarget);
      setRows(await verifyRows(built));
      setStep("review");
    } catch (e) {
      toast.error(t("workspace.import.classifyError"), {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setClassifying(false);
    }
  }, [csv, files, mapping, fields, resolvedFileTarget, verifyRows, t]);

  const handleContinueFromAdd = () => {
    if (csv) {
      setMapping(autoMapColumns(csv.parsed.headers, fields));
      setStep("map");
    } else {
      void enterReview();
    }
  };

  const handleCellChange = (rowKey: string, fieldName: string, raw: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.key !== rowKey) return row;
        const field = fields.find((f) => f.name === fieldName);
        if (!field) return row;
        const next = {
          ...row,
          cells: { ...row.cells, [fieldName]: coerceValue(field, raw) },
        };
        return validateRow(next, fields);
      }),
    );
  };

  const handleKeyCellBlur = () => {
    setVerifying(true);
    void verifyRows(rowsRef.current)
      .then((verified) => {
        if (phaseRef.current !== "edit") return;
        const byKey = new Map(verified.map((r) => [r.key, r]));
        setRows((prev) =>
          prev.map((row) => {
            const v = byKey.get(row.key);
            if (!v) return row;
            const cells = { ...row.cells };
            for (const f of fields) {
              if (f.type !== "file") continue;
              const verifiedCell = v.cells[f.name];
              const currentCell = cells[f.name];
              // Adopt verification outcome only when the cell wasn't edited
              // during the roundtrip (same raw).
              if (
                verifiedCell &&
                currentCell &&
                verifiedCell.raw === currentCell.raw
              ) {
                cells[f.name] = verifiedCell;
              }
            }
            return validateRow(
              {
                ...row,
                cells,
                action: v.action,
                targetItemId: v.targetItemId,
                error: v.error,
              },
              fields,
            );
          }),
        );
      })
      .catch((e) => {
        toast.error(t("workspace.import.classifyError"), {
          description: e instanceof Error ? e.message : String(e),
        });
      })
      .finally(() => setVerifying(false));
  };

  const handleRemoveRow = (rowKey: string) => {
    setRows((prev) => prev.filter((r) => r.key !== rowKey));
  };

  const displayFields = React.useMemo(() => {
    const present = new Set<string>();
    for (const row of rows)
      for (const key of Object.keys(row.cells)) present.add(key);
    return fields.filter(
      (f) =>
        f.name === "name" || present.has(f.name) || (f.required && !f.core),
    );
  }, [rows, fields]);

  const hasBlankUpdateCells = React.useMemo(
    () =>
      rows.some(
        (row) =>
          row.action === "update" &&
          Object.values(row.cells).some((c) => !c.file && c.raw.trim() === ""),
      ),
    [rows],
  );

  const validRows = rows.filter(rowIsValid);
  const failedCount = rows.filter((r) => r.runState === "failed").length;
  // Rows that could still import: failed ones plus rows fixed after the run.
  const remainingCount = rows.filter(
    (r) => rowIsValid(r) && r.runState !== "done",
  ).length;

  const downloadErrorReport = () => {
    const present = new Set<string>();
    for (const row of rows)
      for (const key of Object.keys(row.cells)) present.add(key);
    const reportFields = fields.filter((f) => present.has(f.name));
    const report = buildErrorReportCsv(
      rows,
      reportFields,
      (row) =>
        row.runError ??
        (row.error
          ? translateCellError(t, row.error)
          : Object.values(row.cells)
              .filter((c) => c.error)
              .map((c) => translateCellError(t, c.error!))
              .join("; ")),
    );
    const blob = new Blob([report], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${context.id}-import-errors.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && running) return; // must cancel first
    onOpenChange(next);
  };

  const canContinueFromAdd =
    Boolean(csv) || (files.length > 0 && Boolean(resolvedFileTarget));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-[95vw] max-w-6xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>
            {t("workspace.import.title")} —{" "}
            {t(`workspace.import.steps.${step}`)}
          </DialogTitle>
          <DialogDescription>
            {t("workspace.import.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {step === "add" && (
            <StepAddData
              contextId={context.id}
              fields={fields}
              files={files}
              csv={csv}
              fileFieldTarget={resolvedFileTarget}
              onFilesAdded={(added) => setFiles((prev) => [...prev, ...added])}
              onRemoveFile={(i) =>
                setFiles((prev) => prev.filter((_, idx) => idx !== i))
              }
              onClearFiles={() => setFiles([])}
              onCsvChange={setCsv}
              onFileFieldTargetChange={setFileFieldTarget}
            />
          )}
          {step === "map" && csv && (
            <StepMapColumns
              csv={csv}
              mapping={mapping}
              fields={fields}
              onMappingChange={setMapping}
            />
          )}
          {step === "review" && (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              {runner.phase !== "edit" && (
                <div className="flex items-center gap-3">
                  <Progress
                    className="h-2 flex-1"
                    value={
                      runner.runTotal
                        ? (runner.doneCount / runner.runTotal) * 100
                        : 0
                    }
                  />
                  {runner.phase === "done" &&
                    (runner.summary?.failed ?? 0) === 0 && (
                      <CheckCircle2
                        aria-hidden="true"
                        className="size-4 shrink-0 text-emerald-600 dark:text-emerald-500"
                      />
                    )}
                  <span className="whitespace-nowrap text-sm text-muted-foreground">
                    {runner.phase === "running"
                      ? t("workspace.import.run.progress", {
                          done: runner.doneCount,
                          total: runner.runTotal,
                        })
                      : t("workspace.import.run.summary", {
                          created: runner.summary?.created ?? 0,
                          updated: runner.summary?.updated ?? 0,
                          failed: runner.summary?.failed ?? 0,
                        })}
                    {runner.phase === "done" &&
                      (runner.summary?.skipped ?? 0) > 0 &&
                      ` · ${t("workspace.import.run.summarySkipped", {
                        count: runner.summary?.skipped ?? 0,
                      })}`}
                  </span>
                </div>
              )}
              {runner.phase === "edit" && hasBlankUpdateCells && (
                <p className="text-sm text-muted-foreground">
                  {t("workspace.import.review.blankClearsWarning")}
                </p>
              )}
              <StepReviewGrid
                fields={fields}
                displayFields={displayFields}
                rows={rows}
                running={running}
                finished={runner.phase === "done"}
                rowStates={runner.rowStates}
                onCellChange={handleCellChange}
                onKeyCellBlur={handleKeyCellBlur}
                onRemoveRow={handleRemoveRow}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {step !== "add" && runner.phase === "edit" && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(step === "review" && csv ? "map" : "add")}
            >
              {t("workspace.import.back")}
            </Button>
          )}

          {step === "add" && (
            <Button
              type="button"
              disabled={!canContinueFromAdd || classifying}
              onClick={handleContinueFromAdd}
            >
              {t("workspace.import.continue")}
            </Button>
          )}
          {step === "map" && (
            <Button
              type="button"
              disabled={classifying}
              onClick={() => void enterReview()}
            >
              {t("workspace.import.continue")}
            </Button>
          )}

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

          {running && (
            <Button type="button" variant="outline" onClick={runner.cancel}>
              {t("workspace.import.cancelRun")}
            </Button>
          )}

          {runner.phase === "done" && (
            <>
              {failedCount > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={downloadErrorReport}
                >
                  {t("workspace.import.run.downloadReport")}
                </Button>
              )}
              {remainingCount > 0 && (
                <Button
                  type="button"
                  onClick={() => void runner.run(rowsRef.current)}
                >
                  {failedCount > 0
                    ? t("workspace.import.run.retryFailed")
                    : t("workspace.import.review.importValid", {
                        count: remainingCount,
                      })}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t("workspace.import.close")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
