"use client";

/**
 * StepTimeline — a vertical, node-and-connector progress timeline.
 *
 * Each step is a circular node connected by a vertical rule. Node states:
 *  - `done`    — filled (success token) + check
 *  - `running` — ringed (info token) + spinner (motion-safe; respects
 *                prefers-reduced-motion)
 *  - `pending` — hollow muted ring + dimmed label
 *
 * Generic and reusable — first consumer is the knowledge V2 "Update
 * progress" view (save → process → embed), but agents/onboarding/workflows
 * can reuse it. No domain logic lives here; the caller computes step states.
 */

import { Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StepState = "done" | "running" | "pending";

export interface TimelineStep {
  key: string;
  /** Small uppercase eyebrow above the label (e.g. "Processor · doc-process"). */
  eyebrow?: string;
  label: string;
  state: StepState;
  /** Optional detail line under the label. */
  detail?: React.ReactNode;
}

export interface StepTimelineProps {
  steps: TimelineStep[];
  className?: string;
}

export function StepTimeline({ steps, className }: StepTimelineProps) {
  const t = useTranslations("common");

  const stateLabel: Record<StepState, string> = {
    done: t("done"),
    running: t("running"),
    pending: t("queued"),
  };

  return (
    <ol className={cn("flex flex-col", className)}>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const done = step.state === "done";
        const running = step.state === "running";
        return (
          <li key={step.key} className="flex items-stretch gap-4">
            {/* Node + connector rail */}
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border",
                  done && "border-transparent bg-success text-success-foreground",
                  running && "border-info text-info",
                  step.state === "pending" && "border-muted-foreground/30 text-muted-foreground/50",
                )}
              >
                {done ? (
                  <Check aria-hidden="true" className="size-4" />
                ) : running ? (
                  <Loader2
                    aria-hidden="true"
                    className="size-4 motion-safe:animate-spin"
                  />
                ) : (
                  <span aria-hidden="true" className="size-2 rounded-full bg-current" />
                )}
              </span>
              {!last && (
                <span
                  className={cn(
                    "mt-1 w-px flex-1",
                    done ? "bg-success" : "bg-border",
                  )}
                />
              )}
            </div>

            {/* Content */}
            <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-6")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  {step.eyebrow && (
                    <div className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                      {step.eyebrow}
                    </div>
                  )}
                  <div
                    className={cn(
                      "text-sm font-medium",
                      step.state === "pending" && "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </div>
                </div>
                <Badge
                  variant={
                    done ? "secondary" : running ? "default" : "outline"
                  }
                  className="shrink-0"
                >
                  {stateLabel[step.state]}
                </Badge>
              </div>
              {step.detail && (
                <div className="mt-1.5 text-xs text-muted-foreground">
                  {step.detail}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
