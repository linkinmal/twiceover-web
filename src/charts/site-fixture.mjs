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

/** The Outlook band's caption above the plot — the chart's one figure. Composed here so the price can
 *  never disagree with `SPOT`. The word is `price`, never `last close` (read-components-outlook.md
 *  v3.69, ADR 0992, founder-directed): one fixed string, true before and after intraday spot ships. */
export const PRICE_CAPTION = `price ${money(SPOT)} · ${LAST_CLOSE_DATE}`;

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

/**
 * The 90-session close series.
 *
 * **The closes are the build reference's own generator, reproduced exactly** (§6 of
 * `site-charts-hero-2026-08-30.html`, where it is marked "the artifact's own 90-session generator,
 * verbatim"). Deterministic — a `sin`-based hash, not `Math.random()` — so the page renders the same
 * line on every build, and the ported chart can be tested against fixed numbers.
 *
 * **The dates are NOT from the artifact**, which fakes three evenly spaced month labels rather than
 * dating its sessions. The ported model composes ticks from each session's own date, so the series
 * needs real ones: consecutive weekdays counted back from the last close. Weekends are skipped,
 * holidays are not — this is illustrative fixture data, labelled as such on the page, and a real
 * trading calendar is exactly the thing the product will not guess at. What matters for the port is
 * that month boundaries fall where the dates actually cross a month, which they do.
 */
export const TECHNICALS_SERIES = (() => {
  const n = 90;
  const hash = (i) => {
    const x = Math.sin(i * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  const closes = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const trend = 160 + 32 * t * t - 10 * Math.sin(t * Math.PI * 1.6);
    let v = trend + (hash(i) - 0.5) * 8;
    if (v > 197) v = 197 - hash(i) * 2;
    if (v < 157) v = 157 + hash(i) * 2;
    closes.push(v);
  }
  // The line ends on the page's own spot, with one session of easing into it so the last step is not
  // a visible jump off the generated trend.
  closes[n - 1] = SPOT;
  closes[n - 2] = (closes[n - 2] + SPOT) / 2;

  // Weekdays back from the last close (2026-08-28), then reversed into chronological order. Built in
  // UTC throughout — a local-timezone Date would shift a session across a month boundary and move a
  // tick, which is the one thing these dates are load-bearing for.
  const dates = [];
  const cursor = new Date(Date.UTC(2026, 7, 28));
  while (dates.length < n) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  dates.reverse();

  return closes.map((close, i) => ({ date: dates[i], close: close.toFixed(2) }));
})();

/**
 * The Outlook chart's recent price history — the last 21 sessions of the SAME series the Technicals
 * chart draws (site-prelaunch.md v2.44, stock-analyst-platform#3959; read-components-outlook.md
 * v3.68). Jul 31 – Aug 28, ending on the close the Outlook opens from. A slice, never a second
 * array: Growth's separate synthetic 21-close series (#3938/#3940) went unused by founder direction,
 * because it would draw a different path for the exact dates this page's Technicals chart already
 * shows. Adds no fixture number of its own.
 */
export const OUTLOOK_HISTORY = TECHNICALS_SERIES.slice(-21);

/** Mean of the last `n` closes, as the 2-dp string the chart's level candidates take. */
function trailingAverage(series, n) {
  const closes = series.slice(-n).map((s) => Number(s.close));
  return (closes.reduce((a, b) => a + b, 0) / n).toFixed(2);
}

/* ── Technicals & levels (#2992) ──────────────────────────────────────────────────────────────────
   The four figures the `tech` band card already prints, restated here as the shape the ported
   `priceLineChartModel` takes, so the chart and the rows beneath it can never disagree: they read
   from ONE object. Values are the site's own fixture (site-prelaunch.md v2.31's correction — #2987's
   original body named $147.20, which was the chart artifact's example ticker). */
export const TECHNICALS = {
  // DERIVED, not typed (stock-analyst-platform#3829, the PM's #3935 check): the stated "175.43" was
  // authored beside the series with nothing binding them, and the series' own last 50 closes average
  // 178.70. A 50-DMA the chart's own line contradicts is the drift this module exists to prevent.
  // (The 200-DMA stays stated: a 90-session series cannot compute it.)
  ma50: trailingAverage(TECHNICALS_SERIES, 50),
  ma200: "168.90",
  range52w: { high: "198.00", low: "156.00" },
  rsi: "64",
};

/** The four rows, composed from the same object the chart's level candidates come from. The `range`
 *  row prints both bounds where the chart draws them as two separate candidate levels. */
const trimCents = (v) => v.replace(/\.00$/, "");
export const TECHNICALS_ROWS = [
  { label: "50-DMA", value: money(Number(TECHNICALS.ma50)) },
  { label: "200-DMA", value: money(Number(TECHNICALS.ma200)) },
  { label: "RSI", value: TECHNICALS.rsi },
  {
    // Whole dollars, as v2.31's fixture states this row ("52-week range $156–$198") — the same
    // trailing-.00 trim the Outlook card applies to its horizon prices. The CHART draws these two
    // bounds at their full 2-dp precision, which is the level rule's own value; the row is the
    // range as the spec words it. Both read from TECHNICALS, so they cannot disagree on the number.
    label: "52-week range",
    value: `${trimCents(money(Number(TECHNICALS.range52w.low)))}–${trimCents(money(Number(TECHNICALS.range52w.high)))}`,
  },
];


/**
 * The Fundamentals band card (homepage v3.4, stock-analyst-platform#3829). The trailing P/E is
 * DERIVED from the card's own EPS and the page's price ($184.52 / $8.32 = 22.18), per the PM's #3935
 * check — it replaces the retired "Next earnings · Aug 27" row. Revenue and market cap are the
 * artifact's stated fixture figures.
 */
export const FUNDAMENTALS = {
  revenue: "$88.5B",
  eps: 8.32,
  marketCap: "$4.5T",
  peTrailing: `${(SPOT / 8.32).toFixed(1)}×`,
};

/**
 * Your Portfolio, as the homepage draws it (homepage v3.4, stock-analyst-platform#3829): the hero
 * deck's Portfolio card, the Portfolio section's list, and the phone. One book, so the three cannot
 * disagree. Ordered by rule state — reached first — as the product orders it.
 *
 * NVDA is structure 1 of the page's canonical spread (`SPREAD` above): its percent is DERIVED from
 * that structure's debit, never typed. The other three rows are the artifact's stated illustrative
 * positions.
 *
 * PENDING stock-analyst-platform#3963: the account line's Open P/L (+$1,289, as the artifact states
 * it) does not equal the four rows' sum (−$441), and the Designer is ruling which one moves.
 */
export const NVDA_SPREAD_PNL = 612;

export const PORTFOLIO = {
  broker: "Schwab",
  syncedAt: "09:41 ET",
  netLiq: 98340,
  openPnl: 1289,
  rows: [
    { ticker: "SPY", structure: "Put debit spread", rule: { state: "reached", text: "Expiry 21 days · reached" }, pnl: -462, pct: -22.0 },
    { ticker: "NVDA", structure: "Bull call spread", rule: { state: "approaching", text: "Option target 60% · approaching" }, pnl: NVDA_SPREAD_PNL, pct: Number(((NVDA_SPREAD_PNL / SPREAD.netDebit) * 100).toFixed(1)) },
    { ticker: "TSLA", structure: "Cash-secured put", rule: { state: "not-met", text: "Option target 60% · not met" }, pnl: 215, pct: 31.4 },
    { ticker: "AMD", structure: "Shares", rule: { state: "not-met", text: "Stock max loss −15% · not met" }, pnl: -806, pct: -6.3 },
  ],
};

/** The rule-state glyph the product draws: reached ●, approaching ◐, not met ○. */
export const RULE_MARK = { reached: "●", approaching: "◐", "not-met": "○" };

/** `+$612` / `−$462` — a true minus sign, thousands grouped, whole dollars. */
export function signedMoney(v) {
  return `${v < 0 ? "−" : "+"}$${Math.abs(v).toLocaleString("en-US")}`;
}

/** `+49.4%` / `−22.0%`, one decimal, true minus sign. */
export function signedPct(v) {
  return `${v < 0 ? "−" : "+"}${Math.abs(v).toFixed(1)}%`;
}

/**
 * The thirteen band cards, NVDA edition (homepage v3.4, stock-analyst-platform#3829; build reference
 * `homepage-3818-v3-2026-09-23.html`) — as blocks in the vocabulary `AnalysisMini.astro` renders, the
 * same one the explainer's EXMP cards use (`exmp-fixture.mjs`), so one renderer draws both.
 * Every figure here is read from the objects above, or is the artifact's stated illustrative figure.
 *
 * PENDING stock-analyst-platform#3963 item 4: the five cards v3.4 adds (earnings, earnings-history,
 * insiders, options, flow) each draw a small chart in the artifact, which states only the chart's
 * pixels. They state their figures in words until the Designer supplies the series behind them.
 */
const tech = Object.fromEntries(TECHNICALS_ROWS.map((r) => [r.label, r.value]));
const trimWhole = (v) => money(v).replace(/\.00$/, "");

export const BAND_CARDS = {
  fundamentals: [
    { kv: [["Revenue", FUNDAMENTALS.revenue], ["EPS", money(FUNDAMENTALS.eps)], ["Mkt cap", FUNDAMENTALS.marketCap]] },
    { row: ["P/E, trailing 12 months", FUNDAMENTALS.peTrailing] },
  ],
  earnings: [{ row: ["Implied move", "±7.4%"] }, { sub: "through the Nov 20 expiry" }],
  "earnings-history": [{ row: ["Average move", "±3.5%"] }, { row: ["Average implied", "±6.9%"] }],
  insiders: [{ row: ["Net selling", "−$177.6M"] }, { sub: "10 of 12 sells under a 10b5-1 plan" }],
  technicals: [
    // The chart goes ABOVE the levels (#2992), and the grid reads the same object the chart's level
    // candidates come from, so the two cannot disagree.
    { chart: "technicals" },
    { kv2: [["50-DMA", tech["50-DMA"]], ["200-DMA", tech["200-DMA"]], ["RSI", tech["RSI"]], ["52-week", tech["52-week range"]]] },
  ],
  options: [{ row: ["Short interest", "1.1% of shares"] }, { sub: "settled Aug 14" }],
  flow: [{ row: ["Premium", "at least $761M"] }, { sub: "in large trades, last five sessions" }],
  sector: [
    { narr: "Technology — sector strength increasing; valuation premium compressing." },
    { sub: "unit narrative · the sector, not the stock" },
  ],
  peers: [
    // PENDING stock-analyst-platform#3963 item 6: 32.1 disagrees with Fundamentals' derived 22.2×.
    { chips: [["P/E 32.1", "vs 28.5"], ["3M +8.2%", "vs +4.1%"]] },
    { row: ["MSFT", "P/E 28.3 · +5.2%"] },
    { sub: "open table · subject vs peer median" },
  ],
  news: [
    { news: ["Earnings", "Aug 27", "beats Q2 estimates", "Reuters"] },
    { sub: "why it matters: could signal AI demand continuing" },
    { row: ["Next monthly expiry", "Sep 18"] },
  ],
  voices: [
    { sub: "via X" },
    { post: ["Aug 13", "constructive on the AI chip cycle into year-end; capacity, not demand, is the constraint."] },
    { sub: "Each post named and linked in a real analysis." },
  ],
  macro: [{ row: ["Tactical", "Fed on hold"] }, { row: ["Strategic", "Soft landing"] }, { mra: 0.35 }],
  outlook: [
    {
      okh: HERO_OUTLOOK.horizons.map((h) => [
        HORIZON_CARDS.find((c) => c.key === h.horizon).label,
        trimWhole(h.price),
        { near: "while the recent range holds", mid: "absent a trend change", far: "hinges on the macro regime" }[h.horizon],
      ]),
    },
    { sub: "Our projection, not a guarantee — you decide." },
  ],
};

/**
 * The macro card's risk-appetite axis position, in percent along the rail: net −1 → 0%, 0 → 50%,
 * +1 → 100%. The marker and the net value both sit here — one number, as in the real component.
 */
export function riskAxisLeft(net) {
  return ((net + 1) / 2) * 100;
}
