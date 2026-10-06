"use client";

/**
 * Read-mode speakers card for the right rail.
 *
 * Who is in the recording, ordered by talk time — the thing a reader checks
 * before deciding whether anything needs correcting. Collapsed to a few rows
 * so a nine-person meeting does not crowd out the media and ask panel below.
 *
 * No edit action of its own: names and sentences in the transcript are
 * themselves click-to-correct, so a button here would be a second way to do
 * the same thing.
 */
import { useTranslations } from "next-intl";
import * as React from "react";

import { speakerColor } from "../types";

const PREVIEW_ROWS = 4;

export function SpeakersPreview({
  rawSpeakers,
  names,
  talkShare,
}: {
  rawSpeakers: string[];
  names: Record<string, string>;
  talkShare: Record<string, number>;
}) {
  const t = useTranslations("transcriptions");
  const [expanded, setExpanded] = React.useState(false);

  if (rawSpeakers.length === 0) return null;

  const ordered = [...rawSpeakers].sort(
    (a, b) => (talkShare[b] ?? 0) - (talkShare[a] ?? 0),
  );
  const shown = expanded ? ordered : ordered.slice(0, PREVIEW_ROWS);
  const hidden = ordered.length - shown.length;

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">{t("speakersPanel.previewTitle")}</p>

      <ul className="space-y-1.5">
        {shown.map((raw) => (
          <li key={raw} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: speakerColor(raw) }}
            />
            <span className="min-w-0 flex-1 truncate" title={names[raw] || raw}>
              {names[raw] || raw}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {Math.round((talkShare[raw] ?? 0) * 100)}%
            </span>
          </li>
        ))}
      </ul>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs text-primary underline underline-offset-2 max-md:h-11"
        >
          {t("speakersPanel.previewMore", { count: hidden })}
        </button>
      )}

    </div>
  );
}
