"use client";

/**
 * QueueSection — DetailSection summarizing the routine's agent queue
 * (workflows.md ladder item 26).
 *
 * Body identical to the panel's queue-section (the source the list owner
 * deletes); only the wrapper differs (anchored <section> for useScrollSpy)
 * and `defaultOpen` flips to true. The `onManageQueue` callback now opens the
 * SUBPAGE-LOCAL QueuePanel Sheet (hosted by RoutineWorkbench), not the
 * (now-removed) page-level one.
 *
 * Reads queueName from the agent (resolved via useAgentsForPage in
 * useRoutineWorkbench). If unset: quiet "No queue configured." If set: queue
 * name + a "Manage queue" button. Never renders QueuePanel inline (single
 * overlay rule).
 */

import { List } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { DetailSection } from "@/components/primitives/detail-section";
import { Button } from "@/components/ui/button";

export interface QueueSectionProps {
  queueName?: string | null;
  /** Opens the subpage-local QueuePanel Sheet hosted by the workbench. */
  onManageQueue: (queueName: string) => void;
}

export function QueueSection({ queueName, onManageQueue }: QueueSectionProps) {
  const t = useTranslations("routines");

  return (
    <section id="queue" className="scroll-mt-20" tabIndex={-1}>
      <DetailSection title={t("queue.title")} defaultOpen={true}>
        {queueName ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <List
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
              <span className="capitalize">
                {queueName.replaceAll("_", " ")}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onManageQueue(queueName)}
            >
              {t("queue.manage")}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("queue.none")}</p>
        )}
      </DetailSection>
    </section>
  );
}
