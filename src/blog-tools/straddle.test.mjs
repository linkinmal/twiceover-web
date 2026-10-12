import { describe, expect, it } from "vitest";
import { DEFAULT_EXAMPLE, EXAMPLES, MAX_PRICE, SLIDER_STEP_AT, centsOf, runStraddle, sliderBounds, fitEnd, validateStraddle, profitAt } from "./straddle.mjs";

describe("the straddle's answer", () => {
  it("prints the implied move, the two breakevens and the per-share cost for the opening example", () => {
    const r = runStraddle(100, 9);
    expect.soft(r.ok).toBe(true);
    expect.soft(r.impliedTenths).toBe(90);
    expect.soft(r.lowC).toBe(9100);
    expect.soft(r.highC).toBe(10900);
    expect.soft(r.straddleC).toBe(900);
    expect.soft(r.contractDollars).toBe(900);
  });

  it("is the straddle price over the stock price, to one decimal, half rounding up in exact cents", () => {
    // 9.10 / 200 = 4.55 exactly; binary floating point can land on either side of the tie, cents arithmetic cannot.
    expect.soft(runStraddle(200, 9.1).impliedTenths).toBe(46);
    expect.soft(runStraddle(250, 11.25).impliedTenths).toBe(45);
    expect.soft(runStraddle(50, 3).impliedTenths).toBe(60);
    expect.soft(runStraddle(180, 6.3).impliedTenths).toBe(35);
    expect.soft(runStraddle(40, 4.4).impliedTenths).toBe(110);
    // 0.15% is a tie and goes up to 0.2%; 0.149% stays at 0.1%
    expect.soft(runStraddle(1000, 1.5).impliedTenths).toBe(2);
    expect.soft(runStraddle(1000, 1.49).impliedTenths).toBe(1);
  });

  it("works in whole cents, so a typed price with three decimals is the nearest cent", () => {
    expect.soft(centsOf(9.005)).toBe(901);
    expect.soft(centsOf(0.1 + 0.2)).toBe(30);
    expect.soft(runStraddle(100, 9.004).straddleC).toBe(900);
  });

  it("has the six examples valid, the first one the page opens on", () => {
    expect.soft(EXAMPLES).toHaveLength(6);
    expect.soft(DEFAULT_EXAMPLE).toBe(0);
    expect.soft(EXAMPLES[0]).toEqual({ stock: 100, straddle: 9 });
    for (const e of EXAMPLES) expect.soft(runStraddle(e.stock, e.straddle).ok, JSON.stringify(e)).toBe(true);
  });
});

describe("profit or loss on the straddle's last day", () => {
  const r = runStraddle(100, 9);
  it("is |ending price − stock| − straddle, per share and per contract, in cents", () => {
    expect.soft(profitAt(r, 10000)).toEqual({ cents: -900, contractDollars: -900, kind: "loss" });
    expect.soft(profitAt(r, 11500)).toEqual({ cents: 600, contractDollars: 600, kind: "gain" });
    expect.soft(profitAt(r, 8500)).toEqual({ cents: 600, contractDollars: 600, kind: "gain" });
    expect.soft(profitAt(r, 9400)).toEqual({ cents: -300, contractDollars: -300, kind: "loss" });
  });
  it("is exactly zero at both breakevens, and says so", () => {
    expect.soft(profitAt(r, r.lowC)).toEqual({ cents: 0, contractDollars: 0, kind: "even" });
    expect.soft(profitAt(r, r.highC)).toEqual({ cents: 0, contractDollars: 0, kind: "even" });
  });
  it("never loses more than the straddle price, whatever the ending price", () => {
    for (const e of [1, 100, 5000, 10000, 20000, 1e7]) expect.soft(profitAt(r, e).cents, `E=${e}`).toBeGreaterThanOrEqual(-r.straddleC);
  });
});

describe("the slider", () => {
  it("runs two straddle prices either side of the stock price in cents, in steps of 0.50 at $100 and above and 0.25 below", () => {
    expect.soft(sliderBounds(runStraddle(100, 9))).toEqual({ minC: 8200, maxC: 11800, stepC: 50 });
    expect.soft(sliderBounds(runStraddle(99.99, 5))).toEqual({ minC: 8999, maxC: 10999, stepC: 25 });
    expect.soft(SLIDER_STEP_AT).toBe(10000);
  });
  it("never starts below a cent, and cuts to whole steps from the stock price when the range would not divide", () => {
    expect.soft(sliderBounds(runStraddle(10, 8))).toEqual({ minC: 25, maxC: 2600, stepC: 25 });
    expect.soft(sliderBounds(runStraddle(40, 4.4))).toEqual({ minC: 3125, maxC: 4875, stepC: 25 });
  });
  it("moves by a cent when the straddle price is under one ordinary step, so the slider still has room either side", () => {
    expect.soft(sliderBounds(runStraddle(100, 0.2))).toEqual({ minC: 9960, maxC: 10040, stepC: 1 });
    expect.soft(sliderBounds(runStraddle(100, 0.5)).stepC).toBe(50);
    expect.soft(sliderBounds(runStraddle(30, 0.1))).toEqual({ minC: 2980, maxC: 3020, stepC: 1 });
  });
  it("always holds the stock price itself, inside two straddle prices either side, for every example", () => {
    for (const e of EXAMPLES) {
      const r = runStraddle(e.stock, e.straddle);
      const b = sliderBounds(r);
      expect.soft((r.stockC - b.minC) % b.stepC, JSON.stringify(e)).toBe(0);
      expect.soft(b.minC, JSON.stringify(e)).toBeGreaterThanOrEqual(Math.max(1, r.stockC - 2 * r.straddleC));
      expect.soft(b.maxC, JSON.stringify(e)).toBeLessThanOrEqual(r.stockC + 2 * r.straddleC);
      expect.soft(b.maxC - r.stockC, JSON.stringify(e)).toBeGreaterThan(r.straddleC);
    }
  });
  it("fits a stored ending price into the range and onto the step grid", () => {
    const r2 = runStraddle(100, 9);
    expect.soft(fitEnd(r2, 5)).toBe(8200);
    expect.soft(fitEnd(r2, 99999)).toBe(11800);
    expect.soft(fitEnd(r2, 10000)).toBe(10000);
    expect.soft(fitEnd(r2, 10024)).toBe(10000);
    expect.soft(fitEnd(r2, 10026)).toBe(10050);
  });
});

describe("what the page does with a bad entry", () => {
  const ok = (stock, straddle) => validateStraddle(stock, straddle);
  it("accepts a stock price above zero and a straddle price above zero and below the stock price", () => {
    expect.soft(ok(100, 9)).toEqual({ ok: true, errors: {} });
    expect.soft(ok(0.02, 0.01).ok).toBe(true);
  });
  it("marks the stock field for a blank, zero, negative or non-number entry", () => {
    for (const v of [NaN, 0, -5, Infinity]) expect.soft(Object.keys(ok(v, 9).errors), String(v)).toContain("stock");
  });
  it("marks the straddle field for a blank, zero or negative entry, and for one at or above the stock price", () => {
    for (const v of [NaN, 0, -1, 100, 150]) expect.soft(Object.keys(ok(100, v).errors), String(v)).toContain("straddle");
  });
  it("marks only the stock field when the stock is bad, never judging the straddle against it", () => {
    expect.soft(ok(0, 9)).toEqual({ ok: false, errors: { stock: expect.any(String) } });
    expect.soft(ok(-5, 9).errors.straddle).toBeUndefined();
  });
  it("marks both fields when both are bad", () => {
    expect.soft(Object.keys(ok(NaN, NaN).errors).sort()).toEqual(["straddle", "stock"].sort());
  });
  it("refuses a price above the page's cap so a huge number cannot break the chart", () => {
    expect.soft(Object.keys(ok(MAX_PRICE + 1, 9).errors)).toContain("stock");
    expect.soft(ok(MAX_PRICE, 9).ok).toBe(true);
  });
  it("runStraddle refuses what validateStraddle refuses", () => {
    expect.soft(runStraddle(100, 100).ok).toBe(false);
    expect.soft(runStraddle(0, 9).ok).toBe(false);
  });
});
