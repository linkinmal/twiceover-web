/**
 * `priceLineChartModel` — ported alongside `technicals-chart.mjs` from `twiceover-app`
 * `apps/web/src/read/technicals-chart.test.ts` (origin/main 33598666),
 * stock-analyst-platform#2992.
 *
 * Same role as the Outlook and payoff suites beside it: this is the drift guard on a
 * hand-translation. §4b states its two load-bearing claims as forbidden STATES rather than as
 * styling, and both are arithmetic — so they are asserted here as arithmetic, with no hardcoded
 * admit/reject list anywhere.
 */
import { describe, expect, it } from "vitest";
import {
  MIN_CLOSES_SHARE,
  MIN_POINTS,
  isFiniteNumericString,
  priceLineChartModel,
} from "./technicals-chart.mjs";
import { TECHNICALS, TECHNICALS_SERIES } from "./site-fixture.mjs";

/** A series of `n` sessions climbing from `lo` to `hi`, dated consecutively inside one month. */
const ramp = (lo, hi, n, month = "2026-06") =>
  Array.from({ length: n }, (_u, i) => ({
    date: `${month}-${String(i + 1).padStart(2, "0")}`,
    close: (lo + ((hi - lo) * i) / (n - 1)).toFixed(2),
  }));

const model = (series, technicals, compact = false) =>
  priceLineChartModel({ series, technicals, compact });

describe("priceLineChartModel — the two-states rule", () => {
  it("returns null below MIN_POINTS — the caller renders the chart or renders nothing", () => {
    // §4b: there is no dashed state, no skeleton, no "unavailable" line. Those are forbidden
    // states, so the model's own refusal is the mechanism rather than a render-time branch.
    expect(MIN_POINTS).toBe(2);
    expect(model([], TECHNICALS)).toBeNull();
    expect(model(ramp(160, 170, 1), TECHNICALS)).toBeNull();
    expect(model(ramp(160, 170, 2), TECHNICALS)).not.toBeNull();
  });
});

describe("priceLineChartModel — level admission (§4b v3.48's 60% floor)", () => {
  it("admits a level only while the closes keep at least MIN_CLOSES_SHARE of the domain", () => {
    expect(MIN_CLOSES_SHARE).toBe(0.6);
    // Closes span 170..180 (range 10). A level at 300 would give a domain of 130, dropping the
    // closes' share to 0.077 — far under the floor.
    const m = model(ramp(170, 180, 30), { ma50: "300", ma200: null, range52w: null });
    expect(m.levels).toEqual([]);
    expect(m.closesShare).toBe(1);
  });

  it("SKIPS a breaching candidate and keeps going — a nearer expensive level must not hide a further cheap one", () => {
    // This is the difference between `continue` and `break` in the admission loop, and it is
    // invisible in any fixture where the breaching candidate happens to sort LAST — which is the
    // ordinary case, since nearest-to-price usually means cheapest. It takes a deliberate shape to
    // discriminate, and the loop's own comment says why it matters.
    //
    // Closes 170..180 (range 10), last close 180. Sorted by distance to price:
    //   190 (distance 10) FIRST  -> domain 170..190, span 20, share 0.50  -> BREACHES, skipped
    //   165 (distance 15) SECOND -> domain 165..180, span 15, share 0.667 -> admits
    // With `break`, the cheap 165 is never reached and no level renders at all.
    const m = model(ramp(170, 180, 30), {
      ma50: "190",
      ma200: "165",
      range52w: null,
    });
    expect(m.levels.map((l) => l.value)).toEqual(["165"]);
    expect(m.closesShare).toBeCloseTo(10 / 15, 6);
  });

  it("admits nothing on a flat series — one level would own the whole plot", () => {
    const flat = Array.from({ length: 10 }, (_u, i) => ({
      date: `2026-06-${String(i + 1).padStart(2, "0")}`,
      close: "175.00",
    }));
    const m = model(flat, TECHNICALS);
    expect(m.levels).toEqual([]);
    // A flat series has no range to share, so the model reports a full share rather than 0/0.
    expect(m.closesShare).toBe(1);
  });

  it("rejects a level whose value is an empty string — Number('') is 0 and finite", () => {
    // The trap this guards: a presence-only check admits a rule with a BLANK value, itself a §4b
    // forbidden state (a rule never renders without its name AND value).
    expect(isFiniteNumericString("")).toBe(false);
    expect(isFiniteNumericString("0")).toBe(true);
    const m = model(ramp(170, 180, 30), { ma50: "", ma200: "178", range52w: null });
    expect(m.levels.map((l) => l.name)).toEqual(["200-DMA"]);
  });

  it("checks each 52-week bound on its OWN value, not on the parent object's presence", () => {
    // The two bounds are independent strings; one can be malformed while the other is fine.
    const m = model(ramp(170, 180, 30), {
      ma50: null,
      ma200: null,
      range52w: { high: "182", low: "" },
    });
    expect(m.levels.map((l) => l.name)).toEqual(["52-week high"]);
  });
});

describe("priceLineChartModel — the axis (§4b v3.47)", () => {
  it("spaces sessions equally by INDEX, never by calendar distance", () => {
    // The forbidden state is "a true continuous (gapped) time axis" — a calendar-proportional x
    // would gap every weekend and turn a 90-session line into a dashed one. A series with a huge
    // date jump in the middle must still be evenly spaced.
    const gapped = [
      { date: "2026-01-02", close: "170.00" },
      { date: "2026-01-05", close: "172.00" },
      { date: "2026-11-30", close: "174.00" },
      { date: "2026-12-01", close: "176.00" },
    ];
    const m = model(gapped, { ma50: null, ma200: null, range52w: null });
    const steps = m.points.slice(1).map((p, i) => +(p.x - m.points[i].x).toFixed(6));
    expect(new Set(steps).size).toBe(1);
  });

  it("puts a tick at the FIRST session of a month, labelled from that session's own date", () => {
    const across = [
      { date: "2026-05-28", close: "170.00" },
      { date: "2026-05-29", close: "171.00" },
      { date: "2026-06-01", close: "172.00" },
      { date: "2026-06-02", close: "173.00" },
      { date: "2026-07-01", close: "174.00" },
    ];
    const m = model(across, { ma50: null, ma200: null, range52w: null });
    expect(m.ticks.map((t) => t.label)).toEqual(["Jun", "Jul"]);
    // The Jun tick sits on index 2, not on the month's last May session.
    expect(m.ticks[0].x).toBeCloseTo(m.points[2].x, 6);
  });

  it("emits NO tick when no boundary is crossed — never a guessed one", () => {
    const m = model(ramp(170, 180, 20, "2026-06"), TECHNICALS);
    expect(m.ticks).toEqual([]);
  });

  it("thins to at most 4 ticks (3 compact) without reordering them", () => {
    const many = [];
    for (let mo = 1; mo <= 8; mo++) {
      many.push({ date: `2026-${String(mo).padStart(2, "0")}-01`, close: "170.00" });
      many.push({ date: `2026-${String(mo).padStart(2, "0")}-15`, close: "171.00" });
    }
    const desk = model(many, { ma50: null, ma200: null, range52w: null }, false);
    const comp = model(many, { ma50: null, ma200: null, range52w: null }, true);
    expect(desk.ticks.length).toBeLessThanOrEqual(4);
    expect(comp.ticks.length).toBeLessThanOrEqual(3);
    for (const t of [desk.ticks, comp.ticks]) {
      const xs = t.map((k) => k.x);
      expect(xs).toEqual([...xs].sort((a, b) => a - b));
    }
  });
});

describe("priceLineChartModel — the site's own fixture (#2992)", () => {
  const desk = model(TECHNICALS_SERIES, TECHNICALS, false);
  const comp = model(TECHNICALS_SERIES, TECHNICALS, true);

  it("draws 90 sessions ending on the page's own last close", () => {
    expect(TECHNICALS_SERIES).toHaveLength(90);
    expect(desk.points).toHaveLength(90);
    expect(desk.last.value).toBe("184.52");
    // The only point carrying a figure.
    expect(TECHNICALS_SERIES[TECHNICALS_SERIES.length - 1].date).toBe("2026-08-28");
  });

  it("admits all four levels on this fixture — a computed outcome, not an encoded list", () => {
    // The build reference's §6 picture draws three; the real algorithm admits four here because
    // this fixture's closes (157.00..196.86) already span nearly the whole 156..198 level range,
    // so no candidate moves the domain enough to breach the floor. Recorded rather than tuned: the
    // spec's rule is the authority, and the mockup is a picture of one outcome of it.
    expect(desk.levels.map((l) => l.name)).toEqual([
      "50-DMA",
      "52-week high",
      "200-DMA",
      "52-week low",
    ]);
    expect(desk.closesShare).toBeGreaterThan(MIN_CLOSES_SHARE);
    expect(desk.closesShare).toBeCloseTo(0.949, 3);
  });

  it("crosses four month boundaries, thinning to three in the compact state", () => {
    expect(desk.ticks.map((t) => t.label)).toEqual(["May", "Jun", "Jul", "Aug"]);
    expect(comp.ticks.map((t) => t.label)).toEqual(["May", "Jul", "Aug"]);
  });

  it("still ADMITS both close-together MAs — the crowding is the render's problem, not the model's", () => {
    // 175.43 and 168.90 are 6.53 apart in a 42-point domain, which at the desktop plot's 116px is
    // ~18px — narrower than the two-line label block those rules each carry (name at y-1, value at
    // y+8, ~8.5px type). Measured on the built page: 1.97px overlap at 620, 5.23px in the band
    // card, 7.62px at the compact width.
    //
    // The fix (#3019, Designer/Architect-ruled Option 2) deliberately does NOT live here: the model
    // stays pure domain arithmetic and admits both, and `technicals-svg.test.mjs` asserts that the
    // RENDER withholds the farther one as a pair — rule and both label lines together, never the
    // label alone (§4b). Pinned in both places so the boundary between them cannot drift: if the
    // gap changes here the number below fails, and if the withholding stops the sibling suite does.
    // twiceover-app's `TechnicalsPriceChart.tsx` carries the identical split (PR #1096).
    const byY = [...desk.levels].sort((a, b) => a.y - b.y);
    const gaps = byY.slice(1).map((l, i) => l.y - byY[i].y);
    expect(desk.levels.map((l) => l.name)).toContain("200-DMA");
    expect(Math.min(...gaps)).toBeLessThan(18.5);
    expect(Math.min(...gaps)).toBeGreaterThan(17);
  });
});
