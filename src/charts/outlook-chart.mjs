/**
 * outlook-chart — the Outlook projection path chart's scale math, ported from the product app so the
 * public site draws the real object rather than an impression of it (stock-analyst-platform#2987,
 * site-prelaunch.md §2 Hero; build reference `ai-team/design/assets/site-charts-hero-2026-08-30.html`
 * §3, Option A).
 *
 * **Upstream:** `twiceover-app` `apps/web/src/read/outlook-chart.ts` at `origin/main` 5d72e2c9, whose
 * own geometry is the signed `chart-forward-read-v13-2026-08-29.html` artifact's, literal: viewBox
 * 620×190 desktop / 300×150 compact, pads 12/12/22/34, points inset into the 0.06–0.94 band, and the
 * value domain padded by 0.18 of the plotted range (the app's deliberate generalization of the
 * artifact's scale-dependent ±6 literal).
 *
 * **Why a module and not markup.** The chart's honesty claim is arithmetic — horizon points map to the
 * x axis by REAL calendar distance, so two weeks occupies its real 7.7% of the six-month span and not
 * a third of it. A property stated as a proportion is proven by measuring the proportion, which is why
 * `outlook-chart.test.mjs` (ported alongside this file from the upstream suite) asserts 14/182
 * directly. Those ported tests are also the port's drift guard: this file is a hand-translation of TS
 * into the repo's own `.mjs`, and a transcription slip in the math fails a test rather than shipping.
 *
 * **Why `.mjs` and not `.ts`.** This repo has no `tsconfig.json`, no `typescript` dependency and no
 * type-check step in CI; every script, test and Worker file here is `.mjs`. A `.ts` island would be
 * un-checked decoration, so the types are dropped and their content moved into the assertions.
 *
 * The site draws one fixed illustrative fixture (`site-fixture.mjs`) — no live figures, ever.
 */

/** Fixed near → mid → far. Never wire or array order. */
export const HORIZON_ORDER = ["near", "mid", "far"];

/** Upstream `@twiceover/scoring-horizons` HORIZON_TRADING_DAYS (ADR 0320's single source). Carried
 *  here so the axis's calendar distances are DERIVED, exactly as the app derives them, rather than
 *  transcribed as 14/91/182 — a transcription cannot fail the proportionality test, a derivation can. */
const HORIZON_TRADING_DAYS = { near: 10, mid: 63, far: 126 };

const LANDING_MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

/** The inset band the points map into — an end label centered on x=1.0 clips the viewBox. */
const BAND_START = 0.06;
const BAND_END = 0.94;
/** Value-domain padding as a fraction of the plotted range, plus a floor as a fraction of the mid
 *  value so an all-identical set cannot divide by zero. */
const DOMAIN_PAD_RATIO = 0.18;
const DOMAIN_PAD_FLOOR_RATIO = 0.01;

/** "2 WEEKS" / "3 MONTHS" / "6 MONTHS" — under 21 trading days renders as weeks, at/above as months. */
function horizonScoredPointLabel(horizon) {
  const tradingDays = HORIZON_TRADING_DAYS[horizon];
  return tradingDays < 21
    ? `${Math.round(tradingDays / 5)} WEEKS`
    : `${Math.round(tradingDays / 21)} MONTHS`;
}

/** Calendar days, never trading days: trading days would put NEAR at 7.9% of the FAR span instead of
 *  the 7.7% the spec states and the signed artifact measures. A month is 365/12 floored, which
 *  reproduces the artifact's own literals exactly (near 14 / mid 91 / far 182). */
export function horizonCalendarDays(horizon) {
  const [count, unit] = horizonScoredPointLabel(horizon).split(" ");
  const n = Number(count);
  return unit === "WEEKS" ? n * 7 : Math.floor((n * 365) / 12);
}

/** "2 WKS" / "3 MOS" / "6 MOS" — the axis's abbreviated form of the card's own label, from the same
 *  source, so the two can never name different windows. */
function axisTick(horizon) {
  const days = horizonCalendarDays(horizon);
  return days < 28 ? `${Math.round(days / 7)} WKS` : `${Math.round(days / 30.4)} MOS`;
}

function horizonLandingDate(asOf, horizon) {
  const d = new Date(asOf);
  d.setUTCDate(d.getUTCDate() + horizonCalendarDays(horizon));
  return d;
}

export function formatLandingDate(d) {
  return `${LANDING_MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function money(v) {
  return `$${v.toFixed(2)}`;
}

/**
 * @param {{ spot: number, asOf: string, horizons: ReadonlyArray<{horizon: string, price: number|null}>,
 *           compact: boolean }} input
 */
export function projectionChartModel({ spot, asOf, horizons, compact }) {
  const width = compact ? 300 : 620;
  const height = compact ? 150 : 190;
  // Flat 12 at both breakpoints. The compact widening to 16 existed only to clear a TODAY caption
  // right-aligned off the rule's left side; that caption centers on the rule now, which needs half
  // its width per side, and the widening was retired with it (read-components.md §7 v3.54).
  const padLeft = 12;
  const padRight = 12;
  const padTop = 22;
  const padBottom = 34;

  const byHorizon = new Map(horizons.map((h) => [h.horizon, h.price]));

  // The axis span is the FAR window, always — never the furthest surviving horizon. A dark MID must
  // not re-space NEAR and FAR, and a dark FAR must not stretch MID out to the right edge.
  const spanDays = horizonCalendarDays("far");

  const plotted = [spot, ...HORIZON_ORDER.map((h) => byHorizon.get(h)).filter((p) => p != null)];
  const min = Math.min(...plotted);
  const max = Math.max(...plotted);
  const pad = Math.max(
    (max - min) * DOMAIN_PAD_RATIO,
    ((max + min) / 2) * DOMAIN_PAD_FLOOR_RATIO,
    Number.EPSILON,
  );
  const lo = min - pad;
  const hi = max + pad;

  const x = (days) =>
    padLeft + (width - padLeft - padRight) * (BAND_START + (BAND_END - BAND_START) * (days / spanDays));
  const y = (v) => padTop + (height - padTop - padBottom) * (1 - (v - lo) / (hi - lo));

  // The origin's date is the READ's (`asOf`), never the last close's — they genuinely differ on a
  // weekend or holiday read, where the origin sits at day 0 while the reference line's PRICE is the
  // prior trading day's.
  const origin = {
    key: "origin",
    x: x(0),
    y: y(spot),
    axisLabel: { tick: "TODAY", sub: formatLandingDate(new Date(asOf)) },
  };

  // A horizon MISSING from the input entirely (never even null-priced) is treated identically to a
  // present-but-null one: both break the chain, both get a placeholder mark at their real calendar
  // position.
  const points = [];
  const darkMarks = [];
  for (const horizon of HORIZON_ORDER) {
    const price = byHorizon.get(horizon) ?? null;
    const days = horizonCalendarDays(horizon);
    if (price === null) {
      darkMarks.push({ horizon, x: x(days) });
      continue;
    }
    points.push({
      key: horizon,
      x: x(days),
      y: y(price),
      axisLabel: {
        tick: axisTick(horizon),
        sub: formatLandingDate(horizonLandingDate(asOf, horizon)),
      },
    });
  }

  // Segments join CONSECUTIVE surviving points only. A dark horizon breaks the chain rather than
  // being bridged over: a line drawn straight from NEAR to FAR across a dark MID would assert a path
  // through a projection the box just said it doesn't have.
  // A dark horizon leaves a HOLE in this chain rather than being skipped — `points` never contains
  // one, so the lookup yields `undefined` and the pair test below drops both segments that touch it.
  const chain = [origin, ...HORIZON_ORDER.map((h) => points.find((p) => p.key === h))];
  const segments = [];
  for (let i = 0; i < chain.length - 1; i++) {
    const from = chain[i];
    const to = chain[i + 1];
    if (from && to) segments.push({ from, to });
  }

  return {
    width,
    height,
    padLeft,
    padRight,
    padTop,
    padBottom,
    origin,
    points,
    segments,
    // The label the site renders as a CAPTION ABOVE THE PLOT, never as SVG text inside it — see
    // `OutlookPathChart.astro`. The model states the figure; placement is the component's.
    spotLine: { y: y(spot), label: `last close ${money(spot)}` },
    darkMarks,
    pointFor: (horizon) => points.find((p) => p.key === horizon),
  };
}
