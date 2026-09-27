/**
 * The explainer pages' arithmetic (stock-analyst-platform#3829; build reference
 * `explainer-pages-3818-2026-09-24.html`, whose notes say "the build asserts every row's arithmetic").
 * Every expected value below is the artifact's own stated figure; the fixture has to PRODUCE it from
 * its inputs, so a mistyped figure on the page is a failing test here, not a finding on a founder read.
 */
import { describe, expect, it } from "vitest";
import {
  BROKERS,
  COVERED_CALL_RULES,
  EXMP_BAND_CARDS,
  EXMP_OUTLOOK,
  EXMP_PE,
  EXMP_PORTFOLIO,
  EXMP_PRICE,
  EXMP_TECHNICALS,
  coveredCallMath,
  sectionPlanLabel,
  signedPct,
  signedUsd,
  usdLong,
} from "./exmp-fixture.mjs";
import { SECTIONS } from "../data/sections.mjs";

const cc = coveredCallMath();

describe("the covered call's figures fall out of its legs", () => {
  it("states net debit, open P/L, max profit, max loss and breakeven as the artifact does", () => {
    expect.soft(`${usdLong(cc.netDebit)} debit`).toBe("$12,540.00 debit");
    expect.soft(signedUsd(cc.openPnl)).toBe("+$1,662");
    expect.soft(signedPct(cc.openPct)).toBe("+13.3%");
    expect.soft(`+${usdLong(cc.maxProfit)}`).toBe("+$2,460.00");
    expect.soft(`−${usdLong(cc.maxLoss)} at $0.00`).toBe("−$12,540.00 at $0.00");
    expect.soft(cc.breakeven.toFixed(2)).toBe("41.80");
    expect.soft(cc.creditTotal).toBeCloseTo(720, 6);
  });

  it("draws its payoff from one function whose corners are the stated figures", () => {
    expect.soft(cc.pnlAt(0)).toBeCloseTo(-cc.maxLoss, 6);
    expect.soft(cc.pnlAt(cc.breakeven)).toBeCloseTo(0, 6);
    expect.soft(cc.pnlAt(50)).toBeCloseTo(cc.maxProfit, 6);
    // Called away above the strike: the line is flat there.
    expect.soft(cc.pnlAt(60)).toBeCloseTo(cc.maxProfit, 6);
  });

  it("gives Paths the artifact's close, reduce and roll math", () => {
    expect.soft(usdLong(cc.close.cost)).toBe("$288.00");
    expect.soft(usdLong(cc.close.locks)).toBe("$432.00");
    expect.soft(usdLong(cc.reducePerContract)).toBe("$144.00");
    expect.soft(cc.rolledBreakeven.toFixed(2)).toBe("40.85");
    expect.soft(Math.round(cc.creditCapturedPct)).toBe(60);
    expect.soft(cc.dte).toBe(24);
  });
});

describe("the covered call's rules are evaluated, not typed", () => {
  it("reaches the 60% option target, approaches expiry 21, and meets neither stock rule", () => {
    expect(COVERED_CALL_RULES.map((r) => [r.name, r.state])).toEqual([
      ["Option target 60%", "reached"],
      ["Expiry 21 days", "approaching"],
      ["Stock target 25%", "not-met"],
      ["Stock max loss −15%", "not-met"],
    ]);
    // The stock target reads against the shares: +9.3%.
    expect(signedPct(COVERED_CALL_RULES[2].value)).toBe("+9.3%");
  });
});

describe("Your Portfolio's rows and header agree", () => {
  it("states each row's P/L and percent as the artifact does", () => {
    expect(EXMP_PORTFOLIO.rows.map((r) => [r.ticker, signedUsd(r.pnl), signedPct(r.pct)])).toEqual([
      ["EXMP", "+$1,662", "+13.3%"],
      ["EXMB", "−$128", "−24.6%"],
      ["EXMF", "−$744", "−8.7%"],
      ["EXMC", "+$42", "+31.1%"],
      ["EXMT", "+$174", "+3.9%"],
    ]);
  });

  it("makes the header's Open P/L the rows' sum — +$1,006", () => {
    expect(signedUsd(EXMP_PORTFOLIO.openPnl)).toBe("+$1,006");
  });

  it("orders the rows by rule state, reached first", () => {
    const rank = { reached: 0, approaching: 1, "not-met": 2 };
    const ranks = EXMP_PORTFOLIO.rows.map((r) => rank[r.rule.state]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
});

describe("page 1's analysis", () => {
  it("derives the P/E from the price and the card's EPS, and Peers states the same one", () => {
    expect.soft(EXMP_PE.toFixed(1)).toBe("22.2");
    const peers = EXMP_BAND_CARDS.peers.find((b) => b.chips).chips[0][0];
    expect.soft(peers).toBe(`P/E ${EXMP_PE.toFixed(1)}`);
  });

  it("keeps each projected price inside the move options price in for its horizon", () => {
    for (const h of EXMP_OUTLOOK.horizons) {
      const move = Math.abs(h.price / EXMP_PRICE - 1) * 100;
      expect.soft(move, h.key).toBeLessThanOrEqual(h.impliedMovePct);
    }
  });

  it("keeps the price inside its own 52-week range, above the 200-DMA it is said to sit over", () => {
    expect.soft(EXMP_PRICE).toBeGreaterThan(EXMP_TECHNICALS.range52w.low);
    expect.soft(EXMP_PRICE).toBeLessThan(EXMP_TECHNICALS.range52w.high);
  });

  it.todo("computes the 50-DMA ($46.78) from the series' own last 50 closes — series pending #3963 item 4");

  it("has a band card for every section in the one list, and nothing else", () => {
    expect(Object.keys(EXMP_BAND_CARDS).sort()).toEqual(SECTIONS.map((s) => s.key).sort());
  });

  it("labels each section's reach from its plan in the one list", () => {
    expect.soft(sectionPlanLabel("fundamentals")).toBe("Every plan");
    expect.soft(sectionPlanLabel("news")).toBe("Core and Premium");
    expect.soft(sectionPlanLabel("insiders")).toBe("Premium");
  });
});

describe("the broker list's data slot", () => {
  it("is dated, text-only, and non-empty", () => {
    expect.soft(BROKERS.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect.soft(BROKERS.brokers.length).toBeGreaterThan(0);
    for (const b of BROKERS.brokers) expect.soft(typeof b).toBe("string");
  });
});
