/**
 * `payoffChartModel` — ported alongside `payoff-chart.mjs` from `twiceover-app`
 * `apps/web/src/read/payoff-chart.test.ts` (origin/main 5d72e2c9), stock-analyst-platform#2994.
 *
 * Same role as the Outlook chart's ported suite: this is the drift guard on a hand-translation. It
 * deliberately keeps the upstream's long-call, naked-short-call and spread cases even though the site
 * draws only the spread — the low/high domain asymmetry and the measured flat-vs-sloping rule are
 * what a transcription slip would break, and only the other shapes exercise them.
 */
import { describe, expect, it } from "vitest";
import { payoffChartModel } from "./payoff-chart.mjs";
import { SPREAD, SPREAD_PAYOFF, spreadPnlAt } from "./site-fixture.mjs";

describe("corner points reproduce the payoff exactly (long call, one kink, unbounded upside)", () => {
  const kinks = [100];
  const breakevens = [105];
  // Long call, strike 100, premium 5, x100: pnl(p) = (max(p-100,0) - 5) * 100
  const sample = (p) => (Math.max(p - 100, 0) - 5) * 100;
  const m = () => payoffChartModel({ kinks, breakevens, sample, lastClose: null, compact: false });

  it("is FLAT at the low kink (worthless below the strike) — the domain pads modestly and floors at $0", () => {
    expect.soft(m().loSideFlatAtKink).toBe(true);
    expect.soft(m().domainLo).toBeGreaterThanOrEqual(0);
  });

  it("reports the high side UNBOUNDED and extends further there than on the bounded side", () => {
    // Price has no ceiling, so this side really can run — and the model must SAY so, not merely
    // draw a wider span, because the render withholds an endpoint mark on the strength of it.
    expect.soft(m().hiSideUnbounded).toBe(true);
    expect.soft(m().domainHi - 100).toBeGreaterThan(100 - m().domainLo);
  });

  it("samples nothing denser than [domainLo, ...kinks, domainHi], and every corner is exact", () => {
    const model = m();
    expect.soft(model.corners.map((c) => c.price)).toEqual([model.domainLo, 100, model.domainHi]);
    for (const c of model.corners) expect.soft(c.value).toBeCloseTo(sample(c.price), 6);
  });
});

describe("naked short call — the unbounded side is the LOSS, and it is the UPSIDE", () => {
  // The one case a per-structure-type lookup table gets backwards. Measuring the slope from the
  // sampler is what keeps it right: a short call's loss runs as price RISES.
  const sample = (p) => (5 - Math.max(p - 100, 0)) * 100;
  const m = payoffChartModel({
    kinks: [100],
    breakevens: [105],
    sample,
    lastClose: null,
    compact: false,
  });

  it("marks the high side unbounded even though that is where the LOSS runs", () => {
    expect.soft(m.hiSideUnbounded).toBe(true);
    expect.soft(m.loSideFlatAtKink).toBe(true);
  });
});

describe("a still-sloping low side runs to the real $0 floor, not to a padded cutoff", () => {
  // A bare long put never flattens above its strike, and its true maximum is realized AT $0 — a
  // real, finite price. Stopping short of it would hide the structure's own bound.
  const sample = (p) => (Math.max(100 - p, 0) - 5) * 100;
  const m = payoffChartModel({
    kinks: [100],
    breakevens: [95],
    sample,
    lastClose: null,
    compact: false,
  });

  it("is not flat at the low kink, and so extends to exactly $0", () => {
    expect.soft(m.loSideFlatAtKink).toBe(false);
    expect.soft(m.domainLo).toBe(0);
  });
});

describe("the last close is always inside the frame", () => {
  const sample = (p) => (Math.max(p - 100, 0) - 5) * 100;
  it("extends the domain rather than clipping a close that falls outside it", () => {
    const m = payoffChartModel({
      kinks: [100],
      breakevens: [105],
      sample,
      lastClose: 30,
      compact: false,
    });
    expect.soft(m.domainLo).toBeLessThan(30);
    expect.soft(m.lastCloseX).toBeGreaterThan(m.padLeft);
  });
});

describe("the $0 line is always on the axis", () => {
  // `Math.min(...values, 0)` / `Math.max(...values, 0)` are only load-bearing when the payoff never
  // crosses zero — every ordinary structure straddles it, so without a case like this the two
  // clamps sit unguarded and a later edit could drop them with the suite still green.
  it("keeps the zero line in the plot even when the whole payoff sits above it", () => {
    const m = payoffChartModel({
      kinks: [100],
      breakevens: [],
      sample: () => 500,
      lastClose: null,
      compact: false,
    });
    expect.soft(m.zeroY).toBeGreaterThan(m.padTop);
    expect.soft(m.zeroY).toBeLessThanOrEqual(m.height - m.padBottom);
  });

  it("keeps it in the plot when the whole payoff sits below it", () => {
    const m = payoffChartModel({
      kinks: [100],
      breakevens: [],
      sample: () => -500,
      lastClose: null,
      compact: false,
    });
    expect.soft(m.zeroY).toBeGreaterThanOrEqual(m.padTop);
    expect.soft(m.zeroY).toBeLessThan(m.height - m.padBottom);
  });
});

describe("the site's fixture — the 2x Jul 17 175C/190C bull call spread", () => {
  const m = payoffChartModel({ ...SPREAD_PAYOFF, compact: false });

  it("draws the published max loss, breakeven and max profit exactly, from the sampler alone", () => {
    // The three figures the page states beside this chart. Derived, never transcribed — if the
    // fixture's legs and debit stopped producing them, this fails rather than the chart quietly
    // disagreeing with the row above it.
    expect.soft(spreadPnlAt(SPREAD.lowerStrike)).toBe(-1240);
    expect.soft(spreadPnlAt(SPREAD.upperStrike)).toBe(1760);
    expect.soft(spreadPnlAt(SPREAD.breakeven)).toBeCloseTo(0, 6);
  });

  it("is a SPREAD, not a covered call — bounded on both sides", () => {
    // A covered-call shape here would contradict the row directly above it on the page.
    expect.soft(m.hiSideUnbounded).toBe(false);
    expect.soft(m.loSideFlatAtKink).toBe(true);
    // Both offsetting legs are real kinks; a covered call has one.
    expect.soft(m.corners.map((c) => c.price).slice(1, -1)).toEqual([175, 190]);
  });

  it("plateaus at both ends — the loss is realized at 175, the profit capped at 190", () => {
    const first = m.corners[0];
    const last = m.corners[m.corners.length - 1];
    expect.soft(first.value).toBe(-1240);
    expect.soft(last.value).toBe(1760);
  });

  it("keeps the last close and the breakeven inside the plot, and distinct", () => {
    expect.soft(m.lastCloseX).toBeGreaterThan(m.padLeft);
    expect.soft(m.lastCloseX).toBeLessThan(m.width - m.padRight);
    const beX = m.breakevenMarks[0].x;
    // 184.52 against 181.20 — close enough that the artifact dropped the last close's numeric tick
    // rather than let two mono figures collide. They are still distinct positions.
    expect.soft(Math.abs(m.lastCloseX - beX)).toBeGreaterThan(0);
  });

  it("puts $0 inside the value axis, so the profit/loss split is visible", () => {
    expect.soft(m.zeroY).toBeGreaterThan(m.padTop);
    expect.soft(m.zeroY).toBeLessThan(m.height - m.padBottom);
  });
});

describe("payoffChartModel — domain pad tracks kinkSpan, not the kink price level (stock-analyst-platform#3006/#3009)", () => {
  /**
   * Ported alongside the fix itself from twiceover-app `apps/web/src/read/payoff-chart.ts` (`3359866`).
   * `SINGLE_KINK_PAD_RATIO` (formerly `PAD_FLOOR_RATIO`) is documented as the pad for a TRUE
   * single-kink structure — `kinkSpan` is 0, there is nothing else to derive a pad from. It used to
   * reach the domain via `max()` on every structure regardless of kink count, dominating whenever
   * `kinkSpan < magnitude` — nearly always true for a real multi-kink spread. Nothing above this point
   * in the file catches that: every case there either has a single kink or a span that already exceeds
   * its own bugged floor's neighborhood, so the regression shipped invisibly. These cases isolate the
   * property directly.
   */

  it("the NVDA fixture (2x Jul 17 175C/190C) — the worked regression case", () => {
    // kinkSpan=15, magnitude=182.5. Buggy: floorPad = max(182.5*0.15,1) = 27.375, which then WON the
    // max() against the kink-span pad — domain ~[147.63, 217.38], ~70pt, 21% of frame on a $182
    // stock. Fixed: kinkSpan alone drives the pad, since kinkSpan > 0, giving 15*0.40 = 6.0 a side.
    const kinks = [175, 190];
    const sample = (p) => Math.min(Math.max(p - 175, 0), 15) * 100 * 2 - 1240;
    const m = payoffChartModel({
      kinks,
      breakevens: [181.2],
      sample,
      lastClose: null,
      compact: false,
    });
    expect.soft(m.domainLo).toBeCloseTo(169.0, 5);
    expect.soft(m.domainHi).toBeCloseTo(196.0, 5);
    const domainWidth = m.domainHi - m.domainLo;
    expect.soft(domainWidth).toBeCloseTo(27.0, 5);
    // The buggy value was ~69.75 — this is the number that would come back if the floor still won.
    expect(domainWidth).toBeLessThan(30);
  });

  it("the SAME kink span pads identically at a low price level and a high one", () => {
    // The buggy floor is magnitude-relative, so two structures with an IDENTICAL span but different
    // price levels padded differently — a defect no single-price-level fixture can catch on its own.
    const padHiFor = (kinkLo, span) => {
      const kinks = [kinkLo, kinkLo + span];
      // Flat on both sides of a [kinkLo, kinkLo+span] band — a bull-call-spread shape at any price
      // level, so `loSideFlatAtKink`/`hiSideUnbounded` resolve the same way regardless of magnitude.
      const sample = (p) => Math.min(Math.max(p - kinkLo, 0), span) * 100 - 500;
      const m = payoffChartModel({
        kinks,
        breakevens: [kinkLo + span / 2],
        sample,
        lastClose: null,
        compact: false,
      });
      return m.domainHi - (kinkLo + span);
    };
    // Span 20, above the pad's own `, 1)` absolute floor (20*0.40=8), so this isolates the actual
    // property rather than two calls that both happen to bottom out at the floor.
    const padAt10 = padHiFor(10, 20);
    const padAt500 = padHiFor(500, 20);
    expect(padAt10).toBeCloseTo(padAt500, 5);
    expect(padAt10).toBeCloseTo(8, 5);
    // Nowhere near a magnitude-relative pad at these levels (10*0.15=1.5, 500*0.15=75) — the two price
    // levels would have differed by 50x under the bug.
    expect(Math.abs(10 * 0.15 - padAt10)).toBeGreaterThan(0.5);
  });

  it("a DIFFERENT kink span pads proportionally, at the SAME price level", () => {
    const padHiFor = (span) => {
      const kinkLo = 175;
      const kinks = [kinkLo, kinkLo + span];
      const sample = (p) => Math.min(Math.max(p - kinkLo, 0), span) * 100 - 500;
      const m = payoffChartModel({
        kinks,
        breakevens: [kinkLo + span / 2],
        sample,
        lastClose: null,
        compact: false,
      });
      return m.domainHi - (kinkLo + span);
    };
    expect(padHiFor(30)).toBeCloseTo(padHiFor(15) * 2, 5);
  });

  it("a TRUE single-kink structure (naked call, span 0) is unaffected — still magnitude-relative", () => {
    // The rename's whole point: the single-kink branch keeps doing exactly what it always documented
    // doing. A naked call at a HIGH price level pads more than one at a low price level, because there
    // is genuinely no span to pad from instead.
    const padFor = (strike) => {
      const kinks = [strike];
      const sample = (p) => Math.max(p - strike, 0) * 100 - 500;
      const m = payoffChartModel({
        kinks,
        breakevens: [strike + 5],
        sample,
        lastClose: null,
        compact: false,
      });
      return strike - m.domainLo; // the flat low side's own pad
    };
    expect(padFor(500)).toBeGreaterThan(padFor(50));
    // Exact, not just directional — a slipped SINGLE_KINK_PAD_RATIO shifts both by the same factor,
    // which the inequality above cannot see.
    expect(padFor(50)).toBeCloseTo(50 * 0.15, 5);
    expect(padFor(500)).toBeCloseTo(500 * 0.15, 5);
  });
});
