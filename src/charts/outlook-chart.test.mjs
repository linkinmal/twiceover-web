/**
 * The projection path chart's scale math — ported alongside `outlook-chart.mjs` from `twiceover-app`
 * `apps/web/src/read/outlook-chart.test.ts` (origin/main 5d72e2c9), stock-analyst-platform#2987.
 *
 * **This suite IS the port's drift guard.** The module beside it is a hand-translation of TypeScript
 * into this repo's `.mjs`, so the risk that matters is not a design mistake but a transcription slip.
 * Keeping the upstream's own known-good expectations means a slipped constant, an inverted axis or a
 * dropped chain-break fails here instead of shipping a chart that merely looks plausible.
 *
 * The honesty claim itself is arithmetic: the axis is linear by elapsed calendar days, so the near
 * horizon reads as near. A compressed or evenly-spaced axis presented as proportional is a forbidden
 * state, and a proportion is proven by measuring it — not by looking at a rendered picture.
 */
import { describe, expect, it } from "vitest";
import { projectionChartModel } from "./outlook-chart.mjs";
import { HERO_OUTLOOK } from "./site-fixture.mjs";

const ASOF = "2026-08-28T19:45:00Z";
const SPOT = 147.2;
const HEALTHY = [
  { horizon: "near", price: 156 },
  { horizon: "mid", price: 168 },
  { horizon: "far", price: 180 },
];

function model(horizons = HEALTHY, compact = false, spot = SPOT) {
  return projectionChartModel({ spot, asOf: ASOF, horizons, compact });
}

describe("projectionChartModel — the time axis is proportional", () => {
  it("places each horizon by real calendar distance, so NEAR sits near the origin", () => {
    const m = model();
    const [near, mid, far] = [m.pointFor("near"), m.pointFor("mid"), m.pointFor("far")];
    const span = far.x - m.origin.x;

    // The whole ruling, as a measurement: 14/182 of the way along, not 1/3.
    expect.soft((near.x - m.origin.x) / span).toBeCloseTo(14 / 182, 4);
    expect.soft((mid.x - m.origin.x) / span).toBeCloseTo(91 / 182, 4);
    expect.soft((near.x - m.origin.x) / span).toBeLessThan(0.1);
  });

  it("insets the points into a 0.06–0.94 band so an end label cannot overhang the viewBox", () => {
    const m = model();
    expect.soft(m.origin.x).toBeGreaterThan(m.padLeft);
    expect.soft(m.pointFor("far").x).toBeLessThan(m.width - m.padRight);
  });

  it("inverts the value axis — a higher price sits higher on screen (smaller y)", () => {
    const m = model();
    expect.soft(m.pointFor("far").y).toBeLessThan(m.pointFor("near").y);
    expect.soft(m.pointFor("near").y).toBeLessThan(m.origin.y);
  });
});

describe("projectionChartModel — degraded horizons", () => {
  it("drops a degraded horizon point but keeps the axis span, so the survivors do not re-space", () => {
    const full = model();
    const degraded = model([
      { horizon: "near", price: 156 },
      { horizon: "mid", price: null },
      { horizon: "far", price: 180 },
    ]);
    expect.soft(degraded.pointFor("mid")).toBeUndefined();
    // NEAR must not slide because MID went dark — the axis is calendar time, not the surviving set.
    expect.soft(degraded.pointFor("near").x).toBeCloseTo(full.pointFor("near").x, 6);
    expect.soft(degraded.pointFor("far").x).toBeCloseTo(full.pointFor("far").x, 6);
  });

  it("never draws a segment into or out of a degraded horizon", () => {
    const m = model([
      { horizon: "near", price: 156 },
      { horizon: "mid", price: null },
      { horizon: "far", price: 180 },
    ]);
    // origin→near only: near→mid and mid→far both touch the dark horizon.
    expect.soft(m.segments).toHaveLength(1);
    expect.soft(m.segments[0].from.key).toBe("origin");
    expect.soft(m.segments[0].to.key).toBe("near");
  });

  it("breaks the chain across a horizon MISSING from the input, same as a null one", () => {
    const m = model([
      { horizon: "near", price: 156 },
      { horizon: "far", price: 180 },
      // MID absent entirely — not `{ horizon: "mid", price: null }`, just never in the array.
    ]);
    expect.soft(m.pointFor("mid")).toBeUndefined();
    expect.soft(m.segments).toHaveLength(1);
    expect.soft(m.segments[0].to.key).toBe("near");
    // The absent horizon still gets a placeholder mark at its real calendar position.
    expect.soft(m.darkMarks.map((d) => d.horizon)).toContain("mid");
  });
});

describe("projectionChartModel — value domain scales with the ticker", () => {
  it("keeps every point inside the plot area on a low-priced ticker", () => {
    const m = model(
      [
        { horizon: "near", price: 8.95 },
        { horizon: "mid", price: 9.4 },
        { horizon: "far", price: 11.1 },
      ],
      false,
      9.1,
    );
    for (const p of [m.origin, ...m.points]) {
      expect.soft(p.y).toBeGreaterThanOrEqual(m.padTop);
      expect.soft(p.y).toBeLessThanOrEqual(m.height - m.padBottom);
    }
  });

  it("does not divide by zero when every projection equals spot", () => {
    const m = model([
      { horizon: "near", price: SPOT },
      { horizon: "mid", price: SPOT },
      { horizon: "far", price: SPOT },
    ]);
    for (const p of [m.origin, ...m.points]) expect.soft(Number.isFinite(p.y)).toBe(true);
  });

  it("pads the value domain by 0.18 of the plotted range — not by set-inclusion alone", () => {
    // Asserting only that every point lands inside the plot area is true by construction (`lo`/`hi`
    // are DERIVED from the same plotted min/max), so it stays green even with the ratio at 0. This
    // asserts the padding's proportional MAGNITUDE, computed independently from the formula.
    const m = model(
      [
        { horizon: "near", price: 110 },
        { horizon: "mid", price: 120 },
        { horizon: "far", price: 140 },
      ],
      false,
      100,
    );
    // plotted = [100, 110, 120, 140] → min 100, max 140, range 40.
    // pad = max(40 * 0.18, ((140+100)/2) * 0.01, EPSILON) = max(7.2, 1.2, EPSILON) = 7.2
    // lo = 92.8, hi = 147.2 — desktop plot height = 190 - 22 - 34 = 134.
    const lo = 92.8;
    const hi = 147.2;
    const plotHeight = m.height - m.padTop - m.padBottom;
    const yFor = (v) => m.padTop + plotHeight * (1 - (v - lo) / (hi - lo));

    expect.soft(m.pointFor("far").y).toBeCloseTo(yFor(140), 2);
    expect.soft(m.origin.y).toBeCloseTo(yFor(100), 2);
    // Mutation check on the ratio itself: with DOMAIN_PAD_RATIO at 0 (only the 1% floor surviving),
    // `pad` would fall to 1.2 and `far.y` would land near 25.8, not ~39.7 — nowhere close.
    expect.soft(m.pointFor("far").y).not.toBeCloseTo(25.8, 0);
  });
});

describe("projectionChartModel — the labels", () => {
  it("captions the origin TODAY, dated from the read's own asOf", () => {
    expect.soft(model().origin.axisLabel).toEqual({ tick: "TODAY", sub: "AUG 28" });
  });

  it("moves the origin caption with asOf while the last close stays put", () => {
    // The two dates genuinely differ on a weekend or holiday read — the origin's position is day 0
    // from the read's own `asOf`, while the reference line's PRICE is the prior trading day's close.
    const weekendRead = projectionChartModel({
      spot: SPOT,
      asOf: "2026-08-30T13:00:00Z",
      horizons: HEALTHY,
      compact: false,
    });
    expect.soft(weekendRead.origin.axisLabel).toEqual({ tick: "TODAY", sub: "AUG 30" });
    expect.soft(model().origin.axisLabel.sub).toBe("AUG 28");
    // ...and the reference line names the price ALONE in both, so nothing there can be read as a
    // second, contradictory date.
    expect.soft(weekendRead.spotLine.label).toBe("last close $147.20");
    expect.soft(weekendRead.spotLine.label).not.toMatch(/AUG/);
  });

  it("labels every horizon with its window and landing date, and no price", () => {
    const near = model().pointFor("near");
    expect.soft(near.axisLabel).toEqual({ tick: "2 WKS", sub: "SEP 11" });
    expect.soft(JSON.stringify(near.axisLabel)).not.toContain("156");
  });

  it("states the last close once, as a figure the caller places", () => {
    expect.soft(model().spotLine.label).toBe("last close $147.20");
  });
});

describe("projectionChartModel — compact (phone) geometry", () => {
  it("is its own 300×150 state, never the desktop chart scaled", () => {
    const desktop = model(HEALTHY, false);
    const compact = model(HEALTHY, true);
    expect.soft([desktop.width, desktop.height]).toEqual([620, 190]);
    expect.soft([compact.width, compact.height]).toEqual([300, 150]);
    // A uniform scale would preserve the aspect ratio; these two deliberately do not, which is why
    // the compact state re-spaces rather than transforming the desktop one.
    expect.soft(compact.width / compact.height).not.toBeCloseTo(desktop.width / desktop.height, 2);
  });

  it("insets the plot by 12 at BOTH breakpoints — the compact widening is retired", () => {
    // Asserted as a flat value rather than deleted, because "12 everywhere" is a ruling in its own
    // right: a later reader must not restore the 16 as an obvious fix.
    expect.soft(model(HEALTHY, false).padLeft).toBe(12);
    expect.soft(model(HEALTHY, true).padLeft).toBe(12);
    expect.soft(model(HEALTHY, true).padRight).toBe(model(HEALTHY, false).padRight);
    expect.soft(model(HEALTHY, true).padTop).toBe(model(HEALTHY, false).padTop);
    expect.soft(model(HEALTHY, true).padBottom).toBe(model(HEALTHY, false).padBottom);
  });

  it("leaves the origin half its own label width clear of the compact plot edge", () => {
    const m = model(HEALTHY, true);
    // origin.x = 12 + (300 - 12 - 12) * 0.06 = 28.56 — centering the TODAY caption needs only half
    // the label clear here, where right-aligning needed all of it.
    expect.soft(m.origin.x).toBeCloseTo(12 + (300 - 24) * 0.06, 6);
    expect.soft(m.origin.x).toBeGreaterThan(m.padLeft);
  });
});

describe("the site's hero fixture draws the dip-then-recover shape", () => {
  // Route (b), founder-decided 2026-08-31 (#2987): a clean up-and-to-the-right hero line reads as a
  // promise on a page whose claim is "Depth, never a verdict". The shape is the reason these three
  // figures exist, so it is asserted on the geometry rather than trusted to the numbers' authoring.
  const m = projectionChartModel({ ...HERO_OUTLOOK, compact: false });

  it("descends from the origin to NEAR, then recovers through MID to FAR", () => {
    // Screen y is inverted: descending in price means a LARGER y.
    expect.soft(m.pointFor("near").y).toBeGreaterThan(m.origin.y);
    expect.soft(m.pointFor("mid").y).toBeLessThan(m.pointFor("near").y);
    expect.soft(m.pointFor("far").y).toBeLessThan(m.pointFor("mid").y);
  });

  it("is a V, not a monotone climb — the near leg is the one that must fall", () => {
    const prices = HERO_OUTLOOK.horizons.map((h) => h.price);
    expect.soft(prices[0]).toBeLessThan(HERO_OUTLOOK.spot);
    expect.soft(prices).toEqual([178, 192, 205]);
    expect.soft(HERO_OUTLOOK.spot).toBe(184.52);
  });

  it("states the last close as the caption figure the hero renders above the plot", () => {
    expect.soft(m.spotLine.label).toBe("last close $184.52");
  });
});
