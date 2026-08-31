/**
 * The page's ONE canonical illustrative fixture — the fixed NVDA figures every chart, card and row on
 * twiceover.io draws from (site-prelaunch.md §2; `ai-team/design/read-held-position.md`'s canonical
 * fixture). Fixed, never live: nothing on this site fetches a quote, and a marketing page that
 * displayed real figures would be making a claim it cannot keep fresh.
 *
 * Single source on purpose. The figures have now been corrected twice in three days — first from the
 * chart artifact's own `$147.20` example ticker to the page's `$184.52`, then to the dip-shaped
 * projections below — and both passes left stale copies standing beside corrected ones, because the
 * numbers lived in the markup. Anything that states one of these figures imports it from here.
 */

/** The read's own date — a Monday. Pinned, so the axis captions are stable across builds. */
export const AS_OF = "2026-08-31T15:31:00Z";

/** The same instant as `AS_OF`, in the exchange's clock — 15:31 UTC is 11:31 ET. Stated in the
 *  Outlook band's header, so it lives beside the value it has to agree with. */
export const AS_OF_CLOCK = "11:31 ET";

/** The price of record. */
export const SPOT = 184.52;

/**
 * The last close's date, stated in the hero caption beside the price.
 *
 * **Deliberate, flagged deviation from the build reference.** `site-charts-hero-2026-08-30.html`
 * writes this caption as `last close $184.52 · AUG 29` in all four places. 2026-08-29 is a SATURDAY;
 * the read's own date is Monday 2026-08-31, so the prior trading day is Friday AUG 28. The artifact's
 * intent is plainly "the last close before this read" — AUG 28 realizes it and AUG 29 contradicts it,
 * by asserting a US equity close on a weekend on a page whose whole claim is that its figures come
 * from a data pipeline. Raised on stock-analyst-platform#2987 for the artifact to be corrected; if the
 * Designer rules otherwise this is the one line to change back.
 *
 * This is also exactly the case the chart's own geometry exists to keep straight: the origin sits at
 * day 0 from `AS_OF`, while the reference line's PRICE is the prior trading day's.
 */
export const LAST_CLOSE_DATE = "AUG 28";

/**
 * The Outlook's three horizon projections — **dip-then-recover**, route (b), founder-decided
 * 2026-08-31 (#2987, site-prelaunch.md v2.32). Replaces the published 184 / 195 / 210, which climbed
 * monotonically: a clean up-and-to-the-right hero line reads as a promise on a page whose claim is
 * "Depth, never a verdict". The shape is the reason these three integers exist, and
 * `outlook-chart.test.mjs` asserts it on the geometry so a later edit cannot flatten it back out.
 */
export const HERO_OUTLOOK = {
  spot: SPOT,
  asOf: AS_OF,
  horizons: [
    { horizon: "near", price: 178 },
    { horizon: "mid", price: 192 },
    { horizon: "far", price: 205 },
  ],
};

/** The three horizon cards under the chart — the window label the app itself renders. */
export const HORIZON_CARDS = [
  { key: "near", label: "NEAR · 2 WEEKS" },
  { key: "mid", label: "MID · 3 MONTHS" },
  { key: "far", label: "FAR · 6 MONTHS" },
];

/** `$184.52`, the form every figure on the page is written in. */
export function money(v) {
  return `$${v.toFixed(2)}`;
}

/** The hero's caption above the plot — the chart's one figure, and the only place the site states it.
 *  Composed here so the price can never disagree with `SPOT`. */
export const LAST_CLOSE_CAPTION = `last close ${money(SPOT)} · ${LAST_CLOSE_DATE}`;

/**
 * Structure 1 of the page's held position — a **2× Jul 17 175C/190C bull call spread**, the exact
 * structure `ai-team/design/read-held-position.md` line 37 makes canonical: "+2 Jul 17 175C / −2 Jul
 * 17 190C, net debit $6.20/spread ($1,240 total) … max profit $1,760, max loss $1,240, breakeven
 * $181.20". Not the chart artifact's covered call — a covered-call shape here would contradict the
 * row directly above it.
 *
 * `sample` is the whole-position P&L at expiry, in dollars, and is the ONLY source of a P&L figure
 * on the chart: nothing is transcribed. Every published figure falls out of it —
 * `sample(175) = −1240`, `sample(181.20) = 0`, `sample(190) = +1760` — which is what
 * `payoff-chart.test.mjs` asserts rather than trusting the three numbers to have been typed right.
 */
export const SPREAD = {
  lowerStrike: 175,
  upperStrike: 190,
  contracts: 2,
  netDebit: 1240,
  breakeven: 181.2,
  expiry: "Jul 17",
  /** Per-contract multiplier — 100 shares, the standard US equity option. */
  multiplier: 100,
};

/** Whole-position profit/loss at expiry, in dollars, at a given share price. */
export function spreadPnlAt(price) {
  const { lowerStrike, upperStrike, contracts, multiplier, netDebit } = SPREAD;
  const intrinsic = Math.min(Math.max(price - lowerStrike, 0), upperStrike - lowerStrike);
  return intrinsic * multiplier * contracts - netDebit;
}

/** The payoff chart's input, as the ported model takes it. */
export const SPREAD_PAYOFF = {
  kinks: [SPREAD.lowerStrike, SPREAD.upperStrike],
  breakevens: [SPREAD.breakeven],
  sample: spreadPnlAt,
  lastClose: SPOT,
};

