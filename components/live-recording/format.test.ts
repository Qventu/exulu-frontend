import { describe, expect, it } from "vitest";

import { formatElapsed } from "./format";

describe("formatElapsed", () => {
  it("renders mm:ss under an hour and h:mm:ss above", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(65_000)).toBe("01:05");
    expect(formatElapsed(3_599_999)).toBe("59:59");
    expect(formatElapsed(3_600_000)).toBe("1:00:00");
    expect(formatElapsed(4 * 3_600_000 + 61_000)).toBe("4:01:01");
  });
});
