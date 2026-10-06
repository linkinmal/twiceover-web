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

describe("the Outlook's reference-line caption (v3.69, ADR 0992)", () => {
  it("reads price, never last close, with the close's own date", async () => {
    const { PRICE_CAPTION } = await import("./site-fixture.mjs");
    expect(PRICE_CAPTION).toBe("price $184.52 · AUG 28");
  });
});

describe("the Portfolio book", () => {
  it("derives NVDA's percent from the canonical spread's debit", async () => {
    const { PORTFOLIO, SPREAD, signedMoney, signedPct } = await import("./site-fixture.mjs");
    const nvda = PORTFOLIO.rows.find((r) => r.ticker === "NVDA");
    expect.soft(signedPct(nvda.pct)).toBe("+49.4%");
    expect.soft(nvda.pct).toBeCloseTo((nvda.pnl / SPREAD.netDebit) * 100, 1);
    expect.soft(signedMoney(-462)).toBe("−$462");
    expect.soft(signedMoney(98340).slice(1)).toBe("$98,340");
  });

  it("orders the rows by rule state, reached first", async () => {
    const { PORTFOLIO } = await import("./site-fixture.mjs");
    const rank = { reached: 0, approaching: 1, "not-met": 2 };
    const ranks = PORTFOLIO.rows.map((r) => rank[r.rule.state]);
    expect([...ranks].sort()).toEqual(ranks);
  });

  it.todo("states an Open P/L equal to its rows' sum — pending the Designer's ruling on #3963");
});
