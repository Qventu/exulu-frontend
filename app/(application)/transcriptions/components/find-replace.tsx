"use client";

/**
 * FindReplace — bulk correction across the whole transcript (task-12 brief,
 * Step 6). Hidden behind a trigger button; find/replace/match-case drive a
 * LIVE match count via `applyFindReplace` as the user types, and "Replace
 * all" hands the parent the already-computed result. This component holds no
 * segment state of its own — `segments` always reflects the caller's current
 * draft (which may also be changing from inline block edits), so the count
 * can never drift from what Replace all would actually do.
 *
 * Stage 4 (out of scope — brief's "Scope discipline"): no "remembered for the
 * project" vocabulary list.
 */
import { Replace, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";

import { applyFindReplace, type Segment } from "../types";

export interface FindReplaceProps {
  segments: Segment[];
  onReplaceAll: (next: Segment[]) => void;
}

export function FindReplace({ segments, onReplaceAll }: FindReplaceProps) {
  const t = useTranslations("transcriptions");
  const tCommon = useTranslations("common");
  const [open, setOpen] = React.useState(false);
  const [find, setFind] = React.useState("");
  const [replace, setReplace] = React.useState("");
  const [matchCase, setMatchCase] = React.useState(false);

  const result = React.useMemo(
    () => applyFindReplace(segments, find, replace, matchCase),
    [segments, find, replace, matchCase],
  );

  const handleReplaceAll = () => {
    if (!find || result.count === 0) return;
    onReplaceAll(result.segments);
    setFind("");
    setReplace("");
  };

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="max-md:h-11"
        onClick={() => setOpen(true)}
      >
        <Replace aria-hidden="true" className="mr-2 size-4" />
        {t("findReplace.trigger")}
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{t("findReplace.title")}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 max-md:size-11"
          aria-label={tCommon("close")}
          onClick={() => setOpen(false)}
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input
          value={find}
          onChange={(event) => setFind(event.target.value)}
          placeholder={t("findReplace.findPlaceholder")}
          aria-label={t("findReplace.findLabel")}
          className="h-11 md:h-9"
        />
        <Input
          value={replace}
          onChange={(event) => setReplace(event.target.value)}
          placeholder={t("findReplace.replacePlaceholder")}
          aria-label={t("findReplace.replaceLabel")}
          className="h-11 md:h-9"
        />
        <Toggle
          pressed={matchCase}
          onPressedChange={setMatchCase}
          aria-label={t("findReplace.matchCase")}
          variant="outline"
          size="sm"
          className="max-md:h-11"
        >
          {t("findReplace.matchCaseShort")}
        </Toggle>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {find
            ? t("findReplace.matchCount", { count: result.count })
            : t("findReplace.hint")}
        </p>
        <Button
          type="button"
          size="sm"
          className="max-md:h-11"
          disabled={!find || result.count === 0}
          onClick={handleReplaceAll}
        >
          {t("findReplace.replaceAll")}
        </Button>
      </div>
    </div>
  );
}
