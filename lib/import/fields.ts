import type { Context } from "@/types/models/context";

import type { ImportField } from "@/lib/import/types";

/**
 * Core item columns every context supports. `id` is matching metadata only —
 * input builders never send it (see rows.ts).
 */
export const CORE_FIELDS: ImportField[] = [
  { name: "id", label: "id", type: "text", required: false, core: true },
  {
    name: "external_id",
    label: "external_id",
    type: "text",
    required: false,
    core: true,
  },
  {
    name: "name",
    label: "name",
    type: "shortText",
    required: true,
    core: true,
  },
  {
    name: "description",
    label: "description",
    type: "longText",
    required: false,
    core: true,
  },
  { name: "tags", label: "tags", type: "text", required: false, core: true },
];

/** Importable columns: core fields + editable, non-calculated context fields. */
export function importableFields(context: Context): ImportField[] {
  const custom: ImportField[] = (context.fields ?? [])
    .filter((f) => f.editable !== false && !f.calculated)
    .map((f) => ({
      name: f.name,
      label: f.label || f.name,
      type: f.type,
      required: f.required === true,
      core: false,
      enumValues: f.enumValues,
      allowedFileTypes: f.allowedFileTypes,
    }));
  return [...CORE_FIELDS, ...custom];
}

export function fileFields(fields: ImportField[]): ImportField[] {
  return fields.filter((f) => f.type === "file");
}
