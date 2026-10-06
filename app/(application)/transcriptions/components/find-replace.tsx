"use client";

/**
 * FindReplace — bulk correction across the whole transcript.
 *
 * A dialog rather than an inline panel: inline, it sat in the toolbar row
 * beside the "click any sentence" hint and pushed that row into an awkward
 * shape, and it had nowhere to show what the replacement would actually do.
 *
 * The modal previews the result like an editor's replace-in-files buffer —
 * every affected block, with the replaced spans highlighted, recomputed as
 * the user types. Nothing is written until Replace all, which applies and
 * closes.
 *
 * Opened with ⇧⌘F / Ctrl+Shift+F. Deliberately NOT ⌘R (browser reload) or
 * plain ⌘F (browser find) — overriding either costs the user a reflex they
 * rely on everywhere else, and ⇧⌘F is the editor convention for
 * replace-across-a-document anyway.
 *
 * `segments` always reflects the caller's current draft, which may also be
 * changing from inline block edits, so the preview can never drift from what
 * Replace all would do.
 *
 * Stage 4 (out of scope): no "remembered for the project" vocabulary list.
 */
import { Replace } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

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
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

import {
  applyFindReplace,
  findReplacePreview,
  formatClock,
  speakerColor,
  type Segment,
} from "../types";

export interface FindReplaceProps {
  segments: Segment[];
  speakers: Record<string, string>;
  onReplaceAll: (next: Segment[]) => void;
}

export function FindReplace({ segments, speakers, onReplaceAll }: FindReplaceProps) {
  const t = useTranslations("transcriptions");
  const tCommon = useTranslations("common");
  const [open, setOpen] = React.useState(false);
  const [find, setFind] = React.useState("");
  const [replace, setReplace] = React.useState("");
  const [matchCase, setMatchCase] = React.useState(false);

  // ⇧⌘F / Ctrl+Shift+F from anywhere in the document, including while a
  // block's textarea has focus — that is exactly when someone notices the
  // same mistranscription everywhere and wants to fix all of it at once.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || !event.shiftKey) return;
      if (event.key.toLowerCase() !== "f") return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const preview = React.useMemo(
    () => findReplacePreview(segments, find, replace, matchCase),
    [segments, find, replace, matchCase],
  );

  const handleReplaceAll = () => {
    if (!find || preview.count === 0) return;
    onReplaceAll(applyFindReplace(segments, find, replace, matchCase).segments);
    setFind("");
    setReplace("");
    setOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="max-md:h-11"
        onClick={() => setOpen(true)}
      >
        <Replace aria-hidden="true" className="mr-2 size-4" />
        {t("findReplace.trigger")}
        <kbd className="ml-2 hidden rounded border px-1 font-mono text-[10px] text-muted-foreground md:inline">
          {t("findReplace.shortcut")}
        </kbd>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{t("findReplace.title")}</DialogTitle>
            <DialogDescription>{t("findReplace.previewHint")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              autoFocus
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

          <p className="text-xs text-muted-foreground">
            {!find
              ? t("findReplace.hint")
              : preview.count === 0
                ? t("findReplace.noMatches")
                : t("findReplace.blocksAffected", {
                    matches: preview.count,
                    blocks: preview.rows.length,
                  })}
          </p>

          {preview.rows.length > 0 && (
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-2">
              {preview.rows.map((row) => {
                const segment = segments[row.index];
                const label = speakers[segment.speaker]?.trim() || segment.speaker;
                return (
                  <div key={row.index} className="space-y-0.5 text-sm">
                    <p className="flex items-baseline gap-2 text-xs">
                      <span
                        className="font-medium"
                        style={{ color: speakerColor(segment.speaker) }}
                      >
                        {label}
                      </span>
                      <span className="font-mono text-muted-foreground">
                        {formatClock(segment.start)}
                      </span>
                    </p>
                    <p className="leading-relaxed">
                      {row.after.map((part, partIndex) => (
                        <span
                          key={partIndex}
                          className={cn(
                            part.hit && "rounded bg-success/20 px-0.5 font-medium text-success",
                          )}
                        >
                          {part.text}
                        </span>
                      ))}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="max-md:h-11"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              className="max-md:h-11"
              disabled={!find || preview.count === 0}
              onClick={handleReplaceAll}
            >
              {t("findReplace.replaceAll")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
