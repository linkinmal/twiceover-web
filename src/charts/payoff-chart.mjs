/**
 * payoff-chart — the position payoff chart's scale math, ported from the product app
 * (stock-analyst-platform#2994, site-prelaunch.md v2.32 §2 Before/after read; build reference
 * `ai-team/design/assets/site-charts-hero-2026-08-30.html` §7).
 *
 * **Upstream:** `twiceover-app` `apps/web/src/read/payoff-chart.ts` at `origin/main` 5d72e2c9. Same
 * translation discipline and the same reasons as `outlook-chart.mjs` beside it: `.mjs` because this
 * repo has no type-check step, and the upstream test suite ported with it as the drift guard.
 *
 * **Corner points, not dense sampling.** A structure's expiry payoff is provably piecewise-linear in
 * the underlying — slope changes only at a leg's strike — so the curve is fully determined by its
 * value at `[domainLo, ...kinks, domainHi]`. Straight lines between those points are not an
 * approximation of the payoff, they ARE the payoff.
 *
 * **The two domain edges are NOT symmetric.** Price has no ceiling, so a still-sloping high side can
 * genuinely be unbounded: pad generously and withhold any endpoint mark. Price has a hard floor at
 * $0, so a still-sloping low side is not unbounded — its true bound is realized exactly at $0, a real
 * finite price — and the domain runs all the way there rather than stopping at a padded cutoff that
 * would hide the structure's own finite bound.
 *
 * **Flat-vs-sloping is measured, never looked up per structure type.** The slope just past each
 * outermost kink answers it directly. The site draws one fixed structure today, but keeping the
 * measurement is what makes the ported tests meaningful: they exercise long calls, naked short calls
 * and spreads through this same code, and a per-type table would make them prove nothing.
 */

const SLOPE_EPSILON = 0.01;
/**
 * Bounded-side padding: a fraction of the kink span, so the domain extends just past the outermost
 * kink, where the line is already flat.
 *
 * **The value is bounded above by the label-crowding rules, not by a target occupancy**
 * (stock-analyst-platform#3011/#3012). Widening the domain pushes the breakeven, the strikes and the
 * last close toward each other in pixel space, and `payoff-svg.mjs` withholds a label once two of
 * them crowd. Measured against those placement rules, the admissible band is `r <= 0.546` — above
 * that the DESKTOP "last close" word drops, which the signed artifact draws unconditionally. 0.40
 * sits inside it with headroom; it was chosen over the previous 0.15 because at 0.15 the compact
 * chart put "Max loss" directly on the payoff line. Re-tuning means re-measuring that band, not
 * matching a percentage — the mockup's hardcoded `pLo`/`pHi` are explicitly excluded from the build
 * by `read-held-position.md` v2.94, so its 45.5% occupancy is not a criterion.
 */
const BOUNDED_PAD_RATIO = 0.4;
/** High-side-only padding when unbounded — several multiples of the bounded pad, so the slope reads
 *  as unmistakably still climbing at the frame edge. The low side never uses this: it has a real
 *  floor ($0) to extend to instead of an arbitrary multiple. */
const UNBOUNDED_PAD_MULTIPLIER = 3;
/**
 * Padding for a TRUE single-kink structure (`kinkSpan` is 0, e.g. a naked call) — a fraction of the
 * kink's own price magnitude, the role `DOMAIN_PAD_FLOOR_RATIO` plays on the Outlook chart's value
 * axis. There is no kink span to derive a pad from in this case, hence the fallback to magnitude.
 *
 * Renamed from `PAD_FLOOR_RATIO` (stock-analyst-platform#3006/#3009, ported from twiceover-app
 * `apps/web/src/read/payoff-chart.ts` `3359866`): the old name and its `max()` against
 * `BOUNDED_PAD_RATIO` made this reach the domain on EVERY structure, not just the single-kink one its
 * own comment described — dominating whenever `kinkSpan < magnitude`, which is nearly always true for
 * a real multi-kink spread (a 15-point kink span on a $182 stock gave a ~70pt domain, with the
 * structure occupying 21% of the frame). It is now gated to the single-kink case by `kinkSpan > 0`
 * below, never combined with the multi-kink pad.
 */
const SINGLE_KINK_PAD_RATIO = 0.15;

/**
 * Is `x` far enough from every already-placed label to carry its own text?
 *
 * Labels here are centred on a price, and a wide domain can push two genuinely different prices — a
 * $181.20 breakeven and a $184.52 last close — within a few pixels of each other, where two centred
 * labels render as one unreadable smear. The rule is to DROP the crowded label rather than stagger
 * it, keeping the mark that positions it: nothing is lost, because the rule or tick still marks the
 * position and the figure itself is stated in the rows beside the chart. The caller places labels in
 * priority order and asks this before each one.
 */
export function clearOfPlaced(placed, x, minGap) {
  return placed.every((p) => Math.abs(p - x) >= minGap);
}

function probeSlope(sample, at, direction) {
  const delta = Math.max(Math.abs(at) * 0.01, 1);
  return (sample(at + direction * delta) - sample(at)) / delta;
}

/**
 * @param {{ kinks: readonly number[], breakevens: readonly number[],
 *           sample: (price: number) => number, lastClose: number | null, compact: boolean }} input
 */
export function payoffChartModel({ kinks, breakevens, sample, lastClose, compact }) {
  const width = compact ? 300 : 620;
  const height = compact ? 210 : 250;
  const padLeft = compact ? 48 : 58;
  const padRight = 14;
  const padTop = 26;
  const padBottom = 40;

  const kinkLo = Math.min(...kinks);
  const kinkHi = Math.max(...kinks);
  const kinkSpan = kinkHi - kinkLo;
  const magnitude = (Math.abs(kinkLo) + Math.abs(kinkHi)) / 2;
  // Multi-kink (a real spread): span-relative, with only a small absolute floor to guard a near-zero
  // span. Single-kink (kinkSpan is 0, e.g. a naked call): no span to derive from, so magnitude-relative
  // instead. These two are never combined — that was the defect.
  const basePad =
    kinkSpan > 0
      ? Math.max(kinkSpan * BOUNDED_PAD_RATIO, 1)
      : Math.max(magnitude * SINGLE_KINK_PAD_RATIO, 1);

  const loSideFlatAtKink = Math.abs(probeSlope(sample, kinkLo, -1)) <= SLOPE_EPSILON;
  const hiSideUnbounded = Math.abs(probeSlope(sample, kinkHi, 1)) > SLOPE_EPSILON;

  const padHi = hiSideUnbounded ? basePad * UNBOUNDED_PAD_MULTIPLIER : basePad;

  // Low side: flat past the kink pads modestly, same as a bounded high side. Still sloping means it
  // hasn't capped yet but WILL, at the real price floor — extend all the way to $0 rather than
  // guessing at a multiple, since $0 is not a guess, it is the actual edge of the domain.
  let domainLo = loSideFlatAtKink ? Math.max(0, kinkLo - basePad) : 0;
  let domainHi = kinkHi + padHi;

  // The domain spans every kink plus the last close — a close outside the kink-derived domain
  // extends it with the same bounded-style margin, rather than clipping the mark to the frame edge.
  if (lastClose !== null) {
    if (lastClose < domainLo) domainLo = Math.max(0, lastClose - basePad);
    if (lastClose > domainHi) domainHi = lastClose + basePad;
  }

  const x = (price) =>
    padLeft + ((width - padLeft - padRight) * (price - domainLo)) / (domainHi - domainLo);

  const corners = [domainLo, ...kinks, domainHi].map((price) => ({ price, value: sample(price) }));

  const values = corners.map((c) => c.value);
  const valueLo = Math.min(...values, 0);
  const valueHi = Math.max(...values, 0);
  const valuePad = Math.max((valueHi - valueLo) * 0.12, 1);
  const yLo = valueLo - valuePad;
  const yHi = valueHi + valuePad;
  const y = (value) => padTop + ((height - padTop - padBottom) * (yHi - value)) / (yHi - yLo);

  return {
    width,
    height,
    padLeft,
    padRight,
    padTop,
    padBottom,
    domainLo,
    domainHi,
    corners,
    // Breakeven marks ride the $0 line at their own price — never re-derived geometrically.
    breakevenMarks: breakevens.map((price) => ({ price, x: x(price) })),
    lastCloseX: lastClose !== null ? x(lastClose) : undefined,
    zeroY: y(0),
    valueLo: yLo,
    valueHi: yHi,
    loSideFlatAtKink,
    hiSideUnbounded,
    x,
    y,
  };
}
