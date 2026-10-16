/**
 * The reports "Guess the gap" deals, baked in at build (blog-handoff-playables.md section 1; blog.md ruling 8). A game is
 * one batch of five; "Play five more" deals the next batch, and the fifth is followed by the first.
 *
 * Source: Growth's checked set, ai-team/growth/blog-guess-the-gap-reports.md and .json (stock-analyst-platform#4294,
 * checked 12 Oct 2026). Four fields per report, as Growth asked: company, report date (YYYY-MM-DD), the move options had
 * priced and the next-day close-to-close move, each in tenths of a percent (38 is 3.8%), the move signed (positive is up).
 * The `check` block (contract tickers, option closes) stays in the workspace: ADR 1106 Decision 2, ADR 1090.
 *
 * The priced moves are options-derived (ADR 1106 Decision 2): straddle price / stock price at the last close before the
 * report, the same definition as the straddle tool page. The pull request lists them.
 */
export const CHECKED = Object.freeze({ at: "2026-10-12", by: "ai-team/growth/blog-guess-the-gap-reports.md (stock-analyst-platform#4294)" });

export const REPORT_SETS = Object.freeze([
  [
    { company: "Apple", date: "2026-07-30", pricedTenths: 38, movedTenths: -74 },
    { company: "NVIDIA", date: "2026-08-26", pricedTenths: 59, movedTenths: 87 },
    { company: "JPMorgan Chase", date: "2026-07-14", pricedTenths: 33, movedTenths: 25 },
    { company: "Costco", date: "2026-09-24", pricedTenths: 30, movedTenths: 29 },
    { company: "Robinhood", date: "2026-07-29", pricedTenths: 96, movedTenths: -36 },
  ].map((r) => Object.freeze(r)),
  [
    { company: "Microsoft", date: "2026-07-29", pricedTenths: 68, movedTenths: 155 },
    { company: "Tesla", date: "2026-07-22", pricedTenths: 59, movedTenths: -145 },
    { company: "Walt Disney", date: "2026-08-05", pricedTenths: 62, movedTenths: 36 },
    { company: "Palantir", date: "2026-08-03", pricedTenths: 122, movedTenths: 295 },
    { company: "Snap", date: "2026-08-03", pricedTenths: 175, movedTenths: 149 },
  ].map((r) => Object.freeze(r)),
  [
    { company: "Alphabet", date: "2026-07-22", pricedTenths: 59, movedTenths: -71 },
    { company: "Netflix", date: "2026-07-16", pricedTenths: 94, movedTenths: -73 },
    { company: "Nike", date: "2026-10-01", pricedTenths: 89, movedTenths: -36 },
    { company: "Coinbase", date: "2026-07-30", pricedTenths: 73, movedTenths: -106 },
    { company: "Oracle", date: "2026-09-10", pricedTenths: 124, movedTenths: -17 },
  ].map((r) => Object.freeze(r)),
  [
    { company: "Amazon", date: "2026-07-30", pricedTenths: 83, movedTenths: 153 },
    { company: "Advanced Micro Devices", date: "2026-08-04", pricedTenths: 80, movedTenths: -70 },
    { company: "Starbucks", date: "2026-07-29", pricedTenths: 59, movedTenths: 16 },
    { company: "Uber", date: "2026-08-05", pricedTenths: 74, movedTenths: -53 },
    { company: "Salesforce", date: "2026-08-26", pricedTenths: 72, movedTenths: 226 },
  ].map((r) => Object.freeze(r)),
  [
    { company: "Meta Platforms", date: "2026-07-29", pricedTenths: 87, movedTenths: -80 },
    { company: "Intel", date: "2026-07-23", pricedTenths: 122, movedTenths: -79 },
    { company: "Walmart", date: "2026-08-20", pricedTenths: 50, movedTenths: -92 },
    { company: "Boeing", date: "2026-07-28", pricedTenths: 54, movedTenths: 48 },
    { company: "Micron", date: "2026-09-30", pricedTenths: 74, movedTenths: 30 },
  ].map((r) => Object.freeze(r)),
].map((s) => Object.freeze(s)));

/** The stamp under the lesson: where the figures come from. Growth's wording (the doc's "The stamp"). */
export const SOURCE_LINE = "Closing prices. Each priced move is computed from option prices at the last close before the report. Checked 12 Oct 2026.";
