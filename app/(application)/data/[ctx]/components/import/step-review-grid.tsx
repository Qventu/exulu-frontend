"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Paperclip, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  CellError,
  ImportField,
  ImportRow,
  RowRunState,
} from "@/lib/import/types";
import { cn } from "@/lib/utils";

const UNSET = "__unset__";

/** Resolve a lib-level error code to the translated message. */
export function translateCellError(
  t: (key: string, params?: Record<string, string>) => string,
  error: CellError,
): string {
  return t(`workspace.import.errors.${error.code}`, error.params);
}

export interface StepReviewGridProps {
  fields: ImportField[];
  displayFields: ImportField[];
  rows: ImportRow[];
  running: boolean;
  rowStates: Record<string, { state: RowRunState; error?: string }>;
  onCellChange: (rowKey: string, fieldName: string, raw: string) => void;
  onKeyCellBlur: () => void;
  onApplyToAll: (fieldName: string, raw: string) => void;
  onRemoveRow: (rowKey: string) => void;
}

function StatusBadge({
  label,
  tone,
  title,
}: {
  label: string;
  tone: "create" | "update" | "error" | "muted" | "done" | "failed";
  title?: string;
}) {
  const classes = {
    create: "bg-secondary text-secondary-foreground",
    update: "border border-input text-foreground",
    error: "bg-destructive/10 text-destructive",
    muted: "bg-muted text-muted-foreground",
    done: "bg-secondary text-secondary-foreground",
    failed: "bg-destructive/10 text-destructive",
  }[tone];
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        classes,
      )}
    >
      {label}
    </span>
  );
}

function CellEditor({
  field,
  row,
  disabled,
  onCellChange,
  onKeyCellBlur,
  t,
}: {
  field: ImportField;
  row: ImportRow;
  disabled: boolean;
  onCellChange: StepReviewGridProps["onCellChange"];
  onKeyCellBlur: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const cell = row.cells[field.name];
  const errorTitle = cell?.error
    ? translateCellError(t, cell.error)
    : undefined;
  const isKeyField = field.name === "id" || field.name === "external_id";

  if (field.type === "file") {
    if (cell?.file) {
      return (
        <span
          title={errorTitle}
          className={cn(
            "inline-flex max-w-44 items-center gap-1 truncate rounded-md border border-input px-2 py-0.5 text-xs",
            cell?.error && "border-destructive text-destructive",
          )}
        >
          <Paperclip aria-hidden="true" className="size-3 shrink-0" />
          <span className="truncate">{cell.file.name}</span>
        </span>
      );
    }
    // CSV flow: the cell holds a storage URL/key — editable text.
    const keyName =
      typeof cell?.value === "string" && cell.value !== ""
        ? cell.value.split("_EXULU_").pop()
        : undefined;
    return (
      <Input
        disabled={disabled}
        value={cell?.raw ?? ""}
        onChange={(e) => onCellChange(row.key, field.name, e.target.value)}
        onBlur={onKeyCellBlur}
        title={errorTitle ?? keyName}
        aria-invalid={Boolean(cell?.error)}
        placeholder={t("workspace.import.review.filePlaceholder")}
        className={cn(
          "h-8 min-w-36 text-sm",
          cell?.error && "border-destructive",
        )}
        type="text"
      />
    );
  }

  if (field.type === "boolean") {
    const current =
      cell?.value === true ? "true" : cell?.value === false ? "false" : UNSET;
    return (
      <Select
        disabled={disabled}
        value={current}
        onValueChange={(v) =>
          onCellChange(row.key, field.name, v === UNSET ? "" : v)
        }
      >
        <SelectTrigger
          title={errorTitle}
          aria-invalid={Boolean(cell?.error)}
          className={cn("h-8 w-24", cell?.error && "border-destructive")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNSET}>
            {t("workspace.import.review.emptyCell")}
          </SelectItem>
          <SelectItem value="true">true</SelectItem>
          <SelectItem value="false">false</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "enum") {
    const current =
      typeof cell?.value === "string" && cell.value !== "" ? cell.value : UNSET;
    return (
      <Select
        disabled={disabled}
        value={current}
        onValueChange={(v) =>
          onCellChange(row.key, field.name, v === UNSET ? "" : v)
        }
      >
        <SelectTrigger
          title={errorTitle}
          aria-invalid={Boolean(cell?.error)}
          className={cn("h-8 w-36", cell?.error && "border-destructive")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNSET}>
            {t("workspace.import.review.emptyCell")}
          </SelectItem>
          {(field.enumValues ?? []).map((v) => (
            <SelectItem key={v} value={v}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      disabled={disabled}
      value={cell?.raw ?? ""}
      onChange={(e) => onCellChange(row.key, field.name, e.target.value)}
      onBlur={isKeyField ? onKeyCellBlur : undefined}
      title={errorTitle}
      aria-invalid={Boolean(cell?.error)}
      className={cn(
        "h-8 min-w-28 text-sm",
        cell?.error && "border-destructive",
      )}
      type="text"
      inputMode={field.type === "number" ? "decimal" : undefined}
    />
  );
}

export function StepReviewGrid({
  fields,
  displayFields,
  rows,
  running,
  rowStates,
  onCellChange,
  onKeyCellBlur,
  onApplyToAll,
  onRemoveRow,
}: StepReviewGridProps) {
  const t = useTranslations("knowledge");
  const [applyField, setApplyField] = React.useState<string>("");
  const [applyValue, setApplyValue] = React.useState<string>("");

  const statusFor = (row: ImportRow): React.ReactNode => {
    const runState = rowStates[row.key]?.state ?? row.runState;
    if (running || runState === "done" || runState === "failed") {
      const tone =
        runState === "done"
          ? "done"
          : runState === "failed"
            ? "failed"
            : "muted";
      const labelKey = {
        pending: "statePending",
        uploading: "stateUploading",
        saving: "stateSaving",
        done: "stateDone",
        failed: "stateFailed",
      }[runState];
      return (
        <StatusBadge
          label={t(`workspace.import.run.${labelKey}`)}
          tone={tone}
          title={rowStates[row.key]?.error ?? row.runError}
        />
      );
    }
    if (row.error) {
      return (
        <StatusBadge
          label={t("workspace.import.review.statusError")}
          tone="error"
          title={translateCellError(t, row.error)}
        />
      );
    }
    return row.action === "update" ? (
      <StatusBadge
        label={t("workspace.import.review.statusUpdate")}
        tone="update"
      />
    ) : (
      <StatusBadge
        label={t("workspace.import.review.statusCreate")}
        tone="create"
      />
    );
  };

  const columns = React.useMemo<ColumnDef<ImportRow>[]>(() => {
    const status: ColumnDef<ImportRow> = {
      id: "__status",
      header: "",
      cell: ({ row }) => statusFor(row.original),
    };
    const fieldColumns = displayFields.map<ColumnDef<ImportRow>>((field) => ({
      id: field.name,
      header: field.label + (field.required ? " *" : ""),
      cell: ({ row }) => (
        <CellEditor
          field={field}
          row={row.original}
          disabled={running}
          onCellChange={onCellChange}
          onKeyCellBlur={onKeyCellBlur}
          t={t}
        />
      ),
    }));
    const remove: ColumnDef<ImportRow> = {
      id: "__remove",
      header: "",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={running}
          onClick={() => onRemoveRow(row.original.key)}
        >
          <X aria-hidden="true" className="size-4" />
          <span className="sr-only">
            {t("workspace.import.review.removeRow")}
          </span>
        </Button>
      ),
    };
    return [status, ...fieldColumns, remove];
    // statusFor closes over rows/rowStates/running — recompute with them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    displayFields,
    running,
    rowStates,
    onCellChange,
    onKeyCellBlur,
    onRemoveRow,
    t,
  ]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.key,
  });

  const applicableFields = displayFields.filter(
    (f) => f.type !== "file" && f.name !== "id" && f.name !== "external_id",
  );

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {!running && applicableFields.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={applyField || undefined} onValueChange={setApplyField}>
            <SelectTrigger className="h-8 w-44">
              <SelectValue
                placeholder={t("workspace.import.review.applyToAll")}
              />
            </SelectTrigger>
            <SelectContent>
              {applicableFields.map((f) => (
                <SelectItem key={f.name} value={f.name}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={applyValue}
            onChange={(e) => setApplyValue(e.target.value)}
            placeholder={t("workspace.import.review.applyToAllValue")}
            className="h-8 w-52 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!applyField}
            onClick={() => onApplyToAll(applyField, applyValue)}
          >
            {t("workspace.import.review.applyToAll")}
          </Button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-input">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="whitespace-nowrap">
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-1.5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
