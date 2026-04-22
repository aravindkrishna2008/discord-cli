import { describe, expect, it } from "vitest";
import { formatPacificClockTime, formatPacificTimestamp } from "../../src/time/format.js";

describe("Pacific time formatting", () => {
  it("formats timestamps in Pacific Standard Time during winter", () => {
    const timestamp = Date.UTC(2026, 0, 1, 14, 22);

    expect(formatPacificClockTime(timestamp)).toBe("06:22");
    expect(formatPacificTimestamp(timestamp)).toBe("2026-01-01 06:22");
  });

  it("formats timestamps in Pacific local time during daylight saving time", () => {
    const timestamp = Date.UTC(2026, 3, 20, 17, 13);

    expect(formatPacificClockTime(timestamp)).toBe("10:13");
    expect(formatPacificTimestamp(timestamp)).toBe("2026-04-20 10:13");
  });
});
