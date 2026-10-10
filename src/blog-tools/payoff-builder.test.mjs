/**
 * The payoff builder's engine (`payoff-builder.mjs`) — ADR 1090 Decision 8; the design's
 * `blog-handoff.md` §5.3. It tells a reader the most a position can make and lose, where it breaks
 * even and what it is worth at a price, so every expected figure below is worked by hand from the
 * structure's own terms (written beside each case), never read back from the code.
 *
 * Per-share unless a case says "total". One contract is 100 shares.
 */
import { describe, expect, it } from "vitest";
import {
  STRUCTURES,
  buildPosition,
  chartRange,
  curvePoints,
  evaluate,
  findsMet,
  payoffAt,
  positionStats,
  shapeCards,
  validatePayoffInputs,
} from "./payoff-builder.mjs";

const near = (got, want) => expect.soft(got).toBeCloseTo(want, 9);
const defaults = (kind, spreadType) => {
  const def = STRUCTURES.find((s) => s.kind === kind && (s.spreadType ?? null) === (spreadType ?? null));
  return Object.fromEntries(def.fields.map((f) => [f.id, f.default]));
};
const stats = (kind, spreadType, stockNow = 100) => positionStats(buildPosition(kind, defaults(kind, spreadType), spreadType, stockNow), stockNow);

describe("the six structures at the design's invented numbers (stock $100 now)", () => {
  it("long call, $105 strike, $2.46 paid: most it can lose is the premium, gain has no limit, breaks even at $107.46", () => {
    const s = stats("lc");
    near(s.maxLoss, -2.46);
    expect.soft(s.maxGain).toBe(Infinity);
    expect.soft(s.gainUnlimited).toBe(true);
    expect.soft(s.lossUnlimited).toBe(false);
    expect.soft(s.breakEvens).toHaveLength(1);
    near(s.breakEvens[0], 107.46); // strike + premium
    expect.soft(s.maxLossAtZero).toBe(false); // flat below the strike: not "if the stock went to zero"
  });

  it("long put, $95 strike, $2.10 paid: loses at most the premium; the most it can make, $92.90, is if the stock went to zero", () => {
    const s = stats("lp");
    near(s.maxLoss, -2.1);
    near(s.maxGain, 92.9); // strike - premium, reached at a price of 0
    expect.soft(s.gainUnlimited).toBe(false);
    expect.soft(s.maxGainAtZero).toBe(true);
    near(s.breakEvens[0], 92.9);
    expect.soft(s.breakEvens).toHaveLength(1);
  });

  it("covered call, $105 call sold for $1.80 against shares bought at $100: gain capped at $6.80, loss largest if the stock went to zero, breaks even at $98.20", () => {
    const s = stats("cc");
    near(s.maxGain, 6.8); // (105 - 100) + 1.80
    near(s.maxLoss, -98.2); // -100 + 1.80, at a price of 0
    expect.soft(s.gainUnlimited).toBe(false);
    expect.soft(s.lossUnlimited).toBe(false);
    expect.soft(s.maxLossAtZero).toBe(true);
    near(s.breakEvens[0], 98.2); // cost - premium
    expect.soft(s.breakEvens).toHaveLength(1);
  });

  it("cash-secured put, $95 put sold for $1.90: gain capped at the premium, loss largest at zero ($93.10), breaks even at $93.10", () => {
    const s = stats("csp");
    near(s.maxGain, 1.9);
    near(s.maxLoss, -93.1); // 1.90 - 95
    expect.soft(s.maxLossAtZero).toBe(true);
    near(s.breakEvens[0], 93.1);
  });

  it("call spread, buy $100 / sell $110 for a $2.50 net debit: gain $7.50, loss $2.50, breaks even at $102.50", () => {
    const s = stats("vs", "c");
    near(s.maxGain, 7.5); // 10 wide - 2.50
    near(s.maxLoss, -2.5);
    expect.soft(s.gainUnlimited || s.lossUnlimited).toBe(false);
    expect.soft(s.breakEvens).toHaveLength(1);
    near(s.breakEvens[0], 102.5);
  });

  it("put spread, buy $100 / sell $90 for a $2.30 net debit: gain $7.70, loss $2.30, breaks even at $97.70", () => {
    const s = stats("vs", "p");
    near(s.maxGain, 7.7); // 10 wide - 2.30
    near(s.maxLoss, -2.3);
    near(s.breakEvens[0], 97.7);
    expect.soft(s.maxGainAtZero).toBe(false); // flat below $90: a spread's gain does not sit at a price of zero in the page's wording
  });

  it("straddle, $100 call $3.10 + put $2.90 = $6.00: loses most at the strike, gain has no limit, breaks even at $94 and $106", () => {
    const s = stats("st");
    near(s.maxLoss, -6);
    expect.soft(s.gainUnlimited).toBe(true);
    expect.soft(s.maxGain).toBe(Infinity);
    expect.soft(s.breakEvens).toHaveLength(2);
    near(s.breakEvens[0], 94);
    near(s.breakEvens[1], 106);
  });
});

describe("the two spread directions, and the other end of a strike order", () => {
  it("a credit call spread (buy $110, sell $100, net credit $2.50): gain $2.50, loss $7.50, breaks even at $102.50", () => {
    const pos = buildPosition("vs", { Kb: 110, Ks: 100, Pb: 1.7, Ps: 4.2 }, "c", 100);
    const s = positionStats(pos, 100);
    near(s.maxGain, 2.5);
    near(s.maxLoss, -7.5);
    near(s.breakEvens[0], 102.5);
  });

  it("a credit put spread (buy $90, sell $100, net credit $2.30): gain $2.30, loss $7.70, breaks even at $97.70", () => {
    const s = positionStats(buildPosition("vs", { Kb: 90, Ks: 100, Pb: 1.5, Ps: 3.8 }, "p", 100), 100);
    near(s.maxGain, 2.3);
    near(s.maxLoss, -7.7);
    near(s.breakEvens[0], 97.7);
  });
});

describe("the engine, on positions the page does not offer, to prove the kink logic itself", () => {
  it("a naked short call has a capped gain and an unlimited loss", () => {
    const s = positionStats({ stockUnits: 0, legs: [["c", -1, 100, 3]] }, 100);
    near(s.maxGain, 3);
    expect.soft(s.lossUnlimited).toBe(true);
    expect.soft(s.maxLoss).toBe(-Infinity);
    expect.soft(s.gainUnlimited).toBe(false);
    near(s.breakEvens[0], 103); // the final ray crosses zero at strike + premium
  });

  it("a bought stock position has an unlimited gain, a loss largest at zero, and one break-even at its cost", () => {
    const s = positionStats({ stockUnits: 1, legs: [] }, 100);
    expect.soft(s.gainUnlimited).toBe(true);
    near(s.maxLoss, -100);
    expect.soft(s.maxLossAtZero).toBe(true);
    near(s.breakEvens[0], 100);
  });

  it("a position that never loses has no loss, and one that never crosses zero has no break-even", () => {
    const free = positionStats(buildPosition("lc", { K: 105, P: 0 }, null, 100), 100); // a free call
    near(free.maxLoss, 0);
    expect.soft(free.lossUnlimited).toBe(false);
    // It touches zero up to the strike and then gains: the strike is the price above which it pays.
    // A price of $0 is never reported as a break-even.
    expect.soft(free.breakEvens).toEqual([105]);
    const sure = positionStats({ stockUnits: 0, legs: [["c", 1, 100, -5]] }, 100); // paid -$5: always ahead
    expect.soft(sure.breakEvens).toEqual([]);
    expect.soft(sure.maxLoss).toBeGreaterThan(0);
  });
});

describe("the value at a price, and the 1e-9 rounding", () => {
  it("is worked by hand at several prices for the long call, covered call and straddle", () => {
    const lc = buildPosition("lc", { K: 105, P: 2.46 }, null, 100);
    near(payoffAt(lc, 100, 90), -2.46);
    near(payoffAt(lc, 100, 110), 2.54); // 110 - 105 - 2.46
    const cc = buildPosition("cc", { K: 105, P: 1.8 }, null, 100);
    near(payoffAt(cc, 100, 120), 6.8); // shares +20, call -15, premium +1.80
    near(payoffAt(cc, 100, 90), -8.2); // -10 + 1.80
    const st = buildPosition("st", { K: 100, Pc: 3.1, Pp: 2.9 }, null, 100);
    near(payoffAt(st, 100, 100), -6);
    near(payoffAt(st, 100, 80), 14); // 20 - 6
  });

  it("returns exactly 0 at a break-even, not 4.4e-16 of float dust", () => {
    const lc = buildPosition("lc", { K: 105, P: 2.46 }, null, 100);
    expect.soft(payoffAt(lc, 100, 107.46)).toBe(0);
    expect.soft(Object.is(payoffAt(lc, 100, 107.46), -0)).toBe(false);
  });
});

describe("what the page shows for a typed position", () => {
  it("evaluates the design's opening case — long call, handle $110, 1 contract — in totals of 100 shares", () => {
    const e = evaluate({ kind: "lc", values: { K: 105, P: 2.46 }, stockNow: 100, contracts: 1, handle: 110 });
    expect.soft(e.ok).toBe(true);
    near(e.handleProfitPerShare, 2.54);
    expect.soft(e.handleTotal).toBe(254);
    expect.soft(e.multiplier).toBe(100);
    expect.soft(e.maxGainTotal).toBe(null); // no limit
    expect.soft(e.maxLossTotal).toBe(-246);
    expect.soft(e.breakEvens.map((b) => Math.round(b * 100) / 100)).toEqual([107.46]);
  });

  it("scales by contracts and states the cash a cash-secured put sets aside and a spread's net premium", () => {
    const csp = evaluate({ kind: "csp", values: { K: 95, P: 1.9 }, stockNow: 100, contracts: 3, handle: 92 });
    expect.soft(csp.multiplier).toBe(300);
    expect.soft(csp.cashSetAside).toBe(95 * 300);
    expect.soft(csp.maxGainTotal).toBe(570); // 1.90 x 300
    expect.soft(csp.maxLossTotal).toBeCloseTo(-27930, 6); // -93.10 x 300
    const vs = evaluate({ kind: "vs", spreadType: "c", values: defaults("vs", "c"), stockNow: 100, contracts: 1, handle: 108 });
    near(vs.netPremium, 2.5); // paid 4.20, received 1.70: a debit
    const cr = evaluate({ kind: "vs", spreadType: "c", values: { Kb: 110, Ks: 100, Pb: 1.7, Ps: 4.2 }, stockNow: 100, contracts: 1, handle: 105 });
    near(cr.netPremium, -2.5); // a credit
  });

  it("holds the handle inside the chart range", () => {
    const e = evaluate({ kind: "lc", values: { K: 105, P: 2.46 }, stockNow: 100, contracts: 1, handle: 5000 });
    expect.soft(e.handle).toBe(e.range.hi);
    const lo = evaluate({ kind: "lc", values: { K: 105, P: 2.46 }, stockNow: 100, contracts: 1, handle: -5 });
    expect.soft(lo.handle).toBe(lo.range.lo);
    const nan = evaluate({ kind: "lc", values: { K: 105, P: 2.46 }, stockNow: 100, contracts: 1, handle: NaN });
    expect.soft(nan.handle).toBe(100); // the stock price now
  });

  it("returns the last-good-result signal, not a blank, when an input is invalid", () => {
    const e = evaluate({ kind: "lc", values: { K: 0, P: 2.46 }, stockNow: 100, contracts: 1, handle: 110 });
    expect.soft(e.ok).toBe(false);
    expect.soft(e.errors).toEqual({ K: "Enter a price above 0." });
  });
});

describe("the three things to find", () => {
  it("ticks 'falls and makes money' for a long put dragged down, 'the most it can make' at the cap, 'the most it can lose' at the floor", () => {
    const put = evaluate({ kind: "lp", values: { K: 95, P: 2.1 }, stockNow: 100, contracts: 1, handle: 80 });
    expect.soft(findsMet(put)).toEqual([true, false, false]);
    const cc = evaluate({ kind: "cc", values: { K: 105, P: 1.8 }, stockNow: 100, contracts: 1, handle: 120 });
    expect.soft(findsMet(cc)).toEqual([false, true, false]);
    const lc = evaluate({ kind: "lc", values: { K: 105, P: 2.46 }, stockNow: 100, contracts: 1, handle: 60 });
    expect.soft(findsMet(lc)).toEqual([false, false, true]);
  });

  it("never ticks the cap for an unlimited gain, nor the floor for an unlimited loss, and needs a real gain for the first", () => {
    const lcUp = evaluate({ kind: "lc", values: { K: 105, P: 2.46 }, stockNow: 100, contracts: 1, handle: 150 });
    expect.soft(findsMet(lcUp)).toEqual([false, false, false]);
    // Stock fell but the position did not make money: a long call at 90.
    const lcDown = evaluate({ kind: "lc", values: { K: 105, P: 2.46 }, stockNow: 100, contracts: 1, handle: 90 });
    expect.soft(findsMet(lcDown)[0]).toBe(false);
    // Exactly at the floor of a bought option: the loss is the premium, so it ticks.
    expect.soft(findsMet(evaluate({ kind: "lc", values: { K: 105, P: 2.46 }, stockNow: 100, contracts: 1, handle: 105 }))[2]).toBe(true);
  });
});

describe("the chart range and the curve", () => {
  it("runs from 0.55x the lowest of stock and strikes to 1.45x the highest, floored and ceiled to whole dollars", () => {
    expect.soft(chartRange(buildPosition("lc", { K: 105, P: 2.46 }, null, 100), 100)).toEqual({ lo: 55, hi: 153, step: 0.5 });
    expect.soft(chartRange(buildPosition("vs", { Kb: 100, Ks: 110, Pb: 4.2, Ps: 1.7 }, "c", 100), 100)).toEqual({ lo: 55, hi: 160, step: 1 }); // 105 wide: whole-dollar steps
    expect.soft(chartRange(buildPosition("vs", { Kb: 100, Ks: 90, Pb: 3.8, Ps: 1.5 }, "p", 100), 100)).toEqual({ lo: 49, hi: 145, step: 0.5 });
    // A range under $100 wide uses half-dollar steps.
    expect.soft(chartRange(buildPosition("lc", { K: 10, P: 1 }, null, 10), 10)).toEqual({ lo: 5, hi: 15, step: 0.5 });
  });

  it("is exact against integer arithmetic at every cent from $0.01 to $2,000 (a search to $100,000 found no float dust)", () => {
    let wrong = 0;
    for (let k = 1; k <= 200000; k++) {
      const x = k / 100; // a strike or stock price in cents
      const r = chartRange({ stockUnits: 0, legs: [["c", 1, x, 1]] }, x);
      const wantLo = (55 * k - ((55 * k) % 10000)) / 10000; // floor(0.55 x), in integers
      const wantHi = Math.floor((145 * k + 9999) / 10000); // ceil(1.45 x), in integers
      if (r.lo !== wantLo || r.hi !== wantHi) wrong++;
    }
    expect.soft(wrong).toBe(0);
  });

  it("draws the payoff as straight lines between the edges and the kinks inside, so the corners ARE the payoff", () => {
    const pts = curvePoints(buildPosition("vs", { Kb: 100, Ks: 110, Pb: 4.2, Ps: 1.7 }, "c", 100), 100, 55, 160);
    expect.soft(pts.map((p) => p[0])).toEqual([55, 100, 110, 160]);
    near(pts[0][1], -2.5);
    near(pts[1][1], -2.5);
    near(pts[2][1], 7.5);
    near(pts[3][1], 7.5);
  });
});

describe("input checks", () => {
  const ok = { kind: "lc", values: { K: 105, P: 2.46 }, stockNow: 100, contracts: 1 };

  it("accepts the edges: strike and stock price 0.01 to 100,000, premium 0 to 100,000, contracts 1 to 100", () => {
    for (const over of [
      { values: { K: 0.01, P: 0 } },
      { values: { K: 100000, P: 100000 } },
      { stockNow: 0.01 },
      { stockNow: 100000 },
      { contracts: 1 },
      { contracts: 100 },
    ]) {
      expect.soft(validatePayoffInputs({ ...ok, ...over }).ok, JSON.stringify(over)).toBe(true);
    }
  });

  it("refuses each field outside its range, with the design's message, keyed by the field id", () => {
    const cases = [
      [{ values: { K: 0, P: 2 } }, "K", "Enter a price above 0."],
      [{ values: { K: 100001, P: 2 } }, "K", "Enter a price above 0."],
      [{ values: { K: 105, P: -0.01 } }, "P", "Enter 0 or more."],
      [{ values: { K: 105, P: 100001 } }, "P", "Enter 0 or more."],
      [{ values: { K: 105, P: NaN } }, "P", "Enter 0 or more."],
      [{ stockNow: 0 }, "S0", "Enter a price above 0."],
      [{ contracts: 0 }, "n", "Enter a whole number, 1 to 100."],
      [{ contracts: 101 }, "n", "Enter a whole number, 1 to 100."],
      [{ contracts: 2.5 }, "n", "Enter a whole number, 1 to 100."],
    ];
    for (const [over, field, msg] of cases) {
      const v = validatePayoffInputs({ ...ok, ...over });
      expect.soft(v.ok, field).toBe(false);
      expect.soft(v.errors[field], JSON.stringify(over)).toBe(msg);
    }
  });

  it("refuses a vertical spread whose two strikes are the same, on the sold strike", () => {
    const v = validatePayoffInputs({ kind: "vs", spreadType: "c", values: { Kb: 100, Ks: 100, Pb: 3, Ps: 1 }, stockNow: 100, contracts: 1 });
    expect.soft(v.ok).toBe(false);
    expect.soft(v.errors).toEqual({ Ks: "The two strikes must differ." });
  });

  it("reports every bad field at once", () => {
    const v = validatePayoffInputs({ ...ok, values: { K: 0, P: -1 }, stockNow: 0, contracts: 0 });
    expect.soft(Object.keys(v.errors).sort()).toEqual(["K", "P", "S0", "n"]);
  });
});

describe("the six shapes side by side", () => {
  it("lists them in the picker's order with each structure's own example numbers, as totals for one contract", () => {
    const cards = shapeCards();
    expect.soft(cards.map((c) => [c.kind, c.spreadType ?? null])).toEqual([["lc", null], ["lp", null], ["cc", null], ["csp", null], ["vs", "c"], ["st", null]]);
    const by = Object.fromEntries(cards.map((c) => [c.kind, c]));
    expect.soft(by.lc.maxGainTotal).toBe(null);
    expect.soft(by.lc.maxLossTotal).toBe(-246);
    expect.soft(by.lp.maxGainTotal).toBe(9290);
    expect.soft(by.lp.maxGainAtZero).toBe(true);
    expect.soft(by.cc.maxGainTotal).toBe(680);
    expect.soft(by.cc.maxLossTotal).toBe(-9820);
    expect.soft(by.cc.maxLossAtZero).toBe(true);
    expect.soft(by.csp.maxGainTotal).toBe(190);
    expect.soft(by.csp.maxLossTotal).toBe(-9310);
    expect.soft(by.vs.maxGainTotal).toBe(750);
    expect.soft(by.vs.maxLossTotal).toBe(-250);
    expect.soft(by.st.maxGainTotal).toBe(null);
    expect.soft(by.st.maxLossTotal).toBe(-600);
    expect.soft(cards.every((c) => c.curve.length >= 3)).toBe(true);
  });
});

describe("the structures table", () => {
  it("carries the design's handles and field ranges: each structure's opening handle price, and a field type for every input", () => {
    const handles = STRUCTURES.map((s) => [s.kind, s.spreadType ?? null, s.handle]);
    expect.soft(handles).toEqual([["lc", null, 110], ["lp", null, 90], ["cc", null, 110], ["csp", null, 92], ["vs", "c", 108], ["vs", "p", 92], ["st", null, 112]]);
    for (const s of STRUCTURES) for (const f of s.fields) expect.soft(["strike", "premium"], `${s.kind}.${f.id}`).toContain(f.type);
  });
});
