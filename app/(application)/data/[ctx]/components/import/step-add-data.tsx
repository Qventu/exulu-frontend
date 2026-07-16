"use client";

import { Download, FileSpreadsheet, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Dropzone } from "@/components/primitives/dropzone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fileFields } from "@/lib/import/fields";
import type { ParsedCsv } from "@/lib/import/parse-csv";
import { parseCsvFile } from "@/lib/import/parse-csv";
import { buildCsvTemplate } from "@/lib/import/template";
import type { ImportField } from "@/lib/import/types";
import { cn } from "@/lib/utils";

export interface StepAddDataProps {
  contextId: string;
  fields: ImportField[];
  files: File[];
  csv: { name: string; parsed: ParsedCsv } | null;
  fileFieldTarget: string | null;
  onFilesAdded: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  onClearFiles: () => void;
  onCsvChange: (csv: { name: string; parsed: ParsedCsv } | null) => void;
  onFileFieldTargetChange: (name: string) => void;
}

export function StepAddData({
  contextId,
  fields,
  files,
  csv,
  fileFieldTarget,
  onFilesAdded,
  onRemoveFile,
  onClearFiles,
  onCsvChange,
  onFileFieldTargetChange,
}: StepAddDataProps) {
  const t = useTranslations("knowledge");
  const fileTargets = fileFields(fields);

  // The two flows are exclusive: once one zone has content, the other is
  // hidden entirely; clearing the content brings it back.
  const showFilesZone = fileTargets.length > 0 && !csv;
  const showCsvZone = files.length === 0;

  const handleFilesDrop = (dropped: File[]) => {
    const dataFiles = dropped.filter(
      (f) => !f.name.toLowerCase().endsWith(".csv"),
    );
    if (dataFiles.length > 0) onFilesAdded(dataFiles);
  };

  const handleCsvDrop = async (dropped: File[]) => {
    const csvFile = dropped.find((f) => f.name.toLowerCase().endsWith(".csv"));
    if (csvFile) {
      onCsvChange({ name: csvFile.name, parsed: await parseCsvFile(csvFile) });
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([buildCsvTemplate(fields)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${contextId}-import-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4",
        showFilesZone && showCsvZone && "md:grid-cols-2",
      )}
    >
      {showFilesZone && (
        <section className="flex flex-col gap-3 rounded-lg border border-input p-4">
          <div>
            <h3 className="text-sm font-semibold">
              {t("workspace.import.add.filesZoneTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("workspace.import.add.filesZoneHint")}
            </p>
          </div>
          <Dropzone
            multiple
            onFiles={handleFilesDrop}
            label={t("workspace.import.add.filesZoneDrop")}
          />
          {!showCsvZone && (
            <p className="text-sm text-muted-foreground">
              {t("workspace.import.add.clearFilesToSwitch")}
            </p>
          )}

          {files.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {t("workspace.import.add.fileCount", {
                    count: files.length,
                  })}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClearFiles}
                >
                  {t("workspace.import.add.removeAllFiles")}
                </Button>
              </div>
              <ul className="max-h-48 overflow-y-auto rounded-md border border-input">
                {files.map((file, i) => (
                  <li
                    key={`${file.name}-${i}`}
                    className="flex items-center gap-2 border-b border-input px-3 py-1.5 text-sm last:border-b-0"
                  >
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveFile(i)}
                    >
                      <X aria-hidden="true" className="size-4" />
                      <span className="sr-only">
                        {t("workspace.import.add.removeFile", {
                          name: file.name,
                        })}
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>

              {fileTargets.length > 1 && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="import-file-target" className="text-sm">
                    {t("workspace.import.add.fileFieldTarget")}
                  </Label>
                  <Select
                    value={fileFieldTarget ?? undefined}
                    onValueChange={onFileFieldTargetChange}
                  >
                    <SelectTrigger id="import-file-target" className="w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fileTargets.map((f) => (
                        <SelectItem key={f.name} value={f.name}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {showCsvZone && (
        <section className="flex flex-col gap-3 rounded-lg border border-input p-4">
          <div>
            <h3 className="text-sm font-semibold">
              {t("workspace.import.add.csvZoneTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("workspace.import.add.csvZoneHint")}
            </p>
          </div>
          <Dropzone
            accept={[".csv"]}
            onFiles={(dropped) => void handleCsvDrop(dropped)}
            label={t("workspace.import.add.csvZoneDrop")}
          />
          {!showFilesZone && fileTargets.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {t("workspace.import.add.clearCsvToSwitch")}
            </p>
          )}
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={downloadTemplate}
            >
              <Download aria-hidden="true" className="mr-2 size-4" />
              {t("workspace.import.add.template")}
            </Button>
          </div>

          {csv && (
            <div className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm">
              <FileSpreadsheet
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
              <span className="min-w-0 flex-1 truncate">
                {t("workspace.import.add.csvChip", {
                  name: csv.name,
                  count: csv.parsed.rows.length,
                })}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onCsvChange(null)}
              >
                <X aria-hidden="true" className="size-4" />
                <span className="sr-only">
                  {t("workspace.import.add.removeCsv")}
                </span>
              </Button>
            </div>
          )}
          {csv && csv.parsed.errors.length > 0 && (
            <p className="text-sm text-destructive">
              {t("workspace.import.add.csvErrors", {
                errors: csv.parsed.errors.join("; "),
              })}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
