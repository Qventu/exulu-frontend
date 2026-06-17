"use client";

/**
 * PermissionMatrix — the role permissions editor that replaces the legacy
 * 7-stacked-cards mega-dialog (access.md U11 + ladder #40).
 *
 * Layout: one row per area (icon, label, info tooltip with the area's
 * description), and a 3-state segmented control (None / Read / Write) on the
 * right. ~320px of vertical space for all seven areas — fits the role panel
 * Sheet in one viewport, no nested cards.
 *
 * Why local (not a shared primitive yet): only the roles surface consumes it
 * today. The page-doc explicitly lists this as a local component until a
 * second consumer appears (access.md §4).
 *
 * Reads `read` / `write` enum values for the seven permission strings on
 * `UserRole`. Submits `null` for cleared selections (preserves the legacy
 * `RoleForm` payload contract — `useCreateUserRole` / `useUpdateUserRole`
 * already shape `RoleFormPayload` with nullable strings).
 *
 * i18n: every label / description / control aria-label comes through props
 * from the consumer's `access.roles.*` namespace (primitive contract — no
 * built-in strings).
 */

import {
  Bot,
  Brain,
  CodeSquare,
  Info,
  Users as UsersIcon,
  Variable,
  Wallet,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import * as React from "react";

import { Label } from "@/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** The permission grant level a row can carry. Empty string == None. */
export type PermissionLevel = "" | "read" | "write";

/** The seven permission areas, keyed by their GraphQL field name on UserRole. */
export type PermissionAreaKey =
  | "agents"
  | "workflows"
  | "variables"
  | "users"
  | "api"
  | "evals"
  | "budget_management";

/** Ordered list of areas + their icons — order is stable across renders. */
const AREA_ICONS: Record<PermissionAreaKey, LucideIcon> = {
  agents: Bot,
  workflows: Workflow,
  variables: Variable,
  users: UsersIcon,
  api: CodeSquare,
  evals: Brain,
  budget_management: Wallet,
};

export const PERMISSION_AREAS: ReadonlyArray<PermissionAreaKey> = [
  "agents",
  "workflows",
  "variables",
  "users",
  "api",
  "evals",
  "budget_management",
];

export type PermissionState = Record<PermissionAreaKey, PermissionLevel>;

export const EMPTY_PERMISSIONS: PermissionState = {
  agents: "",
  workflows: "",
  variables: "",
  users: "",
  api: "",
  evals: "",
  budget_management: "",
};

export interface PermissionMatrixLabels {
  /** Per-area display label (e.g. "Agents"). */
  area: (key: PermissionAreaKey) => string;
  /** Per-area description shown in the info tooltip. */
  areaDescription: (key: PermissionAreaKey) => string;
  /** The "None" / "Read" / "Write" segmented control labels. */
  none: string;
  read: string;
  write: string;
  /** sr-only label for the info tooltip trigger (a11y). */
  infoLabel: string;
}

export interface PermissionMatrixProps {
  value: PermissionState;
  onChange: (next: PermissionState) => void;
  labels: PermissionMatrixLabels;
  disabled?: boolean;
}

/**
 * Coerce any backend permission string to one of our three values. The
 * roles-tab list does fuzzy keyword matching (read/view/write/create/...);
 * we mirror that here so legacy roles render correctly.
 */
export function normalizePermissionLevel(
  value: string | null | undefined,
): PermissionLevel {
  if (!value) return "";
  const v = value.toLowerCase();
  if (
    v.includes("write") ||
    v.includes("create") ||
    v.includes("update") ||
    v.includes("delete")
  ) {
    return "write";
  }
  if (v.includes("read") || v.includes("view")) return "read";
  return "";
}

export function PermissionMatrix({
  value,
  onChange,
  labels,
  disabled,
}: PermissionMatrixProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div role="group" aria-label="Permissions" className="flex flex-col gap-2">
        {PERMISSION_AREAS.map((area) => {
          const Icon = AREA_ICONS[area];
          const level = value[area];
          const groupId = `perm-${area}`;
          return (
            <div
              key={area}
              className="flex min-h-11 items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 md:min-h-0"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Icon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <Label
                  htmlFor={groupId}
                  className="min-w-0 truncate text-sm font-medium"
                >
                  {labels.area(area)}
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`${labels.infoLabel}: ${labels.area(area)}`}
                      className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
                    >
                      <Info aria-hidden="true" className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    {labels.areaDescription(area)}
                  </TooltipContent>
                </Tooltip>
              </div>
              <ToggleGroup
                id={groupId}
                type="single"
                // Radix ToggleGroupItem requires a non-empty string value, so
                // we map "" → "none" for the control and translate on the way
                // back out. The stored permission state still uses "" as the
                // None sentinel — preserves the legacy RoleFormPayload shape.
                value={level === "" ? "none" : level}
                onValueChange={(next) => {
                  const resolved: PermissionLevel =
                    next === "read" || next === "write" ? next : "";
                  onChange({
                    ...value,
                    [area]: resolved,
                  });
                }}
                disabled={disabled}
                className="shrink-0"
                aria-label={labels.area(area)}
              >
                <ToggleGroupItem
                  value="none"
                  aria-label={`${labels.area(area)} — ${labels.none}`}
                  className="h-8 px-3 text-xs"
                >
                  {labels.none}
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="read"
                  aria-label={`${labels.area(area)} — ${labels.read}`}
                  className="h-8 px-3 text-xs"
                >
                  {labels.read}
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="write"
                  aria-label={`${labels.area(area)} — ${labels.write}`}
                  className="h-8 px-3 text-xs"
                >
                  {labels.write}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
