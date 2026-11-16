"use client";

/**
 * WorkStatusBadge — the work status of a routine run, with an inline menu to
 * change it (backend spec 2026-11-16-routine-work-status-design).
 *
 * The work status is the fachliche status people work the run list with
 * ("Angebot im ERP angelegt", "Erledigt"); the technical state badge next to
 * it stays what it was. Everyone who can see the run may set it. Renders
 * nothing for a routine without configured statuses.
 */

import { useMutation } from "@apollo/client";
import { Check, ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SET_ROUTINE_RUN_WORK_STATUS } from "@/lib/routine-runs/queries";
import type { RoutineRun } from "@/lib/routine-runs/types";
import {
  resolveRunStatus,
  WORK_STATUS_DOT_CLASS,
  workStatusBadgeClass,
  type WorkStatusColor,
  type WorkStatusConfig,
} from "@/lib/routine-runs/work-status";
import { cn } from "@/lib/utils";

export interface WorkStatusBadgeProps {
  run: Pick<RoutineRun, "id" | "work_status" | "work_status_updated_at" | "work_status_updated_by">;
  config: WorkStatusConfig;
  /** Called with the updated run after a successful change. */
  onChanged?: (run: RoutineRun) => void;
  className?: string;
}

export function WorkStatusBadge({ run, config, onChanged, className }: WorkStatusBadgeProps) {
  const t = useTranslations("routineRuns.workStatus");
  const [setStatus, { loading }] = useMutation<{ setRoutineRunWorkStatus: RoutineRun }>(
    SET_ROUTINE_RUN_WORK_STATUS,
  );
  // The status just chosen. It stays on screen after the request succeeded,
  // until the list hands this row its reloaded run (the app's Apollo cache
  // does not normalise, so the mutation result alone never updates the row).
  // A failed change drops it and falls back to the run's real status.
  const [pending, setPending] = React.useState<string | null | undefined>(undefined);
  const locale = useLocale();
  const runStatus = run.work_status ?? null;
  React.useEffect(() => {
    setPending(undefined);
  }, [runStatus, run.work_status_updated_at]);

  if (config.statuses.length === 0) return null;

  const currentKey = pending !== undefined ? pending : (run.work_status ?? null);
  const current = resolveRunStatus(config, currentKey);

  const choose = async (status: string | null) => {
    if (status === (run.work_status ?? null)) return;
    setPending(status);
    try {
      const { data } = await setStatus({ variables: { id: run.id, status } });
      if (data?.setRoutineRunWorkStatus) onChanged?.(data.setRoutineRunWorkStatus);
    } catch (error) {
      setPending(undefined);
      toast.error(t("updateFailed"), {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const actor = run.work_status_updated_by;
  const setBy = actor
    ? actor.kind === "tool"
      ? t("setBy.tool", { name: String(actor.id ?? "") })
      : t(`setBy.${actor.kind}`)
    : undefined;
  const setAt = run.work_status_updated_at ? new Date(run.work_status_updated_at) : null;
  const setInfo =
    pending === undefined && setBy
      ? setAt && !Number.isNaN(setAt.getTime())
        ? `${setBy} · ${new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(setAt)}`
        : setBy
      : undefined;
  const title = current?.removed ? t("removed") : setInfo;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${t("label")}: ${current ? current.label : t("none")}`}
          title={title}
          disabled={loading}
          // Rows expand on click; choosing a status must not toggle the row.
          onClick={(event) => event.stopPropagation()}
          className={cn("justify-self-start rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
        >
          <Badge
            variant="outline"
            className={cn(
              "gap-1 font-normal",
              current ? workStatusBadgeClass(current.removed ? undefined : current.color) : "border-dashed text-muted-foreground",
              current?.removed && "italic",
            )}
          >
            <span className="max-w-[150px] truncate">{current ? current.label : t("none")}</span>
            <ChevronDown className="size-3 opacity-60" aria-hidden />
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(event) => event.stopPropagation()}>
        {config.statuses.map((status) => (
          <DropdownMenuItem key={status.key} onSelect={() => void choose(status.key)}>
            <span
              className={cn("size-2 shrink-0 rounded-full", WORK_STATUS_DOT_CLASS[(status.color ?? "gray") as WorkStatusColor])}
              aria-hidden
            />
            <span className="flex-1">{status.label}</span>
            {status.key === currentKey && <Check className="size-3.5" aria-hidden />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void choose(null)} className="text-muted-foreground">
          {t("clear")}
        </DropdownMenuItem>
        {setInfo ? (
          // The tooltip is mouse-only; here keyboard and touch users get it too.
          <DropdownMenuLabel data-testid="work-status-set-by" className="max-w-64 text-xs font-normal text-muted-foreground">
            {setInfo}
          </DropdownMenuLabel>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
