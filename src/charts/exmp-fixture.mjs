/**
 * The explainer pages' one fixture (stock-analyst-platform#3829; ADR 0990/0993, build reference
 * `ai-team/design/assets/explainer-pages-3818-2026-09-24.html` v1.1). The made-up EXMP ticker family —
 * EXMP, EXMB, EXMC, EXMF, EXMT, EXMQ, EXMZ — none a real listing (the Designer checked all seven
 * against the app's 9,848 real symbols).
 *
 * The homepage has `site-fixture.mjs` (NVDA); these pages have this, and the two never mix. The rule
 * is the same one: every figure a page states is either an input here or DERIVED here from inputs,
 * never typed beside the thing that should produce it. The artifact's notes name the figures the
 * build must check ("the build asserts every row's arithmetic"), and `exmp-fixture.test.mjs` does.
 *
 * PENDING stock-analyst-platform#3963 item 4: the artifact bakes its charts as pixels and carries no
 * series behind them. So the Technicals series (from which the 50-DMA must be COMPUTED, per the
 * notes), the earnings-history bars, the insider and large-trade bars and the options cone have no
 * data here yet; the figures they would produce are stated below and marked `stated`.
 */
import { SECTIONS } from "../data/sections.mjs";

/** `$48.30`. */
export const usd = (v) => `$${v.toFixed(2)}`;
/** `$1,662.00` — the Position page's ledger form. */
export const usdLong = (v) => `$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** `+$1,662` / `−$128` — the Portfolio row's form: true minus, whole dollars, grouped. */
export const signedUsd = (v) => `${v < 0 ? "−" : "+"}$${Math.abs(Math.round(v)).toLocaleString("en-US")}`;
/** `+13.3%` / `−24.6%`. */
export const signedPct = (v) => `${v < 0 ? "−" : "+"}${Math.abs(v).toFixed(1)}%`;

// ── Page 1: an EXMP analysis ─────────────────────────────────────────────────────────────────────

/** EXMP's close, and the analysis's as-of (page 1 is "as of Aug 31"). */
export const EXMP_PRICE = 48.3;
export const EXMP_LAST_CLOSE = "AUG 28";
export const EXMP_AS_OF = "2026-08-31T15:31:00Z";
export const EXMP_AS_OF_CLOCK = "11:31 ET";

export const EXMP_FUNDAMENTALS = {
  revenue: "$6.2B",
  eps: 2.18,
  epsLabel: "EPS · FY26",
  marketCap: "$19.6B",
};
/** 22.2× — DERIVED: the price over the card's own EPS (the #3935 lesson). */
export const EXMP_PE = EXMP_PRICE / EXMP_FUNDAMENTALS.eps;

export const EXMP_TECHNICALS = {
  // stated — the notes compute it from the series' last 50 closes; the series is #3963 item 4.
  ma50: 46.78,
  // stated, never derivable: a 90-session series cannot produce a 200-DMA or a 52-week range.
  ma200: 43.6,
  range52w: { low: 39.6, high: 51.8 },
  rsi: "58",
};

/**
 * EXMP's last 21 sessions (Jul 31 – Aug 28), made up: the line the Outlook picture draws up to its
 * TODAY mark. It ends on EXMP_PRICE and stays inside the card's own 52-week range, so the chart and the
 * Technicals numbers cannot disagree (asserted in the test). Not a vendor series, so nothing licensed is
 * drawn on a public page (R8). The homepage draws a slice of its own series for its own made-up stock.
 */
export const EXMP_OUTLOOK_HISTORY = [
  ["2026-07-31", "46.20"], ["2026-08-03", "46.45"], ["2026-08-04", "46.10"], ["2026-08-05", "46.70"],
  ["2026-08-06", "47.15"], ["2026-08-07", "47.40"], ["2026-08-10", "47.05"], ["2026-08-11", "47.60"],
  ["2026-08-12", "48.20"], ["2026-08-13", "48.65"], ["2026-08-14", "49.30"], ["2026-08-17", "49.10"],
  ["2026-08-18", "48.55"], ["2026-08-19", "48.90"], ["2026-08-20", "49.70"], ["2026-08-21", "49.20"],
  ["2026-08-24", "48.45"], ["2026-08-25", "47.95"], ["2026-08-26", "48.40"], ["2026-08-27", "47.90"],
  ["2026-08-28", "48.30"],
].map(([date, close]) => ({ date, close }));

/**
 * The Outlook. Each horizon's price sits INSIDE the move options price in for that horizon — the
 * notes' own check, asserted in the test rather than trusted.
 */
export const EXMP_OUTLOOK = {
  horizons: [
    {
      key: "near",
      label: "NEAR · 2 WEEKS",
      date: "SEP 14",
      price: 46.6,
      impliedMovePct: 7.2,
      note: "A return to $51.80 would break the call.",
    },
    {
      key: "mid",
      label: "MID · 3 MONTHS",
      date: "NOV 30",
      price: 50.25,
      impliedMovePct: 22.0,
      note: "A miss against estimates in the Nov 18 report would break the call.",
    },
    {
      key: "far",
      label: "FAR · 6 MONTHS",
      date: "MAR 1",
      price: 53.65,
      impliedMovePct: 31.8,
      note: "A turn in the macro regime to cautious would break the call.",
    },
  ],
};

/** What the Outlook chart draws for EXMP: the spot, the as-of, the three prices and the month before. */
export const EXMP_OUTLOOK_CHART = {
  outlook: {
    spot: EXMP_PRICE,
    asOf: EXMP_AS_OF,
    horizons: EXMP_OUTLOOK.horizons.map((h) => ({ horizon: h.key, price: h.price })),
  },
  cards: EXMP_OUTLOOK.horizons,
  history: EXMP_OUTLOOK_HISTORY,
};

/**
 * Premium in EXMP's large options trades, in $ millions, over its last five sessions (made up). The
 * Large options trades picture draws them (site-prelaunch v2.54 ruling 3, read-components §4l): calls
 * above the line, puts below. They sum to the flow card's $38M, asserted in the test.
 */
export const EXMP_LARGE_TRADES = [
  { label: "Aug 25", calls: 4.1, puts: 2.0 },
  { label: "Aug 26", calls: 6.3, puts: 3.2 },
  { label: "Aug 27", calls: 2.4, puts: 5.1 },
  { label: "Aug 28", calls: 7.8, puts: 1.9 },
  { label: "today", calls: 3.6, puts: 1.6 },
];

/** twiceover-app's `degradedProjectionLine('far')`, copied exactly (ADR 0993), never paraphrased. */
export const DEGRADED_FAR_LINE = "No far projection right now — it needs inputs that aren't all live.";

/**
 * The thirteen band cards, EXMP edition — the SAME block vocabulary `AnalysisMini.astro` renders for
 * the homepage's NVDA cards, so page 1's pictures are the band's own renderers (ADR 0993).
 */
export const EXMP_BAND_CARDS = {
  fundamentals: [
    { kv: [["Revenue", EXMP_FUNDAMENTALS.revenue], [EXMP_FUNDAMENTALS.epsLabel, usd(EXMP_FUNDAMENTALS.eps)], ["Mkt cap", EXMP_FUNDAMENTALS.marketCap]] },
    { row: ["P/E, trailing 12 months", `${EXMP_PE.toFixed(1)}×`] },
  ],
  earnings: [{ row: ["Implied move", "±7.4%"] }, { sub: "through the Nov 20 expiry" }],
  "earnings-history": [{ row: ["Average move", "±3.5%"] }, { row: ["Average implied", "±6.9%"] }],
  insiders: [{ row: ["Net selling", "−$8.9M"] }, { sub: "10 of 12 sells under a 10b5-1 plan" }],
  technicals: [
    {
      kv2: [
        ["50-DMA", usd(EXMP_TECHNICALS.ma50)],
        ["200-DMA", usd(EXMP_TECHNICALS.ma200)],
        ["RSI", EXMP_TECHNICALS.rsi],
        ["52-week", `${usd(EXMP_TECHNICALS.range52w.low)}–${usd(EXMP_TECHNICALS.range52w.high)}`],
      ],
    },
  ],
  options: [
    { row: ["Put/call, volume", "0.72"] },
    { row: ["Short interest", "3.4% of shares"] },
    { sub: "settled Aug 14 · 2.1 days to cover" },
  ],
  flow: [{ row: ["Premium", "at least $38M"] }, { sub: "in large trades, last five sessions" }],
  sector: [
    { narr: "Technology — sector strength increasing; valuation premium compressing." },
    { sub: "unit narrative · the sector, not the stock" },
  ],
  peers: [
    // The subject's P/E is Fundamentals' own, so the two cards cannot disagree.
    { chips: [[`P/E ${EXMP_PE.toFixed(1)}`, "vs 25.4"], ["3M +6.1%", "vs +3.8%"]] },
    { row: ["EXMQ", "P/E 24.9 · +4.4%"] },
    { row: ["EXMZ", "P/E 27.3 · +2.9%"] },
    { sub: "open table · subject vs peer median" },
  ],
  news: [
    { news: ["Earnings", "Aug 20", "beats Q2 estimates, raises the full-year revenue guide", "Company release"] },
    { news: ["Deal", "Aug 12", "signs a multi-year supply agreement", "Company release"] },
    { news: ["Leadership", "Aug 4", "names a new chief financial officer", "Form 8-K"] },
    { row: ["Next monthly expiry", "Sep 18"] },
  ],
  voices: [
    { post: ["Aug 27", "constructive into year-end; capacity, not demand, is the constraint."] },
    { post: ["Aug 21", "the raised guide matters more than the beat itself."] },
    { post: ["Aug 14", "watching whether margins hold as the new supply deal ramps."] },
    { sub: "Each post named, dated and linked in a real analysis." },
  ],
  macro: [{ macroTiles: ["vix", "treasury-10y"] }],
  outlook: [
    { outlookChart: true },
    { okh: EXMP_OUTLOOK.horizons.map((h) => [h.label, usd(h.price).replace(/\.00$/, "")]) },
  ],
};

// ── Page 2: Your Portfolio ───────────────────────────────────────────────────────────────────────

/** Page 2's sync: 24 days before the Oct 16 expiry. */
export const SYNC = { broker: "Schwab", at: "09:41 ET", date: "2026-09-22" };

const MULT = 100;
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/**
 * The covered call every page-2 picture draws: 300 shares bought at $44.20, three Oct 16 $50 calls
 * sold at $2.40, marked at $0.96. Every figure the page states about it falls out of these inputs.
 */
export const COVERED_CALL = {
  ticker: "EXMP",
  shares: 300,
  shareCost: 44.2,
  shareMark: EXMP_PRICE,
  contracts: 3,
  strike: 50,
  expiry: "Oct 16",
  expiryDate: "2026-10-16",
  credit: 2.4,
  callMark: 0.96,
  openOrder: "GTC buy-to-close 3 Oct 16 50 C @ $0.80, working since Sep 14",
  roll: { to: "Nov 20", netCreditPerContract: 95 },
};

export function coveredCallMath(cc = COVERED_CALL) {
  const creditTotal = cc.credit * cc.contracts * MULT;
  const netDebit = cc.shares * cc.shareCost - creditTotal;
  const sharePnl = cc.shares * (cc.shareMark - cc.shareCost);
  const callPnl = (cc.credit - cc.callMark) * cc.contracts * MULT;
  const openPnl = sharePnl + callPnl;
  const breakeven = cc.shareCost - cc.credit;
  return {
    creditTotal,
    netDebit,
    openPnl,
    openPct: (openPnl / netDebit) * 100,
    maxProfit: cc.shares * (cc.strike - cc.shareCost) + creditTotal,
    maxLoss: netDebit,
    breakeven,
    /** Whole-position P&L at expiry at share price `p` — the payoff chart's only source. */
    pnlAt: (p) => cc.shares * (Math.min(p, cc.strike) - cc.shareCost) + creditTotal,
    dte: daysBetween(SYNC.date, cc.expiryDate),
    creditCapturedPct: ((cc.credit - cc.callMark) / cc.credit) * 100,
    stockReturnPct: ((cc.shareMark - cc.shareCost) / cc.shareCost) * 100,
    close: { cost: cc.callMark * cc.contracts * MULT, locks: callPnl },
    reducePerContract: (cc.credit - cc.callMark) * MULT,
    rolledBreakeven: breakeven - cc.roll.netCreditPerContract / MULT,
  };
}

/**
 * The account's five rows. Each row's P/L and percent are DERIVED from its cost basis and mark; the
 * artifact states only the P/L and percent, so the four non-EXMP rows' open prices and marks are
 * back-solved from those two figures — exactly, not approximately: each reproduces the stated P/L to
 * the dollar and the percent to its one decimal (asserted in the test). The
 * header's Open P/L is DERIVED as their sum (the defect #3963 item 1 found on the homepage is
 * exactly a header typed beside rows that do not add up to it).
 */
const cc = coveredCallMath();
export const EXMP_PORTFOLIO = {
  netLiq: 86420,
  rows: [
    {
      ticker: "EXMP",
      structure: "Covered call",
      legs: "300 sh · −3 Oct 16 50 C",
      basis: cc.netDebit,
      pnl: cc.openPnl,
      rule: { state: "reached", text: "Option target 60% · reached" },
      dates: "Expiry Oct 16 · 24d",
    },
    // Debit spread: 2 × (64 − 58) wide, paid $2.60 a spread, marked $1.96.
    { ticker: "EXMB", structure: "Put debit spread", legs: "2 × Oct 16 64/58 P", basis: 2 * 2.6 * MULT, pnl: 2 * (1.96 - 2.6) * MULT, rule: { state: "approaching", text: "Expiry 21 days · approaching" }, dates: "Expiry Oct 16 · 24d" },
    { ticker: "EXMF", structure: null, legs: "120 sh @ $71.40", basis: 120 * 71.4, pnl: 120 * (65.2 - 71.4), rule: { state: "not-met", text: "Stock max loss −15% · not met" }, dates: "Earnings Nov 3 · 42d" },
    // Cash-secured put: sold for $1.35, marked $0.93.
    { ticker: "EXMC", structure: "Cash-secured put", legs: "−1 Nov 20 30 P", basis: 1.35 * MULT, pnl: (1.35 - 0.93) * MULT, rule: { state: "not-met", text: "Option target 60% · not met" }, dates: "Expiry Nov 20 · 59d" },
    { ticker: "EXMT", structure: "Shares · ETF", legs: "200 sh @ $22.15", basis: 200 * 22.15, pnl: 200 * (23.02 - 22.15), rule: { state: "not-met", text: "Stock target 25% · not met" }, dates: "" },
  ].map((r) => ({ ...r, pct: (r.pnl / r.basis) * 100 })),
};
EXMP_PORTFOLIO.openPnl = EXMP_PORTFOLIO.rows.reduce((s, r) => s + r.pnl, 0);

/** The covered call's rules, each evaluated from the position's own figures. */
export const COVERED_CALL_RULES = [
  { name: "Option target 60%", threshold: 60, value: cc.creditCapturedPct, state: cc.creditCapturedPct >= 60 ? "reached" : "not-met" },
  { name: "Expiry 21 days", threshold: 21, value: cc.dte, state: cc.dte <= 21 ? "reached" : cc.dte <= 28 ? "approaching" : "not-met" },
  { name: "Stock target 25%", threshold: 25, value: cc.stockReturnPct, state: cc.stockReturnPct >= 25 ? "reached" : "not-met" },
  { name: "Stock max loss −15%", threshold: -15, value: cc.stockReturnPct, state: cc.stockReturnPct <= -15 ? "reached" : "not-met" },
];

/** The broker list's data slot (#3951). Its writer is consult 0997's answer; the page only reads it. */
export { default as BROKERS } from "../data/brokers.json";

/** Page 1's plan label per section, from the one list: "Every plan" / "Core and Premium" / "Premium". */
export const PLAN_REACH = { free: "Every plan", core: "Core and Premium", premium: "Premium" };
export const sectionPlanLabel = (key) => PLAN_REACH[SECTIONS.find((s) => s.key === key).plan];
