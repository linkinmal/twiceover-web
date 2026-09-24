/**
 * Figures on the redesigned homepage that follow from other fixture figures (stock-analyst-platform
 * #3829, the PM's #3935 accuracy check). Each is asserted as a derivation, not a typed number — the
 * defect #3935 found was exactly a stated figure ("50-DMA 175.43") authored beside the series it
 * summarizes, with nothing binding the two.
 */
import { describe, expect, it } from "vitest";
import { FUNDAMENTALS, SPOT, TECHNICALS, TECHNICALS_ROWS, TECHNICALS_SERIES } from "./site-fixture.mjs";

describe("the 50-DMA is the series' own trailing average", () => {
  it("averages the last 50 closes of the series the Technicals chart plots", () => {
    const last50 = TECHNICALS_SERIES.slice(-50).map((s) => Number(s.close));
    const mean = last50.reduce((a, b) => a + b, 0) / 50;
    expect.soft(TECHNICALS.ma50).toBe(mean.toFixed(2));
    expect.soft(TECHNICALS.ma50).toBe("178.70"); // #3935's recomputation, for the reader
    expect.soft(TECHNICALS_ROWS.find((r) => r.label === "50-DMA").value).toBe("$178.70");
  });
});

describe("the Fundamentals card", () => {
  it("states a trailing P/E that follows from its own EPS and the page's price", () => {
    expect.soft(FUNDAMENTALS.eps).toBe(8.32);
    expect.soft(FUNDAMENTALS.peTrailing).toBe(`${(SPOT / FUNDAMENTALS.eps).toFixed(1)}×`);
    expect.soft(FUNDAMENTALS.peTrailing).toBe("22.2×");
  });

  it("carries the artifact's revenue and market cap", () => {
    expect.soft(FUNDAMENTALS.revenue).toBe("$88.5B");
    expect.soft(FUNDAMENTALS.marketCap).toBe("$4.5T");
  });
});
