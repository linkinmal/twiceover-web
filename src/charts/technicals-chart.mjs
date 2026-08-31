/**
 * technicals-chart — the §4b price line's scale math, ported from the product app
 * (stock-analyst-platform#2992, site-prelaunch.md v2.31 §2; build reference
 * `ai-team/design/assets/site-charts-hero-2026-08-30.html` §6).
 *
 * **Upstream:** `twiceover-app` `apps/web/src/read/technicals-chart.ts` at `origin/main` 33598666.
 * Same translation discipline and the same reasons as `outlook-chart.mjs` / `payoff-chart.mjs`
 * beside it: `.mjs` because this repo has no type-check step, and the upstream test suite ported
 * with it as the drift guard.
 *
 * **Why the real algorithm and not the mockup's.** §6 of the build reference draws this chart with a
 * hardcoded `lo=150, hi=205` domain and three month labels spaced at fixed fractions — a picture of
 * the output, not the rule that produces it. Both of §4b's load-bearing claims are arithmetic and
 * are stated there as forbidden STATES:
 *
 *  - *"The y-domain expanded to admit a level that drops the closes' own range below 60% of plot
 *    height."* A proportion is proven by measuring it, so admission runs here, where the ported test
 *    asserts the share directly with no hardcoded admit/reject list.
 *  - *"A true continuous (gapped) time axis."* Sessions are equally spaced and only the LABELS are
 *    dated — a calendar-proportional x would gap every weekend and turn a 90-session line into a
 *    dashed one.
 *
 * Porting the mockup's literals instead would reproduce today's picture and silently lose both rules
 * the moment the fixture moves.
 *
 * **Dates come from the series, never reconstructed.** Each point carries its own date string and the
 * month ticks are composed from it. Counting back from a page-level "as of" would need a trading
 * calendar this site does not ship, and one missed holiday shifts every label.
 *
 * **No account-derived mark of any kind** — no cost basis, no P&L shading, nothing keyed to a
 * position. The upstream component takes no position data at all, and neither does this: the panel is
 * the public free read, cached across users, so one personalised mark forfeits both the cache and the
 * privacy boundary. §6 of the build reference draws an `avg 121.40` cost line; it is deliberately not
 * ported (#2992's hard constraint).
 */

/** The four candidate level names — the same strings the four rows beneath the chart print, so a rule
 *  and its row can never name the same fact differently. Upstream `technicals-labels.ts`. */
export const MA50_LABEL = "50-DMA";
export const MA200_LABEL = "200-DMA";
export const RANGE_52W_HIGH_LABEL = "52-week high";
export const RANGE_52W_LOW_LABEL = "52-week low";

/**
 * §4b's admission floor: an admitted level may expand the y-domain only while the closes' own range
 * still owns at least this share of the plot height.
 *
 * This threshold REPLACED a ban (v3.46 excluded the 52-week bounds outright; v3.48 reversed it): the
 * real constraint was never the level's window but the scale, so it self-resolves per read.
 */
export const MIN_CLOSES_SHARE = 0.6;

/** Fewest points that can be a line rather than a dot. */
export const MIN_POINTS = 2;

/** §4b: "month-boundary ticks only, 3–4 ticks, thinning to <=3 at 375px". */
const MAX_TICKS = 4;
const MAX_TICKS_COMPACT = 3;

/** Composed from the date string's own month index — never a `Date`, which would introduce a timezone
 *  the string does not have. */
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Upstream `isFiniteNumericString`: an empty string is NOT numeric, though `Number('')` is 0 and
 *  `Number.isFinite(0)` is true — a presence-only check would admit a level rule with a blank value,
 *  itself a §4b forbidden state. */
export function isFiniteNumericString(v) {
  return v !== "" && Number.isFinite(Number(v));
}

/** The four candidates, all already on the four rows — no separate level source, so the chart cannot
 *  show a level the rows do not. Each bound of `range52w` is checked on its OWN value: the two are
 *  independent strings and one can be malformed while the other is fine. */
function candidatesOf(t) {
  const out = [];
  if (t.range52w && isFiniteNumericString(t.range52w.high)) {
    out.push({ name: RANGE_52W_HIGH_LABEL, value: t.range52w.high });
  }
  if (t.ma50 && isFiniteNumericString(t.ma50)) out.push({ name: MA50_LABEL, value: t.ma50 });
  if (t.ma200 && isFiniteNumericString(t.ma200)) out.push({ name: MA200_LABEL, value: t.ma200 });
  if (t.range52w && isFiniteNumericString(t.range52w.low)) {
    out.push({ name: RANGE_52W_LOW_LABEL, value: t.range52w.low });
  }
  return out;
}

/** Keep at most `max` ticks, evenly sampled and in chronological order — thinning DROPS ticks, it
 *  never reorders or re-spaces them (the sessions behind them do not move). */
function thin(ticks, max) {
  if (ticks.length <= max) return ticks;
  const step = (ticks.length - 1) / (max - 1);
  return Array.from({ length: max }, (_unused, i) => ticks[Math.round(i * step)]);
}

/**
 * @param {{ series: readonly {close: string, date: string}[],
 *           technicals: { ma50?: string|null, ma200?: string|null,
 *                         range52w?: {high: string, low: string}|null },
 *           compact: boolean }} input
 * @returns {object|null} the model, or `null` when there are too few points to be a line — §4b's
 *   two-states rule: the caller renders the chart or renders nothing. There is no dashed state, no
 *   skeleton, no "unavailable" line.
 */
export function priceLineChartModel({ series, technicals, compact }) {
  if (series.length < MIN_POINTS) return null;

  const width = compact ? 300 : 620;
  const height = compact ? 116 : 150;
  const padLeft = 4;
  // Room for the right-edge level labels — they sit outside the plot, never over the line.
  const padRight = compact ? 62 : 78;
  const padTop = 14;
  const padBottom = compact ? 18 : 20;

  const closes = series.map((p) => Number(p.close));
  const closesMin = Math.min(...closes);
  const closesMax = Math.max(...closes);
  const closesRange = closesMax - closesMin;
  const price = closes[closes.length - 1];

  // ── Level admission (§4b v3.48) ────────────────────────────────────────────────────────────────
  // Nearest-to-price first; admit a candidate only while the closes keep >=60% of the domain. A
  // breaching candidate is SKIPPED and the loop CONTINUES — it does not stop, because a nearer
  // expensive candidate must not hide a further cheap one behind it.
  //
  // A flat series (`closesRange === 0`) admits nothing: its share is zero against any widened domain,
  // so every candidate breaches. That is the honest outcome rather than a special case — one level
  // would own the entire plot and the "line" would read as its baseline.
  let domainMin = closesMin;
  let domainMax = closesMax;
  const levels = [];
  const byNearest = [...candidatesOf(technicals)].sort(
    (a, b) => Math.abs(Number(a.value) - price) - Math.abs(Number(b.value) - price),
  );
  for (const candidate of byNearest) {
    const v = Number(candidate.value);
    const nextMin = Math.min(domainMin, v);
    const nextMax = Math.max(domainMax, v);
    const nextSpan = nextMax - nextMin;
    if (nextSpan === 0 || closesRange / nextSpan < MIN_CLOSES_SHARE) continue;
    domainMin = nextMin;
    domainMax = nextMax;
    levels.push({ name: candidate.name, value: candidate.value, y: 0 });
  }

  // The domain is final only after admission, so every y — the line's and the rules' — is mapped once
  // against the same scale. A level positioned before the last admission would sit at a stale y.
  const span = domainMax - domainMin;
  const plotTop = padTop;
  const plotHeight = height - padTop - padBottom;
  const y = (v) =>
    span === 0 ? plotTop + plotHeight / 2 : plotTop + plotHeight * (1 - (v - domainMin) / span);

  const plotLeft = padLeft;
  const plotWidth = width - padLeft - padRight;
  // Equal spacing by INDEX, never by calendar distance — §4b's continuous-axis forbidden state.
  const x = (i) => plotLeft + (plotWidth * i) / (series.length - 1);

  const points = series.map((p, i) => ({ x: x(i), y: y(Number(p.close)) }));

  // ── The dated axis (§4b v3.47) ─────────────────────────────────────────────────────────────────
  // A tick sits at the FIRST session of a month, and its label is composed here from that session's
  // own date. No boundary crossed -> no tick, never a guessed one.
  const boundaries = [];
  for (let i = 1; i < series.length; i++) {
    const month = series[i].date.slice(0, 7);
    if (month !== series[i - 1].date.slice(0, 7)) {
      const label = MONTHS[Number(series[i].date.slice(5, 7)) - 1];
      if (label) boundaries.push({ label, x: x(i) });
    }
  }

  return {
    width,
    height,
    padLeft,
    padRight,
    padTop,
    padBottom,
    points,
    levels: levels.map((l) => ({ ...l, y: y(Number(l.value)) })),
    ticks: thin(boundaries, compact ? MAX_TICKS_COMPACT : MAX_TICKS),
    /** The only point that carries a figure (§4b: "no figure on any other point"). */
    last: { ...points[points.length - 1], value: series[series.length - 1].close },
    /** The closes' share of the y-domain, exposed so the 60% rule is assertable rather than implied. */
    closesShare: span === 0 ? 1 : closesRange / span,
  };
}
