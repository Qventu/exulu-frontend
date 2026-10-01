"use client";

/**
 * SpeakersPanel — the edit-mode right column (task-12 brief, Step 6). One row
 * per distinct raw speaker label, in document order; only one row's name
 * input is open at a time. Talk share is that speaker's share of total
 * speech time; Hear seeks the player to the speaker's first block and plays
 * ~4s (the parent owns the player refs, so it implements `onHear` itself).
 *
 * Stage 4 (out of scope — brief's "Scope discipline"): no speaker name
 * *suggestions* from earlier transcripts, no speaker *Merge* control.
 */
import { ChevronDown, Ear } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

import { cn } from "@/lib/utils";

import { speakerColor, speakerNeedsName } from "../types";

export interface SpeakersPanelProps {
  /** Distinct raw labels in document order. */
  rawSpeakers: string[];
  /** raw label -> typed name; "" means still unnamed. */
  names: Record<string, string>;
  onNameChange: (rawSpeaker: string, name: string) => void;
  /** Share of total speech time, keyed by raw label, 0-1. */
  talkShare: Record<string, number>;
  /** Seeks the player to that speaker's first block and plays ~4s. */
  onHear: (rawSpeaker: string) => void;
  /** How many transcript blocks each raw label owns, for the card's stats line. */
  blockCounts: Record<string, number>;
}

export function SpeakersPanel({
  rawSpeakers,
  names,
  onNameChange,
  talkShare,
  onHear,
  blockCounts,
}: SpeakersPanelProps) {
  const t = useTranslations("transcriptions");
  const [openSpeaker, setOpenSpeaker] = React.useState<string | null>(
    rawSpeakers[0] ?? null,
  );
  // A meeting bot's labels are already real names — see speakerNeedsName.
  const namedCount = rawSpeakers.filter((raw) => !speakerNeedsName(raw, names)).length;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{t("speakersPanel.title")}</p>
        {rawSpeakers.length > 0 && (
          <p className="shrink-0 text-xs text-muted-foreground">
            {t("speakersPanel.namedCount", {
              named: namedCount,
              total: rawSpeakers.length,
            })}
          </p>
        )}
      </div>
      {rawSpeakers.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("speakersPanel.empty")}</p>
      ) : (
        <div className="space-y-1.5">
          {rawSpeakers.map((raw) => {
            const name = names[raw] ?? "";
            const open = openSpeaker === raw;
            const share = Math.round((talkShare[raw] ?? 0) * 100);
            return (
              <div key={raw} id={`speaker-panel-${raw}`} className="rounded-md border p-2">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 text-left max-md:h-11"
                  aria-expanded={open}
                  onClick={() => setOpenSpeaker(open ? null : raw)}
                >
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: speakerColor(raw) }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {name || raw}
                  </span>
                  {speakerNeedsName(raw, names) && (
                    <Badge variant="warning" className="shrink-0 text-[10px]">
                      {t("speakersPanel.needsName")}
                    </Badge>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground">{share}%</span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      open && "rotate-180",
                    )}
                  />
                </button>
                {open && (
                  <div className="mt-2 space-y-2 pl-[1.125rem]">
                    <div className="flex items-center gap-2">
                      <Input
                        value={name}
                        onChange={(event) => onNameChange(raw, event.target.value)}
                        placeholder={raw}
                        aria-label={t("speakersPanel.nameLabel", { raw })}
                        className="h-11 flex-1 md:h-9"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 max-md:h-11"
                        onClick={() => onHear(raw)}
                      >
                        <Ear aria-hidden="true" className="mr-1.5 size-3.5" />
                        {t("speakersPanel.hear")}
                      </Button>
                    </div>
                    <Progress value={share} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">
                      {t("speakersPanel.talkStats", {
                        share,
                        blocks: blockCounts[raw] ?? 0,
                      })}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
