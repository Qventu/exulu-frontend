"use client";

/**
 * StageCard — a single pipeline-stage card with three roles
 * (sources / processor / embedder). Generic shell consumed by
 * stage-sources, stage-processor, stage-embedder.
 *
 * Header: stage name + queue badge (mono) + Run button + OverflowMenu.
 * Body: meta rows (visible — NOT tooltip) and the two Collapsibles
 * "Configuration" + "Jobs (n failed)" — the latter mounts QueuePanel.
 */

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import {
  OverflowMenu,
  type OverflowMenuItem,
} from "@/components/primitives/overflow-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface StageCardProps {
  /** Stage role — for icon + a11y; styling is identical. */
  stage: "sources" | "processor" | "embedder";
  /** Section heading rendered in the header. */
  title: string;
  /** Optional description rendered below the title. */
  description?: string;
  /** Optional queue badge (mono, outline). */
  queue?: string;
  /** Meta rows rendered between header and Configuration expander. */
  meta?: React.ReactNode;
  /** Primary action (e.g. Run). */
  primaryAction?: React.ReactNode;
  /** Items shown in the per-stage overflow menu. */
  overflow?: OverflowMenuItem[];
  /** Configuration expander body. Hidden when null. */
  configuration?: React.ReactNode;
  /** Jobs expander body (QueuePanel). Hidden when null. */
  jobs?: React.ReactNode;
  /** Optional failed-job badge count for the Jobs expander. */
  jobsFailedCount?: number;
  /**
   * Open the Jobs expander on mount + scroll into view. Set by the pipeline
   * tab when deep-linked with `?stage=<this stage>` (e.g. the item page's
   * "Open queue" link). Knowledge V2 Phase F4 follow-up.
   */
  autoOpenJobs?: boolean;
  /** Optional fallback body content (e.g. empty state when no processor/embedder/sources). */
  children?: React.ReactNode;
  className?: string;
}

export function StageCard({
  stage: _stage,
  title,
  description,
  queue,
  meta,
  primaryAction,
  overflow,
  configuration,
  jobs,
  jobsFailedCount,
  autoOpenJobs = false,
  children,
  className,
}: StageCardProps) {
  const t = useTranslations("knowledge");
  const [configOpen, setConfigOpen] = React.useState(false);
  const [jobsOpen, setJobsOpen] = React.useState(autoOpenJobs);
  const cardRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (autoOpenJobs) {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [autoOpenJobs]);

  return (
    <Card ref={cardRef} className={cn("border-border bg-card", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-medium">{title}</h3>
            {queue && (
              <Badge variant="outline" className="font-mono text-xs">
                {queue}
              </Badge>
            )}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {primaryAction}
          {overflow && overflow.length > 0 && (
            <OverflowMenu
              items={overflow}
              label={t("workspace.pipeline.stageMenuLabel", { stage: title })}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {children}
        {meta && <div className="text-sm">{meta}</div>}
        {configuration && (
          <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-between"
              >
                {t("workspace.pipeline.configuration")}
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "size-4 transition-transform",
                    configOpen ? "" : "-rotate-90",
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              {configuration}
            </CollapsibleContent>
          </Collapsible>
        )}
        {jobs && (
          <Collapsible open={jobsOpen} onOpenChange={setJobsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-between"
              >
                <span className="flex items-center gap-2">
                  {t("workspace.pipeline.jobs")}
                  {typeof jobsFailedCount === "number" && jobsFailedCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {jobsFailedCount}
                    </Badge>
                  )}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "size-4 transition-transform",
                    jobsOpen ? "" : "-rotate-90",
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">{jobs}</CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
