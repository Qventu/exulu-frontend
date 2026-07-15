"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

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
import type { ColumnMapping } from "@/lib/import/map-columns";
import type { ParsedCsv } from "@/lib/import/parse-csv";
import type { ImportField } from "@/lib/import/types";

const IGNORE = "__ignore__";

export interface StepMapColumnsProps {
  csv: { name: string; parsed: ParsedCsv };
  mapping: ColumnMapping[];
  fields: ImportField[];
  onMappingChange: (mapping: ColumnMapping[]) => void;
}

export function StepMapColumns({
  csv,
  mapping,
  fields,
  onMappingChange,
}: StepMapColumnsProps) {
  const t = useTranslations("knowledge");

  const usedFields = new Set(mapping.map((m) => m.fieldName).filter(Boolean));
  const samplesFor = (index: number) =>
    csv.parsed.rows
      .slice(0, 2)
      .map((r) => r[index])
      .filter((v) => v && v.trim() !== "")
      .join(", ");

  const setTarget = (index: number, fieldName: string) => {
    onMappingChange(
      mapping.map((m) =>
        m.index === index
          ? { ...m, fieldName: fieldName === IGNORE ? null : fieldName }
          : m,
      ),
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {t("workspace.import.map.hint")}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("workspace.import.map.column")}</TableHead>
            <TableHead>{t("workspace.import.map.samples")}</TableHead>
            <TableHead>{t("workspace.import.map.target")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mapping.map((m) => (
            <TableRow key={m.index}>
              <TableCell className="font-medium">{m.header}</TableCell>
              <TableCell className="max-w-48 truncate text-muted-foreground">
                {samplesFor(m.index)}
              </TableCell>
              <TableCell>
                <Select
                  value={m.fieldName ?? IGNORE}
                  onValueChange={(v) => setTarget(m.index, v)}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={IGNORE}>
                      {t("workspace.import.map.ignore")}
                    </SelectItem>
                    {fields.map((f) => (
                      <SelectItem
                        key={f.name}
                        value={f.name}
                        disabled={
                          usedFields.has(f.name) && m.fieldName !== f.name
                        }
                      >
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
