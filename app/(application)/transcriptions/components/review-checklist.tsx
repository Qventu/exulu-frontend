"use client";

/**
 * ReviewChecklist — the edit-mode header status button (task-12 brief,
 * Step 6). A pure report: it derives everything from the caller's current
 * draft state and shows what's done / still open, but nothing here disables
 * Save — see the brief ("the checklist reports, it never gates").
 *
 * The header pill itself only reflects speaker naming (brief's exact wording:
 * "N speakers unnamed" / "Ready to save"); the popover lists all four checks.
 */
import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ReviewChecklistProps {
  titleSet: boolean;
  unnamedSpeakerCount: number;
  hasSummary: boolean;
  sharingChosen: boolean;
}

function ChecklistRow({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done ? (
        <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success" />
      ) : (
        <Circle aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className={cn(!done && "text-muted-foreground")}>{label}</span>
    </div>
  );
}

export function ReviewChecklist({
  titleSet,
  unnamedSpeakerCount,
  hasSummary,
  sharingChosen,
}: ReviewChecklistProps) {
  const t = useTranslations("transcriptions");
  const ready = unnamedSpeakerCount === 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-6 max-md:h-11 shrink-0 items-center gap-1 rounded-full border px-2 text-xs font-medium",
            ready
              ? "border-success/40 bg-success/10 text-success"
              : "border-warning/40 bg-warning/10 text-warning",
          )}
        >
          {ready ? (
            <CheckCircle2 aria-hidden="true" className="size-3.5" />
          ) : (
            <AlertTriangle aria-hidden="true" className="size-3.5" />
          )}
          {ready
            ? t("checklist.ready")
            : t("checklist.unnamed", { count: unnamedSpeakerCount })}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <p className="text-sm font-medium">{t("checklist.title")}</p>
        <div className="space-y-1.5">
          <ChecklistRow done={titleSet} label={t("checklist.titleItem")} />
          <ChecklistRow
            done={unnamedSpeakerCount === 0}
            label={
              unnamedSpeakerCount === 0
                ? t("checklist.speakersNamed")
                : t("checklist.speakersRemaining", { count: unnamedSpeakerCount })
            }
          />
          <ChecklistRow done={hasSummary} label={t("checklist.summaryItem")} />
          <ChecklistRow done={sharingChosen} label={t("checklist.sharingItem")} />
        </div>
        <p className="text-xs text-muted-foreground">{t("checklist.footnote")}</p>
      </PopoverContent>
    </Popover>
  );
}
