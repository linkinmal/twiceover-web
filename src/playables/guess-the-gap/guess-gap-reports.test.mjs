import { describe, expect, it } from "vitest";
import { insideCount, validateSets } from "./guess-gap.mjs";
import { CHECKED, REPORT_SETS, SOURCE_LINE } from "./guess-gap-reports.mjs";

// The figures are Growth's checked set (ai-team/growth/blog-guess-the-gap-reports.md, stock-analyst-platform#4294).
// The expectations below are the numbers that document states, so a slip in copying them into the page fails here.
describe("the reports baked into Guess the gap", () => {
  it("are well formed: whole tenths inside the slider's scale, five to a game, no report twice", () => {
    expect(validateSets(REPORT_SETS)).toEqual([]);
  });

  it("are five batches of five, the first batch the first game, and carry the checked-set stamp", () => {
    expect.soft(REPORT_SETS).toHaveLength(5);
    expect.soft(REPORT_SETS[0].map((r) => r.company)).toEqual(["Apple", "NVIDIA", "JPMorgan Chase", "Costco", "Robinhood"]);
    expect.soft(CHECKED.at).toBe("2026-10-12");
    expect.soft(SOURCE_LINE).toContain("Checked 12 Oct 2026");
  });

  it("match the document: 15 of 25 moved less than priced (3, 2, 3, 3, 4 by batch), the largest move 29.5%, all 25 companies once", () => {
    expect.soft(REPORT_SETS.map((s) => insideCount(s))).toEqual([3, 2, 3, 3, 4]);
    expect.soft(Math.max(...REPORT_SETS.flat().map((r) => Math.abs(r.movedTenths)))).toBe(295);
    expect.soft(new Set(REPORT_SETS.flat().map((r) => r.company)).size).toBe(25);
  });

  it("carry spot values from the document, both signs and a before-the-open and an after-the-close report", () => {
    const by = (name) => REPORT_SETS.flat().find((r) => r.company === name);
    expect.soft(by("Apple")).toMatchObject({ date: "2026-07-30", pricedTenths: 38, movedTenths: -74 });
    expect.soft(by("Palantir")).toMatchObject({ date: "2026-08-03", pricedTenths: 122, movedTenths: 295 });
    expect.soft(by("Snap")).toMatchObject({ pricedTenths: 175, movedTenths: 149 });
    expect.soft(by("Micron")).toMatchObject({ date: "2026-09-30", pricedTenths: 74, movedTenths: 30 });
  });

  it("hold none of the vendor-derived detail the document keeps in the workspace (ADR 1106 Decision 2, ADR 1090)", () => {
    for (const r of REPORT_SETS.flat()) expect.soft(Object.keys(r).sort(), r.company).toEqual(["company", "date", "movedTenths", "pricedTenths"]);
  });
});
