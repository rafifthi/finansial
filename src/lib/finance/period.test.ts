import { describe, expect, it } from "vitest";
import { normalizeCutoff, periodOf, periodProgress, periodRange } from "./period";

describe("periods", () => {
  it("end of month gives calendar months", () => {
    expect(periodOf("2026-11-30")).toBe("2026-11");
    expect(periodOf("2026-12-01")).toBe("2026-12");
    expect(periodRange("2026-02")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });

  it("a cut-off day moves the boundary; the period is named after the month it ends in", () => {
    expect(periodOf("2026-10-24", 24)).toBe("2026-10");
    expect(periodOf("2026-10-25", 24)).toBe("2026-11");
    expect(periodOf("2026-12-31", 24)).toBe("2027-01");
    expect(periodRange("2026-11", 24)).toEqual({ start: "2026-10-25", end: "2026-11-24" });
  });

  it("clamps the cut-off in short months without gaps or overlaps", () => {
    expect(periodRange("2026-02", 30)).toEqual({ start: "2026-01-31", end: "2026-02-28" });
    expect(periodRange("2026-03", 30)).toEqual({ start: "2026-03-01", end: "2026-03-30" });
    // Every day of a year lands in exactly the period whose range contains it.
    for (let d = new Date(Date.UTC(2026, 0, 1)); d.getUTCFullYear() === 2026; d.setUTCDate(d.getUTCDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      for (const cutoff of [1, 15, 28, 29, 30, 31]) {
        const { start, end } = periodRange(periodOf(iso, cutoff), cutoff);
        expect(iso >= start && iso <= end, `${iso} cutoff ${cutoff}`).toBe(true);
      }
    }
  });

  it("reports progress through the current period", () => {
    expect(periodProgress("2026-11-03", 24)).toEqual({ period: "2026-11", start: "2026-10-25", end: "2026-11-24", daysLeft: 21, totalDays: 31 });
    expect(periodProgress("2026-11-03").daysLeft).toBe(27);
  });

  it("normalizes stored values", () => {
    expect(normalizeCutoff("24")).toBe(24);
    expect(normalizeCutoff("")).toBe(31);
    expect(normalizeCutoff("99")).toBe(31);
  });
});
