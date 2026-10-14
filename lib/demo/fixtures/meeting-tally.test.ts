import { describe, expect, it } from "vitest";

import { ALGI_MEETINGS } from "./chapter-meetings";
import { germanCount, meetingTally } from "./meeting-tally";

describe("meetingTally", () => {
  it("counts recordings, hours and the untidy states", () => {
    const t = meetingTally([
      { status: "saved", duration_seconds: 3600 },
      { status: "saved", duration_seconds: 5400 },
      { status: "cancelled", duration_seconds: null },
      { status: "failed", duration_seconds: null },
      { status: "queued", duration_seconds: null },
    ]);
    expect(t).toEqual({ count: 5, hours: 3, cancelled: 1, failed: 1, queued: 1 });
  });

  it("describes the curated ALGI list: no test or untitled rows, the agent trainings kept", () => {
    const titles = ALGI_MEETINGS.map((m) => m.title.trim());
    for (const junk of ["Test", "Test Bild", "Untitled transcript", "Unbenanntes Transkript", "Alfredo - Catch up Meeting"]) {
      expect(titles, `${junk} should be gone`).not.toContain(junk);
    }
    expect(titles).toContain("Schulung Alfredo");
    const t = meetingTally(ALGI_MEETINGS);
    expect(t.count).toBe(20);
    expect(t.hours).toBe(13);
    expect(t.cancelled).toBe(1);
    expect(t.failed).toBe(1);
    expect(t.queued).toBe(2);
  });
});

describe("germanCount", () => {
  it("spells small counts out and leaves big ones as digits", () => {
    expect(germanCount(1, true)).toBe("eine");
    expect(germanCount(1)).toBe("ein");
    expect(germanCount(2)).toBe("zwei");
    expect(germanCount(13)).toBe("dreizehn");
    expect(germanCount(20)).toBe("zwanzig");
    expect(germanCount(21)).toBe("21");
    expect(germanCount(0)).toBe("keine");
  });
});
