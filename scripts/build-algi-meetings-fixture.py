#!/usr/bin/env python3
"""
Builds lib/demo/fixtures/algi-meetings.json — the recording list chapter 7
opens on.

METADATA ONLY, AND THAT IS THE DESIGN. Twenty-eight real meetings, with their
real titles, durations, languages and statuses. No transcript content: a
separate, deliberately short excerpt lives in the fixture module beside the
generated guide, because 3,900 words of raw diarised conversation names
customers and staff on nearly every page and could not be redacted line by
line with any confidence.

WHAT IS DROPPED, AND WHY
  audio_s3key      storage path for the recording itself
  meeting_url      the Teams/Zoom join link
  recall_bot_id    identifiers for the recording bot
  whisper_job_id
  project_id, target_rbac_*, created_by
                   internal identifiers with no demo value

  None of these are rendered anywhere the tour goes, and a join link is a live
  credential-shaped thing. The selection set still asks for them, so the
  resolver answers null rather than omitting them — an absent selected field is
  a console error, which is a different bug from a redacted one.

TITLES ARE KEPT VERBATIM. They are ordinary German business meeting names —
Produktionsbesprechung, Kundendienstbesprechung, Fertigungsplanung — and the
list is only convincing if they read like a real week's calendar. Two name the
vendor relationship ("KI Agenten für ALGI im IMP"), which ALGI has approved.
"""

import json
import sys

SOURCE = "/tmp/algi-trans-full.txt"
OUT = "lib/demo/fixtures/algi-meetings.json"

# Asserted absent: no storage path, join link or bot identifier may reach the
# bundle even if the export shape changes upstream.
BANNED_SUBSTRINGS = ["s3", "http", "recall_bot", "whisper"]


def main() -> None:
    out = []
    for line in open(SOURCE):
        line = line.rstrip("\n")
        if not line.strip():
            continue
        parts = line.split("|")
        if len(parts) < 8:
            continue
        job_id, title, status, language, duration, created, source, bot_status = parts[:8]

        try:
            seconds = round(float(duration)) if duration else None
        except ValueError:
            seconds = None

        out.append({
            "id": job_id,
            "title": title or "Unbenanntes Transkript",
            "status": status,
            # Empty means Whisper did not report one; the UI shows a dash.
            "language": language or None,
            "duration_seconds": seconds,
            "createdAt": created,
            "updatedAt": created,
            "source": source,
            "bot_status": bot_status or None,
        })

    blob = json.dumps(out, ensure_ascii=False).lower()
    for token in BANNED_SUBSTRINGS:
        if token in blob:
            sys.exit(f"FAILED: dropped field leaked into the fixture: {token}")

    with open(OUT, "w") as handle:
        json.dump(out, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    statuses = {}
    for job in out:
        statuses[job["status"]] = statuses.get(job["status"], 0) + 1
    total = sum(j["duration_seconds"] or 0 for j in out)
    print(f"wrote {OUT}: {len(out)} meetings")
    print("statuses:", statuses)
    print(f"total recorded: {total // 3600}h {(total % 3600) // 60}m")


if __name__ == "__main__":
    main()
