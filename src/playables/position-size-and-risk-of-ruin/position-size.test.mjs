import { describe, expect, it } from "vitest";
import { DEFAULT_EXAMPLE, DEFAULT_SIZE, EXAMPLES, PAYOFF_MESSAGE, SIZES, TRADES, WIN_MESSAGE, barSizes, fitSize, outcomes, runOdds, tenthsOf, validateOdds } from "./position-size.mjs";

// C(n, k) in BigInt, for the closed forms below.
const choose = (n, k) => {
  let c = 1n;
  for (let i = 0n; i < BigInt(k); i++) c = (c * (BigInt(n) - i)) / (i + 1n);
  return c;
};
const ratio = (num, den) => Number((num * 10n ** 15n) / den) / 1e15;

describe("the odds", () => {
  it("prints the edge and the fastest-growing size for the hand-worked cases", () => {
    const at = (w, b) => runOdds(w, b);
    expect.soft(at(60, 100)).toMatchObject({ ok: true, P: 600, B: 1000, edgeTenths: 200, positive: true, kelly: { kind: "pct", pct: 20 } });
    expect.soft(at(40, 200)).toMatchObject({ edgeTenths: 200, kelly: { kind: "pct", pct: 10 } });
    expect.soft(at(65, 60)).toMatchObject({ edgeTenths: 40, kelly: { kind: "pct", pct: 7 } });
    expect.soft(at(30, 300)).toMatchObject({ edgeTenths: 200, kelly: { kind: "pct", pct: 7 } });
    expect.soft(at(50, 150)).toMatchObject({ edgeTenths: 250, kelly: { kind: "pct", pct: 17 } });
    expect.soft(at(50, 100)).toMatchObject({ edgeTenths: 0, positive: false, kelly: { kind: "none" } });
    expect.soft(at(45, 100)).toMatchObject({ edgeTenths: -100, positive: false, kelly: { kind: "none" } });
  });

  it("rounds the edge half away from zero and the size half up, in integers", () => {
    // 50% at 100.1%: the edge is +0.05%, a tie, so +0.1%; at 99.9% it is −0.05%, so −0.1%
    expect.soft(runOdds(50, 100.1).edgeTenths).toBe(1);
    expect.soft(runOdds(50, 99.9).edgeTenths).toBe(-1);
    // 35% at 200%: the edge is 5%, the size 2.5%, a tie, so 3%
    expect.soft(runOdds(35, 200).kelly).toEqual({ kind: "pct", pct: 3 });
    // 50% at 100.1%: the size is 0.05%, above zero but rounding to it
    expect.soft(runOdds(50, 100.1).kelly).toEqual({ kind: "under" });
  });

  it("reads a typed percent to the nearest tenth, half up, before checking its range", () => {
    expect.soft(tenthsOf(55.55)).toBe(556);
    expect.soft(tenthsOf(55.549)).toBe(555);
    expect.soft(validateOdds(0.95, 100).ok).toBe(true);
    expect.soft(validateOdds(0.94, 100).errors).toEqual({ win: WIN_MESSAGE });
    expect.soft(validateOdds(99.04, 100).ok).toBe(true);
    expect.soft(validateOdds(99.05, 100).errors).toEqual({ win: WIN_MESSAGE });
    expect.soft(validateOdds(50, 0.95).ok).toBe(true);
    expect.soft(validateOdds(50, 1000.04).ok).toBe(true);
    expect.soft(validateOdds(50, 1000.05).errors).toEqual({ payoff: PAYOFF_MESSAGE });
  });

  it("marks each bad box on its own, and a box that is not a number", () => {
    expect.soft(validateOdds(NaN, 100).errors).toEqual({ win: WIN_MESSAGE });
    expect.soft(validateOdds(60, NaN).errors).toEqual({ payoff: PAYOFF_MESSAGE });
    expect.soft(validateOdds(0, 0).errors).toEqual({ win: WIN_MESSAGE, payoff: PAYOFF_MESSAGE });
    expect.soft(runOdds(100, 100)).toEqual({ ok: false, errors: { win: WIN_MESSAGE } });
  });

  it("has the six examples valid, the first one the page opens on, at a 10% size", () => {
    expect.soft(EXAMPLES).toHaveLength(6);
    expect.soft(EXAMPLES[DEFAULT_EXAMPLE]).toEqual({ win: 60, payoff: 100 });
    expect.soft(DEFAULT_SIZE).toBe(10);
    for (const e of EXAMPLES) expect.soft(runOdds(e.win, e.payoff).ok, JSON.stringify(e)).toBe(true);
  });
});

describe("how 100-trade runs end", () => {
  it("at a 100% size, falls to half at the first loss: ahead is p^100", () => {
    const o = outcomes(runOdds(60, 100), 100);
    expect.soft(o.ahead.p).toBeCloseTo(0.6 ** 100, 30);
    expect.soft(o.ahead.can).toBe(true);
    // 1 − 0.6^100 is 1 in floating point; it is still not certain
    expect.soft(o.floor.can).toBe(true);
    expect.soft(o.floor.all).toBe(false);
  });

  it("counts landing on exactly half as falling to the floor (50% size, 200% payoff)", () => {
    // A win doubles the account and a loss halves it: the walk w − l. It is at the floor when it first reaches −1.
    // Fair odds: paths of 100 steps that never go below 0 number C(100, 50); those ending at 0 are the Catalan C(100, 50)/51.
    const o = outcomes(runOdds(50, 200), 50);
    const all = 2n ** 100n;
    const never = choose(100, 50);
    const endAtZero = never / 51n;
    expect.soft(o.floor.p).toBeCloseTo(1 - ratio(never, all), 12);
    expect.soft(o.ahead.p).toBeCloseTo(ratio(never - endAtZero, all), 12);
  });

  it("at a 1% size with fair odds, ahead is the chance of more wins than losses", () => {
    // 1.01^w × 0.99^(100 − w) > 1 needs w ≥ 51.
    const o = outcomes(runOdds(50, 100), 1);
    let ahead = 0n;
    for (let w = 51; w <= 100; w++) ahead += choose(100, w);
    expect.soft(o.ahead.p).toBeCloseTo(ratio(ahead, 2n ** 100n), 12);
    // the floor needs at least 69 losses in 100 trades: possible, and rarer than one run in ten billion
    expect.soft(o.floor.can).toBe(true);
    expect.soft(o.floor.p).toBeGreaterThan(0);
    expect.soft(o.floor.p).toBeLessThan(1e-10);
  });

  it("never adds up to more than every run, and the floor share grows with the size when the edge is positive", () => {
    for (const e of EXAMPLES) {
      const r = runOdds(e.win, e.payoff);
      let last = -1;
      for (let s = 1; s <= 100; s++) {
        const o = outcomes(r, s);
        expect.soft(o.ahead.p + o.floor.p).toBeLessThanOrEqual(1 + 1e-12);
        expect.soft(o.floor.p).toBeGreaterThanOrEqual(last - 1e-12);
        last = o.floor.p;
      }
    }
  });

  it("plays exactly 100 trades", () => {
    expect(TRADES).toBe(100);
    // 30 losses at 2% leave 0.98^30 ≈ 0.545 of the start, 35 leave 0.493: the floor is reachable only after trade 34
    const r = runOdds(1, 100);
    expect.soft(outcomes(r, 2).floor.p).toBeGreaterThan(0.99);
  });
});

describe("the bars", () => {
  it("has the eight sizes, with the slider's own added in order", () => {
    expect.soft(barSizes(10)).toEqual([...SIZES]);
    expect.soft(barSizes(7)).toEqual([1, 2, 5, 7, 10, 20, 30, 50, 100]);
    expect.soft(barSizes(99)).toEqual([1, 2, 5, 10, 20, 30, 50, 99, 100]);
  });

  it("keeps the slider inside 1% to 100% in whole percents", () => {
    expect.soft(fitSize(0)).toBe(1);
    expect.soft(fitSize(140)).toBe(100);
    expect.soft(fitSize(12.4)).toBe(12);
  });
});
