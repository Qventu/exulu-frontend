"use client";

/**
 * QueueSection — DetailSection summarizing the routine's agent queue
 * (workflows.md ladder item 26, queue half of legacy QueueAndScheduleCell).
 *
 * Reads queueName from the agent (resolved by useAgentsForPage at the page
 * level). If unset: quiet "No queue configured." If set: queue name + a
 * "Manage queue" button that opens the page-level QueuePanel Sheet. Never
 * renders QueuePanel inline (single overlay rule).
 */

import { List } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { DetailSection } from "@/components/primitives/detail-section";
import { Button } from "@/components/ui/button";

export interface QueueSectionProps {
  queueName?: string | null;
  /** Opens the page-level QueuePanel Sheet. */
  onManageQueue: (queueName: string) => void;
}

export function QueueSection({ queueName, onManageQueue }: QueueSectionProps) {
  const t = useTranslations("routines");

  return (
    <DetailSection title={t("queue.title")} defaultOpen={false}>
      {queueName ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <List aria-hidden="true" className="size-4 text-muted-foreground" />
            <span className="capitalize">{queueName.replaceAll("_", " ")}</span>
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
  );
}
