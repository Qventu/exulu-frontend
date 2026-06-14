"use client";

/**
 * RunRoutineDialog — the single Run dialog, mounted page-level.
 *
 * Workflows.md ladder items 17-19, UX #12:
 * - One quiet line under the title — "Runs immediately" or "Queued on {queue}"
 *   (no Alert box).
 * - Inputs via react-hook-form with inline field errors (no toast-only).
 * - Submit fires RUN_WORKFLOW; toasts read "Routine queued" vs
 *   "Routine run started" — not the legacy "Template run completed" lie that
 *   fires before queued runs actually execute.
 * - Honors `prefill` for the Retry-with-edits flow.
 */

import { Clock, Loader2, Play, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useRoutineMutations } from "../hooks";
import type { RunRoutineRequest } from "../types";

export interface RunRoutineDialogProps {
  request: RunRoutineRequest | null;
  onClose: () => void;
}

export function RunRoutineDialog({ request, onClose }: RunRoutineDialogProps) {
  const t = useTranslations("routines");
  const tCommon = useTranslations("common");
  const { runRoutine, running } = useRoutineMutations();

  const variables = request?.variables ?? [];
  const defaultValues = React.useMemo(() => {
    const seed: Record<string, string> = {};
    for (const v of variables) {
      seed[v] = request?.prefill?.[v] ?? "";
    }
    return seed;
  }, [variables, request?.prefill]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<Record<string, string>>({
    defaultValues,
  });

  React.useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!request) return;
    try {
      await runRoutine(request.id, values);
      toast.success(request.queue ? t("toast.queued") : t("toast.started"));
      onClose();
    } catch (err) {
      toast.error(t("toast.runFailed"), {
        description: (err as Error).message,
      });
    }
  });

  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex h-dvh max-h-dvh w-full max-w-full flex-col rounded-none p-4 sm:h-auto sm:max-h-[85dvh] sm:max-w-lg sm:rounded-lg sm:p-6">
        <DialogHeader>
          <DialogTitle>
            {request?.routineName
              ? t("run.titleNamed", { name: request.routineName })
              : t("run.title")}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-sm">
            {request?.queue ? (
              <>
                <Clock aria-hidden="true" className="size-3.5 text-muted-foreground" />
                <span>{t("run.queuedOn", { queue: request.queue })}</span>
              </>
            ) : (
              <>
                <Zap aria-hidden="true" className="size-3.5 text-muted-foreground" />
                <span>{t("run.immediate")}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
        >
          {variables.length === 0 ? (
            <p className="rounded-md border bg-muted/30 p-3 text-center text-sm text-muted-foreground">
              {t("run.noVariables")}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {variables.map((variable) => {
                const error = errors[variable];
                return (
                  <div key={variable} className="space-y-1.5">
                    <Label htmlFor={`var-${variable}`} className="text-sm">
                      <span className="capitalize">
                        {variable.replaceAll("_", " ")}
                      </span>
                      <span className="ml-1 text-destructive" aria-hidden="true">
                        *
                      </span>
                    </Label>
                    <Input
                      id={`var-${variable}`}
                      autoComplete="off"
                      placeholder={t("run.placeholder", {
                        variable: variable.replaceAll("_", " "),
                      })}
                      aria-invalid={!!error}
                      {...register(variable, {
                        required: t("run.required"),
                      })}
                    />
                    {error ? (
                      <p className="text-xs text-destructive">
                        {error.message}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={running}>
              {running ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  {t("run.starting")}
                </>
              ) : request?.queue ? (
                <>
                  <Clock className="mr-2 size-4" aria-hidden="true" />
                  {t("run.queue")}
                </>
              ) : (
                <>
                  <Play className="mr-2 size-4" aria-hidden="true" />
                  {t("run.now")}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
