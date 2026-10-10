/**
 * The overnight call calculator's math (`overnight-call.mjs`) — money-relevant, so proven against
 * values worked outside the code (constitution, *Correctness*; ADR 1090 Decision 8).
 *
 * The reference numbers below were computed with Python's `math.erf` (an independent implementation of
 * the normal CDF) from the design's own default case — $100 stock, $105 strike, 7 days, implied
 * volatility 80% — and from the textbook at-the-money value 100 × (2·N(0.1) − 1) = 7.9655674554…
 */
import { describe, expect, it } from "vitest";
import { normalCdf } from "./normal-cdf.mjs";
import {
  DEFAULTS,
  PRESETS,
  applyPreset,
  callPrice,
  findsMet,
  heatGrid,
  presetMatches,
  roundCents,
  runOvernight,
  validateInputs,
} from "./overnight-call.mjs";

const beat = () => runOvernight(DEFAULTS);
const withInputs = (over) => runOvernight({ ...DEFAULTS, ...over });

describe("callPrice — Black-Scholes European call, no rate, no dividend, calendar days over 365", () => {
  it("reproduces the textbook at-the-money value, and holds at the top of the price range", () => {
    // N(0.1) = 0.5398278372770290, so 100 * (N(0.1) - N(-0.1)) = 7.965567455405804
    expect.soft(callPrice(100, 100, 0.2, 365)).toBeCloseTo(7.965567455405804, 10);
    // Homogeneous of degree one (no rate): a 1,000x stock and strike is a 1,000x price. A 1.5e-7 erf
    // approximation fails this by a cent; the double-precision CDF holds to 1e-8.
    expect.soft(callPrice(100000, 100000, 0.2, 365)).toBeCloseTo(7965.567455405804, 8);
    expect.soft(callPrice(200, 210, 0.8, 7)).toBeCloseTo(2 * callPrice(100, 105, 0.8, 7), 10);
  });

  it("matches the design's default case before rounding: $2.4595... for the $105 call, 7 days, IV 80%", () => {
    expect.soft(callPrice(100, 105, 0.8, 7)).toBeCloseTo(2.459559793559251, 10);
    expect.soft(callPrice(104, 105, 0.8, 7)).toBeCloseTo(4.133522699586258, 10);
    expect.soft(callPrice(104, 105, 0.45, 7)).toBeCloseTo(2.128148899122351, 10);
    expect.soft(callPrice(104, 105, 0.45, 6)).toBeCloseTo(1.9379549783270136, 10);
  });

  it("obeys put-call parity C - P = S - K with the put built from the same N, and the no-arbitrage bounds", () => {
    const put = (S, K, iv, d) => {
      const v = iv * Math.sqrt(d / 365);
      const d1 = (Math.log(S / K) + (v * v) / 2) / v;
      return K * normalCdf(-(d1 - v)) - S * normalCdf(-d1);
    };
    for (const [S, K, iv, d] of [[100, 105, 0.8, 7], [50, 40, 0.3, 30], [3, 9, 1.4, 2], [900, 850, 0.05, 700]]) {
      const c = callPrice(S, K, iv, d);
      expect.soft(c - put(S, K, iv, d), `parity ${S}/${K}`).toBeCloseTo(S - K, 9);
      expect.soft(c, `lower bound ${S}/${K}`).toBeGreaterThanOrEqual(Math.max(S - K, 0) - 1e-12);
      expect.soft(c, `upper bound ${S}/${K}`).toBeLessThanOrEqual(S);
    }
  });

  it("is the intrinsic value when no time is left or volatility is zero, never NaN", () => {
    expect.soft(callPrice(110, 105, 0.5, 0)).toBe(5);
    expect.soft(callPrice(100, 105, 0.5, 0)).toBe(0);
    expect.soft(callPrice(110, 105, 0, 7)).toBe(5);
    expect.soft(callPrice(100, 100, 0, 7)).toBe(0);
  });

  it("rises with the stock, with volatility and with time", () => {
    expect.soft(callPrice(101, 105, 0.5, 7)).toBeGreaterThan(callPrice(100, 105, 0.5, 7));
    expect.soft(callPrice(100, 105, 0.6, 7)).toBeGreaterThan(callPrice(100, 105, 0.5, 7));
    expect.soft(callPrice(100, 105, 0.5, 8)).toBeGreaterThan(callPrice(100, 105, 0.5, 7));
  });
});

describe("the design's default night: stock +4%, volatility 80% to 45%, one day passes", () => {
  it("prices the four steps in cents and splits the change in order: stock, volatility, time", () => {
    const r = beat();
    expect.soft(r.ok).toBe(true);
    expect.soft(r.values).toEqual({ v0: 2.46, v1: 4.13, v2: 2.13, v3: 1.94 });
    expect.soft(r.parts).toEqual({ stock: 1.67, volatility: -2.0, time: -0.19 });
    expect.soft(r.total).toBe(-0.52);
    // The headline the design draws: "Stock +4%. Call −21%." (1.94 / 2.46 - 1 = -21.1%)
    expect.soft(r.changePct).toBeCloseTo(-21.138, 2);
    expect.soft(Math.round(r.changePct)).toBe(-21);
    // "per contract of 100 shares"
    expect.soft(r.perContract).toBe(-52);
    expect.soft(r.when).toBe("next-morning");
  });

  it("finds the break-even stock move that restores $2.46 after the volatility fall: +5.1%", () => {
    const r = beat();
    expect.soft(r.breakEven.kind).toBe("move");
    expect.soft(r.breakEven.pct).toBe(5.1); // worked: stock 105.0846, i.e. +5.0846%, shown to one decimal
    // Re-price at the edges of the rounding step: the break-even price brackets the starting value.
    const lo = callPrice(100 * (1 + 5.05 / 100), 105, 0.45, 6);
    const hi = callPrice(100 * (1 + 5.15 / 100), 105, 0.45, 6);
    expect.soft(lo).toBeLessThanOrEqual(2.46);
    expect.soft(hi).toBeGreaterThanOrEqual(2.46);
  });

  it("states what was priced in: implied volatility over the square root of 365, 80 / 19.105 = 4.19%", () => {
    expect.soft(beat().pricedMovePct).toBeCloseTo(4.187391, 5);
  });

  it("explains it as the volatility fall outweighing the stock gain, and ticks only the first find", () => {
    const r = beat();
    expect.soft(r.whyKey).toBe("stock-up-call-down-volatility");
    expect.soft(findsMet(r.inputs, r)).toEqual([true, false, false]);
  });
});

describe("the other three presets, each worked outside the code", () => {
  it("earnings miss, big gap up and quiet night give the prices, rule and finds the design describes", () => {
    const miss = withInputs(applyPreset(PRESETS[1], 80));
    expect.soft(miss.values).toEqual({ v0: 2.46, v1: 0.92, v2: 0.09, v3: 0.06 });
    expect.soft(miss.whyKey).toBe("stock-no-help");
    expect.soft(findsMet(miss.inputs, miss)).toEqual([false, false, false]);

    const gap = withInputs(applyPreset(PRESETS[2], 80));
    expect.soft(gap.values).toEqual({ v0: 2.46, v1: 7.66, v2: 5.88, v3: 5.74 });
    expect.soft(gap.whyKey).toBe("stock-led-gain");
    expect.soft(findsMet(gap.inputs, gap)).toEqual([false, false, false]);

    const quiet = withInputs(applyPreset(PRESETS[3], 80));
    expect.soft(quiet.values).toEqual({ v0: 2.46, v1: 2.46, v2: 2.46, v3: 2.16 });
    expect.soft(quiet.parts).toEqual({ stock: 0, volatility: 0, time: -0.3 });
    expect.soft(quiet.changePct).toBeCloseTo(-12.195, 2);
    expect.soft(quiet.whyKey).toBe("time-only");
    expect.soft(findsMet(quiet.inputs, quiet)).toEqual([false, true, false]);
  });

  it("ticks the third find when the stock falls and the call gains (volatility up, stock down)", () => {
    const r = withInputs({ movePct: -2, ivAfterPct: 150 });
    expect.soft(r.total).toBeGreaterThan(0);
    expect.soft(r.whyKey).toBe("stock-down-call-up");
    expect.soft(findsMet(r.inputs, r)[2]).toBe(true);
  });
});

describe("the waterfall always adds up, because cents are rounded before differences are taken", () => {
  it("v0 + stock + volatility + time = v3 to the cent over a grid of 2,880 cases, and the three parts sum to the total", () => {
    let bad = 0;
    let n = 0;
    for (const stock of [0.5, 37.13, 100, 1234.56]) {
      for (const strikeRatio of [0.7, 1, 1.05, 1.5]) {
        for (const ivNowPct of [5, 33, 80, 250]) {
          for (const movePct of [-15, -6, 0, 3.5, 15]) {
            for (const ivAfterPct of [5, 45, 150]) {
              for (const daysPass of [0, 1, 7]) {
                const r = runOvernight({
                  stock, strike: Math.round(stock * strikeRatio * 100) / 100 || 0.01,
                  daysToExpiry: 9, ivNowPct, movePct, ivAfterPct, daysPass,
                });
                n++;
                const cents = (x) => Math.round(x * 100);
                const sum = cents(r.values.v0) + cents(r.parts.stock) + cents(r.parts.volatility) + cents(r.parts.time);
                if (!r.ok || sum !== cents(r.values.v3) || cents(r.total) !== cents(r.values.v3) - cents(r.values.v0)) bad++;
              }
            }
          }
        }
      }
    }
    expect.soft(n).toBe(2880);
    expect.soft(bad).toBe(0);
  });
});

describe("when no stock move can bring the call back", () => {
  it("says none when the call was worth $0.00 to start with", () => {
    const r = withInputs({ stock: 100, strike: 130, ivNowPct: 20, movePct: 0, ivAfterPct: 20, daysPass: 1 });
    expect.soft(r.values.v0).toBe(0);
    expect.soft(r.breakEven).toEqual({ kind: "none" });
    expect.soft(r.changePct).toBe(0);
  });

  it("says none when even three times the stock price cannot restore the value (deep-out-of-the-money, volatility collapse)", () => {
    const r = runOvernight({ stock: 100, strike: 500, daysToExpiry: 730, ivNowPct: 500, movePct: 0, ivAfterPct: 5, daysPass: 7 });
    expect.soft(r.values.v0).toBeGreaterThan(90);
    expect.soft(r.breakEven).toEqual({ kind: "none" });
  });

  it("still finds a break-even when the call expires worthless-or-intrinsic after the days pass (zero days left)", () => {
    // 1 day to expiry, 1 day passes: the call is then its intrinsic value, so the break-even is the
    // price where max(S - 105, 0) = the starting value.
    const r = runOvernight({ stock: 100, strike: 105, daysToExpiry: 1, ivNowPct: 80, movePct: 0, ivAfterPct: 80, daysPass: 1 });
    expect.soft(r.values.v3).toBe(0);
    expect.soft(r.breakEven.kind).toBe("move");
    const v0 = r.values.v0;
    expect.soft(r.breakEven.pct).toBe(Math.round(((105 + v0) / 100 - 1) * 1000) / 10);
  });
});

describe("the grid of every case", () => {
  it("is six stock moves against four volatility levels (80, 64, 45, 32), as the percent change of the call after the days pass", () => {
    const r = beat();
    const g = heatGrid(r.inputs, r);
    expect.soft(g.moves).toEqual([-8, -4, 0, 4, 8, 12]);
    expect.soft(g.rows.map((x) => x.iv)).toEqual([80, 64, 45, 32]);
    expect.soft(g.rows.map((x) => x.same)).toEqual([true, false, false, false]);
    // Worked with math.erf: percent change of the call after 1 day, against the $2.46 start.
    expect.soft(g.rows[0].cells.map((c) => c.changePct)).toEqual([-81, -56, -12, 54, 145, 257]);
    expect.soft(g.rows[1].cells.map((c) => c.changePct)).toEqual([-93, -77, -42, 20, 111, 229]);
    expect.soft(g.rows[2].cells.map((c) => c.changePct)).toEqual([-99, -94, -73, -21, 72, 201]);
    expect.soft(g.rows[3].cells.map((c) => c.changePct)).toEqual([-100, -99, -90, -49, 48, 189]);
    // The design's own headline cell (stock +4%, IV 45%) is the same number as the headline.
    expect.soft(g.rows[2].cells[3].changePct).toBe(Math.round(r.changePct));
  });

  it("never prints -0, never divides by a zero volatility, and drops duplicate volatility rows", () => {
    const low = withInputs({ ivNowPct: 1 });
    const g = heatGrid(low.inputs, low);
    expect.soft(g.rows.map((x) => x.iv)).toEqual([1]);
    expect.soft(g.rows.flatMap((x) => x.cells).every((c) => Number.isFinite(c.changePct) && !Object.is(c.changePct, -0))).toBe(true);

    const dead = withInputs({ stock: 100, strike: 130, ivNowPct: 20 });
    const gd = heatGrid(dead.inputs, dead);
    expect.soft(gd.rows.flatMap((x) => x.cells).every((c) => c.changePct === 0)).toBe(true); // v0 = $0.00: no percent exists
  });
});

describe("presets", () => {
  it("each sets the stock move, volatility after (rounded now × factor, held inside the slider range) and one day; a preset shows pressed only while the sliders match it", () => {
    expect.soft(PRESETS.map((p) => p.id)).toEqual(["beat", "miss", "gap", "quiet"]);
    expect.soft(applyPreset(PRESETS[0], 80)).toEqual({ movePct: 4, ivAfterPct: 45, daysPass: 1 });
    expect.soft(applyPreset(PRESETS[3], 80)).toEqual({ movePct: 0, ivAfterPct: 80, daysPass: 1 });
    // 300% now × 1 would be 300, past the slider's top (150): the preset holds at the slider's end.
    expect.soft(applyPreset(PRESETS[3], 300).ivAfterPct).toBe(150);
    const set = withInputs(applyPreset(PRESETS[1], 80)).inputs;
    expect.soft(PRESETS.map((p) => presetMatches(set, p))).toEqual([false, true, false, false]);
    expect.soft(presetMatches({ ...set, daysPass: 2 }, PRESETS[1])).toBe(false);
    // Still pressed straight after clicking when the slider had to clamp (a kit slip: it compared the clamped slider to the unclamped target).
    const hi = withInputs({ ivNowPct: 300, ...applyPreset(PRESETS[3], 300) }).inputs;
    expect.soft(presetMatches(hi, PRESETS[3])).toBe(true);
  });
});

describe("input checks", () => {
  it("accepts the range edges the design sets", () => {
    const edges = [
      { stock: 0.01, strike: 0.01, daysToExpiry: 1, ivNowPct: 1 },
      { stock: 100000, strike: 100000, daysToExpiry: 730, ivNowPct: 500 },
    ];
    for (const e of edges) {
      const r = validateInputs({ ...DEFAULTS, ...e });
      expect.soft(r.ok, JSON.stringify(e)).toBe(true);
      expect.soft(runOvernight({ ...DEFAULTS, ...e }).ok).toBe(true);
    }
  });

  it("refuses each field outside its range with the design's own message, keyed by field, and runs nothing", () => {
    const cases = [
      [{ stock: 0 }, "stock", "Enter a price above 0."],
      [{ stock: -5 }, "stock", "Enter a price above 0."],
      [{ stock: 100001 }, "stock", "Enter a price above 0."],
      [{ strike: NaN }, "strike", "Enter a strike above 0."],
      [{ strike: 0 }, "strike", "Enter a strike above 0."],
      [{ daysToExpiry: 0 }, "daysToExpiry", "Enter 1 to 730 days."],
      [{ daysToExpiry: 731 }, "daysToExpiry", "Enter 1 to 730 days."],
      [{ ivNowPct: 0.5 }, "ivNowPct", "Enter 1 to 500."],
      [{ ivNowPct: 501 }, "ivNowPct", "Enter 1 to 500."],
      [{ ivNowPct: Infinity }, "ivNowPct", "Enter 1 to 500."],
    ];
    for (const [over, field, msg] of cases) {
      const v = validateInputs({ ...DEFAULTS, ...over });
      expect.soft(v.ok, field).toBe(false);
      expect.soft(v.errors[field], `${field} ${JSON.stringify(over)}`).toBe(msg);
      expect.soft(Object.keys(v.errors)).toEqual([field]);
      const r = runOvernight({ ...DEFAULTS, ...over });
      expect.soft(r.ok).toBe(false);
      expect.soft(r.errors).toEqual(v.errors);
    }
    const two = validateInputs({ ...DEFAULTS, stock: 0, ivNowPct: 0 });
    expect.soft(Object.keys(two.errors).sort()).toEqual(["ivNowPct", "stock"]);
  });

  it("holds the sliders inside their ranges and never lets the days that pass exceed the days to expiry", () => {
    const r = runOvernight({ ...DEFAULTS, daysToExpiry: 3, movePct: 99, ivAfterPct: 1, daysPass: 7 });
    expect.soft(r.inputs).toMatchObject({ movePct: 15, ivAfterPct: 5, daysPass: 3 });
    const frac = runOvernight({ ...DEFAULTS, daysToExpiry: 2.5, daysPass: 7 });
    expect.soft(frac.inputs.daysPass).toBe(2);
    expect.soft(runOvernight({ ...DEFAULTS, movePct: -99 }).inputs.movePct).toBe(-15);
    expect.soft(runOvernight({ ...DEFAULTS, daysPass: -2 }).inputs.daysPass).toBe(0);
    // A slider that is somehow not a number falls back to the opening case, never to NaN.
    const bad = runOvernight({ ...DEFAULTS, movePct: NaN, ivAfterPct: undefined, daysPass: "x" });
    expect.soft(bad.ok).toBe(true);
    expect.soft(bad.inputs).toMatchObject({ movePct: 4, ivAfterPct: 45, daysPass: 1 });
    expect.soft(Number.isFinite(bad.total)).toBe(true);
  });
});

describe("wording keys the page chooses copy from", () => {
  it("is 'straight after' for 0 days, 'the next morning' for 1 and 'N days later' beyond", () => {
    expect.soft(withInputs({ daysPass: 0 }).when).toBe("straight-after");
    expect.soft(withInputs({ daysPass: 1 }).when).toBe("next-morning");
    expect.soft(withInputs({ daysPass: 4 }).when).toBe("days-later");
  });

  it("does not blame volatility when it did not fall: stock +0.5%, volatility held, 7 days pass is the neutral line", () => {
    // Worked: $7.07 before; stock part +0.23, volatility part 0.00, time part -1.14; total -0.91.
    const r = runOvernight({ ...DEFAULTS, daysToExpiry: 30, movePct: 0.5, ivAfterPct: 80, daysPass: 7 });
    expect.soft(r.parts).toEqual({ stock: 0.23, volatility: 0, time: -1.14 });
    expect.soft(r.whyKey).toBe("neutral");
  });

  it("falls to the neutral line when no rule matches, and cents round half up without ever printing -0", () => {
    // stock flat, volatility unchanged, no time passing: nothing changed, so no rule applies
    const r = withInputs({ movePct: 0, ivAfterPct: 80, daysPass: 0 });
    expect.soft(r.total).toBe(0);
    expect.soft(r.whyKey).toBe("neutral");
    expect.soft(roundCents(0.125)).toBe(0.13); // 12.5 cents exactly: half rounds up
    expect.soft(roundCents(-0.004)).toBe(0);
    expect.soft(Object.is(roundCents(-0.004), -0)).toBe(false);
  });
});
